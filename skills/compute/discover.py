"""Read-only compute discovery -- the runnable core of the compute capability.

One pass, strictly read-only: pick a provider adapter, discover the resources it
currently advertises, rank them against a WorkloadSpec with the explainable
matcher, record the sighting in the compute state store, and render a report. It
never provisions, rents, starts, stops, or spends -- discovery only.

This is the function a future SKILL.md invokes, the way compute-resell's SKILL.md
calls its claim_ledger.py helper:

    python skills/compute/discover.py --provider mock
    python skills/compute/discover.py --provider vastai --spec workload.json --json

`vastai` requires VAST_API_KEY in the environment; without it the adapter refuses
to run (AUTH_PERMISSION) rather than guess. The default provider is the offline
`mock`, so the command is safe to run with no credentials and no network.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Any

import contracts
import matching
import state as state_store
from failures import ComputeError
from mock_provider import MockProvider
from primeintellect_provider import PrimeIntellectProvider
from provider_base import ProviderAdapter
from vastai_provider import VastAiProvider

PROVIDERS = ("mock", "vastai", "primeintellect")


def build_provider(name: str, **kwargs: Any) -> ProviderAdapter:
    if name == "mock":
        return MockProvider()
    if name == "vastai":
        return VastAiProvider.from_env(**kwargs)
    if name == "primeintellect":
        return PrimeIntellectProvider.from_env(**kwargs)
    raise ValueError(f"unknown provider {name!r}; choose one of {', '.join(PROVIDERS)}")


@dataclass
class DiscoveryReport:
    provider: str
    spec: contracts.WorkloadSpec
    resources: list[contracts.Resource]
    ranked: list[matching.MatchResult]
    state_path: str

    @property
    def matched(self) -> list[matching.MatchResult]:
        return [r for r in self.ranked if r.matched]

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "spec": self.spec.to_dict(),
            "discovered": len(self.resources),
            "matched": [r.resource_id for r in self.matched],
            "state_path": self.state_path,
            "results": [r.to_dict() for r in self.ranked],
        }


def run_discovery(
    provider: ProviderAdapter,
    spec: contracts.WorkloadSpec,
    *,
    state_path: str = state_store.DEFAULT_STATE_PATH,
    query: dict[str, Any] | None = None,
    now: float | None = None,
) -> DiscoveryReport:
    """Discover, record, and rank. Persisting the sighting is the only write, and
    it lands under the state path (memory/ by default), never on provider infra.
    A re-run is idempotent: upsert refreshes each offer in place."""
    resources = provider.discover(query)
    state = state_store.load(state_path)
    for resource in resources:
        state_store.upsert_resource(state, resource, now=now)
    state_store.save(state_path, state)
    ranked = matching.match(spec, resources)
    return DiscoveryReport(provider.name, spec, resources, ranked, state_path)


def format_report(report: DiscoveryReport) -> str:
    by_id = {r.resource_id: r for r in report.resources}
    header = (
        f"compute discovery · provider={report.provider} · "
        f"discovered={len(report.resources)} · matched={len(report.matched)}"
    )
    lines = [header]
    if report.spec.label:
        lines.append(f"workload: {report.spec.label}")
    lines.append("")
    if not report.ranked:
        lines.append("(provider advertised no resources)")
        return "\n".join(lines)
    for result in report.ranked:
        resource = by_id[result.resource_id]
        price = resource.pricing.on_demand_usd_hr
        price_str = f"${price}/hr" if price is not None else "price n/a"
        mark = "OK" if result.matched else "--"
        lines.append(f"{mark}  {result.resource_id}  {resource.kind.value}  {price_str}")
        if not result.matched:
            for criterion in result.failures:
                lines.append(f"      {criterion.status}: {criterion.name} — {criterion.detail}")
    return "\n".join(lines)


@dataclass
class ProviderOutcome:
    provider: str
    resources: list[contracts.Resource]
    error: ComputeError | None = None


@dataclass
class AggregateReport:
    outcomes: list[ProviderOutcome]
    spec: contracts.WorkloadSpec
    ranked: list[matching.MatchResult]
    state_path: str

    @property
    def resources(self) -> list[contracts.Resource]:
        return [r for outcome in self.outcomes for r in outcome.resources]

    @property
    def matched(self) -> list[matching.MatchResult]:
        return [r for r in self.ranked if r.matched]

    @property
    def errors(self) -> list[ProviderOutcome]:
        return [o for o in self.outcomes if o.error is not None]

    @property
    def best(self) -> matching.MatchResult | None:
        matched = self.matched
        return matched[0] if matched else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "providers": [
                {
                    "provider": o.provider,
                    "discovered": len(o.resources),
                    "error": o.error.to_dict() if o.error is not None else None,
                }
                for o in self.outcomes
            ],
            "spec": self.spec.to_dict(),
            "discovered": len(self.resources),
            "matched": [r.resource_id for r in self.matched],
            "best": self.best.resource_id if self.best else None,
            "state_path": self.state_path,
            "results": [r.to_dict() for r in self.ranked],
        }


def discover_all(
    providers: list[ProviderAdapter],
    spec: contracts.WorkloadSpec,
    *,
    state_path: str = state_store.DEFAULT_STATE_PATH,
    query: dict[str, Any] | None = None,
    now: float | None = None,
) -> AggregateReport:
    """Discover across several providers and rank the merged pool. A provider that
    fails is isolated: its ComputeError is recorded in its outcome and the others
    still contribute. resource_id is provider-prefixed, so pools never collide."""
    state = state_store.load(state_path)
    outcomes: list[ProviderOutcome] = []
    pool: list[contracts.Resource] = []
    for provider in providers:
        try:
            resources = provider.discover(query)
        except ComputeError as exc:
            outcomes.append(ProviderOutcome(provider.name, [], exc))
            continue
        for resource in resources:
            state_store.upsert_resource(state, resource, now=now)
        pool.extend(resources)
        outcomes.append(ProviderOutcome(provider.name, resources))
    state_store.save(state_path, state)
    ranked = matching.match(spec, pool)
    return AggregateReport(outcomes, spec, ranked, state_path)


def format_aggregate_report(report: AggregateReport) -> str:
    by_id = {r.resource_id: r for r in report.resources}
    lines = [
        f"compute discovery (multi) · providers={len(report.outcomes)} · "
        f"discovered={len(report.resources)} · matched={len(report.matched)} · errors={len(report.errors)}"
    ]
    if report.spec.label:
        lines.append(f"workload: {report.spec.label}")
    lines.append("")
    lines.append("providers:")
    for outcome in report.outcomes:
        if outcome.error is not None:
            lines.append(f"  {outcome.provider:<16} {outcome.error.category.value}: {outcome.error.message}")
        else:
            lines.append(f"  {outcome.provider:<16} {len(outcome.resources)} offers")
    lines.append("")
    if report.best is not None:
        resource = by_id[report.best.resource_id]
        price = resource.pricing.on_demand_usd_hr
        price_str = f"${price}/hr" if price is not None else "price n/a"
        lines.append(f"best: {report.best.resource_id}  {resource.kind.value}  {price_str}")
    else:
        lines.append("best: none matched")
    lines.append("")
    for result in report.ranked:
        resource = by_id[result.resource_id]
        price = resource.pricing.on_demand_usd_hr
        price_str = f"${price}/hr" if price is not None else "price n/a"
        mark = "OK" if result.matched else "--"
        lines.append(f"{mark}  {result.resource_id}  {resource.kind.value}  {price_str}")
    return "\n".join(lines)


def _load_spec(path: str | None, inline: str | None) -> contracts.WorkloadSpec:
    if path and inline:
        raise ValueError("pass only one of --spec / --spec-json")
    if inline:
        data = json.loads(inline)
    elif path:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    else:
        return contracts.WorkloadSpec()
    if not isinstance(data, dict):
        raise ValueError("workload spec must be a JSON object")
    return contracts.WorkloadSpec.from_dict(data)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="discover.py", description="Read-only compute resource discovery (no provisioning, no spend)."
    )
    parser.add_argument("--provider", choices=PROVIDERS, default="mock", help="provider adapter (default: mock)")
    parser.add_argument("--providers", help="comma-separated providers for multi-provider aggregated discovery (overrides --provider)")
    parser.add_argument("--spec", help="path to a WorkloadSpec JSON file")
    parser.add_argument("--spec-json", help="inline WorkloadSpec JSON")
    parser.add_argument("--state", default=state_store.DEFAULT_STATE_PATH, help="state file path")
    parser.add_argument("--json", action="store_true", help="emit the report as JSON instead of text")
    args = parser.parse_args(argv)

    try:
        spec = _load_spec(args.spec, args.spec_json)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: invalid workload spec: {exc}", file=sys.stderr)
        return 2

    if args.providers:
        names = [n.strip() for n in args.providers.split(",") if n.strip()]
        try:
            providers = [build_provider(n) for n in names]
        except ValueError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2
        aggregate = discover_all(providers, spec, state_path=args.state)
        if args.json:
            print(json.dumps(aggregate.to_dict(), indent=2, sort_keys=True))
        else:
            print(format_aggregate_report(aggregate))
        return 1 if aggregate.errors and not aggregate.resources else 0

    try:
        provider = build_provider(args.provider)
        report = run_discovery(provider, spec, state_path=args.state)
    except ComputeError as exc:
        print(f"error: discovery failed [{exc.category.value}]: {exc.message}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report.to_dict(), indent=2, sort_keys=True))
    else:
        print(format_report(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

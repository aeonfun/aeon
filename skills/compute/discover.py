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

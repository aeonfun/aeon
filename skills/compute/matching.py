"""Match a WorkloadSpec against discovered resources, with explanations.

A resource is suitable only when every requirement the spec sets is *verified*
to hold. A requirement whose resource-side value is missing (None / UNKNOWN) is
`unverifiable` and blocks the match -- we never claim a resource is suitable on
unknown data. Each criterion carries its own ok/fail/unverifiable verdict so a
caller (or the operator) can see exactly why a resource did or did not qualify.

This is intentionally a plain policy, not a scheduler: no scoring weights, no
bin-packing. It ranks matches cheapest-first only as a convenience.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import contracts

OK = "ok"
FAIL = "fail"
UNVERIFIABLE = "unverifiable"


@dataclass(frozen=True)
class Criterion:
    name: str
    status: str
    detail: str


@dataclass
class MatchResult:
    resource_id: str
    matched: bool
    criteria: list[Criterion] = field(default_factory=list)

    @property
    def failures(self) -> list[Criterion]:
        return [c for c in self.criteria if c.status != OK]

    def to_dict(self) -> dict[str, object]:
        return {
            "resource_id": self.resource_id,
            "matched": self.matched,
            "criteria": [{"name": c.name, "status": c.status, "detail": c.detail} for c in self.criteria],
        }


def _cmp_min(name: str, required: float | None, actual: float | None, unit: str) -> Criterion | None:
    if required is None:
        return None
    if actual is None:
        return Criterion(name, UNVERIFIABLE, f"requires >= {required}{unit}; provider did not report it")
    if actual < required:
        return Criterion(name, FAIL, f"requires >= {required}{unit}; has {actual}{unit}")
    return Criterion(name, OK, f"{actual}{unit} >= {required}{unit}")


def match_one(spec: contracts.WorkloadSpec, resource: contracts.Resource) -> MatchResult:
    caps = resource.capabilities
    criteria: list[Criterion] = []

    if spec.kind is not None:
        if resource.kind == spec.kind:
            criteria.append(Criterion("kind", OK, f"is {resource.kind.value}"))
        else:
            criteria.append(Criterion("kind", FAIL, f"requires {spec.kind.value}; is {resource.kind.value}"))

    for crit in (
        _cmp_min("cpu_cores", spec.min_cpu_cores, caps.cpu_cores, ""),
        _cmp_min("ram_gb", spec.min_ram_gb, caps.ram_gb, "GB"),
    ):
        if crit is not None:
            criteria.append(crit)

    if spec.requires_gpu:
        if caps.gpu is None:
            criteria.append(Criterion("gpu", FAIL, "requires a GPU; none reported"))
        else:
            criteria.append(Criterion("gpu", OK, f"has {caps.gpu.count}x {caps.gpu.model}"))
            gpu_count = _cmp_min("gpu_count", spec.min_gpu_count, float(caps.gpu.count), "")
            if gpu_count is not None:
                criteria.append(gpu_count)
            vram = _cmp_min("vram_gb_total", spec.min_vram_gb_total, caps.gpu.total_vram_gb, "GB")
            if vram is not None:
                criteria.append(vram)

    if spec.architecture is not None:
        if caps.architecture == contracts.Architecture.UNKNOWN:
            criteria.append(Criterion("architecture", UNVERIFIABLE, f"requires {spec.architecture.value}; provider did not report it"))
        elif caps.architecture == spec.architecture:
            criteria.append(Criterion("architecture", OK, f"is {caps.architecture.value}"))
        else:
            criteria.append(Criterion("architecture", FAIL, f"requires {spec.architecture.value}; is {caps.architecture.value}"))

    if spec.required_runtimes:
        if not caps.runtimes:
            criteria.append(Criterion("runtimes", UNVERIFIABLE, f"requires {list(spec.required_runtimes)}; provider did not report supported runtimes"))
        else:
            missing = [r for r in spec.required_runtimes if r not in caps.runtimes]
            if missing:
                criteria.append(Criterion("runtimes", FAIL, f"missing {missing}"))
            else:
                criteria.append(Criterion("runtimes", OK, f"supports {list(spec.required_runtimes)}"))

    if spec.max_usd_hr is not None:
        candidates = [("on-demand", resource.pricing.on_demand_usd_hr)]
        if spec.allow_interruptible:
            candidates.append(("interruptible", resource.pricing.interruptible_usd_hr))
        known = [(label, p) for label, p in candidates if p is not None]
        if not known:
            detail = "provider reported no on-demand price" if not spec.allow_interruptible else "provider reported no on-demand or interruptible price"
            criteria.append(Criterion("price", UNVERIFIABLE, f"budget {spec.max_usd_hr}/hr; {detail}"))
        else:
            label, price = min(known, key=lambda item: item[1])
            if price > spec.max_usd_hr:
                criteria.append(Criterion("price", FAIL, f"{label} {price}/hr exceeds budget {spec.max_usd_hr}/hr"))
            else:
                criteria.append(Criterion("price", OK, f"{label} {price}/hr within budget {spec.max_usd_hr}/hr"))

    if spec.region is not None:
        region = resource.availability.region
        if region is None:
            criteria.append(Criterion("region", UNVERIFIABLE, f"requires {spec.region}; provider did not report a region"))
        elif region == spec.region:
            criteria.append(Criterion("region", OK, f"in {region}"))
        else:
            criteria.append(Criterion("region", FAIL, f"requires {spec.region}; in {region}"))

    if spec.persistence_required:
        persistent = caps.persistent
        if persistent is True:
            criteria.append(Criterion("persistence", OK, "resource is persistent"))
        elif persistent is False:
            criteria.append(Criterion("persistence", FAIL, "requires persistence; resource is ephemeral"))
        else:
            criteria.append(Criterion("persistence", UNVERIFIABLE, "requires persistence; provider did not report whether the resource persists"))

    # Availability is intrinsic, not a spec field: only an explicit False blocks a
    # match. An unreported (None) flag is noted but does not, by itself, disqualify.
    if resource.availability.available is False:
        criteria.append(Criterion("availability", FAIL, "provider reports it as not available"))

    matched = all(c.status == OK for c in criteria) if criteria else True
    return MatchResult(resource.resource_id, matched, criteria)


def _price_key(resource_by_id: dict[str, contracts.Resource], result: MatchResult) -> tuple[int, float]:
    price = resource_by_id[result.resource_id].pricing.on_demand_usd_hr
    return (0, price) if price is not None else (1, 0.0)


def match(spec: contracts.WorkloadSpec, resources: list[contracts.Resource]) -> list[MatchResult]:
    by_id = {r.resource_id: r for r in resources}
    results = [match_one(spec, r) for r in resources]
    results.sort(key=lambda res: (0 if res.matched else 1, *_price_key(by_id, res)))
    return results

"""Provider-agnostic compute resource and workload contracts for Aeon Compute.

Foundation layer, read-only. Nothing here provisions or mutates a real machine.
A discovered `Resource` describes a provider's *advertised* offer, not a running
computer; the discovered/provisioned distinction lives in `lifecycle.ResourceState`.

Design rules enforced here:
- Unknown values are `None`, never a fabricated default. A `None` price or spec
  means "the provider did not report it", recorded in `Resource.missing_fields`.
- `raw` preserves the provider's verbatim payload so nothing is lost in
  normalization and new provider fields need no contract change.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class ResourceKind(str, Enum):
    """The category of compute. These are deliberately distinct: an inference
    endpoint is not a computer, a sandbox is not necessarily persistent, and a
    GPU instance is not an agent workspace."""

    SANDBOX = "sandbox"
    CLOUD_VM = "cloud_vm"
    GPU_INSTANCE = "gpu_instance"
    AGENT_COMPUTER = "agent_computer"
    BYOC = "byoc"
    INFERENCE_ENDPOINT = "inference_endpoint"
    DISTRIBUTED_INFERENCE = "distributed_inference"


class Architecture(str, Enum):
    X86_64 = "x86_64"
    ARM64 = "arm64"
    UNKNOWN = "unknown"


def _nonneg(obj: str, name: str, value: float | None) -> None:
    if value is not None and value < 0:
        raise ValueError(f"{obj}.{name} must be >= 0, got {value!r}")


@dataclass(frozen=True)
class GpuSpec:
    model: str
    count: int
    vram_gb_per_gpu: float | None = None
    vram_gb_total: float | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.model, str) or not self.model.strip():
            raise ValueError("GpuSpec.model must be a non-empty string")
        if not isinstance(self.count, int) or self.count < 1:
            raise ValueError(f"GpuSpec.count must be an int >= 1, got {self.count!r}")
        _nonneg("GpuSpec", "vram_gb_per_gpu", self.vram_gb_per_gpu)
        _nonneg("GpuSpec", "vram_gb_total", self.vram_gb_total)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> GpuSpec:
        return cls(
            model=d["model"],
            count=int(d["count"]),
            vram_gb_per_gpu=d.get("vram_gb_per_gpu"),
            vram_gb_total=d.get("vram_gb_total"),
        )

    @property
    def total_vram_gb(self) -> float | None:
        """Total VRAM, derived from per-GPU x count when the provider reported
        only the per-GPU figure (the common case for single-GPU offers)."""
        if self.vram_gb_total is not None:
            return self.vram_gb_total
        if self.vram_gb_per_gpu is not None:
            return round(self.vram_gb_per_gpu * self.count, 3)
        return None


@dataclass
class ResourceCapabilities:
    cpu_cores: float | None = None
    ram_gb: float | None = None
    gpu: GpuSpec | None = None
    storage_gb: float | None = None
    persistent: bool | None = None
    architecture: Architecture = Architecture.UNKNOWN
    runtimes: tuple[str, ...] = ()
    extra: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _nonneg("ResourceCapabilities", "cpu_cores", self.cpu_cores)
        _nonneg("ResourceCapabilities", "ram_gb", self.ram_gb)
        _nonneg("ResourceCapabilities", "storage_gb", self.storage_gb)
        if not isinstance(self.architecture, Architecture):
            raise ValueError("ResourceCapabilities.architecture must be an Architecture")
        self.runtimes = tuple(self.runtimes)

    def to_dict(self) -> dict[str, Any]:
        return {
            "cpu_cores": self.cpu_cores,
            "ram_gb": self.ram_gb,
            "gpu": self.gpu.to_dict() if self.gpu else None,
            "storage_gb": self.storage_gb,
            "persistent": self.persistent,
            "architecture": self.architecture.value,
            "runtimes": list(self.runtimes),
            "extra": dict(self.extra),
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> ResourceCapabilities:
        return cls(
            cpu_cores=d.get("cpu_cores"),
            ram_gb=d.get("ram_gb"),
            gpu=GpuSpec.from_dict(d["gpu"]) if d.get("gpu") else None,
            storage_gb=d.get("storage_gb"),
            persistent=d.get("persistent"),
            architecture=Architecture(d.get("architecture", "unknown")),
            runtimes=tuple(d.get("runtimes", ())),
            extra=dict(d.get("extra", {})),
        )


@dataclass
class Pricing:
    on_demand_usd_hr: float | None = None
    interruptible_usd_hr: float | None = None
    storage_usd_gb_month: float | None = None
    currency: str = "USD"
    raw: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _nonneg("Pricing", "on_demand_usd_hr", self.on_demand_usd_hr)
        _nonneg("Pricing", "interruptible_usd_hr", self.interruptible_usd_hr)
        _nonneg("Pricing", "storage_usd_gb_month", self.storage_usd_gb_month)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Pricing:
        return cls(
            on_demand_usd_hr=d.get("on_demand_usd_hr"),
            interruptible_usd_hr=d.get("interruptible_usd_hr"),
            storage_usd_gb_month=d.get("storage_usd_gb_month"),
            currency=d.get("currency", "USD"),
            raw=dict(d.get("raw", {})),
        )


@dataclass
class Availability:
    # None means the provider did not report the flag -- it does NOT mean unavailable.
    available: bool | None = None
    region: str | None = None
    reliability: float | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.reliability is not None and not 0.0 <= self.reliability <= 1.0:
            raise ValueError(
                f"Availability.reliability must be within [0, 1], got {self.reliability!r}"
            )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Availability:
        return cls(
            available=d.get("available"),
            region=d.get("region"),
            reliability=d.get("reliability"),
            raw=dict(d.get("raw", {})),
        )


@dataclass
class Resource:
    provider: str
    provider_resource_id: str
    kind: ResourceKind
    capabilities: ResourceCapabilities = field(default_factory=ResourceCapabilities)
    pricing: Pricing = field(default_factory=Pricing)
    availability: Availability = field(default_factory=Availability)
    discovered_at: float = field(default_factory=time.time)
    raw: dict[str, Any] = field(default_factory=dict)
    missing_fields: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not isinstance(self.provider, str) or not self.provider.strip():
            raise ValueError("Resource.provider is required and must be a non-empty string")
        if not isinstance(self.provider_resource_id, str) or not self.provider_resource_id.strip():
            raise ValueError("Resource.provider_resource_id is required")
        if not isinstance(self.kind, ResourceKind):
            raise ValueError("Resource.kind must be a ResourceKind")
        self.missing_fields = tuple(self.missing_fields)

    @property
    def resource_id(self) -> str:
        return f"{self.provider}:{self.provider_resource_id}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "provider_resource_id": self.provider_resource_id,
            "resource_id": self.resource_id,
            "kind": self.kind.value,
            "capabilities": self.capabilities.to_dict(),
            "pricing": self.pricing.to_dict(),
            "availability": self.availability.to_dict(),
            "discovered_at": self.discovered_at,
            "raw": dict(self.raw),
            "missing_fields": list(self.missing_fields),
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Resource:
        return cls(
            provider=d["provider"],
            provider_resource_id=d["provider_resource_id"],
            kind=ResourceKind(d["kind"]),
            capabilities=ResourceCapabilities.from_dict(d.get("capabilities", {})),
            pricing=Pricing.from_dict(d.get("pricing", {})),
            availability=Availability.from_dict(d.get("availability", {})),
            discovered_at=d.get("discovered_at", time.time()),
            raw=dict(d.get("raw", {})),
            missing_fields=tuple(d.get("missing_fields", ())),
        )


@dataclass
class WorkloadSpec:
    """What a task needs. A requirement left `None` is 'don't care'; a requirement
    set is mandatory and a resource that cannot be *verified* to meet it is not a
    match (see `matching`)."""

    kind: ResourceKind | None = None
    min_cpu_cores: float | None = None
    min_ram_gb: float | None = None
    requires_gpu: bool = False
    min_gpu_count: int | None = None
    min_vram_gb_total: float | None = None
    architecture: Architecture | None = None
    required_runtimes: tuple[str, ...] = ()
    max_usd_hr: float | None = None
    allow_interruptible: bool = False
    region: str | None = None
    persistence_required: bool = False
    label: str | None = None

    def __post_init__(self) -> None:
        if self.min_gpu_count is not None and (not isinstance(self.min_gpu_count, int) or self.min_gpu_count < 1):
            raise ValueError("WorkloadSpec.min_gpu_count must be an int >= 1 when set")
        _nonneg("WorkloadSpec", "min_cpu_cores", self.min_cpu_cores)
        _nonneg("WorkloadSpec", "min_ram_gb", self.min_ram_gb)
        _nonneg("WorkloadSpec", "min_vram_gb_total", self.min_vram_gb_total)
        _nonneg("WorkloadSpec", "max_usd_hr", self.max_usd_hr)
        if self.kind is not None and not isinstance(self.kind, ResourceKind):
            raise ValueError("WorkloadSpec.kind must be a ResourceKind or None")
        if self.architecture is not None and not isinstance(self.architecture, Architecture):
            raise ValueError("WorkloadSpec.architecture must be an Architecture or None")
        self.required_runtimes = tuple(self.required_runtimes)
        # Asking for GPU specifics implies a GPU is required.
        if (self.min_gpu_count is not None or self.min_vram_gb_total is not None) and not self.requires_gpu:
            self.requires_gpu = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind.value if self.kind else None,
            "min_cpu_cores": self.min_cpu_cores,
            "min_ram_gb": self.min_ram_gb,
            "requires_gpu": self.requires_gpu,
            "min_gpu_count": self.min_gpu_count,
            "min_vram_gb_total": self.min_vram_gb_total,
            "architecture": self.architecture.value if self.architecture else None,
            "required_runtimes": list(self.required_runtimes),
            "max_usd_hr": self.max_usd_hr,
            "allow_interruptible": self.allow_interruptible,
            "region": self.region,
            "persistence_required": self.persistence_required,
            "label": self.label,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> WorkloadSpec:
        return cls(
            kind=ResourceKind(d["kind"]) if d.get("kind") else None,
            min_cpu_cores=d.get("min_cpu_cores"),
            min_ram_gb=d.get("min_ram_gb"),
            requires_gpu=bool(d.get("requires_gpu", False)),
            min_gpu_count=d.get("min_gpu_count"),
            min_vram_gb_total=d.get("min_vram_gb_total"),
            architecture=Architecture(d["architecture"]) if d.get("architecture") else None,
            required_runtimes=tuple(d.get("required_runtimes", ())),
            max_usd_hr=d.get("max_usd_hr"),
            allow_interruptible=bool(d.get("allow_interruptible", False)),
            region=d.get("region"),
            persistence_required=bool(d.get("persistence_required", False)),
            label=d.get("label"),
        )

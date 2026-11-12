"""A deterministic in-memory provider for tests.

Returns a fixed catalog covering the cases the core must handle: a fully-specced
GPU instance, a CPU-only VM, an offer with missing fields, and an explicitly
unavailable one. `discover({"simulate_failure": "<category>"})` raises a
classified ComputeError so failure handling can be exercised without a network.
"""
from __future__ import annotations

from typing import Any

import contracts
import provider_base
from failures import ComputeError, FailureCategory


def _catalog() -> list[contracts.Resource]:
    return [
        contracts.Resource(
            provider="mock",
            provider_resource_id="gpu-1",
            kind=contracts.ResourceKind.GPU_INSTANCE,
            capabilities=contracts.ResourceCapabilities(
                cpu_cores=32,
                ram_gb=128,
                gpu=contracts.GpuSpec(model="A100 SXM4", count=2, vram_gb_per_gpu=80, vram_gb_total=160),
                storage_gb=500,
                architecture=contracts.Architecture.X86_64,
                runtimes=("docker", "python"),
            ),
            pricing=contracts.Pricing(on_demand_usd_hr=1.5, interruptible_usd_hr=0.6, storage_usd_gb_month=0.1),
            availability=contracts.Availability(available=True, region="US", reliability=0.98),
            discovered_at=0.0,
        ),
        contracts.Resource(
            provider="mock",
            provider_resource_id="cpu-1",
            kind=contracts.ResourceKind.CLOUD_VM,
            capabilities=contracts.ResourceCapabilities(
                cpu_cores=8,
                ram_gb=32,
                storage_gb=100,
                architecture=contracts.Architecture.X86_64,
                runtimes=("docker",),
            ),
            pricing=contracts.Pricing(on_demand_usd_hr=0.12),
            availability=contracts.Availability(available=True, region="EU", reliability=0.95),
            discovered_at=0.0,
        ),
        contracts.Resource(
            provider="mock",
            provider_resource_id="partial-1",
            kind=contracts.ResourceKind.GPU_INSTANCE,
            capabilities=contracts.ResourceCapabilities(
                gpu=contracts.GpuSpec(model="RTX 4090", count=1),
                architecture=contracts.Architecture.UNKNOWN,
            ),
            pricing=contracts.Pricing(),
            availability=contracts.Availability(),
            discovered_at=0.0,
            missing_fields=("cpu_cores", "ram_gb", "vram_gb_total", "on_demand_usd_hr"),
        ),
        contracts.Resource(
            provider="mock",
            provider_resource_id="down-1",
            kind=contracts.ResourceKind.GPU_INSTANCE,
            capabilities=contracts.ResourceCapabilities(
                cpu_cores=16,
                ram_gb=64,
                gpu=contracts.GpuSpec(model="H100 PCIe", count=1, vram_gb_per_gpu=80, vram_gb_total=80),
                architecture=contracts.Architecture.X86_64,
            ),
            pricing=contracts.Pricing(on_demand_usd_hr=2.5),
            availability=contracts.Availability(available=False, region="US"),
            discovered_at=0.0,
        ),
    ]


class MockProvider(provider_base.ProviderAdapter):
    @property
    def name(self) -> str:
        return "mock"

    def discover(self, query: dict[str, Any] | None = None) -> list[contracts.Resource]:
        if query and "simulate_failure" in query:
            category = FailureCategory(query["simulate_failure"])
            raise ComputeError(category, f"mock simulated {category.value}", provider="mock")
        return _catalog()

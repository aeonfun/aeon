#!/usr/bin/env python3
"""Unit tests for skills/compute contracts. Run: python3 scripts/tests/test_compute_contracts.py"""
import os
import sys
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import contracts as C  # noqa: E402


class TestValidation(unittest.TestCase):
    def test_gpuspec_rejects_bad_values(self):
        with self.assertRaises(ValueError):
            C.GpuSpec(model="", count=1)
        with self.assertRaises(ValueError):
            C.GpuSpec(model="A100", count=0)
        with self.assertRaises(ValueError):
            C.GpuSpec(model="A100", count=1, vram_gb_total=-1)

    def test_capabilities_reject_negative(self):
        with self.assertRaises(ValueError):
            C.ResourceCapabilities(cpu_cores=-1)
        with self.assertRaises(ValueError):
            C.ResourceCapabilities(ram_gb=-0.5)

    def test_pricing_rejects_negative(self):
        with self.assertRaises(ValueError):
            C.Pricing(on_demand_usd_hr=-1)

    def test_availability_reliability_range(self):
        with self.assertRaises(ValueError):
            C.Availability(reliability=1.5)
        with self.assertRaises(ValueError):
            C.Availability(reliability=-0.1)
        self.assertIsNone(C.Availability().available)  # unknown, not unavailable

    def test_resource_requires_identity(self):
        with self.assertRaises(ValueError):
            C.Resource(provider="", provider_resource_id="x", kind=C.ResourceKind.GPU_INSTANCE)
        with self.assertRaises(ValueError):
            C.Resource(provider="p", provider_resource_id="", kind=C.ResourceKind.GPU_INSTANCE)
        with self.assertRaises(ValueError):
            C.Resource(provider="p", provider_resource_id="x", kind="gpu_instance")

    def test_resource_id(self):
        r = C.Resource(provider="vastai", provider_resource_id="123", kind=C.ResourceKind.GPU_INSTANCE)
        self.assertEqual(r.resource_id, "vastai:123")


class TestWorkloadSpec(unittest.TestCase):
    def test_gpu_count_floor(self):
        with self.assertRaises(ValueError):
            C.WorkloadSpec(min_gpu_count=0)

    def test_negatives_rejected(self):
        with self.assertRaises(ValueError):
            C.WorkloadSpec(max_usd_hr=-1)

    def test_vram_implies_gpu(self):
        spec = C.WorkloadSpec(min_vram_gb_total=40)
        self.assertTrue(spec.requires_gpu)
        spec2 = C.WorkloadSpec(min_gpu_count=2)
        self.assertTrue(spec2.requires_gpu)


class TestSerialization(unittest.TestCase):
    def _sample(self):
        return C.Resource(
            provider="vastai",
            provider_resource_id="123",
            kind=C.ResourceKind.GPU_INSTANCE,
            capabilities=C.ResourceCapabilities(
                cpu_cores=32, ram_gb=128,
                gpu=C.GpuSpec(model="A100", count=2, vram_gb_per_gpu=80, vram_gb_total=160),
                storage_gb=500, architecture=C.Architecture.X86_64, runtimes=("docker",),
            ),
            pricing=C.Pricing(on_demand_usd_hr=1.5, interruptible_usd_hr=0.6),
            availability=C.Availability(available=True, region="US", reliability=0.98),
            discovered_at=123.0,
            missing_fields=("x",),
        )

    def test_resource_round_trip(self):
        r = self._sample()
        d = r.to_dict()
        self.assertEqual(d["resource_id"], "vastai:123")
        self.assertEqual(d["kind"], "gpu_instance")
        self.assertEqual(d["capabilities"]["architecture"], "x86_64")
        again = C.Resource.from_dict(d)
        self.assertEqual(again.to_dict(), d)
        self.assertEqual(again.capabilities.gpu.vram_gb_total, 160)
        self.assertEqual(again.discovered_at, 123.0)

    def test_workloadspec_round_trip(self):
        spec = C.WorkloadSpec(requires_gpu=True, min_vram_gb_total=40, max_usd_hr=2.0, architecture=C.Architecture.ARM64)
        self.assertEqual(C.WorkloadSpec.from_dict(spec.to_dict()).to_dict(), spec.to_dict())


class TestReviewFixes(unittest.TestCase):
    def test_total_vram_gb_property(self):
        self.assertEqual(C.GpuSpec("A", 2, vram_gb_per_gpu=80).total_vram_gb, 160.0)
        self.assertEqual(C.GpuSpec("A", 2, vram_gb_per_gpu=80, vram_gb_total=200).total_vram_gb, 200.0)
        self.assertIsNone(C.GpuSpec("A", 2).total_vram_gb)

    def test_new_fields_round_trip(self):
        caps = C.ResourceCapabilities(persistent=True)
        self.assertIs(C.ResourceCapabilities.from_dict(caps.to_dict()).persistent, True)
        spec = C.WorkloadSpec(allow_interruptible=True)
        self.assertTrue(C.WorkloadSpec.from_dict(spec.to_dict()).allow_interruptible)


if __name__ == "__main__":
    unittest.main()

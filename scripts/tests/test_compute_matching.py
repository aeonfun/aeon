#!/usr/bin/env python3
"""Unit tests for skills/compute workload matching. Run: python3 scripts/tests/test_compute_matching.py"""
import os
import sys
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import contracts as C  # noqa: E402
import matching as M  # noqa: E402
from mock_provider import MockProvider  # noqa: E402


def _by_id(resources):
    return {r.provider_resource_id: r for r in resources}


class TestMatching(unittest.TestCase):
    def setUp(self):
        self.resources = MockProvider().discover()
        self.r = _by_id(self.resources)

    def test_full_gpu_match(self):
        spec = C.WorkloadSpec(requires_gpu=True, min_vram_gb_total=100, min_cpu_cores=16, max_usd_hr=2.0)
        res = M.match_one(spec, self.r["gpu-1"])
        self.assertTrue(res.matched)
        self.assertTrue(all(c.status == M.OK for c in res.criteria))

    def test_gpu_required_but_cpu_only_fails(self):
        spec = C.WorkloadSpec(requires_gpu=True)
        res = M.match_one(spec, self.r["cpu-1"])
        self.assertFalse(res.matched)
        self.assertEqual([c.name for c in res.failures], ["gpu"])

    def test_unverifiable_requirement_blocks_match(self):
        # partial-1 reports no cpu_cores, no price, no total vram -> all unverifiable.
        spec = C.WorkloadSpec(requires_gpu=True, min_cpu_cores=4, min_vram_gb_total=20, max_usd_hr=5.0)
        res = M.match_one(spec, self.r["partial-1"])
        self.assertFalse(res.matched)
        statuses = {c.name: c.status for c in res.criteria}
        self.assertEqual(statuses["cpu_cores"], M.UNVERIFIABLE)
        self.assertEqual(statuses["vram_gb_total"], M.UNVERIFIABLE)
        self.assertEqual(statuses["price"], M.UNVERIFIABLE)

    def test_budget_exceeded_fails(self):
        spec = C.WorkloadSpec(max_usd_hr=1.0)  # gpu-1 is 1.5/hr
        res = M.match_one(spec, self.r["gpu-1"])
        self.assertFalse(res.matched)
        self.assertEqual([c.status for c in res.criteria if c.name == "price"], [M.FAIL])

    def test_architecture_mismatch_and_unknown(self):
        self.assertFalse(M.match_one(C.WorkloadSpec(architecture=C.Architecture.ARM64), self.r["gpu-1"]).matched)
        unknown = M.match_one(C.WorkloadSpec(architecture=C.Architecture.X86_64), self.r["partial-1"])
        self.assertFalse(unknown.matched)
        self.assertEqual([c.status for c in unknown.criteria if c.name == "architecture"], [M.UNVERIFIABLE])

    def test_region_mismatch_fails(self):
        res = M.match_one(C.WorkloadSpec(region="US"), self.r["cpu-1"])  # cpu-1 is EU
        self.assertFalse(res.matched)

    def test_explicit_unavailability_fails(self):
        res = M.match_one(C.WorkloadSpec(requires_gpu=True), self.r["down-1"])
        self.assertFalse(res.matched)
        self.assertIn("availability", [c.name for c in res.failures])

    def test_empty_spec_matches_anything(self):
        self.assertTrue(M.match_one(C.WorkloadSpec(), self.r["gpu-1"]).matched)

    def test_match_ranks_matched_first_then_cheapest(self):
        spec = C.WorkloadSpec()  # everything with an availability!=False matches
        ranked = M.match(spec, self.resources)
        self.assertTrue(ranked[0].matched)
        matched_ids = [r.resource_id for r in ranked if r.matched]
        # cpu-1 (0.12) is cheaper than gpu-1 (1.5), so it ranks ahead among matched.
        self.assertLess(matched_ids.index("mock:cpu-1"), matched_ids.index("mock:gpu-1"))
        # down-1 is unavailable -> not matched -> ranked after matched ones.
        self.assertFalse(ranked[-1].matched)


class TestReviewFixes(unittest.TestCase):
    def _gpu(self, rid, *, vram_total=None, vram_per=None, count=1, persistent=None, on_demand=None, interruptible=None):
        return C.Resource(
            provider="t", provider_resource_id=rid, kind=C.ResourceKind.GPU_INSTANCE,
            capabilities=C.ResourceCapabilities(
                gpu=C.GpuSpec(model="X", count=count, vram_gb_per_gpu=vram_per, vram_gb_total=vram_total),
                persistent=persistent,
            ),
            pricing=C.Pricing(on_demand_usd_hr=on_demand, interruptible_usd_hr=interruptible),
            availability=C.Availability(available=True),
        )

    def test_vram_total_derived_from_per_gpu(self):
        res = M.match_one(C.WorkloadSpec(requires_gpu=True, min_vram_gb_total=40), self._gpu("v", vram_per=80, count=1))
        self.assertTrue(res.matched)
        self.assertEqual([c.status for c in res.criteria if c.name == "vram_gb_total"], [M.OK])

    def test_persistence_unverifiable_blocks(self):
        res = M.match_one(C.WorkloadSpec(persistence_required=True), self._gpu("p", persistent=None))
        self.assertFalse(res.matched)
        self.assertEqual([c.status for c in res.criteria if c.name == "persistence"], [M.UNVERIFIABLE])

    def test_persistence_fail_when_ephemeral(self):
        res = M.match_one(C.WorkloadSpec(persistence_required=True), self._gpu("e", persistent=False))
        self.assertFalse(res.matched)
        self.assertEqual([c.status for c in res.criteria if c.name == "persistence"], [M.FAIL])

    def test_persistence_ok_when_persistent(self):
        self.assertTrue(M.match_one(C.WorkloadSpec(persistence_required=True), self._gpu("k", persistent=True)).matched)

    def test_interruptible_budget_opt_in(self):
        r = self._gpu("i", on_demand=None, interruptible=0.5)
        self.assertFalse(M.match_one(C.WorkloadSpec(max_usd_hr=1.0), r).matched)
        ok = M.match_one(C.WorkloadSpec(max_usd_hr=1.0, allow_interruptible=True), r)
        self.assertTrue(ok.matched)
        self.assertEqual([c.status for c in ok.criteria if c.name == "price"], [M.OK])

    def test_interruptible_still_fails_over_budget(self):
        res = M.match_one(C.WorkloadSpec(max_usd_hr=1.0, allow_interruptible=True), self._gpu("o", on_demand=None, interruptible=2.0))
        self.assertFalse(res.matched)
        self.assertEqual([c.status for c in res.criteria if c.name == "price"], [M.FAIL])


if __name__ == "__main__":
    unittest.main()

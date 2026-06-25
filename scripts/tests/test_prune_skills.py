#!/usr/bin/env python3
"""Unit tests for prune_skills. Run: python3 scripts/tests/test_prune_skills.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import prune_skills as ps  # noqa: E402


class TestRetire(unittest.TestCase):
    def test_enabled_never_run(self):
        out = ps.retirement_candidates([{"skill": "x", "enabled": True, "total_runs": 0}])
        self.assertEqual(out[0]["skill"], "x")
        self.assertIn("never run", out[0]["reason"])

    def test_chronically_low_quality(self):
        out = ps.retirement_candidates([
            {"skill": "bad", "enabled": True, "total_runs": 20, "runs_scored": 10, "avg_score": 2.0},
        ])
        self.assertEqual(out[0]["skill"], "bad")
        self.assertEqual(out[0]["confidence"], "high")

    def test_low_quality_needs_enough_samples(self):
        # avg low but only 3 scored -> not enough evidence, not flagged
        out = ps.retirement_candidates([
            {"skill": "new", "enabled": True, "total_runs": 3, "runs_scored": 3, "avg_score": 1.0},
        ])
        self.assertEqual(out, [])

    def test_dormant_dead_weight(self):
        out = ps.retirement_candidates([
            {"skill": "z", "enabled": False, "total_runs": 0, "chained": False},
        ])
        self.assertEqual(out[0]["reason"], "dormant: disabled, never chained, never run")

    def test_disabled_but_chained_is_kept(self):
        out = ps.retirement_candidates([
            {"skill": "dep", "enabled": False, "total_runs": 0, "chained": True},
        ])
        self.assertEqual(out, [])

    def test_core_never_flagged(self):
        out = ps.retirement_candidates([
            {"skill": "heartbeat", "enabled": True, "total_runs": 0, "is_core": True},
        ])
        self.assertEqual(out, [])

    def test_healthy_skill_kept(self):
        out = ps.retirement_candidates([
            {"skill": "good", "enabled": True, "total_runs": 30, "runs_scored": 30, "avg_score": 4.2},
        ])
        self.assertEqual(out, [])

    def test_ranked_high_first(self):
        out = ps.retirement_candidates([
            {"skill": "neverrun", "enabled": True, "total_runs": 0},                                  # medium
            {"skill": "lowq", "enabled": True, "total_runs": 9, "runs_scored": 9, "avg_score": 1.5},  # high
        ])
        self.assertEqual([o["skill"] for o in out], ["lowq", "neverrun"])


class TestSiblings(unittest.TestCase):
    def test_shared_host(self):
        records = [
            {"skill": "defi-overview", "hosts": ["api.llama.fi", "yields.llama.fi"]},
            {"skill": "token-movers", "hosts": ["api.coingecko.com"]},
            {"skill": "rwa-pulse", "hosts": ["api.llama.fi"]},
        ]
        self.assertEqual(ps.find_siblings("defi-overview", records), ["rwa-pulse"])

    def test_no_hosts_no_siblings(self):
        self.assertEqual(ps.find_siblings("x", [{"skill": "x", "hosts": []}]), [])

    def test_unknown_target(self):
        self.assertEqual(ps.find_siblings("ghost", [{"skill": "x", "hosts": ["a.com"]}]), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)

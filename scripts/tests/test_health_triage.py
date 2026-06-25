#!/usr/bin/env python3
"""Unit tests for health_triage. Run: python3 scripts/tests/test_health_triage.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import health_triage as ht  # noqa: E402


class TestNeedsComment(unittest.TestCase):
    def test_clean_run_silent(self):
        self.assertFalse(ht.needs_comment({"skill": "x", "score": 4, "flags": []}))
        self.assertFalse(ht.needs_comment({"skill": "x", "score": 3, "flags": []}))

    def test_low_score_regresses(self):
        self.assertTrue(ht.needs_comment({"skill": "x", "score": 2}))
        self.assertTrue(ht.needs_comment({"skill": "x", "score": 1}))

    def test_failure_flag_regresses_even_at_good_score(self):
        self.assertTrue(ht.needs_comment({"skill": "x", "score": 4, "flags": ["dead_citation"]}))
        self.assertTrue(ht.needs_comment({"skill": "x", "score": 5, "flags": ["api_error"]}))

    def test_nonfailure_flag_at_good_score_silent(self):
        self.assertFalse(ht.needs_comment({"skill": "x", "score": 4, "flags": ["generic_content"]}))


class TestSeverity(unittest.TestCase):
    def test_high(self):
        self.assertEqual(ht.severity({"score": 1}), "high")
        self.assertEqual(ht.severity({"score": 5, "flags": ["api_error"]}), "high")

    def test_medium(self):
        self.assertEqual(ht.severity({"score": 2}), "medium")
        self.assertEqual(ht.severity({"score": 4, "flags": ["dead_citation"]}), "medium")

    def test_none_for_clean(self):
        self.assertEqual(ht.severity({"score": 4, "flags": []}), "none")


class TestPrioritize(unittest.TestCase):
    def test_filters_clean_and_ranks_by_votes_then_severity(self):
        records = [
            {"skill": "clean", "score": 5, "flags": []},                     # dropped
            {"skill": "low-votes-high-sev", "score": 1, "votes": 0},          # high sev, 0 votes
            {"skill": "high-votes-med-sev", "score": 2, "votes": 9},          # med sev, 9 votes
            {"skill": "mid", "score": 2, "votes": 3, "flags": ["stale_data"]},
        ]
        out = ht.prioritize(records)
        self.assertEqual([i["skill"] for i in out],
                         ["high-votes-med-sev", "mid", "low-votes-high-sev"])
        self.assertNotIn("clean", [i["skill"] for i in out])

    def test_votes_dominate_severity(self):
        # a heavily-upvoted medium beats a zero-vote high — humans set priority
        records = [
            {"skill": "a", "score": 1, "votes": 0},   # high sev
            {"skill": "b", "score": 2, "votes": 5},   # med sev, more votes
        ]
        self.assertEqual([i["skill"] for i in ht.prioritize(records)], ["b", "a"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

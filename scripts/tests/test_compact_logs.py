#!/usr/bin/env python3
"""Unit tests for compact_logs.plan. Run: python3 scripts/tests/test_compact_logs.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import compact_logs as cl  # noqa: E402

TODAY = "2026-06-17"


class TestPlan(unittest.TestCase):
    def test_age_bands(self):
        files = [
            "2026-06-17.md",  # 0d  keep
            "2026-06-11.md",  # 6d  keep
            "2026-06-10.md",  # 7d  keep (boundary)
            "2026-06-09.md",  # 8d  summarize
            "2026-05-18.md",  # 30d summarize (boundary)
            "2026-05-17.md",  # 31d drop
            "2026-01-01.md",  # old drop
        ]
        p = cl.plan(files, TODAY)
        self.assertIn("2026-06-10.md", [os.path.basename(x) for x in p["keep"]])
        self.assertIn("2026-06-09.md", [os.path.basename(x) for x in p["summarize"]])
        self.assertIn("2026-05-18.md", [os.path.basename(x) for x in p["summarize"]])
        self.assertIn("2026-05-17.md", [os.path.basename(x) for x in p["drop"]])
        self.assertIn("2026-01-01.md", [os.path.basename(x) for x in p["drop"]])

    def test_counts(self):
        files = [f"2026-06-{d:02d}.md" for d in range(1, 18)]  # 17 days, 1st..17th
        p = cl.plan(files, TODAY)
        # keep = 11th..17th (7 files, age 0..6) + 10th (age 7) = 8
        self.assertEqual(len(p["keep"]), 8)
        # summarize = 1st..9th (age 8..16) = 9
        self.assertEqual(len(p["summarize"]), 9)
        self.assertEqual(len(p["drop"]), 0)

    def test_nondated_files_kept(self):
        p = cl.plan(["memory/logs/.gitkeep", "memory/logs/README.md", "2026-01-01.md"], TODAY)
        base = [os.path.basename(x) for x in p["keep"]]
        self.assertIn(".gitkeep", base)
        self.assertIn("README.md", base)
        self.assertEqual([os.path.basename(x) for x in p["drop"]], ["2026-01-01.md"])

    def test_custom_thresholds(self):
        p = cl.plan(["2026-06-15.md"], TODAY, verbatim_days=1, summarize_days=2)
        # age 2 -> summarize band (≤2)
        self.assertEqual([os.path.basename(x) for x in p["summarize"]], ["2026-06-15.md"])

    def test_empty(self):
        self.assertEqual(cl.plan([], TODAY), {"keep": [], "summarize": [], "drop": []})


if __name__ == "__main__":
    unittest.main(verbosity=2)

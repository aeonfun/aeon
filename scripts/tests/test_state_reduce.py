#!/usr/bin/env python3
"""Unit tests for state_reduce. Run: python3 scripts/tests/test_state_reduce.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import state_reduce as sr  # noqa: E402


class TestReduce(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(sr.reduce_events([]), {})

    def test_single_success(self):
        st = sr.reduce_events([{"skill": "x", "status": "success", "ts": "2026-06-17T10:00:00Z", "quality_score": 4}])
        x = st["x"]
        self.assertEqual(x["total_runs"], 1)
        self.assertEqual(x["total_successes"], 1)
        self.assertEqual(x["consecutive_failures"], 0)
        self.assertEqual(x["success_rate"], 1.0)
        self.assertEqual(x["last_status"], "success")
        self.assertEqual(x["last_success"], "2026-06-17T10:00:00Z")
        self.assertEqual(x["last_quality_score"], 4)

    def test_consecutive_failures_and_reset(self):
        ev = [
            {"skill": "x", "status": "failed", "ts": "2026-06-17T10:00:00Z", "error": "e1"},
            {"skill": "x", "status": "failed", "ts": "2026-06-17T11:00:00Z", "error": "e2"},
            {"skill": "x", "status": "success", "ts": "2026-06-17T12:00:00Z"},
            {"skill": "x", "status": "failed", "ts": "2026-06-17T13:00:00Z", "error": "e3"},
        ]
        x = sr.reduce_events(ev)["x"]
        self.assertEqual(x["total_runs"], 4)
        self.assertEqual(x["total_failures"], 3)
        self.assertEqual(x["consecutive_failures"], 1)   # reset at success, then one fail
        self.assertEqual(x["success_rate"], 0.25)
        self.assertEqual(x["last_status"], "failed")
        self.assertEqual(x["last_error"], "e3")
        self.assertEqual(x["last_failed"], "2026-06-17T13:00:00Z")
        self.assertEqual(x["last_success"], "2026-06-17T12:00:00Z")

    def test_order_independence(self):
        # events arrive out of order (concurrent appends) — ts ordering makes the fold deterministic
        ev_in_order = [
            {"skill": "x", "status": "success", "ts": "2026-06-17T10:00:00Z"},
            {"skill": "x", "status": "failed", "ts": "2026-06-17T11:00:00Z", "error": "boom"},
        ]
        a = sr.reduce_events(ev_in_order)
        b = sr.reduce_events(list(reversed(ev_in_order)))
        self.assertEqual(a, b)
        self.assertEqual(a["x"]["last_status"], "failed")

    def test_multiple_skills(self):
        st = sr.reduce_events([
            {"skill": "a", "status": "success", "ts": "2026-06-17T10:00:00Z"},
            {"skill": "b", "status": "failed", "ts": "2026-06-17T10:00:00Z", "error": "x"},
        ])
        self.assertEqual(set(st), {"a", "b"})
        self.assertEqual(st["a"]["success_rate"], 1.0)
        self.assertEqual(st["b"]["success_rate"], 0.0)

    def test_quality_score_keeps_latest_nonzero(self):
        x = sr.reduce_events([
            {"skill": "x", "status": "success", "ts": "2026-06-17T10:00:00Z", "quality_score": 5},
            {"skill": "x", "status": "success", "ts": "2026-06-17T11:00:00Z", "quality_score": 0},
        ])["x"]
        self.assertEqual(x["last_quality_score"], 5)   # 0 (unscored) doesn't overwrite

    def test_schema_parity_with_file_writer(self):
        # The Issues-backend fold must produce EXACTLY the per-skill keys that
        # aeon.yml's file-mode apply_state_update writes, or a reader cut over to
        # the materialized file silently loses a field. This is the contract that
        # makes the reader cutover safe — guard it explicitly.
        EXPECTED = {
            "last_status", "last_dispatch", "last_success", "last_failed",
            "total_runs", "total_successes", "total_failures",
            "consecutive_failures", "success_rate",
            "last_quality_score", "last_error",
        }
        x = sr.reduce_events([{"skill": "x", "status": "success", "ts": "2026-06-17T10:00:00Z"}])["x"]
        self.assertEqual(set(x.keys()), EXPECTED)
        # _blank() (the zero-event shape) must carry the same keys too.
        self.assertEqual(set(sr._blank().keys()), EXPECTED)


class TestDispatch(unittest.TestCase):
    def test_dispatch_sets_watermark_not_counters(self):
        x = sr.reduce_events([
            {"skill": "x", "status": "dispatched", "ts": "2026-06-17T06:25:00Z"},
        ])["x"]
        self.assertEqual(x["last_dispatch"], "2026-06-17T06:25:00Z")
        self.assertEqual(x["last_status"], "dispatched")
        # A dispatch is not a run outcome — counters stay clean.
        self.assertEqual(x["total_runs"], 0)
        self.assertEqual(x["consecutive_failures"], 0)
        self.assertEqual(x["last_failed"], None)

    def test_dispatch_then_success(self):
        x = sr.reduce_events([
            {"skill": "x", "status": "dispatched", "ts": "2026-06-17T06:25:00Z"},
            {"skill": "x", "status": "success", "ts": "2026-06-17T06:40:00Z", "quality_score": 4},
        ])["x"]
        self.assertEqual(x["last_dispatch"], "2026-06-17T06:25:00Z")
        self.assertEqual(x["last_status"], "success")   # later run outcome wins
        self.assertEqual(x["last_success"], "2026-06-17T06:40:00Z")
        self.assertEqual(x["total_runs"], 1)

    def test_dispatch_does_not_reset_or_spike_failures(self):
        # A dispatch between failures must not clear consecutive_failures (that
        # would defeat reactive triggers) nor count as a failure itself.
        x = sr.reduce_events([
            {"skill": "x", "status": "failed", "ts": "2026-06-17T05:00:00Z", "error": "e1"},
            {"skill": "x", "status": "dispatched", "ts": "2026-06-17T06:00:00Z"},
            {"skill": "x", "status": "failed", "ts": "2026-06-17T07:00:00Z", "error": "e2"},
        ])["x"]
        self.assertEqual(x["consecutive_failures"], 2)
        self.assertEqual(x["total_runs"], 2)
        self.assertEqual(x["last_dispatch"], "2026-06-17T06:00:00Z")


class TestParse(unittest.TestCase):
    def test_jsonl_skips_noise(self):
        text = '{"skill":"x","status":"success","ts":"t"}\n\nnot json\n{"skill":"y","status":"failed"}\n'
        evs = sr.parse_jsonl(text)
        self.assertEqual(len(evs), 2)
        self.assertEqual(evs[0]["skill"], "x")

    def test_accepts_array_lines(self):
        self.assertEqual(len(sr.parse_jsonl('[{"skill":"a","status":"success"}]')), 1)


class TestUntrustedEvents(unittest.TestCase):
    NOW = sr.datetime(2026, 10, 1, 12, 0, tzinfo=sr.timezone.utc)

    def test_future_ts_is_dropped(self):
        # A forged far-future dispatch would otherwise pin last_dispatch forever.
        st = sr.reduce_events([
            {"skill": "x", "status": "success", "ts": "2026-10-01T11:00:00Z"},
            {"skill": "x", "status": "dispatched", "ts": "2099-01-01T00:00:00Z"},
        ], now=self.NOW)
        self.assertEqual(st["x"]["last_status"], "success")
        self.assertIsNone(st["x"]["last_dispatch"])

    def test_small_clock_skew_is_kept(self):
        st = sr.reduce_events([{"skill": "x", "status": "dispatched", "ts": "2026-10-01T12:05:00Z"}], now=self.NOW)
        self.assertEqual(st["x"]["last_dispatch"], "2026-10-01T12:05:00Z")

    def test_unparseable_ts_is_dropped(self):
        st = sr.reduce_events([
            {"skill": "x", "status": "failed", "ts": "zzzz"},
            {"skill": "y", "status": "success", "ts": "2026-10-01T10:00:00Z"},
        ], now=self.NOW)
        self.assertNotIn("x", st)
        self.assertIn("y", st)

    def test_reactive_source_is_folded(self):
        st = sr.reduce_events([
            {"skill": "skill-repair", "status": "dispatched", "ts": "2026-10-01T09:00:00Z", "source": "a"},
            {"skill": "skill-repair", "status": "dispatched", "ts": "2026-10-01T10:30:00Z", "source": "b"},
        ], now=self.NOW)
        self.assertEqual(st["skill-repair"]["reactive_sources"],
                         {"a": "2026-10-01T09:00:00Z", "b": "2026-10-01T10:30:00Z"})
        self.assertEqual(st["skill-repair"]["last_dispatch"], "2026-10-01T10:30:00Z")


if __name__ == "__main__":
    unittest.main(verbosity=2)

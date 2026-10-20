#!/usr/bin/env python3
"""Unit tests for memory_prep. Run: python3 scripts/tests/test_memory_prep.py"""
import datetime
import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import memory_prep as mp  # noqa: E402

D = datetime.date


class TestWatermark(unittest.TestCase):
    def test_parse_date(self):
        self.assertEqual(mp.parse_date("2026-08-16"), D(2026, 8, 16))
        self.assertIsNone(mp.parse_date(""))
        self.assertIsNone(mp.parse_date("never"))
        self.assertIsNone(mp.parse_date("garbage"))

    def test_from_memory_md(self):
        self.assertEqual(mp.watermark_from_memory_md("x\n*Last consolidated: 2026-08-16*\ny"),
                         D(2026, 8, 16))
        self.assertEqual(mp.watermark_from_memory_md("*Last Consolidated: 2026-01-02*"),
                         D(2026, 1, 2))
        self.assertIsNone(mp.watermark_from_memory_md("no marker here"))
        self.assertIsNone(mp.watermark_from_memory_md("*Last consolidated: never*"))

    def test_resolve_prefers_state_file(self):
        state = json.dumps({"last_consolidated": "2026-08-20"})
        md = "*Last consolidated: 2026-08-10*"
        self.assertEqual(mp.resolve_watermark(state, md), (D(2026, 8, 20), "state-file"))

    def test_resolve_falls_back_to_md(self):
        self.assertEqual(mp.resolve_watermark(None, "*Last consolidated: 2026-08-10*"),
                         (D(2026, 8, 10), "memory.md"))
        self.assertEqual(mp.resolve_watermark("{bad json", "*Last consolidated: 2026-08-10*"),
                         (D(2026, 8, 10), "memory.md"))

    def test_resolve_none(self):
        self.assertEqual(mp.resolve_watermark(None, "nothing"), (None, "none"))


class TestWindow(unittest.TestCase):
    def test_no_watermark_is_3day(self):
        start, clamped = mp.compute_window(None, D(2026, 8, 22))
        self.assertEqual(start, D(2026, 8, 19))
        self.assertFalse(clamped)

    def test_normal_gap_starts_at_watermark(self):
        start, clamped = mp.compute_window(D(2026, 8, 16), D(2026, 8, 22))
        self.assertEqual(start, D(2026, 8, 16))
        self.assertFalse(clamped)

    def test_large_gap_clamps_to_14(self):
        start, clamped = mp.compute_window(D(2026, 6, 1), D(2026, 8, 22))
        self.assertEqual(start, D(2026, 8, 8))
        self.assertTrue(clamped)

    def test_exactly_14_not_clamped(self):
        start, clamped = mp.compute_window(D(2026, 8, 8), D(2026, 8, 22))
        self.assertEqual(start, D(2026, 8, 8))
        self.assertFalse(clamped)

    def test_select_logs_filters_and_sorts(self):
        files = ["2026-08-22.md", "2026-08-15.md", "2026-08-16.md",
                 "not-a-log.md", "README.md", "2026-08-16.txt"]
        self.assertEqual(
            mp.select_logs(files, D(2026, 8, 16), D(2026, 8, 22)),
            ["2026-08-16.md", "2026-08-22.md"])


class TestRotation(unittest.TestCase):
    def _dailies(self, start, n):
        return ["%s.md" % (start + datetime.timedelta(days=i)).isoformat() for i in range(n)]

    def test_below_threshold_no_rotation(self):
        files = self._dailies(D(2026, 1, 1), 10)
        self.assertEqual(mp.rotatable_months(files, D(2026, 3, 1)), {})

    def test_rotates_only_whole_old_months(self):
        # 60 consecutive days from 2026-01-01; today far in the future
        files = self._dailies(D(2026, 1, 1), 60)
        out = mp.rotatable_months(files, D(2026, 6, 1))
        self.assertIn("2026-01", out)
        self.assertIn("2026-02", out)
        self.assertEqual(out["2026-01"][0], "2026-01-01.md")
        self.assertEqual(out["2026-01"][-1], "2026-01-31.md")

    def test_does_not_touch_month_inside_window(self):
        # today 2026-08-22, cutoff = 2026-08-08; August straddles -> excluded
        files = self._dailies(D(2026, 7, 20), 50)  # crosses into August
        out = mp.rotatable_months(files, D(2026, 8, 22))
        self.assertNotIn("2026-08", out)
        self.assertIn("2026-07", out)  # July is entirely before the cutoff

    def test_current_partial_month_never_rotated(self):
        files = self._dailies(D(2026, 6, 1), 80)  # runs into current month
        out = mp.rotatable_months(files, D(2026, 8, 22))
        self.assertNotIn("2026-08", out)


class TestStampText(unittest.TestCase):
    def test_updates_existing_line(self):
        text = "# Title\n\n*Last consolidated: 2026-06-11*\n\nbody"
        self.assertIn("*Last consolidated: 2026-08-22*",
                      mp.stamp_memory_md(text, D(2026, 8, 22)))
        self.assertNotIn("2026-06-11", mp.stamp_memory_md(text, D(2026, 8, 22)))

    def test_inserts_under_title_when_missing(self):
        out = mp.stamp_memory_md("# Title\n\nbody", D(2026, 8, 22))
        lines = out.split("\n")
        self.assertEqual(lines[0], "# Title")
        self.assertIn("*Last consolidated: 2026-08-22*", out)
        # marker precedes the body
        self.assertLess(out.index("Last consolidated"), out.index("body"))

    def test_idempotent(self):
        text = "# T\n\n*Last consolidated: 2026-08-22*\n"
        once = mp.stamp_memory_md(text, D(2026, 8, 22))
        twice = mp.stamp_memory_md(once, D(2026, 8, 22))
        self.assertEqual(once, twice)
        self.assertEqual(twice.count("Last consolidated"), 1)


class TestStampIO(unittest.TestCase):
    def test_stamp_writes_state_and_mirrors(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "memory"))
            with open(os.path.join(root, mp.MEMORY_MD), "w") as fh:
                fh.write("# Aeon Memory\n\n*Last consolidated: never*\n")
            mp.do_stamp(root, D(2026, 8, 22))
            with open(os.path.join(root, mp.STATE_FILE)) as fh:
                state = json.load(fh)
            self.assertEqual(state["last_consolidated"], "2026-08-22")
            self.assertIn("updated_at", state)
            with open(os.path.join(root, mp.MEMORY_MD)) as fh:
                md = fh.read()
            self.assertIn("*Last consolidated: 2026-08-22*", md)
            self.assertNotIn("never", md)


class TestMemorySize(unittest.TestCase):
    def test_within_budget(self):
        out = mp.memory_size_report("# M\n\n- short line\n")
        self.assertEqual(len(out), 1)
        self.assertIn("within budget", out[0])

    def test_over_budget_names_long_lines(self):
        text = "# M\n" + "\n".join("- " + "x" * 400 for _ in range(25)) + "\n"
        out = mp.memory_size_report(text)
        self.assertIn("OVER BUDGET by %d bytes" % (len(text.encode()) - mp.MEMORY_MAX_BYTES), out[0])
        self.assertIn("Lines over 300 chars", out[1])
        self.assertIn("2: 402", out[1])
        self.assertIn("(+15 more)", out[1])

    def test_counts_bytes_not_chars(self):
        text = "\u00e9" * (mp.MEMORY_MAX_BYTES // 2 + 1)  # 2 bytes each in UTF-8
        self.assertIn("OVER BUDGET", mp.memory_size_report(text)[0])

    def test_missing(self):
        self.assertEqual(mp.memory_size_report(None), ["MEMORY.md: missing."])


class TestWindowIO(unittest.TestCase):
    def test_window_rotates_and_selects_in_git_repo(self):
        with tempfile.TemporaryDirectory() as root:
            logs = os.path.join(root, mp.LOGS_DIR)
            os.makedirs(logs)
            subprocess.run(["git", "-C", root, "init", "-q"], check=True)
            subprocess.run(["git", "-C", root, "config", "user.email", "t@t"], check=True)
            subprocess.run(["git", "-C", root, "config", "user.name", "t"], check=True)
            # 50 old daily files (Jan-Feb 2026) + 2 recent, past threshold
            old = [(D(2026, 1, 1) + datetime.timedelta(days=i)) for i in range(50)]
            recent = [D(2026, 8, 20), D(2026, 8, 22)]
            for d in old + recent:
                with open(os.path.join(logs, d.isoformat() + ".md"), "w") as fh:
                    fh.write("log %s\n" % d)
            with open(os.path.join(root, mp.MEMORY_MD), "w") as fh:
                fh.write("# M\n\n*Last consolidated: 2026-08-20*\n")
            subprocess.run(["git", "-C", root, "add", "-A"], check=True)
            subprocess.run(["git", "-C", root, "commit", "-qm", "seed"], check=True)

            rc = mp.do_window(root, D(2026, 8, 22))
            self.assertEqual(rc, 0)
            # old months archived and removed
            self.assertTrue(os.path.exists(os.path.join(root, mp.ARCHIVE_DIR, "2026-01.md")))
            self.assertFalse(os.path.exists(os.path.join(logs, "2026-01-01.md")))
            # recent files survive
            self.assertTrue(os.path.exists(os.path.join(logs, "2026-08-22.md")))
            # archive preserves content
            with open(os.path.join(root, mp.ARCHIVE_DIR, "2026-01.md")) as fh:
                arch = fh.read()
            self.assertIn("log 2026-01-01", arch)


LOG = """### token-report
- AEON up 4%

### token-report -- under the hood
- 12 tool calls

### memory-flush
- promoted 2 entries
"""


class TestFingerprint(unittest.TestCase):
    def test_ignores_own_and_trace_sections(self):
        base = mp.log_fingerprint("### token-report\n- AEON up 4%\n")
        self.assertEqual(mp.log_fingerprint(LOG), base)
        self.assertNotEqual(base, "")

    def test_only_own_sections_is_empty(self):
        self.assertEqual(mp.log_fingerprint("### memory-flush\n- MEMORY_FLUSH_OK\n"), "")
        self.assertEqual(mp.log_fingerprint(""), "")

    def test_new_entry_changes_fingerprint(self):
        self.assertNotEqual(mp.log_fingerprint(LOG),
                            mp.log_fingerprint(LOG + "\n### heartbeat\n- all green\n"))


class TestIdle(unittest.TestCase):
    def _state(self, last, seen):
        return json.dumps({"last_consolidated": last, "seen_logs": seen})

    def test_idle_when_nothing_changed(self):
        fps = {"2026-10-12.md": "a", "2026-10-13.md": "b"}
        idle, _ = mp.idle_decision(self._state("2026-10-12", fps), fps, D(2026, 10, 13))
        self.assertTrue(idle)

    def test_new_log_is_not_idle(self):
        seen = {"2026-10-12.md": "a"}
        idle, reason = mp.idle_decision(self._state("2026-10-12", seen),
                                        {"2026-10-12.md": "a", "2026-10-13.md": "b"}, D(2026, 10, 13))
        self.assertFalse(idle)
        self.assertIn("2026-10-13.md", reason)

    def test_changed_log_is_not_idle(self):
        idle, _ = mp.idle_decision(self._state("2026-10-12", {"2026-10-12.md": "a"}),
                                   {"2026-10-12.md": "z"}, D(2026, 10, 13))
        self.assertFalse(idle)

    def test_empty_log_and_old_logs_ignored(self):
        # a log holding only flush entries (fp "") and a log before the watermark never count
        idle, _ = mp.idle_decision(self._state("2026-10-12", {}),
                                   {"2026-10-13.md": "", "2026-10-01.md": "x"}, D(2026, 10, 13))
        self.assertTrue(idle)

    def test_cap_forces_a_run(self):
        fps = {"2026-10-01.md": "a"}
        idle, _ = mp.idle_decision(self._state("2026-10-06", fps), fps, D(2026, 10, 13))
        self.assertFalse(idle)

    def test_missing_or_legacy_state_is_not_idle(self):
        self.assertFalse(mp.idle_decision(None, {}, D(2026, 10, 13))[0])
        self.assertFalse(mp.idle_decision("{bad", {}, D(2026, 10, 13))[0])
        legacy = json.dumps({"last_consolidated": "2026-10-12"})
        self.assertFalse(mp.idle_decision(legacy, {}, D(2026, 10, 13))[0])

    def test_stamp_then_idle_roundtrip(self):
        with tempfile.TemporaryDirectory() as root:
            logs = os.path.join(root, mp.LOGS_DIR)
            os.makedirs(logs)
            with open(os.path.join(root, mp.MEMORY_MD), "w") as fh:
                fh.write("# M\n")
            path = os.path.join(logs, "2026-10-13.md")
            with open(path, "w") as fh:
                fh.write(LOG)
            mp.do_stamp(root, D(2026, 10, 13))
            # the workflow appends the flush's own footer after stamp: still idle
            with open(path, "a") as fh:
                fh.write("\n### memory-flush -- under the hood\n- 30 tool calls\n")
            self.assertEqual(mp.do_idle(root, D(2026, 10, 14)), 0)
            # another skill logs something: the next flush must run
            with open(os.path.join(logs, "2026-10-14.md"), "w") as fh:
                fh.write("### heartbeat\n- 1 stuck skill\n")
            self.assertEqual(mp.do_idle(root, D(2026, 10, 14)), 1)


class TestSource(unittest.TestCase):
    def test_parse_source(self):
        self.assertEqual(mp.parse_source("logs/2026-10-13#token-report"), ("2026-10-13.md", "token-report"))
        self.assertEqual(mp.parse_source("memory/logs/2026-10-13.md#heartbeat"), ("2026-10-13.md", "heartbeat"))
        self.assertIsNone(mp.parse_source("thread/ab12"))
        self.assertIsNone(mp.parse_source("logs/2026-10-13"))

    def test_extract_skips_trace_and_other_skills(self):
        hits = mp.extract_source(LOG + "\n### token-report\n- second run\n", "token-report")
        self.assertEqual(len(hits), 2)
        self.assertIn("AEON up 4%", hits[0])
        self.assertNotIn("tool calls", "".join(hits))

    def test_source_from_log_and_archive(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, mp.ARCHIVE_DIR))
            with open(os.path.join(root, mp.LOGS_DIR, "2026-10-13.md"), "w") as fh:
                fh.write(LOG)
            with open(os.path.join(root, mp.ARCHIVE_DIR, "2026-01.md"), "w") as fh:
                fh.write("<!-- 2026-01-04.md -->\n### heartbeat\n- old fact\n\n"
                         "<!-- 2026-01-05.md -->\n### heartbeat\n- newer fact\n")
            self.assertEqual(mp.do_source(root, "logs/2026-10-13#token-report"), 0)
            self.assertEqual(mp.do_source(root, "logs/2026-01-04#heartbeat"), 0)
            self.assertEqual(mp.archived_day(open(os.path.join(root, mp.ARCHIVE_DIR, "2026-01.md")).read(),
                                             "2026-01-04.md").strip(), "### heartbeat\n- old fact")
            self.assertEqual(mp.do_source(root, "logs/2026-10-13#nope"), 1)
            self.assertEqual(mp.do_source(root, "garbage"), 2)


if __name__ == "__main__":
    unittest.main()

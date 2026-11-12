#!/usr/bin/env python3
"""Unit tests for the read-only compute discovery orchestrator.
Run: python3 scripts/tests/test_compute_discover.py

Discovery is exercised entirely against the offline MockProvider; the live
vastai HTTP path is never hit (the one vastai test asserts it refuses to run
without a key)."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
import unittest.mock as mock

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import contracts as C  # noqa: E402
import discover as D  # noqa: E402
import state as ST  # noqa: E402


class TestBuildProvider(unittest.TestCase):
    def test_mock(self):
        self.assertEqual(D.build_provider("mock").name, "mock")

    def test_vastai(self):
        with mock.patch.dict(os.environ, {"VAST_API_KEY": "k"}, clear=False):
            self.assertEqual(D.build_provider("vastai").name, "vastai")

    def test_primeintellect(self):
        with mock.patch.dict(os.environ, {"PRIME_INTELLECT_API_KEY": "k"}, clear=False):
            self.assertEqual(D.build_provider("primeintellect").name, "primeintellect")

    def test_unknown_raises(self):
        with self.assertRaises(ValueError):
            D.build_provider("nope")


class TestRunDiscovery(unittest.TestCase):
    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self.state_path = os.path.join(self._dir.name, "compute", "resources.json")

    def tearDown(self):
        self._dir.cleanup()

    def test_discovers_persists_and_reloads(self):
        report = D.run_discovery(D.MockProvider(), C.WorkloadSpec(), state_path=self.state_path, now=1.0)
        self.assertEqual(len(report.resources), 4)
        self.assertTrue(os.path.exists(self.state_path))
        reloaded = ST.load(self.state_path)
        self.assertEqual({r.resource_id for r in ST.resources(reloaded)},
                         {"mock:gpu-1", "mock:cpu-1", "mock:partial-1", "mock:down-1"})

    def test_empty_spec_matches_available_only(self):
        report = D.run_discovery(D.MockProvider(), C.WorkloadSpec(), state_path=self.state_path)
        self.assertTrue(report.ranked[0].matched)
        self.assertNotIn("mock:down-1", [r.resource_id for r in report.matched])  # explicitly unavailable
        self.assertFalse(report.ranked[-1].matched)

    def test_rerun_is_idempotent(self):
        D.run_discovery(D.MockProvider(), C.WorkloadSpec(), state_path=self.state_path, now=1.0)
        D.run_discovery(D.MockProvider(), C.WorkloadSpec(), state_path=self.state_path, now=2.0)
        self.assertEqual(len(ST.load(self.state_path)["resources"]), 4)

    def test_spec_filters_to_one(self):
        spec = C.WorkloadSpec(requires_gpu=True, min_vram_gb_total=100, max_usd_hr=2.0)
        report = D.run_discovery(D.MockProvider(), spec, state_path=self.state_path)
        self.assertEqual([r.resource_id for r in report.matched], ["mock:gpu-1"])

    def test_format_report_explains(self):
        spec = C.WorkloadSpec(requires_gpu=True, min_vram_gb_total=100, max_usd_hr=2.0, label="train run")
        text = D.format_report(D.run_discovery(D.MockProvider(), spec, state_path=self.state_path))
        self.assertIn("compute discovery", text)
        self.assertIn("workload: train run", text)
        self.assertIn("mock:gpu-1", text)
        self.assertRegex(text, r"(fail|unverifiable):")  # an unmatched resource shows its reason


class TestLoadSpec(unittest.TestCase):
    def test_none_is_empty_spec(self):
        self.assertFalse(D._load_spec(None, None).requires_gpu)

    def test_inline_json(self):
        spec = D._load_spec(None, '{"requires_gpu": true, "max_usd_hr": 3}')
        self.assertTrue(spec.requires_gpu)
        self.assertEqual(spec.max_usd_hr, 3)

    def test_file(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "spec.json")
            with open(path, "w", encoding="utf-8") as fh:
                json.dump({"min_cpu_cores": 8}, fh)
            self.assertEqual(D._load_spec(path, None).min_cpu_cores, 8)

    def test_non_object_raises(self):
        with self.assertRaises(ValueError):
            D._load_spec(None, "[1, 2, 3]")

    def test_both_sources_raises(self):
        with self.assertRaises(ValueError):
            D._load_spec("x.json", "{}")


class TestCLI(unittest.TestCase):
    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self.state_path = os.path.join(self._dir.name, "resources.json")

    def tearDown(self):
        self._dir.cleanup()

    def test_mock_json_run(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = D.main(["--provider", "mock", "--state", self.state_path, "--json"])
        self.assertEqual(rc, 0)
        self.assertTrue(os.path.exists(self.state_path))
        self.assertEqual(json.loads(out.getvalue())["discovered"], 4)

    def test_bad_spec_returns_2(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            rc = D.main(["--provider", "mock", "--spec-json", "[1,2]", "--state", self.state_path])
        self.assertEqual(rc, 2)

    def test_vastai_without_key_returns_1(self):
        err = io.StringIO()
        with mock.patch.dict(os.environ, clear=False):
            os.environ.pop("VAST_API_KEY", None)
            with contextlib.redirect_stderr(err):
                rc = D.main(["--provider", "vastai", "--state", self.state_path])
        self.assertEqual(rc, 1)
        self.assertIn("auth_permission", err.getvalue())


if __name__ == "__main__":
    unittest.main()

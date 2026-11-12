#!/usr/bin/env python3
"""Unit tests for skills/compute state persistence. Run: python3 scripts/tests/test_compute_state.py"""
import glob
import os
import sys
import tempfile
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import contracts as C  # noqa: E402
import lifecycle as L  # noqa: E402
import state as ST  # noqa: E402


def _resource(rid="r1"):
    return C.Resource(
        provider="mock", provider_resource_id=rid, kind=C.ResourceKind.GPU_INSTANCE,
        capabilities=C.ResourceCapabilities(cpu_cores=8), discovered_at=1.0,
    )


class TestPersistence(unittest.TestCase):
    def test_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "sub", "resources.json")
            s = ST.new_state()
            ST.upsert_resource(s, _resource(), now=1.0)
            ST.save(path, s)
            loaded = ST.load(path)
            self.assertEqual(loaded["resources"]["mock:r1"]["state"], "discovered")
            self.assertEqual(len(ST.resources(loaded)), 1)
            self.assertEqual(ST.resources(loaded)[0].resource_id, "mock:r1")

    def test_missing_file_is_skeleton(self):
        with tempfile.TemporaryDirectory() as d:
            s = ST.load(os.path.join(d, "nope.json"))
            self.assertEqual(s, ST.new_state())

    def test_corrupt_file_raises(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "bad.json")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write("{ not json")
            with self.assertRaises(ValueError):
                ST.load(path)

    def test_rejects_newer_version(self):
        import json
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "future.json")
            with open(path, "w", encoding="utf-8") as fh:
                json.dump({"version": ST.STATE_VERSION + 1, "resources": {}}, fh)
            with self.assertRaises(ValueError):
                ST.load(path)

    def test_save_is_atomic_no_leftover_temp(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "resources.json")
            ST.save(path, ST.new_state())
            self.assertEqual(glob.glob(os.path.join(d, ".compute-state-*")), [])


class TestIdempotency(unittest.TestCase):
    def test_upsert_twice_is_one_entry(self):
        s = ST.new_state()
        ST.upsert_resource(s, _resource(), now=1.0)
        ST.upsert_resource(s, _resource(), now=2.0)
        self.assertEqual(len(s["resources"]), 1)
        self.assertEqual(s["resources"]["mock:r1"]["updated_at"], 2.0)
        self.assertEqual(s["resources"]["mock:r1"]["first_seen"], 1.0)

    def test_rediscovery_preserves_lifecycle_state(self):
        s = ST.new_state()
        ST.upsert_resource(s, _resource(), now=1.0)
        ST.apply_transition(s, "mock:r1", L.ResourceState.AVAILABLE, now=2.0)
        ST.apply_transition(s, "mock:r1", L.ResourceState.PROVISIONING, now=3.0)
        ST.apply_transition(s, "mock:r1", L.ResourceState.RUNNING, now=4.0)
        ST.upsert_resource(s, _resource(), now=5.0)  # re-seen in the market
        self.assertEqual(ST.get_resource_state(s, "mock:r1"), L.ResourceState.RUNNING)

    def test_transition_idempotent_noop(self):
        s = ST.new_state()
        ST.upsert_resource(s, _resource(), now=1.0)
        ST.apply_transition(s, "mock:r1", L.ResourceState.AVAILABLE, now=2.0)
        ST.apply_transition(s, "mock:r1", L.ResourceState.AVAILABLE, now=3.0)  # no-op
        self.assertEqual(ST.get_resource_state(s, "mock:r1"), L.ResourceState.AVAILABLE)
        self.assertEqual(s["resources"]["mock:r1"]["updated_at"], 2.0)

    def test_invalid_transition_raises(self):
        s = ST.new_state()
        ST.upsert_resource(s, _resource(), now=1.0)
        with self.assertRaises(L.InvalidTransition):
            ST.apply_transition(s, "mock:r1", L.ResourceState.RUNNING)

    def test_unknown_resource_raises(self):
        s = ST.new_state()
        with self.assertRaises(KeyError):
            ST.apply_transition(s, "mock:ghost", L.ResourceState.AVAILABLE)


if __name__ == "__main__":
    unittest.main()

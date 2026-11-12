#!/usr/bin/env python3
"""Unit tests for skills/compute provider interface + mock. Run: python3 scripts/tests/test_compute_providers.py"""
import os
import sys
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import contracts as C  # noqa: E402
import failures as F  # noqa: E402
import provider_base  # noqa: E402
from mock_provider import MockProvider  # noqa: E402


class TestMockProvider(unittest.TestCase):
    def test_catalog(self):
        p = MockProvider()
        self.assertEqual(p.name, "mock")
        res = p.discover()
        self.assertEqual(sorted(r.provider_resource_id for r in res), ["cpu-1", "down-1", "gpu-1", "partial-1"])

    def test_deterministic(self):
        self.assertEqual(
            [r.to_dict() for r in MockProvider().discover()],
            [r.to_dict() for r in MockProvider().discover()],
        )

    def test_simulate_failure(self):
        with self.assertRaises(F.ComputeError) as ctx:
            MockProvider().discover({"simulate_failure": "provider_api"})
        self.assertEqual(ctx.exception.category, F.FailureCategory.PROVIDER_API)

    def test_provisioning_is_not_implemented(self):
        p = MockProvider()
        r = p.discover()[0]
        self.assertFalse(p.supports_provisioning)
        with self.assertRaises(NotImplementedError):
            p.provision(r, C.WorkloadSpec())
        with self.assertRaises(NotImplementedError):
            p.status(r)
        with self.assertRaises(NotImplementedError):
            p.execute(r, "ls")
        with self.assertRaises(NotImplementedError):
            p.terminate(r)


class TestInterface(unittest.TestCase):
    def test_base_is_abstract(self):
        with self.assertRaises(TypeError):
            provider_base.ProviderAdapter()


if __name__ == "__main__":
    unittest.main()

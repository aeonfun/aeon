#!/usr/bin/env python3
"""Unit tests for skills/compute failure taxonomy. Run: python3 scripts/tests/test_compute_failures.py"""
import os
import sys
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import failures as F  # noqa: E402


class TestClassifyHttp(unittest.TestCase):
    def test_mappings(self):
        cases = {
            401: F.FailureCategory.AUTH_PERMISSION,
            403: F.FailureCategory.AUTH_PERMISSION,
            402: F.FailureCategory.BUDGET_QUOTA,
            404: F.FailureCategory.RESOURCE_AVAILABILITY,
            409: F.FailureCategory.RESOURCE_AVAILABILITY,
            410: F.FailureCategory.RESOURCE_AVAILABILITY,
            408: F.FailureCategory.TIMEOUT_INTERRUPTED,
            504: F.FailureCategory.TIMEOUT_INTERRUPTED,
            429: F.FailureCategory.PROVIDER_API,
            500: F.FailureCategory.PROVIDER_API,
            503: F.FailureCategory.PROVIDER_API,
            418: F.FailureCategory.UNKNOWN,
        }
        for status, expected in cases.items():
            self.assertEqual(F.classify_http_status(status), expected, f"status {status}")

    def test_success_status_is_rejected(self):
        with self.assertRaises(ValueError):
            F.classify_http_status(200)


class TestComputeError(unittest.TestCase):
    def test_category_type_enforced(self):
        with self.assertRaises(ValueError):
            F.ComputeError("provider_api", "x")  # must be a FailureCategory

    def test_retryable_defaults(self):
        api = F.ComputeError(F.FailureCategory.PROVIDER_API, "down")
        self.assertTrue(api.retryable)
        self.assertTrue(api.is_infrastructure)

        app = F.ComputeError(F.FailureCategory.WORKLOAD_APPLICATION, "exit 1")
        self.assertFalse(app.retryable)
        self.assertFalse(app.is_infrastructure)

        auth = F.ComputeError(F.FailureCategory.AUTH_PERMISSION, "no key")
        self.assertFalse(auth.retryable)
        self.assertFalse(auth.is_infrastructure)

    def test_retryable_override(self):
        err = F.ComputeError(F.FailureCategory.WORKLOAD_APPLICATION, "x", retryable=True)
        self.assertTrue(err.retryable)

    def test_to_dict(self):
        err = F.ComputeError(F.FailureCategory.MACHINE_CONNECTION, "host gone", provider="vastai")
        d = err.to_dict()
        self.assertEqual(d["category"], "machine_connection")
        self.assertEqual(d["provider"], "vastai")
        self.assertTrue(d["is_infrastructure"])

    def test_is_infrastructure_helper(self):
        self.assertTrue(F.is_infrastructure(F.FailureCategory.RESOURCE_AVAILABILITY))
        self.assertFalse(F.is_infrastructure(F.FailureCategory.BUDGET_QUOTA))
        self.assertFalse(F.is_infrastructure(F.FailureCategory.WORKLOAD_APPLICATION))


if __name__ == "__main__":
    unittest.main()

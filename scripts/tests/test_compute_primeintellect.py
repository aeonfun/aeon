#!/usr/bin/env python3
"""Unit tests for the Prime Intellect adapter normalizer.
Run: python3 scripts/tests/test_compute_primeintellect.py

The live HTTP path is NOT exercised (it needs a real PRIME_INTELLECT_API_KEY);
these cover the pure normalizer and the discover() parsing loop via an injected
transport, using a schema-faithful synthetic fixture."""
import json
import os
import sys
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import contracts as C  # noqa: E402
import failures as F  # noqa: E402
import primeintellect_provider as P  # noqa: E402

_FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "compute", "primeintellect_availability.json")


def _load():
    with open(_FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


class TestNormalize(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.items = _load()["items"]

    def test_full_offer(self):
        r = P.normalize_offer(self.items[0])
        self.assertEqual(r.provider, "primeintellect")
        self.assertEqual(r.resource_id, "primeintellect:H100_80GB-PCIe-x2-runpod-US-KS-2")
        self.assertEqual(r.kind, C.ResourceKind.GPU_INSTANCE)
        self.assertEqual(r.capabilities.gpu.model, "H100_80GB")
        self.assertEqual(r.capabilities.gpu.count, 2)
        self.assertEqual(r.capabilities.gpu.vram_gb_per_gpu, 80.0)     # GB, no MB conversion
        self.assertEqual(r.capabilities.gpu.total_vram_gb, 160.0)      # derived 80 x 2
        self.assertEqual(r.capabilities.cpu_cores, 32.0)
        self.assertEqual(r.capabilities.ram_gb, 251.0)                 # GB directly, NOT 251/1024
        self.assertEqual(r.capabilities.storage_gb, 200.0)            # disk.defaultCount
        self.assertEqual(r.pricing.on_demand_usd_hr, 2.69)
        self.assertEqual(r.availability.available, True)
        self.assertEqual(r.availability.region, "united_states")
        self.assertEqual(r.missing_fields, ())
        self.assertEqual(r.raw["provider"], "runpod")  # underlying provider preserved in raw

    def test_partial_offer(self):
        r = P.normalize_offer(self.items[1])
        self.assertEqual(r.resource_id, "primeintellect:A100_80GB-SXM-x1-lambda-EU-DE-1")
        self.assertEqual(r.capabilities.cpu_cores, 16.0)
        self.assertIsNone(r.capabilities.ram_gb)
        self.assertIsNone(r.capabilities.storage_gb)
        self.assertIsNone(r.pricing.on_demand_usd_hr)
        self.assertEqual(r.capabilities.gpu.total_vram_gb, 80.0)  # derivable from per-GPU x count
        self.assertEqual(set(r.missing_fields), {"ram_gb", "storage_gb", "on_demand_usd_hr"})

    def test_unavailable_offer(self):
        r = P.normalize_offer(self.items[2])
        self.assertEqual(r.availability.available, False)  # stockStatus "None"
        self.assertEqual(r.capabilities.gpu.count, 8)
        self.assertEqual(r.capabilities.gpu.vram_gb_per_gpu, 141.0)

    def test_missing_identity_raises(self):
        with self.assertRaises(ValueError):
            P.normalize_offer({"stockStatus": "Low", "prices": {"onDemand": 1.0}})

    def test_gpu_type_without_count_is_cloud_vm(self):
        r = P.normalize_offer({"gpuType": "H100_80GB", "gpuCount": 0, "provider": "x", "dataCenter": "US-1", "vcpu": {"defaultCount": 8}})
        self.assertIsNone(r.capabilities.gpu)
        self.assertEqual(r.kind, C.ResourceKind.CLOUD_VM)
        self.assertIn("gpu", r.missing_fields)


class TestProvider(unittest.TestCase):
    def test_name(self):
        self.assertEqual(P.PrimeIntellectProvider().name, "primeintellect")

    def test_discover_requires_key(self):
        with self.assertRaises(F.ComputeError) as ctx:
            P.PrimeIntellectProvider(api_key=None).discover()
        self.assertEqual(ctx.exception.category, F.FailureCategory.AUTH_PERMISSION)
        self.assertFalse(ctx.exception.retryable)

    def test_discover_with_injected_transport(self):
        data = _load()
        provider = P.PrimeIntellectProvider(api_key="test-key", transport=lambda q, k: data)
        res = provider.discover({"gpu_type": "H100_80GB"})
        self.assertEqual(len(res), 3)
        self.assertEqual(res[0].provider, "primeintellect")
        self.assertEqual(res[0].resource_id, "primeintellect:H100_80GB-PCIe-x2-runpod-US-KS-2")


class TestRobustness(unittest.TestCase):
    def test_non_dict_offer_raises_valueerror(self):
        for bad in ("a string", None, 123, ["x"]):
            with self.assertRaises(ValueError):
                P.normalize_offer(bad)

    def test_parse_body_rejects_non_json(self):
        with self.assertRaises(F.ComputeError) as ctx:
            P._parse_body("<html>not json</html>")
        self.assertEqual(ctx.exception.category, F.FailureCategory.PROVIDER_API)

    def test_parse_body_rejects_non_object_json(self):
        with self.assertRaises(F.ComputeError) as ctx:
            P._parse_body("[1, 2, 3]")
        self.assertEqual(ctx.exception.category, F.FailureCategory.PROVIDER_API)

    def test_parse_body_accepts_object(self):
        self.assertEqual(P._parse_body('{"items": []}'), {"items": []})

    def test_discover_classifies_malformed_offer(self):
        payload = {"items": [{"gpuType": "H100_80GB", "gpuCount": 1, "dataCenter": "US-1"}, "garbage"], "totalCount": 2}
        provider = P.PrimeIntellectProvider(api_key="k", transport=lambda q, k: payload)
        with self.assertRaises(F.ComputeError) as ctx:
            provider.discover()
        self.assertEqual(ctx.exception.category, F.FailureCategory.PROVIDER_API)

    def test_discover_tolerates_missing_items_key(self):
        provider = P.PrimeIntellectProvider(api_key="k", transport=lambda q, k: {"totalCount": 0})
        self.assertEqual(provider.discover(), [])

    def test_discover_tolerates_non_dict_response(self):
        provider = P.PrimeIntellectProvider(api_key="k", transport=lambda q, k: [1, 2, 3])
        self.assertEqual(provider.discover(), [])

    def test_cpu_only_offer_is_cloud_vm(self):
        r = P.normalize_offer({"cloudId": "cpu-box", "provider": "ori", "dataCenter": "US-1", "vcpu": {"defaultCount": 8}, "memory": {"defaultCount": 32}, "stockStatus": "High", "prices": {"onDemand": 0.1, "currency": "USD"}})
        self.assertEqual(r.kind, C.ResourceKind.CLOUD_VM)
        self.assertIsNone(r.capabilities.gpu)
        self.assertIn("gpu", r.missing_fields)


if __name__ == "__main__":
    unittest.main()

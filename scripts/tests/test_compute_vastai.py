#!/usr/bin/env python3
"""Unit tests for the Vast.ai adapter normalizer. Run: python3 scripts/tests/test_compute_vastai.py

The live HTTP path is NOT exercised here (it needs a real VAST_API_KEY); these
cover the pure normalizer and the discover() parsing loop via an injected
transport, using a schema-faithful synthetic fixture."""
import json
import os
import sys
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "skills", "compute"))
import contracts as C  # noqa: E402
import failures as F  # noqa: E402
import vastai_provider as V  # noqa: E402

_FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "compute", "vastai_offers.json")


def _load():
    with open(_FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


class TestNormalize(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.offers = _load()["offers"]

    def test_full_offer(self):
        r = V.normalize_offer(self.offers[0])
        self.assertEqual(r.provider, "vastai")
        self.assertEqual(r.resource_id, "vastai:11111")
        self.assertEqual(r.kind, C.ResourceKind.GPU_INSTANCE)
        self.assertEqual(r.capabilities.gpu.model, "RTX_4090")
        self.assertEqual(r.capabilities.gpu.count, 2)
        self.assertEqual(r.capabilities.gpu.vram_gb_per_gpu, 24.0)   # 24576 MB -> GB
        self.assertEqual(r.capabilities.gpu.vram_gb_total, 48.0)     # 49152 MB -> GB
        self.assertEqual(r.capabilities.ram_gb, 64.0)                # 65536 MB -> GB
        self.assertEqual(r.capabilities.cpu_cores, 32.0)
        self.assertEqual(r.capabilities.storage_gb, 200.5)
        self.assertEqual(r.capabilities.architecture, C.Architecture.X86_64)
        self.assertEqual(r.pricing.on_demand_usd_hr, 0.44)
        self.assertEqual(r.pricing.interruptible_usd_hr, 0.22)
        self.assertEqual(r.pricing.storage_usd_gb_month, 0.1)
        self.assertEqual(r.availability.available, True)
        self.assertEqual(r.availability.region, "US")
        self.assertEqual(r.availability.reliability, 0.985)
        self.assertEqual(r.missing_fields, ())
        self.assertEqual(r.raw["gpu_name"], "RTX_4090")  # verbatim payload preserved

    def test_missing_fields_tracked(self):
        r = V.normalize_offer(self.offers[1])
        self.assertEqual(r.capabilities.architecture, C.Architecture.ARM64)
        self.assertEqual(r.capabilities.gpu.vram_gb_per_gpu, 80.0)
        self.assertIsNone(r.capabilities.gpu.vram_gb_total)
        self.assertIsNone(r.capabilities.cpu_cores)
        self.assertIsNone(r.pricing.on_demand_usd_hr)
        self.assertIsNone(r.capabilities.gpu.vram_gb_total)  # provider did not report total
        self.assertEqual(r.capabilities.gpu.total_vram_gb, 80.0)  # but it is derivable from per-GPU x count
        self.assertEqual(set(r.missing_fields), {"cpu_cores", "on_demand_usd_hr"})

    def test_unavailable_offer(self):
        r = V.normalize_offer(self.offers[2])
        self.assertEqual(r.availability.available, False)
        self.assertEqual(r.capabilities.gpu.count, 4)

    def test_missing_id_raises(self):
        with self.assertRaises(ValueError):
            V.normalize_offer({"gpu_name": "x", "num_gpus": 1})


class TestProvider(unittest.TestCase):
    def test_name(self):
        self.assertEqual(V.VastAiProvider().name, "vastai")

    def test_discover_requires_key(self):
        with self.assertRaises(F.ComputeError) as ctx:
            V.VastAiProvider(api_key=None).discover()
        self.assertEqual(ctx.exception.category, F.FailureCategory.AUTH_PERMISSION)
        self.assertFalse(ctx.exception.retryable)

    def test_discover_with_injected_transport(self):
        data = _load()
        provider = V.VastAiProvider(api_key="test-key", transport=lambda q, k: data)
        res = provider.discover({"num_gpus": 1})
        self.assertEqual(len(res), 3)
        self.assertEqual(res[0].resource_id, "vastai:11111")
        self.assertEqual(res[0].provider, "vastai")


class TestRobustness(unittest.TestCase):
    def test_non_dict_offer_raises_valueerror(self):
        for bad in ("a string", None, 123, ["x"]):
            with self.assertRaises(ValueError):
                V.normalize_offer(bad)

    def test_parse_body_rejects_non_json(self):
        with self.assertRaises(F.ComputeError) as ctx:
            V._parse_body("<html>not json</html>")
        self.assertEqual(ctx.exception.category, F.FailureCategory.PROVIDER_API)

    def test_parse_body_rejects_non_object_json(self):
        with self.assertRaises(F.ComputeError) as ctx:
            V._parse_body("[1, 2, 3]")
        self.assertEqual(ctx.exception.category, F.FailureCategory.PROVIDER_API)

    def test_parse_body_accepts_object(self):
        self.assertEqual(V._parse_body('{"offers": []}'), {"offers": []})

    def test_discover_classifies_malformed_offer(self):
        payload = {"offers": [{"id": 1, "gpu_name": "A", "num_gpus": 1}, "garbage"]}
        provider = V.VastAiProvider(api_key="k", transport=lambda q, k: payload)
        with self.assertRaises(F.ComputeError) as ctx:
            provider.discover()
        self.assertEqual(ctx.exception.category, F.FailureCategory.PROVIDER_API)

    def test_discover_tolerates_missing_offers_key(self):
        provider = V.VastAiProvider(api_key="k", transport=lambda q, k: {"other": 1})
        self.assertEqual(provider.discover(), [])

    def test_discover_tolerates_non_dict_response(self):
        provider = V.VastAiProvider(api_key="k", transport=lambda q, k: [1, 2, 3])
        self.assertEqual(provider.discover(), [])

    def test_cpu_only_offer_is_cloud_vm(self):
        r = V.normalize_offer({"id": 900, "cpu_cores": 8, "cpu_ram": 32768, "cpu_arch": "amd64", "disk_space": 50, "dph_total": 0.05, "rentable": True, "geolocation": "US"})
        self.assertEqual(r.kind, C.ResourceKind.CLOUD_VM)
        self.assertIsNone(r.capabilities.gpu)
        self.assertIn("gpu", r.missing_fields)

    def test_gpu_name_without_count_flags_missing_gpu(self):
        r = V.normalize_offer({"id": 901, "gpu_name": "RTX_4090", "num_gpus": 0, "cpu_cores": 4, "rentable": True})
        self.assertIsNone(r.capabilities.gpu)
        self.assertEqual(r.kind, C.ResourceKind.CLOUD_VM)
        self.assertIn("gpu", r.missing_fields)


if __name__ == "__main__":
    unittest.main()

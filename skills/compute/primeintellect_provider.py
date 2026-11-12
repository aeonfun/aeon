"""Prime Intellect provider adapter -- READ-ONLY GPU availability discovery.

Verified against Prime Intellect's official API docs (docs.primeintellect.ai,
2026-11-12):
- Availability search: `GET https://api.primeintellect.ai/api/v1/availability/gpus`
  with query filters (`regions`, `gpu_count`, `gpu_type`, `socket`, `security`,
  `page`, `page_size`); returns `{"items": [ ... ], "totalCount": N}`.
- Auth: a Bearer `PRIME_INTELLECT_API_KEY` with Availability read permission is
  REQUIRED. Discovery refuses to run without a key rather than guess.
- Units: unlike Vast.ai, Prime Intellect reports GB and core counts DIRECTLY --
  `gpuMemory` is GB per GPU, `memory.defaultCount` is GB of RAM, `vcpu.defaultCount`
  is cores, `disk.defaultCount` is GB. No MB conversion.
- An offer carries no opaque id; it is a configuration tuple, so
  `provider_resource_id` is a deterministic slug of its identifying fields.

Prime Intellect aggregates several underlying providers; the underlying one is
kept in `Resource.raw["provider"]`, while `Resource.provider` is "primeintellect".

This adapter never provisions, starts, stops, or deletes anything. `normalize_offer`
is pure and fully tested with a schema-faithful fixture; the live HTTP path is
implemented to the documented contract but is NOT verified end-to-end here (that
needs a real PRIME_INTELLECT_API_KEY).
"""
from __future__ import annotations

import json
import os
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable

import contracts
import provider_base
from failures import ComputeError, FailureCategory, classify_http_status

DEFAULT_BASE_URL = "https://api.primeintellect.ai/api/v1"
_UNAVAILABLE_STOCK = frozenset({"none", "unavailable", "out of stock", "out_of_stock", "no stock", "sold out"})


def _num(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _nested(offer: dict[str, Any], key: str, field: str) -> float | None:
    sub = offer.get(key)
    return _num(sub.get(field)) if isinstance(sub, dict) else None


def _stock_available(stock: Any) -> bool | None:
    if stock is None:
        return None
    text = str(stock).strip().lower()
    if not text:
        return None
    return False if text in _UNAVAILABLE_STOCK else True


def _offer_id(offer: dict[str, Any]) -> str:
    parts = [
        str(offer.get("gpuType") or offer.get("cloudId") or ""),
        str(offer.get("socket") or ""),
        f"x{offer['gpuCount']}" if offer.get("gpuCount") else "",
        str(offer.get("provider") or ""),
        str(offer.get("dataCenter") or offer.get("region") or ""),
    ]
    slug = re.sub(r"[^A-Za-z0-9_.:-]+", "-", "-".join(p for p in parts if p)).strip("-")
    return slug


def _parse_body(body: str) -> dict[str, Any]:
    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ComputeError(
            FailureCategory.PROVIDER_API, "Prime Intellect returned a non-JSON response", provider="primeintellect"
        ) from exc
    if not isinstance(data, dict):
        raise ComputeError(
            FailureCategory.PROVIDER_API,
            f"Prime Intellect response was not a JSON object (got {type(data).__name__})",
            provider="primeintellect",
        )
    return data


def normalize_offer(offer: dict[str, Any]) -> contracts.Resource:
    if not isinstance(offer, dict):
        raise ValueError(f"Prime Intellect offer must be a JSON object, got {type(offer).__name__}")
    resource_id = _offer_id(offer)
    if not resource_id:
        raise ValueError("Prime Intellect offer has no identifying fields (gpuType/cloudId/provider/dataCenter)")

    gpu = None
    if offer.get("gpuType") and offer.get("gpuCount"):
        gpu = contracts.GpuSpec(
            model=str(offer["gpuType"]),
            count=int(offer["gpuCount"]),
            vram_gb_per_gpu=_num(offer.get("gpuMemory")),
            vram_gb_total=None,
        )

    capabilities = contracts.ResourceCapabilities(
        cpu_cores=_nested(offer, "vcpu", "defaultCount"),
        ram_gb=_nested(offer, "memory", "defaultCount"),
        gpu=gpu,
        storage_gb=_nested(offer, "disk", "defaultCount"),
        architecture=contracts.Architecture.UNKNOWN,
    )

    prices = offer.get("prices") if isinstance(offer.get("prices"), dict) else {}
    pricing = contracts.Pricing(
        on_demand_usd_hr=_num(prices.get("onDemand")),
        currency=str(prices.get("currency") or "USD"),
    )

    availability = contracts.Availability(
        available=_stock_available(offer.get("stockStatus")),
        region=offer.get("region") or offer.get("country"),
        reliability=None,
    )

    missing: list[str] = []
    if gpu is None:
        missing.append("gpu")
    elif gpu.total_vram_gb is None:
        missing.append("vram")
    if capabilities.cpu_cores is None:
        missing.append("cpu_cores")
    if capabilities.ram_gb is None:
        missing.append("ram_gb")
    if capabilities.storage_gb is None:
        missing.append("storage_gb")
    if pricing.on_demand_usd_hr is None:
        missing.append("on_demand_usd_hr")
    if availability.available is None:
        missing.append("available")

    kind = contracts.ResourceKind.GPU_INSTANCE if gpu is not None else contracts.ResourceKind.CLOUD_VM

    return contracts.Resource(
        provider="primeintellect",
        provider_resource_id=resource_id,
        kind=kind,
        capabilities=capabilities,
        pricing=pricing,
        availability=availability,
        raw=dict(offer),
        missing_fields=tuple(missing),
    )


class PrimeIntellectProvider(provider_base.ProviderAdapter):
    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str = DEFAULT_BASE_URL,
        transport: Callable[[dict[str, Any], str], dict[str, Any]] | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._transport = transport
        self._timeout = timeout

    @classmethod
    def from_env(cls, **kwargs: Any) -> PrimeIntellectProvider:
        return cls(api_key=os.environ.get("PRIME_INTELLECT_API_KEY"), **kwargs)

    @property
    def name(self) -> str:
        return "primeintellect"

    def discover(self, query: dict[str, Any] | None = None) -> list[contracts.Resource]:
        if not self._api_key:
            raise ComputeError(
                FailureCategory.AUTH_PERMISSION,
                "Prime Intellect discovery requires PRIME_INTELLECT_API_KEY (unset). Set it to enable discovery.",
                provider="primeintellect",
                retryable=False,
            )
        payload = dict(query or {})
        transport = self._transport or self._http_get
        data = transport(payload, self._api_key)
        items = data.get("items", []) if isinstance(data, dict) else []
        resources: list[contracts.Resource] = []
        for offer in items:
            try:
                resources.append(normalize_offer(offer))
            except ValueError as exc:
                raise ComputeError(
                    FailureCategory.PROVIDER_API,
                    f"Prime Intellect returned a malformed offer: {exc}",
                    provider="primeintellect",
                ) from exc
        return resources

    def _http_get(self, query: dict[str, Any], api_key: str) -> dict[str, Any]:
        url = f"{self._base_url}/availability/gpus"
        qs = urllib.parse.urlencode(query, doseq=True) if query else ""
        if qs:
            url += "?" + qs
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as resp:
                body = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            raise ComputeError(
                classify_http_status(exc.code),
                f"Prime Intellect discovery failed: HTTP {exc.code}",
                provider="primeintellect",
            ) from exc
        except (TimeoutError, socket.timeout) as exc:
            raise ComputeError(
                FailureCategory.TIMEOUT_INTERRUPTED,
                f"Prime Intellect discovery timed out after {self._timeout}s",
                provider="primeintellect",
            ) from exc
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", None)
            if isinstance(reason, (TimeoutError, socket.timeout)):
                raise ComputeError(
                    FailureCategory.TIMEOUT_INTERRUPTED,
                    f"Prime Intellect discovery timed out after {self._timeout}s",
                    provider="primeintellect",
                ) from exc
            raise ComputeError(
                FailureCategory.PROVIDER_API,
                f"Prime Intellect discovery failed: {reason}",
                provider="primeintellect",
            ) from exc
        return _parse_body(body)

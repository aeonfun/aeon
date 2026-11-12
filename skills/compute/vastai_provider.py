"""Vast.ai provider adapter -- READ-ONLY offer discovery.

Verified against Vast.ai's official API docs (docs.vast.ai, 2026-11-12):
- Offer search: `GET https://console.vast.ai/api/v0/bundles/?q=<url-encoded JSON>`
  (a flat-body POST form is also documented); returns `{"offers": [ ... ]}`.
- Auth: a Bearer `VAST_API_KEY` is REQUIRED per the docs (a missing key returns
  HTTP 404). Discovery therefore refuses to run without a key rather than guess.
- Units gotcha: `gpu_ram`, `gpu_total_ram`, `cpu_ram` are MEGABYTES in the
  response (e.g. 24576 == 24 GB). `normalize_offer` converts them to GB and keeps
  the verbatim offer in `Resource.raw`.

This adapter never rents, starts, stops, or deletes anything. `normalize_offer`
is pure and fully tested with a schema-faithful fixture; the live HTTP path is
implemented to the documented contract but is NOT verified end-to-end here
(that needs a real VAST_API_KEY).
"""
from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable

import contracts
import provider_base
from failures import ComputeError, FailureCategory, classify_http_status

DEFAULT_BASE_URL = "https://console.vast.ai/api/v0"
_MB_PER_GB = 1024.0


def _mb_to_gb(value: Any) -> float | None:
    if value is None:
        return None
    return round(float(value) / _MB_PER_GB, 3)


def _num(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _architecture(cpu_arch: Any) -> contracts.Architecture:
    text = str(cpu_arch or "").strip().lower()
    if text in ("amd64", "x86_64", "x86-64", "x64"):
        return contracts.Architecture.X86_64
    if text in ("arm64", "aarch64"):
        return contracts.Architecture.ARM64
    return contracts.Architecture.UNKNOWN


def _reliability(value: Any) -> float | None:
    rel = _num(value)
    if rel is None or not 0.0 <= rel <= 1.0:
        return None
    return rel


def _parse_body(body: str) -> dict[str, Any]:
    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ComputeError(
            FailureCategory.PROVIDER_API, "Vast.ai returned a non-JSON response", provider="vastai"
        ) from exc
    if not isinstance(data, dict):
        raise ComputeError(
            FailureCategory.PROVIDER_API,
            f"Vast.ai response was not a JSON object (got {type(data).__name__})",
            provider="vastai",
        )
    return data


def normalize_offer(offer: dict[str, Any]) -> contracts.Resource:
    if not isinstance(offer, dict):
        raise ValueError(f"Vast.ai offer must be a JSON object, got {type(offer).__name__}")
    if "id" not in offer or offer["id"] in (None, ""):
        raise ValueError("Vast.ai offer is missing the required 'id' field")

    gpu = None
    if offer.get("gpu_name") and offer.get("num_gpus"):
        gpu = contracts.GpuSpec(
            model=str(offer["gpu_name"]),
            count=int(offer["num_gpus"]),
            vram_gb_per_gpu=_mb_to_gb(offer.get("gpu_ram")),
            vram_gb_total=_mb_to_gb(offer.get("gpu_total_ram")),
        )

    capabilities = contracts.ResourceCapabilities(
        cpu_cores=_num(offer.get("cpu_cores")),
        ram_gb=_mb_to_gb(offer.get("cpu_ram")),
        gpu=gpu,
        storage_gb=_num(offer.get("disk_space")),
        architecture=_architecture(offer.get("cpu_arch")),
    )

    pricing = contracts.Pricing(
        on_demand_usd_hr=_num(offer.get("dph_total")),
        interruptible_usd_hr=_num(offer.get("min_bid")),
        storage_usd_gb_month=_num(offer.get("storage_cost")),
    )

    rentable = offer.get("rentable")
    availability = contracts.Availability(
        available=bool(rentable) if rentable is not None else None,
        region=offer.get("geolocation"),
        reliability=_reliability(offer.get("reliability")),
    )

    # missing_fields reflects the NORMALIZED result, not raw presence: a field is
    # missing only when we could not produce a value for it (e.g. VRAM is not
    # missing when per-GPU VRAM is known and the total is derivable).
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

    # Vast offers are GPU instances when they carry a GPU; a GPU-less offer is a
    # plain rentable VM, not a mislabeled GPU_INSTANCE.
    kind = contracts.ResourceKind.GPU_INSTANCE if gpu is not None else contracts.ResourceKind.CLOUD_VM

    return contracts.Resource(
        provider="vastai",
        provider_resource_id=str(offer["id"]),
        kind=kind,
        capabilities=capabilities,
        pricing=pricing,
        availability=availability,
        raw=dict(offer),
        missing_fields=tuple(missing),
    )


class VastAiProvider(provider_base.ProviderAdapter):
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
    def from_env(cls, **kwargs: Any) -> VastAiProvider:
        return cls(api_key=os.environ.get("VAST_API_KEY"), **kwargs)

    @property
    def name(self) -> str:
        return "vastai"

    def discover(self, query: dict[str, Any] | None = None) -> list[contracts.Resource]:
        if not self._api_key:
            raise ComputeError(
                FailureCategory.AUTH_PERMISSION,
                "Vast.ai discovery requires VAST_API_KEY (unset). Set it to enable discovery.",
                provider="vastai",
                retryable=False,
            )
        payload = dict(query or {})
        transport = self._transport or self._http_get
        data = transport(payload, self._api_key)
        offers = data.get("offers", []) if isinstance(data, dict) else []
        resources: list[contracts.Resource] = []
        for offer in offers:
            try:
                resources.append(normalize_offer(offer))
            except ValueError as exc:
                raise ComputeError(
                    FailureCategory.PROVIDER_API,
                    f"Vast.ai returned a malformed offer: {exc}",
                    provider="vastai",
                ) from exc
        return resources

    def _http_get(self, query: dict[str, Any], api_key: str) -> dict[str, Any]:
        url = f"{self._base_url}/bundles/?q=" + urllib.parse.quote(json.dumps(query))
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as resp:
                body = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            raise ComputeError(
                classify_http_status(exc.code),
                f"Vast.ai discovery failed: HTTP {exc.code}",
                provider="vastai",
            ) from exc
        except (TimeoutError, socket.timeout) as exc:
            raise ComputeError(
                FailureCategory.TIMEOUT_INTERRUPTED,
                f"Vast.ai discovery timed out after {self._timeout}s",
                provider="vastai",
            ) from exc
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", None)
            if isinstance(reason, (TimeoutError, socket.timeout)):
                raise ComputeError(
                    FailureCategory.TIMEOUT_INTERRUPTED,
                    f"Vast.ai discovery timed out after {self._timeout}s",
                    provider="vastai",
                ) from exc
            raise ComputeError(
                FailureCategory.PROVIDER_API,
                f"Vast.ai discovery failed: {reason}",
                provider="vastai",
            ) from exc
        return _parse_body(body)

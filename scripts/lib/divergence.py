"""Spot/Perps divergence — rolling history persistence + descriptive stats.

This module owns the on-disk history file at
`memory/topics/state/divergence-history.json`. It is intentionally
**threshold-free**: it stores raw snapshots and exposes descriptive
statistics, but does NOT classify regimes or emit labels like
SPOT_LED / PERPS_LED. The reasoning is reserved for Claude — the
data layer just provides the facts.

Schema:

    {
      "schema_version": "v1",
      "last_updated":   "YYYY-MM-DDTHH:MM:SSZ",
      "by_asset": {
        "BTC": [SnapshotEntry, ...],   # newest last, ordered by ts_utc
        ...
      }
    }

    SnapshotEntry:
      {
        "ts_utc":         "YYYY-MM-DDTHH:MM:SSZ",
        "spot_usd":       float,
        "perps_mark_usd": float,
        "divergence_pct": float,   # (perps - spot) / spot * 100
        "basis_apr":      float | null   # Coinglass basis APR if available
      }

Retention: per-asset history is capped at the most recent
`HISTORY_RETENTION_DAYS` of entries on every save. Old snapshots are
dropped — this keeps the on-disk size bounded (~10-20 assets × 2
runs/day × ~150 bytes × 30 days ≈ 150 KB ceiling).

Atomic write: tmpfile + flush + fsync + os.replace. Same pattern as
`narratives.py` and `bot_messages.py`.
"""

from __future__ import annotations

import json
import os
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional


HISTORY_PATH = Path("memory/topics/state/divergence-history.json")
SCHEMA_VERSION = "v1"
HISTORY_RETENTION_DAYS = 30

REQUIRED_SNAPSHOT_FIELDS = (
    "ts_utc",
    "spot_usd",
    "perps_mark_usd",
    "divergence_pct",
)


class DivergenceError(Exception):
    """Raised on history load/validate failures."""


def _empty_history() -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "last_updated": None,
        "by_asset": {},
    }


def _ensure_shape(history: dict) -> dict:
    """Coerce a loaded history into the canonical shape, adding missing
    fields. Returns the same dict (mutated in place) for convenience."""
    if not isinstance(history, dict):
        raise DivergenceError(
            f"history root must be object, got {type(history).__name__}"
        )
    history.setdefault("schema_version", SCHEMA_VERSION)
    history.setdefault("last_updated", None)
    history.setdefault("by_asset", {})
    if not isinstance(history["by_asset"], dict):
        raise DivergenceError("history.by_asset must be object")
    for asset, series in history["by_asset"].items():
        if not isinstance(series, list):
            raise DivergenceError(
                f"history.by_asset.{asset} must be array, got {type(series).__name__}"
            )
    return history


def load(path: Path = HISTORY_PATH) -> dict:
    """Load the history file. Returns an empty history if the file
    doesn't exist yet (first run)."""
    if not path.exists():
        return _empty_history()
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise DivergenceError(f"history {path} is not valid JSON: {e}")
    return _ensure_shape(data)


def save(history: dict, path: Path = HISTORY_PATH) -> None:
    """Atomically write the history. Updates last_updated to now (UTC)."""
    _ensure_shape(history)
    history["last_updated"] = datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = json.dumps(history, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# Mutators


def _validate_snapshot(snapshot: dict) -> None:
    for field in REQUIRED_SNAPSHOT_FIELDS:
        if field not in snapshot:
            raise DivergenceError(f"snapshot missing required field '{field}'")
    if not isinstance(snapshot["ts_utc"], str):
        raise DivergenceError("snapshot.ts_utc must be string")
    for f in ("spot_usd", "perps_mark_usd", "divergence_pct"):
        v = snapshot[f]
        if not isinstance(v, (int, float)):
            raise DivergenceError(f"snapshot.{f} must be number")
    if "basis_apr" in snapshot and snapshot["basis_apr"] is not None:
        if not isinstance(snapshot["basis_apr"], (int, float)):
            raise DivergenceError("snapshot.basis_apr must be number or null")


def append_snapshot(history: dict, asset: str, snapshot: dict) -> None:
    """Append a snapshot to history.by_asset[asset]. Caps the per-asset
    series at HISTORY_RETENTION_DAYS of entries.

    Idempotent on (asset, ts_utc): if a snapshot with the same ts_utc
    already exists for this asset, it gets replaced rather than
    duplicated. This makes the postprocess safe to re-run."""
    _validate_snapshot(snapshot)
    asset = asset.upper()
    series = history["by_asset"].setdefault(asset, [])

    # De-dup by ts_utc (replace if exists)
    ts = snapshot["ts_utc"]
    for i, entry in enumerate(series):
        if entry.get("ts_utc") == ts:
            series[i] = dict(snapshot)
            _trim_old(series)
            return

    series.append(dict(snapshot))
    # Keep newest last; sort defensively in case caller re-ordered
    series.sort(key=lambda e: e.get("ts_utc", ""))
    _trim_old(series)


def _trim_old(series: list) -> None:
    """Drop entries older than HISTORY_RETENTION_DAYS. Mutates in
    place."""
    if not series:
        return
    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_RETENTION_DAYS)
    cutoff_iso = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
    # Filter in place
    fresh = [e for e in series if e.get("ts_utc", "") >= cutoff_iso]
    series.clear()
    series.extend(fresh)


# ---------------------------------------------------------------------------
# Accessors (read-only — no classification logic)


def recent_history(history: dict, asset: str, days: int = 30) -> list:
    """Return the asset's snapshot list within the last `days`. Newest
    last. Empty list if no data."""
    asset = asset.upper()
    series = history["by_asset"].get(asset, [])
    if not series:
        return []
    if days >= HISTORY_RETENTION_DAYS:
        return list(series)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
    return [e for e in series if e.get("ts_utc", "") >= cutoff_iso]


def summary_stats(history: dict, asset: str, days: int = 30) -> Optional[dict]:
    """Return descriptive stats for `divergence_pct` and `basis_apr` over
    the last `days`. None if no data. These are FACTS, not thresholds —
    Claude uses them as context for its own judgement, not as gating
    rules.

    Returns:
      {
        "n":              int,
        "first_ts_utc":   ISO,
        "last_ts_utc":    ISO,
        "divergence_pct": {"min", "max", "mean", "p25", "p50", "p75", "stdev"},
        "basis_apr":      {...} | null    # null if no basis values present
      }
    """
    series = recent_history(history, asset, days=days)
    if not series:
        return None

    div_vals = [e["divergence_pct"] for e in series if "divergence_pct" in e]
    basis_vals = [
        e["basis_apr"] for e in series
        if e.get("basis_apr") is not None
    ]

    def stats(vals: list) -> Optional[dict]:
        if not vals:
            return None
        vals_sorted = sorted(vals)
        n = len(vals_sorted)

        def quantile(q: float) -> float:
            # Linear interpolation between the closest ranks
            if n == 1:
                return vals_sorted[0]
            idx = q * (n - 1)
            lo = int(idx)
            hi = min(lo + 1, n - 1)
            frac = idx - lo
            return vals_sorted[lo] + (vals_sorted[hi] - vals_sorted[lo]) * frac

        return {
            "min":   vals_sorted[0],
            "max":   vals_sorted[-1],
            "mean":  statistics.fmean(vals_sorted),
            "p25":   quantile(0.25),
            "p50":   quantile(0.50),
            "p75":   quantile(0.75),
            "stdev": statistics.pstdev(vals_sorted) if n > 1 else 0.0,
        }

    return {
        "n":              len(series),
        "first_ts_utc":   series[0]["ts_utc"],
        "last_ts_utc":    series[-1]["ts_utc"],
        "divergence_pct": stats(div_vals),
        "basis_apr":      stats(basis_vals),
    }


# ---------------------------------------------------------------------------
# CLI


def _cli_validate(path: Path) -> int:
    try:
        history = load(path)
    except DivergenceError as e:
        sys.stderr.write(f"history {path}: INVALID — {e}\n")
        return 2
    n_assets = len(history["by_asset"])
    total = sum(len(s) for s in history["by_asset"].values())
    print(
        f"history {path}: schema {history['schema_version']}, "
        f"{n_assets} assets, {total} total snapshots, "
        f"last_updated={history.get('last_updated')}"
    )
    for asset, series in sorted(history["by_asset"].items()):
        if not series:
            continue
        first = series[0].get("ts_utc", "?")
        last = series[-1].get("ts_utc", "?")
        latest_div = series[-1].get("divergence_pct", "?")
        latest_basis = series[-1].get("basis_apr", "?")
        print(
            f"  {asset:<8} n={len(series):>3}  "
            f"first={first}  last={last}  "
            f"latest_div={latest_div}  latest_basis={latest_basis}"
        )
    return 0


def _cli_main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else HISTORY_PATH
    return _cli_validate(path)


if __name__ == "__main__":
    sys.exit(_cli_main())

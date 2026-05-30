"""Evaluate poller conditions against the Coinglass cache.

Read-only — this module computes current metric values from cached
data and tests whether watch conditions fire. No actions, no LLM,
no Discord. Used by scripts/poll-engine-conditions.py.

Cache contract (populated by scripts/prefetch-coinglass.sh, documented
in skills/perps-scan/SKILL.md):

  .coinglass-cache/price-<ASSET>.json     daily OHLC + volume (8d, newest first)
  .coinglass-cache/oi-<ASSET>.json        aggregated OI (8d)
  .coinglass-cache/funding-<ASSET>.json   OI-weighted funding (21x8h)
  .coinglass-cache/topls-<ASSET>.json     top-trader long/short (8d)
  .coinglass-cache/basis-<ASSET>.json     futures-spot basis (8d)
  .coinglass-cache/taker-<ASSET>.json     taker buy/sell volume (8d)

All histories order index 0 = MOST RECENT. So:
  funding.data[0].close      = current 8h funding
  oi.data[0].close            = current OI
  oi.data[1].close            = yesterday's OI close
  (oi[0] - oi[1]) / oi[1]*100 = 24h OI change %
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional


CACHE_DIR = Path(".coinglass-cache")
DEFAULT_COOLDOWN_MINUTES = 240  # 4h, mirrors VALID_WATCH defaults in ledger.py


# ---------------------------------------------------------------------------
# Cache loading


def _load_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def _first_data_point(j: Optional[dict]) -> Optional[dict]:
    """Coinglass shapes:
        {"data": [{...}, ...]}     — newest first
        {"data": {"<exchange>": [...]}} — exchange-keyed
    Pick the first data entry, handling both shapes.
    """
    if not j:
        return None
    data = j.get("data")
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        # Exchange-keyed: take the first exchange's list and its first point
        for v in data.values():
            if isinstance(v, list) and v:
                return v[0]
    return None


def _data_list(j: Optional[dict]) -> list:
    if not j:
        return []
    data = j.get("data")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                return v
    return []


def load_asset_metrics(asset: str, cache_dir: Path = CACHE_DIR) -> dict:
    """Read the cache files for `asset` and return a dict of the metric
    values used by the condition types. Missing files / fields don't
    raise — they leave the corresponding metric as None, and conditions
    that depend on a None metric simply don't fire.

    Returned shape:
      {
        "price":            float | None,   # current daily close
        "pct_24h_pct":      float | None,
        "vol_ratio":        float | None,   # today's vol / 7d avg
        "oi":               float | None,
        "oi_change_24h_pct": float | None,
        "funding":          float | None,   # current 8h rate
        "lsr":              float | None,   # top-trader L/S ratio
        "lsr_delta_7d":     float | None,
        "taker_buy_pct":    float | None,
        "basis":            float | None,
      }
    """
    asset = (asset or "").upper()
    out: dict = {
        "price": None, "pct_24h_pct": None, "vol_ratio": None,
        "oi": None, "oi_change_24h_pct": None,
        "funding": None,
        "lsr": None, "lsr_delta_7d": None,
        "taker_buy_pct": None,
        "basis": None,
    }
    if not asset:
        return out

    # ---- price ----
    price = _load_json(cache_dir / f"price-{asset}.json")
    plist = _data_list(price)
    if plist:
        try:
            out["price"] = float(plist[0].get("close"))
        except (TypeError, ValueError):
            pass
        if len(plist) >= 2:
            try:
                p0 = float(plist[0].get("close"))
                p1 = float(plist[1].get("close"))
                if p1:
                    out["pct_24h_pct"] = (p0 - p1) / p1 * 100
            except (TypeError, ValueError):
                pass
        # 7-day average volume vs today's volume
        if len(plist) >= 8:
            try:
                vols = [float(p.get("volume")) for p in plist[1:8]]
                vol_today = float(plist[0].get("volume"))
                mean_7d = sum(vols) / len(vols) if vols else None
                if mean_7d:
                    out["vol_ratio"] = vol_today / mean_7d
            except (TypeError, ValueError, ZeroDivisionError):
                pass

    # ---- OI ----
    oi = _load_json(cache_dir / f"oi-{asset}.json")
    oilist = _data_list(oi)
    if oilist:
        try:
            out["oi"] = float(oilist[0].get("close"))
        except (TypeError, ValueError):
            pass
        if len(oilist) >= 2:
            try:
                o0 = float(oilist[0].get("close"))
                o1 = float(oilist[1].get("close"))
                if o1:
                    out["oi_change_24h_pct"] = (o0 - o1) / o1 * 100
            except (TypeError, ValueError):
                pass

    # ---- funding ----
    funding = _load_json(cache_dir / f"funding-{asset}.json")
    flist = _data_list(funding)
    if flist:
        try:
            out["funding"] = float(flist[0].get("close"))
        except (TypeError, ValueError):
            pass

    # ---- top-trader LSR ----
    topls = _load_json(cache_dir / f"topls-{asset}.json")
    llist = _data_list(topls)
    if llist:
        try:
            out["lsr"] = float(llist[0].get("close"))
        except (TypeError, ValueError):
            pass
        if len(llist) >= 8:
            try:
                l0 = float(llist[0].get("close"))
                l7 = float(llist[7].get("close"))
                out["lsr_delta_7d"] = l0 - l7
            except (TypeError, ValueError):
                pass

    # ---- taker buy ratio ----
    taker = _load_json(cache_dir / f"taker-{asset}.json")
    tlist = _data_list(taker)
    if tlist:
        try:
            t = tlist[0]
            buy = float(t.get("buyVolUsd") or t.get("buy") or 0)
            sell = float(t.get("sellVolUsd") or t.get("sell") or 0)
            total = buy + sell
            if total:
                out["taker_buy_pct"] = buy / total * 100
        except (TypeError, ValueError):
            pass

    # ---- basis ----
    basis = _load_json(cache_dir / f"basis-{asset}.json")
    blist = _data_list(basis)
    if blist:
        try:
            out["basis"] = float(blist[0].get("close"))
        except (TypeError, ValueError):
            pass

    return out


# ---------------------------------------------------------------------------
# Condition evaluation


# Map each condition type to (metric_key, comparator).
# Comparators: ">" / "<" / ">=" / "<="
CONDITION_MAP: dict[str, tuple[str, str]] = {
    "price_close_above":      ("price",            ">="),
    "price_close_below":      ("price",            "<="),
    "funding_above":          ("funding",          ">"),
    "funding_below":          ("funding",          "<"),
    "oi_change_above_pct":    ("oi_change_24h_pct", ">"),
    "oi_change_below_pct":    ("oi_change_24h_pct", "<"),
    "lsr_above":              ("lsr",              ">"),
    "lsr_below":              ("lsr",              "<"),
    "lsr_delta_above":        ("lsr_delta_7d",     ">"),
    "lsr_delta_below":        ("lsr_delta_7d",     "<"),
    "taker_buy_above_pct":    ("taker_buy_pct",    ">"),
    "taker_buy_below_pct":    ("taker_buy_pct",    "<"),
    "basis_above":            ("basis",            ">"),
    "basis_below":            ("basis",            "<"),
    "volume_ratio_above":     ("vol_ratio",        ">"),
}


def evaluate_condition(condition: dict, metrics: dict) -> tuple[bool, Optional[float]]:
    """Test whether `condition` fires given current `metrics`.

    Returns (fired, current_value). current_value is the metric reading
    used in the comparison; None if the metric was unavailable.
    """
    ctype = condition.get("type")
    if ctype not in CONDITION_MAP:
        return False, None
    metric_key, op = CONDITION_MAP[ctype]
    current = metrics.get(metric_key)
    if current is None:
        return False, None
    try:
        threshold = float(condition["threshold"])
    except (KeyError, TypeError, ValueError):
        return False, current
    if   op == ">":  return (current >  threshold, current)
    elif op == "<":  return (current <  threshold, current)
    elif op == ">=": return (current >= threshold, current)
    elif op == "<=": return (current <= threshold, current)
    return False, current


def is_in_cooldown(
    condition: dict,
    now_utc: Optional[datetime] = None,
    default_minutes: int = DEFAULT_COOLDOWN_MINUTES,
) -> bool:
    """Return True if the condition recently fired or was DEFERed and is
    still within its cooldown window. The poller skips cooldown'd
    conditions.

    Reads last_fired_at_utc and last_defer_at_utc fields the
    engine-trigger-review skill (PR3) sets after Claude reviews a fire.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    cooldown_min = condition.get("cooldown_minutes")
    if cooldown_min is None:
        cooldown_min = default_minutes
    try:
        cooldown_min = float(cooldown_min)
    except (TypeError, ValueError):
        cooldown_min = default_minutes
    if cooldown_min <= 0:
        return False
    cutoff = now_utc - timedelta(minutes=cooldown_min)
    for field in ("last_fired_at_utc", "last_defer_at_utc"):
        ts_str = condition.get(field)
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            continue
        if ts > cutoff:
            return True
    return False


# ---------------------------------------------------------------------------
# CLI for ad-hoc inspection


def _cli_main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: condition_evaluator.py <ASSET>\n")
        return 1
    asset = sys.argv[1].upper()
    metrics = load_asset_metrics(asset)
    print(f"metrics for {asset}:")
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k:24s}  {v:.6g}")
        else:
            print(f"  {k:24s}  {v}")
    return 0


if __name__ == "__main__":
    sys.exit(_cli_main())

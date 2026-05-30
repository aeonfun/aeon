"""Dominance regime classification + delta computation.

Reads the .dominance-cache/ files produced by scripts/prefetch-dominance.sh
and produces a structured regime summary that market-context-refresh
(and downstream skills) can integrate into Claude's read.

The 4-quadrant rotation regime model:

                  BTC.D rising              BTC.D falling
                  ┌──────────────────────┬──────────────────────┐
USDT.D rising    │ FULL_RISK_OFF        │ CAPITULATION         │
                 │ Money exiting alts   │ Alts being sold into │
                 │ AND BTC into stables │ stables; BTC giving  │
                 │                      │ up market share too  │
                 ├──────────────────────┼──────────────────────┤
USDT.D falling   │ BTC_ONLY_FLOW        │ RISK_ON              │
                 │ Money rotating from  │ Money flowing out of │
                 │ alts to BTC;         │ stables into alts;   │
                 │ alt headwinds        │ alt season setup     │
                 └──────────────────────┴──────────────────────┘

Magnitude buckets (per leg, by 7d % point change):
    micro:  |Δ| < 0.3 pp        — noise band; regime is FLAT
    small:  0.3 ≤ |Δ| < 0.8 pp
    medium: 0.8 ≤ |Δ| < 2.0 pp
    large:  |Δ| ≥ 2.0 pp

When BOTH legs are in the micro band, the regime is FLAT (no
meaningful rotation).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


CACHE_DIR = Path(".dominance-cache")


# Regime labels for the 4-quadrant model + FLAT.
REGIMES = {
    "FULL_RISK_OFF": (
        "BTC.D rising and USDT.D rising — money exiting both alts AND BTC "
        "into stables. Worst possible tape for risk-on positioning."
    ),
    "BTC_ONLY_FLOW": (
        "BTC.D rising while USDT.D falling — money flowing out of stables "
        "AND out of alts INTO BTC. BTC-favourable, alts face structural "
        "headwinds even with clean asset thesis."
    ),
    "CAPITULATION": (
        "BTC.D falling while USDT.D rising — alts AND BTC both losing "
        "market share to stables. Late-cycle capitulation pattern."
    ),
    "RISK_ON": (
        "BTC.D falling and USDT.D falling — money flowing out of stables "
        "INTO the broader crypto risk surface. Alt season setup."
    ),
    "FLAT": (
        "Dominance regime is flat — no meaningful rotation. Both BTC.D "
        "and USDT.D changes are within the micro band (<0.3pp)."
    ),
}


def _load_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def _series_at(series: list[list], days_back: int) -> Optional[float]:
    """CoinGecko market_chart series is [[ts_ms, value], ...] newest LAST.
    Return the value `days_back` days from the end, or None if out of range.
    """
    if not series or days_back >= len(series):
        return None
    try:
        return float(series[-1 - days_back][1])
    except (TypeError, ValueError, IndexError):
        return None


def _classify_magnitude(delta_pp: Optional[float]) -> str:
    if delta_pp is None:
        return "unknown"
    a = abs(delta_pp)
    if a < 0.3:
        return "micro"
    if a < 0.8:
        return "small"
    if a < 2.0:
        return "medium"
    return "large"


def _classify_regime(
    btc_delta_pp: Optional[float],
    usdt_delta_pp: Optional[float],
) -> str:
    """Map (BTC.D Δ, USDT.D Δ) to one of the regime labels."""
    if btc_delta_pp is None or usdt_delta_pp is None:
        return "UNKNOWN"
    btc_mag = _classify_magnitude(btc_delta_pp)
    usdt_mag = _classify_magnitude(usdt_delta_pp)
    if btc_mag == "micro" and usdt_mag == "micro":
        return "FLAT"
    if btc_delta_pp > 0 and usdt_delta_pp > 0:
        return "FULL_RISK_OFF"
    if btc_delta_pp > 0 and usdt_delta_pp <= 0:
        return "BTC_ONLY_FLOW"
    if btc_delta_pp <= 0 and usdt_delta_pp > 0:
        return "CAPITULATION"
    return "RISK_ON"  # both <= 0 and at least one beyond micro


def _compute_dominance_history(
    coin_chart: dict, total_chart: dict
) -> Optional[list[float]]:
    """Combine /coins/{id}/market_chart and /global/market_cap_chart to
    derive that coin's dominance % at each historical day.

    Returns a list (oldest-first) of dominance percentages.
    """
    if not coin_chart or not total_chart:
        return None
    coin_caps = coin_chart.get("market_caps") or []
    # CoinGecko /global/market_cap_chart shape: {"market_cap_chart": {"market_cap": [[ts, val], ...]}}
    total_block = total_chart.get("market_cap_chart") or total_chart
    total_caps = total_block.get("market_cap") if isinstance(total_block, dict) else None
    if not coin_caps or not total_caps:
        return None
    # Align by index — both arrays are daily, oldest-first
    n = min(len(coin_caps), len(total_caps))
    out: list[float] = []
    for i in range(n):
        try:
            c = float(coin_caps[i][1])
            t = float(total_caps[i][1])
            if t > 0:
                out.append(c / t * 100)
        except (TypeError, ValueError, IndexError):
            continue
    return out if out else None


def build_dominance_summary(
    cache_dir: Path = CACHE_DIR,
) -> dict:
    """Read the cache and produce a structured dominance summary.

    Returns:
      {
        "fetched_at_utc": str | None,
        "now": {
          "btc_d_pct":  float | None,
          "eth_d_pct":  float | None,
          "usdt_d_pct": float | None,
          "total_mcap_usd":   float | None,
          "total_volume_usd": float | None,
        },
        "deltas_pp": {
          "btc_d_24h":  float | None,
          "btc_d_7d":   float | None,
          "btc_d_30d":  float | None,
          "usdt_d_24h": float | None,
          "usdt_d_7d":  float | None,
          "usdt_d_30d": float | None,
        },
        "magnitudes": {
          "btc_d_7d":   "micro"|"small"|"medium"|"large"|"unknown",
          "usdt_d_7d":  "..."
        },
        "regime_7d": "FULL_RISK_OFF" | "BTC_ONLY_FLOW" | "CAPITULATION"
                    | "RISK_ON" | "FLAT" | "UNKNOWN",
        "regime_24h": same set
        "regime_description": str,
        "sample_completeness": {
          "global":     bool,
          "btc_30d":    bool,
          "usdt_30d":   bool,
          "total_30d":  bool,
        }
      }
    """
    manifest = _load_json(cache_dir / "manifest.json") or {}
    glob = _load_json(cache_dir / "global.json")
    charts = _load_json(cache_dir / "charts-30d.json")
    btc = _load_json(cache_dir / "btc-30d.json")
    usdt = _load_json(cache_dir / "stables-30d.json")

    # Current values from /global
    now = {"btc_d_pct": None, "eth_d_pct": None, "usdt_d_pct": None,
           "total_mcap_usd": None, "total_volume_usd": None}
    if glob:
        data = glob.get("data") or {}
        mcap_dom = data.get("market_cap_percentage") or {}
        now["btc_d_pct"]  = mcap_dom.get("btc")
        now["eth_d_pct"]  = mcap_dom.get("eth")
        now["usdt_d_pct"] = mcap_dom.get("usdt")
        total_mcap = data.get("total_market_cap") or {}
        now["total_mcap_usd"] = total_mcap.get("usd")
        total_vol = data.get("total_volume") or {}
        now["total_volume_usd"] = total_vol.get("usd")

    # Historical dominance for BTC + USDT
    btc_d_history = _compute_dominance_history(btc, charts) if (btc and charts) else None
    usdt_d_history = _compute_dominance_history(usdt, charts) if (usdt and charts) else None

    deltas = {
        "btc_d_24h":  None, "btc_d_7d":  None, "btc_d_30d":  None,
        "usdt_d_24h": None, "usdt_d_7d": None, "usdt_d_30d": None,
    }
    cur_btc = now["btc_d_pct"]
    cur_usdt = now["usdt_d_pct"]
    if btc_d_history and cur_btc is not None:
        for label, days_back in (("btc_d_24h", 1), ("btc_d_7d", 7), ("btc_d_30d", 30)):
            old = _series_at(
                [[i, v] for i, v in enumerate(btc_d_history)],
                days_back,
            )
            if old is not None:
                deltas[label] = round(cur_btc - old, 4)
    if usdt_d_history and cur_usdt is not None:
        for label, days_back in (("usdt_d_24h", 1), ("usdt_d_7d", 7), ("usdt_d_30d", 30)):
            old = _series_at(
                [[i, v] for i, v in enumerate(usdt_d_history)],
                days_back,
            )
            if old is not None:
                deltas[label] = round(cur_usdt - old, 4)

    magnitudes = {
        "btc_d_24h":  _classify_magnitude(deltas["btc_d_24h"]),
        "btc_d_7d":   _classify_magnitude(deltas["btc_d_7d"]),
        "btc_d_30d":  _classify_magnitude(deltas["btc_d_30d"]),
        "usdt_d_24h": _classify_magnitude(deltas["usdt_d_24h"]),
        "usdt_d_7d":  _classify_magnitude(deltas["usdt_d_7d"]),
        "usdt_d_30d": _classify_magnitude(deltas["usdt_d_30d"]),
    }

    regime_7d = _classify_regime(deltas["btc_d_7d"], deltas["usdt_d_7d"])
    regime_24h = _classify_regime(deltas["btc_d_24h"], deltas["usdt_d_24h"])

    return {
        "fetched_at_utc": manifest.get("fetched_at"),
        "now": now,
        "deltas_pp": deltas,
        "magnitudes": magnitudes,
        "regime_7d":  regime_7d,
        "regime_24h": regime_24h,
        "regime_description": REGIMES.get(regime_7d, "Insufficient data to classify."),
        "sample_completeness": {
            "global":    glob is not None,
            "btc_30d":   btc is not None,
            "usdt_30d":  usdt is not None,
            "total_30d": charts is not None,
        },
    }


# ---------------------------------------------------------------------------
# CLI for ad-hoc inspection


def _cli_main() -> int:
    summary = build_dominance_summary()
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(_cli_main())

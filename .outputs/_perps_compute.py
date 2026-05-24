#!/usr/bin/env python3
"""Compute per-asset perps metrics from .coinglass-cache and emit
.outputs/perps-scan.metrics.json — a working intermediate consumed only
by the perps-scan skill prompt (not the locked artifact)."""

import json
import os
import statistics
from pathlib import Path

ROOT = Path("/home/runner/work/aeon/aeon")
CACHE = ROOT / ".coinglass-cache"
OUT_METRICS = ROOT / ".outputs" / "perps-scan.metrics.json"

TIER1 = {"BTC", "ETH", "SOL"}


def _load(name):
    p = CACHE / name
    if not p.exists():
        return None
    try:
        with p.open() as f:
            doc = json.load(f)
    except Exception:
        return None
    if isinstance(doc, dict) and "data" in doc:
        return doc["data"]
    if isinstance(doc, list):
        return doc
    return None


def _f(x):
    if x is None:
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _last(series, key="close"):
    if not series:
        return None
    return _f(series[-1].get(key))


def _at(series, idx, key="close"):
    if not series or len(series) <= abs(idx):
        return None
    return _f(series[idx].get(key))


def _pct(now, prev):
    if now is None or prev is None or prev == 0:
        return None
    return (now - prev) / prev * 100


def _mean(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)


def _p75(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    vals.sort()
    if len(vals) == 1:
        return vals[0]
    rank = 0.75 * (len(vals) - 1)
    lo = int(rank)
    hi = min(lo + 1, len(vals) - 1)
    frac = rank - lo
    return vals[lo] + (vals[hi] - vals[lo]) * frac


def _fmt_usd(x):
    if x is None:
        return None
    a = abs(x)
    if a >= 1e9:
        return f"${x/1e9:.2f}B"
    if a >= 1e6:
        return f"${x/1e6:.1f}M"
    if a >= 1e3:
        return f"${x/1e3:.0f}K"
    return f"${x:.0f}"


def _fmt_price(x):
    if x is None:
        return None
    a = abs(x)
    if a >= 1000:
        return f"${x:,.1f}"
    if a >= 1:
        return f"${x:.3f}"
    if a >= 0.01:
        return f"${x:.4f}"
    return f"${x:.6f}"


def compute_coin(coin, btc_pct_24h=None, btc_pct_7d=None):
    price = _load(f"price-{coin}.json")
    price_1h = _load(f"price-1h-{coin}.json")
    oi = _load(f"oi-{coin}.json")
    funding = _load(f"funding-{coin}.json")
    liq = _load(f"liq-{coin}.json")
    topls = _load(f"topls-{coin}.json")
    basis = _load(f"basis-{coin}.json")
    taker = _load(f"taker-{coin}.json")

    if not price or not oi or not funding:
        return {"asset": coin, "dropped": True, "reason": "missing price/oi/funding"}

    current_price = _last(price)
    prev_close = _at(price, -2)
    pct_24h = _pct(current_price, prev_close)
    # 7d back = data[-8] if length >= 8, else data[0]
    seven_d_ago = _at(price, -8) if len(price) >= 8 else _at(price, 0)
    pct_7d = _pct(current_price, seven_d_ago)
    # vol_ratio = today_vol / mean(prior 6 days)
    vol_now = _f(price[-1].get("volume_usd"))
    prior_vols = [_f(r.get("volume_usd")) for r in price[-7:-1]] if len(price) >= 7 else [
        _f(r.get("volume_usd")) for r in price[:-1]
    ]
    vol_mean = _mean(prior_vols)
    vol_ratio = (vol_now / vol_mean) if (vol_now is not None and vol_mean) else None
    # range_7d_pct: max high vs min low across last 7 daily rows (excluding today)
    last7 = price[-8:-1] if len(price) >= 8 else price[:-1]
    if last7:
        highs = [_f(r.get("high")) for r in last7]
        lows = [_f(r.get("low")) for r in last7]
        hi_max = max([h for h in highs if h is not None], default=None)
        lo_min = min([l for l in lows if l is not None and l > 0], default=None)
        range_7d_pct = ((hi_max - lo_min) / lo_min * 100) if (hi_max and lo_min) else None
    else:
        range_7d_pct = None

    oi_now = _last(oi)
    oi_prev = _at(oi, -2)
    oi_24h_pct = _pct(oi_now, oi_prev)
    oi_7d_ago = _at(oi, -8) if len(oi) >= 8 else _at(oi, 0)
    oi_7d_pct = _pct(oi_now, oi_7d_ago)

    funding_now = _last(funding)
    funding_closes = [_f(r.get("close")) for r in funding]
    funding_7d_avg = _mean(funding_closes)
    funding_delta = (funding_now - funding_7d_avg) if (funding_now is not None and funding_7d_avg is not None) else None

    long_liqs_24h = None
    short_liqs_24h = None
    liq_24h_total = None
    liq_7d_p75 = None
    liqs_4h = None
    long_liqs_series = []
    short_liqs_series = []
    total_liqs_series = []
    if liq:
        for r in liq:
            l = _f(r.get("aggregated_long_liquidation_usd")) if "aggregated_long_liquidation_usd" in r else _f(r.get("long_liquidation_usd"))
            s = _f(r.get("aggregated_short_liquidation_usd")) if "aggregated_short_liquidation_usd" in r else _f(r.get("short_liquidation_usd"))
            t = ((l or 0) + (s or 0)) if (l is not None or s is not None) else _f(r.get("close"))
            long_liqs_series.append(l)
            short_liqs_series.append(s)
            total_liqs_series.append(t)
        long_liqs_24h = long_liqs_series[-1]
        short_liqs_24h = short_liqs_series[-1]
        liq_24h_total = total_liqs_series[-1]
        # 7d p75 across the prior 7 days (excluding today)
        prior = total_liqs_series[:-1] if len(total_liqs_series) > 1 else total_liqs_series
        liq_7d_p75 = _p75(prior)
        # liqs_4h approximated as 4/24 of today's total
        if liq_24h_total is not None:
            liqs_4h = liq_24h_total * (4.0 / 24.0)

    top_ls_now = None
    top_ls_7d_avg = None
    top_ls_delta_7d = None
    if topls:
        ts_series = [_f(r.get("top_position_long_short_ratio")) for r in topls]
        top_ls_now = ts_series[-1]
        # 7d avg across prior 7 days (excluding today)
        prior7 = ts_series[-8:-1] if len(ts_series) >= 8 else ts_series[:-1]
        top_ls_7d_avg = _mean(prior7)
        seven_d_back = ts_series[-8] if len(ts_series) >= 8 else ts_series[0]
        if top_ls_now is not None and seven_d_back is not None:
            top_ls_delta_7d = top_ls_now - seven_d_back

    basis_now = None
    basis_7d_avg = None
    if basis:
        bcloses = [_f(r.get("close_basis")) for r in basis]
        basis_now = bcloses[-1]
        prior_b = bcloses[-8:-1] if len(bcloses) >= 8 else bcloses[:-1]
        basis_7d_avg = _mean(prior_b)

    taker_buy_pct_24h = None
    if taker:
        row = taker[-1]
        buy = _f(row.get("taker_buy_volume_usd"))
        sell = _f(row.get("taker_sell_volume_usd"))
        if buy is not None and sell is not None and (buy + sell) > 0:
            taker_buy_pct_24h = buy / (buy + sell) * 100

    pct_4h = None
    if price_1h and len(price_1h) >= 5:
        h_now = _last(price_1h)
        h_4 = _at(price_1h, -5)
        pct_4h = _pct(h_now, h_4)

    # cross-BTC deltas — only meaningful if not BTC itself
    pct_24h_vs_btc = None
    pct_7d_vs_btc = None
    if coin != "BTC":
        if pct_24h is not None and btc_pct_24h is not None:
            pct_24h_vs_btc = pct_24h - btc_pct_24h
        if pct_7d is not None and btc_pct_7d is not None:
            pct_7d_vs_btc = pct_7d - btc_pct_7d
    else:
        pct_24h_vs_btc = 0.0
        pct_7d_vs_btc = 0.0

    return {
        "asset": coin,
        "dropped": False,
        "tier": 1 if coin in TIER1 else 2,
        "current_price": current_price,
        "current_price_fmt": _fmt_price(current_price),
        "pct_24h": pct_24h,
        "pct_7d": pct_7d,
        "pct_4h": pct_4h,
        "vol_ratio": vol_ratio,
        "range_7d_pct": range_7d_pct,
        "pct_24h_vs_btc": pct_24h_vs_btc,
        "pct_7d_vs_btc": pct_7d_vs_btc,
        "oi_now": oi_now,
        "oi_now_fmt": _fmt_usd(oi_now),
        "oi_24h_pct": oi_24h_pct,
        "oi_7d_pct": oi_7d_pct,
        "funding_now": funding_now,
        "funding_7d_avg": funding_7d_avg,
        "funding_delta": funding_delta,
        "liq_24h_total": liq_24h_total,
        "liq_24h_total_fmt": _fmt_usd(liq_24h_total),
        "liq_7d_p75": liq_7d_p75,
        "liq_7d_p75_fmt": _fmt_usd(liq_7d_p75),
        "long_liqs_24h": long_liqs_24h,
        "long_liqs_24h_fmt": _fmt_usd(long_liqs_24h),
        "short_liqs_24h": short_liqs_24h,
        "short_liqs_24h_fmt": _fmt_usd(short_liqs_24h),
        "liqs_4h": liqs_4h,
        "liqs_4h_fmt": _fmt_usd(liqs_4h),
        "short_liqs_7d_p75": _p75([v for v in short_liqs_series[:-1] if v is not None]) if short_liqs_series else None,
        "top_ls_now": top_ls_now,
        "top_ls_7d_avg": top_ls_7d_avg,
        "top_ls_delta_7d": top_ls_delta_7d,
        "basis_now": basis_now,
        "basis_7d_avg": basis_7d_avg,
        "taker_buy_pct_24h": taker_buy_pct_24h,
    }


def main():
    with open(CACHE / "manifest.json") as f:
        manifest = json.load(f)
    assets = manifest["asset_list"]

    # Pass 1: BTC for cross-deltas
    btc = compute_coin("BTC")
    btc_pct_24h = btc.get("pct_24h")
    btc_pct_7d = btc.get("pct_7d")

    out = {"manifest_fetched_at": manifest.get("fetched_at"), "assets": []}
    for coin in assets:
        m = compute_coin(coin, btc_pct_24h=btc_pct_24h, btc_pct_7d=btc_pct_7d)
        out["assets"].append(m)

    OUT_METRICS.parent.mkdir(parents=True, exist_ok=True)
    with OUT_METRICS.open("w") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {OUT_METRICS} for {len(out['assets'])} assets")


if __name__ == "__main__":
    main()

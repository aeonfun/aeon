#!/usr/bin/env python3
"""Perps Scan v3 computation for 2026-05-29.

Reads .coinglass-cache/, derives metrics, classifies regimes,
applies sub-tags + pattern tags, and writes _perps_scan_today.json
(metric dump) to be hand-translated into the artifact JSON.
"""
import json, os, statistics, sys
from pathlib import Path

CACHE = Path("/home/runner/work/aeon/aeon/.coinglass-cache")
OUT = Path("/home/runner/work/aeon/aeon/.outputs/_perps_scan_today.json")

manifest = json.loads((CACHE / "manifest.json").read_text())
ASSETS = manifest["asset_list"]
TIER1 = {"BTC", "ETH", "SOL"}

def load(name):
    p = CACHE / name
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None

def to_float(x):
    if x is None:
        return None
    try:
        return float(x)
    except Exception:
        return None

def closes(rows, key="close"):
    return [to_float(r.get(key)) for r in rows]

def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs)/len(xs) if xs else None

def percentile(xs, p):
    xs = sorted([x for x in xs if x is not None])
    if not xs:
        return None
    k = (len(xs)-1) * p
    f = int(k)
    c = min(f+1, len(xs)-1)
    if f == c:
        return xs[f]
    return xs[f] + (xs[c]-xs[f])*(k-f)

def fmt_money(v):
    if v is None: return None
    av = abs(v)
    if av >= 1e9:
        return f"${v/1e9:.2f}B"
    if av >= 1e6:
        return f"${v/1e6:.2f}M"
    if av >= 1e3:
        return f"${v/1e3:.1f}K"
    return f"${v:.0f}"

def fmt_price(v):
    if v is None: return None
    av = abs(v)
    if av >= 1000:
        return f"${v:,.0f}"
    if av >= 1:
        return f"${v:.3f}"
    if av >= 0.01:
        return f"${v:.4f}"
    if av >= 0.0001:
        return f"${v:.5f}"
    return f"${v:.8f}"

def round_funding(v):
    if v is None: return None
    return round(v, 4)

def round_basis(v):
    if v is None: return None
    return round(v, 4)

def round_pct(v):
    if v is None: return None
    return round(v, 2)

results = {}

# We need BTC pct_24h and pct_7d for relative computation.
btc_pct_24h = None
btc_pct_7d = None

# First pass — compute everything but vs_btc
asset_metrics = {}

for asset in ASSETS:
    p = load(f"price-{asset}.json")
    o = load(f"oi-{asset}.json")
    f = load(f"funding-{asset}.json")
    if not (p and o and f and p.get("data") and o.get("data") and f.get("data")):
        # missing critical — drop
        asset_metrics[asset] = None
        continue
    p1h = load(f"price-1h-{asset}.json")
    liq = load(f"liq-{asset}.json")
    tls = load(f"topls-{asset}.json")
    bas = load(f"basis-{asset}.json")
    tak = load(f"taker-{asset}.json")

    p_rows = p["data"]
    o_rows = o["data"]
    f_rows = f["data"]

    # price: 8 daily candles, data[0] oldest, data[-1] newest (May 29)
    price_closes = closes(p_rows)
    # volumes are stored under "volume_usd"
    price_vols = [to_float(r.get("volume_usd")) for r in p_rows]
    price_highs = [to_float(r.get("high")) for r in p_rows]
    price_lows = [to_float(r.get("low")) for r in p_rows]

    current_price = price_closes[-1]
    pct_24h = (price_closes[-1] - price_closes[-2]) / price_closes[-2] * 100 if price_closes[-2] else None
    pct_7d = (price_closes[-1] - price_closes[0]) / price_closes[0] * 100 if price_closes[0] else None

    # vol_ratio: today (data[-1]) vs mean of prior 7d (data[0..-2])
    vol_today = price_vols[-1]
    vol_prior = [v for v in price_vols[:-1] if v is not None]
    vol_ratio = vol_today / mean(vol_prior) if vol_today and vol_prior else None

    # range_7d_pct over the last 7 candles (excluding partial current?). Use last 7.
    last7_high = [h for h in price_highs[-7:] if h is not None]
    last7_low = [l for l in price_lows[-7:] if l is not None]
    if last7_high and last7_low and min(last7_low) > 0:
        range_7d_pct = (max(last7_high) - min(last7_low)) / min(last7_low) * 100
    else:
        range_7d_pct = None

    # OI: same shape
    oi_closes = closes(o_rows)
    oi_now = oi_closes[-1]
    oi_24h_pct = (oi_closes[-1] - oi_closes[-2]) / oi_closes[-2] * 100 if oi_closes[-2] else None
    oi_7d_pct = (oi_closes[-1] - oi_closes[0]) / oi_closes[0] * 100 if oi_closes[0] else None

    # Funding: 21 entries
    fund_closes = closes(f_rows)
    funding_now = fund_closes[-1]
    funding_7d_avg = mean(fund_closes)
    funding_delta = funding_now - funding_7d_avg if funding_now is not None and funding_7d_avg is not None else None

    # 1h price for pct_4h
    pct_4h = None
    if p1h and p1h.get("data"):
        p1_rows = p1h["data"]
        p1_closes = closes(p1_rows)
        if len(p1_closes) >= 5 and p1_closes[-5]:
            pct_4h = (p1_closes[-1] - p1_closes[-5]) / p1_closes[-5] * 100

    # Liquidations
    long_liqs_24h = None
    short_liqs_24h = None
    liq_24h_total = None
    liq_7d_p75 = None
    short_liq_7d_p75 = None
    long_liq_7d_p75 = None
    liq_rows = []
    if liq and liq.get("data"):
        liq_rows = liq["data"]
        latest = liq_rows[-1]
        long_liqs_24h = to_float(latest.get("aggregated_long_liquidation_usd"))
        short_liqs_24h = to_float(latest.get("aggregated_short_liquidation_usd"))
        if long_liqs_24h is not None and short_liqs_24h is not None:
            liq_24h_total = long_liqs_24h + short_liqs_24h
        # 7d p75 across totals of prior 7 days (excluding current incomplete day's row -1 — but use all 8)
        totals = []
        shorts = []
        longs = []
        for r in liq_rows:
            l = to_float(r.get("aggregated_long_liquidation_usd"))
            s = to_float(r.get("aggregated_short_liquidation_usd"))
            if l is not None and s is not None:
                totals.append(l + s)
                shorts.append(s)
                longs.append(l)
        liq_7d_p75 = percentile(totals, 0.75)
        short_liq_7d_p75 = percentile(shorts, 0.75)
        long_liq_7d_p75 = percentile(longs, 0.75)

    # liqs_4h — no hourly liq data; approximate from daily × (4/24)
    liqs_4h_est = liq_24h_total * (4/24) if liq_24h_total else None

    # Top L/S
    top_ls_now = None
    top_ls_7d_avg = None
    top_ls_delta_7d = None
    if tls and tls.get("data"):
        t_rows = tls["data"]
        t_ratios = [to_float(r.get("top_position_long_short_ratio")) for r in t_rows]
        top_ls_now = t_ratios[-1]
        top_ls_7d_avg = mean(t_ratios)
        if t_ratios[0] is not None and t_ratios[-1] is not None:
            top_ls_delta_7d = t_ratios[-1] - t_ratios[0]

    # Basis
    basis_now = None
    basis_7d_avg = None
    if bas and bas.get("data"):
        b_rows = bas["data"]
        b_closes = [to_float(r.get("close_basis")) for r in b_rows]
        basis_now = b_closes[-1]
        basis_7d_avg = mean(b_closes)

    # Taker buy
    taker_buy_pct_24h = None
    if tak and tak.get("data"):
        tk_rows = tak["data"]
        tk_latest = tk_rows[-1]
        bv = to_float(tk_latest.get("taker_buy_volume_usd"))
        sv = to_float(tk_latest.get("taker_sell_volume_usd"))
        if bv is not None and sv is not None and (bv+sv) > 0:
            taker_buy_pct_24h = bv / (bv + sv) * 100

    m = {
        "asset": asset,
        "tier": 1 if asset in TIER1 else 2,
        "current_price": current_price,
        "pct_24h": pct_24h,
        "pct_7d": pct_7d,
        "pct_4h": pct_4h,
        "vol_ratio": vol_ratio,
        "range_7d_pct": range_7d_pct,
        "oi_now": oi_now,
        "oi_24h_pct": oi_24h_pct,
        "oi_7d_pct": oi_7d_pct,
        "funding_now": funding_now,
        "funding_7d_avg": funding_7d_avg,
        "funding_delta": funding_delta,
        "liq_24h_total": liq_24h_total,
        "liq_7d_p75": liq_7d_p75,
        "long_liqs_24h": long_liqs_24h,
        "short_liqs_24h": short_liqs_24h,
        "long_liq_7d_p75": long_liq_7d_p75,
        "short_liq_7d_p75": short_liq_7d_p75,
        "liqs_4h": liqs_4h_est,
        "top_ls_now": top_ls_now,
        "top_ls_7d_avg": top_ls_7d_avg,
        "top_ls_delta_7d": top_ls_delta_7d,
        "basis_now": basis_now,
        "basis_7d_avg": basis_7d_avg,
        "taker_buy_pct_24h": taker_buy_pct_24h,
    }
    asset_metrics[asset] = m
    if asset == "BTC":
        btc_pct_24h = pct_24h
        btc_pct_7d = pct_7d

# Second pass — compute vs_btc and classify
def classify(m):
    """Apply first-match priority order."""
    tier = m["tier"]
    pct_24h = m["pct_24h"]
    pct_7d = m["pct_7d"]
    funding_now = m["funding_now"]
    funding_7d_avg = m["funding_7d_avg"]
    oi_24h_pct = m["oi_24h_pct"]
    oi_7d_pct = m["oi_7d_pct"]
    liq_24h_total = m["liq_24h_total"]
    liq_7d_p75 = m["liq_7d_p75"]
    short_liqs_24h = m["short_liqs_24h"]
    short_liq_7d_p75 = m["short_liq_7d_p75"]
    taker_buy = m["taker_buy_pct_24h"]
    vol_ratio = m["vol_ratio"]
    range_7d_pct = m["range_7d_pct"]

    # Threshold table
    if tier == 1:
        breakout_pct = 8
        squeeze_pct = 5
        mom_7d = 8
        comp_range = 3
        dist_funding = 0.06
        cap_dd = -6
        cap_oi = -8
    else:
        breakout_pct = 20
        squeeze_pct = 10
        mom_7d = 15
        comp_range = 5
        dist_funding = 0.08
        cap_dd = -10
        cap_oi = -10

    # 1. CAPITULATION
    if (pct_24h is not None and pct_24h <= cap_dd and
        funding_now is not None and funding_now < 0 and
        oi_24h_pct is not None and oi_24h_pct <= cap_oi and
        liq_24h_total is not None and liq_7d_p75 is not None and liq_24h_total >= liq_7d_p75):
        return "CAPITULATION"
    # 2. SHORT-SQUEEZE
    if (pct_24h is not None and pct_24h > squeeze_pct and
        oi_24h_pct is not None and oi_24h_pct < 0 and
        short_liqs_24h is not None and short_liq_7d_p75 is not None and short_liqs_24h >= short_liq_7d_p75 and
        taker_buy is not None and taker_buy < 52):
        return "SHORT-SQUEEZE"
    # 3. DISTRIBUTION
    cond_funding_now = funding_now is not None and funding_now > dist_funding
    cond_funding_avg = funding_7d_avg is not None and funding_7d_avg > 0.06
    if ((cond_funding_now or cond_funding_avg) and
        pct_24h is not None and pct_7d is not None and pct_24h < (pct_7d / 7) and
        oi_24h_pct is not None and oi_24h_pct > 5):
        return "DISTRIBUTION"
    # 4. CATALYST-BREAKOUT
    if (pct_24h is not None and pct_24h > breakout_pct and
        vol_ratio is not None and vol_ratio > 2.0 and
        oi_24h_pct is not None and oi_24h_pct > 10 and
        taker_buy is not None and taker_buy > 52):
        return "CATALYST-BREAKOUT"
    # 5. ACCUMULATION
    if (oi_7d_pct is not None and oi_7d_pct > 10 and
        funding_7d_avg is not None and abs(funding_7d_avg) < 0.04 and
        pct_7d is not None and pct_7d > 0 and
        range_7d_pct is not None and range_7d_pct < 25):
        return "ACCUMULATION"
    # 6. MOMENTUM
    if (pct_7d is not None and pct_7d > mom_7d and
        oi_24h_pct is not None and oi_24h_pct >= 0 and
        funding_now is not None and 0.03 < funding_now <= 0.07):
        return "MOMENTUM"
    # 7. COMPRESSION
    if (range_7d_pct is not None and range_7d_pct < comp_range and
        oi_7d_pct is not None and oi_7d_pct > 5 and
        funding_now is not None and abs(funding_now) < 0.02 and
        pct_24h is not None and abs(pct_24h) < 2):
        return "COMPRESSION"
    return "NEUTRAL"


def sub_tags(regime, m):
    tags = []
    if regime == "DISTRIBUTION":
        if m["top_ls_now"] and m["top_ls_now"] > 2.0 and m["basis_now"] is not None and m["basis_now"] > 0:
            tags.append("REAL-CROWDED-LONG")
        if m["top_ls_now"] and m["top_ls_now"] < 1.5:
            tags.append("RETAIL-ANOMALY")
        if m["pct_24h"] is not None and m["pct_24h"] < 0 and m["oi_24h_pct"] is not None and m["oi_24h_pct"] >= 0:
            tags.append("LONG-TRAP")
    if regime == "CAPITULATION":
        if m["liqs_4h"] and m["liq_24h_total"]:
            r = m["liqs_4h"] / m["liq_24h_total"]
            if r > 0.4:
                tags.append("IN-PROGRESS")
            elif r < 0.15:
                tags.append("CLEARED")
    if regime == "COMPRESSION":
        if m["vol_ratio"] and m["vol_ratio"] > 1.0:
            tags.append("ACTIVE")
        elif m["vol_ratio"] and m["vol_ratio"] < 0.9:
            tags.append("QUIET")
    if regime == "ACCUMULATION":
        if m["taker_buy_pct_24h"] and m["taker_buy_pct_24h"] > 50 and m["top_ls_delta_7d"] is not None and m["top_ls_delta_7d"] > 0:
            tags.append("CONFIRMED")
        elif m["taker_buy_pct_24h"] is not None and m["taker_buy_pct_24h"] < 50:
            tags.append("DIVERGENT")
    if regime == "CATALYST-BREAKOUT":
        if m["pct_4h"] is not None and m["pct_24h"]:
            r = m["pct_4h"] / m["pct_24h"]
            if r > 0.5:
                tags.append("FRESH")
            elif r < 0.2:
                tags.append("STALE")
    return tags


def pattern_tags(regime, m):
    out = []
    tier = m["tier"]
    dist_funding = 0.06 if tier == 1 else 0.08
    funding_now = m["funding_now"]
    top_ls_now = m["top_ls_now"]
    basis_now = m["basis_now"]
    pct_24h = m["pct_24h"]
    oi_24h_pct = m["oi_24h_pct"]
    oi_7d_pct = m["oi_7d_pct"]
    range_7d_pct = m["range_7d_pct"]
    top_ls_delta_7d = m["top_ls_delta_7d"]
    funding_delta = m["funding_delta"]
    taker_buy = m["taker_buy_pct_24h"]
    short_liqs_24h = m["short_liqs_24h"]
    short_liq_7d_p75 = m["short_liq_7d_p75"]

    # REAL-CROWDED-LONG
    rcl = (funding_now is not None and funding_now > dist_funding and
           top_ls_now is not None and top_ls_now > 2.0 and
           basis_now is not None and basis_now > 0.3)
    # RETAIL-ANOMALY (mutually exclusive with RCL)
    ra = (funding_now is not None and funding_now > dist_funding and
          top_ls_now is not None and top_ls_now < 1.5)
    if rcl:
        out.append("REAL-CROWDED-LONG")
    elif ra:
        out.append("RETAIL-ANOMALY")

    # LONG-TRAP
    long_trap_thresh = 0.06 if tier == 1 else 0.08
    if (funding_now is not None and funding_now > long_trap_thresh and
        pct_24h is not None and pct_24h < 0 and
        oi_24h_pct is not None and oi_24h_pct >= -3):
        out.append("LONG-TRAP")

    # STEALTH-POSITIONING
    if (top_ls_delta_7d is not None and top_ls_delta_7d > 0.4 and
        range_7d_pct is not None and range_7d_pct < 5 and
        oi_7d_pct is not None and oi_7d_pct < 5):
        out.append("STEALTH-POSITIONING")

    # CASH-AND-CARRY
    if (basis_now is not None and basis_now > 0.2 and
        funding_delta is not None and abs(funding_delta) < 0.01 and
        oi_7d_pct is not None and oi_7d_pct > 5 and
        taker_buy is not None and 48 < taker_buy < 52):
        out.append("CASH-AND-CARRY")

    # SHORT-SQUEEZE pattern (only if not already in SHORT-SQUEEZE regime)
    if regime != "SHORT-SQUEEZE":
        if (pct_24h is not None and pct_24h > 10 and
            oi_24h_pct is not None and oi_24h_pct < 0 and
            short_liqs_24h is not None and short_liq_7d_p75 is not None and short_liqs_24h >= short_liq_7d_p75):
            out.append("SHORT-SQUEEZE")

    return out


for asset, m in asset_metrics.items():
    if m is None:
        continue
    if btc_pct_24h is not None and m["pct_24h"] is not None:
        m["pct_24h_vs_btc"] = m["pct_24h"] - btc_pct_24h
    else:
        m["pct_24h_vs_btc"] = None
    if btc_pct_7d is not None and m["pct_7d"] is not None:
        m["pct_7d_vs_btc"] = m["pct_7d"] - btc_pct_7d
    else:
        m["pct_7d_vs_btc"] = None
    m["regime"] = classify(m)
    m["sub_tags"] = sub_tags(m["regime"], m)
    m["pattern_tags"] = pattern_tags(m["regime"], m)

# Aggregate
regime_counts = {}
for m in asset_metrics.values():
    if m:
        regime_counts[m["regime"]] = regime_counts.get(m["regime"], 0) + 1

OUT.write_text(json.dumps({
    "btc_pct_24h": btc_pct_24h,
    "btc_pct_7d": btc_pct_7d,
    "assets": asset_metrics,
    "regime_counts": regime_counts,
}, indent=2, default=str))
print(f"Wrote {OUT}")
print(f"Regime counts: {regime_counts}")

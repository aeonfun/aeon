#!/usr/bin/env python3
"""perps-scan v3 compute for 2026-05-28 — fresh from .coinglass-cache.

Reads only the cache, sorts each endpoint time-ascending so [-1] is the most
recent interval, computes base + v3 derived fields, classifies into regimes
with tier-adjusted thresholds, applies sub-tags + cross-signal pattern tags.

Yesterday baseline (05-27) reconstructed from the prior rendered artifact's
yesterday_regime/repeat_days fields, validated against memory/logs/2026-05-27.md.
UB/ESPORTS/ONDO carried from the 05-27 log (NEUTRAL holdovers absent from the
re-ranked earlier-today artifact but present in today's fresh universe).
"""
import json
from pathlib import Path
from collections import Counter

CACHE = Path("/home/runner/work/aeon/aeon/.coinglass-cache")
ASSETS = json.loads((CACHE / "manifest.json").read_text())["asset_list"]
TIER1 = {"BTC", "ETH", "SOL"}

# (yesterday_regime_on_05-27, consecutive_days_in_that_regime_through_05-27)
# Formula below gives today's count as yrep+1 when today's regime == yreg.
YDAY = {
    "BTC": ("NEUTRAL", 3), "ETH": ("NEUTRAL", 3), "SOL": ("NEUTRAL", 3),
    "HYPE": ("ACCUMULATION", 1), "ZEC": ("NEUTRAL", 1), "XRP": ("NEUTRAL", 3),
    "DOGE": ("NEUTRAL", 3), "NEAR": ("NEUTRAL", 3), "WLD": ("NEUTRAL", 3),
    "SUI": ("NEUTRAL", 3), "BNB": ("NEUTRAL", 3), "XAU": ("COMPRESSION", 1),
    "BSB": ("NEUTRAL", 3), "ADA": ("NEUTRAL", 1), "1000PEPE": ("NEUTRAL", 1),
    "FIL": ("NEUTRAL", 1), "UB": ("NEUTRAL", 3), "ESPORTS": ("NEUTRAL", 2),
    "ONDO": ("NEUTRAL", 3),
    # New to today's universe vs 05-27 -> new entrant
    "XLM": (None, 0), "GUA": (None, 0), "BEAT": (None, 0),
    "ALLO": (None, 0), "BCH": (None, 0), "H": (None, 0),
}


def load(name):
    p = CACHE / name
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text())
    except Exception:
        return None
    rows = d.get("data")
    if not rows:
        return None
    return sorted(rows, key=lambda r: r["time"])


def f(x):
    return float(x)


def pct(a, b):
    if b in (0, None) or a is None:
        return None
    return (a - b) / b * 100.0


def percentile(vals, q):
    vals = sorted(vals)
    if not vals:
        return None
    if len(vals) == 1:
        return vals[0]
    pos = q / 100.0 * (len(vals) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(vals) - 1)
    frac = pos - lo
    return vals[lo] + (vals[hi] - vals[lo]) * frac


def fmt_price(p):
    if p is None:
        return "—"
    if p >= 1000:
        return f"${p:,.0f}"
    if p >= 100:
        return f"${p:,.2f}"
    if p >= 1:
        return f"${p:,.3f}"
    return f"${p:.5f}"


def fmt_usd(v):
    if v is None:
        return "—"
    if v >= 1e9:
        return f"${v/1e9:.2f}B"
    if v >= 1e6:
        return f"${v/1e6:.1f}M"
    if v >= 1e3:
        return f"${v/1e3:.0f}K"
    return f"${v:.0f}"


metrics = {}
for a in ASSETS:
    price = load(f"price-{a}.json")
    oi = load(f"oi-{a}.json")
    funding = load(f"funding-{a}.json")
    if not price or not oi or not funding or len(price) < 2 or len(oi) < 2:
        metrics[a] = {"dropped": True, "reason": "missing price/oi/funding"}
        continue

    p1h = load(f"price-1h-{a}.json")
    liq = load(f"liq-{a}.json")
    topls = load(f"topls-{a}.json")
    basis = load(f"basis-{a}.json")
    taker = load(f"taker-{a}.json")

    m = {"asset": a, "tier": 1 if a in TIER1 else 2, "dropped": False}
    closes = [f(r["close"]) for r in price]
    highs = [f(r["high"]) for r in price]
    lows = [f(r["low"]) for r in price]
    vols = [f(r.get("volume_usd", r.get("volume", 0))) for r in price]
    n = len(price)

    m["current_price"] = closes[-1]
    m["pct_24h"] = pct(closes[-1], closes[-2])
    m["pct_7d"] = pct(closes[-1], closes[0])
    prior_vols = vols[:-1] if n > 1 else vols
    mean_prior = sum(prior_vols) / len(prior_vols) if prior_vols else None
    m["vol_ratio"] = (vols[-1] / mean_prior) if mean_prior else None
    recent = price[-7:] if n >= 7 else price
    rh = max(f(r["high"]) for r in recent)
    rl = min(f(r["low"]) for r in recent)
    m["range_7d_pct"] = (rh - rl) / rl * 100.0 if rl else None
    m["broke_7d_high"] = closes[-1] > max(highs[:-1]) if n > 1 else False

    ocl = [f(r["close"]) for r in oi]
    m["oi_now"] = ocl[-1]
    m["oi_24h_pct"] = pct(ocl[-1], ocl[-2])
    m["oi_7d_pct"] = pct(ocl[-1], ocl[0])

    fcl = [f(r["close"]) for r in funding]
    m["funding_now"] = fcl[-1]
    m["funding_7d_avg"] = sum(fcl) / len(fcl)
    m["funding_delta"] = m["funding_now"] - m["funding_7d_avg"]

    if p1h and len(p1h) >= 5:
        c1 = [f(r["close"]) for r in p1h]
        m["pct_4h"] = pct(c1[-1], c1[-5])
    else:
        m["pct_4h"] = None

    if liq:
        def lrow(r):
            lo = r.get("aggregated_long_liquidation_usd", r.get("long_liquidation_usd"))
            sh = r.get("aggregated_short_liquidation_usd", r.get("short_liquidation_usd"))
            return (float(lo) if lo is not None else None, float(sh) if sh is not None else None)
        rows = [lrow(r) for r in liq]
        last_l, last_s = rows[-1]
        m["long_liqs_24h"] = last_l
        m["short_liqs_24h"] = last_s
        totals = [(l or 0) + (s or 0) for l, s in rows]
        m["liq_24h_total"] = totals[-1]
        m["liq_7d_p75"] = percentile(totals, 75)
        shorts = [s for l, s in rows if s is not None]
        m["short_liqs_7d_p75"] = percentile(shorts, 75) if shorts else None
        m["liqs_4h"] = m["liq_24h_total"] * 4.0 / 24.0
        m["liqs_4h_approx"] = True
    else:
        m["long_liqs_24h"] = m["short_liqs_24h"] = m["liq_24h_total"] = None
        m["liq_7d_p75"] = m["short_liqs_7d_p75"] = m["liqs_4h"] = None
        m["liqs_4h_approx"] = False

    if topls:
        tr = [float(r["top_position_long_short_ratio"]) for r in topls if r.get("top_position_long_short_ratio") is not None]
        if tr:
            m["top_ls_now"] = tr[-1]
            recent_t = tr[-7:]
            m["top_ls_7d_avg"] = sum(recent_t) / len(recent_t)
            m["top_ls_delta_7d"] = tr[-1] - tr[0]
        else:
            m["top_ls_now"] = m["top_ls_7d_avg"] = m["top_ls_delta_7d"] = None
    else:
        m["top_ls_now"] = m["top_ls_7d_avg"] = m["top_ls_delta_7d"] = None

    if basis:
        bc = [float(r["close_basis"]) for r in basis if r.get("close_basis") is not None]
        if bc:
            m["basis_now"] = bc[-1]
            rb = bc[-7:]
            m["basis_7d_avg"] = sum(rb) / len(rb)
        else:
            m["basis_now"] = m["basis_7d_avg"] = None
    else:
        m["basis_now"] = m["basis_7d_avg"] = None

    if taker:
        tk = taker[-1]
        bv = float(tk.get("taker_buy_volume_usd", 0))
        sv = float(tk.get("taker_sell_volume_usd", 0))
        m["taker_buy_pct_24h"] = bv / (bv + sv) * 100.0 if (bv + sv) else None
    else:
        m["taker_buy_pct_24h"] = None

    metrics[a] = m

btc = metrics.get("BTC", {})
for a, m in metrics.items():
    if m.get("dropped"):
        continue
    if btc and not btc.get("dropped"):
        m["pct_24h_vs_btc"] = (m["pct_24h"] - btc["pct_24h"]) if (m["pct_24h"] is not None and btc["pct_24h"] is not None) else None
        m["pct_7d_vs_btc"] = (m["pct_7d"] - btc["pct_7d"]) if (m["pct_7d"] is not None and btc["pct_7d"] is not None) else None
    else:
        m["pct_24h_vs_btc"] = m["pct_7d_vs_btc"] = None


def thresholds(tier):
    if tier == 1:
        return dict(breakout=8, squeeze=5, mom=8, comp=3, dist=0.06, cap_dd=-6, cap_oi=-8)
    return dict(breakout=20, squeeze=10, mom=15, comp=5, dist=0.08, cap_dd=-10, cap_oi=-10)


def classify(m):
    t = thresholds(m["tier"])
    f_now, f_avg = m["funding_now"], m["funding_7d_avg"]
    p24, p7 = m["pct_24h"], m["pct_7d"]
    oi24, oi7 = m["oi_24h_pct"], m["oi_7d_pct"]
    rng, vr, tb = m["range_7d_pct"], m["vol_ratio"], m["taker_buy_pct_24h"]
    liq_t, liq_p75 = m["liq_24h_total"], m["liq_7d_p75"]
    sl, sl_p75 = m["short_liqs_24h"], m["short_liqs_7d_p75"]

    if (p24 is not None and p24 <= t["cap_dd"] and f_now is not None and f_now < 0
            and oi24 is not None and oi24 <= t["cap_oi"]
            and liq_t is not None and liq_p75 is not None and liq_t >= liq_p75):
        return "CAPITULATION"
    if (p24 is not None and p24 > t["squeeze"] and oi24 is not None and oi24 < 0
            and sl is not None and sl_p75 is not None and sl >= sl_p75
            and tb is not None and tb < 52):
        return "SHORT-SQUEEZE"
    if ((f_now is not None and f_now > t["dist"]) or (f_avg is not None and f_avg > 0.06)) \
            and p24 is not None and p7 is not None and p24 < p7 / 7.0 \
            and oi24 is not None and oi24 > 5:
        return "DISTRIBUTION"
    if ((p24 is not None and p24 > t["breakout"]) or m.get("broke_7d_high")) \
            and vr is not None and vr > 2.0 and oi24 is not None and oi24 > 10 \
            and tb is not None and tb > 52:
        return "CATALYST-BREAKOUT"
    if oi7 is not None and oi7 > 10 and f_avg is not None and abs(f_avg) < 0.04 \
            and p7 is not None and p7 > 0 and rng is not None and rng < 25:
        return "ACCUMULATION"
    if p7 is not None and p7 > t["mom"] and oi24 is not None and oi24 >= 0 \
            and f_now is not None and f_now > 0.03 and f_now <= 0.07:
        return "MOMENTUM"
    if rng is not None and rng < t["comp"] and oi7 is not None and oi7 > 5 \
            and f_now is not None and abs(f_now) < 0.02 and p24 is not None and abs(p24) < 2:
        return "COMPRESSION"
    return "NEUTRAL"


def subtags(m, regime):
    tags = []
    tb = m["taker_buy_pct_24h"]
    if regime == "DISTRIBUTION":
        if m["top_ls_now"] is not None and m["top_ls_now"] > 2.0 and m["basis_now"] is not None and m["basis_now"] > 0:
            tags.append("REAL-CROWDED-LONG")
        if m["top_ls_now"] is not None and m["top_ls_now"] < 1.5:
            tags.append("RETAIL-ANOMALY")
        if m["pct_24h"] is not None and m["pct_24h"] < 0 and m["oi_24h_pct"] is not None and m["oi_24h_pct"] >= 0:
            tags.append("LONG-TRAP")
    elif regime == "CAPITULATION":
        if m["liqs_4h"] is not None and m["liq_24h_total"]:
            ratio = m["liqs_4h"] / m["liq_24h_total"]
            if ratio > 0.4:
                tags.append("IN-PROGRESS")
            elif ratio < 0.15:
                tags.append("CLEARED")
    elif regime == "COMPRESSION":
        if m["vol_ratio"] is not None and m["vol_ratio"] > 1.0:
            tags.append("ACTIVE")
        elif m["vol_ratio"] is not None and m["vol_ratio"] < 0.9:
            tags.append("QUIET")
    elif regime == "ACCUMULATION":
        if tb is not None and tb > 50 and m["top_ls_delta_7d"] is not None and m["top_ls_delta_7d"] > 0:
            tags.append("CONFIRMED")
        elif tb is not None and tb < 50:
            tags.append("DIVERGENT")
    elif regime == "CATALYST-BREAKOUT":
        if m["pct_4h"] is not None and m["pct_24h"]:
            r = m["pct_4h"] / m["pct_24h"]
            if r > 0.5:
                tags.append("FRESH")
            elif r < 0.2:
                tags.append("STALE")
    return tags


def pattern_tags(m, regime):
    tags = []
    t = thresholds(m["tier"])
    f_now, tls, basis = m["funding_now"], m["top_ls_now"], m["basis_now"]
    p24, oi24, oi7 = m["pct_24h"], m["oi_24h_pct"], m["oi_7d_pct"]
    rng, fd, tb, dls = m["range_7d_pct"], m["funding_delta"], m["taker_buy_pct_24h"], m["top_ls_delta_7d"]
    sl, sl_p75 = m["short_liqs_24h"], m["short_liqs_7d_p75"]

    rcl = (f_now is not None and f_now > t["dist"] and tls is not None and tls > 2.0
           and basis is not None and basis > 0.3)
    if rcl:
        tags.append("REAL-CROWDED-LONG")
    elif f_now is not None and f_now > t["dist"] and tls is not None and tls < 1.5:
        tags.append("RETAIL-ANOMALY")

    long_trap_funding = (m["tier"] == 2 and f_now is not None and f_now > 0.08) or \
                        (m["tier"] == 1 and f_now is not None and f_now > 0.06)
    if long_trap_funding and p24 is not None and p24 < 0 and oi24 is not None and oi24 >= -3:
        tags.append("LONG-TRAP")

    if dls is not None and dls > 0.4 and rng is not None and rng < 5 and oi7 is not None and oi7 < 5:
        tags.append("STEALTH-POSITIONING")

    if basis is not None and basis > 0.2 and fd is not None and abs(fd) < 0.01 \
            and oi7 is not None and oi7 > 5 and tb is not None and 48 < tb < 52:
        tags.append("CASH-AND-CARRY")

    if regime != "SHORT-SQUEEZE" and m["tier"] == 2 and p24 is not None and p24 > 10 \
            and oi24 is not None and oi24 < 0 and sl is not None and sl_p75 is not None and sl >= sl_p75:
        tags.append("SHORT-SQUEEZE")
    return tags


results = {}
for a, m in metrics.items():
    if m.get("dropped"):
        results[a] = {"dropped": True, "reason": m.get("reason")}
        continue
    regime = classify(m)
    st = subtags(m, regime)
    pt = pattern_tags(m, regime)
    yreg, yrep = YDAY.get(a, (None, 0))
    repeat_days = (yrep + 1) if (yreg == regime and yreg is not None) else 1
    results[a] = {
        "asset": a, "tier": m["tier"], "regime": regime,
        "sub_tags": st, "pattern_tags": pt,
        "yesterday_regime": yreg, "repeat_days": repeat_days, "m": m,
    }

print("=== CLASSIFICATION SUMMARY ===")
cnt = Counter(r["regime"] for r in results.values() if not r.get("dropped"))
print(dict(cnt))
print(f"assessed={sum(1 for r in results.values() if not r.get('dropped'))} dropped={[a for a,r in results.items() if r.get('dropped')]}")
print()
order = ["CAPITULATION", "SHORT-SQUEEZE", "DISTRIBUTION", "CATALYST-BREAKOUT", "ACCUMULATION", "MOMENTUM", "COMPRESSION", "NEUTRAL"]
for reg in order:
    for a, r in results.items():
        if r.get("dropped") or r["regime"] != reg:
            continue
        m = r["m"]
        def g(k, nd=2):
            v = m.get(k)
            return "NA" if v is None else round(v, nd)
        print(f"{reg:16s} {a:9s} T{r['tier']} | 24h={g('pct_24h')} 7d={g('pct_7d')} 4h={g('pct_4h')} "
              f"oi24={g('oi_24h_pct')} oi7={g('oi_7d_pct')} rng={g('range_7d_pct')} vr={g('vol_ratio')} "
              f"fnow={g('funding_now',4)} favg={g('funding_7d_avg',4)} fd={g('funding_delta',4)} tls={g('top_ls_now')} dls={g('top_ls_delta_7d')} "
              f"tb={g('taker_buy_pct_24h')} basis={g('basis_now',4)} liqT={fmt_usd(m.get('liq_24h_total'))} liqP75={fmt_usd(m.get('liq_7d_p75'))} "
              f"shortL={fmt_usd(m.get('short_liqs_24h'))} shortP75={fmt_usd(m.get('short_liqs_7d_p75'))} "
              f"| sub={r['sub_tags']} pat={r['pattern_tags']} y={r['yesterday_regime']} rep={r['repeat_days']}")

with open("/home/runner/work/aeon/aeon/.outputs/_ps_results_0528.json", "w") as fh:
    json.dump(results, fh, indent=2, default=str)
print("\nwrote .outputs/_ps_results_0528.json")

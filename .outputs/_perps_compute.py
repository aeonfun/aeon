#!/usr/bin/env python3
import json, os, sys

CACHE = ".coinglass-cache"
TODAY = "2026-05-26"
TIER1 = {"BTC", "ETH", "SOL"}


def load(name):
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        return None
    try:
        with open(p) as f:
            d = json.load(f)
        return d.get("data") if isinstance(d, dict) else None
    except Exception:
        return None


def fnum(x):
    try:
        return float(x)
    except Exception:
        return None


def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def pctile(xs, q):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    if len(xs) == 1:
        return xs[0]
    pos = q * (len(xs) - 1)
    lo = int(pos)
    frac = pos - lo
    if lo + 1 < len(xs):
        return xs[lo] + frac * (xs[lo + 1] - xs[lo])
    return xs[lo]


manifest = json.load(open(os.path.join(CACHE, "manifest.json")))
assets = manifest["asset_list"]

metrics = {}
dropped = []

for a in assets:
    price = load(f"price-{a}.json")
    oi = load(f"oi-{a}.json")
    funding = load(f"funding-{a}.json")
    if not price or len(price) < 2 or not oi or len(oi) < 2 or not funding:
        dropped.append(a)
        continue
    liq = load(f"liq-{a}.json")
    topls = load(f"topls-{a}.json")
    basis = load(f"basis-{a}.json")
    taker = load(f"taker-{a}.json")
    p1h = load(f"price-1h-{a}.json")

    m = {"asset": a, "tier": 1 if a in TIER1 else 2}

    closes = [fnum(r["close"]) for r in price]
    highs = [fnum(r["high"]) for r in price]
    lows = [fnum(r["low"]) for r in price]
    vols = [fnum(r.get("volume_usd")) for r in price]

    m["current_price"] = closes[-1]
    m["pct_24h"] = (closes[-1] - closes[-2]) / closes[-2] * 100
    p7base = closes[-8] if len(closes) >= 8 else closes[0]
    m["pct_7d"] = (closes[-1] - p7base) / p7base * 100
    prior_vols = [v for v in vols[:-1] if v]
    m["vol_ratio"] = vols[-1] / mean(prior_vols) if vols[-1] and prior_vols else None
    win = price[-7:] if len(price) >= 7 else price
    hi = max(fnum(r["high"]) for r in win)
    lo = min(fnum(r["low"]) for r in win)
    m["range_7d_pct"] = (hi - lo) / lo * 100

    oic = [fnum(r["close"]) for r in oi]
    m["oi_now"] = oic[-1]
    m["oi_24h_pct"] = (oic[-1] - oic[-2]) / oic[-2] * 100
    oi7base = oic[-8] if len(oic) >= 8 else oic[0]
    m["oi_7d_pct"] = (oic[-1] - oi7base) / oi7base * 100

    fc = [fnum(r["close"]) for r in funding]
    m["funding_now"] = fc[-1]
    m["funding_7d_avg"] = mean(fc)
    m["funding_delta"] = m["funding_now"] - m["funding_7d_avg"]

    if liq:
        longs = [fnum(r.get("aggregated_long_liquidation_usd")) for r in liq]
        shorts = [fnum(r.get("aggregated_short_liquidation_usd")) for r in liq]
        totals = [(l or 0) + (s or 0) for l, s in zip(longs, shorts)]
        m["liq_24h_total"] = totals[-1]
        m["liq_7d_p75"] = pctile(totals, 0.75)
        m["long_liqs_24h"] = longs[-1]
        m["short_liqs_24h"] = shorts[-1]
        m["short_liqs_p75"] = pctile(shorts, 0.75)
        m["liqs_4h"] = totals[-1] * 4.0 / 24.0
        m["liqs_4h_approx"] = True
    else:
        for k in ("liq_24h_total", "liq_7d_p75", "long_liqs_24h", "short_liqs_24h", "short_liqs_p75", "liqs_4h"):
            m[k] = None

    if topls:
        tlr = [fnum(r.get("top_position_long_short_ratio")) for r in topls]
        m["top_ls_now"] = tlr[-1]
        m["top_ls_7d_avg"] = mean(tlr[-7:])
        m["top_ls_delta_7d"] = tlr[-1] - (tlr[-8] if len(tlr) >= 8 else tlr[0])
    else:
        m["top_ls_now"] = m["top_ls_7d_avg"] = m["top_ls_delta_7d"] = None

    if basis:
        bc = [fnum(r.get("close_basis")) for r in basis]
        m["basis_now"] = bc[-1]
        m["basis_7d_avg"] = mean(bc[-7:])
    else:
        m["basis_now"] = m["basis_7d_avg"] = None

    if taker:
        tb = fnum(taker[-1].get("taker_buy_volume_usd"))
        ts = fnum(taker[-1].get("taker_sell_volume_usd"))
        m["taker_buy_pct_24h"] = tb / (tb + ts) * 100 if (tb is not None and ts is not None and (tb + ts)) else None
    else:
        m["taker_buy_pct_24h"] = None

    if p1h and len(p1h) >= 5:
        c1 = [fnum(r["close"]) for r in p1h]
        m["pct_4h"] = (c1[-1] - c1[-5]) / c1[-5] * 100
    else:
        m["pct_4h"] = None

    metrics[a] = m

btc = metrics.get("BTC")
for a, m in metrics.items():
    if btc:
        m["pct_24h_vs_btc"] = m["pct_24h"] - btc["pct_24h"]
        m["pct_7d_vs_btc"] = m["pct_7d"] - btc["pct_7d"]
    else:
        m["pct_24h_vs_btc"] = m["pct_7d_vs_btc"] = None

# thresholds
def thr(m):
    t1 = m["tier"] == 1
    return {
        "breakout_pct": 8 if t1 else 20,
        "squeeze_pct": 5 if t1 else 10,
        "mom_7d": 8 if t1 else 15,
        "comp_range": 3 if t1 else 5,
        "dist_funding": 0.06 if t1 else 0.08,
        "cap_drawdown": -6 if t1 else -10,
        "cap_oi": -8 if t1 else -10,
    }


def classify(m):
    t = thr(m)
    p24, p7 = m["pct_24h"], m["pct_7d"]
    fn, fa = m["funding_now"], m["funding_7d_avg"]
    oi24, oi7 = m["oi_24h_pct"], m["oi_7d_pct"]
    vr, rng = m["vol_ratio"], m["range_7d_pct"]
    tb = m["taker_buy_pct_24h"]
    liqt, liqp = m["liq_24h_total"], m["liq_7d_p75"]
    sl, slp = m["short_liqs_24h"], m["short_liqs_p75"]

    # 1 CAPITULATION
    if (p24 <= t["cap_drawdown"] and fn < 0 and oi24 <= t["cap_oi"]
            and liqt is not None and liqp is not None and liqt >= liqp):
        return "CAPITULATION"
    # 2 SHORT-SQUEEZE
    if (sl is not None and slp is not None and tb is not None
            and p24 > t["squeeze_pct"] and oi24 < 0 and sl >= slp and tb < 52):
        return "SHORT-SQUEEZE"
    # 3 DISTRIBUTION
    if ((fn > t["dist_funding"] or fa > 0.06) and p24 < p7 / 7 and oi24 > 5):
        return "DISTRIBUTION"
    # 4 CATALYST-BREAKOUT
    if ((p24 > t["breakout_pct"]) and vr is not None and vr > 2.0
            and oi24 > 10 and tb is not None and tb > 52):
        return "CATALYST-BREAKOUT"
    # 5 ACCUMULATION
    if (oi7 > 10 and abs(fa) < 0.04 and p7 > 0 and rng < 25):
        return "ACCUMULATION"
    # 6 MOMENTUM
    if (p7 > t["mom_7d"] and oi24 >= 0 and fn > 0.03 and fn <= 0.07):
        return "MOMENTUM"
    # 7 COMPRESSION
    if (rng < t["comp_range"] and oi7 > 5 and abs(fn) < 0.02 and abs(p24) < 2):
        return "COMPRESSION"
    return "NEUTRAL"


for a, m in metrics.items():
    m["regime"] = classify(m)

# sub-tags
for a, m in metrics.items():
    subs = []
    r = m["regime"]
    if r == "DISTRIBUTION":
        if m["top_ls_now"] is not None and m["basis_now"] is not None and m["top_ls_now"] > 2.0 and m["basis_now"] > 0:
            subs.append("REAL-CROWDED-LONG")
        if m["top_ls_now"] is not None and m["top_ls_now"] < 1.5:
            subs.append("RETAIL-ANOMALY")
        if m["pct_24h"] < 0 and m["oi_24h_pct"] >= 0:
            subs.append("LONG-TRAP")
    elif r == "CAPITULATION":
        if m["liqs_4h"] is not None and m["liq_24h_total"]:
            ratio = m["liqs_4h"] / m["liq_24h_total"]
            if ratio > 0.4:
                subs.append("IN-PROGRESS")
            elif ratio < 0.15:
                subs.append("CLEARED")
    elif r == "COMPRESSION":
        if m["vol_ratio"] is not None:
            if m["vol_ratio"] > 1.0:
                subs.append("ACTIVE")
            elif m["vol_ratio"] < 0.9:
                subs.append("QUIET")
    elif r == "ACCUMULATION":
        if m["taker_buy_pct_24h"] is not None and m["top_ls_delta_7d"] is not None and m["taker_buy_pct_24h"] > 50 and m["top_ls_delta_7d"] > 0:
            subs.append("CONFIRMED")
        elif m["taker_buy_pct_24h"] is not None and m["taker_buy_pct_24h"] < 50:
            subs.append("DIVERGENT")
    elif r == "CATALYST-BREAKOUT":
        if m["pct_4h"] is not None and m["pct_24h"]:
            rr = m["pct_4h"] / m["pct_24h"]
            if rr > 0.5:
                subs.append("FRESH")
            elif rr < 0.2:
                subs.append("STALE")
    m["sub_tags"] = subs

# pattern tags
for a, m in metrics.items():
    t = thr(m)
    tags = []
    fn = m["funding_now"]
    tln = m["top_ls_now"]
    bn = m["basis_now"]
    rcl = False
    if fn > t["dist_funding"] and tln is not None and tln > 2.0 and bn is not None and bn > 0.3:
        tags.append("REAL-CROWDED-LONG")
        rcl = True
    if not rcl and fn > t["dist_funding"] and tln is not None and tln < 1.5:
        tags.append("RETAIL-ANOMALY")
    lt_thr = 0.06 if m["tier"] == 1 else 0.08
    if fn > lt_thr and m["pct_24h"] < 0 and m["oi_24h_pct"] >= -3:
        tags.append("LONG-TRAP")
    if m["top_ls_delta_7d"] is not None and m["top_ls_delta_7d"] > 0.4 and m["range_7d_pct"] < 5 and m["oi_7d_pct"] < 5:
        tags.append("STEALTH-POSITIONING")
    if (bn is not None and bn > 0.2 and abs(m["funding_delta"]) < 0.01 and m["oi_7d_pct"] > 5
            and m["taker_buy_pct_24h"] is not None and 48 < m["taker_buy_pct_24h"] < 52):
        tags.append("CASH-AND-CARRY")
    if (m["tier"] == 2 and m["short_liqs_24h"] is not None and m["short_liqs_p75"] is not None
            and m["pct_24h"] > 10 and m["oi_24h_pct"] < 0 and m["short_liqs_24h"] >= m["short_liqs_p75"]
            and m["regime"] != "SHORT-SQUEEZE"):
        tags.append("SHORT-SQUEEZE")
    m["pattern_tags"] = tags

out = {"dropped": dropped, "metrics": metrics, "today": TODAY,
       "manifest_fetched_at": manifest.get("fetched_at"),
       "per_coin_errors": manifest.get("per_coin_errors")}
with open(".outputs/_perps_compute.json", "w") as f:
    json.dump(out, f, indent=1, default=str)
print("wrote .outputs/_perps_compute.json; dropped=%s assessed=%d" % (dropped, len(metrics)))

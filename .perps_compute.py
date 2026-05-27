#!/usr/bin/env python3
"""Compute perps-scan v3 metrics + classifications and write .outputs/perps-scan.data.json."""

import json
import re
import sys
from pathlib import Path
from statistics import mean

CACHE = Path(".coinglass-cache")
OUTPUTS = Path(".outputs")
PRIOR_MD = OUTPUTS / "perps-scan.md"
OUT_JSON = OUTPUTS / "perps-scan.data.json"

TIER1 = {"BTC", "ETH", "SOL"}


def load(name):
    p = CACHE / name
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text())
    except Exception:
        return None
    if d.get("code") != "0":
        return None
    return d.get("data") or None


def fnum(v):
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def pctile(values, p):
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


def parse_yesterday_tail(md_path):
    if not md_path.exists():
        return {}, {}
    text = md_path.read_text()
    out_regime = {}
    out_repeat = {}
    asset_re = re.compile(r"^Asset: (\S+) \| Tier: \d+ \| Regime: (\S+)")
    repeat_re = re.compile(r"repeat_days: (-?\d+)")
    cur_asset = None
    for line in text.splitlines():
        m = asset_re.match(line)
        if m:
            cur_asset = m.group(1)
            out_regime[cur_asset] = m.group(2)
            out_repeat[cur_asset] = 1
            continue
        r = repeat_re.search(line)
        if r and cur_asset:
            try:
                out_repeat[cur_asset] = int(r.group(1))
            except Exception:
                pass
    return out_regime, out_repeat


def compute(asset):
    """Return per-asset metric dict or None on must-have-missing."""
    price = load(f"price-{asset}.json")
    oi = load(f"oi-{asset}.json")
    funding = load(f"funding-{asset}.json")
    if not price or not oi or not funding or len(price) < 8 or len(oi) < 8 or len(funding) < 21:
        return None

    liq = load(f"liq-{asset}.json")
    topls = load(f"topls-{asset}.json")
    basis = load(f"basis-{asset}.json")
    taker = load(f"taker-{asset}.json")
    price1h = load(f"price-1h-{asset}.json")

    m = {"asset": asset}

    p0 = fnum(price[0]["close"])
    p1 = fnum(price[1]["close"])
    p7 = fnum(price[7]["close"]) if len(price) > 7 else None
    m["current_price"] = p0
    m["pct_24h"] = (p0 - p1) / p1 * 100 if p1 else None
    m["pct_7d"] = (p0 - p7) / p7 * 100 if p7 else None
    vol0 = fnum(price[0]["volume_usd"])
    vol_hist = [fnum(price[i]["volume_usd"]) for i in range(1, min(8, len(price)))]
    vol_hist = [v for v in vol_hist if v is not None]
    m["vol_ratio"] = vol0 / mean(vol_hist) if vol0 is not None and vol_hist and mean(vol_hist) else None
    highs = [fnum(price[i]["high"]) for i in range(0, min(7, len(price)))]
    lows = [fnum(price[i]["low"]) for i in range(0, min(7, len(price)))]
    highs = [h for h in highs if h is not None]
    lows = [l for l in lows if l is not None]
    if highs and lows and min(lows):
        m["range_7d_pct"] = (max(highs) - min(lows)) / min(lows) * 100
    else:
        m["range_7d_pct"] = None

    oi0 = fnum(oi[0]["close"])
    oi1 = fnum(oi[1]["close"])
    oi7 = fnum(oi[7]["close"]) if len(oi) > 7 else None
    m["oi_now"] = oi0
    m["oi_24h_pct"] = (oi0 - oi1) / oi1 * 100 if oi1 else None
    m["oi_7d_pct"] = (oi0 - oi7) / oi7 * 100 if oi7 else None

    fnow = fnum(funding[0]["close"])
    f7 = [fnum(funding[i]["close"]) for i in range(0, min(21, len(funding)))]
    f7 = [x for x in f7 if x is not None]
    m["funding_now"] = fnow
    m["funding_7d_avg"] = mean(f7) if f7 else None
    m["funding_delta"] = (fnow - m["funding_7d_avg"]) if (fnow is not None and m["funding_7d_avg"] is not None) else None

    if liq and len(liq) >= 8:
        long_now = fnum(liq[0].get("aggregated_long_liquidation_usd"))
        short_now = fnum(liq[0].get("aggregated_short_liquidation_usd"))
        if long_now is None and short_now is None:
            m["long_liqs_24h"] = None
            m["short_liqs_24h"] = None
            m["liq_24h_total"] = fnum(liq[0].get("close"))
        else:
            m["long_liqs_24h"] = long_now
            m["short_liqs_24h"] = short_now
            m["liq_24h_total"] = (long_now or 0) + (short_now or 0)
        liq_hist = []
        for i in range(0, min(8, len(liq))):
            lo = fnum(liq[i].get("aggregated_long_liquidation_usd"))
            sh = fnum(liq[i].get("aggregated_short_liquidation_usd"))
            tot = (lo or 0) + (sh or 0)
            if tot:
                liq_hist.append(tot)
        m["liq_7d_p75"] = pctile(liq_hist, 75) if liq_hist else None
        short_hist = [fnum(liq[i].get("aggregated_short_liquidation_usd")) for i in range(0, min(8, len(liq)))]
        short_hist = [v for v in short_hist if v is not None]
        m["short_liqs_7d_p75"] = pctile(short_hist, 75) if short_hist else None
        m["liqs_4h"] = (m["liq_24h_total"] or 0) * (4.0 / 24.0) if m["liq_24h_total"] else None
        m["liqs_4h_approx"] = True
    else:
        m["long_liqs_24h"] = None
        m["short_liqs_24h"] = None
        m["liq_24h_total"] = None
        m["liq_7d_p75"] = None
        m["short_liqs_7d_p75"] = None
        m["liqs_4h"] = None
        m["liqs_4h_approx"] = False

    if topls and len(topls) >= 7:
        m["top_ls_now"] = fnum(topls[0]["top_position_long_short_ratio"])
        tls7 = [fnum(topls[i]["top_position_long_short_ratio"]) for i in range(0, min(7, len(topls)))]
        tls7 = [v for v in tls7 if v is not None]
        m["top_ls_7d_avg"] = mean(tls7) if tls7 else None
        ls7 = fnum(topls[7]["top_position_long_short_ratio"]) if len(topls) > 7 else None
        m["top_ls_delta_7d"] = (m["top_ls_now"] - ls7) if (ls7 is not None and m["top_ls_now"] is not None) else None
    else:
        m["top_ls_now"] = None
        m["top_ls_7d_avg"] = None
        m["top_ls_delta_7d"] = None

    if basis and len(basis) >= 7:
        m["basis_now"] = fnum(basis[0].get("close_basis"))
        b7 = [fnum(basis[i].get("close_basis")) for i in range(0, min(7, len(basis)))]
        b7 = [v for v in b7 if v is not None]
        m["basis_7d_avg"] = mean(b7) if b7 else None
    else:
        m["basis_now"] = None
        m["basis_7d_avg"] = None

    if taker and len(taker) >= 1:
        tb = fnum(taker[0].get("taker_buy_volume_usd"))
        ts = fnum(taker[0].get("taker_sell_volume_usd"))
        if tb is not None and ts is not None and (tb + ts) > 0:
            m["taker_buy_pct_24h"] = tb / (tb + ts) * 100
        else:
            m["taker_buy_pct_24h"] = None
    else:
        m["taker_buy_pct_24h"] = None

    if price1h and len(price1h) >= 5:
        p1h_0 = fnum(price1h[0]["close"])
        p1h_4 = fnum(price1h[4]["close"])
        m["pct_4h"] = (p1h_0 - p1h_4) / p1h_4 * 100 if p1h_4 else None
    else:
        m["pct_4h"] = None

    m["pct_24h_vs_btc"] = None
    m["pct_7d_vs_btc"] = None

    return m


def thresholds(tier):
    if tier == 1:
        return {
            "cat_breakout_pct": 8,
            "short_sq_pct": 5,
            "momentum_7d": 8,
            "compression_range": 3,
            "dist_funding": 0.06,
            "cap_dd": -6,
            "cap_oi": -8,
        }
    return {
        "cat_breakout_pct": 20,
        "short_sq_pct": 10,
        "momentum_7d": 15,
        "compression_range": 5,
        "dist_funding": 0.08,
        "cap_dd": -10,
        "cap_oi": -10,
    }


def classify(m, tier):
    T = thresholds(tier)
    sub = []

    pct24 = m.get("pct_24h")
    pct7 = m.get("pct_7d")
    pct4 = m.get("pct_4h")
    oi24 = m.get("oi_24h_pct")
    oi7 = m.get("oi_7d_pct")
    fnow = m.get("funding_now")
    favg = m.get("funding_7d_avg")
    liqtot = m.get("liq_24h_total")
    liqp75 = m.get("liq_7d_p75")
    sliq = m.get("short_liqs_24h")
    sliq_p75 = m.get("short_liqs_7d_p75")
    rng = m.get("range_7d_pct")
    tls = m.get("top_ls_now")
    tls_d7 = m.get("top_ls_delta_7d")
    basn = m.get("basis_now")
    tbuy = m.get("taker_buy_pct_24h")
    vol = m.get("vol_ratio")

    if (pct24 is not None and pct24 <= T["cap_dd"]
        and fnow is not None and fnow < 0
        and oi24 is not None and oi24 <= T["cap_oi"]
        and liqtot is not None and liqp75 is not None and liqtot >= liqp75):
        regime = "CAPITULATION"
        if liqtot and m.get("liqs_4h") is not None:
            ratio = m["liqs_4h"] / liqtot
            if ratio > 0.40:
                sub.append("IN-PROGRESS")
            elif ratio < 0.15:
                sub.append("CLEARED")
        return regime, sub

    if (pct24 is not None and pct24 > T["short_sq_pct"]
        and oi24 is not None and oi24 < 0
        and sliq is not None and sliq_p75 is not None and sliq >= sliq_p75
        and tbuy is not None and tbuy < 52):
        return "SHORT-SQUEEZE", []

    funding_trigger = (fnow is not None and fnow > T["dist_funding"]) or (favg is not None and favg > 0.06)
    gains_slowing = (pct24 is not None and pct7 is not None and pct24 < (pct7 / 7))
    oi_up = (oi24 is not None and oi24 > 5)
    if funding_trigger and gains_slowing and oi_up:
        regime = "DISTRIBUTION"
        if tls is not None and tls > 2.0 and basn is not None and basn > 0:
            sub.append("REAL-CROWDED-LONG")
        if tls is not None and tls < 1.5:
            sub.append("RETAIL-ANOMALY")
        if pct24 is not None and pct24 < 0 and oi24 is not None and oi24 >= 0:
            sub.append("LONG-TRAP")
        return regime, sub

    cat_pct_match = (pct24 is not None and pct24 > T["cat_breakout_pct"])
    if (cat_pct_match
        and vol is not None and vol > 2.0
        and oi24 is not None and oi24 > 10
        and tbuy is not None and tbuy > 52):
        regime = "CATALYST-BREAKOUT"
        if pct4 is not None and pct24 is not None and pct24 != 0:
            r = pct4 / pct24
            if r > 0.5:
                sub.append("FRESH")
            elif r < 0.2:
                sub.append("STALE")
        return regime, sub

    if (oi7 is not None and oi7 > 10
        and favg is not None and abs(favg) < 0.04
        and pct7 is not None and pct7 > 0
        and rng is not None and rng < 25):
        regime = "ACCUMULATION"
        if tbuy is not None and tbuy > 50 and tls_d7 is not None and tls_d7 > 0:
            sub.append("CONFIRMED")
        elif tbuy is not None and tbuy < 50:
            sub.append("DIVERGENT")
        return regime, sub

    if (pct7 is not None and pct7 > T["momentum_7d"]
        and oi24 is not None and oi24 >= 0
        and fnow is not None and 0.03 < fnow <= 0.07):
        return "MOMENTUM", []

    if (rng is not None and rng < T["compression_range"]
        and oi7 is not None and oi7 > 5
        and fnow is not None and abs(fnow) < 0.02
        and pct24 is not None and abs(pct24) < 2):
        regime = "COMPRESSION"
        if vol is not None and vol > 1.0:
            sub.append("ACTIVE")
        elif vol is not None and vol < 0.9:
            sub.append("QUIET")
        return regime, sub

    return "NEUTRAL", []


def pattern_tags(m, tier, regime):
    T = thresholds(tier)
    tags = []
    fnow = m.get("funding_now")
    tls = m.get("top_ls_now")
    tls_d7 = m.get("top_ls_delta_7d")
    basn = m.get("basis_now")
    fdelta = m.get("funding_delta")
    pct24 = m.get("pct_24h")
    oi24 = m.get("oi_24h_pct")
    oi7 = m.get("oi_7d_pct")
    rng = m.get("range_7d_pct")
    tbuy = m.get("taker_buy_pct_24h")
    sliq = m.get("short_liqs_24h")
    sliq_p75 = m.get("short_liqs_7d_p75")

    rcl = False
    if (fnow is not None and fnow > T["dist_funding"]
        and tls is not None and tls > 2.0
        and basn is not None and basn > 0.3):
        tags.append("REAL-CROWDED-LONG")
        rcl = True
    if not rcl and fnow is not None and fnow > T["dist_funding"] and tls is not None and tls < 1.5:
        tags.append("RETAIL-ANOMALY")
    long_trap_funding = (tier == 2 and fnow is not None and fnow > 0.08) or (tier == 1 and fnow is not None and fnow > 0.06)
    if long_trap_funding and pct24 is not None and pct24 < 0 and oi24 is not None and oi24 >= -3:
        tags.append("LONG-TRAP")
    if (tls_d7 is not None and tls_d7 > 0.4
        and rng is not None and rng < 5
        and oi7 is not None and oi7 < 5):
        tags.append("STEALTH-POSITIONING")
    if (basn is not None and basn > 0.2
        and fdelta is not None and abs(fdelta) < 0.01
        and oi7 is not None and oi7 > 5
        and tbuy is not None and 48 < tbuy < 52):
        tags.append("CASH-AND-CARRY")
    if (regime != "SHORT-SQUEEZE"
        and pct24 is not None and pct24 > 10
        and oi24 is not None and oi24 < 0
        and sliq is not None and sliq_p75 is not None and sliq >= sliq_p75):
        tags.append("SHORT-SQUEEZE")
    return tags


def fmt_money(v):
    if v is None:
        return "—"
    av = abs(v)
    if av >= 1e9:
        return f"${v / 1e9:.2f}B"
    if av >= 1e6:
        return f"${v / 1e6:.1f}M"
    if av >= 1e3:
        return f"${v / 1e3:.0f}K"
    return f"${v:.0f}"


def fmt_price(v):
    if v is None:
        return "—"
    av = abs(v)
    if av >= 10000:
        return f"${v:,.1f}"
    if av >= 100:
        return f"${v:,.2f}"
    if av >= 1:
        return f"${v:.3f}"
    return f"${v:.5f}"


def rnum(v, places=2):
    if v is None:
        return None
    try:
        return round(v, places)
    except Exception:
        return None


def fmt_funding(v):
    if v is None:
        return "—"
    sign = "+" if v >= 0 else ""
    return f"{sign}{v:.4f}%/8h"


def fmt_basis(v):
    if v is None:
        return "—"
    sign = "+" if v >= 0 else ""
    return f"{sign}{v:.4f}%"


def fmt_pct(v, places=2):
    if v is None:
        return "—"
    sign = "+" if v >= 0 else ""
    return f"{sign}{v:.{places}f}%"


def build_metrics_line(a, m, regime, sub):
    if regime == "ACCUMULATION":
        return (f"OI {fmt_pct(m['oi_7d_pct'])} 7d on {fmt_pct(m['pct_7d'])} price, "
                f"funding {fmt_funding(m['funding_now'])} (7d avg {fmt_funding(m['funding_7d_avg'])}), "
                f"top L/S {m['top_ls_now']:.2f} (Δ {fmt_pct(m['top_ls_delta_7d'])} 7d), "
                f"range {m['range_7d_pct']:.2f}%, "
                f"taker buy {m['taker_buy_pct_24h']:.2f}%, "
                f"basis {fmt_basis(m['basis_now'])}")
    if regime in ("CATALYST-BREAKOUT", "SHORT-SQUEEZE"):
        return (f"{fmt_pct(m['pct_24h'])} 24h on {fmt_pct(m['pct_4h'])} 4h, "
                f"OI {fmt_pct(m['oi_24h_pct'])} 24h, vol {m['vol_ratio']:.2f}x, "
                f"taker buy {m['taker_buy_pct_24h']:.2f}%, "
                f"funding {fmt_funding(m['funding_now'])}")
    if regime == "MOMENTUM":
        return (f"{fmt_pct(m['pct_7d'])} 7d, funding {fmt_funding(m['funding_now'])}, "
                f"OI {fmt_pct(m['oi_24h_pct'])} 24h, top L/S {m['top_ls_now']:.2f}")
    if regime == "COMPRESSION":
        return (f"range {m['range_7d_pct']:.2f}% 7d, OI {fmt_pct(m['oi_7d_pct'])} 7d, "
                f"funding {fmt_funding(m['funding_now'])}, vol {m['vol_ratio']:.2f}x")
    if regime == "DISTRIBUTION":
        return (f"funding {fmt_funding(m['funding_now'])} (7d avg {fmt_funding(m['funding_7d_avg'])}), "
                f"OI {fmt_pct(m['oi_24h_pct'])} 24h on {fmt_pct(m['pct_24h'])} 24h, "
                f"top L/S {m['top_ls_now']:.2f}, basis {fmt_basis(m['basis_now'])}")
    if regime == "CAPITULATION":
        return (f"{fmt_pct(m['pct_24h'])} 24h on {fmt_pct(m['pct_4h'])} 4h, "
                f"OI {fmt_pct(m['oi_24h_pct'])} 24h, "
                f"liq {fmt_money(m['liq_24h_total'])} vs 7d p75 {fmt_money(m['liq_7d_p75'])}, "
                f"funding {fmt_funding(m['funding_now'])}")
    return ""


def metrics_watch_line(m):
    parts = []
    parts.append(f"{fmt_pct(m['pct_24h'])} 24h")
    parts.append(f"{fmt_pct(m['pct_7d'])} 7d")
    parts.append(f"OI {fmt_pct(m['oi_24h_pct'])} 24h on OI {fmt_pct(m['oi_7d_pct'])} 7d")
    parts.append(f"funding {fmt_funding(m['funding_now'])} (7d avg {fmt_funding(m['funding_7d_avg'])}, delta {fmt_funding(m['funding_delta'])})")
    if m['taker_buy_pct_24h'] is not None:
        parts.append(f"taker buy {m['taker_buy_pct_24h']:.2f}%")
    parts.append(f"liq {fmt_money(m['liq_24h_total'])} vs 7d p75 {fmt_money(m['liq_7d_p75'])}")
    if m['top_ls_now'] is not None and m['top_ls_delta_7d'] is not None:
        parts.append(f"top L/S {m['top_ls_now']:.2f} (Δ {fmt_pct(m['top_ls_delta_7d'])} 7d)")
    if m['basis_now'] is not None:
        parts.append(f"basis {fmt_basis(m['basis_now'])}")
    if m['pct_4h'] is not None:
        parts.append(f"pct_4h {fmt_pct(m['pct_4h'])}")
    if m['vol_ratio'] is not None:
        parts.append(f"vol {m['vol_ratio']:.2f}x")
    return ", ".join(parts)


def main():
    manifest = json.loads((CACHE / "manifest.json").read_text())
    if not manifest.get("universe_ok"):
        OUT_JSON.write_text(json.dumps({
            "date": manifest.get("fetched_at", "")[:10] or "unknown",
            "edge_case": "prefetch_failed",
        }, indent=2))
        return 0

    asset_list = manifest["asset_list"]
    today = manifest["fetched_at"][:10]

    yest_regime, yest_repeat = parse_yesterday_tail(PRIOR_MD)

    btc_m = compute("BTC")
    if not btc_m:
        sys.stderr.write("BTC compute failed — cannot derive vs-BTC fields\n")
        return 2

    assets = {}
    dropped = []
    for a in asset_list:
        m = compute(a)
        if m is None:
            dropped.append(a)
            continue
        if btc_m["pct_24h"] is not None and m["pct_24h"] is not None:
            m["pct_24h_vs_btc"] = m["pct_24h"] - btc_m["pct_24h"]
        if btc_m["pct_7d"] is not None and m["pct_7d"] is not None:
            m["pct_7d_vs_btc"] = m["pct_7d"] - btc_m["pct_7d"]
        assets[a] = m

    regime_today = {}
    sub_today = {}
    pat_today = {}
    for a, m in assets.items():
        tier = 1 if a in TIER1 else 2
        r, sub = classify(m, tier)
        regime_today[a] = r
        sub_today[a] = sub
        pat_today[a] = pattern_tags(m, tier, r)

    counts = {}
    for r in regime_today.values():
        counts[r] = counts.get(r, 0) + 1

    acc = counts.get("ACCUMULATION", 0)
    mom = counts.get("MOMENTUM", 0)
    dist = counts.get("DISTRIBUTION", 0)
    cap = counts.get("CAPITULATION", 0)
    cat = counts.get("CATALYST-BREAKOUT", 0)
    comp = counts.get("COMPRESSION", 0)
    neu = counts.get("NEUTRAL", 0)
    total = len(assets)
    rcl_count = sum(1 for a in pat_today if "REAL-CROWDED-LONG" in pat_today[a])

    if neu >= 0.8 * total:
        word = "QUIET"
    elif cap >= 2:
        word = "DELEVERAGING"
    elif dist >= 3 and rcl_count >= 3:
        word = "CROWDED TOPPING"
    elif dist >= 3:
        word = "CROWDED LONG"
    elif cat >= 3:
        word = "BREAKOUTS ACTIVE"
    elif mom >= 4:
        word = "TRENDING"
    elif comp >= 4:
        word = "COILING"
    elif (acc + mom) >= 4 and dist == 0 and cap == 0:
        word = "LEVERAGE BUILDING"
    else:
        word = "MIXED"

    regime_changes = None
    if yest_regime:
        regime_changes = []
        for a in assets:
            if a in yest_regime and yest_regime[a] != regime_today[a]:
                regime_changes.append({
                    "asset": a,
                    "from": yest_regime[a],
                    "to": regime_today[a],
                    "note": None,
                })
            elif a not in yest_regime:
                regime_changes.append({
                    "asset": a,
                    "from": "(new entrant)",
                    "to": regime_today[a],
                    "note": None,
                })

    repeat_days = {}
    for a in assets:
        if a in yest_regime and yest_regime[a] == regime_today[a]:
            repeat_days[a] = yest_repeat.get(a, 1) + 1
        else:
            repeat_days[a] = 1

    REGIME_ORDER = ["ACCUMULATION", "CATALYST-BREAKOUT", "SHORT-SQUEEZE", "MOMENTUM", "COMPRESSION", "DISTRIBUTION", "CAPITULATION"]
    regimes_out = {r: [] for r in REGIME_ORDER}

    for a, m in assets.items():
        r = regime_today[a]
        if r == "NEUTRAL":
            continue
        tier = 1 if a in TIER1 else 2
        days = repeat_days[a]
        marker = "star" if days >= 3 else "bullet"
        suffix = f"(day {days})" if days >= 2 else None
        tags = []
        for s in sub_today[a]:
            tags.append({"tag": f"{r} · {s}"})
        for p in pat_today[a]:
            tags.append({"tag": p})
        regimes_out[r].append({
            "asset": a,
            "tier": tier,
            "marker": marker,
            "repeat_days_suffix": suffix,
            "metrics_line": build_metrics_line(a, m, r, sub_today[a]),
            "tags": tags,
        })

    nonzero = []
    for r in REGIME_ORDER:
        c = counts.get(r, 0)
        if c > 0:
            nonzero.append(f"{c} {r}")
    if nonzero:
        dist_sent = f"{', '.join(nonzero)} across {total} assessed, {neu} NEUTRAL."
    else:
        dist_sent = f"All {total} assessed sit NEUTRAL."

    accum_assets = [a for a in regime_today if regime_today[a] == "ACCUMULATION"]
    cap_assets = [a for a in regime_today if regime_today[a] == "CAPITULATION"]

    watch_candidates = []
    for a, m in assets.items():
        if regime_today[a] != "NEUTRAL":
            continue
        tier = 1 if a in TIER1 else 2
        T = thresholds(tier)
        score = 0
        reasons = []
        if m.get("pct_24h") is not None and m.get("oi_24h_pct") is not None:
            if m["pct_24h"] > T["cat_breakout_pct"] * 0.6 and m["oi_24h_pct"] > 5:
                score += 1
                reasons.append("cat-breakout-near")
        if m.get("pct_24h") is not None and m["pct_24h"] > T["short_sq_pct"]:
            score += 1
            reasons.append("squeeze-price-near")
        if m.get("pct_24h") is not None and m["pct_24h"] <= T["cap_dd"]:
            score += 1
            reasons.append("cap-dd-near")
        if m.get("pct_7d") is not None and m["pct_7d"] > T["momentum_7d"]:
            score += 1
            reasons.append("momentum-near")
        if m.get("funding_now") is not None and m["funding_now"] > T["dist_funding"] * 0.7:
            score += 1
            reasons.append("dist-funding-near")
        if m.get("oi_7d_pct") is not None and m["oi_7d_pct"] > 10 and m.get("pct_7d") is not None and m["pct_7d"] > 0:
            score += 1
            reasons.append("accum-near")
        if score:
            watch_candidates.append((score, a, m, reasons))

    watch_candidates.sort(key=lambda x: (-x[0], -(x[2].get("oi_7d_pct") or 0)))
    watch = []
    for sc, a, m, reasons in watch_candidates[:5]:
        tier = 1 if a in TIER1 else 2
        T = thresholds(tier)
        parts = []
        if "cap-dd-near" in reasons:
            blockers = []
            if m.get("funding_now") is not None and m["funding_now"] >= 0:
                blockers.append(f"funding {fmt_funding(m['funding_now'])} fails the funding < 0 gate")
            if m.get("oi_24h_pct") is not None and m["oi_24h_pct"] > T["cap_oi"]:
                blockers.append(f"OI {fmt_pct(m['oi_24h_pct'])} 24h fails the {T['cap_oi']}% OI gate")
            if m.get("liq_24h_total") is not None and m.get("liq_7d_p75") is not None and m["liq_24h_total"] < m["liq_7d_p75"]:
                ratio = m["liq_24h_total"] / m["liq_7d_p75"] * 100
                blockers.append(f"liq {fmt_money(m['liq_24h_total'])} sits at {ratio:.0f}% of the 7d p75 flush threshold")
            if blockers:
                parts.append(f"Pct_24h {fmt_pct(m['pct_24h'])} clears the {T['cap_dd']}% drawdown gate, but {', and '.join(blockers)}.")
            parts.append("A second leg past the drawdown gate with funding flipping negative fires CAPITULATION.")
        if "squeeze-price-near" in reasons:
            if m.get("oi_24h_pct") is not None and m["oi_24h_pct"] >= 0:
                parts.append(f"Pct_24h {fmt_pct(m['pct_24h'])} clears the SHORT-SQUEEZE price gate, but OI {fmt_pct(m['oi_24h_pct'])} 24h fails the OI < 0 requirement.")
            if m.get("vol_ratio") is not None and m["vol_ratio"] < 2.0:
                gap_vol = 2.0 - m["vol_ratio"]
                parts.append(f"Vol {m['vol_ratio']:.2f}x sits {gap_vol:.2f}x under the 2.0x CATALYST-BREAKOUT floor.")
        if "cat-breakout-near" in reasons:
            blockers = []
            if m.get("pct_24h") is not None and m["pct_24h"] <= T["cat_breakout_pct"]:
                gap = T["cat_breakout_pct"] - m["pct_24h"]
                blockers.append(f"pct_24h {fmt_pct(m['pct_24h'])} sits {gap:.2f}pp under the Tier {tier} +{T['cat_breakout_pct']}% gate")
            if m.get("vol_ratio") is not None and m["vol_ratio"] <= 2.0:
                blockers.append(f"vol {m['vol_ratio']:.2f}x sits under the 2.0x floor")
            if m.get("taker_buy_pct_24h") is not None and m["taker_buy_pct_24h"] <= 52:
                blockers.append(f"taker buy {m['taker_buy_pct_24h']:.2f}% sits under the 52% floor")
            if blockers:
                parts.append(f"Breakout setup forming with {', and '.join(blockers)}.")
        if "momentum-near" in reasons:
            band_high = 0.07
            band_low = 0.03
            if m.get("funding_now") is not None and not (band_low < m["funding_now"] <= band_high):
                parts.append(f"Pct_7d {fmt_pct(m['pct_7d'])} clears the trend gate, but funding {fmt_funding(m['funding_now'])} sits outside the +{band_low:.2f} to +{band_high:.2f}%/8h band.")
        if "dist-funding-near" in reasons:
            if m.get("funding_now") is not None and m["funding_now"] <= T["dist_funding"]:
                gap = T["dist_funding"] - m["funding_now"]
                parts.append(f"Funding {fmt_funding(m['funding_now'])} sits {gap:.4f}pp short of the Tier {tier} +{T['dist_funding']}% DISTRIBUTION trigger.")
        if "accum-near" in reasons:
            blockers = []
            if m.get("range_7d_pct") is not None and m["range_7d_pct"] >= 25:
                blockers.append(f"range {m['range_7d_pct']:.2f}% over the 25% cap")
            if m.get("funding_7d_avg") is not None and abs(m["funding_7d_avg"]) >= 0.04:
                blockers.append(f"funding 7d avg {fmt_funding(m['funding_7d_avg'])} over the 0.04% band")
            if blockers:
                parts.append(f"OI {fmt_pct(m['oi_7d_pct'])} 7d on {fmt_pct(m['pct_7d'])} 7d sits inside the ACCUMULATION OI gate, blocked on {', and '.join(blockers)}.")

        if not parts:
            parts = ["Edge case near regime thresholds with no clean single read."]
        watch.append({
            "asset": a,
            "metrics_line": metrics_watch_line(m),
            "transition_read": " ".join(parts),
        })

    cycle_sentences = []
    if accum_assets:
        all_div = all("DIVERGENT" in sub_today[a] for a in accum_assets)
        if all_div:
            cycle_sentences.append(f"{len(accum_assets)} ACCUMULATION prints carry the DIVERGENT sub-tag across {', '.join(accum_assets)}.")
            cycle_sentences.append("Taker buy under 50% on every print means passive OI build, not buyers crossing the spread.")
        else:
            cycle_sentences.append(f"{len(accum_assets)} ACCUMULATION prints across {', '.join(accum_assets)}, sub-tags split between DIVERGENT and CONFIRMED.")
    if cap_assets:
        cycle_sentences.append(f"CAPITULATION fires on {', '.join(cap_assets)}.")
    if not cycle_sentences:
        cycle_sentences.append("Chop phase holds across the universe.")
        cycle_sentences.append("No leverage building, no flush in progress, no narrative coiling into a setup.")
    cycle = " ".join(cycle_sentences)

    fwd_parts = []
    for a in accum_assets:
        if "DIVERGENT" in sub_today[a]:
            fwd_parts.append(f"{a} ACCUMULATION advances to CONFIRMED if taker buy clears 50% with top L/S rotating up.")
    for sc, asset_a, ma, rea in watch_candidates[:3]:
        if "squeeze-price-near" in rea and ma.get("oi_24h_pct") is not None and ma["oi_24h_pct"] >= 0:
            fwd_parts.append(f"{asset_a} SHORT-SQUEEZE fires if OI rolls negative against the price gate already clear.")
        if "cat-breakout-near" in rea:
            fwd_parts.append(f"{asset_a} CATALYST-BREAKOUT fires if vol clears 2.0x with taker buy past 52% on continued pct_24h strength.")
        if "cap-dd-near" in rea:
            fwd_parts.append(f"{asset_a} CAPITULATION fires on a second leg past the drawdown gate with funding flipping negative.")
    forward = " ".join(fwd_parts[:4]) if fwd_parts else "Watch funding shifts on majors and rotation through the ACCUMULATION OI gate."

    neutral_summary = f"Neutral · {neu} other assets · see artifact tail for full data" if neu else None

    tail = []
    for a, m in assets.items():
        tier = 1 if a in TIER1 else 2
        ms = {
            "price": fmt_price(m["current_price"]),
            "pct_24h": rnum(m["pct_24h"]),
            "pct_7d": rnum(m["pct_7d"]),
            "pct_4h": rnum(m["pct_4h"]),
            "range_7d": f"{m['range_7d_pct']:.2f}%" if m["range_7d_pct"] is not None else "—",
            "pct_24h_vs_btc": rnum(m["pct_24h_vs_btc"]),
            "pct_7d_vs_btc": rnum(m["pct_7d_vs_btc"]),
            "oi_usd": fmt_money(m["oi_now"]),
            "oi_24h_pct": rnum(m["oi_24h_pct"]),
            "oi_7d_pct": rnum(m["oi_7d_pct"]),
            "funding_now": rnum(m["funding_now"], 4),
            "funding_7d_avg": rnum(m["funding_7d_avg"], 4),
            "funding_delta": rnum(m["funding_delta"], 4),
            "liq_24h": fmt_money(m["liq_24h_total"]),
            "liq_7d_p75": fmt_money(m["liq_7d_p75"]),
            "long_liqs": fmt_money(m["long_liqs_24h"]),
            "short_liqs": fmt_money(m["short_liqs_24h"]),
            "liqs_4h": fmt_money(m["liqs_4h"]),
            "top_ls": rnum(m["top_ls_now"]),
            "top_ls_7d_avg": rnum(m["top_ls_7d_avg"]),
            "top_ls_delta_7d": rnum(m["top_ls_delta_7d"]),
            "basis": rnum(m["basis_now"], 4),
            "taker_buy": rnum(m["taker_buy_pct_24h"]),
        }
        tail.append({
            "asset": a,
            "tier": tier,
            "regime": regime_today[a],
            "sub_tags": sub_today[a],
            "pattern_tags": pat_today[a],
            "metrics": ms,
            "yesterday_regime": yest_regime.get(a),
            "repeat_days": repeat_days[a],
        })

    data = {
        "date": today,
        "edge_case": None,
        "verdict": {
            "word": word,
            "distribution": dist_sent,
            "cycle": cycle,
            "forward": forward,
        },
        "regime_changes": regime_changes,
        "regimes": regimes_out,
        "regime_empty_notes": {},
        "watch": watch,
        "neutral_summary": neutral_summary,
        "tail": tail,
    }

    OUT_JSON.write_text(json.dumps(data, indent=2, default=str))
    print(f"Wrote {OUT_JSON} — {total} assessed, dropped {dropped}")
    print(f"Counts: {counts}")
    print(f"Verdict: {word}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
fresh against the current cache state. Replaces stale hardcoded prose from
the Node build script for the 2026-05-23 re-run.
"""
import json
from pathlib import Path

TODAY = "2026-05-23"

REGIME_ORDER = [
    "ACCUMULATION", "CATALYST-BREAKOUT", "SHORT-SQUEEZE",
    "MOMENTUM", "COMPRESSION", "DISTRIBUTION", "CAPITULATION",
]

YESTERDAY = {
    "BTC": "NEUTRAL", "ETH": "NEUTRAL", "SOL": "NEUTRAL",
    "HYPE": "NEUTRAL", "NEAR": "NEUTRAL", "ZEC": "NEUTRAL", "EDEN": "NEUTRAL",
    "XRP": "NEUTRAL", "BEAT": "NEUTRAL", "DOGE": "NEUTRAL", "BSB": "NEUTRAL",
    "SUI": "NEUTRAL", "ONDO": "NEUTRAL", "FIDA": "NEUTRAL", "WLD": "NEUTRAL",
    "BNB": "NEUTRAL", "BILL": "NEUTRAL", "TON": "NEUTRAL", "ADA": "NEUTRAL",
    "TAO": "NEUTRAL", "LINK": "NEUTRAL",
}

def fmt_usd(x):
    if x is None: return "—"
    a = abs(x)
    if a >= 1e9: return f"${x/1e9:.2f}B"
    if a >= 1e6: return f"${x/1e6:.1f}M"
    if a >= 1e3: return f"${x/1e3:.0f}K"
    return f"${x:.0f}"

def fmt_price(x):
    if x is None: return "—"
    if x >= 1000: return f"${x:,.1f}"
    if x >= 1:    return f"${x:.3f}"
    return f"${x:.4f}"

def pct(x, d=2):
    if x is None: return "—"
    return f"{x:+.{d}f}%"

def rnd(x, d):
    if x is None: return None
    try: return round(float(x), d)
    except: return None

def main():
    compute = json.loads(Path(".outputs/_perps_compute.json").read_text())
    metrics = compute["metrics"]
    assets = list(metrics.keys())

    by_regime = {r: [] for r in REGIME_ORDER}
    neutral_assets = []
    for asset in assets:
        m = metrics[asset]
        r = m["regime"]
        if r == "NEUTRAL":
            neutral_assets.append(asset)
        elif r in by_regime:
            by_regime[r].append(asset)

    regimes = {r: [] for r in REGIME_ORDER}
    for r, asset_list in by_regime.items():
        for asset in asset_list:
            m = metrics[asset]
            regimes[r].append({
                "asset": asset,
                "tier": m["tier"],
                "marker": "bullet",
                "repeat_days_suffix": None,
                "metrics_line": build_metrics_line(asset, m),
                "tags": [],
            })

    transitions = []
    for asset in assets:
        prior = YESTERDAY.get(asset)
        current = metrics[asset]["regime"]
        if prior is not None and prior != current:
            transitions.append({
                "asset": asset,
                "from": prior,
                "to": current,
                "note": transition_note(asset, prior, current, metrics[asset]),
            })

    watch_candidates = ["EDEN", "BEAT", "FIDA", "ALT", "GENIUS", "NEAR", "HYPE"]
    watch = []
    for asset in watch_candidates:
        if asset not in metrics: continue
        if metrics[asset]["regime"] != "NEUTRAL": continue
        m = metrics[asset]
        watch.append({
            "asset": asset,
            "metrics_line": build_watch_metric(asset, m),
            "transition_read": build_watch_read(asset, m),
        })

    tail = []
    for asset in assets:
        m = metrics[asset]
        tail.append({
            "asset": asset,
            "tier": m["tier"],
            "regime": m["regime"],
            "sub_tags": m.get("sub_tags", []),
            "pattern_tags": m.get("pattern_tags", []),
            "metrics": {
                "price": fmt_price(m.get("current_price")),
                "pct_24h": rnd(m.get("pct_24h"), 2),
                "pct_7d":  rnd(m.get("pct_7d"), 2),
                "pct_4h":  rnd(m.get("pct_4h"), 2),
                "range_7d": f"{m['range_7d_pct']:.2f}%" if m.get("range_7d_pct") is not None else "—",
                "pct_24h_vs_btc": rnd(m.get("pct_24h_vs_btc"), 2),
                "pct_7d_vs_btc":  rnd(m.get("pct_7d_vs_btc"), 2),
                "oi_usd": fmt_usd(m.get("oi_now")),
                "oi_24h_pct": rnd(m.get("oi_24h_pct"), 2),
                "oi_7d_pct":  rnd(m.get("oi_7d_pct"), 2),
                "funding_now":    rnd(m.get("funding_now"), 4),
                "funding_7d_avg": rnd(m.get("funding_7d_avg"), 4),
                "funding_delta":  rnd(m.get("funding_delta"), 4),
                "liq_24h":    fmt_usd(m.get("liq_24h_total")),
                "liq_7d_p75": fmt_usd(m.get("liq_7d_p75")),
                "long_liqs":  fmt_usd(m.get("long_liqs_24h")),
                "short_liqs": fmt_usd(m.get("short_liqs_24h")),
                "liqs_4h":    fmt_usd(m.get("liqs_4h")),
                "top_ls":          rnd(m.get("top_ls_now"), 2),
                "top_ls_7d_avg":   rnd(m.get("top_ls_7d_avg"), 2),
                "top_ls_delta_7d": rnd(m.get("top_ls_delta_7d"), 2),
                "basis":     rnd(m.get("basis_now"), 4),
                "taker_buy": rnd(m.get("taker_buy_pct_24h"), 2),
            },
            "yesterday_regime": YESTERDAY.get(asset),
            "repeat_days": 2 if YESTERDAY.get(asset) == m["regime"] else 1,
        })

    n_total = len(assets)
    n_neutral = len(neutral_assets)
    classified = n_total - n_neutral

    parts = []
    for r in REGIME_ORDER:
        c = len(by_regime[r])
        if c > 0:
            parts.append(f"{c} {r}")
    parts.append(f"{n_neutral} NEUTRAL")
    distribution = f"{', '.join(parts)} across {n_total} assessed on the 06:31Z prefetch."

    word = "MIXED" if classified > 0 else "QUIET"

    cycle = (
        "BSB cleared the +0.08% Tier 2 funding gate today and the gains-slowing gate flipped as pct_24h cooled to +23.37% under pct_7d/7 of +23.83%. "
        "Top L/S 1.94 down 0.57 over 7d reads as smart money exiting into retail leverage during the OI build. "
        "EDEN held a -12.79% drawdown on funding -0.266%/8h and OI -19.44%, but liq $739K against a 7d p75 $2.13M kept CAPITULATION blocked. "
        "BEAT slipped to -6.63% 24h with liq $1.41M past the p75 and pct_4h -13.51% — yesterday's CAT-BREAKOUT print has rolled into back-to-back red days."
    )

    forward = (
        "BSB is the only regime print today. A second-day flat-to-red with funding holding above +0.08% extends the DISTRIBUTION read. "
        "EDEN sits one tick from CAPITULATION — another -10% day with liq printing through $2.1M fires the regime. "
        "ALT carries an extreme cash-and-carry shape (basis +2.58%, funding -0.308%/8h, OI 7d +256%, taker buy 52.7%) — pattern not regime, but worth a check on the next 8h funding tick. "
        "Vol ratio sits 0.05-2.11 against the 2.0 CATALYST-BREAKOUT floor; the 06:31Z prefetch caught a partial day, breakout signals likely understate."
    )

    verdict = {"word": word, "distribution": distribution, "cycle": cycle, "forward": forward}

    regime_empty_notes = {
        "ACCUMULATION": "HYPE +32.00% 7d / OI +43.04% 7d sits at range 51.57%, blocked by the 25% range gate. NEAR +37.57% 7d / OI +128.22% 7d sits at range 59.78%, same gate.",
        "CATALYST-BREAKOUT": "universe vol_ratio sits 0.05-2.11 against the 2.0 floor on the partial-bar prefetch. BSB carries the highest pct_24h at +23.37% with OI +28.88% but vol 0.39x and taker buy 49.97% both block.",
        "SHORT-SQUEEZE": "no qualifying assets — ALT carries funding -0.308%/8h with OI -2.22% but pct_24h +0.99% sits below the +10% Tier 2 squeeze gate.",
        "MOMENTUM": "HYPE +32.00% 7d carries funding +0.008%/8h, below the +0.03% MOMENTUM floor. BEAT +89.79% 7d carries funding +0.016%/8h, also below the floor.",
        "COMPRESSION": "no Tier 2 asset under the 5% range gate today. BTC at 4.49% range clears the Tier 1 gate but OI 7d -1.94% fails the +5% OI build.",
        "CAPITULATION": "EDEN cleared pct_24h -12.79% / oi_24h -19.44% / funding -0.266% gates but liq $739K sits at one-third the 7d p75 of $2.13M. The flush hasn't intensified.",
    }

    neutral_summary = f"Neutral · {n_neutral} other assets · see artifact tail for full data"

    data = {
        "date": TODAY,
        "edge_case": None,
        "verdict": verdict,
        "regime_changes": transitions,
        "regimes": regimes,
        "regime_empty_notes": regime_empty_notes,
        "watch": watch,
        "neutral_summary": neutral_summary,
        "tail": tail,
    }

    Path(".outputs/perps-scan.data.json").write_text(json.dumps(data, indent=2))
    print(f"wrote .outputs/perps-scan.data.json — "
          f"DIST={len(by_regime['DISTRIBUTION'])} NEUTRAL={n_neutral} "
          f"watch={len(watch)} tail={len(tail)} transitions={len(transitions)}")


def build_metrics_line(asset, m):
    if asset == "BSB":
        return (
            f"{pct(m['pct_24h'])} 24h, {pct(m['pct_7d'])} 7d, "
            f"OI {pct(m['oi_24h_pct'])} 24h on OI {pct(m['oi_7d_pct'])} 7d, "
            f"funding {m['funding_now']*100:+.4f}%/8h "
            f"(7d avg {m['funding_7d_avg']*100:+.4f}%, delta {m['funding_delta']*100:+.4f}%), "
            f"taker buy {m['taker_buy_pct_24h']:.2f}%, "
            f"short liqs {fmt_usd(m['short_liqs_24h'])} vs 7d p75 {fmt_usd(m['short_liqs_p75'])}, "
            f"top L/S {m['top_ls_now']:.2f} down {abs(m['top_ls_delta_7d']):.2f} 7d, "
            f"pct_4h {pct(m['pct_4h'])}, vol {m['vol_ratio']:.2f}x (partial bar)"
        )
    return ""


def transition_note(asset, prior, current, m):
    if asset == "BSB" and prior == "NEUTRAL" and current == "DISTRIBUTION":
        return (
            "Funding +0.089%/8h cleared the +0.08% Tier 2 DIST gate today (was +0.013% 7d avg). "
            "Pct_24h +23.37% slipped under pct_7d/7 of +23.83%, flipping the gains-slowing gate. "
            "OI +28.88% 24h on +275.99% 7d satisfies the +5% OI gate. "
            "Top L/S 1.94 down 0.57 over 7d reads as smart money exiting into retail leverage. "
            "Sub-tags do not fire (top_ls 1.94 below the 2.0 REAL-CROWDED-LONG floor, pct_24h positive blocks LONG-TRAP, basis null suppresses pattern tags)."
        )
    return ""


def build_watch_metric(asset, m):
    parts = [
        f"{pct(m['pct_24h'])} 24h, {pct(m['pct_7d'])} 7d",
        f"OI {pct(m['oi_24h_pct'])} 24h on OI {pct(m['oi_7d_pct'])} 7d",
        f"funding {m['funding_now']*100:+.4f}%/8h (7d avg {m['funding_7d_avg']*100:+.4f}%)",
    ]
    if m.get("taker_buy_pct_24h") is not None:
        parts.append(f"taker buy {m['taker_buy_pct_24h']:.2f}%")
    if m.get("liq_24h_total") is not None:
        parts.append(f"liq {fmt_usd(m['liq_24h_total'])} vs 7d p75 {fmt_usd(m['liq_7d_p75'])}")
    if m.get("top_ls_now") is not None and m.get("top_ls_delta_7d") is not None:
        d = m['top_ls_delta_7d']
        direction = "down" if d < 0 else "up"
        parts.append(f"top L/S {m['top_ls_now']:.2f} {direction} {abs(d):.2f} 7d")
    if m.get("basis_now") is not None:
        parts.append(f"basis {m['basis_now']*100:+.3f}%")
    if m.get("pct_4h") is not None:
        parts.append(f"pct_4h {pct(m['pct_4h'])}")
    if m.get("vol_ratio") is not None:
        parts.append(f"vol {m['vol_ratio']:.2f}x")
    return ", ".join(parts)


def build_watch_read(asset, m):
    if asset == "EDEN":
        return (
            "Cleared pct_24h ≤ -10% (-12.79%), funding < 0 (-0.266%), and oi_24h ≤ -10% (-19.44%) for CAPITULATION. "
            "Liq $739K sits at one-third the 7d p75 of $2.13M and blocks the regime. "
            "Pct_4h -12.92% means the entire drawdown ran in the last four hours. The flush is fresh, not cleared. "
            "A second-day -10% with liq printing through $2.1M fires CAPITULATION."
        )
    if asset == "BEAT":
        return (
            "Yesterday's +45.93% near-CATALYST-BREAKOUT print has unwound into back-to-back red days. "
            "Liq $1.41M now clears the 7d p75 $937K and pct_4h -13.51% means the cascade just accelerated. "
            "Top L/S 1.33 down 0.62 over 7d reads as smart-money distribution into retail leverage. "
            "Funding +0.016% sits well below the +0.08% Tier 2 LONG-TRAP floor. A funding push past +0.08% on continued red fires the pattern."
        )
    if asset == "ALT":
        return (
            "Extreme cash-and-carry shape. Basis +2.58% on funding -0.308%/8h with OI building +256% 7d. "
            "Taker buy 52.70% clears the upper CASH-AND-CARRY bound of 52 by 0.70pp, blocking the formal pattern tag (window is 48-52%). "
            "The structure reads as institutional arb flow, not bullish positioning. "
            "A taker-buy drop back under 52% with basis holding fires the formal CASH-AND-CARRY tag."
        )
    if asset == "GENIUS":
        return (
            "OI +144.77% 7d with range 71.93% means a fresh, volatile setup carrying real leverage build. "
            "Vol 1.36x clears the universe median. "
            "Top L/S 1.29 down 0.44 7d reads as smart money fading the entry. "
            "A second-day red with OI extending lower fires CAPITULATION-shaped flow."
        )
    if asset == "NEAR":
        return (
            "Yesterday's rip rolled into a soft red. OI -3.57% means the late longs are unwinding without panic. "
            "Funding repaired close to zero from a +0.006% 7d avg. "
            "Range 59.78% holds NEAR out of ACCUMULATION even though OI 7d +128% would qualify. "
            "A 2-3 day consolidation under $2.20 with OI holding flat re-arms ACCUMULATION."
        )
    if asset == "HYPE":
        return (
            "Taker buy 51.95% sits just under the +52% CATALYST-BREAKOUT gate. "
            "Pct_24h +0.87% sits 19pp under the +20% Tier 2 trigger. "
            "The +32% 7d run on OI +43.04% 7d carries momentum but range expanded past the 25% ACCUMULATION gate. "
            "Funding flipped clean positive — new longs paying premium. "
            "A consolidation week with range tightening fires ACCUMULATION CONFIRMED."
        )
    return ""


if __name__ == "__main__":
    main()

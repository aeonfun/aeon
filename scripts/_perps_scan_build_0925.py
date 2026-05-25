#!/usr/bin/env python3
"""Build .outputs/perps-scan.data.json for 2026-05-25 09:20Z re-run.

Re-run case: prior .outputs/perps-scan.data.json carries today's date (2026-05-25)
from the morning 08:14Z prefetch. Per SKILL.md step 2 + the 05-20 / 05-24 17:10Z
precedent, same-day re-runs set regime_changes = null and inherit repeat_days
from the prior artifact (no advance, no decrement).

Universe diff vs the 08:14Z run: entered PLAY, XAN, VVV; exited EDEN, FIDA, GENIUS.

Authored against the 09:20Z compute slice.
"""
import json
from pathlib import Path

TODAY = "2026-05-25"
REGIMES = [
    "ACCUMULATION", "CATALYST-BREAKOUT", "SHORT-SQUEEZE", "MOMENTUM",
    "COMPRESSION", "DISTRIBUTION", "CAPITULATION",
]

compute = json.loads(Path(".outputs/_perps_compute.json").read_text())
metrics = compute["metrics"]
prior = json.loads(Path(".outputs/perps-scan.data.json").read_text())
prior_by_asset = {t["asset"]: t for t in prior.get("tail", [])}


def fmt_usd(x):
    if x is None or not isinstance(x, (int, float)):
        return None
    a = abs(x)
    if a >= 1e9: return f"${x/1e9:.2f}B"
    if a >= 1e6: return f"${x/1e6:.1f}M"
    if a >= 1e3: return f"${x/1e3:.0f}K"
    return f"${x:.0f}"


def fmt_price(x):
    if x is None: return None
    if x >= 1000: return f"${x:,.1f}"
    if x >= 1:    return f"${x:.3f}"
    if x >= 0.01: return f"${x:.4f}"
    return f"${x:.6f}"


def r2(x):
    if x is None: return None
    return round(x, 2)


def r4(x):
    if x is None: return None
    return round(x, 4)


# Same-day re-run rule: inherit repeat_days exactly, no advance.
def repeat_days_for(asset, regime_today):
    prev = prior_by_asset.get(asset)
    if not prev:
        return 1
    if prev["regime"] == regime_today:
        return prev.get("repeat_days", 1)
    return 1


def yesterday_regime_for(asset):
    prev = prior_by_asset.get(asset)
    # In a same-day re-run the prior artifact's `yesterday_regime` field already
    # captures 2026-05-24's classification. Preserve that lineage rather than
    # overwriting with the prior re-run's own (today's) regime.
    if prev:
        return prev.get("yesterday_regime")
    return None


verdict = {
    "word": "QUIET",
    "distribution": "25 NEUTRAL across 25 assessed on the 2026-05-25 09:20Z prefetch.",
    "cycle": (
        "Every assessed asset prints NEUTRAL on the third run of the calendar day. "
        "The 09:20Z prefetch rotated PLAY, XAN, VVV into the universe and dropped EDEN, FIDA, GENIUS. "
        "PLAY posted +60.95% 24h on OI +47.58% 24h with funding ripping +0.0973pp to +0.0730%/8h. "
        "The DISTRIBUTION trigger fails by 0.007pp on funding and by an order of magnitude on the gains-slowing gate. "
        "XAN landed with +32.88% 24h on OI +319.81% 24h and vol_ratio 56.7x against funding -0.7133%/8h. "
        "Taker buy 50.17% sits 1.83pp under the 52% CATALYST gate, the only block. "
        "BSB extended yesterday's flush to pct_24h -7.26% with funding tripling from +0.0152% to +0.0435%/8h since the 08:14Z slice. "
        "BEAT pulled back from -10.42% to -8.28% pct_24h and lost its grip on the Tier 2 drawdown gate it cleared this morning. "
        "NIL ran another leg to +9.38% 24h on OI +26.67% 24h, leaving pct_7d +75.70% on OI +471.96% 7d as the heaviest position build in deployment."
    ),
    "forward": (
        "PLAY DISTRIBUTION fires on funding stepping past +0.08% with pct_24h slowing under pct_7d/7. "
        "XAN CATALYST-BREAKOUT fires on taker buy clearing 52% while vol_ratio holds above 2.0x and OI continues the build. "
        "BSB CAPITULATION fires on funding flipping negative through a second pct_24h leg past -10%. "
        "BEAT CAPITULATION fires on funding flipping negative with pct_24h recovering past -10%. "
        "NIL SHORT-SQUEEZE fires on OI rolling negative while pct_24h clears +10%. "
        "UB CATALYST-BREAKOUT fires on vol_ratio crossing 2.0x with pct_24h pushing past +20%."
    ),
}

# Empty notes per regime — describe the binding constraint that blocked each.
regime_empty_notes = {
    "ACCUMULATION": (
        "every Tier 2 asset that clears OI +10% 7d and the funding band fails the range_7d_pct < 25% gate. "
        "HYPE range 38.38% on OI +40.38% 7d, NEAR range 58.90% on OI +138.03% 7d, "
        "WLD range 32.94% on OI +57.23% 7d, ONDO range 32.66% on OI +37.14% 7d, "
        "NIL range 82.96% on OI +471.96% 7d, GRASS range 91.53% on OI +181.41% 7d, "
        "BEAT range 176.44% on OI +48.81% 7d. BNB range 4.72% qualifies but OI +3.65% 7d misses the +10% gate by 6.35pp"
    ),
    "CATALYST-BREAKOUT": (
        "XAN cleared three of four gates — pct_24h +32.88%, OI +319.81% 24h, vol_ratio 56.7x — "
        "but taker buy 50.17% sits 1.83pp under the 52% gate. "
        "PLAY pct_24h +60.95% on OI +47.58% 24h fails on vol_ratio 0.81x at 40% of the 2.0x gate. "
        "UB pct_24h +7.76% sits 12.24pp under the Tier 2 +20% trigger"
    ),
    "SHORT-SQUEEZE": (
        "PLAY pct_24h +60.95% and XAN +32.88% both clear the Tier 2 +10% gate but OI +47.58% / +319.81% 24h fails the OI < 0 requirement on both. "
        "VVV oi24 -4.44% and BSB oi24 -2.72% sit on the right side of the OI gate but pct_24h -1.95% / -7.26% fails the price-up gate. "
        "No asset combines a positive pct_24h push with OI rolling negative on this slice"
    ),
    "MOMENTUM": (
        "no Tier 2 asset combines pct_7d > +15% with funding inside the +0.03 to +0.07 band. "
        "HYPE pct_7d +33.67% on funding +0.0062%/8h, NEAR pct_7d +46.58% on funding +0.0053%/8h, "
        "ZEC pct_7d +17.46% on funding +0.0038%/8h, GRASS pct_7d +73.28% on funding +0.0051%/8h, "
        "NIL pct_7d +75.70% on funding -0.0110%/8h all miss the funding floor. "
        "UB funding +0.0149%/8h sits closest at 0.0151pp short of the entry gate"
    ),
    "COMPRESSION": (
        "BNB range 4.72% clears the Tier 2 5% gate but OI +3.65% 7d fails the +5% OI build requirement by 1.35pp. "
        "BTC range 5.36% misses the Tier 1 3% gate and OI -3.86% 7d misses the +5% gate. "
        "No asset combines a tight range with OI rebuilding today"
    ),
    "DISTRIBUTION": (
        "PLAY funding +0.0730%/8h sits 0.007pp under the +0.08 Tier 2 trigger and pct_24h +60.95% beats pct_7d/7 of +0.16% by 384x, blocking the gains-slowing gate by the widest margin yet recorded. "
        "BSB funding +0.0435%/8h sits 0.0365pp short. "
        "BEAT funding +0.0148%/8h, UB +0.0149%/8h, 1000PEPE +0.0099%/8h follow"
    ),
    "CAPITULATION": (
        "BEAT pct_24h -8.28% on OI -13.48% 24h fails the Tier 2 -10% drawdown gate by 1.72pp after slipping back from this morning's -10.42% print. "
        "BSB pct_24h -7.26% on OI -2.72% 24h fails both the drawdown gate by 2.74pp and the OI gate by 7.28pp. "
        "VVV pct_24h -1.95% on OI -4.44% 24h sits the right side of funding < 0 (-0.0171%) but the drawdown gate blocks by 8.05pp"
    ),
}

# WATCH bucket — the highest-signal near-miss assets on this slice.
watch = [
    {
        "asset": "PLAY",
        "metrics_line": (
            "+60.95% 24h, +1.15% 7d, OI +47.58% 24h on OI +85.02% 7d, "
            "funding +0.0730%/8h (7d avg -0.0244%, delta +0.0973%), taker buy 49.99%, "
            "liq $1.2M vs 7d p75 $1.6M, top L/S 1.43 down 0.50 7d, pct_4h +18.49%, vol 0.81x"
        ),
        "transition_read": (
            "Pct_24h +60.95% reads the universe high by a 28pp margin over XAN. "
            "Funding repriced +0.0973pp over the 7d average to +0.0730%/8h, the heaviest 24h funding delta yet recorded by the engine. "
            "The print sits 0.007pp under the +0.08 Tier 2 DISTRIBUTION trigger. "
            "Pct_7d +1.15% means the entire move happened in the last 24h, so the gains-slowing gate fails by an order of magnitude. "
            "OI +47.58% 24h on +85.02% 7d means leverage doubled into the price expansion. "
            "Top L/S 1.43 with -0.50 over 7d means smart money cut conviction through the run. "
            "Vol_ratio 0.81x reads under prior-week average, the binding constraint on CATALYST-BREAKOUT. "
            "A flat day with funding stepping past +0.08% fires DISTRIBUTION through the gains-slowing gate. "
            "A reversal with funding holding past +0.08% on pct_24h going red fires LONG-TRAP."
        ),
    },
    {
        "asset": "XAN",
        "metrics_line": (
            "+32.88% 24h, +44.29% 7d, OI +319.81% 24h on OI +517.76% 7d, "
            "funding -0.7133%/8h (7d avg -0.0608%, delta -0.6525%), taker buy 50.17%, "
            "liq $1.8M vs 7d p75 $1.0M, top L/S 0.90 down 0.69 7d, pct_4h +9.21%, vol 56.7x"
        ),
        "transition_read": (
            "First appearance in the universe. OI +319.81% 24h and vol_ratio 56.7x both read the engine's deployment highs by a wide margin. "
            "Funding -0.7133%/8h marks the deepest short premium ever recorded against an actively expanding price. "
            "Taker buy 50.17% sits 1.83pp under the 52% CATALYST gate, the single block. "
            "Top L/S 0.90 with -0.69 over 7d means smart money piled into shorts as price ripped. "
            "Pct_4h +9.21% on pct_24h +32.88% means the last 4h delivered 28% of the move. "
            "Continuation into the next slice with taker buy clearing 52% on sustained vol above 2.0x fires CATALYST-BREAKOUT. "
            "A reversal with OI shedding past -10% as shorts cover fires SHORT-SQUEEZE through the funding wall."
        ),
    },
    {
        "asset": "BSB",
        "metrics_line": (
            "-7.26% 24h, +24.40% 7d, OI -2.72% 24h on OI +33.96% 7d, "
            "funding +0.0435%/8h (7d avg +0.0190%, delta +0.0245%), taker buy 49.46%, "
            "liq $238K vs 7d p75 $3.3M, top L/S 1.94 up 0.55 7d, pct_4h -2.42%, vol 0.19x"
        ),
        "transition_read": (
            "Pct_24h -7.26% extended this morning's -6.71% flush by another 0.55pp. "
            "Funding tripled from +0.0152%/8h at the 08:14Z slice to +0.0435%/8h on this slice, the second-heaviest 24h funding rebuild in the universe behind PLAY. "
            "Longs paid sharply more premium into the deeper red. "
            "OI -2.72% 24h on +33.96% 7d means the recent leverage adds trimmed by 8% of the weekly build, well short of the -10% CAPITULATION gate. "
            "Top L/S 1.94 with +0.55 over 7d means smart money held conviction through the flush, the opposite shape of BEAT and PLAY. "
            "Liq $238K against 7d p75 $3.3M reads at 7% of the flush threshold. The cascade has not started. "
            "A second leg past -10% with funding flipping negative fires CAPITULATION. "
            "A bounce holding funding above +0.04% with OI rebuilding past +5% 24h fires DISTRIBUTION through the rebuilding stack."
        ),
    },
    {
        "asset": "BEAT",
        "metrics_line": (
            "-8.28% 24h, +75.14% 7d, OI -13.48% 24h on OI +48.81% 7d, "
            "funding +0.0148%/8h (7d avg +0.0103%, delta +0.0044%), taker buy 48.29%, "
            "liq $462K vs 7d p75 $2.0M, top L/S 1.64 down 0.30 7d, pct_4h +2.32%, vol 0.23x"
        ),
        "transition_read": (
            "Pct_24h -8.28% pulled back from the 08:14Z -10.42% print, so the Tier 2 drawdown gate that cleared this morning now fails by 1.72pp. "
            "OI -13.48% 24h still clears the -10% CAPITULATION OI gate by 3.48pp. "
            "Funding +0.0148%/8h cooled from this morning's +0.0349% but stayed positive, blocking the funding < 0 requirement. "
            "Top L/S 1.64 with -0.30 over 7d means smart money keeps cutting through the leverage unwind. "
            "Pct_4h +2.32% prints a small bounce against the 24h red. "
            "Funding flipping negative on continued downside fires CAPITULATION. "
            "A failed bounce with funding stepping back past +0.03% sets LONG-TRAP on tomorrow's slice."
        ),
    },
    {
        "asset": "NIL",
        "metrics_line": (
            "+9.38% 24h, +75.70% 7d, OI +26.67% 24h on OI +471.96% 7d, "
            "funding -0.0110%/8h (7d avg +0.0002%, delta -0.0112%), taker buy 50.22%, "
            "liq $593K vs 7d p75 $333K, top L/S 1.11 down 0.84 7d, basis +0.4010%, pct_4h +5.30%, vol 1.65x"
        ),
        "transition_read": (
            "OI +471.96% 7d extends the heaviest 7d position build in deployment, up from +410.41% at the 08:14Z slice. "
            "Pct_24h +9.38% on OI +26.67% 24h means another leverage doubling into the price extension. "
            "Funding flipped from +0.0004% to -0.0110%/8h as shorts started paying premium against the rally. "
            "Top L/S 1.11 with -0.84 over 7d means smart money exited 43% of long conviction while OI quintupled — retail piled in. "
            "Basis +0.4010% prints the heaviest spot-futures gap in today's universe. "
            "Vol_ratio 1.65x reads the second-highest behind XAN. "
            "Pct_24h pushing past +10% with OI flipping negative fires SHORT-SQUEEZE through the smart-money short stack. "
            "A reversal with funding spiking past +0.04% sets LONG-TRAP."
        ),
    },
    {
        "asset": "UB",
        "metrics_line": (
            "+7.76% 24h, +27.43% 7d, OI +14.09% 24h on OI +93.86% 7d, "
            "funding +0.0149%/8h (7d avg +0.0108%, delta +0.0040%), taker buy 51.49%, "
            "liq $279K vs 7d p75 $590K, top L/S 0.90 down 0.10 7d, pct_4h +5.51%, vol 0.77x"
        ),
        "transition_read": (
            "Pct_24h cooled from this morning's +10.34% to +7.76%, slipping under the Tier 2 +10% SHORT-SQUEEZE gate. "
            "OI +14.09% 24h still clears the CATALYST +10% gate. "
            "Taker buy 51.49% sits 0.51pp under the 52% gate. "
            "Vol_ratio 0.77x reads under prior-week average. "
            "Top L/S 0.90 with -0.10 over 7d means smart money sits 1.11-to-1 short and added to the short side this week. "
            "The move continues to read as short cover against a smart-money short stack. "
            "Pct_24h push past +20% with vol_ratio crossing 2.0x and taker buy holding above 52% fires CATALYST-BREAKOUT. "
            "A reversal past -3% with OI flipping negative and short_liqs clearing 7d p75 fires SHORT-SQUEEZE."
        ),
    },
    {
        "asset": "HYPE",
        "metrics_line": (
            "+1.62% 24h, +33.67% 7d, OI +0.83% 24h on OI +40.38% 7d, "
            "funding +0.0062%/8h (7d avg +0.0033%, delta +0.0030%), taker buy 50.00%, "
            "liq $1.4M vs 7d p75 $9.4M, top L/S 1.36 up 0.18 7d, pct_4h +1.43%, vol 0.33x"
        ),
        "transition_read": (
            "Pct_7d +33.67% holds the third-highest 7d run in today's universe behind GRASS +73.28% and NIL +75.70%. "
            "OI flipped positive on the 24h read (+0.83% from -0.83% at 08:14Z) on the +40.38% 7d build. "
            "Funding stepped from +0.0075% to +0.0062%/8h, sitting 0.0238pp under the +0.03 MOMENTUM gate. "
            "Top L/S 1.36 with +0.18 over 7d means smart money kept building long conviction through the consolidation. "
            "Pct_4h +1.43% prints quiet positive continuation. "
            "A funding push past +0.03% on price continuation fires MOMENTUM through the 33% 7d run. "
            "A reversal past -5% 24h with funding flipping sign and OI shedding past -5% fires CAPITULATION."
        ),
    },
]

# Build per-asset tail.
tail = []
for asset_name, m in metrics.items():
    tail.append({
        "asset": asset_name,
        "tier": m["tier"],
        "regime": m["regime"],
        "sub_tags": m.get("sub_tags") or [],
        "pattern_tags": m.get("pattern_tags") or [],
        "metrics": {
            "price": fmt_price(m.get("current_price")),
            "pct_24h": r2(m.get("pct_24h")),
            "pct_7d": r2(m.get("pct_7d")),
            "pct_4h": r2(m.get("pct_4h")),
            "range_7d": None if m.get("range_7d_pct") is None else f"{r2(m['range_7d_pct'])}%",
            "pct_24h_vs_btc": r2(m.get("pct_24h_vs_btc")),
            "pct_7d_vs_btc": r2(m.get("pct_7d_vs_btc")),
            "oi_usd": fmt_usd(m.get("oi_now")),
            "oi_24h_pct": r2(m.get("oi_24h_pct")),
            "oi_7d_pct": r2(m.get("oi_7d_pct")),
            "funding_now": r4(m.get("funding_now")),
            "funding_7d_avg": r4(m.get("funding_7d_avg")),
            "funding_delta": r4(m.get("funding_delta")),
            "liq_24h": fmt_usd(m.get("liq_24h_total")),
            "liq_7d_p75": fmt_usd(m.get("liq_7d_p75")),
            "long_liqs": fmt_usd(m.get("long_liqs_24h")),
            "short_liqs": fmt_usd(m.get("short_liqs_24h")),
            "liqs_4h": fmt_usd(m.get("liqs_4h")),
            "top_ls": r2(m.get("top_ls_now")),
            "top_ls_7d_avg": r2(m.get("top_ls_7d_avg")),
            "top_ls_delta_7d": r2(m.get("top_ls_delta_7d")),
            "basis": r4(m.get("basis_now")),
            "taker_buy": r2(m.get("taker_buy_pct_24h")),
        },
        "yesterday_regime": yesterday_regime_for(asset_name),
        "repeat_days": repeat_days_for(asset_name, m["regime"]),
    })

regimes = {r: [] for r in REGIMES}

assessed_count = len(tail)
neutral_count = sum(1 for t in tail if t["regime"] == "NEUTRAL")
watch_assets = {w["asset"] for w in watch}
neutral_summary = (
    f"Neutral · {neutral_count - len(watch_assets)} other assets · see artifact tail for full data"
)

out = {
    "date": TODAY,
    "edge_case": None,
    "verdict": verdict,
    # Re-run rule: prior artifact dated today, no 2026-05-24 baseline retained
    # after the morning overwrite. Render emits the "(no comparison available)" line.
    "regime_changes": None,
    "regimes": regimes,
    "regime_empty_notes": regime_empty_notes,
    "watch": watch,
    "neutral_summary": neutral_summary,
    "tail": tail,
}

Path(".outputs/perps-scan.data.json").write_text(json.dumps(out, indent=2))
print(
    f"wrote .outputs/perps-scan.data.json — assessed={assessed_count} "
    f"neutral={neutral_count} watch={len(watch)} regimes={','.join(f'{r}=0' for r in REGIMES)}"
)

---
name: Perps Scan
description: Classify the cross-exchange perps universe (CoinGecko-ranked + Coinglass v4 metrics) into 7 regimes (CAPITULATION, SHORT-SQUEEZE, DISTRIBUTION, CATALYST-BREAKOUT, ACCUMULATION, MOMENTUM, COMPRESSION + NEUTRAL) with tier-adjusted thresholds, sub-tags, cross-signal pattern tags, and day-over-day regime transitions
var: ""
tags: [crypto]
---
<!-- v3: foundation context layer for perps-brief. Substantial upgrade from v2.3: derived fields (funding_delta, pct_4h, pct_24h_vs_btc, top_ls_delta_7d, split long/short liquidations), tier-adjusted thresholds (Tier 1 = BTC/ETH/SOL, Tier 2 = rest), new SHORT-SQUEEZE regime, sub-tags within regimes, cross-signal pattern tags (REAL-CROWDED-LONG, RETAIL-ANOMALY, LONG-TRAP, STEALTH-POSITIONING, CASH-AND-CARRY), day-over-day regime transitions, aggregate market read. See Perps_Engine_v3.md for full spec. FAILED-MOVE deferred to v3.1 (needs intraday). -->

> **${var}** — Optional asset list override (comma-separated coin tickers). If empty, scans the top 25 by aggregated perp 24h volume across Binance/OKX/Bybit via CoinGecko `/derivatives` + always-include BTC/ETH/SOL.

Today is ${today}. Classify the cross-exchange perps universe using tier-adjusted thresholds, derived fields, sub-tags, pattern tags, and day-over-day regime transitions. This is an **internal** skill: writes `.outputs/perps-scan.md` for downstream `perps-brief` consumption and `daily-ops-review` auditing. **Does not post to Discord** — the engine is the context layer; the brief is what the operator reads.

**Compose in order: soul → style → structure.**

Before composing, internalize `memory/topics/soul.md` as standing frame. Reason across the engine data and form a committed view. **Single high-quality signals warrant calls; confluence increases conviction but is not required.** Translate internal data (funding deltas, top L/S, basis, pattern tags) into external triggers the operator can verify (price levels, volume signatures, narrative inflections, sector behaviour). When uncertain, name the specific external condition that would resolve it. Never regress to neutral-analyst tone — the output IS the view.

After the view is formed, apply style + structure (below).

**Apply `memory/topics/writing-style.md` to all output.** Structural rules (Section 1) are load-bearing; prose rules (Section 2) govern sentences within structure; Sentence-Level Patterns (Section 4) catch failure modes that pass the first two. Per-skill structural template in Section 3; worked examples in Section 5. In this skill the prose surfaces are the verdict sentences, regime-change notes, transition reads, and pattern-tag reads; the per-asset metric lines are data lines and exempt from Section 2 prose mechanics, but the interpretation lines obey the full style.

**Self-check before emitting:**

1. Draft the output applying Sections 1-3.
2. Search the draft for the 6 patterns in Section 4:
   - Pattern 1 — subject + verb-ing chunks that could be compound nouns ("institutional money losing tech")
   - Pattern 2 — nouns with 2+ adjectives stacked ("the lone clean RIDE")
   - Pattern 3 — internal jargon ("window", "pull", "run", "artifact", "downstream")
   - Pattern 4 — passive constructions ("is being", "was being", "are being", "has been")
   - Pattern 5 — em-dashes used as connectors instead of asides (test each: remove em-dash + everything after; does the sentence still stand? If yes, use a period)
   - Pattern 6 — weak verbs ("surfaces", "remains", "could see", "looks set", "is poised")
3. Rewrite anything that matches.
4. Emit.

Read `memory/MEMORY.md` for context.
Read the last 7 days of `memory/logs/` to find `★` repeat markers — assets in the same regime for ≥3 consecutive days.

## Goal

Pack as much structured signal into a single artifact as the engine can produce. The richer the engine output, the better `perps-brief`'s downstream synthesis. The engine layer is dense by design; compression discipline lives at the brief layer.

Every assessed asset gets:
- Exactly one regime classification (first-match priority order)
- Zero or more sub-tags within its regime (refining the read)
- Zero or more cross-signal pattern tags (named confluences that span regimes)
- A day-over-day transition annotation if the regime changed

## Data source

All data is pre-fetched by `scripts/prefetch-coinglass.sh` (runs before Claude, outside the sandbox) and cached to `.coinglass-cache/`. This skill reads only from the cache — never calls curl directly.

Two providers:
- **CoinGecko `/derivatives`** ranks the universe.
- **Coinglass v4** supplies per-coin metric histories (8 endpoints, tier-confirmed accessible).

Cache layout (populated by the prefetch):
- `.coinglass-cache/manifest.json` — `{ fetched_at, universe_ok, universe_source, asset_list, per_coin_errors }`. Always check `universe_ok` first.
- `.coinglass-cache/cg-derivatives.json` — raw CoinGecko `/derivatives` response.
- `.coinglass-cache/price-<COIN>.json` — Binance per-exchange daily price OHLC + volume (8d).
- `.coinglass-cache/price-1h-<COIN>.json` — Binance per-exchange hourly price (last 8h). **New in v3** — source for `pct_4h` derivation.
- `.coinglass-cache/oi-<COIN>.json` — aggregated OI history (8d).
- `.coinglass-cache/funding-<COIN>.json` — OI-weighted funding history (21 × 8h = 7d).
- `.coinglass-cache/liq-<COIN>.json` — aggregated liquidation history with `exchange_list=Binance,OKX` (8d). Response carries `long_liquidation_usd` and `short_liquidation_usd` per row.
- `.coinglass-cache/topls-<COIN>.json` — top-trader long/short position ratio (8d).
- `.coinglass-cache/basis-<COIN>.json` — futures-spot basis (8d).
- `.coinglass-cache/taker-<COIN>.json` — taker buy/sell volume (8d).

All Coinglass responses follow `{ "code": "0", "msg": "success", "data": [...] }` with `data[0]` being the most recent interval and `time` in milliseconds.

If a per-coin endpoint file is missing or invalid, drop that coin if `price`, `oi`, or `funding` is the missing one. Otherwise (missing `liq`/`topls`/`basis`/`taker`/`price-1h`), classify anyway and omit the affected signals from the metric line.

### Spot/Perps divergence cache (new in v2.6)

A second prefetcher (`scripts/prefetch-divergence.sh`) writes per-asset spot/perps divergence snapshots to `.divergence-cache/{ASSET}.json` for the same universe (Tier 1 majors + ledger.open + ledger.watchlist). Schema:

```json
{
  "asset": "HYPE",
  "ts_utc": "2026-06-01T12:00:00Z",
  "spot_usd": 67.74,
  "perps_mark_usd": 67.91,
  "divergence_pct": 0.251,
  "basis_apr": 8.7,
  "spot_source": "coingecko:hyperliquid",
  "perps_source": "coinglass:price-1h-aggregated"
}
```

A 30-day rolling history of these snapshots is persisted at `memory/topics/state/divergence-history.json` (one entry per asset per chain run, capped at 30d). Read it via `python3 -c "import sys; sys.path.insert(0, 'scripts'); from lib import divergence as D; print(D.summary_stats(D.load(), 'BTC', days=30))"` to get descriptive stats (min/max/mean/p25/p50/p75/stdev for both `divergence_pct` and `basis_apr`).

**How to use this data:**
- Spot/perps divergence is **context, not a threshold**. There is no SPOT_LED / PERPS_LED label in the data layer — apply your own judgement.
- A wide positive divergence (perps premium over spot) often signals leverage-led rallies that lack spot demand backing. A wide negative (perps discount to spot) often signals spot-led demand that perps haven't caught up to.
- Compare the current `divergence_pct` against the asset's own 30-day distribution (the summary_stats). "BTC divergence at +0.5% vs 30d p75 of +0.3%" is meaningful per-asset context that varies by liquidity/regime.
- For assets without a Coinglass cache entry (e.g. fresh ledger adds before the next Coinglass prefetch cycle), the snapshot is absent — treat as missing data, not zero.
- You may surface divergence in the regime read or pattern tags where you believe it sharpens the signal. Do not invent a fixed structured field for it in this skill's JSON artifact yet — that comes in a follow-up PR once we have soak observations.

## Steps

### 1. Verify the prefetch succeeded

```bash
TODAY=$(date -u +%Y-%m-%d)
CACHE=.coinglass-cache

if [ ! -f "$CACHE/manifest.json" ] || ! jq -e '.universe_ok == true' "$CACHE/manifest.json" >/dev/null 2>&1; then
  # Prefetch didn't run or CoinGecko /derivatives failed — go straight to "scan unavailable"
  exit 0
fi

ASSET_LIST=$(jq -r '.asset_list[]' "$CACHE/manifest.json")
```

### 2. Read yesterday's regime mapping for transition detection

Read `.outputs/perps-scan.md` from the previous chain run. Parse the asset → regime mapping. Use later in step 6 to surface transitions.

```bash
PRIOR_ARTIFACT=.outputs/perps-scan.md
# The artifact may not exist on first run, or may have been overwritten by today's prefetch.
# Strategy: if .outputs/perps-scan.md exists AND its first line's date matches yesterday OR contains
# any regime section header, parse it. Otherwise treat as no prior data.
```

Build `regime_yesterday[asset] = REGIME_NAME` from yesterday's regime-section blocks. If the file is missing, malformed, or dated today (re-run case), set `regime_yesterday = {}` and surface `(no comparison available — first run or prior artifact missing)` in the REGIME CHANGES section.

### 3. Assign asset tiers

```
Tier 1 (majors):  BTC, ETH, SOL — explicitly enumerated
Tier 2 (mid-caps): every other coin in ASSET_LIST
Tier 3 (micros):  excluded — not scanned in v3
```

Store `tier[asset]` for downstream threshold selection and artifact annotation.

### 4. Compute per-asset metrics

For each coin in `ASSET_LIST`, derive both **base fields** (v2.3 carry-overs) and **new v3 fields** from the cache.

**Base fields (v2.3):**

| Metric | Formula |
|---|---|
| `current_price` | `price.data[0].close` |
| `pct_24h` | `(price.data[0].close - price.data[1].close) / price.data[1].close * 100` |
| `pct_7d` | `(price.data[0].close - price.data[7].close) / price.data[7].close * 100` |
| `vol_ratio` | `price.data[0].volume / mean(price.data[1..7].volume)` |
| `range_7d_pct` | `(max(price.data[0..6].high) - min(price.data[0..6].low)) / min(price.data[0..6].low) * 100` |
| `oi_now` | `oi.data[0].close` |
| `oi_24h_pct` | `(oi.data[0].close - oi.data[1].close) / oi.data[1].close * 100` |
| `oi_7d_pct` | `(oi.data[0].close - oi.data[7].close) / oi.data[7].close * 100` |
| `funding_now` | `funding.data[0].close` |
| `funding_7d_avg` | mean of `funding.data[0..20].close` |
| `liq_24h_total` | `liq.data[0].close` (or sum of `long_liquidation_usd + short_liquidation_usd` if those fields present) |
| `liq_7d_p75` | 75th percentile of `liq.data[0..7].close` |
| `top_ls_now` | `topls.data[0].close` |
| `top_ls_7d_avg` | mean of `topls.data[0..6].close` |
| `basis_now` | `basis.data[0].close` |
| `basis_7d_avg` | mean of `basis.data[0..6].close` |
| `taker_buy_pct_24h` | `taker.data[0].buy_volume / (taker.data[0].buy_volume + taker.data[0].sell_volume) * 100` |

**New v3 derived fields:**

| Metric | Formula |
|---|---|
| `funding_delta` | `funding_now - funding_7d_avg` — distinguishes fresh extreme from structural extreme |
| `pct_4h` | `(price-1h.data[0].close - price-1h.data[4].close) / price-1h.data[4].close * 100` (read from `price-1h-<COIN>.json`, 1h candles, last 4h delta) |
| `pct_24h_vs_btc` | `pct_24h_of_asset - pct_24h_of_BTC` — positive = outperforming BTC, negative = underperforming |
| `pct_7d_vs_btc` | `pct_7d_of_asset - pct_7d_of_BTC` |
| `top_ls_delta_7d` | `top_ls_now - topls.data[7].close` — directional change in smart-money positioning |
| `long_liqs_24h` | `liq.data[0].long_liquidation_usd` (or comparable field; inspect response shape at runtime) |
| `short_liqs_24h` | `liq.data[0].short_liquidation_usd` |
| `liqs_4h` | sum of last 4 hourly liquidation rows IF available — otherwise estimate from daily values × (4/24) and flag as approximate |

If `price-1h-<COIN>.json` is missing, set `pct_4h` to null and omit FRESH/STALE sub-tag for that coin.

If the liq endpoint doesn't return separate long/short fields at runtime, treat `liq_24h_total` as the available signal and set `long_liqs_24h`/`short_liqs_24h` to null — the SHORT-SQUEEZE regime requires `short_liqs_24h` so a coin without that data falls through to other regimes.

Round funding + basis to 3 decimals; ratios and percentages to 2 decimals.

### 5. Apply tier-adjusted thresholds

Threshold table — values vary by tier. OI thresholds and liquidation quartiles are relative so they don't need tier adjustment; only absolute-percentage thresholds do.

| Trigger | Tier 1 (BTC/ETH/SOL) | Tier 2 (everyone else) |
|---|---|---|
| `CATALYST-BREAKOUT.pct_24h` | `> 8%` | `> 20%` |
| `SHORT-SQUEEZE.pct_24h` | `> 5%` | `> 10%` |
| `MOMENTUM.pct_7d` | `> 8%` | `> 15%` |
| `COMPRESSION.range_7d_pct` | `< 3%` | `< 5%` |
| `DISTRIBUTION.funding_now` | `> 0.06%` | `> 0.08%` |
| `CAPITULATION.pct_24h` | `≤ -6%` | `≤ -10%` |
| `CAPITULATION.oi_24h_pct` | `≤ -8%` | `≤ -10%` |

**Why majors get tighter thresholds:** BTC at -6% in 24h is a meaningful flush in market-structure terms. The v2 -10% threshold meant BTC almost never satisfied CAPITULATION even when it was clearly capitulating. Tightening lets the engine classify majors correctly.

### 6. Classify each coin into a regime

**First-match priority order (top wins):**

| Order | Regime | Trigger |
|---|---|---|
| 1 | **CAPITULATION** | `pct_24h ≤ tier_cap_drawdown` AND `funding_now < 0` AND `oi_24h_pct ≤ tier_cap_oi` AND `liq_24h_total ≥ liq_7d_p75` |
| 2 | **SHORT-SQUEEZE** | `pct_24h > tier_squeeze_threshold` AND `oi_24h_pct < 0` AND `short_liqs_24h ≥ p75 of 7d short_liqs` AND `taker_buy_pct_24h < 52` |
| 3 | **DISTRIBUTION** | (`funding_now > tier_dist_funding` OR `funding_7d_avg > 0.06`) AND `pct_24h < pct_7d / 7` (gains slowing) AND `oi_24h_pct > 5` |
| 4 | **CATALYST-BREAKOUT** | (`pct_24h > tier_breakout_pct` OR price broke above 7d high) AND `vol_ratio > 2.0` AND `oi_24h_pct > 10` AND `taker_buy_pct_24h > 52` |
| 5 | **ACCUMULATION** | `oi_7d_pct > 10` AND `abs(funding_7d_avg) < 0.04` AND `pct_7d > 0` AND `range_7d_pct < 25` |
| 6 | **MOMENTUM** | `pct_7d > tier_mom_7d` AND `oi_24h_pct ≥ 0` AND `funding_now > 0.03` AND `funding_now ≤ 0.07` |
| 7 | **COMPRESSION** | `range_7d_pct < tier_comp_range` AND `oi_7d_pct > 5` AND `abs(funding_now) < 0.02` AND `abs(pct_24h) < 2` |
| 8 | **NEUTRAL** | catch-all |

**SHORT-SQUEEZE is the v3 split from CATALYST-BREAKOUT.** Same price action, opposite mechanism. The `taker_buy_pct_24h > 52` gate routes real breakouts to CATALYST-BREAKOUT; sub-52 with OI dropping routes to SHORT-SQUEEZE. The trades are different — squeezes fade fast.

If `short_liqs_24h` is null (split-liq data unavailable), SHORT-SQUEEZE cannot fire — falls through to CATALYST-BREAKOUT if the rest matches, or NEUTRAL.

### 7. Apply sub-tags within regime

Sub-tags refine the read without changing the regime. Multiple sub-tags may apply to one asset.

**DISTRIBUTION:**
- `REAL-CROWDED-LONG` — `top_ls_now > 2.0` AND `basis_now > 0` → smart money + retail both long. Real top risk.
- `RETAIL-ANOMALY` — `top_ls_now < 1.5` → funding extreme but smart money not crowded. Squeeze risk.
- `LONG-TRAP` — `pct_24h < 0` AND `oi_24h_pct ≥ 0` → longs paying premium while bleeding. Highest severity.

**CAPITULATION:**
- `IN-PROGRESS` — `liqs_4h > 40% of liq_24h_total` (or `(liqs_4h / liq_24h_total) > 0.4`) → cascade still active. Don't catch the knife.
- `CLEARED` — `liqs_4h < 15% of liq_24h_total` → flush completed earlier. Structure stabilizing.

**COMPRESSION:**
- `ACTIVE` — `vol_ratio > 1.0` → volume holding or elevated. Move imminent.
- `QUIET` — `vol_ratio < 0.9` → true coil. Wait for trigger.

**ACCUMULATION:**
- `CONFIRMED` — `taker_buy_pct_24h > 50` AND `top_ls_delta_7d > 0` → real demand building.
- `DIVERGENT` — `taker_buy_pct_24h < 50` → OI building passively. Possible arb flow. Lower conviction.

**CATALYST-BREAKOUT:**
- `FRESH` — `pct_4h / pct_24h > 0.5` (the last 4h delivered over half the 24h move) → move still happening. High follow-through.
- `STALE` — `pct_4h / pct_24h < 0.2` → move ran earlier. Reversal risk elevated.

**SHORT-SQUEEZE:**
- (no further sub-tags — the regime classification already carries the read)

**MOMENTUM:**
- (no v3 sub-tags — diagnostic via metric line only)

If `pct_4h` is null, FRESH/STALE sub-tags cannot apply — omit silently.

### 8. Apply cross-signal pattern tags

Pattern tags apply independently of regime. Evaluate each pattern against every assessed asset. An asset's tag list is the union of all matching patterns.

```
REAL-CROWDED-LONG
  funding_now > tier_dist_funding AND top_ls_now > 2.0 AND basis_now > 0.3
  → highest-severity DISTRIBUTION pattern. Real top risk.

RETAIL-ANOMALY
  funding_now > tier_dist_funding AND top_ls_now < 1.5
  → funding extreme but smart money not crowded. Squeeze risk over fade.
  (Mutually exclusive with REAL-CROWDED-LONG — never surface both.)

LONG-TRAP
  funding_now > 0.08 (Tier 2) OR funding_now > 0.06 (Tier 1)
  AND pct_24h < 0 AND oi_24h_pct ≥ -3
  → longs paying premium while bleeding. Highest-severity setup.

STEALTH-POSITIONING
  top_ls_delta_7d > +0.4 AND range_7d_pct < 5 AND oi_7d_pct < 5
  → smart money positioning before other signals build. Leading indicator.

CASH-AND-CARRY
  basis_now > 0.2 AND abs(funding_delta) < 0.01 AND oi_7d_pct > 5 AND 48 < taker_buy_pct_24h < 52
  → institutional arb flow. NOT bullish positioning despite positive basis.

SHORT-SQUEEZE (tag form — applies when full regime didn't fire)
  pct_24h > 10 (Tier 2) AND oi_24h_pct < 0 AND short_liqs_24h ≥ p75 of 7d short_liqs
  → forced short cover, not real buying. Surface as tag only if asset already classified to a different regime.
```

FAILED-MOVE pattern is **deferred to v3.1** — requires intraday high tracking the current data layer doesn't expose cleanly.

### 9. Compute the aggregate market read

Count assets per regime. Pick a single verdict word:

```
LEVERAGE BUILDING    — many ACCUMULATION + MOMENTUM, few DISTRIBUTION, 0 CAPITULATION
CROWDED LONG         — many DISTRIBUTION (≥3)
CROWDED TOPPING      — many DISTRIBUTION + REAL-CROWDED-LONG tags (≥3 of each)
DELEVERAGING         — many CAPITULATION (≥2)
BREAKOUTS ACTIVE     — many CATALYST-BREAKOUT (≥3)
TRENDING             — many MOMENTUM (≥4), low extremes
COILING              — many COMPRESSION (≥4), few directional
MIXED                — no dominant regime
QUIET                — ≥80% in NEUTRAL
```

Compose a 3-line aggregate block:

```
Market read · {VERDICT_WORD}
  {Regime distribution sentence — counts by regime.}
  {Cycle interpretation — where in the cycle this distribution suggests we are.}
  {Forward expectation — what to watch for next.}
```

This is the only place in `perps-scan` that does explicit interpretation. Follow `writing-style.md` rules strictly. Lead with interpretive verbs. One conclusion per sentence. No semicolons.

### 10. Detect regime transitions

For each asset, compare `regime_today` vs `regime_yesterday`. If different, the transition is surfaced.

**Named transitions (high-signal):**

| Transition | Read |
|---|---|
| ACCUMULATION → CATALYST-BREAKOUT | Patient buyers paid off. High-quality breakout. |
| ACCUMULATION → COMPRESSION | Lost momentum. Accumulation didn't deliver. |
| MOMENTUM → DISTRIBUTION | Trend topping. Take profits or fade. |
| COMPRESSION → CATALYST-BREAKOUT | Coil resolved bullish. Ride the break. |
| COMPRESSION → CAPITULATION | Coil resolved bearish. Fade. |
| DISTRIBUTION → CAPITULATION | Top played out. Mean-revert long for bounce. |
| CAPITULATION → ACCUMULATION | Bottom is in. Quiet long entry. |
| NEUTRAL → ACCUMULATION | Fresh accumulation print. Early entry. |
| Any → SHORT-SQUEEZE | Squeeze in progress. Short-term ride only. |
| Any → CAPITULATION | Flush starting. |

Other transitions are still surfaced but without a specific named read — just `{asset} — {prior} → {current}`.

If `regime_yesterday` is unavailable: surface `(no comparison available — first run or prior artifact missing)` in the REGIME CHANGES section. Don't skip the section.

### 11. Compute repeat markers

For each asset, scan the last 7 days of `memory/logs/${YYYY-MM-DD}.md` for prior `Perps Scan` entries.

- `★` prefix on the asset line if same regime for ≥3 consecutive days
- `(day N)` suffix after metric line if same regime for `N ≥ 2` consecutive days

### 12. Write the structured data artifact

**Write `.outputs/perps-scan.data.json` — a structured JSON intermediate that downstream tooling renders to markdown deterministically. DO NOT write `.outputs/perps-scan.md` directly. The workflow's postprocess step (`scripts/postprocess-perps-scan.sh`) invokes `scripts/render-perps-scan.py` to produce the final markdown artifact from this JSON.**

This structural separation replaces the previous prose-level guardrail that failed three times in one day (ISS-003 / ISS-004 — Claude wrote its end-of-task `## Summary` blob into `.outputs/perps-scan.md` instead of the locked format). With the render moved out of the LLM path, the markdown format cannot be corrupted.

#### JSON schema

```json
{
  "date": "${TODAY}",
  "edge_case": null,
  "verdict": {
    "word": "QUIET | RISK-ON | LEVERAGE BUILDING | EUPHORIC | CHOP | ...",
    "distribution": "1 ACCUMULATION across 12 assessed, 11 NEUTRAL",
    "cycle": "Chop phase, no clear directional bid",
    "forward": "Watch funding shifts on majors"
  },
  "regime_changes": [
    { "asset": "HYPE", "from": "MOMENTUM", "to": "DISTRIBUTION", "note": "First day at extreme funding. Gains slowing." }
  ],
  "regimes": {
    "ACCUMULATION": [
      {
        "asset": "TAO",
        "tier": 2,
        "marker": "star",
        "repeat_days_suffix": "(day 3)",
        "metrics_line": "OI +18% 7d, funding +0.02%/8h, basis +0.3%",
        "tags": [
          { "tag": "ACCUMULATION · CONFIRMED" },
          { "tag": "STEALTH-POSITIONING", "read": "top L/S +0.6 over 7d, leading the signal" }
        ]
      }
    ],
    "CATALYST-BREAKOUT": [],
    "SHORT-SQUEEZE": [],
    "MOMENTUM": [],
    "COMPRESSION": [],
    "DISTRIBUTION": [],
    "CAPITULATION": []
  },
  "regime_empty_notes": {
    "SHORT-SQUEEZE": "no qualifying assets",
    "CAPITULATION": "no major flushes"
  },
  "watch": [
    {
      "asset": "AAVE",
      "metrics_line": "funding rising +0.04% → +0.06% over 7d, OI +5%, range tightening",
      "transition_read": "Reads as transitioning toward DISTRIBUTION."
    }
  ],
  "neutral_summary": "Neutral · 11 other assets · see artifact tail for full data",
  "tail": [
    {
      "asset": "BTC",
      "tier": 1,
      "regime": "MOMENTUM",
      "sub_tags": [],
      "pattern_tags": [],
      "metrics": {
        "price": "$76420",
        "pct_24h": -1.3, "pct_7d": -6.1, "pct_4h": -0.2, "range_7d": 8.4,
        "pct_24h_vs_btc": 0.0, "pct_7d_vs_btc": 0.0,
        "oi_usd": "30.2B", "oi_24h_pct": 3.1, "oi_7d_pct": 6.0,
        "funding_now": 0.07, "funding_7d_avg": 0.06, "funding_delta": 0.01,
        "liq_24h": "$180M", "liq_7d_p75": "$210M",
        "long_liqs": "$100M", "short_liqs": "$80M", "liqs_4h": "$20M",
        "top_ls": 1.4, "top_ls_7d_avg": 1.3, "top_ls_delta_7d": 0.1,
        "basis": 0.3, "taker_buy": 54
      },
      "yesterday_regime": "MOMENTUM",
      "repeat_days": 4
    }
  ]
}
```

#### Field-level rules

- **`date`** — `${TODAY}` (UTC YYYY-MM-DD).
- **`edge_case`** — `null` normally. Set to `"prefetch_failed"` if `manifest.universe_ok == false` or `manifest.json` is missing; render emits the one-line "scan unavailable, prefetch failed" artifact and skips everything else.
- **`verdict.word`** — the aggregate market read from step 9 (single uppercase word or short phrase).
- **`verdict.distribution`** — one sentence, count-style: "N ACCUMULATION across X assessed, Y NEUTRAL".
- **`verdict.cycle`** — one sentence interpreting the cycle phase.
- **`verdict.forward`** — one sentence on what to watch next.
- **`regime_changes`** — array of transitions detected in step 10. Pass `null` (or omit) if no yesterday artifact existed — render emits the "(no comparison available — first run or prior artifact missing)" line. Pass `[]` if there were no transitions today.
- **`regimes`** — map keyed by ALL seven regime names (include empty arrays for unpopulated regimes). Asset order within each array is the order they should appear in the markdown.
- **`regimes[].marker`** — `"star"` for ≥3-day repeat (renders as `★`), `"bullet"` otherwise (renders as `•`).
- **`regimes[].repeat_days_suffix`** — string like `"(day 3)"` for 2+ consecutive days in this regime; omit or null otherwise.
- **`regimes[].metrics_line`** — the metric prose per regime, no leading marker. Follow the v3 adaptive metric line conventions per regime (see step 9 examples).
- **`regimes[].tier`** — `1` or `2`. Render auto-adds `Tier 1 classification.` line under Tier 1 assets.
- **`regimes[].tags[]`** — each `{tag, read?}`. The `read` field is rendered after `—` on the same line as the tag.
- **`regime_empty_notes`** — optional per-regime empty-state suffix; default is `"no qualifying assets"`. Render emits `(empty today — <note>)`.
- **`watch`** — array of WATCH-bucket assets with transition reads. Omit or empty array → WATCH section is suppressed entirely.
- **`neutral_summary`** — one-line summary string for the NEUTRAL count, or null/omit to suppress.
- **`tail`** — verbose per-asset data dump. Include every **assessed** asset (incl. NEUTRAL). Skip dropped assets.
- **`tail[].metrics`** — every numeric field gets passed through. Render substitutes `—` for missing keys.

#### Format rules (enforced by render — no LLM in this path)

- **No asterisks anywhere** in any string value.
- **Dot separator `·`** for inline metadata in tag headers — pre-render this into the `tag` string.
- **CAPS regime names** are produced by the render from `REGIME_ORDER`; do not embed them in metric strings.
- **`★ / •` markers** are produced by the render from the `marker` field; never embed them in strings.
- **Tier 1 classification** line is auto-added by the render when `tier == 1`; do not embed.
- **Blank line between assets** within a regime is added by the render; do not pre-insert.
- **Prose lines** (verdict sentences, transition notes, transition_read) must follow `memory/topics/writing-style.md` — no semicolons, em-dash only for genuine asides, lead with interpretive verbs.

#### Render verification

After writing the JSON, do not write `.outputs/perps-scan.md`. The postprocess step renders it. If the JSON is malformed, the render fails the postprocess step and writes a `scan unavailable, render failed` placeholder — `daily-ops-review` surfaces the failure.

#### Edge cases

- **All NEUTRAL (quiet day)** — populate `verdict.word: "QUIET"`, set every regime to an empty array, include every assessed asset in `tail`.
- **Prefetch failed** — set `edge_case: "prefetch_failed"`; the render produces the one-line artifact.
- **No yesterday artifact** — pass `regime_changes: null`; render produces the "(no comparison available — ...)" line.

#### Sizing expectations

Typical day: ~30-50 lines of rendered locked output + ~5 lines per assessed asset × ~25 assets in the tail = ~150-200 line markdown total. JSON intermediate roughly 8-15 KB. The engine remains the context layer — density is by design.

## Step 13. Log to `memory/logs/${TODAY}.md`

```
## Perps Scan
- **Universe size:** N assets assessed (Tier 1: 3, Tier 2: N-3)
- **Verdict:** {VERDICT} ({regime breakdown counts})
- **Regime counts:** ACCUM=N CAT-BREAK=N MOM=N COMP=N DIST=N CAP=N SHORT-SQ=N NEUTRAL=N
- **Transitions today:** N transitions ({list of changed assets or "none"})
- **Pattern tags surfaced:** [list, deduplicated]
- **Repeat assets (≥2 days same regime):** [list with day counts]
- **Source status:** universe=ok|fail, per-coin fetch failures: [list from manifest.per_coin_errors or "none"]
- **Artifact written:** .outputs/perps-scan.data.json (structured intermediate; rendered to .outputs/perps-scan.md by scripts/postprocess-perps-scan.sh)
- **Notification:** none (internal skill — consumed by perps-brief)
```

## Sandbox note

The sandbox blocks env-var expansion in curl headers, so this skill never calls Coinglass or CoinGecko directly. The pattern is:

1. **Prefetch runs before Claude** — `scripts/prefetch-coinglass.sh` (invoked by the workflow's `Run pre-fetch scripts` step) has full env access. It fetches CoinGecko `/derivatives` for the universe + 8 Coinglass endpoints per coin, writing everything to `.coinglass-cache/` plus a `manifest.json`.
2. **This skill reads only from `.coinglass-cache/`** — no curl, no WebFetch.
3. **Per-coin endpoint failures are non-fatal** — drop coins missing `price`/`oi`/`funding`; for coins missing only v3 additions (price-1h/topls/basis/taker/liq) omit the affected signals from the metric line.

## Environment Variables

- `COINGLASS_API_KEY` — read by `scripts/prefetch-coinglass.sh`, not by this skill directly. Required.
- `COINGECKO_API_KEY` — optional; passed as `x-cg-demo-api-key` header by the prefetch.

## Constraints

- **First-match priority is strict.** Once a coin matches a regime, lower-priority regimes do not apply.
- **Never invent numbers.** If a coin's history is missing, drop it — never carry forward yesterday's value.
- **Tier thresholds are starting defaults.** Refine after 2 weeks of v3 observation. Document changes inline.
- **FAILED-MOVE deferred to v3.1.** Needs intraday high tracking the current data layer doesn't expose.
- **Tier 3 (meme/micro perps) intentionally excluded.** Signal-to-noise too low at this layer. Discovery happens in `perps-brief` Pass 0 if a meme catches operator attention.
- **STEALTH-POSITIONING threshold** (`top_ls_delta_7d > +0.4`) is a starting value. Adjust after 1 week if signal-to-noise is off.
- **Apply `memory/topics/writing-style.md` to every prose line.** No semicolons, em-dash only for genuine asides, one conclusion per sentence, lead with interpretive verbs.

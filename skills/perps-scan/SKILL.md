---
name: Perps Scan
description: Classify the cross-exchange perps universe (CoinGecko-ranked + Coinglass v4 metrics) into 7 regimes (CAPITULATION, SHORT-SQUEEZE, DISTRIBUTION, CATALYST-BREAKOUT, ACCUMULATION, MOMENTUM, COMPRESSION + NEUTRAL) with tier-adjusted thresholds, sub-tags, cross-signal pattern tags, and day-over-day regime transitions
var: ""
tags: [crypto]
---
<!-- v3: foundation context layer for perps-brief. Substantial upgrade from v2.3: derived fields (funding_delta, pct_4h, pct_24h_vs_btc, top_ls_delta_7d, split long/short liquidations), tier-adjusted thresholds (Tier 1 = BTC/ETH/SOL, Tier 2 = rest), new SHORT-SQUEEZE regime, sub-tags within regimes, cross-signal pattern tags (REAL-CROWDED-LONG, RETAIL-ANOMALY, LONG-TRAP, STEALTH-POSITIONING, CASH-AND-CARRY), day-over-day regime transitions, aggregate market read. See Perps_Engine_v3.md for full spec. FAILED-MOVE deferred to v3.1 (needs intraday). -->

> **${var}** — Optional asset list override (comma-separated coin tickers). If empty, scans the top 25 by aggregated perp 24h volume across Binance/OKX/Bybit via CoinGecko `/derivatives` + always-include BTC/ETH/SOL.

Today is ${today}. Classify the cross-exchange perps universe using tier-adjusted thresholds, derived fields, sub-tags, pattern tags, and day-over-day regime transitions. This is an **internal** skill: writes `.outputs/perps-scan.md` for downstream `perps-brief` consumption and `daily-ops-review` auditing. **Does not post to Discord** — the engine is the context layer; the brief is what the operator reads.

**Apply `memory/topics/writing-style.md` to all prose output in this skill** — interpretation lines, transition reads, pattern-tag reads. Specifically: lead sentences with interpretive verbs; no semicolons in body text; em-dash only for genuine asides; one idea per paragraph; commit to actions; quantify whenever possible. The classification lines are data lines (less prose-heavy) but every interpretation line obeys the style guide.

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

### 12. Write the artifact (v3 locked format)

**CRITICAL — artifact vs assistant Summary separation (ISS-003 guardrail).** The content of `.outputs/perps-scan.md` is the locked-format text shown below — and only that text. It is NOT the assistant's `## Summary` block, NOT a description of what you did, NOT prose narration. Compose the locked-format payload as a string FIRST, write it, and only THEN compose the chat-side `## Summary` separately. If the artifact ever begins with `## Summary` or `**What I did**`, it is wrong — overwrite.

**Locked v3 format:**

```
Perps Regimes · ${TODAY}

Market read · {VERDICT_WORD}
  {regime distribution sentence}
  {cycle interpretation}
  {forward expectation}

REGIME CHANGES (since yesterday)
  HYPE — MOMENTUM → DISTRIBUTION
    First day at extreme funding. Gains slowing. Topping signal forming.
  SOL — ACCUMULATION → CATALYST-BREAKOUT
    Patient build paid off. Clean break, taker buy confirms.
  AVAX — NEUTRAL → COMPRESSION
    Range tightening, OI starting to build. Pre-move setup.

ACCUMULATION

★ TAO — OI +18% 7d, funding +0.02%/8h, basis +0.3% (day 3)
  Tag: ACCUMULATION · CONFIRMED
  Tag: STEALTH-POSITIONING — top L/S +0.6 over 7d, leading the signal

CATALYST-BREAKOUT

• SOL — +14% 24h (+9% last 4h), vol 2.4x avg, OI +11%, taker buy 58%
  Tier 1 classification.
  Tag: CATALYST-BREAKOUT · FRESH

SHORT-SQUEEZE

(empty today — no qualifying assets)

MOMENTUM

• BTC — 7d +6%, OI +6% 24h, funding +0.07%/8h, basis +0.3%
  Tier 1 classification.

• ETH — 7d +4%, OI flat, funding +0.04%/8h, basis +0.2%
  Tier 1 classification.

COMPRESSION

• AVAX — range_7d 4.2%, OI +8% 7d, funding flat, basis +0.1%
  Tag: COMPRESSION · QUIET — volume contracting, no immediate trigger

DISTRIBUTION

• FARTCOIN — funding +0.14%/8h (delta +0.08%), OI +35% 24h, basis +0.6%
  Tag: REAL-CROWDED-LONG — top L/S 2.3, smart money also long.
  Read: Real top risk. Cleanest fade setup in the scan.

• BONK — funding +0.10%/8h (delta +0.06%), OI +22% 24h, basis +0.4%
  Tag: RETAIL-ANOMALY — top L/S 1.3, smart money not following.
  Read: Funding extreme but smart money out. Squeeze risk over fade.

• PEPE — funding +0.10%/8h, price -2% 24h, OI flat
  Tag: LONG-TRAP — longs paying premium while bleeding.
  Read: Highest-severity distribution. Failure imminent.

CAPITULATION

(empty today — no major flushes)

WATCH (early signals, no full regime)

• AAVE — funding rising +0.04% → +0.06% over 7d, OI +5%, range tightening
  Reads as transitioning toward DISTRIBUTION.

• LDO — top L/S +0.5 over 7d, basis turning positive, price quiet
  Reads as pre-ACCUMULATION. STEALTH-POSITIONING tag applies.

Neutral · 11 other assets · see artifact tail for full data
```

### Format rules

- **No asterisks anywhere.** Plain text only.
- **Dot separator `·`** for inline metadata in titles and tag headers.
- **CAPS section headers** for major divisions. Empty regimes show with `(empty today — reason)` parenthetical.
- **`★`** prefix for ≥3-day repeats; `•` otherwise.
- **Tag lines** indented two spaces under the asset, beginning `Tag: `.
- **Read lines** indented two spaces under the tag, beginning `Read: ` — used only when the tag combination warrants explicit interpretation.
- **Tier 1 explicit marker** on major assets so the reader knows tier thresholds applied.
- **Blank line between assets within a regime section** for visual rhythm (writing-style.md compliance).
- **WATCH bucket**: assets where ≥2 signals favor a single direction and none contradict but no regime criteria fully fire. Surface with a brief transition read.

### Artifact tail (verbose data dump for perps-brief)

After the locked output above, append a structured per-asset block at the bottom of `.outputs/perps-scan.md` (NOT included in any notification — this skill never notifies). The tail provides raw values for every signal field including the v3 derived fields. Use this format:

```
---
ARTIFACT DATA TAIL (consumed by perps-brief Pass 0)

Asset: BTC | Tier: 1 | Regime: MOMENTUM | Sub-tags: — | Pattern tags: —
  price: $76420 | pct_24h: -1.3 | pct_7d: -6.1 | pct_4h: -0.2 | range_7d: 8.4
  pct_24h_vs_btc: 0.0 | pct_7d_vs_btc: 0.0
  oi: 30.2B | oi_24h_pct: +3.1 | oi_7d_pct: +6.0
  funding_now: +0.07 | funding_7d_avg: +0.06 | funding_delta: +0.01
  liq_24h: $180M | liq_7d_p75: $210M | long_liqs: $100M | short_liqs: $80M | liqs_4h: $20M
  top_ls: 1.4 | top_ls_7d_avg: 1.3 | top_ls_delta_7d: +0.1
  basis: +0.3 | taker_buy: 54
  yesterday_regime: MOMENTUM | repeat_days: 4

Asset: SOL | ...
```

Include every assessed asset (including NEUTRAL) — `perps-brief`'s Pass 0 discovery needs the full universe of structured data. Skip assets that were dropped for missing critical files (price/oi/funding) — they were never assessed.

### Edge cases

- **All NEUTRAL (quiet day)**: still write the full v3 format. Show empty regime sections with `(empty today — no qualifying assets)`. Aggregate read verdict = `QUIET`. The artifact tail still includes every assessed asset.
- **Prefetch failed** (`manifest.universe_ok == false`, or `manifest.json` missing): write a one-line variant:
  ```
  Perps Regimes · ${TODAY} · scan unavailable, prefetch failed
  ```
  `daily-ops-review` surfaces the cause.
- **No yesterday artifact**: REGIME CHANGES section reads `(no comparison available — first run or prior artifact missing)`.

### Verbosity expectations

Typical day: ~30-50 lines for the locked output, plus the artifact tail (~5 lines per assessed asset × ~25 assets = ~125 lines). Total artifact roughly 150-200 lines. Substantially longer than v2 — by design. The engine is the context layer.

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
- **Artifact written:** .outputs/perps-scan.md (locked output + verbose tail)
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

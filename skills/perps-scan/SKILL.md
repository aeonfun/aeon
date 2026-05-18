---
name: Perps Scan
description: Classify the cross-exchange perps universe (universe ranked via CoinGecko derivatives, per-coin metrics via Coinglass v4) into 6 regimes (Accumulation, Catalyst-Breakout, Momentum, Compression, Distribution, Capitulation)
var: ""
tags: [crypto]
---
<!-- v2.3: foundation skill for the perps sector brief. Raw classification, not synthesis. After Coinglass's coins-markets endpoint was confirmed tier-gated on Startup (coinglass-probe rounds 1-2), v2.3 sources the universe from CoinGecko /derivatives and expands per-coin metrics to seven Coinglass endpoints (adds top-trader L/S position ratio, basis, taker buy/sell). All data is fetched by scripts/prefetch-coinglass.sh before Claude runs. -->

> **${var}** — Optional asset list override (comma-separated coin tickers, e.g. `HYPE,TAO,AVAX`). If empty, scans the top 25 coins by aggregated perp 24h volume across exchanges (via CoinGecko `/derivatives`) + always-include BTC/ETH/SOL.

Today is ${today}. Classify the cross-exchange perps universe into 6 regimes using CoinGecko-ranked universe + Coinglass v4 per-coin metrics. This is a **signal** skill: writes `.outputs/perps-scan.md` for downstream `perps-brief` consumption and posts to Discord via `./notify --signal` routing to `#perps`.

Read `memory/MEMORY.md` for context.
Read the last 7 days of `memory/logs/` to find ★ repeat markers — assets in the same regime for ≥3 consecutive days, and `(day N)` markers for 2+ consecutive days.

## Goal

Bucket every assessed asset into exactly one of six regimes (or NEUTRAL catch-all) using a first-match priority order. Output the locked v2 format. Operator-grade thresholds documented inline — refine after observing 2 weeks of output.

## Data source

All data is **pre-fetched** by `scripts/prefetch-coinglass.sh` (runs before Claude, outside the sandbox) and cached to `.coinglass-cache/`. This skill reads only from the cache — never calls curl directly (the sandbox blocks env-var expansion in curl headers; see ISS-001).

Two providers:
- **CoinGecko `/derivatives`** ranks the universe (Startup Coinglass plan does not include the `coins-markets` universe endpoint — see ISS-002, superseded by this design).
- **Coinglass v4** supplies all per-coin metric histories (7 endpoints, tier-confirmed accessible).

Cache layout (populated by the prefetch):
- `.coinglass-cache/manifest.json` — `{ fetched_at, universe_ok, universe_source, asset_list, per_coin_errors }`. **Always check `universe_ok` first** — if `false`, jump to the "scan unavailable" output (step 6, edge case).
- `.coinglass-cache/cg-derivatives.json` — raw CoinGecko `/derivatives` response. Used by the prefetch to build `asset_list`; this skill rarely needs to re-read it (asset list is in the manifest).
- `.coinglass-cache/price-<COIN>.json` — Binance per-exchange daily price OHLC + volume (8d).
- `.coinglass-cache/oi-<COIN>.json` — aggregated OI history (8d).
- `.coinglass-cache/funding-<COIN>.json` — OI-weighted funding history (21 × 8h = 7d).
- `.coinglass-cache/liq-<COIN>.json` — aggregated liquidation history with `exchange_list=Binance,OKX` (8d).
- `.coinglass-cache/topls-<COIN>.json` — top-trader long/short position ratio (8d). Smart-money sentiment signal.
- `.coinglass-cache/basis-<COIN>.json` — futures-spot basis (8d). Restores the v1 spec confirming criterion.
- `.coinglass-cache/taker-<COIN>.json` — taker buy/sell volume (8d). Order-flow direction.

All Coinglass responses follow the shape `{ "code": "0", "msg": "success", "data": [...] }`. History endpoints return `data: [{ time, open, high, low, close, ... }]` with `time` in milliseconds and `data[0]` being the most recent interval. For `taker-buy-sell-volume/history`, each row carries `buy_volume` and `sell_volume` (compute the buy ratio at runtime). For `top-long-short-position-ratio/history`, `close` is the ratio (>1 = top traders net long, <1 = net short).

If a per-coin endpoint file is missing or invalid (the prefetch logs the per-coin failures in `manifest.per_coin_errors`), drop that coin from the regime classification and continue.

## Steps

### 1. Verify the prefetch succeeded

```bash
TODAY=$(date -u +%Y-%m-%d)
CACHE=.coinglass-cache

if [ ! -f "$CACHE/manifest.json" ] || ! jq -e '.universe_ok == true' "$CACHE/manifest.json" >/dev/null 2>&1; then
  # Prefetch didn't run or CoinGecko /derivatives failed — go straight to "scan unavailable"
  # (see step 6 edge case)
  exit 0
fi
```

If `manifest.universe_ok == false`, jump to step 6's "scan unavailable" output. Log `universe=fail` in step 9.

### 2. Read the asset list

The prefetch already resolved the asset list (VAR override OR top 25 by CoinGecko aggregated perp 24h volume + force-include BTC/ETH/SOL). It's in the manifest:

```bash
ASSET_LIST=$(jq -r '.asset_list[]' "$CACHE/manifest.json")
```

There is no `coins.json` shortcut in v2.3 — every metric is derived from the per-coin history endpoints in step 4. Move directly to step 3.

### 3. Read per-asset history from cache

For each coin in `ASSET_LIST`, the prefetch has written **seven** files: `price-<COIN>.json`, `oi-<COIN>.json`, `funding-<COIN>.json`, `liq-<COIN>.json`, `topls-<COIN>.json`, `basis-<COIN>.json`, `taker-<COIN>.json`. Each follows the Coinglass response shape `{ "code": "0", "data": [...] }`.

```bash
for COIN in $ASSET_LIST; do
  for KIND in price oi funding liq topls basis taker; do
    FILE="$CACHE/${KIND}-${COIN}.json"
    # If a critical file is missing OR doesn't validate, drop this coin.
    # "Critical" = price + oi + funding (regime classification needs these).
    # Missing topls/basis/taker/liq just means we omit those signals from the metric line for that coin.
    [ -f "$FILE" ] && jq -e '.code == "0" and (.data | length > 0)' "$FILE" >/dev/null 2>&1 \
      || case "$KIND" in price|oi|funding) continue 2 ;; esac
  done
  # Critical files OK — proceed with metrics in step 4
done
```

`data[0]` is the most recent interval. The manifest's `per_coin_errors` array lists exactly which endpoints failed for which coins during prefetch — use it for the step-9 log without re-checking each file.

### 4. Compute per-asset metrics

Every metric is derived from per-coin endpoint files (no coins-markets shortcut). `data[0]` is the most recent interval throughout.

| Metric | Formula |
|---|---|
| `current_price` | `price.data[0].close` (Binance per-exchange daily close, latest) |
| `pct_24h` | `(price.data[0].close - price.data[1].close) / price.data[1].close * 100` |
| `pct_7d` | `(price.data[0].close - price.data[7].close) / price.data[7].close * 100` |
| `vol_ratio` | `price.data[0].volume / mean(price.data[1..7].volume)` — Binance daily USDT-perp volume. If `volume` field missing, default `1.0` (neutral). |
| `range_7d_pct` | `(max(price.data[0..6].high) - min(price.data[0..6].low)) / min(price.data[0..6].low) * 100` |
| `oi_now` | `oi.data[0].close` (aggregated OI in USD, latest daily bucket) |
| `oi_24h_pct` | `(oi.data[0].close - oi.data[1].close) / oi.data[1].close * 100` |
| `oi_7d_pct` | `(oi.data[0].close - oi.data[7].close) / oi.data[7].close * 100` |
| `funding_now` | `funding.data[0].close` (OI-weighted 8h funding rate, latest interval) |
| `funding_7d_avg` | mean of `funding.data[0..20].close` (last 21 × 8h = 7 days) |
| `liq_24h` | `liq.data[0].close` (aggregated 24h liquidation USD, latest daily bucket — Binance + OKX) |
| `liq_7d_p75` | 75th percentile of `liq.data[0..7].close` — "top quartile 7d" threshold for CAPITULATION |
| **`top_ls_now`** | `topls.data[0].close` — top-trader L/S **position** ratio, latest day. `>1` = top traders net long, `<1` = net short. Smart-money sentiment. |
| **`top_ls_7d_avg`** | mean of `topls.data[0..6].close` |
| **`basis_now`** | `basis.data[0].close` — futures-spot basis %, latest day. Positive = futures premium (institutional bid), negative = discount. |
| **`basis_7d_avg`** | mean of `basis.data[0..6].close` |
| **`taker_buy_pct_24h`** | `taker.data[0].buy_volume / (taker.data[0].buy_volume + taker.data[0].sell_volume) * 100` — aggressive buy share of taker volume, latest day. (If Coinglass returns a precomputed ratio in `close`, use that instead — examine the response shape at runtime.) |

Round funding + basis to 3 decimals; ratios (L/S, taker buy %) to 2 decimals; everything else to 1 decimal.

**If a coin is missing one of the v2.3 additions** (`topls`, `basis`, `taker`, `liq`) but has the critical three (`price`, `oi`, `funding`), classify it normally — just omit the missing signal from its metric line. Don't drop the coin.

### 5. Classify each coin into a regime

**First-match priority order** (top of list wins, evaluated in order):

| Order | Regime | Trigger (all conditions must hold unless noted) |
|---|---|---|
| 1 | **CAPITULATION** | `pct_24h <= -10` AND `funding_now < 0` AND `oi_24h_pct <= -10` AND `liq_24h >= liq_7d_p75` |
| 2 | **DISTRIBUTION** | (`funding_now > 0.08` OR `funding_7d_avg > 0.06`) AND `pct_24h < pct_7d / 7` (gains slowing) AND `oi_24h_pct > 5` (OI still building into the high funding — the "crowded long" tell) |
| 3 | **CATALYST-BREAKOUT** | (`pct_24h > 20` OR price broke above 7d high) AND `vol_ratio > 2.0` AND `oi_24h_pct > 10` |
| 4 | **ACCUMULATION** | `oi_7d_pct > 10` AND `abs(funding_7d_avg) < 0.04` AND `pct_7d > 0` AND `range_7d_pct < 25` |
| 5 | **MOMENTUM** | `pct_7d > 15` AND `oi_24h_pct >= 0` AND `funding_now > 0.03` AND `funding_now <= 0.07` |
| 6 | **COMPRESSION** | `range_7d_pct < 5` AND `oi_7d_pct > 5` AND `abs(funding_now) < 0.02` AND `abs(pct_24h) < 2` |
| 7 | **NEUTRAL** | none of the above match |

These thresholds are **v2.1 starting defaults** (Coinglass migration). After 2 weeks of observation, refine inline in this file (and note the change date + reasoning in a comment). If a multi-day pattern emerges where a regime triggers too rarely or too commonly, adjust.

**Note on classifier vs diagnostic signals (v2.3):** The classifier trigger rules above are deliberately conservative — same logic as v2.1, no new mandatory conditions added in v2.3. The new signals (`top_ls_*`, `basis_*`, `taker_buy_pct_24h`) appear only in each regime's **diagnostic metric line** (step 8), where they confirm or contradict the regime read. Operator interprets. After 2-4 weeks of observation we may promote one of them to a mandatory criterion in a follow-up — but only after seeing whether it materially improves precision/recall on real classifications.

**Liquidation criterion restored:** CAPITULATION now requires 4 confluence signals (the original v2 spec design). The `liq_7d_p75` threshold means today's 24h liquidations must be in the top quartile of the last 7 days — flushes are relative to recent activity, not an absolute number.

### 6. Compute the verdict header

Count assets per regime. Map to a verdict label using the dominant pattern:

| Verdict | When |
|---|---|
| **LEVERAGE BUILDING** | ≥3 ACCUMULATION/MOMENTUM, ≤1 DISTRIBUTION, 0 CAPITULATION |
| **CROWDED LONG** | ≥3 DISTRIBUTION |
| **DELEVERAGING** | ≥2 CAPITULATION |
| **BREAKOUTS ACTIVE** | ≥3 CATALYST-BREAKOUT |
| **TRENDING** | ≥4 MOMENTUM |
| **COILING** | ≥4 COMPRESSION |
| **MIXED** | multiple regimes populated but no dominant pattern |
| **QUIET** | ≥80% of assets in NEUTRAL |

Append a parenthetical detail summarizing the breakdown, e.g. `LEVERAGE BUILDING (4 ACCUMULATION/MOMENTUM, 1 DISTRIBUTION, 0 CAPITULATION)`.

### 7. Compute repeat markers

For each asset, scan the last 7 days of `memory/logs/${YYYY-MM-DD}.md` for prior `Perps Scan` entries. Record the regime each asset was in on each prior day.

- **★** prefix if asset has been in the **same regime for ≥3 consecutive days**
- **`(day N)`** suffix after metric line if asset has been in the same regime for `N >= 2` consecutive days

### 8. Write artifact + notify (v2 locked format)

Write both `.outputs/perps-scan.md` and notify content. Format (under 4000 chars total — if needed, drop NEUTRAL section and write `Neutral · N other assets · see artifact for full data`):

```
Perps Regimes · ${TODAY} · {VERDICT} ({parenthetical breakdown})

ACCUMULATION
★ HYPE — OI +18% 7d, funding +0.02%/8h, 7d range 18% (day 3)
• SOL — OI +12% 7d, funding +0.02%/8h, 7d +4%

CATALYST-BREAKOUT
• AVAX — +14% 24h, vol 2.4x avg, OI +11% 24h, funding +0.05%/8h
• LINK — +8% 24h, vol 2.1x avg, OI +9% 24h

MOMENTUM
• BTC — 7d +6%, OI +6% 24h, funding +0.07%/8h
• ETH — 7d +4%, OI flat, funding +0.04%/8h

COMPRESSION
• TAO — 7d range 5%, OI +9% 7d, funding flat
• ATOM — 7d range 6%, OI +6% 7d, funding flat

DISTRIBUTION
• FARTCOIN — funding +0.14%/8h (extreme), OI +35% 24h, L/S 2.8

CAPITULATION (empty — no flushes in top 7d quartile)

Neutral · 13 other assets · see artifact for full data
```

**Universal formatting rules (v2):**
- No asterisks (`*` or `**`) anywhere. Plain text only.
- Title: `Perps Regimes · ${TODAY} · {VERDICT} ({detail})`.
- Section headers in CAPS, no leading symbols. Empty sections omitted entirely OR shown with `(empty — reason)` parenthetical.
- Dot separator `·` for inline metadata.
- `★` for ≥3-day repeat in same regime; `•` for first-day or 2-day appearances.
- No source footers — `daily-ops-review` handles source health.

**Adaptive metric line per regime (v2.3 — extended with new signals where diagnostic):**
- ACCUMULATION: OI growth (7d) + funding (neutral) + 7d range + **basis** (positive basis confirms institutional bid)
- CATALYST-BREAKOUT: 24h % + volume ratio + OI 24h + **taker buy %** (>55% confirms real flow, <50% suggests short squeeze fade)
- MOMENTUM: 7d % + OI + funding (moderate positive) + **top L/S** (smart-money long bias adds confidence)
- COMPRESSION: 7d range + OI 7d + funding (flat) + **basis** (tight basis confirms genuine coil)
- DISTRIBUTION: funding (extreme) + OI 24h still building + **top L/S** (smart money long-biased confirms crowded long thesis; if smart money is NOT long, the funding extreme may be a retail anomaly worth flagging)
- CAPITULATION: 24h drawdown + funding (negative) + OI drop + 24h liquidations + **top L/S** (smart money flipped short signals full capitulation)

Example metric lines with v2.3 signals:

```
ACCUMULATION
★ HYPE — OI +18% 7d, funding +0.02%/8h, 7d range 18%, basis +0.15% (day 3)
• SOL — OI +12% 7d, funding +0.02%/8h, 7d +4%, basis +0.08%

CATALYST-BREAKOUT
• AVAX — +14% 24h, vol 2.4x avg, OI +11% 24h, taker buy 62%
• LINK — +8% 24h, vol 2.1x avg, OI +9% 24h, taker buy 48% (squeeze risk)

DISTRIBUTION
• FARTCOIN — funding +0.14%/8h, OI +35% 24h, top L/S 2.1 (crowded long confirmed)
```

**Edge cases:**
- All NEUTRAL (quiet day): write a single-line variant for both artifact and notification:
  ```
  Perps Regimes · ${TODAY} · QUIET (no regime populated, see artifact)
  ```
  Still write the full per-asset metric table to `.outputs/perps-scan.md` so downstream consumers can read raw data.
- Prefetch failure (`manifest.universe_ok == false`, or `manifest.json` missing): write a one-line variant:
  ```
  Perps Regimes · ${TODAY} · scan unavailable, prefetch failed
  ```
  `daily-ops-review` surfaces the cause from `manifest.json` (which records `universe_source` + the failing HTTP code) and any errors in `memory/issues/`.

**Invocation:**
```bash
./notify --signal "$(cat .outputs/perps-scan.md)"
```
The `--signal` flag suppresses Telegram delivery; Discord routing via `DISCORD_WEBHOOK_MAP[perps-scan]` targets `#perps` (shared with `perps-brief`).

### 9. Log to `memory/logs/${TODAY}.md`

```
## Perps Scan
- **Universe size:** N assets assessed
- **Verdict:** {VERDICT} ({breakdown})
- **Regime counts:** ACCUM=N CAT=N MOM=N COMP=N DIST=N CAP=N NEUTRAL=N
- **Repeat assets (≥2 days same regime):** [list with day counts]
- **Source status:** universe=ok|fail (source: `manifest.universe_source`), per-coin fetch failures: [list from `manifest.per_coin_errors`, or "none"]
- **Artifact written:** .outputs/perps-scan.md
- **Notification sent:** yes|no (reason if no) — via `./notify --signal` to #perps
```

## Sandbox note

The sandbox blocks env-var expansion in curl headers, which is why this skill never calls Coinglass or CoinGecko directly. The pattern is:

1. **Prefetch runs before Claude** — `scripts/prefetch-coinglass.sh` (invoked by the workflow's `Run pre-fetch scripts` step) has full env access. It fetches CoinGecko `/derivatives` for the universe + 7 Coinglass endpoints per coin, writing everything to `.coinglass-cache/` plus a `manifest.json` with `universe_ok`, `universe_source`, `asset_list`, `per_coin_errors`.
2. **This skill reads only from `.coinglass-cache/`** — no curl, no WebFetch. The skill checks `manifest.universe_ok` first; if `false`, jump straight to the locked "scan unavailable" output (step 6 edge case).
3. **Per-coin endpoint failures are non-fatal** — `manifest.per_coin_errors` lists exactly which `{coin, endpoint}` pairs failed. Drop coins missing critical files (price/oi/funding); for coins missing only v2.3 additions (topls/basis/taker/liq) just omit those signals from the metric line. Log all in step 9. Do not abort the whole scan.

If the prefetch was never run (e.g. someone invokes Claude directly outside the workflow), `.coinglass-cache/` won't exist — fall through to "scan unavailable" gracefully.

## Environment Variables

- `COINGLASS_API_KEY` — read by `scripts/prefetch-coinglass.sh`, **not by this skill directly**. Required.
- `COINGECKO_API_KEY` — optional; if set, passed as `x-cg-demo-api-key` header to lift CoinGecko's rate cap. Free unauthenticated calls also work for daily cadence.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- **First-match priority is strict.** Once a coin matches a regime, lower-priority regimes do not apply. This prevents double-counting and keeps the bucketing deterministic.
- **Never invent numbers.** If a coin's history calls failed, drop it from the output — don't carry forward yesterday's metric.
- **Thresholds are v2.1 starting points** (Coinglass migration; data path moved to prefetch in v2.2; universe + signal set extended in v2.3). Refine after 2 weeks of observation. Document changes inline.
- **Liquidation criterion is active in CAPITULATION** — `liq_7d_p75` baseline means a flush is detected relative to recent activity, not against an absolute USD threshold.
- **Basis is exposed but not yet mandatory** — v2.3 brings basis back from the per-exchange `basis/history` endpoint, but uses it only in diagnostic metric lines for now (see "classifier vs diagnostic signals" note in step 5). Promotion to a mandatory criterion in ACCUMULATION/COMPRESSION is a deliberate 2-4 week observation decision.
- **Smart-money L/S available** — top-trader position ratio (`top_ls_*`) is a v2.3 addition. Diagnostic-only in this version; may be promoted to a confirming criterion for DISTRIBUTION/CAPITULATION after observation.
- **Notification under 4000 chars.** If output exceeds, drop empty sections, use the `Neutral · N other assets · see artifact` line, or shorten metric lines.

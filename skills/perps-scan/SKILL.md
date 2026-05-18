---
name: Perps Scan
description: Classify the cross-exchange perps universe (Binance + Bybit + OKX, aggregated via Coinglass) into 6 regimes (Accumulation, Catalyst-Breakout, Momentum, Compression, Distribution, Capitulation)
var: ""
tags: [crypto]
---
<!-- v2.2: foundation skill for the perps sector brief. Raw classification, not synthesis. Coinglass v4 data layer (migrated from Bybit due to GitHub Actions geo-block on Bybit). Data is fetched by scripts/prefetch-coinglass.sh before Claude runs (sandbox blocks env-var expansion in curl headers — ISS-001). -->

> **${var}** — Optional asset list override (comma-separated coin tickers, e.g. `HYPE,TAO,AVAX`). If empty, scans the top 25 coins by aggregated open-interest USD + always-include BTC/ETH/SOL.

Today is ${today}. Classify the cross-exchange perps universe into 6 regimes using Coinglass v4 aggregated data. This is a **signal** skill: writes `.outputs/perps-scan.md` for downstream `perps-brief` consumption and posts to Discord via `./notify --signal` routing to `#perps`.

Read `memory/MEMORY.md` for context.
Read the last 7 days of `memory/logs/` to find ★ repeat markers — assets in the same regime for ≥3 consecutive days, and `(day N)` markers for 2+ consecutive days.

## Goal

Bucket every assessed asset into exactly one of six regimes (or NEUTRAL catch-all) using a first-match priority order. Output the locked v2 format. Operator-grade thresholds documented inline — refine after observing 2 weeks of output.

## Data source

Coinglass v4 API (Startup tier). Data is **pre-fetched** by `scripts/prefetch-coinglass.sh` (which runs before Claude, outside the sandbox, with `COINGLASS_API_KEY` access) and cached to `.coinglass-cache/`. This skill reads only from the cache — never calls curl directly (the sandbox blocks env-var expansion in curl headers; see ISS-001).

Coinglass aggregates cross-exchange (Binance + Bybit + OKX by default) — regime classification reflects the whole perps market, not one venue. All endpoints accept coin tickers (`BTC`, `ETH`) rather than pair symbols.

Cache layout (populated by the prefetch):
- `.coinglass-cache/manifest.json` — `{ fetched_at, coins_markets_ok, asset_list, per_coin_errors }`. **Always check `coins_markets_ok` first** — if `false`, jump to the "scan unavailable" output (step 6, edge case).
- `.coinglass-cache/coins.json` — coins-markets response (universe + current metrics: price, 24h change, OI USD, funding rate, 24h volume, **24h liquidations split long/short**, long/short ratio).
- `.coinglass-cache/price-<COIN>.json` — daily price history (8d).
- `.coinglass-cache/oi-<COIN>.json` — aggregated OI history (8d).
- `.coinglass-cache/funding-<COIN>.json` — OI-weighted funding history (21 × 8h = 7d).
- `.coinglass-cache/liq-<COIN>.json` — aggregated liquidation history (8d).

All Coinglass responses follow the shape `{ "code": "0", "msg": "success", "data": [...] }`. History endpoints return `data: [{ time, open, high, low, close }]` with `time` in milliseconds and OHLC values as numbers (close-of-interval is the bucket total for liquidations).

If a per-coin endpoint file is missing or invalid (the prefetch logs the per-coin failures in `manifest.per_coin_errors`), drop that coin from the regime classification and continue.

## Steps

### 1. Read the universe + current metrics from cache

```bash
TODAY=$(date -u +%Y-%m-%d)
CACHE=.coinglass-cache

# Step 1a: verify the prefetch succeeded
if [ ! -f "$CACHE/manifest.json" ] || ! jq -e '.coins_markets_ok == true' "$CACHE/manifest.json" >/dev/null 2>&1; then
  # Prefetch didn't run or failed at universe call — go straight to "scan unavailable"
  # (see step 6 edge case)
  exit 0
fi

# Step 1b: load the universe + current metrics
if ! jq -e '.code == "0" and (.data | length > 0)' "$CACHE/coins.json" >/dev/null 2>&1; then
  exit 0  # prefetch wrote a file but Coinglass returned an error shape — same fallback
fi
```

If `manifest.coins_markets_ok == false` OR `coins.json` doesn't validate, jump to step 6's "scan unavailable" output. Log `coinglass_coins=fail` in step 9.

### 2. Read the asset list

The prefetch already resolved the asset list (VAR override OR top 25 by OI + force-include BTC/ETH/SOL). It's in the manifest:

```bash
ASSET_LIST=$(jq -r '.asset_list[]' "$CACHE/manifest.json")
```

Per asset, extract current-state values from `coins.json` (entries in `data[]`, matched on `symbol`):
- `current_price`
- `price_change_percent_24h` (current 24h % move)
- `open_interest_usd` (current OI in USD)
- `avg_funding_rate_by_oi` (cross-exchange OI-weighted current 8h funding, %)
- `open_interest_change_percent_24h`
- `liquidation_usd_24h` (total 24h liquidations), `long_liquidation_usd_24h`, `short_liquidation_usd_24h`
- `long_short_ratio_24h` (sentiment proxy — bonus signal)

If a coin from `asset_list` isn't in `coins.json.data[]` (rare — would indicate the universe changed between prefetch passes), drop it and continue.

### 3. Read per-asset history from cache

For each coin in `ASSET_LIST`, the prefetch has written four files (`price-<COIN>.json`, `oi-<COIN>.json`, `funding-<COIN>.json`, `liq-<COIN>.json`). Each follows the Coinglass response shape `{ "code": "0", "data": [{ time, open, high, low, close }] }`.

```bash
for COIN in $ASSET_LIST; do
  for KIND in price oi funding liq; do
    FILE="$CACHE/${KIND}-${COIN}.json"
    # If a file is missing OR doesn't validate, this coin gets dropped — check manifest.per_coin_errors
    [ -f "$FILE" ] && jq -e '.code == "0" and (.data | length > 0)' "$FILE" >/dev/null 2>&1 || continue 2
  done
  # All four files OK — proceed with metrics in step 4
done
```

`data[0]` is the most recent interval. For liquidation history, `close` represents the bucketed total liquidation USD for that interval.

The manifest's `per_coin_errors` array lists exactly which endpoints failed for which coins during prefetch — use it for the step-9 log without re-checking each file.

### 4. Compute per-asset metrics

For each coin, compute:

| Metric | Formula |
|---|---|
| `pct_24h` | `price_change_percent_24h` (already a percent from coins-markets) |
| `pct_7d` | `(current_price - price.data[6].close) / price.data[6].close * 100` (price.data[0] is most recent daily candle) |
| `oi_now` | `open_interest_usd` from coins-markets |
| `oi_24h_pct` | `open_interest_change_percent_24h` from coins-markets |
| `oi_7d_pct` | `(oi.data[0].close - oi.data[7].close) / oi.data[7].close * 100` from open-interest/aggregated-history |
| `funding_now` | `avg_funding_rate_by_oi` from coins-markets (already a percent per 8h) |
| `funding_7d_avg` | mean of `funding.data[0..20].close` (last 21 entries × 8h = 7 days) |
| `vol_ratio` | `current daily volume / mean(price.data[0..6].volume)` — Coinglass kline returns volume; use it to compute 24h-vs-7d-avg ratio. If Coinglass kline lacks volume, default `vol_ratio = 1.0` (neutral) so the CATALYST-BREAKOUT criterion falls back to the price + OI clauses |
| `range_7d_pct` | `(max(price.data[0..6].high) - min(price.data[0..6].low)) / min(price.data[0..6].low) * 100` |
| `liq_24h` | `liquidation_usd_24h` from coins-markets (total USD liquidated in last 24h) |
| `liq_7d_p75` | 75th percentile of `liq.data[0..7].close` — the "top quartile 7d" liquidation threshold for CAPITULATION confirmation |
| `ls_ratio_24h` | `long_short_ratio_24h` from coins-markets (optional sentiment proxy, not used in classification but shown in DISTRIBUTION/CAPITULATION metric lines) |

Round funding to 3 decimals; everything else to 1 decimal for the output.

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

**Note on basis:** Coinglass v4 does not expose mark-vs-index basis directly. Previous v2 spec used `basis_pct` as a confirming criterion in DISTRIBUTION and ACCUMULATION. The migration replaces it with OI behavior (`oi_24h_pct > 5` in DISTRIBUTION confirms crowded long flow alongside extreme funding) and drops the basis condition from ACCUMULATION (the regime still requires 4 confluent signals, which is operationally tight).

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

**Adaptive metric line per regime** — what's diagnostic varies by regime:
- ACCUMULATION: emphasize OI growth (7d) + funding (neutral) + 7d range or 7d %
- CATALYST-BREAKOUT: emphasize 24h % + volume ratio + OI 24h
- MOMENTUM: emphasize 7d % + OI + funding (moderate positive)
- COMPRESSION: emphasize 7d range + OI 7d + funding (flat)
- DISTRIBUTION: emphasize funding (extreme) + OI 24h still building + long/short ratio
- CAPITULATION: emphasize 24h drawdown + funding (negative) + OI drop + 24h liquidations USD

**Edge cases:**
- All NEUTRAL (quiet day): write a single-line variant for both artifact and notification:
  ```
  Perps Regimes · ${TODAY} · QUIET (no regime populated, see artifact)
  ```
  Still write the full per-asset metric table to `.outputs/perps-scan.md` so downstream consumers can read raw data.
- Coinglass API unavailable (curl returned non-zero `code` AND WebFetch fallback failed): write a one-line variant:
  ```
  Perps Regimes · ${TODAY} · scan unavailable, Coinglass API failed
  ```
  `daily-ops-review` surfaces the cause from `memory/issues/`.

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
- **Source status:** coinglass_coins=ok|fail, per-coin fetch failures: [list from `manifest.per_coin_errors`, or "none"]
- **Artifact written:** .outputs/perps-scan.md
- **Notification sent:** yes|no (reason if no) — via `./notify --signal` to #perps
```

## Sandbox note

The sandbox blocks env-var expansion in curl headers, which is why this skill never calls Coinglass directly. The pattern is:

1. **Prefetch runs before Claude** — `scripts/prefetch-coinglass.sh` (invoked by the workflow's `Run pre-fetch scripts` step) has full env access. It fetches coins-markets + per-coin histories and writes everything to `.coinglass-cache/`, plus a `manifest.json` with `coins_markets_ok` and `per_coin_errors`.
2. **This skill reads only from `.coinglass-cache/`** — no curl, no WebFetch. The skill checks `manifest.coins_markets_ok` first; if `false`, jump straight to the locked "scan unavailable" output (step 6 edge case).
3. **Per-coin endpoint failures are non-fatal** — `manifest.per_coin_errors` lists exactly which `{coin, endpoint}` pairs failed. Drop affected coins from regime classification, log them in step 9. Do not abort the whole scan.

If the prefetch was never run (e.g. someone invokes Claude directly outside the workflow), `.coinglass-cache/` won't exist — fall through to "scan unavailable" gracefully.

## Environment Variables

- `COINGLASS_API_KEY` — read by `scripts/prefetch-coinglass.sh`, **not by this skill directly**. Configured as a repo secret; the workflow exposes it to the prefetch step. Without it, the prefetch exits 0 with a notice, no cache is written, and this skill writes "scan unavailable".
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- **First-match priority is strict.** Once a coin matches a regime, lower-priority regimes do not apply. This prevents double-counting and keeps the bucketing deterministic.
- **Never invent numbers.** If a coin's history calls failed, drop it from the output — don't carry forward yesterday's metric.
- **Thresholds are v2.1 starting points** (Coinglass migration; data path moved to prefetch in v2.2). Refine after 2 weeks of observation. Document changes inline.
- **Liquidation criterion is now active in CAPITULATION** — Coinglass exposes aggregated 24h liquidations directly. The `liq_7d_p75` baseline means a flush is detected relative to recent activity, not against an absolute USD threshold.
- **No basis criterion** — Coinglass v4 does not expose mark-vs-index basis. DISTRIBUTION now confirms via OI behavior; ACCUMULATION drops basis entirely.
- **Notification under 4000 chars.** If output exceeds, drop empty sections, use the `Neutral · N other assets · see artifact` line, or shorten metric lines.

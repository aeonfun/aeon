---
name: Perps Scan
description: Classify Bybit perps universe into 6 regimes (Accumulation, Catalyst-Breakout, Momentum, Compression, Distribution, Capitulation)
var: ""
tags: [crypto]
---
<!-- v2: foundation skill for the perps sector brief. Raw classification, not synthesis. -->

> **${var}** — Optional asset list override (comma-separated tickers). If empty, scans the top 25 by 24h Bybit perp volume + always-include BTC/ETH/SOL.

Today is ${today}. Classify the perps universe into 6 regimes using Bybit's public REST API. This is a **signal** skill: writes `.outputs/perps-scan.md` for downstream `perps-brief` consumption and posts to Discord via `./notify --signal` routing to `#perps`.

Read `memory/MEMORY.md` for context.
Read the last 7 days of `memory/logs/` to find ★ repeat markers — assets in the same regime for ≥3 consecutive days, and `(day N)` markers for 2+ consecutive days.

## Goal

Bucket every assessed asset into exactly one of six regimes (or NEUTRAL catch-all) using a first-match priority order. Output the locked v2 format. Operator-grade thresholds documented inline — refine after observing 2 weeks of output.

## Data source

Bybit public REST API. Base: `https://api.bybit.com`. No auth, no key required.

Endpoints used:
- `GET /v5/market/tickers?category=linear` — all linear perps with 24h volume, last price, price change %, open interest value, funding rate
- `GET /v5/market/funding/history?category=linear&symbol={SYM}&limit=21` — funding rate history (21 entries = 7 days at 8h cadence)
- `GET /v5/market/open-interest?category=linear&symbol={SYM}&intervalTime=1d&limit=8` — daily OI snapshots for 7d delta
- `GET /v5/market/kline?category=linear&symbol={SYM}&interval=D&limit=8` — daily candles for 7d price action + range

Rate limits: 10 req/s for public endpoints. Sequence the per-symbol calls with `sleep 0.2` between requests to stay well under.

## Steps

### 1. Fetch the universe

```bash
TMPDIR=$(mktemp -d)
TODAY=$(date -u +%Y-%m-%d)

curl -s --max-time 15 "https://api.bybit.com/v5/market/tickers?category=linear" > "$TMPDIR/tickers.json"
if ! jq -e '.result.list | length > 0' "$TMPDIR/tickers.json" >/dev/null 2>&1; then
  echo "Bybit tickers fetch failed — trying WebFetch fallback"
  # WebFetch fallback (sandbox path): retrieve the same URL via Claude's WebFetch
fi
```

If the curl returned empty / errored, use **WebFetch** on `https://api.bybit.com/v5/market/tickers?category=linear` and parse the JSON body. Mark `bybit_tickers=fail` in the log if both fail and abort the run with the "scan unavailable" output (step 6).

### 2. Build the asset list

From `result.list`, filter to symbols ending in `USDT` (linear USDT perps). Sort by `turnover24h` descending. Take the top 25.

Force-include `BTCUSDT`, `ETHUSDT`, `SOLUSDT` if not already in the top 25 (regime anchors).

If `${var}` is set, parse it as a comma-separated ticker list (e.g. `HYPE,TAO,AVAX`) — append `USDT` to each, intersect with available symbols on Bybit, and use that as the asset list instead.

Per asset, extract from the tickers response:
- `lastPrice`, `price24hPcnt`, `turnover24h`, `volume24h`
- `openInterestValue` (USD value of OI), `openInterest` (units)
- `fundingRate` (current 8h funding — sign and magnitude both matter)
- `markPrice`, `indexPrice` (compute basis: `(markPrice - indexPrice) / indexPrice * 100`)

### 3. Fetch per-asset history (sequential, rate-limit aware)

For each asset in the list, fetch funding history, OI history, and daily klines. Sleep 0.2s between requests.

```bash
for SYM in $ASSET_LIST; do
  curl -s --max-time 10 "https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${SYM}&limit=21" > "$TMPDIR/funding-${SYM}.json"
  sleep 0.2
  curl -s --max-time 10 "https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${SYM}&intervalTime=1d&limit=8" > "$TMPDIR/oi-${SYM}.json"
  sleep 0.2
  curl -s --max-time 10 "https://api.bybit.com/v5/market/kline?category=linear&symbol=${SYM}&interval=D&limit=8" > "$TMPDIR/kline-${SYM}.json"
  sleep 0.2
done
```

If any individual symbol's history calls fail, drop that symbol from the regime classification (log it) and continue. Do not abort the whole scan for one bad symbol.

### 4. Compute per-asset metrics

For each asset, compute:

| Metric | Formula |
|---|---|
| `pct_24h` | `price24hPcnt * 100` |
| `pct_7d` | `(lastPrice - kline[6].close) / kline[6].close * 100` (kline[0] is most recent) |
| `vol_24h` | `turnover24h` (USD) |
| `vol_7d_avg` | mean of kline[0..6].turnover |
| `vol_ratio` | `vol_24h / vol_7d_avg` |
| `oi_now` | `openInterestValue` |
| `oi_24h_pct` | `(oi[0] - oi[1]) / oi[1] * 100` from /open-interest |
| `oi_7d_pct` | `(oi[0] - oi[7]) / oi[7] * 100` |
| `funding_now` | `fundingRate * 100` (as %/8h) |
| `funding_7d_avg` | mean of last 21 funding entries |
| `basis_pct` | `(markPrice - indexPrice) / indexPrice * 100` |
| `range_7d_pct` | `(max(klines.high) - min(klines.low)) / min(klines.low) * 100` over last 7 daily candles |

Round funding/basis to 3 decimals; everything else to 1 decimal for the output.

### 5. Classify each asset into a regime

**First-match priority order** (top of list wins, evaluated in order):

| Order | Regime | Trigger (all conditions must hold unless noted) |
|---|---|---|
| 1 | **CAPITULATION** | `pct_24h <= -10` AND `funding_now < 0` AND `oi_24h_pct <= -10` |
| 2 | **DISTRIBUTION** | `funding_now > 0.08` (or `funding_7d_avg > 0.06`) AND `basis_pct > 0.5` AND `pct_24h < pct_7d / 7` (gains slowing) |
| 3 | **CATALYST-BREAKOUT** | (`pct_24h > 20` OR price broke above 7d high) AND `vol_ratio > 2.0` AND `oi_24h_pct > 10` |
| 4 | **ACCUMULATION** | `oi_7d_pct > 10` AND `abs(funding_7d_avg) < 0.04` AND `abs(basis_pct) < 0.4` AND `pct_7d > 0` AND `range_7d_pct < 25` |
| 5 | **MOMENTUM** | `pct_7d > 15` AND `oi_24h_pct >= 0` AND `funding_now > 0.03 AND funding_now <= 0.07` |
| 6 | **COMPRESSION** | `range_7d_pct < 5` AND `oi_7d_pct > 5` AND `abs(funding_now) < 0.02` AND `abs(pct_24h) < 2` |
| 7 | **NEUTRAL** | none of the above match |

These thresholds are **v1 starting defaults**. After 2 weeks of observation, refine inline in this file (and note the change date + reasoning in a comment). If a multi-day pattern emerges where a regime triggers too rarely or too commonly, adjust.

**Sandbox note on liquidation data:** Bybit public REST does not expose 24h aggregated liquidations (only the WebSocket `liquidation.{symbol}` stream gives per-event data, impractical from cron). The CAPITULATION regime in v1 therefore uses three confluent signals (price drawdown + funding flip + OI drop) without a liquidation criterion. This is documented in v2 spec's Acknowledged Data Gaps. Coinglass Startup tier ($79/mo) restores liquidation data in v2 of this skill.

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
★ HYPE — OI +18% 7d, funding +0.02%/8h, basis +0.3% (day 3)
• SOL — OI +12% 7d, funding +0.02%/8h, basis stable

CATALYST-BREAKOUT
• AVAX — +14% 24h, vol 2.4x avg, OI +11% 24h, funding +0.05%/8h
• LINK — +8% 24h, OI +9% 24h, basis +0.2%

MOMENTUM
• BTC — 7d +6%, OI +6% 24h, funding +0.07%/8h, basis +0.3%
• ETH — 7d +4%, OI flat, funding +0.04%/8h, basis +0.2%

COMPRESSION
• TAO — 7d range 5%, OI +9% 7d, funding flat, basis +0.1%
• ATOM — 7d range 6%, OI flat, funding flat

DISTRIBUTION
• FARTCOIN — funding +0.14%/8h (extreme), OI +35% 24h, basis +0.6%

CAPITULATION (empty — no major flushes today)

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
- ACCUMULATION: emphasize OI growth + funding (neutral) + basis (stable)
- CATALYST-BREAKOUT: emphasize 24h % + volume ratio + OI 24h
- MOMENTUM: emphasize 7d % + OI + funding (moderate positive)
- COMPRESSION: emphasize 7d range + OI + funding (flat)
- DISTRIBUTION: emphasize funding (extreme) + OI peak + basis (stretched)
- CAPITULATION: emphasize 24h drawdown + funding (negative) + OI drop

**Edge cases:**
- All NEUTRAL (quiet day): write a single-line variant for both artifact and notification:
  ```
  Perps Regimes · ${TODAY} · QUIET (no regime populated, see artifact)
  ```
  Still write the full per-asset metric table to `.outputs/perps-scan.md` so downstream consumers can read raw data.
- Bybit API unavailable (both curl + WebFetch failed): write a one-line variant:
  ```
  Perps Regimes · ${TODAY} · scan unavailable, Bybit API failed
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
- **Source status:** bybit_tickers=ok|fail, per-symbol fetch failures: [list or "none"]
- **Artifact written:** .outputs/perps-scan.md
- **Notification sent:** yes|no (reason if no) — via `./notify --signal` to #perps
```

## Sandbox note

The sandbox may block outbound curl. For every curl call, if it fails or returns empty/malformed JSON, use **WebFetch** as fallback against the same URL. Bybit public endpoints require no auth headers so WebFetch works without pre-fetch.

For the per-symbol loop, on the first repeated failure pattern, consider falling back to a single batched WebFetch of the parent ticker list and computing all metrics from that snapshot — accept reduced 7d delta accuracy in exchange for partial-output capability.

## Environment Variables

- None required. Bybit public endpoints are unauthenticated.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- **First-match priority is strict.** Once an asset matches a regime, lower-priority regimes do not apply. This prevents double-counting and keeps the bucketing deterministic.
- **Never invent numbers.** If a symbol's history calls failed, drop it from the output — don't carry forward yesterday's metric.
- **Thresholds are v1 starting points.** Refine after 2 weeks of observation. Document changes inline.
- **Liquidation data is intentionally absent in v1.** Do not attempt to scrape WebSocket liquidation feed from cron. CAPITULATION uses confluence of drawdown + funding flip + OI drop instead.
- **Notification under 4000 chars.** If output exceeds, drop empty sections, use the `Neutral · N other assets · see artifact` line, or shorten metric lines.

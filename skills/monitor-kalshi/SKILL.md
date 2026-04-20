---
name: Monitor Kalshi
description: Monitor specific Kalshi prediction markets for 24h price moves, volume changes, and top events
var: ""
tags: [crypto, research]
---
<!-- autoresearch: variation B — sharper output via implied-probability framing, liquidity-weighted move scoring, conviction (spread) column, per-alert "why it matters", global ranking -->

> **${var}** — Event ticker to monitor (e.g. "KXGDP-26Q2"). If empty, reads the watchlist from `skills/monitor-kalshi/watchlist.md`.

Read `memory/MEMORY.md` for context.
Read the last 2 days of `memory/logs/` to compare against previous readings and flag *new* movers (not repeats of yesterday's news).

## Why this skill exists

A table of prices isn't useful. An operator reading this notification wants to answer: **"is there a market worth forming a view on right now, and why?"** Every rule below exists to push output toward that question — the skill suppresses noise, ranks by decision value, and demands one line of reasoning per alert.

## Watchlist

The default watchlist lives at `skills/monitor-kalshi/watchlist.md`. Each line is an event ticker. Add or remove tickers to change what gets monitored.

If `${var}` is set, monitor only that single event (useful for ad-hoc checks).

## API Reference

Base URL: `https://api.elections.kalshi.com/trade-api/v2`

Despite the "elections" subdomain, this provides access to ALL Kalshi markets (economics, climate, tech, politics, etc.). All endpoints below are **public — no auth required**.

## Steps

### 1. Load watchlist

```bash
if [ -n "${var}" ]; then
  TICKERS="${var}"
else
  TICKERS=$(grep -v '^#' skills/monitor-kalshi/watchlist.md | grep -v '^$')
fi
```

If the watchlist is empty and no `${var}` is set, emit `MONITOR_KALSHI_NO_CONFIG`, notify with a one-line setup hint, and discover trending events for this run only:
```bash
curl -s "https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=10"
```
Pick the 5 highest-volume events and monitor those.

### 2. For each event, fetch markets, prices, and liquidity

For each event ticker:

**a) Event + markets:**
```bash
curl -s "https://api.elections.kalshi.com/trade-api/v2/events/$EVENT_TICKER?with_nested_markets=true"
```
Fields used: `event_ticker`, `title`, `category`, `mutually_exclusive`, `markets[]` with `ticker`, `title`, `subtitle`, `status`, `yes_bid`, `yes_ask`, `last_price`, `volume`, `volume_24h`, `open_interest`, `close_time`, `series_ticker`.

**Skip non-open markets** (closed/settled are historical).

**b) 24h candlesticks (batch where possible):**
Prefer the batch endpoint — one call per event, not per market:
```bash
END_TS=$(date -u +%s)
START_TS=$((END_TS - 86400))
# Batch: up to 10,000 candlesticks total across requested tickers
curl -s "https://api.elections.kalshi.com/trade-api/v2/markets/candlesticks?tickers=$COMMA_SEP_MARKET_TICKERS&start_ts=$START_TS&end_ts=$END_TS&period_interval=60"
```
If the batch endpoint errors, fall back to the per-market endpoint:
```bash
curl -s "https://api.elections.kalshi.com/trade-api/v2/series/$SERIES_TICKER/markets/$MARKET_TICKER/candlesticks?start_ts=$START_TS&end_ts=$END_TS&period_interval=60"
```
If both fail for a market, mark its source as `SRC=price_only` and use `last_price` vs yesterday's log entry.

**c) Orderbook depth (liquidity / conviction signal):**
```bash
curl -s "https://api.elections.kalshi.com/trade-api/v2/markets/$MARKET_TICKER/orderbook?depth=10"
```
From the orderbook, compute:
- `spread_pp` = `yes_ask − yes_bid` in percentage points. Wide spread = low conviction, thin book.
- `depth_usd` = sum over top-10 bid levels of `price × size` (approximation, both sides). This scales how much weight to give a price.

If orderbook fails, mark `SRC=no_book` and skip the conviction column for that market.

### 3. Compute per-market signals

For each open market:

- **implied_prob** = `last_price` as a percentage (0.62 → 62%). Report this, not cents.
- **chg_pp** = `close − open` from candlesticks, in percentage points.
- **high / low** = intraday range.
- **vol_24h_usd** ≈ `volume_24h × avg(open, close)` (Kalshi reports contract count — convert so readers can compare across markets).
- **spread_pp** and **depth_usd** from step 2c.
- **move_score** = `|chg_pp| × log10(max(vol_24h_usd, 100))`. This is the key ranking signal — a 3pp move on a $200k market outranks a 5pp move on a $5k market. It prevents thin-book noise from dominating.

**Direction label** (from chg_pp): surging (>+5pp), rising (+2 to +5), stable (−2 to +2), falling (−5 to −2), crashing (<−5).

**Conviction label** (from spread_pp): tight (<2pp), loose (2–5pp), thin (>5pp, treat price skeptically).

### 4. Decide what's worth saying — suppression rules

Before building the report, drop markets that fail ALL of these gates:
- `|chg_pp| >= 2` AND `vol_24h_usd >= $1,000`, OR
- `vol_24h_usd >= $25,000` (large volume alone is signal even if price didn't move much), OR
- `open_interest` grew >30% vs yesterday's log, if yesterday's log has the data.

If a market appeared in yesterday's log with the same direction and a chg_pp within ±1pp of today's, treat it as "continued from yesterday" and demote it — mention once at the event level, don't re-alert.

**Hard alert threshold:** `|chg_pp| >= 5` AND `conviction != thin`. These go to the ALERTS block and require a "why it matters" line.

### 5. Global ranking

Rank events by the max `move_score` of any market within them. Cap the report at the **top 5 events**. Markets within an event are listed in descending `move_score` order, capped at 3 per event (mention "+N more" if truncated).

### 6. Build the report

```
*Kalshi monitor — ${today}*
verdict: [1 sentence — dominant theme or "all quiet"]

**[Event Title]** (EVENT_TICKER) — category
| Market | prob | Δ24h | range | vol | spread |
|--------|------|------|-------|-----|--------|
| [title] | 62% | +4.1pp ▲ | 56–65% | $82k | 1pp |
| [title] | 23% | −2.8pp ▼ | 22–28% | $14k | 3pp |
mover: [title] — rising on $82k vol, tight book

[next event ...]

**ALERTS** (moved >5pp on non-thin book)
- [event/market]: 34% → 51% — *why it matters:* [one sentence grounded in the move's volume, spread, or news context if obvious from titles]
- ...

**Trending (not tracked)**
- [event] — $Xk 24h vol, consider adding
- ...

sources: events=ok candlesticks=ok|degraded|fail orderbook=ok|degraded|fail
```

Rules for the verdict line:
- If no alerts AND no market moved >2pp: say "all quiet — [N] events, [M] markets tracked, no moves worth flagging".
- If one theme dominates (most big moves in one category): name it. E.g. "GDP markets repriced down after Q1 print; inflation markets unchanged".
- Never hedge. If you're not sure, say "mixed signals" and stop.

Rules for "why it matters":
- Must reference at least one of: volume (is this real money?), spread (is this consensus?), prior log state (is this new?), or a plausible news trigger inferable from the market title.
- Max 15 words. No filler like "interesting move" or "worth watching".

### 7. Discover notable trends

```bash
curl -s "https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=50"
```
Scan for events with high `volume_24h` (top 10) whose tickers are **not** in the watchlist. Mention 1–2 in the "Trending (not tracked)" block, only if their 24h volume exceeds the median volume of tracked events.

### 8. Notify

Send via `./notify` (under 4000 chars). If the report exceeds the budget, drop the "Trending" block first, then truncate events from the bottom of the ranked list.

### 9. Log

Append to `memory/logs/${today}.md`:
```
## Monitor Kalshi
- **Events monitored:** N (watchlist=W, discovered=D)
- **Markets tracked:** N (M open, K skipped)
- **Top mover:** "[title]" — X% → Y% (Δpp, move_score=S, vol=$V, spread=Sp)
- **Alerts (>5pp, non-thin):** [count; list titles or "none"]
- **Continued-from-yesterday (demoted):** [count]
- **Trending untracked:** [1–2 tickers or "none"]
- **Sources:** events=[status] candlesticks=[status] orderbook=[status]
- **Status:** MONITOR_KALSHI_OK | MONITOR_KALSHI_DEGRADED | MONITOR_KALSHI_NO_CONFIG | MONITOR_KALSHI_ERROR
```

If a market moved dramatically (>10pp on non-thin book) or a new category is heating up across multiple events, add a one-line note in `memory/MEMORY.md` under a "Kalshi signals" section for future reference.

### Status codes (end-of-run)

- `MONITOR_KALSHI_OK` — ran fully, had data, at least one event processed.
- `MONITOR_KALSHI_DEGRADED` — partial data (some markets fell back to `price_only` or `no_book`); report still sent.
- `MONITOR_KALSHI_NO_CONFIG` — empty watchlist and no `${var}`; discovered trending events and notified with setup hint.
- `MONITOR_KALSHI_ERROR` — events endpoint failed entirely or zero markets resolved; notify with the failure, don't fake a report.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch:
- `WebFetch("https://api.elections.kalshi.com/trade-api/v2/events/EVENT_TICKER?with_nested_markets=true")`
- `WebFetch("https://api.elections.kalshi.com/trade-api/v2/markets/candlesticks?tickers=...&start_ts=...&end_ts=...&period_interval=60")`
- `WebFetch("https://api.elections.kalshi.com/trade-api/v2/markets/MARKET_TICKER/orderbook?depth=10")`
- All Kalshi endpoints are public and need no auth headers.

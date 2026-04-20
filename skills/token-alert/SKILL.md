---
name: Token Alert
description: Notify on per-token statistically anomalous price + volume moves (not arbitrary % thresholds)
var: ""
tags: [crypto]
---
> **${var}** — Token symbol or CoinGecko ID. If empty, checks all tracked tokens.

<!-- autoresearch: variation D — statistical baseline: replace hardcoded % thresholds with per-token z-scores (price + volume), require dual-signal confirmation, tiered output -->

If `${var}` is set, only check that token.

## Config

This skill reads tracked tokens from a **"Tracked Tokens"** section in `memory/MEMORY.md`. If the section is missing, add it or exit with `TOKEN_ALERT_EMPTY — no tracked tokens`.

```markdown
## Tracked Tokens
| Token | CoinGecko ID | Notes |
|-------|--------------|-------|
| ETH   | ethereum     |       |
| SOL   | solana       |       |
```

The `Alert Threshold` column is no longer used — thresholds are now derived per-token from 30-day statistics.

---

Read `memory/MEMORY.md` for tracked tokens. Read the last 2 days of `memory/logs/` for prior alerts (dedup).

## Why this skill alerts

A fixed 10% threshold is wrong in both directions: it floods on volatile memecoins and misses genuine anomalies on stablecoins or low-volatility large caps. Instead: for each token, compute a rolling 30-day baseline of daily log-returns and daily volume, score today's values as z-scores, and alert **only when both price and volume are anomalous** vs that token's own history. This eliminates fixed-threshold false positives and catches quiet-but-unusual moves the old skill missed.

## Steps

### 1. For each tracked token — fetch 30-day history + current snapshot

Primary source: CoinGecko `market_chart` (free tier, 1–365 day range, daily candles).

```bash
# 30-day history: returns prices[], market_caps[], total_volumes[] arrays of [timestamp_ms, value]
if [ -n "${COINGECKO_API_KEY:-}" ]; then
  curl -s "https://pro-api.coingecko.com/api/v3/coins/TOKEN_ID/market_chart?vs_currency=usd&days=30&interval=daily" \
    -H "x-cg-pro-api-key: $COINGECKO_API_KEY"
else
  curl -s "https://api.coingecko.com/api/v3/coins/TOKEN_ID/market_chart?vs_currency=usd&days=30&interval=daily"
fi

# Current snapshot with 24h change + 24h volume:
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=TOKEN_ID&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true"
```

**If curl fails** (sandbox block, rate limit, 5xx): retry once with **WebFetch** on the same URLs. If WebFetch also fails, fall back to **CoinPaprika** (`https://api.coinpaprika.com/v1/tickers/{id}`) or **Binance** (`https://api.binance.com/api/v3/klines?symbol={SYMBOL}USDT&interval=1d&limit=30`) for history. Record which source served each token in a `sources:` map for the observability footer.

If every source fails for a given token, skip that token and mark it `degraded` in the footer — do not abort the whole skill.

### 2. Compute the per-token baseline

From the 30-day history arrays, compute:

- **Daily log-returns**: `r_i = ln(price_i / price_{i-1})` for the last 29 days (yields 29 return samples).
- **Return stats**: `mean_r`, `std_r` over those 29 samples.
- **Volume stats**: `mean_v`, `std_v` over the 30 `total_volumes` samples.
- **Today's price-z**: `(ln(current / price_{yesterday}) - mean_r) / std_r`.
- **Today's volume-z**: `(volume_24h - mean_v) / std_v`.

Edge cases:
- If `std_r == 0` (flat stablecoin) or the history array has fewer than 20 samples, skip the z-score logic for that token and fall back to a **simple rule**: alert only if `|24h change| > 3%` AND volume_24h > 2× mean_v. Mark the token `baseline=insufficient` in the footer.
- Drop the most recent (partial) day from stats if CoinGecko returns a same-day bucket, to avoid contaminating the baseline with the value being scored.

### 3. Decide the alert tier per token

Require **dual-signal confirmation** (price AND volume both anomalous) before emitting anything. Tier by the combined severity:

| Tier         | Condition                                                                    |
|--------------|------------------------------------------------------------------------------|
| **CRITICAL** | \|price-z\| ≥ 3.0  AND  volume-z ≥ 2.0                                       |
| **WATCH**    | \|price-z\| ≥ 2.5  AND  volume-z ≥ 1.5  (and not CRITICAL)                   |
| **quiet**    | anything else — do **not** alert                                             |

Also compute **direction** (`↑` or `↓`) from the sign of the log-return and the **BTC-relative excess** (`token_24h_pct − btc_24h_pct`) so the reader can tell whether the move is idiosyncratic or a market-wide wave. Fetch BTC's 24h change once per run, reuse for all tokens.

### 4. Dedup against the last 24h of logs

Grep the last 2 days of `memory/logs/*.md` for `TOKEN_ALERT_FIRED {symbol} {tier}`. If the same token already fired at the same-or-higher tier within the last 24 hours, **suppress** it (log as suppressed-duplicate in the footer). If a WATCH has since escalated to CRITICAL, emit the new CRITICAL.

### 5. Send the notification

If there is at least one unsuppressed alert, fan out one message via `./notify`:

```
*Token Alert — ${today}*

🔴 CRITICAL
• ETH ↑ +12.3% ($3842) — price-z 3.1, vol-z 2.4 (vs BTC +4.2%)
• SOL ↓ -8.7% ($184)  — price-z 2.8, vol-z 2.1 (vs BTC -2.1%)

🟡 WATCH
• LINK ↑ +4.1% ($23.1) — price-z 2.6, vol-z 1.8 (vs BTC +0.3%)

sources: cg=ok(3) paprika=fallback(0) binance=fallback(0) | baseline=ok(3) insufficient(0) | suppressed=1
```

Rules for the message:
- Omit tier sections that have no items. Never emit an empty-body notification.
- One line per alert. No prose.
- Cap at 8 lines of alerts total (most severe first); overflow → `+N more WATCH items` trailer.
- Keep the whole message under ~800 chars.

If nothing crossed tier thresholds, **do not notify**. Log `TOKEN_ALERT_OK` instead.

### 6. Log outcomes to `memory/logs/${today}.md`

Always append a section like:

```
### token-alert
- Status: TOKEN_ALERT_OK | TOKEN_ALERT_FIRED | TOKEN_ALERT_DEGRADED | TOKEN_ALERT_EMPTY
- Checked: ETH, SOL, LINK (n=3)
- Prices: ETH=$3842 (+12.3%, z=3.1/2.4), SOL=$184 (-8.7%, z=2.8/2.1), LINK=$23.1 (+4.1%, z=2.6/1.8)
- Fired: ETH CRITICAL, SOL CRITICAL, LINK WATCH
- Suppressed: BTC WATCH (already fired WATCH within 24h)
- Sources: cg=ok(3) paprika=0 binance=0
- Baseline: ok=3 insufficient=0
```

Statuses:
- `TOKEN_ALERT_OK` — tokens checked successfully, nothing met the tier thresholds.
- `TOKEN_ALERT_FIRED` — at least one alert sent.
- `TOKEN_ALERT_DEGRADED` — some tokens failed all sources; partial check.
- `TOKEN_ALERT_EMPTY` — no tracked tokens configured, or every source failed for every token.

The price line is **required** on every run — future invocations rely on logged prices as a secondary baseline source if the market_chart endpoint is unavailable.

## Sandbox note

The sandbox may block outbound curl. For each fetch, on failure retry with **WebFetch** (bypasses the sandbox). CoinGecko, CoinPaprika, and Binance public endpoints require no auth, so no pre-fetch script is needed. If `COINGECKO_API_KEY` is set it is used for higher rate limits; no failure if absent.

## Constraints

- Never emit a single-signal alert (price OR volume alone). Dual-signal only.
- Never replace the statistical baseline with a hardcoded percentage — the whole point of this skill is that volatility is per-token.
- Keep the notification under 800 chars. If more tokens qualify, truncate, don't split.
- Never abort the run because one token failed — degrade gracefully and report it in the footer.

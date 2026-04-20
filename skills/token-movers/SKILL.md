---
name: Token Movers
description: Top movers, losers, and trending coins from CoinGecko — with signal enrichment and pump-risk flags
var: ""
tags: [crypto]
---
<!-- autoresearch: variation B — sharper output: enrich each mover with context, score signals, flag pump risk, add market commentary -->

> **${var}** — Token symbol or category to highlight (e.g. "SOL", "layer-2", "meme coins"). If empty, shows top movers, losers, and trending coins.

Read `memory/MEMORY.md` for context.
Read the last 2 days of `memory/logs/` to avoid repeating the same movers/trending names unless the move is materially different.

## Goal

Produce an **actionable** movers report. Plain % change lists are noise — the value is in distinguishing real signal (on volume, from a credible cap tier) from pump-and-dump noise and stablecoin wiggle.

## Steps

### 1. Fetch data

Fetch market data and trending coins in parallel. Request multi-timeframe changes for context:

```bash
# Top 250 coins by market cap with 1h, 24h, and 7d % change
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=1h,24h,7d" \
  ${COINGECKO_API_KEY:+-H "x-cg-pro-api-key: $COINGECKO_API_KEY"}

# Trending searches (top coins people are searching for)
curl -s "https://api.coingecko.com/api/v3/search/trending" \
  ${COINGECKO_API_KEY:+-H "x-cg-pro-api-key: $COINGECKO_API_KEY"}
```

If curl fails or returns empty JSON, retry once with **WebFetch** against the same URL.

### 2. Filter before ranking

Before picking winners/losers, drop noise. All numeric thresholds below are starting points — tune as needed if the output consistently feels too loose or too strict:

- **Stablecoins**: exclude symbols/ids that peg to fiat — `tether`, `usd-coin`, `dai`, `first-digital-usd`, `usde`, `tusd`, `usdd`, `pyusd`, `fdusd`, `paxg` (gold-pegged), and anything whose symbol starts with `USD`/`EUR`/`GBP` or name contains "stablecoin".
- **Illiquid tokens**: drop coins with 24h `total_volume` < **$1,000,000** (tune as needed). Sub-$1M volume on a top-250 coin is a pump/wash-trading target and generates misleading % moves.
- **Wrapped dupes** (optional): if a wrapped version (e.g. `wbtc`, `weth`, `steth`) would otherwise dominate a list, keep only one representative.

### 3. Pick the lists

From the filtered market data, sort by `price_change_percentage_24h`:
- **Top 10 winners** (highest 24h %)
- **Top 10 losers** (lowest 24h %)

For each item, capture: name, symbol, market cap rank, current price (USD), **24h %**, **7d %**, **1h %**, 24h volume (USD), market cap (USD).

From the trending endpoint, take the top 7 trending coins with: name, symbol, rank, price, 24h %.

### 4. Enrich with signal + risk tags

For every entry in the three lists, compute tags. Attach at most 2 tags per coin to keep the output clean. All numeric thresholds below are starting heuristics — tune as needed:

- **[TRENDING+UP]** — appears in trending AND is a top winner. Strong positive signal.
- **[TRENDING+DOWN]** — appears in trending AND is a top loser. Capitulation / bad-news signal.
- **[BREAKOUT]** — 24h change > +15% AND 7d change > +25%. Sustained move, not a flash pump.
- **[FADE]** — 24h change > +20% BUT 7d change is negative. Likely relief bounce in a downtrend.
- **[CAPITULATION]** — 24h change < −10% AND 24h volume > 3× the coin's typical daily volume (approximate: use `total_volume` vs `market_cap` ratio > 0.25 as a rough proxy if no historical data).
- **[PUMP-RISK]** — market cap rank > 150 AND 24h change > +30%. Low-cap, big spike — high manipulation probability. Warn the reader.
- **[MICROCAP]** — market cap < $50M. Disclose; these moves rarely predict direction.
- **[MAJOR]** — market cap rank ≤ 20. Large-cap moves are more informative per unit % change.

### 5. Market commentary (one sentence, calibrated)

Compute a quick market pulse: among the top 100 by mcap (after filters), what fraction had positive 24h change? What was the median 24h change of the top 50?

Write **one sentence** characterizing the tape. Examples:
- "Broad risk-off — 78/100 top coins are red, median −3.2%; losers dominate across L1s and DeFi."
- "Mixed tape with alt rotation — BTC flat but 62% of top-100 alts green, meme and AI-coin names leading."
- "Quiet — median move under 1% either way; trending is dominated by new listings rather than price action."

Don't editorialize beyond what the numbers show. No predictions.

### 6. If `${var}` is set

Treat it as either a specific token (symbol match) or a category. If a specific token: fetch `/coins/{id}` for detailed stats and put a dedicated block at the top with price, 24h volume, market cap, 7d and 30d changes, ATH distance. If a category (e.g. `layer-2`, `meme-token`): filter the top-250 list to that category (use `/coins/categories/list` → `/coins/markets?category=X` if needed) and run the same pipeline scoped to it.

### 7. Send notification

Via `./notify`, under 4000 chars:

```
*Token Movers — ${today}*

_[one-sentence market pulse from step 5]_

*Top Winners (24h)*
1. SYMBOL (Name) — $price  +24.1% / 7d +18% / 1h +2.3%  •  $vol / #rank  [TAGS]
2. ...

*Top Losers (24h)*
1. SYMBOL (Name) — $price  −18.4% / 7d −22% / 1h −3.1%  •  $vol / #rank  [TAGS]
2. ...

*Trending*
1. NAME (SYMBOL) — #rank, $price, 24h ±X.X%  [TAGS]
2. ...

*Notable*
• SYMBOL: trending + up 42% on 6× volume — strong signal
• SYMBOL: #212 rank up 85% — PUMP-RISK, low liquidity
• [1–4 bullets, skip section if none worth calling out]
```

Formatting rules:
- Round prices sensibly (4 sig figs, or 6 decimals for sub-$0.01 tokens).
- Round % to one decimal. Volume and mcap abbreviated (e.g. `$4.2B`, `$380M`).
- Only include the `Notable` section if at least one signal earned `[TRENDING+UP]`, `[BREAKOUT]`, `[CAPITULATION]`, or `[PUMP-RISK]`.
- If a coin appeared in the last 2 days of logs with the same direction and similar magnitude, skip it unless it now has a new tag (e.g. yesterday's winner is now [CAPITULATION]).

### 8. Log

Append to `memory/logs/${today}.md`:

```
### token-movers
- Var: ${var:-<none>}
- Pulse: [one-sentence market pulse]
- Winners: SYM (+X%), SYM (+X%), …
- Losers: SYM (−X%), SYM (−X%), …
- Trending: SYM, SYM, …
- Notable: [any PUMP-RISK / BREAKOUT / CAPITULATION signals]
```

## Sandbox note

The sandbox may block outbound curl. If either endpoint fails or returns malformed JSON:
1. Retry once with **WebFetch** against the same URL.
2. If both attempts fail for the markets endpoint, abort and notify: "token-movers: CoinGecko unreachable — skipping run." (Do not publish a partial or stale report.)
3. If only the trending endpoint fails, proceed with winners/losers and note "trending unavailable" in the message.

## Constraints

- Never recommend buying or selling. Tags describe observed patterns; the reader decides.
- [PUMP-RISK] must always be surfaced — even in the main list — when it applies. Don't bury manipulation warnings.
- Keep the message under 4000 chars. If filters leave too few coins after exclusions, shrink the lists (e.g. top 5 instead of top 10) rather than relaxing the volume floor.

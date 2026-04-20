---
name: Market Context Refresh
description: Fetch live crypto macro data and update memory/topics/market-context.md
schedule: "0 10 * * *"
commits: true
permissions:
  - contents:write
tags: [crypto]
---

<!-- autoresearch: variation B — sharper output: lead with a Market Take (regime + conviction), show deltas vs prior snapshot, classify narrative phase with evidence, emit decision-ready context for downstream skills rather than a data dump -->

Refresh `memory/topics/market-context.md` with **decision-ready** crypto context. This file is read by token-pick, narrative-tracker, and other skills — it must be current *and* actionable. A data dump is a failure; the reader should know the regime and what to do differently today within 10 seconds.

Read `memory/MEMORY.md` for prior context.

## Sandbox note

The sandbox may block curl. For every curl call below, if it fails or returns empty, use **WebFetch** for the same URL (omit API key headers — free tiers work). Every source lists an explicit fallback. If a primary AND its fallback both fail, mark the row `fail` in the Source Status footer and use the last known value from the prior `memory/topics/market-context.md` (do not fabricate).

## Steps

### 1. Load prior snapshot (for deltas and preserve-on-failure)

Read the existing `memory/topics/market-context.md` if present. Extract (for delta computation later):
- BTC price, ETH price, Total mcap, BTC dominance, Total TVL, Fear & Greed value
- The full **Token Picks Made** table (never truncate — rebuild the new file with this table intact)

If the file doesn't exist, treat all deltas as `n/a` on the first run.

### 2. Fetch macro crypto data (CoinGecko)

```bash
# Simple price for BTC, ETH, SOL + 24h change
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true" \
  ${COINGECKO_API_KEY:+-H "x-cg-pro-api-key: $COINGECKO_API_KEY"}

# Top 20 by mcap (movers + trend)
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h,7d" \
  ${COINGECKO_API_KEY:+-H "x-cg-pro-api-key: $COINGECKO_API_KEY"}

# Global stats (total mcap, volume, dominance)
curl -s "https://api.coingecko.com/api/v3/global" \
  ${COINGECKO_API_KEY:+-H "x-cg-pro-api-key: $COINGECKO_API_KEY"}

# Trending coins
curl -s "https://api.coingecko.com/api/v3/search/trending" \
  ${COINGECKO_API_KEY:+-H "x-cg-pro-api-key: $COINGECKO_API_KEY"}
```
**Fallback:** WebFetch the same URLs without the API key header.

From `/coins/markets` compute **breadth**: how many of the top 20 are green on 24h vs 7d. Breadth is a regime signal — 18/20 green = risk-on, 4/20 green = risk-off.

### 3. Fetch DeFi data (DeFiLlama — free, no key required)

Replace the prior WebSearch approach with DeFiLlama's open REST API:

```bash
# All protocols (pick top 5 by tvl, include change_7d)
curl -s "https://api.llama.fi/protocols"

# Chains by TVL (for chain-level flow)
curl -s "https://api.llama.fi/v2/chains"

# DEX volume overview
curl -s "https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true"

# Stablecoins (total mcap + top issuers)
curl -s "https://stablecoins.llama.fi/stablecoins?includePrices=true"
```
**Fallback:** WebFetch the same URLs. If both fail, mark `defillama=fail` in the Source Status footer and carry the prior file's DeFi numbers.

Extract:
- Total DeFi TVL (sum of chains) and **7d delta**
- Top 5 protocols by TVL with `change_7d`
- Top 3 chains by TVL with `change_7d` (flow-of-capital signal)
- DEX 24h volume (from `totalDataChart` or `total24h`)
- Top 4 stablecoins by mcap (USDT, USDC, USDe, USDS, DAI — whichever lead) and combined mcap

### 4. Fetch sentiment — Fear & Greed Index

```bash
curl -s "https://api.alternative.me/fng/?limit=2"
```
Returns today's value (0-100) and yesterday's. Classification buckets: 0-24 Extreme Fear, 25-49 Fear, 50-74 Greed, 75-100 Extreme Greed. **Fallback:** WebFetch the same URL.

### 5. Fetch prediction markets (Polymarket Gamma)

```bash
curl -s "https://gamma-api.polymarket.com/markets?closed=false&order=volume24hr&ascending=false&limit=10"
curl -s "https://gamma-api.polymarket.com/markets?closed=false&order=liquidity&ascending=false&limit=10"
```
**Fallback:** WebFetch the same URLs.

For each market: `outcomes` and `outcomePrices` are JSON-encoded arrays that map 1:1. YES% = `parseFloat(outcomePrices[0]) * 100` (first element is always YES). Skip any market where the YES% is <3% or >97% (effectively settled — no signal).

### 6. Scan for macro catalysts (WebSearch)

Only two queries — noise is expensive here. Use WebSearch for:
- `crypto market today ${today} macro catalyst`
- `BTC ETF flows ${today}` (institutional flow signal)

Keep only items that would change a trader's positioning today. Discard recap/explainer articles.

### 7. Compute the Market Take (the headline)

This is the core output — everything above is input to this line.

**Market Take format (exactly 3 lines)** — this is the concrete template the rest of the file leads with:

```
Take: <regime> — <one-sentence why, citing 2 concrete numbers>.
Conviction: <high | medium | low> — <which signals agree; which disagree>.
Evidence: <one sentence naming the single strongest datum behind this call>.
```

Example:
```
Take: risk-on — BTC +3.1% 24h with 17/20 top-cap majors green.
Conviction: high — F&G, breadth, and 7d TVL all point up; only BTC dominance disagrees (flat).
Evidence: DEX 24h volume $7.8B, highest since March and +42% vs 7d avg.
```

Score the regime using these inputs:
- **BTC 24h%** (±2% threshold)
- **Breadth** (top-20 green count)
- **Fear & Greed** (today vs yesterday)
- **BTC dominance 24h change** (from `/global`)
- **TVL 7d delta** (DefiLlama)
- **DEX volume** vs the prior snapshot's DEX volume

Assign one regime label:
- **risk-on** — BTC up, breadth >14/20, F&G ≥55 and rising, TVL up 7d
- **risk-off** — BTC down, breadth <7/20, F&G ≤45 and falling
- **rotation** — BTC flat or dominance falling while breadth high (alts outperforming)
- **chop** — no single signal dominates; small moves, flat F&G
- **capitulation / squeeze** — only if BTC ±5%+ in 24h with F&G extreme

Also emit **conviction** in {high, medium, low} based on how many signals agree.

### 8. Classify active narratives with phase + evidence

For each of 3-5 current meta-narratives (derived from trending coins + top movers + macro catalyst scan), assign a phase and a one-line evidence anchor:

- **emerging** — new mentions, early accumulation (e.g. "3 of top trending, no mcap leader yet")
- **rising** — strong 7d momentum, growing breadth (e.g. "sector +X% 7d, N tokens in top-20 movers")
- **peak** — saturated attention, funding hot, breadth topping (e.g. "every feed hit, 24h volume 3x 7d avg")
- **fading** — mindshare dropping, 7d red (e.g. "was 5 top movers last week, now 1")

No narrative without an evidence anchor. If you cannot point to a number or concrete signal, don't include it.

### 9. Write the updated market-context.md

Overwrite `memory/topics/market-context.md` with this exact structure. **Lead with the Take** so downstream skills get the conclusion in the first ~150 chars:

```markdown
# Market Context (as of ${today})

> **Take:** [regime] — [one-sentence why, citing 2 concrete numbers]. Conviction: [high|medium|low].

## Signal Snapshot
- BTC $X (±X% 24h, ±X% 7d) · dominance X% (±X pp 24h)
- ETH $X (±X% 24h, ±X% 7d) · ETH/BTC X.XXX
- SOL $X (±X% 24h, ±X% 7d)
- Total mcap $XT (±X% 24h) · DEX vol $XB 24h
- Breadth: N/20 green 24h · N/20 green 7d
- Fear & Greed: X (label) — yesterday X

## What Changed Since Last Refresh
- [Delta or event 1 — e.g. "F&G jumped 12 pts into Greed, first time in 14 days"]
- [Delta 2]
- [Delta 3]
Only real deltas. If no material change, write: "Quiet — all majors within ±1%, regime unchanged."

## Active Narratives
- **[Narrative]** — phase: [emerging|rising|peak|fading]. Evidence: [concrete signal].
- **[Narrative]** — phase: [...]. Evidence: [...].
- **[Narrative]** — phase: [...]. Evidence: [...].

## Top DeFi Protocols (TVL, 7d change)
- [Protocol]: $XB ([+/-X%])
- [Protocol]: $XB ([+/-X%])
- [Protocol]: $XB ([+/-X%])
- [Protocol]: $XB ([+/-X%])
- [Protocol]: $XB ([+/-X%])

## Chain Flow (top 3 by TVL, 7d)
- [Chain]: $XB ([+/-X%])
- [Chain]: $XB ([+/-X%])
- [Chain]: $XB ([+/-X%])

## Stablecoins
Total: $XB (±X% 7d). USDT $XB · USDC $XB · [next two] · combined share of mcap X%.

## Trending (CoinGecko)
- [COIN] — [why trending, price + 24h%]
- [COIN] — [...]
- [COIN] — [...]

## Prediction Markets (Polymarket, top by 24h vol)
| Market | YES% | 24h Vol | Liquidity |
|--------|------|---------|-----------|
| [question] | X% | $Xm | $Xm |
| [question] | X% | $Xm | $Xm |
| [question] | X% | $Xm | $Xm |

## Macro Catalysts (next 48h)
- [Catalyst + positioning implication]
- [...]
Omit this section entirely if nothing material. Do not pad with generic headlines.

## Implications for Downstream Skills
- **token-pick:** [e.g. "favor [narrative] exposure; avoid [sector] on weak breadth"]
- **narrative-tracker:** [e.g. "monitor [narrative] for phase transition emerging→rising"]
Keep to 1-2 lines per skill. Only write implications that follow from the Take and deltas — don't generate generic advice.

## Token Picks Made
| Date | Token | Price | Thesis |
|------|-------|-------|--------|
[Rebuild verbatim from the prior file. Do not truncate or reorder. Append any new picks found in the last 7 days of memory/logs/ that aren't already in the table.]

---
*Sources — btc/eth: CoinGecko · defi: DeFiLlama · sentiment: alternative.me · markets: Polymarket*
*Source status: coingecko=[ok|fail] defillama=[ok|fail] fng=[ok|fail] polymarket=[ok|fail] websearch=[ok|fail]*
```

**Preserve-on-failure rule:** If 3+ sources fail, **do not overwrite** `market-context.md`. Instead, append a one-line staleness note to the existing file's Source Status line (`last attempt ${today} failed: sources [...]`) and exit cleanly. A stale-but-valid file is strictly better than a broken one.

### 10. Log to `memory/logs/${today}.md`

```
## Market Context Refresh
- Regime: [take] (conviction [level])
- BTC: $X (±X%), ETH: $X (±X%), F&G: X ([label])
- Breadth: N/20 green
- Top narrative: [name] ([phase])
- Polymarket highlight: "[question]" YES X%
- Source status: [status string]
- Updated memory/topics/market-context.md
```

### 11. Send notification via `./notify` (under 500 chars)

```
market context — ${today}

take: [regime] (conviction [level])
BTC $X (±X%) / ETH $X (±X%) · F&G X ([label])
breadth N/20 · TVL $XB (±X% 7d)
top narrative: [name] ([phase])
hot market: "[polymarket q]" YES X%
```

## Environment Variables

- `COINGECKO_API_KEY` — CoinGecko Pro API key (optional, increases rate limits; not required)
- Notification channels via repo secrets (see CLAUDE.md)

## Constraints

- **No data-dump output.** If the file has no Take or the Take is a tautology ("market moved"), the run failed the quality bar.
- **No fabricated numbers.** If a source fails and there's no prior value, write `n/a` — never guess.
- **Preserve token-picks history.** "Never truncate" applies specifically to the **Token Picks Made** table: when overwriting `market-context.md`, copy the existing Token Picks Made table verbatim into the new version before adding new rows. The rest of the file is overwritten; only this table is carried forward. Never drop rows, never reorder them.
- **Concrete evidence only.** Every narrative phase claim must cite a number or signal; otherwise drop the narrative.
- **Deltas must be real.** "What Changed" only lists material moves (≥±1% BTC, ≥±5 F&G, ≥±2% TVL, or a new regime label). No filler.

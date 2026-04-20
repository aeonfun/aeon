---
name: DeFi Overview
description: Daily DeFi read — regime verdict, biggest movers with "why it matters", sustainable vs incentive yields, fees fundamentals
var: ""
tags: [crypto]
---
<!-- autoresearch: variation B — sharper output via regime verdict + sustainable-vs-incentive yield split + fees fundamentals + per-mover "why it matters" -->

> **${var}** — Chain or protocol to focus on (e.g. `solana`, `aave`, `arbitrum`). If empty, full market overview.

Read `memory/MEMORY.md` for context. Read the last 2 days of `memory/logs/` to avoid repeating numbers and to cite yesterday's figure when flagging today's change.

## Thesis

The original produced a table of numbers. This version produces a **read of the market**: one verdict line at the top, then only items that *changed* or *matter*, each with a one-line reason a reader should care. TVL alone is lagging and emission-subsidized — we pair it with fees/revenue (real fundamentals) and split yields into sustainable (`apyBase`) vs incentive-driven (`apyReward`) so readers stop chasing scam-tier APYs.

## Focus mode

- `var` empty → full market overview.
- `var` matches a chain name in `/v2/chains` (case-insensitive) → chain focus: scope DEX volume, fees, and yields to that chain; keep a 2-line market header for context.
- `var` matches a protocol slug in `/protocols` → protocol focus: pull `/protocol/{slug}`, `/summary/fees/{slug}`, `/summary/dexs/{slug}` if DEX; compare against its chain and its 30-day self.
- `var` matches neither → proceed as full overview and note `var unresolved: ${var}` in the footer.

## Steps

### 1. Fetch (public, no auth — use WebFetch if curl fails)

```bash
# TVL
curl -fsS "https://api.llama.fi/v2/chains"                        > .tmp/chains.json
curl -fsS "https://api.llama.fi/protocols"                        > .tmp/protocols.json

# Volumes & fundamentals (these are the endpoints the old version was missing)
curl -fsS "https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true"  > .tmp/dexs.json
curl -fsS "https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true"  > .tmp/fees.json

# Stablecoins
curl -fsS "https://stablecoins.llama.fi/stablecoins?includePrices=false"  > .tmp/stables.json

# Yields
curl -fsS "https://yields.llama.fi/pools"                         > .tmp/pools.json
```

For each endpoint, if curl fails or returns non-JSON, retry once with **WebFetch** against the same URL. Mark the source `ok` or `fail` — carry this into the footer. Never block the whole run on a single source.

`/protocols` and `/v2/chains` already include `change_1d` / `change_7d` / `tvl` — use these directly, do not diff manually. `/overview/dexs` and `/overview/fees` return `total24h`, `total7d`, `change_1d`, `change_7d`, `change_1m`, `protocols[]`.

If `var` is a chain, additionally fetch `/overview/dexs/{chain}` and `/overview/fees/{chain}` and filter pools by `chain == var`.

### 2. Compute the verdict (ONE line, leads the message)

Score three dimensions from the last 24h:

- `tvl_d = overall TVL change_1d` (sum across `/v2/chains`)
- `vol_d = DEX volume change_1d` (from `/overview/dexs`)
- `stable_d = stablecoin supply change_1d` (sum from `/stablecoins`)

Verdict rules (pick the first that matches):
- All three > +2% → **Risk-on** — capital flowing in across TVL, volume, and stables.
- Two of three < −2% → **Risk-off** — capital unwinding.
- `|tvl_d| < 1% AND |vol_d| < 5%` → **Sideways** — no conviction; grind day.
- Otherwise → **Mixed** — describe the split in ≤12 words (e.g. "TVL drifting up on steady volume, stables flat").

### 3. Pick what goes in the message

Each section caps at 3 items. **Drop any section whose best item fails its inclusion rule** — don't pad.

**Top chains** (3 items): rank by TVL; show `change_1d` only if `|change_1d| >= 1%`, otherwise suppress the delta.

**Movers — chains** (1 up, 1 down): filter `|change_1d| >= 5% AND tvl >= $500M`. Require a ≤15-word "why" grounded in what you observed (unlock, points program, bridge activity, depeg, exploit, launch). If you can't name a cause from the data or memory, write `"no obvious catalyst"` — do not invent one.

**Movers — protocols** (1 up, 1 down): filter `|change_1d| >= 10% AND tvl >= $100M`. Same "why" rule.

**Fundamentals — fees leaders** (top 3 by 24h fees from `/overview/fees`): include `change_1d` in fees vs 7d average. This replaces the old "top protocols by TVL" padding — fees > TVL for real demand.

**Fundamentals — fees-beating-TVL** (up to 2): protocols where `fees change_7d > +20% AND TVL change_7d < +5%`. These are where real demand is outpacing emission-subsidized capital. Skip section if none.

**DEX volume**: 24h total + top 3 DEXes with `change_1d`.

**Stablecoins**: total supply + any single stablecoin with `|change_1d| >= 1%` (usually only notable shifts survive).

**Yields** — split into two sub-sections, **each with a hard filter**:

- **Real yield (sustainable)** — 3 pools max. Filter:
  `apyBase > 0 AND apyReward_share < 0.5 AND outlier == false AND predictions.binnedConfidence >= 2 AND apyMean30d >= apy * 0.5 AND tvlUsd >= $10M`.
  Rank by `apyBase` descending.
- **Incentive yield (points / emissions)** — 2 pools max. Filter:
  `apyReward > 0 AND outlier == false AND tvlUsd >= $25M`. Tag with the reward token symbol. Rank by `apy` descending.

If zero pools survive either filter, omit that sub-section and note it in the footer (`real_yield=0` etc.) — this is itself a signal.

### 4. Compare against yesterday's log

Read `memory/logs/${yesterday}.md`. If a mover appears today whose direction flipped (e.g. chain was top gainer yesterday, now top loser), prepend `↔` and note the reversal in its "why" line. If a yield pool from yesterday's Real-yield list is missing today, check whether it failed a filter (outlier flipped, APY collapsed) — this is worth one line under Yields.

### 5. Notify

Send via `./notify` (single call, under 4000 chars, plain markdown). Template:

```
*DeFi — ${today}* — <Verdict>: <≤12-word regime read>

*TVL:* $X.XXT (+X.X% 24h, +X.X% 7d)

*Top chains*
1. Ethereum — $XXXB (+X.X%)
2. Solana — $XXB (+X.X%)
3. Tron — $XXB

*Movers*
↑ Sui +12% ($1.8B → $2.0B) — <≤15-word why>
↓ Base −7%  ($9.2B → $8.6B) — <≤15-word why>
↑ Pendle +18% ($4.0B → $4.7B) — <≤15-word why>
↓ Ethena −11% ($5.1B → $4.5B) — <≤15-word why>

*Fees leaders (24h)*
1. Tether — $XXM (+X% vs 7d avg)
2. Circle — $XXM (flat)
3. Uniswap — $XXM (−X%)

*Fees beating TVL*
• Hyperliquid — fees +42% / TVL +3% (7d) — demand outrunning deposits
• <second if any>

*DEX vol (24h):* $X.XB (+X%)  top: Uniswap $XB, PancakeSwap $XB, Jupiter $XB

*Stables:* $XXXB (+0.X%)  — USDe +1.2% only notable single-issuer move

*Real yield (sustainable, ≥$10M, filtered)*
• stETH (Lido, ETH) — 3.2% apyBase ($21B TVL)
• sUSDS (Sky, ETH) — 6.1% apyBase ($2.1B TVL)
• GHO savings (Aave, ETH) — 7.0% apyBase ($400M TVL)

*Incentive yield (points / emissions, ≥$25M)*
• <pool> — 18% apy via $XYZ rewards ($80M TVL)
• <pool> — 14% apy via $ABC rewards ($60M TVL)

_sources: llama_tvl=ok  llama_dex=ok  llama_fees=ok  llama_stables=ok  llama_yields=ok  | var: ${var:-none}_
```

Edit rules before sending:
- Any mover with `"no obvious catalyst"` stays — do not invent causes.
- Drop any section whose filter produced no items, except write one line explaining (e.g. `_no real-yield pools cleared filter today — apyMean30d gates tightened_`).
- If ≥2 sources are `fail`, prefix the title with `[DEGRADED]` and note which in the footer.
- If all sources fail, send a single line `DEFI_OVERVIEW_ERROR: all DeFiLlama endpoints failed` and stop.

### 6. Log

Append to `memory/logs/${today}.md`:

```
### defi-overview
- Var: ${var:-none}
- Verdict: <Risk-on|Risk-off|Sideways|Mixed> — <regime read>
- TVL: $X.XXT (+X.X% 24h)
- Top mover up: <chain/protocol> +X%
- Top mover down: <chain/protocol> −X%
- Fees leader: <protocol> $XXM
- Real-yield count: N   Incentive-yield count: N
- Sources: tvl=ok dex=ok fees=ok stables=ok yields=ok
```

## Sandbox note

The sandbox may block outbound curl for `*.llama.fi`. For every endpoint, if curl fails or returns a non-JSON body, retry once with **WebFetch** against the same URL before marking the source `fail`. All DeFiLlama endpoints used here are public and unauthenticated — no pre-fetch/post-process needed.

## Constraints

- Never invent a catalyst in the "why" line. `"no obvious catalyst"` is a valid answer.
- Never show an APY without its filter verdict (real vs incentive). No unlabeled yields.
- Drop empty sections rather than padding with low-conviction items.
- Keep the notification under 4000 chars — trim lowest-signal sections first (in order: Stablecoins, DEX top-3, Top chains #3).

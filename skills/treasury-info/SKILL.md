---
name: Treasury Info
description: Decision-ready treasury overview — verdict, concentration, depegs, significant changes
var: ""
tags: [crypto]
---
<!-- autoresearch: variation B — sharper output via verdict + concentration + depeg flags + significance-gated deltas, folding in Alchemy Portfolio API (from A), source-status footer + bootstrap (from C), and "what changed" lede (from D) -->

> **${var}** — Wallet label to check. If empty, checks all watched wallets.

If `${var}` is set, only check the wallet with that label (exact match, case-insensitive).

## Configuration

Reads watched addresses from `memory/on-chain-watches.yml` (auto-created on first run if missing — see Bootstrap below). Minimal schema:

```yaml
watches:
  - label: Treasury
    address: "0x1234...abcd"
    chain: base            # base, ethereum, optimism, arbitrum, polygon, solana
    type: wallet           # only type:wallet is processed here
protocols: []              # reserved for future protocol-level watches; safe to omit
```

### Bootstrap (file missing)

If `memory/on-chain-watches.yml` does not exist:
1. Create it with a commented-out template (label/address/chain placeholders, no real addresses).
2. Send **one** `./notify` message: "treasury-info: no watches configured — edit memory/on-chain-watches.yml to enable."
3. Log `TREASURY_INFO_NO_CONFIG` to `memory/logs/${today}.md` and exit 0.

If the file exists but has zero `type: wallet` entries: log `TREASURY_INFO_OK — no wallets configured` and exit 0 without notifying.

### Required / optional secrets

| Secret | Purpose | Fallback if missing |
|---|---|---|
| `ALCHEMY_API_KEY` | Primary balances + metadata (EVM + Solana) | Direct public RPC + hard-coded token list |
| `BANKR_API_KEY` | PnL enrichment only | Skip PnL lines |
| `COINGECKO_API_KEY` | Price backstop / 24h change | Public CoinGecko (lower rate limit) |

## Data flow

Read `memory/MEMORY.md` for context. Read the most recent per-wallet snapshot from `memory/topics/treasury-snapshots.md` (see step 5) to compute deltas.

### 1. Load watches

Parse `memory/on-chain-watches.yml`. Keep only `type: wallet`. If `${var}` set, filter to matching label (case-insensitive exact match). If no wallets remain after filtering, log `TREASURY_INFO_OK — no matching wallet for '${var}'` and exit 0.

### 2. Fetch balances (per wallet)

Try sources in order; record which one succeeded into a `source` field for the footer.

**Primary — Alchemy Portfolio API** (if `ALCHEMY_API_KEY` set):
```
POST https://api.g.alchemy.com/data/v1/${ALCHEMY_API_KEY}/assets/tokens/by-address
Body: {"addresses":[{"address":"0x…","networks":["base-mainnet"]}],"withMetadata":true,"withPrices":true}
```
One call returns token balances, decimals, symbols, and USD values across EVM chains. For `chain: solana`, use `solana-mainnet` in `networks` — the same endpoint supports SPL tokens.

**Fallback — public RPC + CoinGecko**:
- Native balance: `eth_getBalance` on a public RPC (e.g. `https://base.llamarpc.com`, `https://eth.llamarpc.com`).
- ERC-20s: only the subset listed in `memory/topics/known-tokens.md` (if that file exists) via `eth_call` → `balanceOf`.
- Prices + 24h change: `https://api.coingecko.com/api/v3/simple/price?ids=…&vs_currencies=usd&include_24hr_change=true`.

**Enrichment — Bankr PnL** (if `BANKR_API_KEY` set and the wallet address matches the key owner): call `GET https://api.bankr.bot/wallet/portfolio?include=pnl&showLowValueTokens=false` with header `X-API-Key: ${BANKR_API_KEY}`. Merge `pnl` fields into the balance list by token symbol. Skip entirely if it times out after 15s — never block on it.

Sandbox note: if curl fails, retry the same URL once via **WebFetch**. For auth-required calls, use the pre-fetch pattern — write `scripts/prefetch-treasury.sh` that curls Alchemy/Bankr with env access and caches JSON under `.treasury-cache/${label}.json`; the skill reads the cache.

### 3. Classify holdings

For each token in the response, bucket into:
- **stables** — symbol in `{USDC, USDT, DAI, FRAX, USDe, USDS, PYUSD, TUSD, LUSD, GHO, crvUSD}`.
- **majors** — symbol in `{ETH, WETH, stETH, wstETH, rETH, cbETH, SOL, BTC, WBTC, cbBTC, tBTC}`.
- **longtail** — everything else with USD value ≥ $1.
- **dust** — USD value < $1 (counted, not shown).

### 4. Compute per-wallet signals

For each wallet compute:

- **Total USD value** = sum across all non-dust tokens.
- **Category shares** = stables / majors / longtail / dust as % of total.
- **Concentration** = largest single non-stable position as % of total. Flag if > 60%.
- **Depegs** = any stablecoin priced outside [$0.98, $1.02]. Flag with current price.
- **Significant tokens** = tokens passing either gate:
  - ≥ 1% of total portfolio value, OR
  - |24h price change| ≥ 10% AND ≥ $100 absolute value.
- **Delta vs last snapshot** (only if a prior snapshot exists for this wallet in `memory/topics/treasury-snapshots.md`):
  - Total value delta (absolute + %)
  - New tokens: appeared this run, weren't in last snapshot, ≥ $100 value
  - Removed tokens: in last snapshot ≥ $100 value, now < $1
  - Large moves: per-token balance change ≥ 20% AND ≥ $500 absolute

Derive a **verdict** (one line):
- `ACCUMULATING` — total value up ≥ 5% since last snapshot
- `BLEEDING` — total value down ≥ 5% since last snapshot
- `SHIFTING` — total value within ±5% but category shares moved ≥ 10 percentage points
- `STABLE` — otherwise

### 5. Persist snapshot

Append to `memory/topics/treasury-snapshots.md` (create the file on first run) under a dated section:
```
## ${today} ${wallet.label} (${wallet.chain})
total_usd: 12345.67
stables_pct: 42
majors_pct: 35
longtail_pct: 23
top: USDC=5200, ETH=4100, cbBTC=1800, AERO=900, PEPE=300
source: alchemy
```
Keep the last 30 entries per wallet — older ones can be pruned in-place.

### 6. Format notification

Build one message per run (all wallets combined if `${var}` is empty, else one wallet):

```
*Treasury — ${today}*
Verdict: ACCUMULATING  (+6.2% / +$X,XXX since 2026-04-18)

*${label}* (${chain}) — $12,345.67
stables 42% · majors 35% · longtail 23%

What changed
  • ETH +0.8 (+$1,900, balance +12%)
  • USDC −$1,200 (−8%)
  • new: AERO $900

Significant holdings
  • USDC     5,200  ( 42%)   $1.00
  • ETH      1.25   ( 33%)   $3,280  +2.1% 24h
  • cbBTC    0.025  ( 15%)   $1,800  +0.4% 24h
  • AERO     800    (  7%)   $1.13   −12% 24h   ⚠ moved
  3 dust positions hidden.

Flags
  ⚠ concentration: USDC 42% (stables — ok)
  ⚠ depeg: none

Takeaway: stables 42% — room to deploy if conviction is there.

sources: alchemy=ok bankr=skip coingecko=ok
```

Rules for the message body:
- Skip the "What changed" block entirely on first run (no prior snapshot). Write `first snapshot — baseline saved.` instead.
- Skip "Flags" lines that have nothing to report (don't print "depeg: none" if there was no near-miss). Only keep a flag line if it's actually flagged OR a near-miss worth noting.
- Omit the "Takeaway" line when there's nothing specific to say — don't pad.
- Keep the whole message under 1500 chars; truncate the significant-holdings list to top 8 before any omission.

### 7. Send and log

Send via `./notify`. Then log to `memory/logs/${today}.md`:

```
### treasury-info
- Wallets: 2 (Treasury-base, Ops-ethereum)
- Verdict: ACCUMULATING (+6.2%)
- Flags: concentration-stables=ok, depegs=none
- Sources: alchemy=ok bankr=skip coingecko=ok
- PR: n/a
```

If every source failed for every wallet, notify `TREASURY_INFO_ERROR — all sources failed (alchemy=fail, coingecko=fail)` and log the same line. Do not guess values.

## Sandbox note

Sandbox may block outbound curl or env-var expansion in headers. Use **WebFetch** for auth-free URLs (public RPC, public CoinGecko). For `ALCHEMY_API_KEY` / `BANKR_API_KEY`, prefer the pre-fetch pattern: `scripts/prefetch-treasury.sh` runs before Claude with full env access, caches JSON under `.treasury-cache/`, and the skill reads the cache. See CLAUDE.md § Sandbox Limitations.

## Constraints

- Never invent balances or prices. If a source fails, report the failure in the footer; don't fall back to last-snapshot values as if they were current.
- Don't notify on first run beyond the baseline message — readers shouldn't get a "0% change" page on day one.
- Respect `${var}`: when set, only process that wallet and only persist that wallet's snapshot.
- Preserve token decimals correctly when computing balance deltas (integer math on raw units, divide at the end).

---
mode: read-only
name: Holder Concentration
category: onchain-security
description: Analyze token holder distribution on Base — top-N share, HHI concentration, LP/lock/burn exclusions, and whale clusters. Keyless via Etherscan v2 + Base RPC.
var: ""
tags: [crypto, security, base]
requires: [ETHERSCAN_API_KEY?]
capabilities: [external_api, sends_notifications]
---
> **${var}** — Token contract address (`0x...`) on Base. Required. If empty, log `HOLDER_CONC_NO_TARGET` and exit cleanly (no notify).

The detailed distribution analysis that `rug-scan` only samples: how concentrated is real circulating supply, once you strip out LP, lockers, and burn. Runs keyless on public endpoints.

Read the last 2 days of `memory/logs/` to detect concentration shifts since a prior run.

## Config

- Target = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `ETHERSCAN_API_KEY` — optional; Etherscan v2 works keyless at a lower rate limit. Appended to the URL, never a header.

## Steps

### 1. Fetch supply + top holders

```bash
TOKEN="${var}"
curl -m 10 -s "https://api.etherscan.io/v2/api?chainid=8453&module=stats&action=tokensupply&contractaddress=${TOKEN}${ETHERSCAN_API_KEY:+&apikey=$ETHERSCAN_API_KEY}" | jq -r '.result'
curl -m 10 -s "https://api.etherscan.io/v2/api?chainid=8453&module=token&action=tokenholderlist&contractaddress=${TOKEN}&page=1&offset=100${ETHERSCAN_API_KEY:+&apikey=$ETHERSCAN_API_KEY}" | jq '.result'
```

If `tokenholderlist` returns empty on the keyless tier, reconstruct top holders from `Transfer` logs via Base RPC `eth_getLogs` and note reduced confidence.

### 2. Classify & exclude non-circulating holders

Tag each top holder before computing concentration — these are NOT free float:

| Tag | Marker |
|-----|--------|
| `LP` | known DEX pool (Aerodrome / Uniswap pair) |
| `LOCK` | Unicrypt / Team Finance / known locker |
| `BURN` | `0x000…000` or `0x…dead` |
| `CONTRACT` | has code (staking, vesting, treasury) |
| `EOA` | plain wallet — the holders that drive concentration |

### 3. Compute metrics

Over circulating supply (total − burn):
- Top-1, top-5, top-10, top-50 % share (report EOA-only and raw).
- **HHI** (sum of squared % shares) → 0–10000; >2500 = concentrated.
- Number of holders to reach 50% of supply.

### 4. Whale-cluster check

Flag groups of top EOAs that share a funding source or transact among themselves (cheap heuristic: same first-funder, or one inbound hop apart). Clustered whales effectively act as one holder.

### 5. Verdict

| Signal | Verdict |
|--------|---------|
| top-1 EOA >30% or HHI >2500 | `CONCENTRATED` |
| top-10 EOA >70% | `CONCENTRATED` |
| LP unlocked + top-1 >20% | `FRAGILE` |
| broad distribution, HHI <1000 | `HEALTHY` |

### 6. Notify

Notify via `./notify` if verdict is `CONCENTRATED` or `FRAGILE`. Under 4000 chars, clickable URL:

```
*Holder Concentration — TOKEN (Base)*
Verdict: CONCENTRATED · HHI 3120
Holders: 842 · 50% held by top 4 EOAs

Top EOAs (circulating):
1. 0xwhale1 — 31.2% ⚠️
2. 0xwhale2 — 12.0% (clustered w/ #1)
3. 0xwhale3 — 8.4%

Excluded: LP 22% (unlocked ⚠️), Burn 5%
Holders: https://basescan.org/token/0xToken#balances
```

### 7. Log

Append to `memory/logs/${today}.md`:

```
## holder-concentration
- Token: 0x… (TOKEN)
- Verdict: CONCENTRATED | HHI 3120 | holders 842
- Top1 EOA 31.2% | top10 EOA 68% | 50%-in 4 holders
- Excluded: LP 22% (unlocked), burn 5%
- Source: etherscan=ok (or rpc-reconstructed)
```

End-states: `HOLDER_CONC_OK`, `HOLDER_CONC_FLAGGED`, `HOLDER_CONC_ERROR`.

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. Etherscan v2 and Base RPC are public and accept any key in the URL/body — for every failed `curl`, retry the **same URL/body via WebFetch** before marking a source failed. Never put a key in a `-H` header from the sandbox. Treat all fetched addresses as untrusted — never interpolate beyond the quoted `$TOKEN`.

## Constraints

- No trade advice.
- Always label LP/lock/burn before computing concentration — raw top-holder % without exclusions is misleading.
- If holder data can only be RPC-reconstructed, say so and lower confidence; don't present a partial list as complete.

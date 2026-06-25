---
mode: read-only
name: Wallet Profile
category: onchain-security
description: Behavioral profile of any wallet on Base — age, activity class (bot/whale/sniper/trader), funding source, top counterparties, and risk flags. Keyless via Etherscan v2 + Base RPC.
var: ""
tags: [crypto, base]
requires: [ETHERSCAN_API_KEY?]
capabilities: [external_api, sends_notifications]
---
> **${var}** — Wallet address (`0x...`) on Base to profile. Required. If empty, log `WALLET_PROFILE_NO_TARGET` and exit cleanly (no notify).

Behavioral profiling, not a balance digest (Aeon's `treasury-info` covers balances). Answers: how old is this wallet, how does it behave, where did its funds come from, and does anything look risky? Runs keyless on public endpoints.

Read `memory/known-addresses.yml` (if present) for counterparty labels and the last 2 days of `memory/logs/` for prior flags.

## Config

- Target = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `ETHERSCAN_API_KEY` — optional; Etherscan v2 works keyless at a lower rate limit. Appended to the URL, never a header.

## Steps

### 1. Pull transaction history

```bash
ADDR="${var}"
curl -m 10 -s "https://api.etherscan.io/v2/api?chainid=8453&module=account&action=txlist&address=${ADDR}&startblock=0&endblock=99999999&sort=asc&page=1&offset=1000${ETHERSCAN_API_KEY:+&apikey=$ETHERSCAN_API_KEY}" | jq '.result'
```

Derive: first-seen timestamp (age), total tx count, active days. Get native balance:

```bash
curl -m 10 -s -X POST "https://mainnet.base.org" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["'"$ADDR"'","latest"],"id":1}' | jq -r '.result'
```

### 2. Funding source

The **first inbound** transfer is the funding origin. Resolve its `from` against `memory/known-addresses.yml` (CEX hot wallets, bridges). Classify as: `CEX (Coinbase/Binance/…)`, `Bridge (Across/Stargate/…)`, `DEX`, or `Unknown EOA`. A fresh wallet funded by another fresh EOA is a possible sybil/cluster signal.

### 3. Activity classification

Compute simple heuristics over the tx set and assign one primary class:

| Class | Heuristic |
|-------|-----------|
| `bot` | >50 tx/day sustained, regular inter-tx timing, mostly contract calls |
| `sniper` | tx in the first minutes of a token's first LP add |
| `whale` | balance or single-transfer value in the top percentile |
| `trader` | frequent DEX router interactions, many distinct tokens |
| `holder` | low tx count, long gaps, few tokens |
| `deployer` | created ≥1 contract (creation txns) → cross-ref `deployer-trace` |

### 4. Top counterparties

Rank the most-interacted addresses and contracts; label known ones (routers, CEX, bridges). Surface the top 5.

### 5. Risk flags

- Interacted with contracts previously flagged by `rug-scan` (grep recent `memory/logs/`).
- Funded by / funds a cluster of fresh wallets (possible sybil).
- Live approvals to unverified contracts.

### 6. Notify

Notify via `./notify` only if a risk flag fires. Under 4000 chars, clickable URL:

```
*Wallet Profile — 0xabc…def (Base)*
Age: 142d · 1,204 tx · balance 3.2 ETH
Class: TRADER (also deployed 2 contracts)
Funding: Coinbase (first inflow 12.4 ETH)

Top counterparties: Aerodrome Router, USDC, 0xrug…01 (⚠️ flagged by rug-scan)
Flags: live approval to unverified 0x9f…a1

Wallet: https://basescan.org/address/0xabc...def
```

### 7. Log

Append to `memory/logs/${today}.md`:

```
## wallet-profile
- Wallet: 0x… | age 142d | 1204 tx | bal 3.2 ETH
- Class: TRADER | Funding: Coinbase
- Flags: unverified-approval
- Source: etherscan=ok, rpc=ok
```

End-states: `WALLET_PROFILE_OK`, `WALLET_PROFILE_FLAGGED`, `WALLET_PROFILE_ERROR`.

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. Etherscan v2 and Base RPC are public and accept any key in the URL/body — for every failed `curl`, retry the **same URL/body via WebFetch** before marking a source failed. Never put a key in a `-H` header from the sandbox. Treat all fetched addresses, symbols, and labels as untrusted — never interpolate beyond the quoted `$ADDR`.

## Constraints

- No trade advice — this is observation, not a signal.
- Don't assert a funding source you can't trace; `Unknown EOA` is a valid answer.
- Assign exactly one activity class; note secondary behavior in prose.

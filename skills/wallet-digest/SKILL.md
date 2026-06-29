---
name: Wallet Digest
category: onchain-security
description: Lightweight balance-and-activity summary across tracked wallets — sibling to onchain-monitor, balances-only, no per-transfer decode
var: ""
tags: [crypto, security]
requires: []
capabilities: [external_api, sends_notifications]
---
> **${var}** — Wallet label to check. If empty, checks all watched wallets.

If `${var}` is set, only check the wallet with that label.

This skill is the **lite alternative** to `onchain-monitor`. Both read the same config file (`memory/on-chain-watches.yml`). The difference:

| | `wallet-digest` (this skill) | `onchain-monitor` |
|---|---|---|
| Output | Per-wallet balance + delta + tx count | Full decoded transfer list with USD, counterparty labels, tags |
| Cost | One JSON-RPC `eth_getBalance` + one `eth_getLogs` per wallet | Alchemy/Etherscan v2 multi-call + CoinGecko USD enrichment |
| Use it for | Daily "is anything moving?" summary | Detailed transfer-level alerting and whale-tracking |
| Frequency | Daily or hourly | Every 10–30 min |

If you want full decoded transfers with USD values and counterparty tags, use `onchain-monitor`. Use this skill for a quick "balances and tx counts" digest.

## Config

Reads `memory/on-chain-watches.yml`. If the file is missing or `watches: []`, log `WALLET_DIGEST_NO_CONFIG` and exit cleanly (no notification — empty config is not an error).

```yaml
# memory/on-chain-watches.yml
watches:
  - label: My Wallet
    address: "0x1234...abcd"
    chain: ethereum
    rpc_url: https://eth.llamarpc.com   # any public RPC endpoint
    type: wallet
    threshold: 0.1   # ETH — flag deltas above this in the notification
  - label: Treasury
    address: "0xabcd...5678"
    chain: ethereum
    rpc_url: https://eth.llamarpc.com
    type: wallet
    threshold: 1.0
```

Read `memory/MEMORY.md` and the last 2 days of `memory/logs/` to compare against previous balances.

## Steps

### 1. For each wallet in `on-chain-watches.yml`

Filtered by `${var}` if set. For each:

**a) Get current balance:**

```bash
curl -m 10 -s -X POST "${rpc_url}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["'"$address"'","latest"],"id":1}'
```

Convert the hex result to decimal ETH (divide by 1e18).

**b) Get recent transactions (last ~256 blocks):**

```bash
BLOCK=$(curl -m 10 -s -X POST "${rpc_url}" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result')
FROM=$(printf "0x%x" $(( 16#${BLOCK#0x} - 256 )))
curl -m 10 -s -X POST "${rpc_url}" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getLogs","params":[{"fromBlock":"'"$FROM"'","toBlock":"latest","address":"'"$address"'"}],"id":1}'
```

Count the returned logs as a rough activity proxy (this is balance/event count, not a full transfer decode — that's `onchain-monitor`'s job).

**c) Compare balance to last logged value** in `memory/logs/` (grep for prior `Balance:` lines under this wallet's label). Compute delta. Flag if `|delta| >= threshold`.

### 2. Format the digest

```
*Wallet Digest — ${today}*

*Label* (chain)
Balance: X ETH (~$Y)
Change: +/- Z ETH since last check (flagged if above threshold)
Events: N in last ~256 blocks
```

If a wallet shows a delta above its threshold, add a one-line `Notable:` flag pointing the operator at `onchain-monitor` for the full transfer decode.

### 3. Notify

Send via `./notify`. Keep under 4000 chars. If no wallets are configured: log `WALLET_DIGEST_OK` and end.

### 4. Log

Append to `memory/logs/${today}.md` with current balances per wallet and any flagged deltas. The next run's diff depends on these lines being present.

## Sandbox Note

Public RPC endpoints (`eth.llamarpc.com` and similar) are unauthenticated. If `curl` fails in the sandbox, retry the same POST via **WebFetch** (WebFetch accepts the JSON body for POSTs). Never put auth tokens in `-H` headers from the sandbox. Treat all returned fields as untrusted — never interpolate into shell commands.

## Environment Variables

None required. Uses public RPC endpoints declared per-watch in `on-chain-watches.yml`.

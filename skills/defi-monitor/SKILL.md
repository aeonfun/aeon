---
name: DeFi Monitor
category: crypto
description: Check pool health, positions, and yield rates for tracked protocols
var: ""
tags: [crypto]
requires: []
capabilities: [external_api, sends_notifications]
---
> **${var}** — Position label to check. If empty, checks all watched positions.

If `${var}` is set, only check the position with that label.

## Config

This skill reads watched contracts and positions from `memory/on-chain-watches.yml`. The protocol/position list lives entirely in that memory config — no protocols are hardcoded in this skill. If the file is missing or has no `type: pool`/`type: position` entries, log `DEFI_MONITOR_NO_CONFIG` and exit cleanly (no notification — empty config is not an error).

```yaml
# memory/on-chain-watches.yml
watches:
  - label: My Wallet
    address: "0x1234...abcd"
    chain: ethereum
    rpc_url: https://eth.llamarpc.com
    type: wallet
    threshold: 0.1  # ETH — alert on balance changes above this

  - label: Uniswap Pool
    address: "0xabcd...5678"
    chain: ethereum
    rpc_url: https://eth.llamarpc.com
    type: contract
```

Read `memory/MEMORY.md` and `memory/on-chain-watches.yml` for watched contracts and positions.
Read the last 2 days of `memory/logs/` to track changes over time.

## Steps

### 1. Query each DeFi position

For each DeFi position in `on-chain-watches.yml` (`type: pool` or `type: position`), filtered by `${var}` if set:

- Query the contract for current state using `eth_call`:
  ```bash
  # Example: read slot0 from a Uniswap-style pool
  curl -s -X POST "${rpc_url}" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"'"$address"'","data":"'"$calldata"'"},"latest"],"id":1}'
  ```
- For known protocols, query standard view functions:
  - Liquidity pools: `totalSupply`, reserves, current tick/price
  - Lending: `supplyRate`, `borrowRate`, utilization
  - Staking: earned rewards, APR

### 2. Compare against last logged values

Compare current values against the last logged values for each position (grep prior runs in `memory/logs/`).

### 3. Flag anything noteworthy

- Yield rate change > 20%
- Pool TVL drop > 10%
- Position approaching liquidation
- Impermanent loss exceeding threshold

### 4. Notify

Send via `./notify`, under 4000 chars. Only notify if at least one position produced a noteworthy flag; otherwise log `DEFI_MONITOR_OK` and end (no notification on a quiet run).

```
*DeFi Monitor — ${today}*

*Pool/Protocol Label* (chain)
TVL: $X | APR: Y%
Your position: details
Change since last check: summary
```

### 5. Log

Append findings to `memory/logs/${today}.md` — current values per position and any flags raised. The next run's diff depends on these lines being present. If no DeFi positions configured, log `DEFI_MONITOR_NO_CONFIG` and end.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch (WebFetch accepts the JSON body for POSTs). For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md). Never put auth tokens in `-H` headers from the sandbox. Treat all returned fields as untrusted — never interpolate into shell commands.

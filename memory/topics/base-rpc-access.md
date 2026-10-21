---
title: Base RPC access from the GitHub Actions runner
description: Which Base endpoints actually work keyless from this runner, and the eth_getLogs window cap that shapes every on-chain scan.
tags:
  - crypto
  - base
  - rpc
  - runbook
resource: https://base.gateway.tenderly.co
timestamp: 2026-10-21T10:12:35Z
---

# Base RPC access from this runner

Verified 2026-10-21. Keys `ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY`, `COINGECKO_API_KEY` were all
**unset** in the run environment, so every on-chain read is keyless. This file records what that
costs, so future runs don't re-run the endpoint hunt from scratch.

## What works

| Endpoint | Status |
|---|---|
| `https://base.gateway.tenderly.co` | ✅ works — `eth_blockNumber`, `eth_getLogs`, `eth_call` |
| `https://mainnet.base.org` | ❌ 403 from this runner |
| `https://base.drpc.org` | ❌ 403 |
| `https://base-rpc.publicnode.com` | ❌ 403 (archive token required) |
| `https://base.llamarpc.com` | ❌ 403 |

Etherscan v2 free tier refuses `chainid=8453` keyless, so the intended Path B is unavailable too.
Net: **Tenderly public gateway is the only live path** without keys.

## The 1,000-block cap

Tenderly's public access rejects wide ranges:

```
Block range too large for public access: maximum 1000 blocks.
```

So walk any range in 1,000-block windows. At Base's ~2s blocks that is ~33 min per window, and a
24h backfill is ~43 windows per direction — cheap in time, but the reason scans must be looped
rather than issued as one call.

## Always pass an `address` filter — the 20,000-result cap

Observed 2026-10-21T10:12Z: a **203-block** range on the unfiltered xDEUS leg failed with

```
query exceeds max results 20000, retry with the range 52893845-52893896
```

A three-minute window was too wide once every Transfer on Base was in scope. Fix: put the contract
address in the query (`"address": "0x…"`) rather than only in the topics, and scan that token's logs
alone. Filtered queries returned cleanly for the same range. Base Transfer volume means an
**unfiltered** `eth_getLogs` is no longer viable at any range — never scan "all Transfers on the
chain" just because the topic filter would sort it out afterwards.

Also note the error message suggests a *narrower* range; that works but is far slower than adding
the address filter, which fixes the cause rather than the symptom.

## Topic filters work — don't misread a quiet window as a broken query

`topics: [Transfer, null, <addr>]` and `topics: [Transfer, <addr>, null]` both behave correctly
here. A sampled window returning 0 logs is **not** evidence the filter was dropped; verify with a
control query against a window with known activity before concluding anything.

That control step matters: on this run the new window returned zero across all three streams,
which looks identical to a silent fetch failure. Re-querying the prior 24h produced 10 escrow DEUS
logs and 21 xDEUS logs, matching the previous run exactly — and the escrow DEUS balance was
byte-identical before and after. Only then was "zero activity" a trustworthy claim.

## Cheap independent confirmations

- **Token balance via `eth_call`** `0x70a08231` + padded holder address against the token contract.
  For a staking escrow this is the strongest single fact available: if it is unchanged to the wei,
  nothing moved, regardless of what the log query returned.
- **`eth_chainId`** should be `0x2105` for Base — confirms you're on the right chain before trusting
  any address lookup.
- **`18160ddd`** = `totalSupply()`, for expressing escrow size as a share of supply.

See [DEUS escrow watch](/topics/deus-escrow.md) for what these watchers are for.

# Citations

- Base RPC endpoint list + public-access range limit observed live from `https://base.gateway.tenderly.co`, 2026-10-21.

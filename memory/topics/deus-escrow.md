---
title: DEUS / xDEUS watch addresses
description: The DEUS token contract plus the staking escrow and xDEUS NFT addresses every on-chain watcher reads, and what each one proves.
tags:
  - crypto
  - deus
  - base
  - runbook
resource: https://basescan.org/address/0xA85A38796B951CE87B378538b32B3E6Ee3C4C373
timestamp: 2026-10-21T11:00:00Z
---

# DEUS / xDEUS watch addresses

Chain: **Base** (`eth_chainId` = `0x2105`). Verified 2026-10-21 against live `eth_call` / `eth_getLogs`.

## Addresses

| Role | Address | Type |
|---|---|---|
| DEUS token (ERC-20) | `0x940A319B75861014A220D9c6c144d108552B089B` | token |
| Staking escrow | `0xA85A38796B951CE87B378538b32B3E6Ee3C4C373` | wallet |
| xDEUS | `0xe6d5f7439Bc236C40054e2275f765f59343D4431` | ERC-721 (soulbound) |

Configured in `memory/on-chain-watches.yml`; thresholds are per-watch USD.

## xDEUS is an NFT, not a token — and that is fine

`decimals()` **reverts** on xDEUS: it is ERC-721, and `Transfer` carries the `tokenId` in
`topics[3]` (four topics) rather than a value in `data`. This does *not* require changing the watch
config: the ERC-20 `Transfer` topic0 hash
(`0xddf252ad…23b3ef`) is the *same signature*, so the existing `event_topics` entry matches
mints, burns, and moves correctly. Only the decoding differs — don't read a value out of `data`.

## Reading stake vs unstake

Every stake or unstake pairs **one DEUS ERC-20 transfer** with **one xDEUS mint (stake) or burn
(unstake)** by the escrow. So:

- escrow DEUS balance **down** + xDEUS burn = someone unstaked.
- escrow DEUS balance **up** + xDEUS mint = new stake.

The strongest single check is the escrow's DEUS balance via `eth_call` `0x70a08231` — if it is
unchanged to the wei, nothing moved regardless of what the log query returned.

## Scale reference (2026-10-21)

- Escrow holds ~29.36M DEUS ≈ 3.35% of 876,222,316 total supply.
- xDEUS supply 1,711; escrow holds 57.
- A 24h window carries ~10 escrow DEUS logs and ~21 xDEUS logs. An order-of-magnitude drop from
  that is a signal; an exact zero warrants a control query first (see
  [Base RPC access](/topics/base-rpc-access.md)).

## Why the escrow is the tell

Spot DEUS liquidity is thin and the staked position carries a 5-day unstake cooldown. Escrow
outflow is therefore the *leading* indicator that someone decided the cooldown was worth paying —
which is exactly the decision the sentinel exists to surface. Research trigger is >5% of escrow
net-out in a single day; below that it's noise.

# Citations

- Addresses + ERC-721 behaviour observed live via `eth_call` / `eth_getLogs` against `https://base.gateway.tenderly.co`, 2026-10-21.
- Token contract from `memory/MEMORY.md` tracked-token table; escrow/xDEUS from `memory/on-chain-watches.yml`.

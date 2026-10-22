---
title: DEUS / xDEUS watch addresses
description: The DEUS token contract plus the staking escrow and xDEUS NFT addresses every on-chain watcher reads, and what each one proves.
tags:
  - crypto
  - deus
  - base
  - runbook
  - onchain
resource: https://basescan.org/address/0xA85A38796B951CE87B378538b32B3E6Ee3C4C373
timestamp: 2026-10-22T00:10:00Z
---

# DEUS / xDEUS watch addresses

Chain: **Base** (`eth_chainId` = `0x2105`). Verified 2026-10-21 against live `eth_call` / `eth_getLogs`.

## Addresses

| Role | Address | Type | Threshold |
|---|---|---|---|
| DEUS token (ERC-20) | `0x940A319B75861014A220D9c6c144d108552B089B` | token, 18 decimals | — |
| Staking escrow | `0xA85A38796B951CE87B378538b32B3E6Ee3C4C373` | wallet (holds staked DEUS) | $200 |
| xDEUS | `0xe6d5f7439Bc236C40054e2275f765f59343D4431` | ERC-721 (soulbound) | $250 |

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

Seeing one without the other in the same tx means something unusual is going on. The strongest
single check is the escrow's DEUS balance via `eth_call` `0x70a08231` — if it is unchanged to the
wei, nothing moved regardless of what the log query returned.

**Wallet-type watches must be scanned as a topic filter on the token contract**, never as
`eth_getLogs{address: <wallet>}` — an EOA emits no logs, so that shape returns zero forever. This
bit the escrow, owner EOA, staging, and vesting watches simultaneously on 2026-10-21.

## The 5%/day research trigger

The operator's intel threshold is escrow DEUS **net outflow > 5% in one day**. On 2026-10-21 the
escrow held 29,362,657.94 DEUS, so that gate sat at **1,468,133 DEUS** in a day. Observed outflow
across the whole day was 43,512.49 DEUS = **0.148%** — two orders of magnitude short.

When the gate *does* trip, the question to answer is not "how much" but "who": one whale pulling
out reads as an internal/team move, a crowd of small holders reads as a sentiment shift. Check
whether counterparties are contracts (likely a staking wrapper or vault) or plain EOAs.

## Counterparty map (as of 2026-10-21)

- `0x7901…0185` — **contract**, staked 25,000 DEUS twice in the same day, holds 25,000 DEUS + 5 xDEUS.
  Largest single accumulator seen. Contract code with a tiny footprint (`0xef01…` prefix) suggests a
  smart-account/wallet-contract rather than a shared protocol.
- `0x6e5f…cba5` — **contract**, round-tripper: 13,385 DEUS in, 7,560 + 5,020 out, retains 12 xDEUS.
  Operates like an active staking position being resized, not an exit.
- `0xf196…437b` — **contract**, unstaked 18,512.68 DEUS and now holds 0 DEUS, 0 xDEUS. Fully exited.
- `0xd5ff…c724` — **EOA**, unstaked 12,419.81 DEUS and still holds **52,837 DEUS liquid**. This is the
  address that matters: the one real holder with both size and a demonstrated willingness to sell.
  Worth watching as a future addition to `on-chain-watches.yml`.

## Sizing reality

Daily volume is thin (~$11.5k on the deep VIRTUAL pair, ~$4.6k on USDC). The escrow's own 24h
activity was 10 transfers, median $179, max $447. Nothing here approaches the $200/$250 alert
thresholds on a normal day — thresholds are calibrated to catch exceptions, not routine staking.

## Scale reference (2026-10-21)

- Escrow holds ~29.36M DEUS ≈ 3.35% of 876,222,316 total supply.
- xDEUS supply 1,711; escrow holds 57.
- A 24h window carries ~10 escrow DEUS logs and ~21 xDEUS logs. An order-of-magnitude drop from
  that is a signal; an exact zero warrants a control query first (see
  [Base RPC access](/topics/base-rpc-access.md)).

## Why the escrow is the tell

Spot DEUS liquidity is thin and the staked position carries a 5-day unstake cooldown. Escrow
outflow is therefore the *leading* indicator that someone decided the cooldown was worth paying —
which is exactly the decision the sentinel exists to surface.

# Citations

- All balances, transfers and counterparty classification read live from Base via
  `https://base.gateway.tenderly.co` (`eth_getLogs`, `eth_call`, `eth_getCode`), 2026-10-21.
- ERC-721 behaviour of xDEUS confirmed via `eth_call` (`decimals()` reverts), 2026-10-21.
- Prices from DexScreener token endpoint for `0x940A319B75861014A220D9c6c144d108552B089B`, 2026-10-21.
- Escrow/xDEUS addresses from `memory/on-chain-watches.yml`; DEUS token from the `MEMORY.md` tracked-token table.

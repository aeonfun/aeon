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
timestamp: 2026-10-23T21:24:29Z
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

## The CLAIM vault — 38.8% of supply, dripping ~$6.4k/day (2026-10-23)

This is the largest structural fact about DEUS supply and it is **not** the escrow. Address
`0x5cbf5dfaa5336ce0456e24217e7911365100879a` — `name()`/`symbol()` both return `DEUS` — is a
vesting/distributor vault holding **340,146,039.82 DEUS = 38.82% of the 876,206,780.45 total
supply**.

It pays out at a strikingly constant rate:

| Window | DEUS out | Per day |
|---|---|---|
| last 24h | 350,214.42 | 350,214.42 |
| last 7d | 1,981,979.13 | 283,139.88 |
| last 30d | 9,988,856.31 | 332,961.88 |

That is ~0.040% of supply/day ≈ **$6.4k/day at $0.01820 — 40.8% of the deepest pool's entire 24h
volume ($15,635)**. The drip is steady, not accelerating, so it reads as routine emissions rather
than a regime change. **The risk is not the rate; it is that recipients dump.**

### Claim-and-dump is measurable — use the ratio, not the payout

Proof, 2026-10-23 00:32Z: plain EOA `0xbf328713670d3407e94c3ab60ff1c36f95748e70` (nonce 538)
received 30,546.279 DEUS from distributor `0x20d29c8e…6fc5` at 00:32:21Z, another 61,019.563 from
the CLAIM vault at 00:32:33Z, and sold **all 91,565.842 DEUS into the deepest pool at 00:32:53Z** —
**32 seconds from first receipt to full exit**. It ended at `balanceOf` exactly 0 with 0.00756 ETH.
Tx `0xe2edb1b0e96e9a2d336b80b931f172fc21ee5c7281068dd9ddc3c1d7b716e9ad`, block 52963113.

**Price impact: −0.933% in that one block.** Reserves moved DEUS 19,303,121 → 19,393,771 and
VIRTUAL 515,912 → 513,501. So **~$1.7k of notional moves this pool 1%**.

That ratio converts a vague "overhang" into distance-to-trigger arithmetic:

- The operator's **$0.012** floor is **−34%** away. At constant liquidity that needs ~**2.5M DEUS**
  sold at market — seven full days of the entire claim drip dumped at once. **Routine emissions
  cannot grind the price to $0.012.** It requires a deliberate large seller.
- Conversely **$0.041** (the unstake line, +125%) cannot arrive from emissions either; it needs
  genuine external buying.

Other distributors in the same cluster: `0x0ae95bd7…c4a7` (`CLAIM W2`), `0xd4c450ac…9409`
(`CLAIM`), plus `0x20d29c8e…6fc5` and `0xea247ce9…e6ae` (unnamed, both contracts, both holding
~9.2M DEUS and having transferred **0** DEUS into the deep pool in 7d).

### Emissions get re-staked too

Same window, the opposite behaviour: EOA `0x5a46519659e3557112b90a8becb891873fe17406` (nonce 83)
staked **10,000 DEUS** into escrow at 20:06:29Z (tx `0xf126500c…ab24`, block 52998321), now holding
**24 xDEUS NFTs**. Funding chain ran claim → EIP-7702 router `0xcd920c78` → staker → escrow inside
~6 minutes. **Not external new money** — recycled emission — but constructive: someone chose the
5-day cooldown over selling. Escrow rose to 29,418,223.901 (+0.034%), still orders of magnitude
below the 5%/day (~1.47M DEUS) intel trigger.

# Citations

- All balances, transfers and counterparty classification read live from Base via
  `https://base.gateway.tenderly.co` (`eth_getLogs`, `eth_call`, `eth_getCode`), 2026-10-21.
- ERC-721 behaviour of xDEUS confirmed via `eth_call` (`decimals()` reverts), 2026-10-21.
- Prices from DexScreener token endpoint for `0x940A319B75861014A220D9c6c144d108552B089B`, 2026-10-21.
- CLAIM vault balance/emission, claim-and-dump tx, price impact and the 10,000-DEUS stake: live Base
  reads via `https://base.gateway.tenderly.co` (`eth_getLogs` chunked ≤1000 blocks, `eth_call`
  `balanceOf`/`totalSupply`/`name`/`symbol`, `eth_getTransactionReceipt`), head 53,000,418, 2026-10-23 21:16Z.
- Escrow/xDEUS addresses from `memory/on-chain-watches.yml`; DEUS token from the `MEMORY.md` tracked-token table.

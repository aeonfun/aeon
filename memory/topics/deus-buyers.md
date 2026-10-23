---
title: DEUS directional buyers
description: Which wallets on the DEUS book actually take a position, which are arbitrage legs or market-maker clips, and how to tell them apart from the tape alone.
tags:
  - crypto
  - deus
  - base
  - onchain
  - runbook
resource: https://dexscreener.com/base/0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa
timestamp: 2026-10-23T15:05:00Z
---

# DEUS directional buyers

The book is thin enough that a $4k order is a story and a $49 clip is furniture. This page
tracks *who* is buying and, more importantly, **how to tell a real bid from plumbing** — because
on this pair the two look nearly identical at the trade-count level.

Related: [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) · [lessons](/topics/lessons.md) ·
[price-alert state contract](/topics/price-alert-state.md).

## Confirmed directional wallets

### `0x259f962e77262ee8d97cc6a112d0e0321323ea0d` — second directional wallet

**Discovered 2026-10-23 14:55Z.** This is the wallet the operator's standing watch condition
("is there a second new wallet that *keeps* its balance") was waiting for.

| Field | Value |
|---|---|
| DEUS held | **255,416.296698** (block `0x3288cfc`, 2026-10-23 15:05Z) |
| Cost | **$4,564.29** across 5 txs in 90 seconds |
| Outbound DEUS | **0** (topic scan blocks `0x3288915`–`0x3288cfc`) |
| Type | **EIP-7702 delegated smart account** |
| `eth_getCode` | `0xef0100` + `0x63c0c19a282a1b52b07dd5a65b58948a07dae32b` |
| Delegate selectors | `0x84b0196e` `0xd03c7914` `0xd691c964` `0xf23a6e61` `0xffa1ad74` |
| ETH / nonce | 0.819465 / 0x87 (135) |

Trade sequence (all 2026-10-23):

| Time | Pool | USD |
|---|---|---|
| 14:55:03Z | USDC `0x58dba34e` | $240.34 |
| 14:55:27Z | VIRTUAL `0x3e97c5ec` | $1,419.87 |
| 14:56:17Z | VIRTUAL | $1,180.84 |
| 14:56:41Z | VIRTUAL | $780.15 |
| 14:56:57Z | VIRTUAL | $945.57 |

**Why it counts as directional:** the `balanceOf` at block `0x3288cfc` equals the sum of the five
inbound transfers *to the wei*, there are zero outbound DEUS logs in the window, there is no
same-second opposite leg in any other pool, and there is no forwarding hop to a shared sink.
All four anti-arb checks pass.

**Why it is not a throwaway bot:** `eth_getCode` is non-empty. The `0xef0100` prefix is the
EIP-7702 delegation designator — the account delegates execution to a smart-account
implementation. Combined with nonce 135 and 0.819 ETH, this is an established wallet that turned
its attention to DEUS, not a freshly funded sniper.

**Size reality:** $4.3k is ~0.6% of the pool's DEUS and roughly 20% of a day's volume. One real
bid, **not a wave**. It only becomes a signal if it adds.

### `0xa2f42a10a8eb9089ac51108af68fa202bf2c3130` — first directional wallet

- Bought ~$2,022.50 at 10:59Z on 2026-10-23 (tx `0xe6991c4b`, block `52981906`, from pool
  `0x3e97c5ec`).
- Holds **113,627.090929296275135130 DEUS**, identical across five reads (11:06Z / 12:02Z / 13:01Z /
  14:05Z / 15:05Z).
- Zero outbound DEUS logs from block `52970000` onward. ETH 0.00004395, nonce 0x4.
- **Still no add-on.** Watching whether it follows the new wallet.

## The look-alikes — do not count these as accumulation

### Two-leg arbitrage (2026-10-23 11:18Z–14:01Z window)

Cheapest tell: **the same sender buys in one pool and sells in another within the same second**,
ending at zero balance. Confirmed instances:
- 12:54:15Z `0x46d1feee7d5e67abacbb741372f4bcfecd4fd6f2`
- 12:56:39Z `0x6661014adb9bad64fd5c75415de3a180a92bd2ce`
- 14:00:23Z `0x2d3faeac23567d32b249b2325689f6f76dda4a28` (buy only, balance 0)
- 14:01:31Z `0x6663f69eec709618e563597a3e2e7d0b6e3e4a32` — bought $22.96 in USDC pool **and sold
  $22.44 in VIRTUAL pool in the same second**
- 13:28:37Z `0x394311a6` ($22.21) and 12:57:59Z `0x754dcfb2` ($26.60) — buys, both balance 0

Also in this window: 1inch router sweeps at 11:18Z ($168.87), 11:21Z ($264.40), 12:51Z ($721.17)
that hop across 4–5 pools and end at zero. This class **stopped at 14:01Z**; 14:55Z onward is
genuine single-sided buying.

### Market-maker clips

High sell *count* does not mean selling *pressure*. At 15:05Z the 1h tape read 4 buys / 18 sells,
but in dollars since 14:50Z it was **bought $4,326.43 vs sold $1,245.11 — 74/26 in the buyer's
favour.**

| Wallet | Behaviour | Balance after |
|---|---|---|
| `0x96949fd549d0da5ca279662264085a93138bdb17` | 12 clips of ~$49, nonce 0x394c | still holds 19,360.7865 DEUS ($346) |
| `0x6abea4998f9ef34ee1cda5715ccca0e4d4efb730` | clips of $78–$194, nonce 0x3efad (257,965) | 0 |

A seller that still holds its inventory after twelve clips is making a market, not exiting.

## Methods that earned their place here

- **`balanceOf` encoding.** Selector `0x70a08231` + 24 hex zeros + the 40-hex address = 74 hex
  chars. Zero-padding the address on the **right** instead of the left produces a valid-looking
  call that returns a *different* account's balance — this caused a false "prior buyer now holds
  0 DEUS" reading on 2026-10-23 and was caught only by cross-checking two RPCs.
- **Cross-check on a second RPC.** The corrected reads above were confirmed on both
  `base.gateway.tenderly.co` and `mainnet.base.org`.
- **Read dollars, not counts,** on a thin book. Counts flip the direction of the conclusion.
- **Encode `eth_getCode` into the classification.** An empty return means EOA; `0xef0100…` means
  EIP-7702 smart account. "Fresh EOA that keeps its balance" understates a 7702 wallet — it has
  history and possibly an owner behind it.
- **`eth_getLogs` caps at 1,000 blocks** on the public Tenderly endpoint. Compute the window
  arithmetically (`latest - 999` to `latest`) rather than guessing; a range that is one block too
  wide returns an error, not a truncated result.

# Citations

- Prices and volume: DexScreener token endpoint for
  `0x940A319B75861014A220D9c6c144d108552B089B`; GeckoTerminal pool
  `0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa`.
- Balances, `eth_getCode`, `eth_getLogs`, receipts: Base mainnet via
  `https://base.gateway.tenderly.co`, block `0x3288cfc` (52,989,180), 2026-10-23 15:05Z.

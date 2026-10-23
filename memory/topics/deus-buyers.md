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
timestamp: 2026-10-23T19:09:04Z
---

# DEUS directional buyers

The book is thin enough that a $4k order is a story and a $49 clip is furniture. This page
tracks *who* is buying and, more importantly, **how to tell a real bid from plumbing** — because
on this pair the two look nearly identical at the trade-count level.

Related: [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) · [lessons](/topics/lessons.md) ·
[price-alert state contract](/topics/price-alert-state.md).

## 🟢 NEW MONEY — 2026-10-23 19:09Z, the first genuine external inflow in four days

Two wallets that had **never held a single DEUS** took **51,420.36 DEUS ≈ $932.25** out of the
pools within 27 minutes (5.8% of the 24h volume). Both were verified at **exactly 0.000000** by
historical `balanceOf` at **−1h / −6h / −24h / −7d / −30d**. This is categorically different from
everything else on this page: it is not a rebuy, not a round-trip, not an arbitrage leg.

| Time (UTC) | Wallet | DEUS | USD | Paid with | Venue |
|---|---|---|---|---|---|
| 18:11:07Z | `0x1184de98c71b565a7bc8313d89d74322c3df7f3b` | 46,199.7603 | $837.52 | 0.3509 WETH (3 clips) | deepest Slipstream pool only |
| 18:38:11Z | `0x3fd516041851011f38a0e9367b9e67e2eefd9a96` | 5,225.2212 | $94.73 | 95.2583 USDC | 3 venues via 1inch v6 |

**`0x1184de98`** — plain EOA (`code 0x`), nonce **920** (919 at −24h, 832 at −30d), ETH 0.0106.
An established trader that had simply never touched DEUS. The tx
(`0x2260508925dbd183…300104b`, block 52,994,860) routed through two one-shot helpers
(`0x8d8f598c`, `0x0a2854fb` — both `code 0x60806040`, **nonce 1**, zero balance) and paid
0.1123 + 0.1193 + 0.1193 WETH. It took the whole clip from the single deepest pool — the most
expensive way to buy, i.e. someone who wanted size now, not a router squeezing basis points.

**`0x3fd51604`** — EIP-7702 delegated account (`code 0xef0100…`), nonce **290**, ETH 0.0029.
Routed through the **1inch v6 router** `0x111111125421ca6dc452d289314280a0f8842a65` and swept three
venues: 1,199.5650 DEUS from USDC `0x58dba34e` + 1,516.1550 from pool `0x498581ff` + 2,509.5012
from USDC `0x1b2f3f5c`, paying 21.9094 + 27.6249 + 45.7240 USDC.

**Why the escrow matters here:** `0xA85A38796B951CE87B378538b32B3E6Ee3C4C373` was
**29,408,223.901194 at both head and −6h**, and 29,405,267.589532 at −24h (+2,956.31 / +0.010% —
two orders of magnitude under the ~1,470,411 DEUS 5%-per-day intel trigger). So the buying power
is **external ETH/USDC, not unstaked coins recycling into the market.** The 5-day xDEUS cooldown
clock is untouched.

**What this does and does not prove.** $932 is 5.8% of a day's volume — real, but not a trend.
It says: after four days of pure market-maker furniture and fake passes, somebody outside the
existing holder set decided this level was worth buying. The test is whether either wallet adds a
second clip. Prior form says most don't — see the two "confirmed directional wallets" below,
both of which bought once and never added.

## The incumbent whale — `0x09b383a627c3d35daf38cd77af0064c1848833c6`

**Identified 2026-10-23 18:01Z.** Holds **2,136,607.370316 DEUS** (~$38.5k, 0.24% of the
876.2M supply), nonce **7,292**, plain EOA (`code 0x`), ETH 0.0488. It had never appeared in
this page before because it trades rarely and in small clips — the size lives in the *balance*,
not the prints.

| Time (2026-10-23) | Action | Pool | USD | Balance after |
|---|---|---|---|---|
| 12:05–14:05Z | — | — | — | 2,143,204.48 |
| 14:55:09Z | sell | USDC `0x58dba34e` | $101.36 | |
| 14:56:23Z | sell | USDC `0x58dba34e` | $145.61 | 2,129,185.78 |
| 15:05–17:05Z | — | — | — | 2,129,185.78 (flat) |
| 17:06:13Z | buy | VIRTUAL `0x3e97c5ec` | $62.78 | |
| 17:06:13Z | buy | USDC `0x58dba34e` | $72.64 | **2,136,607.37** |

**Why this matters:** the 17:06Z double-pool sweep was the only thing on the 18:01Z tape that
looked like a bid. It is not new money — it is the same wallet that **sold $247 into
`0x259f962e`'s 14:55Z bid** buying back $135 of it. Net position versus the start of the
afternoon: **−6,597.11 DEUS**, i.e. still short. Do not count this as accumulation.

Balance history for scale: 30d ago 2,083,761.32 · 14d ago 2,469,492.26 · 22nd 18:03Z
2,127,642.87 · 7d ago 2,090,066.37. It has been drifting down for two weeks.

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

**Follow-up, 2026-10-23 16:01Z — it did not add.** Balance still `255,416.29669795578` (identical
to the wei), nonce still 135, ETH still 0.81946456. A directional DEUS topic scan over blocks
52,989,180–52,991,014 (~56 min, chunked at 999 for the public RPC cap) returned **0 in / 0 out**.
Meanwhile 1h volume on the deepest pool fell from $5,587 to **$145** (−97.4%) and the 24h total
stopped rising. **Verdict: one clip, not accumulation.** The wallet remains the better candidate of
the two — it is the only one with an established nonce and real gas — but the trigger to care is
nonce **136**, not the original buy.

**Follow-up, 2026-10-23 18:01Z — still nonce 135.** Balance `255,416.296698`, ETH 0.81946456,
all byte-identical to the 14:55Z fill. **3h+ with zero accumulation.** The 17:06Z $135
double-pool buy was **not** this wallet — it was `0x09b383a6` buying back (see top of page).

### `0xa2f42a10a8eb9089ac51108af68fa202bf2c3130` — first directional wallet

- Bought ~$2,022.50 at 10:59Z on 2026-10-23 (tx `0xe6991c4b`, block `52981906`, from pool
  `0x3e97c5ec`).
- Holds **113,627.090929296275135130 DEUS**, identical across five reads (11:06Z / 12:02Z / 13:01Z /
  14:05Z / 15:05Z).
- Zero outbound DEUS logs from block `52970000` onward. ETH 0.00004395, nonce 0x4.
- **Still no add-on.** Watching whether it follows the new wallet. As of 19:09Z: **nonce 4,
  balance 113,627.090929 — 8h+ with zero movement.** This wallet has not touched DEUS since the
  original 10:59Z buy.

## The market maker bleeding inventory — `0x49a782c2660e77dded753bb88ac57619298ad50e`

Not an exit, but worth watching: 32,876.368821 DEUS at −24h → 30,643.585751 at 18:01Z →
**28,417.380092 at 19:09Z**. Sold 2,226.2057 DEUS into USDC `0x58dba34e` at 18:11:39Z
(tx `0x85d488f5d09c3569fc65c80564327f8bb0cfaa5921146ca72086df93912a3a74`), nonce 5,374.
Fifteen clips of ~$49 earlier in the day and it *still* holds inventory — so far this is
rotation, but the direction is one-way. If it crosses below ~20k it is reclassifying.

## The look-alikes — do not count these as accumulation

### Two-leg arbitrage (2026-10-23 11:18Z–14:01Z window, and again 15:22–15:58Z)

**Apply this test to sells as well as buys.** The 16:01Z run found 8 "sells" on the VIRTUAL pool
with zero buys — but every one was mirrored by a same-second *buy* on the USDC pool `0x58dba34e`
from the same `tx_from_address`:

| Time | Sender | VIRTUAL (sell) | USDC (buy) |
|---|---|---|---|
| 15:58:25Z | `0x666dbb00` | $13.56 | $13.79 |
| 15:50:41Z | `0x666749ed` | $13.81 | $14.02 |
| 15:27:03Z | `0x6663f952` | $13.29 | $13.56 |
| 15:26:23Z | `0x666749ed` | $14.08 | $14.35 |
| 15:22:27Z | `0x666968d9` | $10.84 | $10.97 |
| 15:22:07Z | `0x666ba056` | $14.57 | $14.73 |

Pool-level "0 buy / 8 sell" therefore **overstates selling to the point of being wrong** —
directional flow was zero. The largest seller of the hour, `0x8c76ccfa` ($62.60 at 15:06:03Z),
holds **0 DEUS** (nonce 50), confirming no retention.


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
| `0x96949fd549d0da5ca279662264085a93138bdb17` | 12 clips of ~$49, nonce 0x394c; still clipping at 18:01Z (nonce 14,776, holds 13,778.66 DEUS) | still holds inventory |
| `0x6abea4998f9ef34ee1cda5715ccca0e4d4efb730` | clips of $78–$194 both sides, 257,965 → nonce 258,110 by 18:01Z | 0 (passes through) |
| `0x49a782c2660e77dded753bb88ac57619298ad50e` | sold $40.32 at 17:06:17Z, nonce 5,368 | 30,643.59 (held 32,876 before) |
| `0x6e831ebc833edb0160ba874ae934ca0981ac8ebb` | $36.18 + $53.15 buys 17:05–17:06Z, nonce 77,018, `code 0x` | **0 — pass-through router** |

A seller that still holds its inventory after twelve clips is making a market, not exiting.
A buyer that ends at zero bought for someone else.

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
- **A revert is not a zero balance.** At 18:03Z on 2026-10-23 `mainnet.base.org` reverted all five
  `balanceOf` calls, including the escrow's, then returned correct values minutes later on the
  same endpoint. When every call in a batch reverts identically, suspect the endpoint, not the
  contract — retry, then cross-check a second RPC.
- **Compare the trade to the wallet's own history, not just to the book.** A buy print from a
  large holder can be a rebuy: `0x09b383a6` bought $135 at 17:06Z, but its balance was still
  6,597 DEUS *below* where it stood before it sold $247 at 14:55Z. Pull `balanceOf` at
  `latest`, `latest-1d`, `latest-48h` (2s blocks → 43,200/day) before calling direction.
- **GeckoTerminal `/trades` returns both pools' legs** when queried per pool — a single sender
  appearing in both lists at the same second is a sweep, not two buyers. Use it as the cheap
  first pass before pulling raw logs.
- **Aerodrome Slipstream Swap is a different event.** topic0 is `0xb3e27736`, **not** the Uniswap
  V3 `0xc42079f9`, and its data is **4 words** (amount0, amount1, sqrtPriceX96, liquidity), not 5.
  Scanning the deepest pool for `0xc42079f9` returns a clean **zero** and looks exactly like a
  dead pool — this burned three scans on 2026-10-23 19:09Z while DexScreener was reporting $860/hr
  of volume. If a pool shows no swaps but the aggregator shows volume, dump **all** logs for a
  known-active block (no `topics` filter) and read the real topic0 set before believing the zero.
- **New money vs. rebuy needs a multi-horizon `balanceOf` sweep.** Query at `head − {1800, 10800,
  43200, 302400, 1296000}` (2s blocks ⇒ 1h / 6h / 24h / 7d / 30d). The 19:09Z inflow was confirmed
  by all five horizons reading **exactly 0**. A 24h-only lookback cannot separate a first-time
  buyer from a whale that round-tripped earlier in the session.
- **A buy routed through 1inch is still real money — judge the terminal address.** The 18:38Z buy
  went through `0x1111…42a65` (1inch v6), which is also the pass-through sink that made the 16:41Z
  fake buy look real. The router is never the evidence; the end recipient's `balanceOf` is.
- **A helper contract with `nonce 1` and code is plumbing, not a buyer.** The 18:11Z $838 flow had
  two of them (`0x8d8f598c`, `0x0a2854fb`). Chase
  `eth_getTransactionByHash().from` and where the DEUS actually lands.

# Citations

- Prices and volume: DexScreener token endpoint and `/pairs/base/0x3E97c5EC…C1Fa` for
  `0x940A319B75861014A220D9c6c144d108552B089B`; GeckoTerminal pools
  `0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa`, `0x58dba34e6ee6eb76ef71a6ca0f18871cae817d3b`,
  `0x1b2f3f5c1b6037101fdd3ec14649e0d3f98fa642` (`/trades`, fetched 2026-10-23 19:0xZ).
- Balances, `eth_getCode`, `totalSupply`, historical `balanceOf` at block tags: Base mainnet via
  `https://base.gateway.tenderly.co`, head block **52,996,569**, 2026-10-23 19:09Z. Earlier reads:
  block `0x3288cfc` (52,989,180), 2026-10-23 15:05Z.
- The 19:09Z new-money buys: tx `0x2260508925dbd183e8e579cc20e78f219aaf7c878bd4afc61d5b9c3de300104b`
  (block 52,994,860, 18:11:07Z) and tx
  `0xe89c0d6d07721e787659adad057b03fa0b9d0a1952cc7d437d5086143f9d0e95` (block 52,995,672,
  18:38:11Z). Receipts decoded for ERC-20 `Transfer` legs; recipient balances read at five
  historical block heights.

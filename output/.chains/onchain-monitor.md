No notification — zero events, no threshold touched, which is the correct quiet outcome. Report follows.

---

# On-Chain Monitor — 2026-10-21 10:25 UTC

**TL;DR: Nothing moved. Both watches dead quiet over a 1.9-hour window, and the escrow's DEUS balance is unchanged to the wei — no stake, no unstake, no trigger touched.**

## Window

Block `52,890,402 → 52,893,894` on Base (3,492 blocks ≈ 1.9h, continuing from the 08:25 run). Not a full 24h — this run caught up only what accrued since the last one.

## DEUS escrow — `0xA85A38796B951CE87B378538b32B3E6Ee3C4C373`

| 项目 | 数值 |
|---|---|
| ERC-20 Transfer 触及本地址 | **0 笔（进 0 / 出 0）** |
| 余额（跑前） | 29,362,657.93714045 DEUS |
| 余额（跑后） | 29,362,657.93714045 DEUS |
| 占总量 | 3.35% of 876,222,316.05 |
| 按 $0.01797 折算 | **$527,660** |
| 退出比例 | 0.000% — 远低于 5%/日 情报门槛 |

Balance identical byte-for-byte before and after is the strongest fact here: no log decoding to second-guess, the tokens simply did not move.

## xDEUS — `0xe6d5f7439Bc236C40054e2275f765f59343D4431`

0 mints, 0 burns, 0 moves. Supply unchanged at **1,711**; escrow holds **57**. Staking activity is at a standstill for this stretch.

## 我为什么相信这个"零"

A zero result and a broken query look identical, so I ran a control before accepting it:

- Re-queried the **prior** 24h window → escrow returned **10 DEUS logs**, xDEUS **21 logs** — both match the 08:25 run exactly (18,512.68 / 7,560.00 / 5,020.00 / 12,419.81 unstakes all present). Query path is live.
- Escrow balance via `eth_call` matches to the wei.

So the quiet window is real, not a silent fetch failure.

## 门槛距离（DEUS $0.01796979, CoinGecko, 10:25 UTC）

- **$0.025 卖现货** — 还差 **+39.1%**
- **$0.032 卖现货** — 还差 **+78.1%**
- **$0.012 恐慌位** — 需下跌 **-33.2%**
- **$0.041 启动 unstake** — 还差 **+128.2%**

24h +1.95%，成交 $30.6k。均未触及。**不需要任何动作。**

## 源状态

`alchemy=skipped (key unset)` · `etherscan=skipped (free tier 拒 chainid 8453)` · `rpc=tenderly-public (ok)` · `coingecko=ok` · `dexscreener=ok`

Keyless limitations worth remembering: no decoded/categorized transfers, no native ETH visibility — ERC-20/ERC-721 logs only. If the operator ever wants the full picture, `ALCHEMY_API_KEY` is the single unlock.

## Summary

- **Result:** `ON_CHAIN_OK (n_watches=2, n_raw=0, n_dropped=0)` — no alert sent (zero events, no trigger).
- **Files modified:** `memory/on-chain-state.json` (both watches advanced to block 52,893,972), `memory/logs/2026-10-21.md` (appended `### onchain-monitor`).
- **Files created:** `memory/topics/base-rpc-access.md` + index entry — records that Tenderly's public gateway is the only working keyless Base endpoint from this runner, its 1,000-block `eth_getLogs` cap, and the control-check habit that distinguishes a quiet window from a dead query. Saves the next run the endpoint hunt that cost this one seven probes.
- **Follow-up:** none urgent. Mid-run I briefly misread the empty result as a dropped topic filter — the control query disproved it. The note above is there so that mistake doesn't recur.

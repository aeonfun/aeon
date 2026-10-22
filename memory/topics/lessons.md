---
title: Lessons learned — archive
description: Detail behind the one-line lessons in MEMORY.md, kept here so MEMORY.md stays an index.
tags:
  - lessons
  - runbook
timestamp: 2026-10-22T00:15:00Z
---

# Lessons learned — archive

MEMORY.md carries the one-line form of each lesson. This file holds the detail.

## NOTE / Robinhood Chain

- **代币合约本身作为 watch 时，`to == watch` 算不出方向。** NOTE 的 watch 地址就是代币合约，所以要按池子判断：`X → PoolManager` 是卖，`PoolManager → X` 是买。按错误逻辑，2026-10-21 14:57Z 那笔 88,744 NOTE 的**买入**会显示成大额流出。多跳路由下同一笔 tx 里 NOTE 会转手 4 次，按"每笔 Transfer"计数会把 1 笔记成 4 笔。详见 [NOTE 笔记](/topics/tokens/note-systems.md)。
- **calldata 解码 ≠ 链上事实。**「30 天线性释放每天 2 万」是从 selector `0x091e7db9` 的 calldata 推出来的；4 小时后 0 笔出账、四个标准 selector 全 revert，证明那只是登记调用。**先看余额与出账，再谈机制。**
- **新钱包 + 固定金额整数 = 先看 gas。** NOTE 团队抛售前会把整数枚转进全新 EOA；该 EOA 无 ETH 时无法卖出，所以"第一笔 ETH 入账"比"转账发生"更接近真实开砸时刻。盯 gas 充值，不要盯转账本身。
- **链上预警有保质期。** 一旦团队把"一次性砸盘"改成"线性释放"，盯转账就失效了 —— 信号还在，但边际价值塌了。判断出货持续性要看**总量与节奏**，不是单笔。
- **owner 自有余额与 timelock 是两条独立供给。** 别只盯 unlock 排程：NOTE owner EOA 不等 10-23 解锁就自行转出了 24 万。
- **Robinhood Chain (4663) 不需要 key。** `rpc.mainnet.chain.robinhood.com` 免密钥即可 `eth_getLogs` 宽区间；GeckoTerminal (`networks/robinhood`) 和 CoinGecko 都能报价。别浪费回合找端点。
- **监控盲区：Path C 只读 ERC-20 logs，看不到 native ETH。** Robinhood 无 key 时 `onchain-monitor` 走 Path C，因此"staging 钱包被充 gas"这类触发器永远不会响，需要额外跑 `eth_getBalance` 轮询。

## Keyless Base reads

- **Keys are unset in this repo's runs** (`ALCHEMY_`, `ETHERSCAN_`, `COINGECKO_API_KEY`). Keyless Base reads work only via Tenderly's public gateway, capped at 1,000 blocks per `eth_getLogs` — and 20,000 results, so always pass an `address` filter. See [Base RPC access](/topics/base-rpc-access.md).
- **Never trust a zero-log window.** Re-query a window with known activity and check the escrow balance via `eth_call`; only then is "quiet" real.

## Watch configuration

- **钱包型 watch 不能用 `eth_getLogs{address: <EOA>}`。** EOA 不发事件，该写法永久返回 0 —— owner EOA / staging / vesting / DEUS escrow 四个 watch 曾长期处于假零。正确形状是在**代币合约**上做 topic 过滤：`[Transfer, null, padded(wallet)]` 收、`[Transfer, padded(wallet)]` 发。
- **xDEUS is ERC-721, not ERC-20** — `decimals()` reverts, `Transfer` carries `tokenId` in `topics[3]`. The ERC-20 topic0 hash still matches, so watch config needs no change.

## Price feeds

- **缺 `h1` ≠ 平静。** DexScreener 对薄盘口常省略 `priceChange.h1`；skill 按 0 处理，于是 sharp-move gate 显示 QUIET 而实际是**未测量**。state 里存 `null` 而非 0，下一轮才能区分"测过且平"与"没测到"。

# Citations

- `memory/logs/2026-10-21#onchain-monitor`, `#telegram-reply`, `#heartbeat-brief`, `#price-alert`
- `memory/logs/2026-10-22#price-alert`

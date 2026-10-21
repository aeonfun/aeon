---
title: Note Systems (NOTE)
description: Note Systems NOTE 代币 —— Robinhood Chain (4663) 上的结构化票据协议治理/激励代币，合约、供应、持仓与解锁排程
tags: [robinhood-chain, token, unlock, note-systems]
resource: https://note.systems/
timestamp: 2026-10-21T10:25:00Z
---

# Note Systems (NOTE)

## 合约

| 项 | 值 |
|---|---|
| 合约 | `0xc4f730335Fb9e439ca5552f7b52B8E638c4245B0` |
| 链 | Robinhood Chain (chainid `4663`) |
| 标准 | ERC-20，18 decimals |
| name / symbol | `Note Systems` / `NOTE` |
| totalSupply | 60,000,000 |
| CAP() | 100,000,000（尚有 40M 未铸造） |
| EPOCH() | 604,800 秒（7 天） |
| owner() | `0x0b64b35c6dd23944d6d4029864d2ca2aa1b66422`（**普通 EOA**，nonce 362 —— 无多签、无 timelock） |
| paused() | 0 |

数据源：`rpc.mainnet.chain.robinhood.com` eth_call，2026-10-21T10:05Z。

## 项目

Note Systems 做的是代币化股票的**结构化票据**：COUPON（USDG 方）与 SHIELD（股票方）两个对立头寸，配 AMM（S-DAMM）和 ERC-4626 的 Desk 资金层。研究标的 NVDA/TSLA/AAPL/MSFT/AMZN/META/COIN/HOOD。
官网自述 "live on Robinhood Chain testnet" —— 但链上已是主网（4663）且用真 USDG，官网文案可能滞后。
报价资产 **USDG** = `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`（6 decimals，Global Dollar）。

## 市场（DexScreener，2026-10-21T10:10Z）

- 价格 `$0.05415`，FDV `$3.25M`，24h `-9.11%`
- 主池 NOTE/ETH Uniswap v4 `0x378b1023…7f9f91`：TVL `$476k`，24h 量 `$182k`
- 次池 NOTE/USDG `$9.4k`；四小池合计 < $1k。全部流动性约 `$487k`
- 池内 NOTE 持仓 `5,257,400`（8.76% of supply，约 $252k）

## 持仓集中度（2026-10-21T10:12Z，对 24h 内出现的地址逐个 balanceOf）

| 地址 | NOTE | 占供应 |
|---|---|---|
| `0x4a53afd9…7518b8` TimelockController | 15,254,442 | **25.42%** |
| `0x8366a39c…e40951` Uniswap v4 PoolManager | 5,257,717 | 8.76% |
| `0xfdd983c6…289962` | 1,403,280 | 2.34% |
| `0x0b64b35c…b66422` owner EOA | 960,000 | 1.60% |

## 解锁机制（关键）

Timelock `0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8`（OZ TimelockController）持有 25.42%，`getTimestamp` 显示 **delay = 172,800 秒 = 48 小时**。
owner EOA `0x0b64…` 是 PROPOSER（`hasRole` = 1）：可随时 schedule，48h 后自行 execute。

### 历史排程（60 天，CallScheduled/CallExecuted/Cancelled 配对）

| 排程时间 (UTC) | 金额 NOTE | 结果 |
|---|---|---|
| 2026-09-08 22:53 | 7,454,442 | **取消** |
| 2026-09-10 12:27 | 2,000,000 | 执行 09-12 12:34 |
| 2026-09-10 19:14 | 1,000,000 | 执行 09-12 19:18 |
| 2026-09-15 15:12 | 4,000,000 | **取消** |
| 2026-09-17 10:31 | 2,079,207 | **取消** |
| 2026-10-18 11:13 | 1,200,000 | 执行 10-20 11:22 |
| **2026-10-21 09:57** | **1,200,000** | **待执行，10-23 09:57:36Z** |

模式：先挂一笔大额（4M–7.5M）作烟雾，取消后再执行 1M–1.2M 的小额。表面看"取消了巨额解锁"，实际每月仍有百万级线性流出。

## 上一次解锁的处置方式（2026-10-20）

1. 11:22 owner EOA 通过 timelock 收到 1,200,000 NOTE
2. 19:05 转 240,000 NOTE 到**全新 EOA** `0x6f62b43d8dfc378d3e2e8f8b1095919282691789`（nonce 4）
3. 19:14–19:19 该 EOA 分两次把 240,000 转给 `0xd000b458…4695d3`（另一个新 EOA）
4. 20:52:36–20:52:46 **10 秒内** 连续 9 笔 `modifyLiquidities` 砸进 NOTE/ETH v4 池，每笔 **26,640 NOTE** 固定切单，共 239,760 NOTE；剩 240 NOTE 未卖

即：把 24 万枚拆成 9 份固定大小、10 秒内连续抛售 —— 明显的拆单规避冲击成本手法，不是自然卖盘。

## 第二次解锁的处置（2026-10-21，进行中）

**同一个 240,000 的整数，提前了整整一天。**

1. 10:19:04Z（blk 0x59d7de4，tx `0x2368258b…b7e0`）owner EOA 转出 **240,000 NOTE** 到 `0x69bb2e438b04109dc1ec0cc43f77f455649d7c63`
2. 该钱包**全新**：nonce = 0，从未发过交易；ETH 余额 = 0
3. 因此**当前无法卖出** —— 需先被 gas 充值

关键差异 vs 上一轮：上一轮是 unlock 执行后 7h43m 才转账；这一轮在下一次 unlock（10-23 09:57Z）**之前**就先转了 24 万。说明 owner EOA 手里还有可自由支配的余额（转出前 960,000，转出后 720,000），不必等 timelock。

**触发信号**：`0x69bb` 的**第一笔出账**，或**第一笔入账 ETH**。两者任一发生即视为抛售启动。

## 价格背景（GeckoTerminal OHLCV，2026-10-21）

- 10-15 高点 $0.0879 → 10-21 $0.0533，6 天 −39%
- 10-19 单日区间 $0.0519–$0.0767（振幅 48%）
- 10-20 22:52 那次 9 笔砸盘，池子价格 $0.0571 → $0.0559（−2.1%），说明 24 万的冲击被池子吸收了约 2%
- 结论：240,000 ≈ 日成交量 7%，单次冲击温和；真正的压力来自 120 万 timelock 解锁

## 24h 资金流（2026-10-20T10:00Z → 2026-10-21T10:00Z，block 93333434 → 94197434）

- Transfer 事件 1,712 个 / 1,211 笔 tx；发送方 168、接收方 204
- 进入池 2,139,865 NOTE / 流出池 1,791,626 NOTE → **净卖压 +348,239 NOTE（约 $18.9k）**
- 无 mint、无 burn（供应固定在本轮 60M）
- 除池子外最大净流入：owner EOA +960,000；最大净流出：timelock −1,200,000

## 风险点

- owner 是单 EOA，掌握 mint（cap 尚有 40M）、pause、以及 timelock 提案权 —— 单点完全控制
- 每 48h 可解锁 120 万 NOTE ≈ 2% 供应 ≈ $65k；相对 $182k 的日成交量是显著压力
- 解锁后惯用手法是新 EOA + 固定切单抛售，链上可提前 48h 看到
- **owner 不需等 timelock**：它自持 720,000 NOTE，可随时自行转出（10-21 的 24 万即来自自有余额）

# Citations

- 链上数据：`https://rpc.mainnet.chain.robinhood.com`（eth_call / eth_getLogs），2026-10-21
- 行情：DexScreener `api.dexscreener.com/latest/dex/tokens/0xc4f730335fb9e439ca5552f7b52b8e638c4245b0`
- K 线：GeckoTerminal `api.geckoterminal.com/api/v2/networks/robinhood/pools/0x378b1023…7f9f91/ohlcv/hour|day`（keyless，200）
- 市值：CoinGecko `api.coingecko.com/api/v3/coins/note-systems`（keyless 可用）
- 项目：`https://note.systems/`、`https://note.systems/docs/`
- 浏览器：`https://robinhoodchain.blockscout.com`（Cloudflare 403，未用）

## NOTE · Note Systems（Robinhood 链）

合约 `0xc4f730335Fb9e439ca5552f7b52B8E638c4245B0`，链 4663，ERC-20，18 位精度。

**是什么**
代币化股票的结构化票据协议：COUPON（USDG 方）对 SHIELD（股票方），配 AMM 与 ERC-4626 资金层。标的 NVDA/TSLA/AAPL/MSFT/AMZN/META/COIN/HOOD。报价币是 USDG。

**当前市场**（DexScreener，2026-10-21 10:10Z）
- 价格 $0.05415 — 24h −9.11%
- FDV $3.25M
- 主池 NOTE/ETH（Uniswap v4）TVL $476k — 24h 量 $182k
- 全部流动性约 $487k

**供应与持仓**
- 总量 60,000,000 — 上限 100M，尚有 40M 可铸
- Timelock 合约 15,254,442（**25.42%**）
- v4 PoolManager 5,257,717（8.76%）
- owner EOA 960,000（1.60%）

> ⚠️ **48 小时后又有 120 万 NOTE 解锁**

排程时间 2026-10-21 09:57:36Z（约在你发消息前 1 小时），delay 48h，**可执行时间 10-23 09:57Z**。金额 1,200,000 NOTE ≈ 2% 供应 ≈ $65k。

**为什么在意——上一次是这么卖的**
10-20 11:22 解锁 120 万，当天 19:05 转 24 万到全新 EOA，20:52:36 起 **10 秒内连发 9 笔** `modifyLiquidities` 砸进 NOTE/ETH 池，每笔固定 26,640 NOTE，共 239,760。拆单痕迹极明显。

**解锁历史套路**（60 天）
先挂大额 → 取消 → 再执行小额：
- 09-08 挂 7,454,442 → 取消
- 09-15 挂 4,000,000 → 取消
- 09-17 挂 2,079,207 → 取消
- 实际执行：200 万（09-12）、100 万（09-12）、120 万（10-20）、120 万（待 10-23）

**24h 净卖压**（block 93333434→94197434，2026-10-21 10:00Z）
- 进池 2,139,865 / 出池 1,791,626 NOTE
- 净卖 +348,239 NOTE ≈ $18.9k
- 1,712 笔 Transfer / 1,211 tx，无铸造无销毁

**控制权风险**
owner 是**普通 EOA** `0x0b64b35c…b66422`（nonce 362），无多签无 timelock 保护。它同时握有 mint（cap 还剩 40M）、pause、以及 timelock 提案权。单点全控。

**要不要盯**
New EOA `0x6f62b43d8dfc378d3e2e8f8b1095919282691789` 和 `0xd000b458f6a194b10e3ff516b00b94f7234695d3` 是上一轮抛售的执行地址，目前余额已清空。若 10-23 解锁后出现新的同类地址 + 固定切单，就是同一套动作。

想加进监控的话，回我一句 `盯 NOTE` 就行。

---
来源：rpc.mainnet.chain.robinhood.com（eth_call / eth_getLogs，2026-10-21T09:57–10:12Z）；api.dexscreener.com/latest/dex/tokens/0xc4f730335fb9e439ca5552f7b52b8e638c4245b0；note.systems
浏览器：robinhoodchain.blockscout.com/token/0xc4f730335Fb9e439ca5552f7b52B8E638c4245B0

⚠️ Priority Brief — 2026-10-21

## Priority Brief — 2026-10-21

### Focus today

1. **给 NOTE staging 钱包 0x69bb 补上 native ETH 检测** — 现在这条 watch 只能看 ERC-20，看不到它被充 gas 的那一刻，所以预设的触发器实际上打不响。
   why now：转账后 **17 分钟**，上一轮同额 24 万是 **1h47m** 后开砸 —— 还剩约 1.5 小时，但检测现在是瞎的。

2. **1,200,000 NOTE timelock，2026-10-23 09:57Z 可执行** — 量级是这次 24 万的 5 倍。
   why now：48h 前置窗口已开，而且 owner 这次**没等它**就自行动用了自有余额，两条供给通道是并行的。

3. background：DEUS $0.01805，四门槛全未触及，最近一档 $0.025 还差 +38.5% —— 仓位不用动，今天也没有值得付 5 天冷却的涨幅。

### Since yesterday

- **NOTE 供给动作**：owner EOA `0x0b64b35c…b66422` 于 10-21 10:19:04Z 转出 **240,000 NOTE** 至全新钱包 `0x69bb2e43…d7c63`（blk 94210020，nonce 379）。
- **该钱包仍然卖不掉**：刚查（10:35Z）nonce = 0、ETH = 0，NOTE 余额 240,000（$12,986 @ $0.05411）。第一笔出账或第一笔 ETH 入账 = 真实开砸前兆。
- **⚠️ 监控盲区**：`onchain-monitor` 的 Path C 用 `eth_getLogs` 过滤 ERC-20 `Transfer`，**看不到 native ETH**（skill 第 177 行自认 "sees ERC-20 moves only"）。staging 钱包的触发条件恰好是"第一笔 ETH 入账" —— 这条 watch 永远等不到。需要加 `eth_getBalance` 轮询。
- **10-23 的 120 万仍在排程上**：CallScheduled 10-21 09:57Z，可执行 10-23 09:57Z。timelock 自 blk 94197434 起 **0 个新事件**，未被撤销。
- **NOTE 价格** $0.05411｜1h −0.32%｜24h −9.09%｜主池 liq $474.9k｜24h vol $187k → 这 24 万约合 **7% 日成交量**。
- **fleet**：10:09Z 真实 `schedule` 事件恢复，四个 skill 全部 dispatched 且成功；issue #1 已于 10:14:53Z 关闭，现在 **0 open PR / 0 open issue**。

### Running today

- `price-alert` @ 每小时整点（下一次 11:00 UTC）
- `onchain-monitor` @ 21:00 UTC
- `memory-flush` @ 23:30 UTC

---
*数据源：NOTE 合约 `0xc4f730335Fb9e439ca5552f7b52B8E638c4245B0`（Robinhood Chain 4663）· RPC `rpc.mainnet.chain.robinhood.com`（eth_call / eth_getLogs，keyless）· 价格 DexScreener 10:35Z*
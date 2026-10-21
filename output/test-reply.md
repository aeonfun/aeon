**通了。** 这是 Telegram → Aeon 的往返测试，链路正常。

**DEUS 现状**（DexScreener，合约 `0x940A319B75861014A220D9c6c144d108552B089B`，Base）

| 项 | 值 |
|---|---|
| 价格 | $0.01789 |
| 24h | +2.13% |
| 池子流动性 | $702.6k（Aerodrome USDC） |
| 24h 量 | $10.1k |

**距你的门槛**

- $0.025（卖现货）→ 还需 **+39.7%**
- $0.032（卖现货）→ 还需 **+78.9%**
- $0.041（回本线，启 unstake）→ 还需 **+129.2%**
- $0.012（恐慌位）→ 还需 **-32.9%**

四个价位都没碰到，今天不用动。

**两个待确认**

1. `price-alert` 已启用（每小时），但 `memory/topics/price-alert-state.json` 还不存在 —— 说明它一次都还没跑过（cron 整点，尚未轮到）。下一轮会自动建。
2. 今天 `onchain-monitor` 报 escrow 24h 净**流入** +0.077%，unstake 流出仅 0.148%，远低于 5% 研究门槛 —— 没有巨鲸在撤。

来源：DexScreener `/latest/dex/tokens/0x940A…089B`；onchain-monitor 2026-10-21T08:25Z 日志。

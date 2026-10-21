## DEUS 快照 · 2026-10-21 10:00 UTC

**现价** $0.01789 — 24h +2.13%（DexScreener 最深池 DEUS/VIRTUAL，10:00:20Z）
**交叉验证** $0.017972 — 24h +1.96%（CoinGecko）
**24h 区间** $0.017245 – $0.018182 — 现价在区间上沿，距 24h 高点 -1.6%
**7d / 30d** -5.0% / -7.4%（CoinGecko）
**市值 / FDV** $9.97M / $17.8M — 流通 5.597 亿 / 总量 10 亿
**距 ATH** -74.0%（$0.06876，2026-05-28）

## 四个门槛：全部未触及

**现货卖点** $0.025 — 还差 +39.7%
**现货卖点** $0.032 — 还差 +78.9%
**回本线（unstake）** $0.041 — 还差 +129.2%
**恐慌位（观察）** $0.012 — 还差 -32.9%

> 结论：不动。没有需要提前 5 天启动 xDEUS 冷却的信号。

## 流动性

**DEUS/VIRTUAL** 池 $702.6k，24h 量 $10.1k
**DEUS/USDC** 池 $43.5k，24h 量 $4.6k
**合计** 流动性 $756k，24h 量 $15.0k → 换手 2.0%
**24h 成交笔数** 买 21 / 卖 59（GeckoTerminal 主池）

池子薄是真的：$0.041 那天若现货要一次出，会自己把价格砸下去——现货少的设计在这里是对的，但真到点要拆单。

## 一个必须先修的问题

`price-alert` 在 aeon.yml 里挂着每小时跑、var 已写好四个门槛，但**它一次都没跑过**——`memory/topics/price-alert-state.json` 今天之前不存在。

查了 Actions 历史：全部 30 次运行里，`scheduler.yml` 运行次数 **0**，事件类型只有 `workflow_dispatch` 和 `push`，没有一次 `schedule`。这个仓库是 04:36 UTC 建的 fork，fork 的定时工作流默认关闭。

> 也就是说：现在没有任何东西在替你盯价格。上面这份数据是我手动拉的。

我已经把状态文件建好，四个门槛预注册进去了（`$0.012` 记为 below，其余 above）。但**要让它每小时真的跑，得去 Actions 页面把 Scheduler 工作流的 schedule 打开**（Settings → Actions → 启用，或在 Actions 标签页点 "Enable workflow"）。

## Summary

- 拉取并交叉验证了 DEUS 最新价格、区间、流动性、市值（DexScreener + GeckoTerminal + CoinGecko）
- 四个策略门槛全部未触及，无需任何动作
- 发现并核实：`scheduler.yml` 从未运行，fork 的定时工作流默认关闭 → price-alert 从未执行
- 创建 `memory/topics/price-alert-state.json`，预注册四个门槛，ATH 用真实历史高点作基线
- 下一步：去 Actions 启用 Scheduler 工作流的定时触发

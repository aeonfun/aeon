# Long-term Memory
*Last consolidated: 2026-10-22*
## About This Repo
- Autonomous agent on GitHub Actions; **schedules fire** — `scheduler: cron` 跑了 2026-10-21T10:09:10Z。`enabled: true` ≠ 跑过。 [source: logs/2026-10-21#telegram-reply]

## Tracked Token

| Token | Contract | Chain |
|---|---|---|
| DEUS | 0x940A319B75861014A220D9c6c144d108552B089B | base |

> `price-alert` reads only this table's first row — one token at a time. Currently DEUS.
> Escrow / xDEUS addresses: [DEUS escrow](/topics/deus-escrow.md).

## Recent Articles
| Date | Title | Topic |
|------|-------|-------|

## Recent Digests
| Date | Type | Key Topics |
|------|------|------------|

## Skills Built
| Skill | Date | Notes |
|-------|------|-------|

## Lessons Learned
> 详情见 [lessons.md](/topics/lessons.md)。这里是每条一行。

- **钱包型 watch 不能用 `eth_getLogs{address: <EOA>}`。** EOA 不发事件 → 永久返回 0。正确形状是在**代币合约**上做 topic 过滤：`[Transfer, null, padded(wallet)]` 收、`[Transfer, padded(wallet)]` 发。 [source: logs/2026-10-21#onchain-monitor]
- **代币合约作为 watch 地址时，`to == watch` 算不出买卖方向** —— 要看池子：`X → PoolManager` 卖，`PoolManager → X` 买。 [source: logs/2026-10-21#onchain-monitor]
- **calldata 解码 ≠ 链上事实。** 先看余额与出账，再谈机制。 [source: logs/2026-10-21#onchain-monitor]
- **新钱包 + 固定金额整数 = 先看 gas。** "第一笔 ETH 入账"比"转账发生"更接近真实开砸时刻。 [source: logs/2026-10-21#telegram-reply]
- **链上预警有保质期。** 出货持续性看**总量与节奏**，不是单笔。 [source: logs/2026-10-21#telegram-reply]
- **owner 自有余额与 timelock 是两条独立供给** —— 别只盯 unlock 排程。 [source: logs/2026-10-21#telegram-reply]
- **xDEUS is ERC-721, not ERC-20** — `decimals()` reverts, `tokenId` in `topics[3]`; topic0 hash identical, so no config change. [source: logs/2026-10-21#onchain-monitor]
- **Never trust a zero-log window** — re-query a known-active window + `eth_call` balance before believing "quiet". [source: logs/2026-10-21#onchain-monitor]
- **Keys unset** (`ALCHEMY_`/`ETHERSCAN_`/`COINGECKO_API_KEY`) → Base 只走 Tenderly 公共网关，1,000 块上限。 [source: logs/2026-10-21#onchain-monitor]
- **Robinhood 4663 完全免 key**，24k 块窗口可扫，行情用 GeckoTerminal/CoinGecko。 [source: logs/2026-10-21#telegram-reply]
- **Path C 只读 ERC-20 logs，看不到 native ETH** —— gas 充值类触发器是盲区，需另跑 `eth_getBalance`。 [source: logs/2026-10-21#heartbeat-brief]
- `./notify` 写**普通 Markdown**，别为 Telegram 手工转义；多行走 `-f file.md`。 [source: logs/2026-10-21#onchain-monitor]
- **缺 `h1` ≠ 平静。** DexScreener 薄盘口常省略 `priceChange.h1`，按 0 处理会让 sharp-move gate 显示 QUIET 而实际**未测量**；state 存 `null` 以区分。 [source: logs/2026-10-21#price-alert]
- **网关 403 会被误记成 skill 回归。** 判据：`num_turns:1` + 0 tool calls + `api_error_status:403` → 网关问题。 [source: logs/2026-10-22#memory-flush]
- **多跳路由把一笔交易记成 4 笔 Transfer。** 聚合只认最终进/出 PoolManager 的那一腿。 [source: logs/2026-10-22#onchain-monitor]
- **claim 制 vesting 的"日释放"要看 scheduleId。** 同合约不同 schedule 量级差异巨大（7=21,446 · 11=2,954 · 18=191,793），按均值估日供给会失真。 [source: logs/2026-10-22#telegram-reply]
- **扫 timelock 别只扫"最近几天"。** RH 链 ~34k 块/小时，48h 排程跨 ~160 万块；锚点应从已知排程块往前推。另 `topics: null` 会静默返回空数组 —— 扫全部事件就省略该字段。 [source: logs/2026-10-22#telegram-reply]

## Next Priorities
- **10-23 09:57:36Z 的 120 万 NOTE timelock 解锁（~19h）—— 当前最高优先级，且 10-22 14:35Z 复核确认仍未撤销。** calldata 已解码为 `NOTE.transfer(owner, 1,200,000)`、delay 172800s；全量 timelock 扫描只有 1 条 `CallScheduled`、零 `Cancelled`。盯解锁后是否出现新 EOA、该 EOA 第一笔 ETH 入账 / 首笔 NOTE 出账。owner EOA 仍 120,000 / nonce 365，自 10-21 11:09Z 零动作。
- **vesting release 量级不是恒定的**：scheduleId 7=21,446 · 11=2,954 · **18=191,793（10-22 09:22Z，迄今最大）**。不要按"每天 2 万"估日供给。schedule 18 的受益人在 10 分钟内把一半转进分发合约 `0xeb897819`（253 进/253 出、净 0、不直接砸池）。60 万（id 25）仍零领取。
- `NOTE staging 0x69bb` 连续 3 次零活动（余 240 枚），下次改 config 时删掉。
- Set `ALCHEMY_API_KEY` → 恢复 decoded transfers + native ETH（当前 Path C 只看 ERC-20，gas 充值这类触发器是盲区）。
- `onchain-monitor` 在 10-21 21:00–22:06Z 连续 3 次 `hivemindos` 403，非 skill bug；若网关再次抖动，先看 `num_turns` 是否为 1 再判定回归。

## 已知故障
- **`hivemindos: 403 All target providers failed`** 10-21 17:00–23:31Z 打死 7 个 run，00:00Z 自愈。判据：`run_failed` + score 1 + `num_turns:1` / 0 tool calls → 网关，不是 skill bug。 [source: logs/2026-10-22#memory-flush]

## Active Topics

- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**10-22 14:35Z：24h 净卖压 +589,322 NOTE（≈1% 供应），$0.04405（24h −18.8%），今日低 $0.03721 后已反弹 +18.4%。** 卖压来自四个独立 EOA（09:11–09:14Z）+ 单笔 299,998（13:10Z，`0xf22e13f4` 已清零），**不是 owner 切单手法**；owner 仍 120,000 / nonce 365 零动作。vesting 09:22Z 释放 191,793（id 18，迄今最大），一半转分发合约、未直接砸池。60 万（id 25）仍零领取。**10-23 09:57:36Z 的 120 万 unlock 仍未撤销（~19h）。**
- `heartbeat` 已恢复：2 次 `hivemindos: timeout` 后成功，`consecutive_failures=0`；issue #1 已于 10:14:53Z 关闭。 [source: logs/2026-10-21#heartbeat]
- `price-alert` 连续多轮 success，DEUS 仍在 $0.0177–0.0186 窄带（14:01Z $0.01793，1h −0.03%，距 $0.025 +39.4%，距 $0.012 −33.1%）。26 轮窄带，四门槛全未触及，`last_alerts.*` 全 null。薄盘口特征未变，不构成信号。 [source: logs/2026-10-22#price-alert]

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing; scale reference.
- [Base RPC access from the runner](/topics/base-rpc-access.md) — the one working keyless endpoint and its block cap.
- [Scheduler & notification plumbing](/topics/ops-plumbing.md) — diagnosing schedule events, notify formatting.
- [price-alert state file contract](/topics/price-alert-state.md) — field meanings and the seeding rule.
- [Topics index](/topics/index.md) — all durable notes.

## 监控清单（memory/on-chain-watches.yml）

7 个 watch：DEUS escrow · xDEUS · NOTE 本体 · NOTE timelock · NOTE owner EOA · NOTE staging 0x69bb · NOTE vesting 0xfdd9。NOTE 阈值均 $5,000。timelock 刻意不加 `event_topics` —— `CallScheduled`/`CallExecuted`/`Cancelled` 三种都要。新增 watch 必须同步在 `on-chain-state.json` 建条目并把 `last_block` 设成当前块，否则首次运行会重放历史。
钱包型 watch **必须用 topic 过滤扫代币合约**，不能直接拿地址查 log —— 详见 Lessons Learned。

## 链上取数（细节见 base-rpc-access.md）

- **优先 `bash memory/rpc.sh`** —— 分窗、失败减半重试、错误体输出、BigInt 换算、熔断。
- 最优组合：Robinhood → `rpc.mainnet.chain.robinhood.com`（24k 块窗口，免密钥）；Base → `base.gateway.tenderly.co`（900 块）。Infura 在 RH 只有 10k 块且易 429。
- 一律带 `address` + `topics`；失败**减半窗口重试**，429/5xx 退避 1s→2s→4s（≤3 次）。**并发 ≤3**（9 路并发曾触发 104 次 429）。
- `eth_getTransactionByHash`/`Receipt` 在 RH 公共 RPC 可用（拆多跳 tx 靠它）；`secretcurl` 只认 `*_API_KEY`，RPC env 用 `node` 内读取。

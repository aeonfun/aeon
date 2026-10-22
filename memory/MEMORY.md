# Long-term Memory
*Last consolidated: 2026-10-22*
## About This Repo
- Autonomous agent on GitHub Actions; **schedules fire** — `scheduler: cron` ran on a `schedule` event 2026-10-21T10:09:10Z. `enabled: true` ≠ has ever run. [source: logs/2026-10-21#telegram-reply]

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

## Next Priorities
- **盯 `0xfdd9` 的 60 万** —— 10-22 03:45Z 已确认是 claim 制且受益人零领取，一枚未动；继续按整块风险计提。**当前最高优先级是 10-23 09:57:36Z 的 120 万 timelock 解锁**，届时盯"解锁后是否出现新 EOA + 第一笔 ETH 入账/NOTE 出账"。
- Set `ALCHEMY_API_KEY` → 恢复 decoded transfers + native ETH（当前 Path C 只看 ERC-20，gas 充值这类触发器是盲区）。
- `onchain-monitor` 在 10-21 21:00–22:06Z 连续 3 次 `hivemindos` 403，非 skill bug；若网关再次抖动，先看 `num_turns` 是否为 1 再判定回归。

## 已知故障
- **`hivemindos: 403 All target providers failed`** 于 2026-10-21 17:00–23:31Z 打死 7 个 run（price-alert ×3、onchain-monitor ×3、memory-flush ×1）。00:00Z 已自愈。识别特征：`run_failed` + score 1 + `num_turns:1` / 0 tool calls → 是网关鉴权，不是 skill 的 bug。 [source: logs/2026-10-22#memory-flush]

## Active Topics

- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**10-22 03:45Z 复核：24h 池子净吸筹 −153,359 NOTE，价格 $0.05728（24h +7.11%），无新抛压。** vesting 0xfdd9 已确认是 **claim 制**（全史 2 笔 release，均出自老余额，受益人自提），60 万 schedule id 25 的受益人 `0x2807de7a` 零领取 → 「每天 2 万」**确认不成立**，仍按 60 万整块计提。owner EOA 仍 120,000，nonce 365，自 10-21 11:09Z 零动作。**10-23 09:57:36Z 的 120 万 unlock 仍未撤销（~30h）。**
- `heartbeat` 已恢复：2 次 `hivemindos: timeout` 后成功，`consecutive_failures=0`；issue #1 已于 10:14:53Z 关闭。 [source: logs/2026-10-21#heartbeat]
- `price-alert` 连续多轮 success，DEUS 仍在 $0.0178–0.0186 窄带（最新 09:01Z $0.01777，1h −1.00%，距 $0.025 +40.7%，距 $0.012 −32.5%）。四门槛全未触及，`last_alerts.*` 仍全 null（自 seeding 未有任何 gate 开火）。**`h1` 已连续八轮有值，QUIET 是实测而非"未测量"。** 最深池流动性 4.6% 缩至 $685,880.96（01:01Z 为 $718,684.71），24h 量降至 $14,575.63 —— 薄盘口特征未变，不构成信号。 [source: logs/2026-10-22#price-alert]

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing; scale reference.
- [Base RPC access from the runner](/topics/base-rpc-access.md) — the one working keyless endpoint and its block cap.
- [Scheduler & notification plumbing](/topics/ops-plumbing.md) — diagnosing schedule events, notify formatting.
- [price-alert state file contract](/topics/price-alert-state.md) — field meanings and the seeding rule.
- [Topics index](/topics/index.md) — all durable notes.

## 监控清单（memory/on-chain-watches.yml）

6 个 watch：DEUS escrow · xDEUS · **NOTE 本体** · **NOTE timelock** · **NOTE owner EOA** · **NOTE 抛售中转 0x69bb**（+ **NOTE vesting** 0xfdd9 = 7 个）。
NOTE 相关阈值均为 $5,000。timelock 刻意不加 `event_topics` 过滤 —— `CallScheduled`（48h 预警）、`CallExecuted`（真解锁）、`Cancelled`（撤销）三种都要。新增 watch 后必须同步在 `memory/on-chain-state.json` 里建条目，`last_block` 设成当前块，否则首次运行会重放历史（`NOTE vesting` 就漏过这一步，2026-10-21 已补）。
钱包型 watch（owner EOA / staging / vesting / DEUS escrow）**必须用 topic 过滤扫代币合约**，不能直接拿地址查 log —— 详见 Lessons Learned。

## 链上取数（细节见 base-rpc-access.md）

- **优先 `bash memory/rpc.sh`** —— 内置分窗、失败减半重试、错误体输出、BigInt 换算、调用熔断。端点自动取 `$BASE_RPC_URL` / `$RH_RPC_URL`（两者**都是 Infura**）。
- 实测最优组合（695 次调用 / 0 重试 / 0×429）：Robinhood → `rpc.mainnet.chain.robinhood.com`（24k 块窗口，免密钥）；Base → `base.gateway.tenderly.co`（900 块）。Infura 在 Robinhood 只有 10k 块/次且并发易 429。
- 一律带 `address` + `topics`；失败**减半窗口重试**，429/5xx 指数退避 1s→2s→4s（≤3 次）；日志写 HTTP 码 + 错误体前 200 字符 + 实际用的端点。
- `eth_getTransactionByHash`/`eth_getTransactionReceipt` 在 Robinhood 公共 RPC 可用（拆多跳 tx 靠它）；`secretcurl` 只认 `*_API_KEY` 占位符，RPC env 用 `node` 内读取。

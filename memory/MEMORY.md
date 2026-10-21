# Long-term Memory
*Last consolidated: 2026-10-21T15:30Z*

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
- **钱包型 watch 不能用 `eth_getLogs{address: <EOA>}`。** EOA 不发事件，该写法永久返回 0 —— owner EOA / staging / vesting / DEUS escrow 四个 watch 此前一直在假零。正确形状是在**代币合约**上做 topic 过滤：`[Transfer, null, padded(wallet)]` 收、`[Transfer, padded(wallet)]` 发。 [source: logs/2026-10-21#onchain-monitor]
- **代币合约作为 watch 地址时，`to == watch` 算不出买卖方向。** NOTE 要看池子：`X → PoolManager` 是卖，`PoolManager → X` 是买。按错误逻辑，14:57Z 那笔 88,744 NOTE 的**买入**会显示成大额流出。 [source: logs/2026-10-21#onchain-monitor]
- **calldata 解码 ≠ 链上事实。** 「30 天线性释放每天 2 万」是从 selector `0x091e7db9` 的 calldata 推的；4 小时后 0 笔出账、四个标准 selector 全 revert，证明那只是登记调用。**先看余额与出账，再谈机制。** [source: logs/2026-10-21#onchain-monitor]
- **新钱包 + 固定金额整数 = 先看 gas。** NOTE 团队抛售前会把整数枚转进全新 EOA；该 EOA 无 ETH 时无法卖出，所以"第一笔 ETH 入账"比"转账发生"更接近真实开砸时刻。盯 gas 充值，不要盯转账本身。 [source: logs/2026-10-21#telegram-reply]
- **链上预警有保质期。** 一旦团队把"一次性砸盘"改成"线性释放"（如 NOTE 10-21 的 30 天 60 万），盯转账就失效了 —— 信号还在，但边际价值塌了。判断出货持续性要看**总量与节奏**，不是单笔。 [source: logs/2026-10-21#telegram-reply]
- **owner 自有余额与 timelock 是两条独立供给。** 别只盯 unlock 排程：NOTE owner EOA 不等 10-23 解锁就自行转出了 24 万。 [source: logs/2026-10-21#telegram-reply]
- **xDEUS is ERC-721, not ERC-20** — `decimals()` reverts, `Transfer` carries `tokenId` in `topics[3]`. The ERC-20 topic0 hash still matches, so watch config needs no change. [source: logs/2026-10-21#onchain-monitor]
- **Never trust a zero-log window.** Re-query a window with known activity and check the escrow balance via `eth_call`; only then is "quiet" real. [source: logs/2026-10-21#onchain-monitor]
- **Keys are unset in this repo's runs** (`ALCHEMY_`, `ETHERSCAN_`, `COINGECKO_API_KEY`). Keyless Base reads work only via Tenderly's public gateway, capped at 1,000 blocks per `eth_getLogs`. [source: logs/2026-10-21#onchain-monitor]
- **Robinhood Chain (4663) needs no key at all.** `rpc.mainnet.chain.robinhood.com` serves `eth_getLogs` over wide ranges keylessly; GeckoTerminal (`networks/robinhood`) and CoinGecko both price the token. Don't burn turns hunting endpoints. [source: logs/2026-10-21#telegram-reply]
- **监控盲区：Path C 只读 ERC-20 logs，看不到 native ETH。** Robinhood 链无 key 时 `onchain-monitor` 走 Path C（`eth_getLogs` 过滤 `Transfer`），因此 **"staging 钱包被充 gas" 这类触发器永远不会响**。需要额外跑 `eth_getBalance` 轮询。NOTE staging 0x69bb 的触发条件正是"第一笔 ETH 入账"，当前处于盲区。 [source: logs/2026-10-21#heartbeat-brief]
- Write **plain Markdown** in `./notify`; it renders per channel and auto-chunks. Don't hand-format for Telegram. Multi-line → `-f file.md`, never `"$(cat file.md)"`. [source: logs/2026-10-21#onchain-monitor]

## Next Priorities
- **盯 `0xfdd9` 的第一笔 NOTE 出账** —— 那是"线性释放真的开始"的唯一证据。在那之前按 60 万整块计提风险。次轮 10-23 09:57:36Z 的 120 万 unlock 未撤销（42.5h 后）。最高优先级。
- 把 wallet 型 watch 的 topic 过滤逻辑固化进 `skills/onchain-monitor/SKILL.md` —— 该 skill 目前仍写 `eth_getLogs{address:<wallet>}`，等于每次都会踩假零。这是个真 bug，不是配置问题。
- Set `ALCHEMY_API_KEY` to restore decoded transfers + native ETH.

## 已知故障
- 暂无。2026-10-21 的"定时调度从未运行"已于 10:09Z 由真实 `schedule` 事件证伪；`hivemindos: timeout` 两次后已恢复。[ops-plumbing](/topics/ops-plumbing.md)

## Active Topics

- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**10-21 第二轮砸盘已执行**：11:08:31–38Z 九笔 ×26,640 砸完 24 万，staging 0x69bb 现仅剩 240 枚（已退役）。11:09Z owner 把 60 万转进自有合约 0xfdd9，**但 15:26Z 复核：4h18m 零出账，`released()/start()/duration()` 全 revert → 「每天 2 万线性释放」未在链上成立**，60 万仍整块悬着。owner EOA 现仅 120,000。10-23 09:57Z 的 120 万 unlock **未撤销**（42.5h 后）。
- `heartbeat` 已恢复：2 次 `hivemindos: timeout` 之后成功，`consecutive_failures=0`；issue #1 已于 10:14:53Z 关闭，现在 0 open issue / 0 open PR。[source: logs/2026-10-21#heartbeat]
- `price-alert` 已于 10:11 UTC 完成首次真实运行（success，`PRICE_ALERT_OK`，四门槛全未触及）。2026-10-23 UTC 的 hourly 轮次需继续观察是否稳定。[source: logs/2026-10-21#price-alert]

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

## 链上取数（RPC 优先级）

- 环境变量 `$BASE_RPC_URL`（Base）和 `$RH_RPC_URL`（Robinhood 4663）已配好，但**都是 Infura**。
- **Infura 的 `eth_getLogs` 上限：Robinhood 10,000 块/次**（公共 RPC 可到 30,000）；并发稍高就 429。2026-10-21 首次尝试按 25k 窗口扫 Robinhood，缩窗重试耗掉约 10 分钟。
- 实际最优组合（已验证 695 次调用 / 0 重试 / 0 个 429）：
  - **Robinhood → `rpc.mainnet.chain.robinhood.com`**，24,000 块窗口，无需 key
  - **Base → `base.gateway.tenderly.co`**，900 块窗口
- 若某个 env 为空 → 日志里明确写出「RPC env 缺失」，不要静默退回。
- Infura 的 `eth_getLogs` 上限约 10,000 条日志/次，超了按窗口切分。
- 每次取数成功后，日志里写明**实际用了哪个端点**。

## Infura RPC 用法（重要）

- `eth_getLogs` 单次约 10,000 条日志上限，区块范围也有限。
  收到 `more than 10000 results` / `block range too large` 时**把窗口减半重试**，
  不要用同样范围重试。
- 一律带 `address` + `topics` 过滤，不要空过滤扫全网。
- 窗口保守：Robinhood ≤30,000 块；Base ≤2,000 块。成功后记下可用大小复用。
- 429 / 5xx 指数退避重试（1s → 2s → 4s，最多 3 次），别并发猛打。
- **失败时日志里写明 HTTP 状态码 + 错误体前 200 字符**。
- 端点优先级：`$BASE_RPC_URL` / `$RH_RPC_URL` → 失败再退回公共 RPC。
- `eth_getTransactionByHash`/`eth_getTransactionReceipt` 在 Robinhood 公共 RPC 上可用（用来拆多跳 tx 很关键）；`secretcurl` 只识别 `*_API_KEY` 形式的占位符，RPC env 走 `node` 内读取更稳。

## Infura eth_getLogs 用法

- **失败一律把窗口减半重试**，不要用同样范围重试。
- 一律带 `address` + `topics` 过滤，绝不空过滤扫全网。
- 429 / 5xx 指数退避（1s→2s→4s，最多 3 次）。
- 失败时日志里写 **HTTP 状态码 + 错误体前 200 字符**。
- 单次 run 的 RPC 调用上限 150 次，超了就记录进度、下次续扫。

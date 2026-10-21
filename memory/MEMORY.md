# Long-term Memory
*Last consolidated: 2026-10-21*

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
- **给 `onchain-monitor` 加 native ETH 余额轮询**（`eth_getBalance` on wallet-type watches），否则 NOTE staging 0x69bb 的"第一笔 ETH 入账"触发器是瞎的。最高优先级 —— 上一轮同类地址转账后 1h47m 开砸。
- Set `ALCHEMY_API_KEY` to restore decoded transfers + native ETH.

## 已知故障
- 暂无。2026-10-21 的"定时调度从未运行"已于 10:09Z 由真实 `schedule` 事件证伪；`hivemindos: timeout` 两次后已恢复。[ops-plumbing](/topics/ops-plumbing.md)

## Active Topics

- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**10-21 第二轮砸盘已执行**：11:08:31–38Z 九笔 ×26,640 砸完 24 万，staging 0x69bb 清空。**11:09Z owner 把 60 万转进自有合约 0xfdd9，30 天线性 = 每天 ~2 万**（砸盘从事件变噪音）。owner EOA 现仅 120,000。10-23 09:57Z 的 120 万 unlock **未撤销**。
- `heartbeat` 已恢复：2 次 `hivemindos: timeout` 之后成功，`consecutive_failures=0`；issue #1 已于 10:14:53Z 关闭，现在 0 open issue / 0 open PR。[source: logs/2026-10-21#heartbeat]
- `price-alert` 已于 10:11 UTC 完成首次真实运行（success，`PRICE_ALERT_OK`，四门槛全未触及）。2026-10-23 UTC 的 hourly 轮次需继续观察是否稳定。[source: logs/2026-10-21#price-alert]

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing; scale reference.
- [Base RPC access from the runner](/topics/base-rpc-access.md) — the one working keyless endpoint and its block cap.
- [Scheduler & notification plumbing](/topics/ops-plumbing.md) — diagnosing schedule events, notify formatting.
- [price-alert state file contract](/topics/price-alert-state.md) — field meanings and the seeding rule.
- [Topics index](/topics/index.md) — all durable notes.

## 监控清单（memory/on-chain-watches.yml）

6 个 watch：DEUS escrow · xDEUS · **NOTE 本体** · **NOTE timelock** · **NOTE owner EOA** · **NOTE 抛售中转 0x69bb**。
NOTE 相关阈值均为 $5,000。timelock 刻意不加 `event_topics` 过滤 —— `CallScheduled`（48h 预警）、`CallExecuted`（真解锁）、`Cancelled`（撤销）三种都要。新增 watch 后必须同步在 `memory/on-chain-state.json` 里建条目，`last_block` 设成当前块，否则首次运行会重放历史。

## 链上取数（RPC 优先级）

- 环境变量 `$BASE_RPC_URL`（Base）和 `$RH_RPC_URL`（Robinhood 4663）已配好，**优先用它们**。
- 若某个变量为空 → 说明 workflow 的 env 没挂上，日志里明确写出「RPC env 缺失」，不要静默退回。
- 上面失败再退回公共 RPC（Base: `base.gateway.tenderly.co` 限 1000 块；
  RH: `rpc.mainnet.chain.robinhood.com` 限 30000 块）。
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

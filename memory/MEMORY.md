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

- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663，已加 4 个 watch，但 ETH-gas 触发器在盲区里（见 Lessons）。10-21 10:19Z owner EOA 转 240,000 NOTE 至新钱包 `0x69bb…7c63`；10:35Z 复核 nonce 0 / ETH 0 → 尚不能卖。**触发 = 该钱包第一笔出账或第一笔 ETH 入账**。另有 120 万 timelock 可执行 10-23 09:57Z。上一轮同额 24 万在 1h47m 后被 9 笔切单砸出。
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

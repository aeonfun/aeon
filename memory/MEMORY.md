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
- **xDEUS is ERC-721, not ERC-20** — `decimals()` reverts, `Transfer` carries `tokenId` in `topics[3]`. The ERC-20 topic0 hash still matches, so watch config needs no change. [source: logs/2026-10-21#onchain-monitor]
- **Never trust a zero-log window.** Re-query a window with known activity and check the escrow balance via `eth_call`; only then is "quiet" real. [source: logs/2026-10-21#onchain-monitor]
- **Keys are unset in this repo's runs** (`ALCHEMY_`, `ETHERSCAN_`, `COINGECKO_API_KEY`). Keyless Base reads work only via Tenderly's public gateway, capped at 1,000 blocks per `eth_getLogs`. [source: logs/2026-10-21#onchain-monitor]
- Write **plain Markdown** in `./notify`; it renders per channel and auto-chunks. Don't hand-format for Telegram. Multi-line → `-f file.md`, never `"$(cat file.md)"`. [source: logs/2026-10-21#onchain-monitor]

## Next Priorities
- Set `ALCHEMY_API_KEY` to restore decoded transfers + native ETH.
- Decide whether to enable a repair skill to close GitHub issue #1.

## 已知故障
- 暂无。（2026-10-21 曾记录"定时调度从未运行"，已于 10:09 UTC 由真实 `schedule`
  事件证伪并删除 —— 见 [ops-plumbing](/topics/ops-plumbing.md)。）

## Telegram 输出格式

格式是全局的：直接写普通 Markdown，`scripts/notify_format.py` 会按渠道渲染
（Telegram → HTML）并在 ~3900 字符处自动分块。不要手工为 Telegram 排版。

- 多行内容用 `./notify -f file.md`，不要 `"$(cat file.md)"`。
- 用 `x.com/handle` 而不是 `@handle`，避免 ping 到人。
- 编辑取向仍是"一屏读完"：结论在前，数字带来源和时间口径。

（此节 2026-10-21 重写：此前记录的"不用表格 / 不用 `#` 标题"等手工排版规则
已被 `scripts/notify_format.py` 的自动归一化推翻，会产出双重转义。）

## Active Topics

- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 链 4663。**2026-10-23T09:57Z timelock 解锁 120 万 NOTE**（≈2% 供应，$65k）。owner 单 EOA；上次解锁靠新地址 10 秒内 9 笔固定切单抛售。
- `heartbeat` 已恢复：2 次 `hivemindos: timeout` 之后 06:59 UTC 成功，`consecutive_failures=0`。GitHub issue #1 仍开着，因为没有启用 repair skill 去关它。[source: logs/2026-10-21#heartbeat]
- `price-alert` 已于 10:11 UTC 完成首次真实运行（success，`PRICE_ALERT_OK`，四门槛全未触及）。2026-10-23 UTC 的 hourly 轮次需继续观察是否稳定。[source: logs/2026-10-21#price-alert]


## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing; scale reference.
- [Base RPC access from the runner](/topics/base-rpc-access.md) — the one working keyless endpoint and its block cap.
- [Scheduler & notification plumbing](/topics/ops-plumbing.md) — diagnosing schedule events, notify formatting.
- [price-alert state file contract](/topics/price-alert-state.md) — field meanings and the seeding rule.
- [Topics index](/topics/index.md) — all durable notes.

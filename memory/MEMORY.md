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
- Configure notification channels (Telegram, Discord, or Slack)
- Run a first skill (`heartbeat` is on by default), then enable a few more

## 已知故障
- **定时调度从未运行**（2026-10-21 核实）：`scheduler.yml` 在 Actions 里 0 次运行，
  仓库全部 30 次运行只有 `workflow_dispatch` / `push`，零次 `schedule`。本仓库是
  04:36 UTC 创建的 fork，fork 的定时工作流默认关闭。后果：`aeon.yml` 里所有
  schedule 都是摆设，`price-alert` 从未执行。需在 Actions 页面手动 Enable workflow。
- 复跑诊断：全文搜索 `scheduler.yml` 之外的调度入口（无）。手动触发可用
  `gh workflow run scheduler.yml`。

## Tracked Token

| Token | Contract | Chain |
|---|---|---|
| DEUS | 0x940A319B75861014A220D9c6c144d108552B089B | base |

> price-alert 只读这张表第一行 —— 一次只能盯一个币。现在盯 DEUS。

## Telegram 输出格式

目标：**手机上不折行、不嵌套、一屏读完**。Telegram 只认粗体、斜体、行内代码、
链接、单行引用这五种标记。

**硬禁止：**
1. 不要用 `#` / `##` / `###` 做标题 —— 井号会原样显示。用 `**加粗行**` 代替。
2. 不要把整条消息包在 `>` 里 —— 只在**结论/警告那一行**用 `>`。
3. 不要用 markdown 表格（`| a | b |`）—— 用 `·` 分隔的竖排列表。
4. 不要用 `>` 嵌套 `>`。
5. 段间只空一行，不要空两行。

**宽度：** 每行 ≤ 34 个全角字符（中文算 1 个）。超了就断在 `·` 或 `—` 处，
不要把一个短句劈成两行。

**结构（照这个骨架）：**
Telegram 的 Markdown **不支持表格**，且**中文是双宽字符**（一个字占两格），
按列对齐很容易歪。按这个优先级选：

1. **首选（≤5 行）**：竖排列表，标签加粗，数字放破折号后，不要试图对齐：
   - 正例：`**现货卖点** $0.025 — 还差 +39.4%`
2. **行数多、必须按列对比时**：用三个反引号代码块。**不要用 `>` 引用块**
   （引用块是比例字体，对不齐）。表头要按中文字数补空格，使总宽度与最长数据行一致。
3. `>` 引用块只用来放结论/警告，不要用来放表格。
4. 粗体 `**这样**` 有效，可以用。
5. 每个数字后面带来源和时间口径（哪个 API、什么时候拉的）。
6. 结尾一行给出可直接复制的下一步命令。

## Active Topics

- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 链 4663。**2026-10-23T09:57Z timelock 解锁 120 万 NOTE**（≈2% 供应，$65k）。owner 单 EOA；上次解锁靠新地址 10 秒内 9 笔固定切单抛售。
- Enable scheduled dispatch for `heartbeat` — 2 timeouts on 2026-10-21, since recovered (1 success, consecutive_failures=0). Watch GitHub issue #1; no repair skill is enabled to close it. [source: logs/2026-10-21#heartbeat]
- Confirm `price-alert` completes an hourly run now that its state file exists; it has still never run. [source: logs/2026-10-21#telegram-reply]
- Set `ALCHEMY_API_KEY` to restore decoded transfers + native ETH (currently ERC-20/721 logs only).

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing; scale reference.
- [Base RPC access from the runner](/topics/base-rpc-access.md) — the one working keyless endpoint and its block cap.
- [Scheduler & notification plumbing](/topics/ops-plumbing.md) — diagnosing schedule events, notify formatting.
- [price-alert state file contract](/topics/price-alert-state.md) — field meanings and the seeding rule.
- [Topics index](/topics/index.md) — all durable notes.

# Long-term Memory
*Last consolidated: never*

## About This Repo
- Autonomous agent running on GitHub Actions via a coding-agent harness (Claude Code by default)

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
- (none yet - durable lessons from runs get promoted here by `memory-flush` / `reflect`)

## Next Priorities
- Configure notification channels (Telegram, Discord, or Slack)
- Run a first skill (`heartbeat` is on by default), then enable a few more

## Tracked Token

| Token | Contract | Chain |
|---|---|---|
| DEUS | 0x940A319B75861014A220D9c6c144d108552B089B | base |

> price-alert 只读这张表第一行 —— 一次只能盯一个币。现在盯 DEUS。

## Telegram 输出格式

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

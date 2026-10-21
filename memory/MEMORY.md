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

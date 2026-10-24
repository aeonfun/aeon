记忆整理完成。本轮窗口 2026-10-22 → 2026-10-24（水位线取自 `memory/memory-flush-state.json`，无 >14 天缺口，未 clamp），读了 10-22（794 行）和 10-23（668 行）两份日志。日志轮转 0 个月归档，目录剩 3 个日文件。

## 合并的近重复（同主题就地改，未新增平行条目）

| 原状 | 处理 |
|---|---|
| 「上膛4 已扣扳机清仓」独立成条 | 并入「待命 480,000 NOTE」——同一主题是上膛钱包的扳机规则 |
| 「解锁账目精确闭合」独立成条 | 并入「不要按日供给计 schedule 26」——同一主题是 120 万解锁的执行与去向 |
| 「判新钱 vs 回补（多 horizon）」+「买单真伪只看余额留存」 | 合为一条，两个判据都保留 |
| 「RH 4663 的 429 返回空结果」+「Never trust a zero-log window」 | 429 并入「假零三件套」，RH 块上限改指向 base-rpc-access |
| 「Slipstream topic0」+「7702 账户识别」 | 合并为一条取数判据 |

## 提升进长期记忆的新事实

- **假零三件套**升为一条铁律：RH 公共 RPC 的 429 返回的是**空数组**（`Promise.all` 的 `.catch()` 静默吞掉，被读成「无活动」）；`mainnet.base.org` 会把五个合法 `balanceOf` 整批 revert 后几分钟自愈（revert ≠ 余额 0）；`eth_getLogs` 的 topic0 只给 4 字节会返回干净的 0 笔，必须满 64 hex。三条都是同一个判据的不同马甲。
- **DEUS 是净增发不是通缩**：7 天 37 mint / 201,697.86 对 18 burn / 136,317.22 = 净 +65,380.63，铸币合约 `0x2cca08ae69e0c44b18a57ab2a87644234daebae4`。此前「缓慢通缩」的结论作废——单次 `totalSupply` 未变只是两次观察之间没落到 mint 上。这条对 $0.041 回本线是持续稀释。
- **新钱 cohort 一加一持**：`0x3fd51604` 19:24Z 加仓 $45.77（nonce 290→291，5,225 → 7,735 DEUS），是 cohort 里第一个回头的；`0x1184de98` 持 46,195 未卖。

## 三个 topic 文件（均 bump 了 timestamp）

- `topics/lessons.md` — 新增 4 条取数坑（429 假空、整批 revert、topic0 满 64 hex、扫描脚本必须边扫边落盘，长枚举会被 10 分钟杀掉且零输出）
- `topics/deus-buyers.md` — `0x3fd51604` 的加仓记录与 cohort 形状
- `topics/deus-escrow.md` — 新增《Supply is net inflationary》整节，含 mint 实证与对策略的含义

## 修剪

`gh pr list --state open --search "improve:"` 返回 `[]`，无 Open Improvement PRs 段可删。Next Priorities 无已完成项残留，Lessons 无过期条目，无章节超过 10–15 行阈值，未触发归档。

未推送 `./notify`：本轮是记忆整理，无新市场信号，无对外可执行结论。

## Summary

- **做了什么**：按 `skills/memory-flush/SKILL.md` 执行完整 flush —— 扫描 10-22/10-23 两份日志，5 组近重复就地合并，3 条新事实提升（含 2 条对既有结论的更正），3 个 topic 文件更新，0 项修剪。
- **文件**：改 `memory/MEMORY.md`、`memory/topics/lessons.md`、`memory/topics/deus-buyers.md`、`memory/topics/deus-escrow.md`；新建 `memory/logs/2026-10-24.md`；`memory/memory-flush-state.json` 由 stamp 写入。
- **预算**：MEMORY.md 7967 B / 72 行 → **8111 B / 68 行**，8192 B 以内，无超 300 字符行。
- **水位线**：`memory_prep.py stamp` 已跑（最终动作），`*Last consolidated: 2026-10-24*`，state 文件同步。
- **后续**：无新增待办。下次 flush 窗口从 10-24 起。

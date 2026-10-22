No duplicate headings, no over-long lines, 7,213 B / 77 lines. Consolidation complete.

## What changed

**Budget fixed.** MEMORY.md started **1,375 bytes over** (9,567 B / 105 lines). Four bottom sections — `链上取数（RPC 优先级）`, `Infura RPC 用法（重要）`, `Infura eth_getLogs 用法`, `链上取数` — were all restating the same window-halving / backoff / address-filter rules in slightly different words. Collapsed into one 4-bullet section pointing at `base-rpc-access.md`. Also archived long-form lesson detail to `memory/topics/lessons.md`. **Ended at 7,213 B / 77 lines, within budget.**

**Two new lessons promoted, both sourced:**
- Missing `priceChange.h1` ≠ a quiet book. The skill treats absent h1 as 0, so the sharp-move gate reports QUIET when it's actually *unmeasured*. Storing `null` in the state file is what keeps "measured flat" separable from "didn't measure."
- Gateway 403 masquerades as a skill regression. `hivemindos: 403 All target providers failed` killed 7 runs 17:00–23:31Z and the health loop filed each as `run_failed` score 1. I pulled three of those run logs to confirm — all `num_turns:1`, zero tool calls, `api_error_status:403`. Gateway auth, not skill bugs. It self-cleared by 00:00Z.

**Three real defects fixed, not just tidying:**
- `topics/deus-escrow.md` was **two documents spliced into one file** — a second frontmatter block, a second H1, a duplicate Citations section mid-file, and a stray `- onchain` fragment at the splice point. Merged into one coherent document.
- `topics/note-systems.md` **contradicted itself**: its risk section asserted the `0xfdd9` 30-day linear release as fact while §4 of the same file documents that all four standard selectors revert and nothing has been released. Rewrote the risk line to carry the block-risk reading.
- `## 已知故障` said "暂无" — stale and misleading, implying all runs clean. Now records the 403 outage with its diagnostic signature.

**Pruned** a Next Priorities item that was already done: the wallet-topic-filter bug is fixed in `skills/onchain-monitor/SKILL.md` (verified at lines 166–176), so it came off the list. Corrected the stale "0 open issues" claim — there are now 3 machine-managed health threads (#3, #4, #5), none urgent. `gh pr list` confirms 0 open PRs.

## Summary

- **Scan window:** 2026-10-21 → 2026-10-22, both in-window logs read (415 lines total); no rotation needed.
- **Modified:** `memory/MEMORY.md` (budget 9,567 → 7,213 B), `memory/topics/deus-escrow.md` (splice repair), `memory/topics/tokens/note-systems.md` (contradiction resolved), `memory/topics/index.md` (index repaired — the `## Tokens` heading was buried inside `# Reference`, and one Oct-21 edit had mis-nested three entries).
- **Created:** `memory/topics/lessons.md` (long-form lesson archive).
- **Logged:** `memory/logs/2026-10-22.md` under `### memory-flush`; watermark stamped to 2026-10-22 via `memory_prep.py stamp`.
- **Follow-up:** set `ALCHEMY_API_KEY` to close the native-ETH blind spot on Path C — that's the one open gap that silently disables an operator trigger. Also worth deciding whether the health loop should down-rank `run_failed` events with `num_turns:1`, since it currently counts gateway outages as skill regressions.

Nothing was notified — this was routine memory hygiene with no operator action required.

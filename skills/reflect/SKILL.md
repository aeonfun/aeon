---
name: Reflect
category: productivity
description: Review recent activity, consolidate memory, and prune stale entries
var: ""
tags: [meta]
---
> **${var}** — Area to focus on. If empty, reviews everything.

If `${var}` is set, focus the reflection on that specific area.


Today is ${today}. Your task is to review the agent's recent activity and maintain long-term memory.

Steps:
1. Read memory/MEMORY.md to understand current memory state.
2. **Time-weighted log compaction (hardening §10).** Run
   `python3 scripts/compact_logs.py memory/logs --today ${today}` to get an age-banded
   plan. Fidelity falls off with age, so the context you load each run stays bounded
   no matter how old the agent gets:
   - **keep** band (≤7d) — read these verbatim for the consolidation below.
   - **summarize** band (8–30d) — fold each into a single paragraph in the relevant
     `memory/topics/` file, then they can go.
   - **drop** band (>30d) — already captured in topics; after summarizing, run the same
     command with `--apply` to delete the drop band.
3. Read the recent articles in articles/ (last 7 days if available).
4. Consolidate what you've learned:
   - What topics have been covered recently? Note any patterns or gaps.
   - What features were built? Record key decisions and outcomes.
   - Are there any stale entries in MEMORY.md that are no longer relevant? Remove them.
   - Are there recurring errors or issues worth noting for future runs?
   - Check `memory/skill-health/*.json` for quality trends — note any skills with declining scores or persistent flags. Summarize overall skill health in the appropriate topic file.
5. **Distill, don't just append (the `/dream` discipline, hardening §10).** When you fold
   notes into memory, do three things, not one:
   - **Compress** — collapse repetition into the smallest true statement.
   - **De-contradict** — when two notes disagree, resolve it: the newer/corroborated one
     wins, and note that it changed. Never leave both standing.
   - **Verify before promoting** — only turn a vague observation into a stated fact if
     it's corroborated (a source, a number that reconciles, a second run). If it can't be
     verified, keep it tagged as a hypothesis, not a fact.
6. Reorganize memory:
   - Keep MEMORY.md as a short index (~50 lines): goals, active topics, and pointers to topic files.
   - Move detailed notes into `memory/topics/` files (e.g. `crypto.md`, `research.md`, `projects.md`).
   - If a topic file already exists, update it rather than creating a new one.
   - Never add a second `## Heading` with a name that already exists in MEMORY.md — update the existing section in place. Duplicate H2 headings are a known drift mode that memory-dedupe otherwise has to repair later.
7. Log what you did to memory/logs/${today}.md.
8. Send a notification via `./notify`: "Memory consolidated — ${today}"

Be ruthless about pruning. Memory should be a living, useful document — not an append-only log.

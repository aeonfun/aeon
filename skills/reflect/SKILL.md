---
name: Reflect
description: Review recent activity, consolidate memory, and prune stale entries
var: ""
tags: [meta]
---
> **${var}** — Area to focus on. If empty, reviews everything.

If `${var}` is set, focus the reflection on that specific area.


Today is ${today}. Your task is to review the agent's recent activity and maintain long-term memory.

Steps:
1. Read memory/MEMORY.md to understand current memory state.
2. Read the recent run logs in memory/logs/ (last 7 days if available).
3. Read the recent articles in articles/ (last 7 days if available).
4. Consolidate what you've learned:
   - What topics have been covered recently? Note any patterns or gaps.
   - What features were built? Record key decisions and outcomes.
   - Are there any stale entries in MEMORY.md that are no longer relevant? Remove them.
   - Are there recurring errors or issues worth noting for future runs?
   - Check `memory/skill-health/*.json` for quality trends — note any skills with declining scores or persistent flags. Summarize overall skill health in the appropriate topic file.
5. Reorganize memory:
   - Keep MEMORY.md as a short index (~50 lines): goals, active topics, and pointers to topic files.
   - Move detailed notes into `memory/topics/` files (e.g. `crypto.md`, `research.md`, `projects.md`).
   - If a topic file already exists, update it rather than creating a new one.
   - Never add a second `## Heading` with a name that already exists in MEMORY.md — update the existing section in place. Duplicate H2 headings are a known drift mode that memory-dedupe otherwise has to repair later.
6. Log what you did to memory/logs/${today}.md.
7. Send a notification via `./notify`: "Memory consolidated — ${today}"

Be ruthless about pruning. Memory should be a living, useful document — not an append-only log.

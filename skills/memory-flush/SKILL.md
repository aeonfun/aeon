---
name: Memory Flush
description: Promote important recent log entries into MEMORY.md
var: ""
tags: [meta]
---
> **${var}** — Topic to focus on. If empty, flushes all recent activity.

If `${var}` is set, only flush entries related to that topic.


Read memory/MEMORY.md for current memory state.
Read the last 3 days of memory/logs/ for recent activity.

Steps:
1. **Scan recent logs for entries worth promoting to long-term memory:**
   - New lessons learned (errors encountered, workarounds found)
   - Topics covered (articles, digests) — add to the recent articles/digests tables
   - Features built or tools created
   - Important findings from monitors (on-chain, GitHub, papers)
   - Ideas captured that are still relevant
   - Goals completed or progress milestones

2. **Check each candidate against existing MEMORY.md content** — skip if already recorded.

3. **Remove stale entries** — this is as important as adding new ones:
   a. **Open Improvement PRs section**: Run `gh pr list --state open --search "improve:" --json number,title,url` and compare against any "Open Improvement PRs" section in MEMORY.md.
      - If all listed PRs are now merged/closed, remove the section entirely.
      - If some PRs are merged, update the list to reflect only current open ones.
   b. **Next Priorities section**: Cross-check each listed priority against recent logs and current repo state. Remove priorities that are already done (e.g., "Merge open PRs" if 0 open PRs exist). Add any newly urgent priorities surfaced by recent logs.
   c. **Lessons Learned**: Remove lessons that are now outdated or resolved (e.g., a workaround for a bug that was later fixed).
   d. **Skills Built table**: If the table has grown beyond the last 10–15 entries, archive the oldest rows to `memory/topics/skills-history.md` to keep MEMORY.md under ~50 lines.

4. **Update memory:**
   - Add brief entries to MEMORY.md (keep it under ~50 lines as an index)
   - If a topic needs more detail, write to `memory/topics/<topic>.md` instead
   - Update tables (recent articles, recent digests) with new rows

5. Do NOT rewrite the whole file — make targeted additions and removals.

6. Log what you promoted or removed to `memory/logs/${today}.md`.

If nothing worth promoting or removing, log "MEMORY_FLUSH_OK" and end.

---
name: Weekly Reflect
description: Review recent activity, consolidate memory, and prune stale entries
var: ""
tags: [meta]
---
<!-- autoresearch: variation B — reflection as insight generation, not file rearrangement -->
> **${var}** — Area to focus on. If empty, reviews everything.

Today is ${today}. Memory consolidation without insight is just file-shuffling. Produce findings that change what the agent does next.

If `${var}` is set, restrict the scope of every phase to content matching that area.

## Phase 1 — Gather

Read in order (skip any source that doesn't exist — note it and move on):

1. `memory/MEMORY.md` — current index state
2. `memory/logs/` — last 14 days of daily logs (extend to 30 if 14-day window is empty)
3. `memory/topics/*.md` — every existing topic file
4. `memory/issues/INDEX.md` and any referenced open `ISS-*.md` files
5. `memory/skill-health/*.json` — per-skill quality scores and trend direction
6. `memory/cron-state.json` — per-skill success rate and consecutive_failures
7. `articles/` — last 14 days

## Phase 2 — Analyze (write a scratchpad before touching any file)

Answer each question explicitly. If a question has no data, say so — do not invent findings.

1. **What ran and produced value?** Top 3 highest-value outputs (articles published, decisions logged, issues resolved). Name the skill + date.
2. **What ran but produced noise?** Skills whose output from the last 14 days is never referenced in a later log, article, or decision. Candidates for deprecation.
3. **What broke?** Open issues in `memory/issues/` by severity. Any skill in `cron-state.json` with `consecutive_failures >= 3`.
4. **What trends?** Skill-health scores declining for 2+ consecutive runs, or rising sharply. Name the skill and direction.
5. **What's stale?** Entries in MEMORY.md older than 30 days with no reference in recent logs, articles, or topic files.
6. **What's missing?** Topics active in the last 14 days of logs but absent from MEMORY.md or `memory/topics/`.

## Phase 3 — Consolidate

Based on Phase 2 findings:

1. **Rewrite `memory/MEMORY.md`** as a ~50-line index containing:
   - Current goals (from Q1)
   - Active topics (one-line pointers to `memory/topics/<name>.md`)
   - Known issues (link to `memory/issues/INDEX.md` + severity counts)
   - Next priorities (from Q3 and Q4, replacing any placeholder list)
2. **Update `memory/topics/*.md` in-place.** Merge new findings into existing files. Create a new topic file only for genuinely new areas surfaced in Q6. Never duplicate (no `projects-v2.md`).
3. **Prune ruthlessly.** Remove stale entries identified in Q5. If an entry is ambiguous, keep it and note in the log.

Never delete anything under `memory/logs/`, `memory/issues/`, or `articles/` — those are authoritative records.

## Phase 4 — Report

Append to `memory/logs/${today}.md` under `### reflect`:

```
### reflect
- Inputs read: N log files, M open issues, K skill-health files
- Top findings: [2–3 concrete insights from Phase 2]
- Topic files touched: [list]
- Stale pruned: N entries
- Issues flagged: [IDs by severity, or "none"]
- Health watch: [skills with declining scores, or "none"]
```

Then notify via `./notify`:

```
*Reflect — ${today}*
[one-sentence overall state: healthy / degraded / improving]
Top finding: [single most important insight from Phase 2]
Action: [one concrete next step, or "none"]
```

If Phase 1 found no logs, no articles, and no changes needed in MEMORY.md, send instead:

```
*Reflect — ${today}* — no recent activity, memory unchanged.
```

## Constraints

- Never invent findings to fill a phase. If Q1 has no data, say so in both the log and notification.
- Phase 2 is extractive, not exhaustive — do not summarize every log line.
- The notification must convey what changed or what to do next, not "memory consolidated."
- Never re-add entries that were pruned in a previous reflect run (scan the last 3 `### reflect` log entries before re-adding anything).
- Never change `memory/issues/` entries — reflect reads them, repair skills close them.

## Sandbox note

All inputs are local file reads. No network required.

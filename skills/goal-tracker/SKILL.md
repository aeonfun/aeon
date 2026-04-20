---
name: Goal Tracker
description: Compare current progress against goals with quantified status, velocity, trend, and a concrete next action per goal
var: ""
tags: [meta]
---
<!-- autoresearch: variation B — quantified OKR-style status with velocity, trend vs prior run, and one concrete next action per non-DONE goal -->

> **${var}** — Specific goal title or slug to focus on. If empty, tracks all goals in MEMORY.md.

Read `memory/MEMORY.md` (for the goal list) and `memory/goal-state.json` (prior-run snapshot, if it exists).

## Inputs

**Primary goal source:** `memory/MEMORY.md` section titled `## Goals`. If absent, fall back to `## Next Priorities`. If both are missing or empty, send `./notify "Goal Tracker — NO_GOALS (add a '## Goals' section to memory/MEMORY.md)"` and exit.

**Evidence sources (use every source that responds; record each in the source-status footer):**
- `memory/logs/*.md` — last 30 days. Case-insensitive whole-word match against keywords parsed from each goal title.
- `git log --since="30 days ago" --pretty=format:"%ad|%s" --date=short` — commit subjects.
- `gh pr list --state=all --search "updated:>=$(date -d '30 days ago' +%F)" --json number,title,state,updatedAt,url` — recent PRs.
- `gh issue list --state=all --search "updated:>=$(date -d '30 days ago' +%F)" --json number,title,state,updatedAt,url` — recent issues.
- `memory/cron-state.json` — skill health; relevant when a goal depends on a skill running (e.g., "run first digest").

If `${var}` is set, filter to the matching goal after loading.

## Steps

### 1. Parse goals and prior state

For each goal entry, derive:
- `id` — slugified title (stable across runs)
- `title` — original text
- `keywords` — title minus stopwords (also include obvious aliases, e.g. "digest" ↔ "rss-digest")
- `due` / `target` — parse if present in the bullet, else null

If `memory/goal-state.json` exists, load `{goal_id: {status, activity_count_14d, last_activity_date, run_at}}` for trend comparison.

### 2. Gather evidence per goal

Across all responsive sources, compute:
- `activity_count_14d` — distinct matching entries in last 14 days
- `activity_count_30d` — same, 30-day window
- `last_activity_date` — most recent matching evidence (any source); null if none
- `days_since_last_activity` — today minus `last_activity_date`
- `completion_signal` — true if a log/commit/PR entry pairs the goal's keywords with phrases like "completed", "done", "shipped", "launched", "closed", "merged" (goal-specific PRs only)
- `blocker_signal` — true if a log entry in the last 14 days pairs keywords with "blocked", "waiting on", "stuck on"; capture the blocker phrase

Dedupe evidence by `(source, date, ref)` so a log mentioning a PR doesn't double-count.

### 3. Assign status (apply rules in order — first match wins)

| Status | Rule |
|--------|------|
| DONE | `completion_signal` is true, OR the goal is already marked complete in MEMORY.md |
| BLOCKED | `blocker_signal` is true within the last 14 days |
| ON TRACK | `activity_count_14d >= 2` AND `days_since_last_activity <= 7` |
| NEEDS ATTENTION | `activity_count_14d == 1` OR `days_since_last_activity` between 8 and 14 inclusive |
| AT RISK | `activity_count_14d == 0` AND (`days_since_last_activity > 14` OR no activity ever) |

### 4. Compute trend vs prior snapshot

- `improving` — status moved up the ladder (AT RISK → NEEDS ATTENTION → ON TRACK → DONE) OR `activity_count_14d` rose by ≥50%
- `flat` — same status AND `activity_count_14d` within ±25%
- `degrading` — status moved down OR `activity_count_14d` fell by ≥50%
- `new` — no prior record

### 5. Propose one concrete action per non-DONE goal

Pick the single highest-leverage next step for each goal. Rules:
- **AT RISK** with `days_since_last_activity > 21` → name a specific Aeon skill to enable, a concrete commit, or a file to create (e.g., "Enable `rss-digest` in aeon.yml to produce the weekly digest evidence").
- **BLOCKED** → name the blocker and one unblock step.
- **NEEDS ATTENTION** → name the smallest next deliverable.
- **ON TRACK** → omit action line entirely.

Use one action verb. ≤15 words. No vague "continue monitoring" advice. No action = skip the line, don't fill with filler.

### 6. Format the report

```
*Goal Tracker — ${today}*

Summary: N goals — X at risk, Y needs attention, Z on track, W blocked, V done (overall ↑ improving / → flat / ↓ degrading)

AT RISK (sorted by days_since_last_activity, descending)
• <goal title> — 18d idle, 0 activity/14d (was NEEDS ATTENTION ↓)
  → Action: <one-verb next step>

NEEDS ATTENTION
• <goal title> — 9d idle, 1 activity/14d (new)
  → Action: <one-verb next step>

BLOCKED
• <goal title> — waiting on <blocker> since <date>
  → Action: <unblock step>

ON TRACK
• <goal title> — 3d idle, 5 activity/14d (↑ improving)

DONE
• <goal title> — completed <date>

Sources: logs=ok, git=ok, gh_pr=ok, gh_issue=ok, cron-state=ok
```

Omit any status section that has zero goals.

### 7. Update MEMORY.md safely

- Move DONE goals to a `## Completed Goals` section with completion date. Never delete goals silently.
- Annotate BLOCKED goals inline with the blocker note, but keep them in the active list.
- Do **not** reorder, rephrase, or rewrite the user's goal text.
- Only write MEMORY.md if at least one goal's status changed since the last run. Otherwise leave the file untouched.

### 8. Persist state

Write `memory/goal-state.json` (create if missing):
```json
{
  "run_at": "YYYY-MM-DDTHH:MM:SSZ",
  "goals": {
    "<goal-id>": {
      "status": "AT_RISK",
      "activity_count_14d": 0,
      "last_activity_date": "YYYY-MM-DD"
    }
  }
}
```

### 9. Notify and log

Send the full formatted report via `./notify`.

Append to `memory/logs/${today}.md`:
```
### goal-tracker
- Tracked: N goals (scope: ${var or "all"})
- Status: X at risk, Y needs attention, Z on track, W blocked, V done
- Trend: <notable shifts vs prior run, or "no prior snapshot">
- Actions proposed: <count>
- Sources: logs=ok, git=ok, gh_pr=ok, gh_issue=ok, cron-state=ok
```

## Sandbox note

This skill uses `gh` CLI and local file reads — both work inside the GitHub Actions sandbox. If `gh pr list` or `gh issue list` fails, record `gh_pr=fail` / `gh_issue=fail` in the source-status footer and proceed with logs + git evidence only. Do not abort the run on a single-source failure — the whole point of multiple sources is graceful degradation.

## Constraints

- Never mark a goal DONE without a concrete completion signal. Prefer false negatives (leaving a finished goal as ON TRACK) over false positives (declaring a goal done prematurely).
- Do not invent, add, reorder, or rephrase goals in MEMORY.md. This skill reads and annotates — it never authors.
- Do not change the skill's tags or var semantics.
- If MEMORY.md has zero goals, exit with NO_GOALS and tell the user exactly which section to add.

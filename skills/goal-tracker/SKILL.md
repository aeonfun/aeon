---
name: Goal Tracker
description: Compare current progress against goals with quantified status, velocity, trend, and a concrete next action per goal
var: ""
tags: [meta]
---
<!-- autoresearch: variation B — quantified OKR-style status with velocity, trend vs prior run, and one concrete next action per non-DONE goal -->

> **${var}** — Specific goal title or slug to focus on. If empty, tracks all goals in MEMORY.md.

Read `memory/MEMORY.md` (for the goal list) and `memory/goal-state.json` (prior-run snapshot, if it exists).

## Context (auto-synced)

Read these files to ground goal status in real data:
- `context/trading/revenant-snapshot.json` — Revenant trade count vs 100-trade Apex gate target
- `context/trading/agents-summary.json` — lifecycle stage counts (Birth/Canary/Apex/Revenant)
- `context/trading/costs-summary.json` — cost burn rate vs budget targets
- `context/claude-sessions/swarm-fund-mvp/` — scan for goal-related decisions and plan changes
- `context/last-sync.json` — check freshness; if older than 8 hours, note "(stale data)" in output

Use actual numbers from trading context to assign goal status. "`calibration-gap-v1` at 42/100 trades, Sharpe 0.19, +$363 P&L" is a real status update; "making progress" is not. Trust live `metrics.json` at https://rswarm.ai/metrics.json over any number in this file or MEMORY.md when they conflict — the trading-context snapshot may be ≤8h old, and any reference to "Revenant lifecycle" should be treated as marketing-only (the code enum is SHADOW|CANARY|LIVE|DEMOTED|KILLED per `swarm-fund-mvp/python/agents/base.py:27`).

## Inputs

**Primary goal source:** `memory/MEMORY.md` section titled `## Goals`. If absent, fall back to `## Next Priorities`. If both are missing or empty, send `./notify "Goal Tracker — NO_GOALS (add a '## Goals' section to memory/MEMORY.md)"` and exit.

**Evidence sources (use every source that responds; record each in the source-status footer):**
- `memory/logs/*.md` — last 30 days. Case-insensitive whole-word match against keywords parsed from each goal title.
- `git log --since="30 days ago" --pretty=format:"%ad|%s" --date=short` — commit subjects.
- `gh pr list --state=all --search "updated:>=$(date -d '30 days ago' +%F)" --json number,title,state,updatedAt,url` — recent PRs.
- `gh issue list --state=all --search "updated:>=$(date -d '30 days ago' +%F)" --json number,title,state,updatedAt,url` — recent issues.
- `memory/cron-state.json` — skill health; relevant when a goal depends on a skill running (e.g., "run first digest").
- `context/trading/revenant-snapshot.json` — historically expected to carry the headline-agent trade count for the "100-trade Apex gate" goal. **As of 2026-05-31 this file ships with `revenant_agents: []` because the context-sync filter still looks for `lifecycle == revenant` while the live code enum at `swarm-fund-mvp/python/agents/base.py:27` is `SHADOW|CANARY|LIVE|DEMOTED|KILLED` — Revenant never lands.** Treat an empty array as "filter is stale, fall back to live source," not "no headline agent exists."

  **Fallback (use this whenever `revenant_agents` is empty or missing):**
  ```bash
  curl -s --max-time 10 https://rswarm.ai/metrics.json \
    | python3 -c '
  import json, sys
  d = json.load(sys.stdin)
  agents = d.get("agents", [])
  # Headline canonical agent
  cg = next((a for a in agents if a.get("agent_id") == "calibration-gap-v1"), None)
  # Apex gate is multi-axis: 100 trades + Sharpe > 0.5 + composite > 0.5
  if cg:
      print(json.dumps({
          "headline_agent": cg["agent_id"],
          "trades": cg.get("closed_trades", 0),
          "win_rate": cg.get("win_rate", 0),
          "pnl_usd": cg.get("total_pnl_usd", 0),
          "sharpe": cg.get("sharpe", 0),
          "composite": cg.get("composite", 0),
          "apex_gates_passed": sum([
              cg.get("closed_trades", 0) >= 100,
              cg.get("sharpe", 0) > 0.5,
              cg.get("composite", 0) > 0.5,
          ]),
          "apex_gates_total": 3,
      }))
  '
  ```

  Use the returned dict as direct evidence: `activity_count = trades`, `completion_signal = (apex_gates_passed == 3)`. The trade-count axis alone is NOT sufficient — surface `apex_gates_passed/3` in the status output so the operator sees which axes are still open. If curl fails, log `METRICS_JSON_UNAVAILABLE` and fall through to the activity-based status logic with the goal marked as "data degraded."
- `context/trading/agents-summary.json` — extract `lifecycle_counts` for goals related to agent population targets (Birth/Canary/Apex/Revenant counts).
- `context/trading/costs-summary.json` — extract weekly burn for cost-related goals.
- `context/claude-sessions/swarm-fund-mvp/` — scan session memory files for goal-related keywords (these capture decisions and plan changes from coding sessions).

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

When the live metrics.json (or `revenant-snapshot.json` if non-empty) provides direct numeric progress (e.g., `calibration-gap-v1` at 42/100 trades, Sharpe 0.192, composite below threshold), use the numbers to compute multi-axis completion and override the activity-based status. **Important:** The Apex gate requires ALL THREE axes (100 trades + Sharpe > 0.5 + composite > 0.5) — a trades-only percentage is misleading. Report each axis:
- >= 80% of target = ON TRACK (regardless of activity recency)
- 50-79% with velocity suggesting target miss = NEEDS ATTENTION
- < 50% with deadline pressure = AT RISK
- 100% = DONE (with the specific metric as completion signal)

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

When context data reveals a specific gap (e.g., cost burn exceeding target), the proposed action should reference the specific number and a concrete fix (e.g., "Cost burn $180/week vs $150 target — disable token-report to save ~$15/week").

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

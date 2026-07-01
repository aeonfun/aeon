---
name: Goal Tracker
category: productivity
description: Track progress against goals AND fire threshold alerts on milestones — quantified per-goal status (velocity, trend, one next action) plus crossing / approaching / stalled milestone detection with celebration and alerts
var: ""
tags: [meta, projects]
---
<!-- autoresearch: variation B — quantified OKR-style status with velocity, trend vs prior run, and one concrete next action per non-DONE goal; folds milestone-tracker's crossing/approaching/stalled threshold detection under the `milestones` selector -->

> **${var}** — Scope selector.
> - **empty** (default) → combined read: track every goal in MEMORY.md **and** every milestone in `memory/milestones.md`.
> - `milestones` → focus on milestone threshold crossings only (crossed / approaching / stalled).
> - `goals` → focus on goals only (skip milestone thresholds).
> - `<goal title or slug>` → focus on a single goal (goals branch, filtered).

Milestones are goals with a hard numeric threshold and a crossing alert. This skill tracks
qualitative progress against goals **and** fires threshold alerts on milestones. By default it
does both in one run; the selector narrows scope when you only want one lens.

## Preamble (every run, every branch)

1. Read `memory/MEMORY.md` for high-level context and the goal list.
2. Scan the last ~3 days of `memory/logs/` and drop anything already reported — don't re-report the same signal.
3. Parse `${var}` → selector:
   - empty → run **both** the Goals branch and the Milestones branch (see "Combined default").
   - `milestones` → run **only** the Milestones branch.
   - `goals` → run **only** the Goals branch (all goals).
   - anything else → run **only** the Goals branch, filtered to the matching goal.

---

## Goals branch

Runs when the selector is empty, `goals`, or a specific goal title/slug.

Read `memory/MEMORY.md` (for the goal list) and `memory/goal-state.json` (prior-run snapshot, if it exists).

### Inputs

**Primary goal source:** `memory/MEMORY.md` section titled `## Goals`. If absent, fall back to `## Next Priorities`. If both are missing or empty AND the selector targets goals explicitly, send `./notify "Goal Tracker — NO_GOALS (add a '## Goals' section to memory/MEMORY.md)"` and exit the goals branch. In the combined default, if there are no goals, silently skip the goals branch and still run the milestones branch.

**Evidence sources (use every source that responds; record each in the source-status footer):**
- `memory/logs/*.md` — last 30 days. Case-insensitive whole-word match against keywords parsed from each goal title.
- `git log --since="30 days ago" --pretty=format:"%ad|%s" --date=short` — commit subjects.
- `gh pr list --state=all --search "updated:>=$(date -d '30 days ago' +%F)" --json number,title,state,updatedAt,url` — recent PRs.
- `gh issue list --state=all --search "updated:>=$(date -d '30 days ago' +%F)" --json number,title,state,updatedAt,url` — recent issues.
- `memory/cron-state.json` — skill health; relevant when a goal depends on a skill running (e.g., "run first digest").

If `${var}` is a specific goal title/slug, filter to the matching goal after loading.

### G1. Parse goals and prior state

For each goal entry, derive:
- `id` — slugified title (stable across runs)
- `title` — original text
- `keywords` — title minus stopwords (also include obvious aliases, e.g. "digest" ↔ "rss-digest")
- `due` / `target` — parse if present in the bullet, else null

If `memory/goal-state.json` exists, load `{goal_id: {status, activity_count_14d, last_activity_date, run_at}}` for trend comparison.

### G2. Gather evidence per goal

Across all responsive sources, compute:
- `activity_count_14d` — distinct matching entries in last 14 days
- `activity_count_30d` — same, 30-day window
- `last_activity_date` — most recent matching evidence (any source); null if none
- `days_since_last_activity` — today minus `last_activity_date`
- `completion_signal` — true if a log/commit/PR entry pairs the goal's keywords with phrases like "completed", "done", "shipped", "launched", "closed", "merged" (goal-specific PRs only)
- `blocker_signal` — true if a log entry in the last 14 days pairs keywords with "blocked", "waiting on", "stuck on"; capture the blocker phrase

Dedupe evidence by `(source, date, ref)` so a log mentioning a PR doesn't double-count.

### G3. Assign status (apply rules in order — first match wins)

| Status | Rule |
|--------|------|
| DONE | `completion_signal` is true, OR the goal is already marked complete in MEMORY.md |
| BLOCKED | `blocker_signal` is true within the last 14 days |
| ON TRACK | `activity_count_14d >= 2` AND `days_since_last_activity <= 7` |
| NEEDS ATTENTION | `activity_count_14d == 1` OR `days_since_last_activity` between 8 and 14 inclusive |
| AT RISK | `activity_count_14d == 0` AND (`days_since_last_activity > 14` OR no activity ever) |

### G4. Compute trend vs prior snapshot

- `improving` — status moved up the ladder (AT RISK → NEEDS ATTENTION → ON TRACK → DONE) OR `activity_count_14d` rose by ≥50%
- `flat` — same status AND `activity_count_14d` within ±25%
- `degrading` — status moved down OR `activity_count_14d` fell by ≥50%
- `new` — no prior record

### G5. Propose one concrete action per non-DONE goal

Pick the single highest-leverage next step for each goal. Rules:
- **AT RISK** with `days_since_last_activity > 21` → name a specific Aeon skill to enable, a concrete commit, or a file to create (e.g., "Enable `rss-digest` in aeon.yml to produce the weekly digest evidence").
- **BLOCKED** → name the blocker and one unblock step.
- **NEEDS ATTENTION** → name the smallest next deliverable.
- **ON TRACK** → omit action line entirely.

Use one action verb. ≤15 words. No vague "continue monitoring" advice. No action = skip the line, don't fill with filler.

### G6. Format the report

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

### G7. Update MEMORY.md safely

- Move DONE goals to a `## Completed Goals` section with completion date. Never delete goals silently.
- Annotate BLOCKED goals inline with the blocker note, but keep them in the active list.
- Do **not** reorder, rephrase, or rewrite the user's goal text.
- Only write MEMORY.md if at least one goal's status changed since the last run. Otherwise leave the file untouched.

### G8. Persist state

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

### G9. Notify (goals-only scope)

When this branch runs alone (selector `goals` or a specific goal), send the full formatted report (G6) via `./notify`. In the combined default, defer sending — the goals report is emitted together with the milestone block (see "Combined default").

---

## Milestones branch

Runs when the selector is empty or `milestones`. Tracks progress toward defined numeric
milestones across repos, system capabilities, and product goals. Milestones live in
`memory/milestones.md`. Each run: fetch current state, compare to last recorded, classify
status, notify on anything notable.

One job: are we moving? Celebrate crossings, alert on approaches, surface stalls.

### M1. Load milestone config

Read `memory/milestones.md`. If it doesn't exist, create it with the seed config below and continue.

**Seed config** (write to `memory/milestones.md` if missing — replace placeholder rows with the operator's actual targets):

```markdown
# Milestones

*Last run: never*

| ID | Label | Target | Baseline | Last | Status |
|----|-------|--------|----------|------|--------|
| ms-01 | Example repo stars | stars:owner/repo:1000 | 0 | 0 | on-track |
| ms-02 | Enabled skills | skills:30 | 0 | 0 | on-track |
```

Parse the table: each row is one milestone. The `Target` field encodes the data source:
- `stars:{owner}/{repo}:{target_count}` — GitHub star count
- `skills:{target_count}` — count skills with `enabled: true` in aeon.yml
- `manual:{label}` — operator-maintained, status updated by hand

### M2. Fetch current state

For **star milestones**, use `gh api` to get current star counts:

```bash
gh api repos/${owner}/${repo} --jq '.stargazers_count'
```

If `gh api` fails on a repo (private, rate limit, etc.): fall back to the `Last` value from the config — don't fail the whole run.

For **skills milestones**, count enabled skills:

```bash
grep -c 'enabled: true' aeon.yml
```

For **manual milestones**, leave `Last` unchanged and use the operator-set status.

### M3. Classify each milestone

For each milestone, compute:
- `current` — fetched value from M2
- `delta` — `current - last` (change since last run)
- `pct` — `(current / target) * 100`
- `weeks_stalled` — if `delta == 0`, check how many consecutive weekly runs had `delta == 0` (stored in the `Status` field as `stalled-N`)

Then classify:

| Condition | Status |
|-----------|--------|
| `current >= target` AND `last < target` | **crossed** — just hit it this run |
| `current >= target` AND `last >= target` | **done** — already crossed, skip |
| `pct >= 90` | **approaching** — within 10% of target |
| `delta == 0` AND `weeks_stalled >= 2` | **stalled** — no movement in 2+ weeks |
| otherwise | **on-track** |

Skip milestones with status `done` — don't re-celebrate or re-alert.

### M4. Decide whether to notify

- **Nothing notable** (all `on-track` or `done`): log `MILESTONE_TRACKER_OK: no alerts` and skip the milestone notification.
- **Any `crossed`, `approaching`, or `stalled`**: send notification (or, in the combined default, include the milestone block in the joint send).

### M5. Format milestone notification

When this branch runs alone (selector `milestones`), write to `.pending-notify-temp/milestone-tracker-${today}.md` (create dir if needed), then:

```
./notify -f .pending-notify-temp/milestone-tracker-${today}.md
```

In the combined default, append this block to the joint notification instead (see "Combined default").

Format (if soul files are populated, match that voice; otherwise use a clear, direct, neutral tone):

```
milestone check — ${today}

{IF any crossed}
crossed:
{forEach crossed}
- {label}: {current}/{target} — done
{end}

{IF any approaching}
approaching:
{forEach approaching}
- {label}: {current}/{target} ({pct}%)
{end}

{IF any stalled}
stalled ({weeks_stalled}w no movement):
{forEach stalled}
- {label}: {current}/{target} — stuck at {pct}%
{end}

{IF any on-track with delta > 0}
moving this week:
{forEach on-track with delta > 0}
- {label}: +{delta} → {current}/{target}
{end}
```

No empty sections. If `crossed` is empty, omit it entirely. Same for the others.

### M6. Update memory/milestones.md

Rewrite the table with:
- Updated `Last` values (current state)
- Updated `Status` values (new classification)
- Updated header: `*Last run: ${today}*`

For `stalled` milestones, encode the count: `stalled-{N}` (e.g., `stalled-2` means no movement for 2 consecutive runs).

For `done` milestones (crossed and staying crossed), set status to `done:{crossed_date}` (e.g., `done:2026-05-12`).

---

## Combined default (selector empty)

Run both branches in one pass:

1. Run the **Goals branch** (G1–G8): assign status, trend, actions; update MEMORY.md and `memory/goal-state.json`. Do **not** send yet (skip G9's standalone send).
2. Run the **Milestones branch** (M1–M4, M6): fetch, classify, update `memory/milestones.md`. Determine whether any milestone is notable.
3. **Joint notification:** build one message = the Goals report (G6) followed by the milestone-check block (M5 format) **only if** at least one milestone is `crossed`, `approaching`, or `stalled`. If no milestone is notable, omit the milestone block entirely (don't send an empty "milestone check" heading). Send the combined message via `./notify` (use `-f` with a temp file for the multi-line body).
4. Honor "notify only on signal": if there are zero goals AND no notable milestone AND no goal status changed since the last run, send nothing.

---

## Log (both branches, one heading)

Append to `memory/logs/${today}.md` under a single `### goal-tracker` heading. Lead with a discriminator line naming the mode that ran, then include the goals lines and/or milestone lines for whichever branch(es) executed:

```markdown
### goal-tracker
- Mode: combined (goals + milestones) | goals | milestones
- [goals] Tracked: N goals (scope: ${var or "all"})
- [goals] Status: X at risk, Y needs attention, Z on track, W blocked, V done
- [goals] Trend: <notable shifts vs prior run, or "no prior snapshot">
- [goals] Actions proposed: <count>
- [goals] Sources: logs=ok, git=ok, gh_pr=ok, gh_issue=ok, cron-state=ok
- [milestones] Checked: {total}
- [milestones] Crossed: {list or "none"}
- [milestones] Approaching: {list or "none"}
- [milestones] Stalled: {list or "none"}
- [milestones] On-track with movement: {count}
- [milestones] Notification: sent / skipped
- [milestones] MILESTONE_TRACKER_OK
```

Include only the `[goals]` lines when the goals branch ran, only the `[milestones]` lines when the milestones branch ran, and both in the combined default. Keep `MILESTONE_TRACKER_OK` whenever the milestones branch had no alerts (the health loop reads this token).

## Sandbox note

Both branches use `gh` CLI and local file reads — both work inside the GitHub Actions sandbox.
- **Goals branch:** if `gh pr list` or `gh issue list` fails, record `gh_pr=fail` / `gh_issue=fail` in the source-status footer and proceed with logs + git evidence only. Do not abort on a single-source failure — the whole point of multiple sources is graceful degradation.
- **Milestones branch:** `gh api` for GitHub star counts — `gh` CLI handles auth internally, no env-var expansion needed. If `gh api` fails on a repo (private, rate limit), fall back to that milestone's `Last` value. `grep` on `aeon.yml` is local-only. No external network beyond the GitHub API.

## Required env vars

None — `gh` CLI uses the workflow's `GITHUB_TOKEN` automatically for both branches.

## Adding milestones

Add rows to `memory/milestones.md`. Supported target formats:
- `stars:{owner}/{repo}:{N}` — repo star count
- `skills:{N}` — enabled skills in aeon.yml
- `manual:{label}` — operator-maintained text milestone; update status by hand in the file

## Constraints

- Never mark a goal DONE without a concrete completion signal. Prefer false negatives (leaving a finished goal as ON TRACK) over false positives (declaring a goal done prematurely).
- Do not invent, add, reorder, or rephrase goals in MEMORY.md. This skill reads and annotates — it never authors.
- Skip milestones with status `done` — don't re-celebrate or re-alert a crossing.
- Do not change the skill's tags or var semantics without cause.
- If the goals-only scope is selected and MEMORY.md has zero goals, exit with NO_GOALS and tell the user exactly which section to add.

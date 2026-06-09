---
name: milestone-tracker
description: Progress tracking for key product and growth milestones — celebrates crossings, alerts on approaches, surfaces stalls
var: ""
tags: [meta, projects]
---

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Goal

Track progress toward defined milestones across repos, system capabilities, and product goals. Milestones live in `memory/milestones.md`. Each run: fetch current state, compare to last recorded, classify status, notify on anything notable.

One skill, one job: are we moving?

## Steps

### 1. Load milestone config

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

### 2. Fetch current state

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

### 3. Classify each milestone

For each milestone, compute:
- `current` — fetched value from step 2
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

### 4. Decide whether to notify

- **Nothing notable** (all `on-track` or `done`): log `MILESTONE_TRACKER_OK: no alerts` and skip notification.
- **Any `crossed`, `approaching`, or `stalled`**: send notification.

### 5. Format notification

Write to `.pending-notify-temp/milestone-tracker-${today}.md` (create dir if needed), then:

```
./notify -f .pending-notify-temp/milestone-tracker-${today}.md
```

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

### 6. Update memory/milestones.md

Rewrite the table with:
- Updated `Last` values (current state)
- Updated `Status` values (new classification)
- Updated header: `*Last run: ${today}*`

For `stalled` milestones, encode the count: `stalled-{N}` (e.g., `stalled-2` means no movement for 2 consecutive runs).

For `done` milestones (crossed and staying crossed), set status to `done:{crossed_date}` (e.g., `done:2026-05-12`).

### 7. Log to memory/logs/${today}.md

Append:

```markdown
## Milestone Tracker
- **Milestones checked:** {total}
- **Crossed:** {list or "none"}
- **Approaching:** {list or "none"}
- **Stalled:** {list or "none"}
- **On-track with movement:** {count}
- **Notification:** sent / skipped
- MILESTONE_TRACKER_OK
```

## Sandbox Note

Uses `gh api` for GitHub star counts — `gh` CLI handles auth internally, no env-var expansion needed. `grep` on `aeon.yml` is local-only. No external network beyond GitHub API.

## Required Env Vars

None — `gh` CLI uses the workflow's `GITHUB_TOKEN` automatically.

## Adding Milestones

Add rows to `memory/milestones.md`. Supported target formats:
- `stars:{owner}/{repo}:{N}` — repo star count
- `skills:{N}` — enabled skills in aeon.yml
- `manual:{label}` — operator-maintained text milestone; update status by hand in the file

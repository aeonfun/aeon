---
name: fork-first-run-alert
description: Daily — named alert the day a fork completes its first ever workflow run. Fork-cohort runs weekly; this catches the activation moment.
var: ""
tags: [meta, community]
---
> **${var}** — Optional. `dry-run` skips notify (state still updates). `owner/repo` overrides the parent repo. Empty = normal run.

Today is ${today}. A new fork completing its very first workflow run is the highest-signal community event Aeon emits — someone deployed, configured secrets, and actually ran the agent. `fork-cohort` already names this transition (`NEW_ACTIVE`) but only fires on Sundays. Mid-week activations sit in the void for up to 6 days until the next cohort run. This skill catches them the day they happen.

## Why this exists

`fork-cohort` (Sunday 19:00 UTC) bucketises every fork as COLD / STALE / ACTIVE / POWER and flags weekly transitions — but a fork that activates Monday morning waits 6 days before anyone notices. Two costs:

- **Operator** loses the chance to reach out while the new fork owner is still in setup-flow with the agent open in another tab.
- **New operator** doesn't feel seen — Aeon's "you matter to us" loop runs on a weekly cadence when activation itself is a same-day event.

This skill closes the gap with a daily cron that diffs the cohort's ACTIVE set against a persistent seen-list and emits per-fork named alerts the day each fork first runs.

## Two-sided value

| Side | What they get |
|------|---------------|
| Operator (@aaronjmars + community ops) | Same-day named ping — "Fork `speend/aeon` just ran its first skill" — with link, run count if detectable, fork stargazers |
| New fork owner | The community sees them on day one rather than waiting through a six-day silent cohort cycle |

## Inputs

Reads in this order:

| Source | Purpose | Required? |
|--------|---------|-----------|
| `memory/topics/fork-cohort-state.json` | Cached ACTIVE/POWER list — preferred fast-path, no API hits per fork | Optional |
| `memory/topics/fork-first-run-state.json` | Persistent seen-list of forks already alerted | Auto-created on first run |
| `gh api repos/{parent}/forks?per_page=100 --paginate` | Live fallback when cohort state is missing or >8 days stale | Fallback only |
| `gh api repos/{fork}/actions/runs?per_page=1` | Per new-active fork — fetch most-recent-run metadata for the alert | Per new fork |

Writes:
- `memory/topics/fork-first-run-state.json` — updated seen-list every run.
- `memory/logs/${today}.md` — one log block per run, even on `QUIET`.
- Notification via `./notify` — only when a gate fires.

No new secrets. Uses `gh api` exclusively (auth via `GITHUB_TOKEN`).

## State schema

`memory/topics/fork-first-run-state.json`:

```json
{
  "parent_repo": "aaronjmars/aeon",
  "last_run": "2026-05-17",
  "last_status": "FORK_FIRST_RUN_ALERT_OK",
  "seen": {
    "speend/aeon": {
      "first_seen_active_at": "2026-05-15",
      "first_seen_active_run_at": "2026-05-14T18:32:00Z",
      "announced_at": "2026-05-15",
      "stargazers": 0
    }
  }
}
```

Key invariants:
- `seen[fork]` is set the first run the fork shows up as ACTIVE/POWER. Once present, it is never re-announced.
- `first_seen_active_run_at` is the fork's most-recent-workflow-run timestamp at announce time — informational, not used for gating.
- LRU cap: 500 entries. When the cap is hit, drop the oldest by `announced_at` to keep the file bounded for long-running deployments.

## Steps

### 1. Parse var

- If `${var}` matches `^dry-run` → `MODE=dry-run`. Strip the prefix; remainder is treated as the parent override.
- Otherwise `MODE=execute`.
- If the remainder matches `^[a-z0-9][a-z0-9-]*/[a-zA-Z0-9._-]+$` (case-insensitive owner/repo) → `PARENT_OVERRIDE` is set.
- Otherwise the remainder must be empty; non-empty unparseable → log `FORK_FIRST_RUN_ALERT_BAD_VAR: ${var}` and exit (no notify).

### 2. Resolve parent repo

```bash
mkdir -p memory/topics
[ -f memory/topics/fork-first-run-state.json ] || echo '{"parent_repo":null,"last_run":null,"last_status":null,"seen":{}}' > memory/topics/fork-first-run-state.json

if [ -n "${PARENT_OVERRIDE}" ]; then
  PARENT_REPO="${PARENT_OVERRIDE}"
else
  PARENT_REPO=$(gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner) --jq '.parent.full_name // .full_name')
fi
```

If `PARENT_REPO` changes vs the value already stored in state, treat the seen-list as scoped to the prior parent and **reset it** for the new parent (a manual var override with a different upstream is a new tracking universe). Write a `_Reset: parent changed from {old} to {new}_` marker in the log block.

### 3. Source the active-fork list

Prefer the cached cohort state when fresh:

```bash
COHORT_STATE="memory/topics/fork-cohort-state.json"
COHORT_AGE_DAYS=99
if [ -f "${COHORT_STATE}" ]; then
  COHORT_LAST_RUN=$(jq -r '.last_run // empty' "${COHORT_STATE}")
  if [ -n "${COHORT_LAST_RUN}" ]; then
    COHORT_AGE_DAYS=$(( ( $(date -u +%s) - $(date -u -d "${COHORT_LAST_RUN}" +%s) ) / 86400 ))
  fi
fi
```

| Condition | Source for ACTIVE list |
|-----------|------------------------|
| Cohort state exists AND `COHORT_AGE_DAYS <= 8` AND its `parent_repo` matches | Read `forks` object, filter `bucket ∈ {ACTIVE, POWER}` |
| Otherwise | Live fallback (step 3a) |

Eight days is one cohort cycle plus a one-day grace — within that window the cohort's ACTIVE list is still the ground truth and is cheaper than per-fork API calls.

#### 3a. Live fallback

```bash
gh api "repos/${PARENT_REPO}/forks" --paginate \
  --jq '[.[] | select(.archived != true and .disabled != true) | {full_name, owner: .owner.login, stargazers_count, created_at, pushed_at}]' \
  > /tmp/forks.json
```

Per fork (cap at 80 — same budget guard as fork-cohort):

```bash
LAST_RUN=$(gh api "repos/${FORK_FULL_NAME}/actions/runs?per_page=1" \
  --jq '.workflow_runs[0].updated_at // empty' 2>/dev/null)
```

A fork is ACTIVE if `LAST_RUN` is non-empty AND `(now - LAST_RUN) < 7 days`. 403 → retry once after 60s; persistent → skip the fork (log `unreadable`). 404 (Actions disabled) → treat as not-active. 5xx → retry once after 10s; persistent → skip.

If the live fallback itself fails to list forks after retry → exit `FORK_FIRST_RUN_ALERT_API_FAIL` with a single failure notify.

### 4. Diff against seen-list

```
NEW_ACTIVE = ACTIVE_NOW - SEEN_FORKS
```

`SEEN_FORKS` is `keys(state.seen)`. Any fork in `ACTIVE_NOW` whose `full_name` is not a key in `seen` is a candidate alert.

Exclude bot allowlist from `NEW_ACTIVE` (same list as fork-cohort): `dependabot[bot]`, `github-actions[bot]`, `aeonframework[bot]`. Bot-owned forks still get added to `seen` so they aren't re-evaluated forever — just not alerted on.

### 5. Per new-active fork: pull alert metadata

For each fork in `NEW_ACTIVE`:

```bash
RUN_META=$(gh api "repos/${FORK_FULL_NAME}/actions/runs?per_page=1" \
  --jq '.workflow_runs[0] | {name, display_title, updated_at, html_url} // empty' 2>/dev/null)
```

Capture (best-effort, all optional):
- `workflow_name` — the workflow file name (e.g. `aeon.yml`)
- `display_title` — the workflow run title, often the skill slug or commit message
- `updated_at` — when the run finished
- `html_url` — link to the run on github.com (used as primary alert link)
- `stargazers_count` — from the fork object

If the per-fork run lookup fails after one retry, alert with the fork link only (no run-specific detail). Don't gate the alert on this lookup.

### 6. Notification policy

Three modes — driven by `count(NEW_ACTIVE_eligible)` (excludes bots):

| Count | Behaviour |
|-------|-----------|
| 0 | `FORK_FIRST_RUN_ALERT_QUIET` — log only, no notify |
| 1–3 | One named notification per fork (≤900 chars each) |
| 4+ | One batch notification listing all forks (≤900 chars total) + suppress per-fork notifications to avoid noise |

The 4+ batch threshold protects against a viral day where (say) a fork gets posted to HN and 20 deploys land in one tick.

### 7. Single-fork notification template

```
*New fork live — ${today} — {fork.full_name}*

@{fork.owner} just ran their first workflow on Aeon. Welcome to the running fleet.

Stars: {fork.stargazers}
First run: {display_title or workflow_name or "—"}
When: {humanised, e.g. "2h ago"}

Fork: https://github.com/{fork.full_name}
{Run: {html_url} when present}
```

If `display_title` is empty AND `workflow_name` is empty, omit the "First run:" line entirely rather than show `—`.

### 8. Batch notification template (4+ activators)

```
*{N} new forks live — ${today}*

The fleet picked up {N} first-time activators in the last day.

- @{owner1} — {fork1.full_name} ({stars} stars)
- @{owner2} — {fork2.full_name} ({stars} stars)
- @{owner3} — {fork3.full_name} ({stars} stars)
- @{owner4} — {fork4.full_name} ({stars} stars)
{... up to 8; "... and N more" footer if truncated}

Parent: {PARENT_REPO}
Full list will land in Sunday's fork-cohort digest.
```

Cap visible rows at 8. If `N > 8` append `... and {N - 8} more.`

### 9. Update state

For every fork in `NEW_ACTIVE` (including bot allowlist — they go in `seen` but were excluded from alerts):

```json
{
  "first_seen_active_at": "${today}",
  "first_seen_active_run_at": "${updated_at or null}",
  "announced_at": "${today if not dry-run else null}",
  "stargazers": ${stargazers_count}
}
```

Update top-level `last_run`, `last_status`, `parent_repo`.

Apply LRU cap: if `len(seen) > 500`, drop entries with the oldest `announced_at` (null `announced_at` goes last — those are unannounced dry-run entries and should not be re-alerted just because they were never notified).

Write atomically (`tmp + mv`).

### 10. Log

Append to `memory/logs/${today}.md`:

```
## fork-first-run-alert
- **Skill**: fork-first-run-alert
- **Parent**: {PARENT_REPO}
- **Source**: cohort-cache (age Nd) | live-fallback
- **Active forks scanned**: N
- **Previously seen**: N
- **New activators**: N (eligible after bot filter: N)
- **Alerts sent**: N | 0 (QUIET) | 1 (BATCH)
- **Mode**: execute | dry-run
- **Status**: FORK_FIRST_RUN_ALERT_OK | FORK_FIRST_RUN_ALERT_QUIET | FORK_FIRST_RUN_ALERT_DRY_RUN | FORK_FIRST_RUN_ALERT_NO_STATE | FORK_FIRST_RUN_ALERT_API_FAIL | FORK_FIRST_RUN_ALERT_PARENT_CHANGED | FORK_FIRST_RUN_ALERT_BAD_VAR
```

When status is `BATCH` the alert count is `1` even though it covers multiple forks — the line item makes that explicit.

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `FORK_FIRST_RUN_ALERT_OK` | At least one fork alert sent | Yes (1–N or 1 batch) |
| `FORK_FIRST_RUN_ALERT_QUIET` | No new activators today | No (log only) |
| `FORK_FIRST_RUN_ALERT_DRY_RUN` | Dry-run — would have alerted on N forks | No (log only) |
| `FORK_FIRST_RUN_ALERT_NO_STATE` | No cohort state AND live fallback gave zero forks (parent has no forks) | No (log only) |
| `FORK_FIRST_RUN_ALERT_API_FAIL` | Forks listing failed in fallback after retry | Yes (single error notify) |
| `FORK_FIRST_RUN_ALERT_PARENT_CHANGED` | Var override changed `PARENT_REPO`; seen-list was reset for the new parent | No (log only) |
| `FORK_FIRST_RUN_ALERT_BAD_VAR` | Var failed validation | No (log only) |

## Constraints

- **Never write to fork repos.** This skill is read-only across the fleet — no commenting, no welcome-issue creation. The named welcome happens in the operator's notification channel, not on the fork itself.
- **Never re-announce a fork.** Once `seen[fork.full_name]` exists, the fork is suppressed forever (until the seen-list is manually reset or the parent override changes). A fork that goes ACTIVE → STALE → ACTIVE again does NOT re-fire — that's the `REVIVED` signal owned by `fork-cohort`.
- **Bot allowlist is announce-only suppression.** Bot-owned forks still go in `seen` so they aren't perpetually re-evaluated; they're just never the subject of an alert.
- **Cohort-cache freshness window is 8 days.** Within that window we trust the cohort's ACTIVE list. Beyond 8 days the cache is treated as stale and we fall through to live API — this works on a first-ever run before fork-cohort is enabled.
- **80-fork cap on live fallback.** Same budget guard as fork-cohort. Sort by `pushed_at` desc when trimming; log `truncated_at=80` if hit. At current fleet size this is dead code.
- **4+ batch threshold prevents notification spam.** A viral day can produce 20 activators in one tick; the batch format keeps the channel signal-to-noise ratio sane.

## Sandbox note

Uses `gh api` for everything — no `curl`, no env-var-in-headers. Authenticates via `GITHUB_TOKEN` automatically. If sustained 403 rate-limits hit during the live fallback, the per-fork retry policy (60s sleep, single retry) absorbs short bursts; persistent rate-limit during cohort-cache-miss falls through to the next run with no state mutation (the seen-list is only written when the run is otherwise successful).

## Edge cases

- **First-ever run, cohort state missing, parent has zero forks** — exit `FORK_FIRST_RUN_ALERT_NO_STATE` cleanly. State file is created with empty `seen`.
- **First-ever run, cohort state present** — every fork in cohort's ACTIVE+POWER set lands in `seen` in one batch. The notification gate would fire on day one for the full active fleet, which is loud noise rather than signal — instead, on the first run, populate `seen` with `announced_at: "${today}"` for every current ACTIVE/POWER fork and emit a single `_Backfilled: N forks moved into seen-list on first run; no per-fork alerts emitted_` line in the log. Subsequent runs alert normally.
- **Parent override with different upstream** — reset seen-list, set status `FORK_FIRST_RUN_ALERT_PARENT_CHANGED`, do NOT alert on day one for the new parent (same backfill behaviour as first-ever run).
- **Fork shows up as ACTIVE in cohort, but per-fork run lookup 404s during alert metadata fetch** — alert anyway with the fork link only; mark `display_title: null` in state.
- **Same fork appears under different casings (`Owner/Repo` vs `owner/repo`)** — GitHub normalises to lowercase in API responses; canonicalise `full_name.toLowerCase()` before reading or writing `seen` to prevent double-alerts.
- **Cohort state exists but `forks` object is empty** — fall through to live fallback (treat as stale-cache).

## Why daily, not hourly

Hourly would catch activations within a tighter window but at 3 things' worth of cost: 24× the API calls per day for the same signal, 24× the notification clock check, and a per-fork retry-burst on cohort cache misses that would tax the unauth GitHub rate limit. Daily 20:30 UTC sits after the Sunday `contributor-spotlight` slot (20:00) on weekly day, and runs solo every other day — captures the activation window with one-day resolution, which matches how the existing fleet-intelligence cadence (cohort + release + spotlight) already reads.

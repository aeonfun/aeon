---
name: fork-cohort
description: Weekly fork-activation cohort tracker — buckets every fork by recent run activity (COLD / STALE / ACTIVE / POWER) with week-over-week deltas
var: ""
tags: [meta, community]
---
> **${var}** — Optional `owner/repo` to scope the parent repo. If empty, infers parent from the current repo's `parent.full_name` (or, on a non-fork, uses the current repo as parent).

Today is ${today}. Bucket every fork of the parent repo by *current activation stage* — not by code divergence (`fork-fleet` already does that), not by who's contributing (`fork-contributor-leaderboard` already does that), but by **whether the fork is actually running right now**.

This closes the visibility gap. `fork-fleet` reads pushed_at and unique commits — both hide silent abandonment, because a fork can have great code yet zero scheduled runs (workflows disabled, secrets unset, fork created and forgotten). The ground truth for "is this Aeon instance alive?" is GitHub Actions run history on the fork itself.

## Why this exists

At ~38 forks (and growing), @aaronjmars and the operator community can't support every fork — but they can support the *running* ones. "X of N forks are currently running in production" is also a more compelling social-proof claim than "N forks" when the X is real, recent, and reproducible. This skill gives both numbers.

## Cohort definitions

| Bucket | Rule |
|--------|------|
| **POWER** | At least one workflow run in the last 7 days **AND** ≥5 distinct skills set `enabled: true` in the fork's `aeon.yml` |
| **ACTIVE** | At least one workflow run in the last 7 days (and not POWER) |
| **STALE** | Last run ≥7 days ago and ≤365 days ago, **OR** last run was ≥7 days ago even if no recent run record exists |
| **COLD** | No Actions runs ever recorded **OR** last run >365 days ago |
| **UNREADABLE** | API errors prevented classification (4xx / 5xx after retry budget exhausted) |

The 7-day boundary is daily-cadence-aware — most Aeon forks have at least one daily-cron skill, so a healthy running fork should always show a run within 7 days. The 365-day fallback in COLD prevents very old never-run-since-creation forks from showing up as STALE.

## Steps

### 0. Bootstrap

```bash
mkdir -p memory/topics articles
[ -f memory/topics/fork-cohort-state.json ] || echo '{"forks":{},"last_run":null}' > memory/topics/fork-cohort-state.json
```

### 1. Resolve parent repo

```bash
if [ -n "${var}" ]; then
  PARENT_REPO="${var}"
else
  PARENT_REPO=$(gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner) --jq '.parent.full_name // .full_name')
fi
PARENT_OWNER="${PARENT_REPO%%/*}"
```

### 2. List forks (paginated, single call)

```bash
gh api "repos/${PARENT_REPO}/forks" --paginate \
  --jq '[.[] | select(.archived != true and .disabled != true) | {full_name, owner: .owner.login, default_branch, pushed_at, stargazers_count, created_at}]'
```

If the call fails after one retry (sleep 10s on 5xx, sleep 60s on 429), exit `FORK_COHORT_API_FAIL` with a single failure notify. Skip archived/disabled forks.

If the parent has zero forks: log `FORK_COHORT_NO_FORKS` and stop (no notify).

### 3. Per-fork: last workflow run

For each fork, query the most recent workflow run timestamp:

```bash
LAST_RUN=$(gh api "repos/${FORK_FULL_NAME}/actions/runs?per_page=1" \
  --jq '.workflow_runs[0].updated_at // empty' 2>/dev/null)
```

Empty / null result + 200 status → fork has never run a workflow (`COLD` candidate).

Error handling — apply once per fork, then mark `UNREADABLE` and continue:
- **404** (Actions disabled by fork owner): treat as `COLD` (workflows never ran). Many fork owners disable Actions on fork creation; this is indistinguishable from "workflows enabled but never triggered" by the API and either way means the fork is not running.
- **403** (rate-limited or scope): retry once after 60s. Persistent → `UNREADABLE`.
- **5xx**: retry once after 10s. Persistent → `UNREADABLE`.

Cap total fork-processing at 80 forks per run. If more, sort by `pushed_at` desc and trim (log `truncated_at=80`). At 38-fork scale this is dead code; the cap exists so a viral fork day doesn't blow the run budget.

### 4. Per-fork: enabled skill count (only for ACTIVE candidates)

The POWER bucket requires reading the fork's `aeon.yml`. Skip this entire step for forks that are already classified COLD or STALE — saves a call per inactive fork.

```bash
gh api "repos/${FORK_FULL_NAME}/contents/aeon.yml?ref=${FORK_DEFAULT_BRANCH}" \
  --jq '.content' 2>/dev/null | base64 -d > /tmp/fork-aeon.yml || true
```

Count distinct skills with `enabled: true` (matches both inline `{ enabled: true }` and multiline form):

```bash
ENABLED_COUNT=$(grep -E "enabled:\s*true" /tmp/fork-aeon.yml 2>/dev/null | wc -l | tr -d ' ')
```

If `aeon.yml` is missing (fork stripped it) or unreadable, treat as `ENABLED_COUNT=0` and the fork stays ACTIVE (not POWER).

### 5. Classify each fork

```
days_since_run = (now - last_run_iso8601) / 86400
                  (∞ if last_run is empty)

if 404_on_runs OR days_since_run > 365:
    bucket = COLD
elif days_since_run < 7 and ENABLED_COUNT >= 5:
    bucket = POWER
elif days_since_run < 7:
    bucket = ACTIVE
elif days_since_run >= 7:
    bucket = STALE
else:
    bucket = UNREADABLE
```

### 6. Compute week-over-week delta

Read `memory/topics/fork-cohort-state.json` (prior run). For every fork present in both runs, compute the bucket transition:

| Transition | Tag |
|------------|-----|
| (any) → POWER | `LEVELED_UP` |
| ACTIVE → STALE | `WENT_STALE` |
| STALE → ACTIVE / POWER | `REVIVED` |
| (absent) → ACTIVE / POWER | `NEW_ACTIVE` |
| ACTIVE / POWER → COLD | `WENT_COLD` |
| (absent) → any | `NEW_FORK` |
| POWER → ACTIVE | `DROPPED_FROM_POWER` |

`WENT_STALE` is the highest-priority operator-action signal — those are the "fork owners who got busy elsewhere or hit a config wall" cohort that benefits most from a check-in. `LEVELED_UP` and `REVIVED` are the bright spots worth surfacing.

### 7. Pick the verdict (one-line lede)

Priority order:
1. `LEVELED_UP: {N} forks crossed POWER threshold` — if any LEVELED_UP transitions
2. `REVIVED: {N} stale forks running again` — if any REVIVED
3. `WENT_STALE: {N} active forks went quiet` — if any WENT_STALE
4. `STEADY: {N_ACTIVE} of {N_TOTAL} running` — no transitions, fleet stable
5. `COLD START: {N_TOTAL} forks, {N_ACTIVE} running` — first ever run (no prior state)

### 8. Write the article

Path: `articles/fork-cohort-${today}.md`

```markdown
# Fork Activation Cohort — ${today}

**Verdict:** {one-line verdict from step 7}

**Parent:** {PARENT_REPO}
**Total forks:** N_TOTAL · **Running (last 7d):** N_RUNNING ({pct}%)

---

## Cohort breakdown

| Cohort | Count | Δ vs last week |
|--------|-------|----------------|
| POWER | N | +/-N |
| ACTIVE | N | +/-N |
| STALE | N | +/-N |
| COLD | N | +/-N |
| UNREADABLE | N | (drop from total if 0) |

---

## Movement this week

(Omit any subsection that's empty. If every subsection is empty, write a single line: "_No bucket changes this week._" and skip the headers.)

### Leveled up to POWER
- @{owner} — `{full_name}` (+{enabled_count} skills enabled, last run {days}d ago)

### Revived (stale → running)
- @{owner} — `{full_name}` (last run {days}d ago, was last seen YYYY-MM-DD)

### Went stale (active → quiet)
- @{owner} — `{full_name}` (last run {days}d ago, dropped from {prior_bucket})

### New forks running
- @{owner} — `{full_name}` (created YYYY-MM-DD, last run {days}d ago)

### Newly cold (was running, now silent >365d)
- @{owner} — `{full_name}` (last run YYYY-MM-DD)

---

## POWER cohort roster

(Only render if POWER count ≥ 1.)

| Fork | Owner | Enabled skills | Last run | Stars |
|------|-------|----------------|----------|-------|
| {full_name} | @{owner} | N | Nh / Nd ago | N |

---

## Source status

`forks_list=ok|fail · runs_lookup=N/M · aeon_yml_lookup=N/M · unreadable=N · truncated=true|false`
```

Cap article at ~400 lines. If POWER roster exceeds 30 entries, keep top 30 by `enabled_count` desc and add "... and N more" footer.

### 9. Update state

Write `memory/topics/fork-cohort-state.json`:

```json
{
  "last_run": "${today}",
  "last_status": "FORK_COHORT_OK",
  "parent_repo": "{PARENT_REPO}",
  "totals": {
    "total": N_TOTAL, "power": N, "active": N, "stale": N, "cold": N, "unreadable": N
  },
  "forks": {
    "owner/repo": {
      "bucket": "POWER|ACTIVE|STALE|COLD|UNREADABLE",
      "last_run": "YYYY-MM-DDTHH:MM:SSZ|null",
      "days_since_run": N,
      "enabled_count": N,
      "stargazers": N,
      "default_branch": "main"
    }
  }
}
```

### 10. Append to memory log

```
## fork-cohort
- Status: FORK_COHORT_OK | FORK_COHORT_NO_FORKS | FORK_COHORT_API_FAIL
- Verdict: {one-line verdict}
- Total: N_TOTAL · POWER N · ACTIVE N · STALE N · COLD N · UNREADABLE N
- Δ: leveled_up N · revived N · went_stale N · new_active N · went_cold N
- Article: articles/fork-cohort-${today}.md
- Source status: forks_list=ok · runs_lookup=N/M · aeon_yml_lookup=N/M · unreadable=N
```

### 11. Notify — gated

**Skip notify entirely** when:
- Status is `FORK_COHORT_NO_FORKS`, OR
- Verdict is `STEADY` AND no transitions of any kind exist AND this is NOT the first ever run (prior state present and non-empty)

Otherwise send via `./notify` (keep ≤900 chars total — Telegram/Discord/Slack render):

```
*Fork Cohort — ${today} — {PARENT_REPO}*
{verdict line}

Of {N_TOTAL} forks, {N_RUNNING} ran in the last 7 days ({pct}%). POWER {N} · ACTIVE {N} · STALE {N} · COLD {N}.

{If any LEVELED_UP:}
Leveled up to POWER:
- @{owner} — {short_name} ({enabled_count} skills enabled)

{If any REVIVED:}
Revived: @{owner1}, @{owner2}, ...

{If any WENT_STALE:}
Went stale (worth a check-in):
- @{owner} — last run Nd ago

{If any NEW_ACTIVE:}
New running forks: @{owner1}, @{owner2}, ...

Full report: articles/fork-cohort-${today}.md
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `FORK_COHORT_OK` | Run succeeded; verdict triggered notify gate | Yes |
| `FORK_COHORT_QUIET` | Run succeeded; STEADY + no transitions + prior state existed | No (log only) |
| `FORK_COHORT_NO_FORKS` | Parent repo has zero forks | No (log only) |
| `FORK_COHORT_API_FAIL` | Forks listing failed after retry | Yes (error notify, single line) |

## Constraints

- **Never write to fork repos.** This skill is read-only across the fleet — no commenting, no issue creation. The original idea suggested an optional check-in issue on STALE forks; that's deferred until reviewer feedback confirms it's wanted (write actions on third-party repos warrant explicit operator opt-in).
- **Never count `enabled: true` from comments.** The grep pattern is intentionally loose — false positives are bounded because comment lines starting with `#` are skipped by the grep on a typical aeon.yml. If a fork has weird formatting and ends up over-counted, POWER classification is the only impact and the daily-run threshold still gates it.
- **Cap fork processing at 80 per run.** At current scale (~38 forks) this is unreached; it's a budget guard for runaway viral days.
- **Bot owner allowlist:** `dependabot[bot]`, `github-actions[bot]`, `aeonframework[bot]` — skip from cohort rendering but still count in totals (so `N_TOTAL` matches the GitHub UI fork count).

## Sandbox note

Uses `gh api` for everything — no `curl`, no env-var-in-headers. Authenticates via `GITHUB_TOKEN` automatically.

If the runs lookup hits sustained 403 (rate-limited token), the per-fork retry policy (60s sleep, single retry) absorbs short bursts. Persistent rate-limit → forks marked `UNREADABLE` and `unreadable=N` shows up in source status. The skill never silently lies about coverage.

---
name: Fleet Control
description: Monitor managed Aeon instances — check health, dispatch skills, aggregate status
var: ""
tags: [dev]
cron: "0 9,15 * * *"
---
<!-- autoresearch: variation B — sharper output: verdict line + delta vs prior + per-instance action column + state-change-gated notify -->

> **${var}** — Command. Empty (or unrecognized) → Health Check (default). `status` → full Status Mode. `dispatch <instance|*> <skill> [var=<value>]` → trigger a skill on one child or all healthy/degraded children.

Today is ${today}. Operate the fleet of Aeon instances registered in `memory/instances.json`. Output is **decision-ready**: every run leads with a verdict, then a delta vs prior check, then per-instance lines that name the next concrete action.

## Pre-flight (every mode)

1. **Verify gh auth** — `gh auth status` must succeed. If not, log `FLEET_NO_AUTH` to `memory/logs/${today}.md` and notify `Fleet Control: gh auth missing — check GITHUB_TOKEN secret.` Stop.

2. **Check rate limit** — `REMAINING=$(gh api rate_limit --jq '.resources.core.remaining')`. If `REMAINING < 50`, log `FLEET_RATE_LIMITED:remaining=${REMAINING}` and notify a one-line warning, then stop.

3. **Load the registry** — read `memory/instances.json`. If the file is missing, write `{"instances": []}` to bootstrap. If `.instances` is absent or `[]`:
   - Log `FLEET_EMPTY: no managed instances` to `memory/logs/${today}.md`.
   - **Stop. Do NOT notify.**

4. **Load prior state** — read `memory/state/fleet-control-state.json` (create the directory and file with `{"instances": {}, "last_full_summary_date": ""}` if missing). Shape:
   ```json
   {
     "instances": {
       "<name>": { "health": "<status>", "last_checked": "<ISO>", "consecutive_unreachable": 0 }
     },
     "last_full_summary_date": "YYYY-MM-DD"
   }
   ```

5. **Parse var → mode**:
   - empty / unrecognized → **Health Check Mode**
   - exactly `status` → **Status Mode**
   - starts with `dispatch ` → **Dispatch Mode**

---

## Health Check Mode (default)

For each registered instance, skip rows with `archived: true` from per-instance work (count them separately). Run the three calls per instance in parallel using `&` + `wait` and write each to `/tmp/fleet/${SAFE}.{repo,runs,cron}.json`:

a. **Repo metadata**:
   ```bash
   gh api "repos/${REPO}" \
     --jq '{full_name, pushed_at, archived, default_branch, open_issues_count}' \
     > "/tmp/fleet/${SAFE}.repo.json" 2>"/tmp/fleet/${SAFE}.repo.err" &
   ```

b. **Workflow runs in last 24h** (precise window, not "last 5"):
   ```bash
   SINCE=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)
   gh api "repos/${REPO}/actions/runs?created=>${SINCE}&per_page=100&exclude_pull_requests=true" \
     --jq '{total_count, runs:[.workflow_runs[]|{name,status,conclusion,created_at,html_url}]}' \
     > "/tmp/fleet/${SAFE}.runs.json" 2>"/tmp/fleet/${SAFE}.runs.err" &
   ```

c. **Cron-state from child**:
   ```bash
   gh api "repos/${REPO}/contents/memory/cron-state.json" --jq '.content' 2>"/tmp/fleet/${SAFE}.cron.err" \
     | base64 -d > "/tmp/fleet/${SAFE}.cron.json" &
   ```

`wait` after launching all three for an instance (or batch across all instances if you trust your parallelism — keep ≤16 concurrent calls to stay under rate limit).

**Classify each instance** with precise thresholds:
- **unreachable** — repo metadata call returned non-zero (404/403/etc.)
- **archived** — repo metadata returns `archived: true`
- **pending_secrets** — `runs.total_count == 0` for the 24h window AND repo `pushed_at` ≥ 7 days old (newly-spawned instances under 7 days stay unclassified-but-tracked)
- **stale** — `runs.total_count == 0` AND `pushed_at` > 7 days old AND not `archived`
- **degraded** — ≥1 cron-state skill with `consecutive_failures ≥ 3` OR (24h failure_count / total_count) ≥ 0.5 with total_count ≥ 2
- **warning** — 24h failure_count ≥ 1 but ratio < 0.5
- **healthy** — has runs in last 24h, all conclusions `success` or `in_progress`/`queued`, no degraded cron-state skills

For each instance compute a **next_action** (one short imperative phrase):
- `pending_secrets` → `add ANTHROPIC_API_KEY at https://github.com/${REPO}/settings/secrets/actions`
- `degraded` → `investigate <skill_name> (<consecutive_failures>× in a row, last_error: <signature, ≤60 chars>)`
- `warning` → `monitor — <N>/<Total> runs failed in 24h`
- `stale` → `confirm intent: no runs in 24h, last push <relative_date>; archive or re-enable`
- `unreachable` → `verify access: <reason from repo.err>`
- `healthy` → `none`
- `archived` → `none (archived)`

**Compute delta** vs prior state (per-instance `prior.health` vs `current.health`):
- **NEW** — instance not in prior state
- **DEGRADED** — was healthy/warning, now degraded/unreachable/stale/pending_secrets
- **RECOVERED** — was degraded/unreachable/stale/pending_secrets, now healthy/warning
- **DROPPED** — was in prior state, no longer in registry
- (no change → no delta line)

**Update the registry** — write back `health`, `last_checked` (ISO UTC), and `next_action` per instance to `memory/instances.json`. Preserve all other fields (`purpose`, `parent`, `created`, `skills_enabled`, etc.).

**Update the state file** — write the current per-instance health snapshot to `memory/state/fleet-control-state.json`. Update `last_full_summary_date` to today **only when this run notifies**. Increment `consecutive_unreachable` for unreachable instances; reset to 0 otherwise.

**Log** to `memory/logs/${today}.md`:
```
## fleet-control (health check)
- Verdict: [FLEET_OK | NEEDS_ATTENTION:N]
- Sizes: total=N, healthy=N, warning=N, degraded=N, stale=N, pending=N, unreachable=N, archived=N
- Deltas: [list NEW/DEGRADED/RECOVERED/DROPPED, or "none"]
- Sources: gh=ok, rate_remaining=N
```

**Notification gate** — send the notification if **any** of:
- `len(deltas) > 0`
- today != prior `last_full_summary_date` (first check of UTC day → daily rollup)
- any current instance is `degraded` or `unreachable`

Otherwise skip notify (silent no-op when nothing changed mid-day — operator isn't trained to ignore).

**Notification body** (when sent):
```
*Fleet Control — ${today}*
Verdict: <FLEET_OK | NEEDS_ATTENTION:N>

[If deltas exist]:
What changed:
- NEW: <name> (<repo>) — <health>
- DEGRADED: <name> — was <prior>, now <current>: <reason>
- RECOVERED: <name> — was <prior>, now <current>
- DROPPED: <name> — no longer in registry

Fleet (N total):
- <name> [<HEALTH>]: <repo> — <next_action>
- ...

[If first-of-day rollup]:
Counts: healthy <H> · warning <W> · degraded <D> · stale <S> · pending <P> · unreachable <U> · archived <A>

Sources: gh=ok · rate_remaining=N
```

Cap the per-instance list at 12 lines; if more, append `...and N more — see memory/instances.json`. Always include archived in counts; never list archived rows in the per-instance section.

---

## Dispatch Mode

Parse var: `dispatch <instance|*> <skill> [var=<value>]`.

**Resolve targets**:
- If `<instance>` is `*`, target = every registry entry whose **current** health is `healthy`, `warning`, or `degraded` (skip unreachable, stale, pending, archived).
- Otherwise, exact name match against the registry. Not found → notify `Fleet Dispatch: instance '<name>' not in registry` and stop.

For each target instance:

1. **Validate skill exists in child**:
   ```bash
   gh api "repos/${REPO}/contents/skills/${SKILL}/SKILL.md" >/dev/null 2>&1 \
     || { OUTCOME="missing_skill"; continue; }
   ```

2. **Check skill is enabled in child's aeon.yml** (best-effort warning, not a block — workflow_dispatch can override `enabled: false`):
   ```bash
   gh api "repos/${REPO}/contents/aeon.yml" --jq '.content' 2>/dev/null | base64 -d \
     | grep -E "^[[:space:]]*${SKILL}:.*enabled:[[:space:]]*true" >/dev/null \
     || NOT_ENABLED_WARN=1
   ```

3. **Trigger the skill**:
   ```bash
   if [ -n "$DISPATCH_VAR" ]; then
     gh workflow run aeon.yml --repo "${REPO}" -f skill="${SKILL}" -f var="${DISPATCH_VAR}" \
       && OUTCOME="dispatched" || OUTCOME="api_failed:$?"
   else
     gh workflow run aeon.yml --repo "${REPO}" -f skill="${SKILL}" \
       && OUTCOME="dispatched" || OUTCOME="api_failed:$?"
   fi
   ```

Collect per-target outcomes: `dispatched | missing_skill | api_failed:<code>` (with optional `not_enabled_warn` flag).

**Log**:
```
## fleet-control (dispatch)
- Command: dispatch <inst|*> <skill> [var=...]
- Targets: N
- Dispatched: N | missing_skill: N | api_failed: N
- Per-target: [<name>: <outcome>, ...]
```

**Notify** (always, in dispatch mode):
```
*Fleet Dispatch*
Command: dispatch <inst|*> <skill>
Targets: <N> — Dispatched: <N>
Successful: <comma-sep names>
[If failures]:
Failed: <name>: <reason>, ...
[If not_enabled_warn]:
Warning: <name> has skill disabled in aeon.yml — dispatched anyway
```

If 0 dispatched out of N targets, the verdict line reads `Fleet Dispatch: 0/${N} — see failures below` and exit code logged is `FLEET_DISPATCH_FAILED:no_targets_succeeded`.

---

## Status Mode

Generate the comprehensive snapshot, but make it scannable.

For each registered instance (skip `archived` from detail blocks but count them in the summary), gather in parallel:
- Repo meta: `stargazers_count`, `pushed_at`, `open_issues_count`, `default_branch`
- Last 10 workflow runs:
  ```bash
  gh api "repos/${REPO}/actions/runs?per_page=10&exclude_pull_requests=true" \
    --jq '[.workflow_runs[]|{name,status,conclusion,created_at,html_url}]'
  ```
- Full `cron-state.json`
- `aeon.yml` (parse enabled skills)
- Last 5 commits (one-line `gh api repos/${REPO}/commits?per_page=5 --jq ...`)

Compute the same delta block, but compare against the most recent prior `articles/fleet-status-*.md` (parse the per-instance health rows; if none exists, mark the section "no prior status to diff against").

Write to `articles/fleet-status-${today}.md`:
```markdown
# Fleet Status — ${today}

## Verdict
<one line: FLEET_OK | NEEDS_ATTENTION:N | DEGRADED:N — top issue first>

## Top Issue
<one paragraph: the single highest-priority instance and what it needs, OR "none">

## Fleet Health
| Instance | Repo | Health | Last Active | Skills | Open Action |
|----------|------|--------|-------------|--------|-------------|

## What Changed Since Last Status
<list of NEW/DEGRADED/RECOVERED/WENT_STALE/DROPPED instances since prior fleet-status article, or "no changes">

## Per-Instance Detail

### <name> — <repo>
- Purpose: <from registry>
- Health: <status>, last checked <ISO>
- Last 10 runs:
  | Skill | Status | Conclusion | When |
  |-------|--------|-----------|------|
- Skills enabled: <comma list>
- Recent commits:
  - <sha> <message>
- Action: <next_action>

## Counts
| Metric | Value |
|--------|-------|

## Sources
gh=ok · rate_remaining=N · registry=N instances · prior_status=<filename or "none">
```

**Log**:
```
## fleet-control (status)
- Article: articles/fleet-status-${today}.md
- Verdict: <line>
- Sizes: total=N, healthy=N, ...
```

**Notify** (always, in status mode):
```
*Fleet Status — ${today}*
<verdict>
Top issue: <one line, or "none">
Counts: healthy <H> · warning <W> · degraded <D> · stale <S> · pending <P> · unreachable <U>
Article: articles/fleet-status-${today}.md
```

---

## Exit taxonomy

Every run logs exactly one of these to memory:
- `FLEET_CONTROL_OK` — health/status/dispatch completed normally
- `FLEET_EMPTY` — no instances in registry (silent stop)
- `FLEET_NO_AUTH` — gh auth missing
- `FLEET_RATE_LIMITED:remaining=N` — abandoned to preserve quota
- `FLEET_DISPATCH_OK:N/M` — dispatched N of M targets
- `FLEET_DISPATCH_FAILED:<reason>` — dispatch produced 0 dispatches

## Sandbox note

Always use `gh api` over raw curl (handles auth and the sandbox env-var-in-headers issue). All cross-repo calls go through `gh api` or `gh workflow run`. No outbound HTTP needed beyond what `gh` does internally.

## Constraints

- Never delete an instance from `memory/instances.json` automatically — only update fields. Even `unreachable` instances stay in the registry until the operator removes them by hand.
- Preserve all registry fields not explicitly written by this skill (purpose, parent, created, skills_enabled, etc.).
- Never write secrets to logs or notifications.
- Cap notification length at ~30 lines; truncate the per-instance list with `...and N more` when needed.
- Health Check stays silent when nothing changed mid-day — the daily-rollup path handles the recurring "is everything fine?" question without spam.
- Do not change the skill's tags, var semantics, or schedule without strong justification.

Write complete, working code. No TODOs or placeholders.

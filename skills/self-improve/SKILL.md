---
name: self-improve
description: Improve the agent itself — better skills, prompts, workflows, and config based on recent performance
var: ""
tags: [meta]
---
<!-- autoresearch: variation D — issue-driven repair loop. Make memory/issues/INDEX.md the canonical work queue so every run either files or closes a tracked issue, matching the health-vs-repair lifecycle in CLAUDE.md. -->

> **${var}** — Optional. Specific area to improve (e.g. "heartbeat", "notifications") or an issue ID like `ISS-007`. If empty, pick the highest-severity open issue, or detect a new failure pattern and file one.

Read `memory/MEMORY.md` and `memory/issues/INDEX.md`.

## Goal

Act as a **repair skill** in the documented lifecycle from CLAUDE.md: health skills file issues, repair skills close them. Each run either fixes one open issue (preferred) or files one new issue from observed failures. Never both.

## Steps

### 1. Inventory open work

```bash
OPEN_FIXES=$(gh pr list --state open --json title --jq '[.[] | select(.title | test("^(fix|improve|chore|feat)\\("; "i"))] | length')
echo "open improvement PRs: $OPEN_FIXES"
```

If `$OPEN_FIXES >= 4`, log "self-improve: $OPEN_FIXES open improvement PRs, waiting for review" and exit. Don't pile on. (Counts both `fix(` from prior self-improve runs and `improve(` from autoresearch.)

Reconcile resolved issues: for each issue in `memory/issues/INDEX.md` whose `fix_pr` PR is merged, move it to the **Resolved** table and set `resolved_at` in its `ISS-{NNN}.md` file. Commit this reconciliation as part of the same PR if you make a fix this run, or skip if no fix is being made.

### 2. Choose target

Branch on `${var}`:

- **`${var}` is an issue ID** (matches `^ISS-\d+$`): load `memory/issues/${var}.md`, that's your target. Skip to step 4.
- **`${var}` is a skill or area name**: file an issue for it (or update the existing one) and target it.
- **`${var}` is empty**: triage.

**Triage (when `${var}` is empty):**

1. **Prefer existing issues.** Read `memory/issues/INDEX.md`. Pick the highest-severity open issue with `status` in `{open, investigating}`. Severity rank: `critical > high > medium > low`. Tiebreak by oldest `detected_at`.
2. **If no open issues, scan for new failures:**
   - `./scripts/skill-runs --hours 48 --failures --json` — skills with consecutive failures or success rate <70%.
   - `memory/logs/` (last 2 days) — explicit `*_ERROR`, "zero output", timeouts, truncations.
   - `memory/cron-state.json` — `consecutive_failures >= 2` or `success_rate < 0.7`.
3. **If a new failure pattern is found**, file an issue (see step 3) and **stop** — don't fix in the same run. Filing alone is the deliverable; the next self-improve run will pick it up. This keeps the file/fix steps isolated and reviewable.
4. **If nothing is failing**, do a single quality-regression check: read the most recent output of one randomly-chosen enabled skill and compare against the rubric in `skills/skill-evals/SKILL.md` if present. If quality is fine, log `self-improve: no open issues, no new failures, quality sample OK` and exit.

### 3. (Filing path only) File a new issue

If you reached this step from triage step 2.3, create the issue and stop:

- Determine the next `ISS-{NNN}` ID (read `memory/issues/INDEX.md`, max + 1).
- Create `memory/issues/ISS-{NNN}.md` with frontmatter per CLAUDE.md:
  ```yaml
  ---
  id: ISS-{NNN}
  title: <short, specific — e.g. "token-movers: 3 consecutive timeouts on CoinGecko fetch">
  status: open
  severity: <critical|high|medium|low>
  category: <one of the categories listed in CLAUDE.md>
  detected_by: self-improve
  detected_at: <today ISO>
  resolved_at: null
  affected_skills: [<skill names>]
  root_cause: <leave blank or 1-line hypothesis>
  fix_pr: null
  ---
  ```
  Body: cite the evidence — log file path with line numbers, error message verbatim, success-rate before/after, or skill-runs output. No speculation beyond the `root_cause` line.
- Add a row to the **Open** table in `memory/issues/INDEX.md`.
- Commit on a branch `chore/file-iss-{NNN}` and open a PR titled `chore: file ISS-{NNN} — <title>`.
- Notify: `self-improve: filed ISS-{NNN} — <title> — PR: <url>`. Log and exit.

### 4. (Fixing path) Understand the area

Read the issue file. Then read the files it implicates:

- Skills: `skills/{name}/SKILL.md`
- Config: `aeon.yml`
- Agent instructions: `CLAUDE.md`
- Dashboard: `dashboard/` (if UI-related)

**Never modify** `.github/workflows/*`, `skills/self-improve/SKILL.md` (this file — autoresearch evolves it instead), `skills/security/`, or anything under `secrets/`. If the issue's only fix would touch one of these, set the issue status to `wontfix` with a one-line justification and exit.

Form a hypothesis tying the failure to a specific file:line. Write it as a comment in your scratch — you'll cite it in the PR.

### 5. Implement the smallest fix

Make minimal, targeted changes to address the root cause:

- Skill prompt unclear → rewrite the ambiguous section only.
- Rate-limited → add backoff or reduce frequency in `aeon.yml`.
- Output low-quality → tighten the prompt or add an explicit format example.
- Notification broken → fix formatting or truncation.
- Config wrong → patch `aeon.yml`.

Do **not**: rewrite skills from scratch, add features, change architecture, modify env vars, bundle unrelated changes, refactor neighbouring code.

### 6. Verify the fix maps to the cited evidence

Before committing, re-read your diff and answer in one paragraph (this paragraph goes in the PR body):

- **What was the failure?** Quote the log line / error / observation.
- **Why does this change fix it?** Trace from the changed line(s) to the failure mode.
- **How will we know it worked post-merge?** A concrete check — e.g. "next run of `${skill}` should log `${marker}` instead of `${error}`", or "`./scripts/skill-runs --hours 24` for `${skill}` should show success rate >0.9 within 3 runs".

If you can't answer all three, the fix isn't ready — narrow it further or change approach.

### 7. Update the issue and open the PR

Update `memory/issues/ISS-{NNN}.md`:
- `status: fixing`
- `fix_pr: <url>` (set after PR is created — patch with a follow-up commit on the same branch if needed)
- Append a `## Fix` section with the verification paragraph from step 6.

Branch and PR:
```bash
TODAY=$(date -u +%F)
BRANCH="fix/iss-{NNN}-${TODAY}"
git checkout -b "$BRANCH"
git add -A
git commit -m "fix(ISS-{NNN}): <one-line fix summary>

Issue: ISS-{NNN} — <issue title>
Root cause: <one line>
Fix: <one line>
Verification: <how we'll know it worked>"
git push -u origin "$BRANCH"
gh pr create --title "fix(ISS-{NNN}): <one-line summary>" --body "$(cat <<'EOF'
## Issue
[ISS-{NNN}](../blob/main/memory/issues/ISS-{NNN}.md) — <title>

## Root cause
<one paragraph, citing file:line>

## Fix
<diff summary in plain English>

## Verification
<the post-merge check from step 6>

## Evidence
- <log entry or skill-runs row>
- <success rate before / expected after>
EOF
)"
```

If the branch already exists locally or remotely, append `-2` (or next integer) — never force-push.

### 8. Notify and log

Notify via `./notify`:
```
self-improve: fixed ISS-{NNN} — <one-line summary> — PR: <url>
```

Append to `memory/logs/${today}.md`:
```
## Self Improve
- **Issue:** ISS-{NNN} — <title>
- **Severity:** <severity>
- **Root cause:** <one line>
- **Fix:** <one line>
- **Verification:** <post-merge check>
- **PR:** <url>
```

If you exited early (filed-only, idle, or capped), log a short reason line under `## Self Improve` and skip the PR section.

## Sandbox note

`gh` and the `./scripts/skill-runs` script work inside the sandbox. If a `gh` call fails intermittently, retry once; if still failing, fall back to reading the JSON the script emits and skip the PR-count check (log the skip).

## Constraints

- **One artifact per run.** Either file one issue OR fix one issue OR exit. Never bundle.
- **Smallest viable fix.** A one-line prompt tweak beats a full rewrite. If you find yourself diffing >50 lines, stop and reconsider.
- **Never modify**: `.github/workflows/*`, `skills/self-improve/SKILL.md`, `skills/security/`, secrets, or env vars.
- **Cite evidence.** Every fix must point to a specific log line, error, or success-rate number. No "this seemed off" PRs.
- **Honor the lifecycle.** Issues move `open → investigating → fixing → resolved` (or `wontfix`). This skill drives `open → fixing → resolved` (resolution happens on merge in the next run via reconciliation in step 1).

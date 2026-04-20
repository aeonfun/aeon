---
name: fork-fleet
description: Inventory active Aeon forks, detect diverged work, surface upstream contribution candidates
var: ""
tags: [dev]
cron: "0 10 * * 1"
---
<!-- autoresearch: variation B — sharper output: verdict + PROMOTE/REVIEW/NOTE tiers + week-over-week delta + notify gate -->
> **${var}** — Optional `owner/repo` to analyze a single fork. If empty, scans all active forks.

Today is ${today}. Track Aeon's fork fleet: discover active forks, surface the fork work that actually matters, and gate notifications on real change.

## Operating principles
- **Verdict first, catalog second.** Operator reads one line and knows if action is needed.
- **Silent when nothing changed.** Weekly cadence + dormant fleet = a read-once habit to kill.
- **Per-fork compare is one call, not three.** `/compare/{owner}:main...{fork_owner}:main` returns ahead/behind/unique commits/files in a single round-trip.
- **Substance ≠ noise.** A new `skills/*/SKILL.md` is worth 100 cron-time edits in `aeon.yml`. Score accordingly.

## Steps

### 0. Bootstrap + load state

```bash
mkdir -p memory/topics
[ -f memory/instances.json ] || echo '{}' > memory/instances.json
[ -f memory/topics/fork-fleet-state.json ] || echo '{"forks":{},"last_run":null}' > memory/topics/fork-fleet-state.json
```

Read `memory/instances.json` → set of repo `full_name`s that are managed instances (tagged separately from organic community forks in the report).
Read `memory/topics/fork-fleet-state.json` → prior run's per-fork `{pushed_at, ahead_by, default_branch, new_skill_count}` keyed by `full_name`. Used for the what-changed delta.

### 1. Resolve parent + list forks

```bash
PARENT_REPO=$(gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner) --jq '.parent.full_name // .full_name')
PARENT_NAME="${PARENT_REPO##*/}"
PARENT_OWNER="${PARENT_REPO%%/*}"
```

Single paginated listing — includes `default_branch`, `archived`, `disabled`, `pushed_at`:

```bash
gh api "repos/${PARENT_REPO}/forks" --paginate \
  --jq '[.[] | {full_name, owner: .owner.login, default_branch, pushed_at, pushed_at_epoch: (.pushed_at | fromdateiso8601), stargazers_count, open_issues_count, archived, disabled, description}]'
```

Skip `archived=true` or `disabled=true`. Retain the rest as the total fork population (`N_TOTAL`).

**If `${var}` is set** to `owner/repo`, filter to that single fork and skip step 2 (treat as "active").

### 2. Classify by activity window

- **Active** = `pushed_at` within last 30 days.
- **Stale** = 30–365 days.
- **Dormant** = >365 days or never pushed after creation.

If zero active forks AND no state change (no new forks, no forks that flipped active→stale or stale→active vs prior state):
- Write status=`FORK_FLEET_QUIET` to `memory/logs/${today}.md`.
- Update state file.
- **Do NOT send any notification.**
- Stop.

### 3. Per-fork compare (one call each)

For each active fork, call cross-repo compare using the fork's own `default_branch` and `full_name` (fixes any repo-rename drift):

```bash
gh api "repos/${PARENT_REPO}/compare/${PARENT_OWNER}:${PARENT_DEFAULT_BRANCH}...${FORK_OWNER}:${FORK_DEFAULT_BRANCH}" \
  --jq '{ahead_by, behind_by, status, files: [.files[]? | {filename, status, additions, deletions}], commits: [.commits[]? | {sha: .sha[0:7], msg: .commit.message | split("\n")[0], author: .commit.author.name, date: .commit.author.date}]}'
```

On `404` (branch missing / fork emptied): mark fork `UNREADABLE` and continue.
On `429`: sleep 60s, retry once. On `5xx`: sleep 10s, retry once. On persistent fail: mark `API_FAIL` for that fork.

Cross-repo compare returns unique fork commits (`commits`) and changed files (up to 300) in one shot. No separate `/commits` calls needed.

### 4. Classify divergence signals per fork

From the `files` array, tag each fork with signals:
- **New skills**: files with `status=added` under `skills/*/SKILL.md`
- **Modified skills**: `status=modified` under `skills/*/SKILL.md`
- **Custom schedule**: any change to `aeon.yml`
- **Modified dashboard**: any change under `dashboard/`
- **Custom notify**: change to `notify` or `notify-jsonrender`
- **New content**: additions under `articles/` or `memory/topics/`
- **Config changes**: changes to `CLAUDE.md`, `.github/`, or root `scripts/`
- **Workflow changes**: changes under `.github/workflows/`

### 5. Score each fork (substance-weighted)

```
score =  10 × (new skill files)
       +  4 × (modified skill files)
       +  2 × min(unique_commits, 15)
       +  3 × (new content files, capped at 5)
       +  2 × (workflow/config files, capped at 3)
       +  1 × (custom-schedule flag)
       +  1 × stargazers
```

Sort active forks by score descending. Flag any fork with ≥1 new skill file as a **PROMOTE** candidate; ≥3 unique commits OR ≥1 modified skill as **REVIEW**; otherwise **NOTE**.

### 6. Deep-read top upstream candidates

For every PROMOTE fork (capped at 5), fetch each unique skill's SKILL.md from the fork's default branch:

```bash
gh api "repos/${FORK_FULL_NAME}/contents/${SKILL_PATH}?ref=${FORK_DEFAULT_BRANCH}" --jq '.content' | base64 -d
```

On failure fall back to the file tree listing and note "could not read content". Synthesize each unique skill into a 1-2 sentence description of what it does. Do NOT deep-read REVIEW or NOTE forks (output stays actionable).

### 7. Compute week-over-week delta

Compare current active-fork set to prior state file:
- **NEW_FORK**: full_name absent from prior state
- **NEW_ACTIVE**: was stale/dormant, now active
- **WENT_STALE**: was active, now stale/dormant
- **NEW_SKILLS**: active in both snapshots, `new_skill_count` increased
- **GONE**: archived / deleted since prior run

### 8. Pick the verdict

One line at the top. Priority order:
1. `NEW UPSTREAM CANDIDATE: {fork}` — if ≥1 PROMOTE fork has ≥1 new skill not present in prior state
2. `ACTIVE FLEET: {N} forks building` — if ≥3 PROMOTE+REVIEW combined
3. `FLEET STIRRING: {N} new active` — if ≥2 NEW_FORK or NEW_ACTIVE
4. `HOLDING PATTERN: {N} active, no new work` — active forks present but nothing crossed REVIEW
5. `DORMANT: no active forks` — shouldn't reach notify (step 2 would have gated), included for log-only path

### 9. Write the article

To `articles/fork-fleet-${today}.md`:

```markdown
# Fork Fleet Report — ${today}

**Verdict:** {one-line verdict}

Fleet: N_TOTAL total forks · N_ACTIVE active · N_MANAGED managed instances · N_COMMUNITY community.

---

## What changed this week
- **New forks**: [list or "none"]
- **Went active**: [list or "none"]
- **New skills landed**: [fork → skill names, or "none"]
- **Went stale**: [list or "none"]
- **Archived/deleted**: [list or "none"]
(Omit the entire section if every bucket is empty.)

---

## PROMOTE — upstream contribution candidates

### {fork_full_name} — score N [MANAGED | COMMUNITY]
**Activity:** last pushed YYYY-MM-DD · stars N · +N/-M commits vs upstream
**Unique skills:**
- `skills/foo/SKILL.md` — {one-line synthesis of what it does, from deep-read}
- `skills/bar/SKILL.md` — {synthesis}

**Why promote:** {1-2 sentence take — what this skill does that upstream lacks, and whether it's generalizable}
**Suggested action:** Open a PR cherry-picking `skills/foo/` (or reach out to {owner} to upstream themselves).

(Repeat for each PROMOTE fork, capped at 5.)

If PROMOTE is empty: write "No upstream candidates this week."

---

## REVIEW — worth a look

| Fork | Score | Ahead | New/Modified | Notable |
|------|-------|-------|--------------|---------|
| owner/repo | N | +N/-M | 0/2 | dashboard rewrite, custom notify |

(Omit if empty.)

---

## NOTE — low divergence

Terse one-liner per fork: `owner/repo (+N/-M, schedule tweak only)`. Collapse if >5 entries into a count. Omit if empty.

---

## Fleet vs community

| Category | Count |
|----------|-------|
| Managed instances | N |
| Community forks | N |
| Stale (30-365d) | N |
| Dormant (>365d) | N |

## Source status
`forks_list=ok|fail · compare_ok=N/M · deep_read=N/M · rate_limit_retries=N · unreadable=N`
```

Cap total article length at ~500 lines. If PROMOTE has >5 forks, keep only the top 5 by score; list the rest in REVIEW.

### 10. Update state

Write `memory/topics/fork-fleet-state.json`:

```json
{
  "last_run": "${today}",
  "last_status": "FORK_FLEET_OK",
  "parent_repo": "owner/repo",
  "forks": {
    "owner/repo": {
      "pushed_at": "YYYY-MM-DD...",
      "default_branch": "main",
      "ahead_by": N,
      "behind_by": N,
      "new_skill_count": N,
      "score": N,
      "tier": "PROMOTE|REVIEW|NOTE|UNREADABLE|API_FAIL",
      "unique_skills": ["skills/foo/SKILL.md", "..."]
    }
  }
}
```

### 11. Log

Append to `memory/logs/${today}.md`:

```
## fork-fleet
- Status: FORK_FLEET_OK (or NO_CHANGE / QUIET / API_FAIL)
- Verdict: {one-line verdict}
- Fleet: N_ACTIVE active / N_TOTAL total (N_MANAGED managed, N_COMMUNITY community)
- PROMOTE: N forks (list), REVIEW: N, NOTE: N
- Delta: {new_forks:N, new_active:N, new_skills:N, went_stale:N}
- Article: articles/fork-fleet-${today}.md
- Source status: forks_list=ok|fail · compare_ok=N/M · deep_read=N/M · unreadable=N
```

### 12. Notify — gated

**Skip notify entirely** when:
- Status is `FORK_FLEET_QUIET` (no active forks, no state change), OR
- Status is `FORK_FLEET_NO_CHANGE` (no PROMOTE, no REVIEW, and every `what-changed` bucket empty)

Otherwise send via `./notify`:

```
*Fork Fleet — ${today}*
{verdict line}

Fleet: N_ACTIVE active / N_TOTAL total. {1 sentence describing shape — "mostly managed instances", "community picking up", "dormant templates", etc.}

{If PROMOTE non-empty:}
Upstream candidate: {top PROMOTE fork}
{2 sentences: what they built, why it's worth merging back}

{If delta has any NEW_SKILLS:}
New skills landed this week:
- {fork} → `skills/foo/SKILL.md` — {synthesis}

{If delta has any NEW_FORK or NEW_ACTIVE:}
New activity: {fork names}

Full report: articles/fork-fleet-${today}.md
```

Keep under ~800 chars total so it renders cleanly across Telegram/Discord/Slack.

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `FORK_FLEET_OK` | Active forks present AND (PROMOTE/REVIEW non-empty OR delta non-empty) | Yes |
| `FORK_FLEET_NO_CHANGE` | Active forks exist but nothing crossed REVIEW and delta is empty | No (log only) |
| `FORK_FLEET_QUIET` | Zero active forks and no state change | No (log only) |
| `FORK_FLEET_API_FAIL` | Fork listing failed or >50% of compares failed | Yes (error notify) |

## Constraints
- Cross-repo compare accepts up to 300 files per response; if any fork exceeds this, note `files_truncated=true` for that fork and proceed.
- Cap active-fork deep processing at 50 per run — if more, rank by `pushed_at_epoch` desc and trim (log `truncated_at=50`).
- Never deep-read content from a fork with `archived=true` or if the SKILL.md path is absent from the compare `files` list (cheapest sanity check).
- Never invent PROMOTE candidates — a fork with zero new skill files is at most REVIEW.

## Sandbox note

Uses `gh api` throughout — authenticates via `GITHUB_TOKEN` automatically and works from the sandbox. No `curl` needed. If `gh api` fails due to rate limits, honor the retry policy in step 3; if the initial `/forks` listing fails after retry, status=`FORK_FLEET_API_FAIL` with source-status `forks_list=fail`.

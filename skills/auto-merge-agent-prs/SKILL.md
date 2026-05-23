---
name: auto-merge-agent-prs
description: Close the loop on agent-authored PRs — auto-merge green, unblocked PRs opened by the agent so feature shipping doesn't stall waiting for a human click
var: ""
tags: [dev, meta]
---
> **${var}** — Optional. Pass `dry-run` to list eligible PRs without merging. Pass an `owner/repo` to override the auto-detected repo. Pass `author:<login>` to override the auto-detected agent author. Empty = audit the current repo's open PRs by the configured agent author.

Today is ${today}. Every `feature`, `self-improve`, and `external-feature` run opens a PR that sits unmerged until the operator manually approves it. With a workflows-scope PAT in place, the merge loop can close automatically. Eliminating the manual-click step is the last hop to fully autonomous feature shipping.

## Why this exists

A generic fleet-wide `auto-merge` skill treats every PR author the same. Agent-authored PRs are a different population:

- They're predictable in shape (titled `feat:`, `fix:`, `chore:`, authored by the agent's GitHub identity)
- Their checks are deterministic (the same `claude-skill.yml` workflow CI that ran when the PR was opened)
- They don't need human review — the operator authored the skill that opened the PR, not the PR itself
- They pile up: open agent PRs accumulate, all green, all waiting

A dedicated, agent-only merger respects the bright line between "things the agent shipped" and "things a human is reviewing." It also keeps blast radius narrow — it can never accidentally auto-merge an external contributor's PR.

## Config

No new secrets. Uses the existing `GH_TOKEN` (or `GH_GLOBAL`) — must have `pull_requests:write` and `contents:write` scope to merge.

Configurable author: by default, this skill targets PRs authored by the GitHub identity recorded in `memory/topics/agent-identity.md` (line `agent_login: <login>`). If that file is missing, fall back to the value of `${var}` `author:<login>` override, or — if neither is set — exit with `AUTO_MERGE_AGENT_PRS_NO_AUTHOR` and notify so the operator can set it.

Reads:
- `gh pr list -R ${REPO} --author ${AGENT_LOGIN} --state open --json ...` — eligible PR set
- `memory/topics/auto-merge-state.json` — per-PR attempt history (for retry cap)

Writes:
- `memory/topics/auto-merge-state.json` — attempt counter and last-result timestamps
- `memory/logs/${today}.md` — one log block per run

## Eligibility gates

A PR is auto-mergeable if **all** of the following are true:

1. **Author**: `author.login == ${AGENT_LOGIN}` (the agent's GitHub identity)
2. **Status checks**: `statusCheckRollup` is either empty (no CI configured, vanishingly rare on this repo) or every entry has `conclusion ∈ {SUCCESS, NEUTRAL, SKIPPED}`. A single `FAILURE` / `CANCELLED` / `ACTION_REQUIRED` disqualifies. A `PENDING` / `IN_PROGRESS` / `QUEUED` check defers (see step 5 — `--auto` flag handles this).
3. **Review state**: `reviewDecision != "CHANGES_REQUESTED"`. `APPROVED` / `null` / `REVIEW_REQUIRED` are all fine (`REVIEW_REQUIRED` doesn't block when there are no required reviewers configured).
4. **Mergeable state**: `mergeable == "MERGEABLE"`. `CONFLICTING` disqualifies; `UNKNOWN` defers (logged but not merged this run — GitHub recomputes within ~30s).
5. **No blocking labels**: PR labels do NOT contain any of `hold`, `do-not-merge`, `dnm`, `wip`, `blocked` (case-insensitive).
6. **No human-requested reviewers**: `reviewRequests[].login` excludes any non-bot account. If a human reviewer is requested, the operator wants eyes on it — defer.
7. **Draft state**: `isDraft == false`. Drafts are explicit "not ready."
8. **Branch name discipline**: `headRefName` matches `^(feat|fix|chore|docs|refactor)/` — conventional-style branches only. Catches accidental PRs opened from `main` or unprefixed branches.
9. **Retry cap**: `state.prs.${pr_number}.attempts < 3`. After 3 failed merge attempts, stop trying — something is wrong and the operator needs to look.

## Steps

### 1. Parse var

- `${var}` empty → `MODE=execute`, `REPO=auto-detect`, `AGENT_LOGIN=from memory`.
- `${var}` starts with `dry-run` → `MODE=dry-run`. Strip the prefix; remainder (if any) is treated as `REPO` or `author:<login>` override.
- `${var}` looks like `owner/repo` → `REPO=$var`.
- `${var}` starts with `author:` → `AGENT_LOGIN=<login>`.
- Otherwise log `AUTO_MERGE_AGENT_PRS_BAD_VAR: ${var}` and exit.

If `REPO=auto-detect`: `REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)`.

If `AGENT_LOGIN` is unresolved after parsing var + reading `memory/topics/agent-identity.md`, exit with `AUTO_MERGE_AGENT_PRS_NO_AUTHOR`.

### 2. Bootstrap state

```bash
mkdir -p memory/topics
[ -f memory/topics/auto-merge-state.json ] || echo '{"prs":{},"last_run":null}' > memory/topics/auto-merge-state.json
```

### 3. List candidate PRs

```bash
gh pr list -R "${REPO}" \
  --author "${AGENT_LOGIN}" \
  --state open \
  --json number,title,headRefName,isDraft,mergeable,reviewDecision,reviewRequests,statusCheckRollup,labels,author,url \
  > /tmp/auto-merge-prs.json
```

If the call fails (sandbox, rate-limit, 5xx): retry once after 30s. Persistent failure → log `AUTO_MERGE_AGENT_PRS_API_FAIL` and exit (no notify).

If the response is `[]` (no open agent PRs): log `AUTO_MERGE_AGENT_PRS_NOTHING_TO_MERGE` and exit (no notify — silence is correct when there's nothing to do).

### 4. Apply eligibility gates

For each PR in the JSON, walk the 9 gates above. For each PR, record one of:
- `ELIGIBLE` — passed every gate
- `BLOCKED_<gate_name>` — failed gate N; pick the first failing gate top-to-bottom for the reason

PRs marked `BLOCKED_status_checks_pending` (gate 2 deferred because of `PENDING`) are NOT eligible for immediate merge, but they ARE eligible for the `--auto` flag — see step 5.

If zero PRs are `ELIGIBLE` AND zero are `BLOCKED_status_checks_pending`:
- If every blocked PR is blocked by `BLOCKED_status_checks_failed` or `BLOCKED_mergeable_conflicting` → log `AUTO_MERGE_AGENT_PRS_ALL_BLOCKED` and notify a short message (operator needs to look) — see step 7.
- Otherwise → log `AUTO_MERGE_AGENT_PRS_NOTHING_TO_MERGE` and exit silent.

### 5. Merge eligible PRs

For each `ELIGIBLE` PR:

```bash
gh pr merge "${PR_NUMBER}" -R "${REPO}" --squash --delete-branch --auto
```

The `--auto` flag is load-bearing: if CI is still resolving (rare for fully ELIGIBLE PRs, common for `BLOCKED_status_checks_pending`), GitHub will queue the merge and execute it the moment the final check turns green. This means PRs caught at the wrong time (CI just kicked off) still merge without a second skill run.

For each `BLOCKED_status_checks_pending` PR: also issue `gh pr merge --auto` so GitHub queues it. This is the one case where a "blocked" PR still gets the merge command — `--auto` is a queue, not a forced merge.

Cap merge attempts at **5 PRs per run**. The backlog rarely exceeds 3; the cap exists to bound runaway behavior if something pathological happens (e.g. 50 stale PRs from a fork).

Track outcomes per PR:
- `merged_now` — `gh pr merge` returned success and the PR's merged-at timestamp is within this run window
- `merged_queued` — `gh pr merge --auto` accepted the queue (no immediate merge; GitHub will merge when checks pass)
- `merge_failed` — non-zero exit; capture stderr verbatim (≤200 chars)

Increment `state.prs.${pr_number}.attempts` on every attempt regardless of outcome. Reset to 0 if the PR is removed from the open list (merged or closed) since last run.

### 6. Persist state

```json
{
  "last_run": "2026-05-11T11:30:00Z",
  "prs": {
    "37": {
      "first_seen": "2026-05-10T15:00:00Z",
      "last_attempt": "2026-05-11T11:30:00Z",
      "attempts": 1,
      "last_outcome": "merged_now",
      "branch": "feat/example-branch"
    }
  }
}
```

Cap to 30 most-recent entries (LRU by `last_attempt`). Validate with `jq empty` after write; restore from `.bak` on failure.

### 7. Notify

Notify only when *something happened*. Silence on `NOTHING_TO_MERGE` is the desired behavior.

#### Case A: ≥1 PR merged_now or merged_queued (`AUTO_MERGE_AGENT_PRS_OK` or `_PARTIAL`)

```
*Auto-Merge Agent PRs — ${today} — ${REPO}*

Merged ${N_NOW} PR${s}${queued_clause}.

Merged now:
- #37 chore(example): description → squash-merged
- #36 chore(example): description → squash-merged

${optional queued block:}
Queued for auto-merge once CI clears:
- #41 feat(example): description → awaiting CI

${optional skipped block:}
Skipped (will retry next run):
- #42 — mergeable: UNKNOWN (GitHub recomputing)

${optional blocked block:}
Needs your eyes:
- #38 — CHANGES_REQUESTED by <reviewer>
- #39 — CI failure: workflow "<name>" run #<n>

Status: ${OK | PARTIAL — N merged, M still blocked}
```

`PARTIAL` is the status when at least one PR merged but at least one other PR is blocked on something requiring operator attention (CHANGES_REQUESTED, FAILURE, retry-cap-exhausted, blocking label).

#### Case B: Zero merged, ≥1 PR genuinely blocked (`AUTO_MERGE_AGENT_PRS_ALL_BLOCKED`)

```
*Auto-Merge Agent PRs — ${today} — ${REPO}*

0 PRs auto-merged. ${N_BLOCKED} agent PRs need your attention:

- #38 — CHANGES_REQUESTED by <reviewer>
- #39 — CI failure: workflow "<name>" run #<n>
- #40 — merge conflict on aeon.yml

These will not auto-merge until the blocker is cleared. Notification fires once per state (no re-notify same-state runs).

Status: ALL_BLOCKED
```

Suppress re-notify if the *exact same* set of PR-number→reason pairs notified within the last 24h — the operator already saw the list.

#### Case C: Retry-cap reached on ≥1 PR (`AUTO_MERGE_AGENT_PRS_RETRY_CAP`)

```
*Auto-Merge Agent PRs — ${today} — ${REPO}*

Hit retry cap (3 attempts) on:
- #40 — last error: "Pull Request is in unstable state"

Stopping auto-merge attempts on this PR. Investigate manually.

Status: RETRY_CAP
```

If both `OK/PARTIAL` and `RETRY_CAP` conditions trigger in the same run, send Case A's message with the retry-cap PRs included under a "Hit retry cap" subsection — one message per run, not two.

### 8. Log

Append to `memory/logs/${today}.md`:

```
## Auto-Merge Agent PRs
- **Skill**: auto-merge-agent-prs
- **Repo**: ${REPO}
- **Agent author**: ${AGENT_LOGIN}
- **Open agent PRs**: ${TOTAL}
- **Eligible**: ${N_ELIGIBLE} (PR numbers)
- **Blocked**: ${N_BLOCKED} (PR # → reason list)
- **Merged now**: ${N_NOW} (PR # list)
- **Queued via --auto**: ${N_QUEUED} (PR # list)
- **Failed**: ${N_FAILED} (PR # → error)
- **Retry-capped**: ${N_RETRY_CAP} (PR # list)
- **Notifications sent**: ${0 or 1}
- **Status**: ${AUTO_MERGE_AGENT_PRS_OK | _PARTIAL | _NOTHING_TO_MERGE | _ALL_BLOCKED | _RETRY_CAP | _API_FAIL | _BAD_VAR | _DRY_RUN | _NO_AUTHOR}
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `AUTO_MERGE_AGENT_PRS_OK` | All eligible PRs merged or queued | Yes |
| `AUTO_MERGE_AGENT_PRS_PARTIAL` | Some merged, some still blocked needing operator attention | Yes |
| `AUTO_MERGE_AGENT_PRS_NOTHING_TO_MERGE` | Zero open agent PRs, OR all blocked by transient state (UNKNOWN mergeable, etc.) | No |
| `AUTO_MERGE_AGENT_PRS_ALL_BLOCKED` | ≥1 agent PR open, all blocked, none transient — operator needs to look | Yes (24h dedup) |
| `AUTO_MERGE_AGENT_PRS_RETRY_CAP` | One or more PRs hit the 3-attempt cap | Yes |
| `AUTO_MERGE_AGENT_PRS_DRY_RUN` | `var=dry-run` mode — built the report, skipped merge calls | No |
| `AUTO_MERGE_AGENT_PRS_API_FAIL` | `gh pr list` failed twice — couldn't read the candidate set | No |
| `AUTO_MERGE_AGENT_PRS_BAD_VAR` | `${var}` was non-empty, non-`dry-run`, not `owner/repo` shape | No |
| `AUTO_MERGE_AGENT_PRS_NO_AUTHOR` | Agent author identity not configured | Yes |

## Sandbox note

`gh` CLI handles auth internally — no env-var-in-headers, no prefetch script. Both `gh pr list --json` and `gh pr merge --squash --auto` work directly under the sandbox once a PAT with `pull_requests:write`, `contents:write`, and (for workflow edits) `workflows` scope is wired into `GH_TOKEN`. If the sandbox blocks a specific `gh` invocation, the skill exits `AUTO_MERGE_AGENT_PRS_API_FAIL` cleanly without partial state.

## Constraints

- **Agent-only scope.** Author filter is hard-pinned to the configured `AGENT_LOGIN`. External-contributor PRs are out of scope for this skill — they belong in `pr-triage` and `auto-merge` (the fleet-wide variant), which apply different gates.
- **Squash-only.** Every merge uses `--squash`. Agent PRs are typically a single logical change; squashing produces a clean main-line history without merge commits.
- **Branch deleted on merge.** `--delete-branch` is always set — agent branches are throwaway and accumulating them clutters the fork's branch list.
- **Retry cap of 3.** After three failed attempts on the same PR (even across multiple runs/days), stop. Repeated failure on a green-looking PR usually means something subtle — a required check that didn't surface, a protected-branch rule, a token scope drift. Surface and stop, don't loop.
- **No retry on FAILURE.** A failed status check is the operator's signal that the PR needs work. Don't auto-merge a red PR even if the operator manually marks it ready — that's outside the autonomous loop's authority.
- **24h re-notify dedup on ALL_BLOCKED.** The operator doesn't need a "still blocked" ping every run when the blocker is in their court. Same-state runs stay silent.
- **`--auto` for pending CI.** PRs caught mid-CI use `--auto` to queue the merge; this avoids a polling skill ("is CI done yet?") and lets GitHub handle the wait.
- **Read-only across `memory/logs/`.** Only today's log is appended; past logs are never modified.
- **No force-merge, no admin-merge.** Branch protection rules, required reviewers, and required checks are all respected. If a rule says "needs review," this skill skips — the loop closes via the operator approving, not via bypass.

---
name: Auto Merge
description: Automatically merge open PRs that have passing CI, no blocking reviews, and no conflicts
var: ""
tags: [dev, meta]
---
<!-- autoresearch: variation C — safety-hardened (author allowlist, size cap, UNKNOWN retry, fork block, dry-run mode) so an autonomous agent with merge credentials cannot accidentally ship a hostile or oversized PR -->

> **${var}** — Repo (owner/repo) to target. If empty, uses every repo in memory/watched-repos.md.
> Env: `AUTO_MERGE_DRY_RUN=1` logs intent without merging. `MAX_AUTO_MERGE=N` caps merges per run (default 3).

Merge open PRs that are fully green **and** pass an explicit safety policy. The policy exists because this skill runs autonomously with write access — a bug in the gate is a bug that ships to main.

Read memory/MEMORY.md and memory/watched-repos.md for repos to target.
Read the last 2 days of memory/logs/ to avoid re-logging PRs already merged.

## Safety policy

A PR merges only when every one of the following holds:

- **Author allowlist**: `author.login` is one of `dependabot[bot]`, `renovate[bot]`, `github-actions[bot]`, OR appears under a `## Trusted Authors` section in memory/watched-repos.md. No allowlist → only the three bot logins are eligible.
- **Size cap**: `additions + deletions ≤ 500`. Override by applying the label `auto-merge-large` on the PR.
- **Base branch**: `baseRefName` is `main` or `master`. Refuse any other target.
- **Not a fork**: `isCrossRepository == false` (fork CI can be tampered with).
- **Not draft**: `isDraft == false`.
- **Not already queued**: `autoMergeRequest == null` (avoid fighting GitHub's native auto-merge if a human enabled it).
- **No opt-out label**: none of {`do-not-merge`, `wip`, `hold`, `needs-review`, `blocked`} present.
- **Mergeable state**: `mergeStateStatus == "CLEAN"` (this is stricter than `mergeable == "MERGEABLE"` — CLEAN additionally requires branch-protection gates to be satisfied).
- **Reviews**: `reviewDecision != "CHANGES_REQUESTED"`.
- **Checks**: every entry in `statusCheckRollup` has `conclusion` in `{SUCCESS, NEUTRAL, SKIPPED}`. Any `FAILURE`, `TIMED_OUT`, `CANCELLED`, `PENDING`, or `null` conclusion disqualifies the PR.

## Steps

1. **List open PRs** for each watched repo with the full field set:
   ```bash
   gh pr list -R owner/repo --state open --json number,title,author,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,autoMergeRequest,isCrossRepository,labels,additions,deletions,baseRefName
   ```

2. **Handle UNKNOWN state** — GitHub computes `mergeStateStatus` lazily. If a PR returns `UNKNOWN`, sleep 3 seconds and re-query once:
   ```bash
   sleep 3 && gh pr view NUMBER -R owner/repo --json mergeStateStatus,mergeable,statusCheckRollup
   ```
   If still UNKNOWN after the retry, skip the PR with reason `UNKNOWN-persistent` and let the next run retry.

3. **Apply the safety policy** to each PR. Record a verdict for every PR: either `MERGE` or `SKIP:<specific-reason>`. Reasons must name the failing gate — e.g. `SKIP:author-not-allowlisted:contributor123`, `SKIP:size-cap:823-lines`, `SKIP:mergeStateStatus=BEHIND`, `SKIP:label:do-not-merge`, `SKIP:check-failed:lint`. Vague reasons like `SKIP:not-ready` are not acceptable.

4. **Merge qualifying PRs**, up to MAX_AUTO_MERGE (default 3):
   - If `AUTO_MERGE_DRY_RUN=1`, log `DRY_RUN:would-merge #N` and continue — **do NOT** invoke merge.
   - Otherwise:
     ```bash
     gh pr merge NUMBER -R owner/repo --squash --delete-branch
     ```
     If the merge fails (non-zero exit), capture stderr and log `MERGE_FAIL #N: <stderr>`. A failed merge does NOT count toward the cap — continue to the next qualifying PR.

5. **Send a notification** only when at least one real (non-dry-run) merge succeeded:
   ```
   *Auto Merge — ${today}*
   Merged N PR(s) on owner/repo:
   - #123: PR title (+45/-12, by @author) — squash merged abc1234
   Queue cleared. Self-improve cycle unblocked.
   ```
   No merges → no notification, just a log entry.

6. **Log to memory/logs/${today}.md** under an `### auto-merge` heading:
   - `Mode`: live | dry-run
   - `Repo(s)`: list
   - `Merged`: `#N title @author +A-D SHA` per line
   - `Skipped`: `#N SKIP:<reason>` per line
   - `Totals`: `merged=X qualified=Y considered=Z`
   - If zero qualified, include a verdict breakdown: `AUTO_MERGE_SKIP: 0/Z qualifying (behind=B blocked=L failing=F draft=D author-blocked=A size-blocked=S)`

## Sandbox note

`gh` authenticates via the workflow's GITHUB_TOKEN — no curl needed. If `gh pr merge` fails with `Resource not accessible by integration`, the workflow token lacks merge permission on that repo; log once and notify at most once per 7 days (check memory/logs/ for prior notification) to avoid alert spam.

## Constraints

- Never merge a PR whose author is not allowlisted, even if every other gate is green.
- Never bypass the size cap without the explicit `auto-merge-large` label (set by a human, not a bot).
- Never auto-retry a `MERGE_FAIL` within the same run — if the first merge attempt fails, log and move on.
- Do not modify PR state other than merging (no comments, no label edits, no branch updates).

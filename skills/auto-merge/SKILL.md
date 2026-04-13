---
name: Auto Merge
description: Automatically merge open PRs that have passing CI, no blocking reviews, and no conflicts
var: ""
tags: [dev, meta]
---
> **${var}** — Repo (owner/repo) to target. If empty, uses all watched repos.

Merge open PRs that are fully green: all status checks SUCCESS or NEUTRAL, no CHANGES_REQUESTED review decisions, and mergeable state MERGEABLE. Cap at MAX_AUTO_MERGE merges per run (default: 3).

Read memory/MEMORY.md and memory/watched-repos.md for repos to target.
Read the last 2 days of memory/logs/ to avoid re-logging PRs already merged.

## Steps

1. **List open PRs** on each watched repo:
   ```bash
   gh pr list -R owner/repo --state open --json number,title,mergeable,reviewDecision,statusCheckRollup
   ```

2. **Filter to mergeable PRs** — a PR is mergeable only when ALL of the following are true:
   - `mergeable == "MERGEABLE"` (no conflicts)
   - `reviewDecision` is not `"CHANGES_REQUESTED"` (no blocking reviews)
   - All entries in `statusCheckRollup` have `conclusion` of `"SUCCESS"`, `"NEUTRAL"`, or `"SKIPPED"` — skip any PR with a `"FAILURE"` or `"PENDING"` check

3. **Log skipped PRs** — for each PR that does NOT qualify, record the reason (conflicts, pending CI, changes requested) in memory/logs/${today}.md without sending a notification.

4. **Merge up to MAX_AUTO_MERGE PRs** (default 3) per run. For each qualifying PR:
   ```bash
   gh pr merge NUMBER -R owner/repo --squash --delete-branch
   ```
   Record the PR number, title, and result SHA in memory/logs/${today}.md.

5. **Send a notification** only if at least one PR was merged:
   ```
   *Auto Merge — ${today}*
   Merged N PR(s) on owner/repo:
   - #123: PR title (squash merged)
   - #124: PR title (squash merged)
   Queue cleared. Self-improve cycle unblocked.
   ```
   If no PRs were merged (all blocked by CI, conflicts, or reviews), do NOT send a notification — just log the reasons.

6. **Log summary** to memory/logs/${today}.md:
   - Merged PRs: list number + title
   - Skipped PRs: list number + reason
   - If nothing was merged: log "AUTO_MERGE_SKIP: no qualifying PRs" and end.

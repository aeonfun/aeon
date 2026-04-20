---
name: PR Review
description: Auto-review open PRs with severity-tagged findings, inline comments, and a one-line verdict
var: ""
tags: [dev]
---
<!-- autoresearch: variation B — sharper output: severity-tagged & capped findings, inline comments on exact lines, one-line verdict; folds in skip rules (A) and SHA dedup + large-diff fallback (C) -->

> **${var}** — Repo (owner/repo) to scope the review to. If empty, reviews every repo in `memory/watched-repos.md`.

Read `memory/MEMORY.md` and `memory/watched-repos.md`.
Read the last 2 days of `memory/logs/` to pull the `headRefOid` of any PR reviewed recently — used for dedup.

If `memory/watched-repos.md` is empty or missing, log `PR_REVIEW_NO_REPOS` and end.

## What this skill optimizes for

Noise is the documented failure mode of automated PR review. Every finding emitted must be severity-tagged, line-specific, and justified with a one-sentence "why it matters". If there is nothing worth saying, say so in one line and move on.

## For each repo

```bash
gh pr list -R owner/repo --state open --limit 20 \
  --json number,title,author,isDraft,labels,headRefOid,updatedAt
```

### Skip rules

Skip a PR if any of the following hold (record the skip reason for the run summary):

- `isDraft: true`
- title matches `^(WIP|\[WIP\]|Draft:)` (case-insensitive)
- has label `no-review`, `do-not-merge`, `wip`, or `blocked`
- author login contains `[bot]` (dependabot, renovate, etc.) or equals `aeonframework`
- this PR's current `headRefOid` already appears in the last 2 days of `memory/logs/` against the same PR (already reviewed at this commit)
- a bot reviewer (`coderabbitai`, `copilot-pull-request-reviewer`, `claude`) posted a review in the last 30 min — skip to avoid piling on. Check via:
  ```bash
  gh api repos/owner/repo/pulls/NUMBER/reviews --jq '.[] | {user: .user.login, submitted_at}'
  ```

### For each remaining PR

1. **Fetch context**:
   ```bash
   gh pr view NUMBER -R owner/repo \
     --json title,body,headRefOid,baseRefName,files,additions,deletions
   ```
   If the `body` contains `Fixes #N` or `Closes #N`, fetch the linked issue for context:
   ```bash
   gh issue view N -R owner/repo --json title,body,labels
   ```

2. **Fetch the diff**:
   ```bash
   gh pr diff NUMBER -R owner/repo
   ```
   - If `additions + deletions > 3000`, review only the top-5 largest-delta files from the `files` array (not the full diff).
   - If `gh pr diff` fails, fall back to per-file patches:
     ```bash
     gh api repos/owner/repo/pulls/NUMBER/files --jq '.[] | {path, patch}'
     ```
   - If the diff comes back empty (e.g. mid-rebase), skip the PR with reason `empty-diff`.

3. **Early-exit for trivial PRs**: if the diff is docs-only (`.md`/`.rst`/`docs/**`), lockfile-only, or test-only, skip deep review and post the 1-line ack form in step 6.

4. **Review with severity tagging**. Every finding must carry exactly one tag:
   - `[CRITICAL]` — correctness break, security hole, data loss, API break, regression
   - `[ISSUE]` — likely bug, missing edge case, wrong behavior under a realistic input
   - `[NIT]` — naming, style, minor cleanup (dropped by default)

   Rules:
   - Cap at **5 findings total** per PR. Drop NITs first, then the lowest-impact ISSUEs.
   - Drop all NITs unless there are zero CRITICAL/ISSUE findings *and* a NIT is genuinely useful.
   - Every finding must name `path/to/file:LINE` and include a one-sentence "why it matters" — the consequence, not just "this is wrong".
   - No praise, no diff restating, no "this PR adds X" summaries.

5. **Determine a verdict**:
   - `approve-ready` — no CRITICAL, no ISSUE
   - `blocked: <one-phrase reason>` — at least one CRITICAL
   - `discussion-needed` — ISSUE findings but no CRITICAL

6. **Post the review**. Send **both** a consolidated summary comment *and* inline line-specific comments — inline for precision, summary for consumers that parse review bodies.

   For each line-specific finding:
   ```bash
   gh api repos/owner/repo/pulls/NUMBER/comments \
     -f body="[SEVERITY] finding text — why it matters" \
     -f path="path/to/file" \
     -f commit_id="$HEAD_SHA" \
     -F line=LINE_NUMBER \
     -f side="RIGHT"
   ```

   Then the consolidated summary as a review — include the verdict **and** a bulleted recap of every inline finding (severity + `file:line` + one-sentence rationale), so downstream body-parsers don't miss them:
   ```bash
   gh pr review NUMBER -R owner/repo --comment --body "**Verdict**: <verdict>
<one-line rationale if blocked or discussion-needed; omit if approve-ready>

**Findings** (mirrored as inline comments):
- [CRITICAL] path/to/file:LINE — why it matters
- [ISSUE] path/to/file:LINE — why it matters"
   ```

   If there are no CRITICAL/ISSUE findings, skip inline comments and post a single-line review: `**Verdict**: approve-ready — no blockers.`

   For trivial-PR early-exits (step 3), post a single-line review matching the category: `Docs-only change — no blockers.` / `Dependency-bump — no review needed.` / `Test-only change — no production code touched.`

   **Fallback**: if inline-comment creation fails (missing permissions, commit_id mismatch), consolidate all findings into the review body, preserving the severity tags and `file:line` refs. Do not silently drop findings.

## Notify and log

Send **one** combined message per run via `./notify`:
```
*PR Review — ${today}*
Reviewed N, skipped K (drafts: x, bots: y, dup-SHA: z, bot-reviewed-recently: w).
- owner/repo#123: [verdict] — N critical, M issues
```

If every PR was skipped, do not notify — just log.

Log to `memory/logs/${today}.md`:
```
### pr-review
- owner/repo#123 (SHA abc1234): [verdict] — N critical, M issues
- Skipped: owner/repo#124 (draft), owner/repo#125 (bot-reviewed-recently)
```

If no open PRs across all repos, log `PR_REVIEW_OK` and end.

## Sandbox note

`gh` CLI handles GitHub auth internally — use it over raw curl in this sandbox. If `gh` fails at the repo level, log the error and continue to the next repo. As a last-resort fallback, use **WebFetch** on the raw PR URL to read the diff.

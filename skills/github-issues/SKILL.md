---
name: GitHub Issues
description: Daily digest of new open issues across your repos, ranked by signal (security/bug/feature/other)
var: ""
tags: [dev]
---
<!-- autoresearch: variation B — sharper output (priority-ranked triage queue instead of a flat list) -->

> **${var}** — Optional scope. Accepts `owner/repo`, `org:foo`, `user:bar`. Empty = all repos owned by the authenticated user.

Read memory/MEMORY.md for context.
Read the last 2 days of `memory/logs/` and extract any GitHub issue URLs already alerted — these are dedup candidates.

## Steps

1. Resolve the 24-hour window and the search scope:
   ```bash
   YESTERDAY=$(date -u -d "yesterday" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
              || date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)
   ME=$(gh api user --jq .login)

   if [ -z "${var}" ]; then
     SCOPE="user:$ME"
   else
     case "${var}" in
       *:*) SCOPE="${var}" ;;          # already qualified (org:foo, user:bar)
       */*) SCOPE="repo:${var}" ;;     # owner/repo
       *)   SCOPE="user:${var}" ;;     # bare login
     esac
   fi
   ```

2. Fetch every new open issue in scope with one advanced-search call (much cheaper than per-repo looping):
   ```bash
   gh search issues --limit 100 \
     --json number,title,url,createdAt,author,labels,repository,comments \
     -- "$SCOPE is:issue is:open created:>$YESTERDAY sort:created-desc" \
     > /tmp/gh-issues.json
   ```
   If the call fails (422 / rate-limit / transient), fall back to looping `gh issue list -R <repo>` over `gh repo list "$ME" --limit 100 --json nameWithOwner,hasIssuesEnabled --jq '.[] | select(.hasIssuesEnabled) | .nameWithOwner'`, applying the same `createdAt > $YESTERDAY` filter via `--jq`.

3. Drop URLs already alerted in the previous 2 days of logs.

4. **Rank** each remaining issue into a priority bucket using its labels and title (case-insensitive regex):
   - **P0 — security/critical**: any label or title matching `security|vuln|cve|exploit|critical|urgent|outage|p0`
   - **P1 — bug/regression**: matches `bug|regression|broken|crash|error|p1`
   - **P2 — feature/enhancement**: matches `feature|enhancement|feat|p2`
   - **P3 — other**: everything else (questions, docs, chores)

5. Sort within each bucket by comment count desc, then `createdAt` desc (more comments = more attention already drawn).

6. If the post-dedup, post-rank set is empty: **send no notification**. Skip directly to step 8.

7. Format and send via `./notify`. Skip empty buckets. Cap message at ~3500 chars; if over, truncate P3 first, then P2:
   ```
   *GitHub Issues — ${today}*
   <K> new issue(s) across <N> repo(s)

   🔴 P0 — security/critical
   • <repo> · #N Title (@author) [labels] — <url>

   🟠 P1 — bugs
   • <repo> · #N Title (@author) [labels] — <url>

   🟡 P2 — features
   • <repo> · #N Title (@author) — <url>

   ⚪ P3 — other
   • <repo> · #N Title (@author) — <url>
   ```
   If P3 has more than 5 entries, collapse the tail to `+X more low-priority`.

8. Log to `memory/logs/${today}.md` under `### github-issues`:
   - Scope used
   - Counts: `P0=<n> P1=<n> P2=<n> P3=<n>`
   - URLs (one per line, so the next run can dedup against this log)

   If counts are all zero, log a single line `GITHUB_ISSUES_OK` and end.

## Sandbox note
`gh` CLI handles auth internally — no curl env-var expansion issues. The `gh search issues` → per-repo `gh issue list` fallback in step 2 covers transient sandbox or API failures.

## Constraints
- **Never alert the same issue twice** — dedup against the prior 2 days of logs is mandatory.
- **Silence on a clean day is a feature** — do not send a "0 issues" message.
- Read-only: do not label, comment on, or close issues. This skill reports; it does not act.

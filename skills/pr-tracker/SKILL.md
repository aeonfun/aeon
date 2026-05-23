---
name: PR Tracker
description: Track status of cross-repo PRs opened by this aeon instance — merges, stale open, and closures
var: ""
tags: [meta, github]
---

Today is ${today}. Audit the status of all PRs opened by this aeon instance across external repos.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, match the operator's voice in the notification. If empty or absent, use a clear, direct, neutral tone. No fluff. No hedging.

## Sandbox Note

Uses `gh api graphql` for all GitHub data. No external HTTP calls. `gh` handles auth internally via `GITHUB_TOKEN` / `GH_TOKEN`. If graphql fails, fall back to `gh search prs`.

## Configuration

The author and bot-branch prefix used to identify aeon-originated PRs are configurable:

1. **Author** — read from (in priority order):
   - `aeon.yml` top-level key `pr_tracker.author:` (e.g. `pr_tracker: { author: "operatorname" }`)
   - environment variable `AEON_PR_AUTHOR`
   - falls back to the authenticated `gh api user --jq .login` (i.e. whoever owns the token)
2. **Bot author email** — read from (priority order):
   - `aeon.yml` `pr_tracker.bot_email:`
   - environment variable `AEON_BOT_EMAIL`
   - defaults to no email filter (relies solely on branch prefix)
3. **Branch prefix** — read from `aeon.yml` `pr_tracker.branch_prefix:` or `AEON_BRANCH_PREFIX`; defaults to `ai/`.

This way the same skill works for any operator without code changes.

## Attribution model

Bot PRs are typically **filed by the operator's GitHub account** while the commits inside may be authored by a separate bot identity (e.g. a dedicated email). To distinguish bot-PRs from manual PRs, all bot work is expected to live on branches with the configured `branch_prefix` (set by `external-feature` and friends).

## Steps

### 1. Resolve config

Resolve `AUTHOR`, `BOT_EMAIL`, and `BRANCH_PREFIX` from the sources above. If `AUTHOR` cannot be resolved at all (no `aeon.yml` value, no env var, no token), log `PR_TRACKER_SKIP: no author configured` and stop.

### 2. Fetch PRs opened by the bot

Primary — GraphQL: fetch PRs authored by `AUTHOR`, then keep only the ones whose head branch starts with `BRANCH_PREFIX`. If `BOT_EMAIL` is set, also verify the latest commit's author email matches.

```bash
gh api graphql -f query='
{
  search(query: "author:'"$AUTHOR"' is:pr sort:updated-desc", type: ISSUE, first: 60) {
    nodes {
      ... on PullRequest {
        number
        title
        state
        headRefName
        url
        createdAt
        mergedAt
        closedAt
        repository { nameWithOwner }
        reviews(last: 1) { nodes { state submittedAt } }
        comments { totalCount }
        commits(last: 1) { nodes { commit { author { email } } } }
      }
    }
  }
}
' | jq --arg prefix "$BRANCH_PREFIX" --arg email "$BOT_EMAIL" \
  '[.data.search.nodes[]
    | select(.headRefName | startswith($prefix))
    | select($email == "" or ((.commits.nodes[0].commit.author.email // "") == $email))]'
```

Fallback — if graphql errors. Filter by branch prefix client-side because `gh search prs` `head:` qualifier requires an exact branch name:
```bash
gh search prs --author "$AUTHOR" --state open   --json number,title,url,createdAt,headRepository,repository,headRefName --limit 60 \
  | jq --arg prefix "$BRANCH_PREFIX" '[.[] | select(.headRefName // "" | startswith($prefix))]'
gh search prs --author "$AUTHOR" --state merged --json number,title,url,mergedAt,repository,headRefName --limit 40 \
  | jq --arg prefix "$BRANCH_PREFIX" '[.[] | select(.headRefName // "" | startswith($prefix))]'
```

### 3. Categorize results

Using today = ${today}:
- **Recent merges** — `state == MERGED` and `mergedAt` within last 7 days
- **Stale open** — `state == OPEN` and `createdAt` > 7 days ago with no review/comment activity in last 7 days
- **Active open** — `state == OPEN` and `createdAt` within last 7 days, or recent comment/review activity
- **Closed no-merge** — `state == CLOSED` (not merged) and `closedAt` within last 7 days

### 4. Update `memory/topics/pr-status.md`

Rewrite the file with a running table of the last 30 entries, sorted by most recent first:

```markdown
# PR Status

*Last updated: ${today}*

## Open (${count})

| Repo | PR | Title | Opened | Age | Activity |
|------|----|----|--------|-----|----------|
| owner/repo | #42 | fix: title | 2026-05-01 | 3d | review requested |

## Recent Merges (last 30d)

| Repo | PR | Title | Opened | Merged |
|------|----|----|--------|--------|
| owner/repo | #38 | feat: title | 2026-04-28 | 2026-04-30 |

## Closed No-Merge (last 30d)

| Repo | PR | Title | Closed | Notes |
|------|----|----|--------|-------|
```

### 5. Decide whether to notify

Skip notification if: zero recent merges (7d) AND zero stale open (>7d) AND zero closed-no-merge (7d).

Send notification otherwise.

### 6. Format notification

Write to `.pending-notify-temp/pr-tracker-${today}.md`, then send:

```bash
./notify -f .pending-notify-temp/pr-tracker-${today}.md
```

Message format:

```
PR Tracker — ${today}

landed (7d): ${N}
${forEach recent_merge}
- ${repo} #${number} — ${title}
${end}

stale open (>7d): ${N}
${forEach stale_open}
- ${repo} #${number} — ${title} (${days}d)
${end}

${if closed_no_merge}
closed no-merge (7d): ${N}
${forEach closed}
- ${repo} #${number} — ${title}
${end}
${end}
```

### 7. Log to `memory/logs/${today}.md`

Append:

```markdown
## PR Tracker
- Author: ${AUTHOR}
- Branch prefix: ${BRANCH_PREFIX}
- Merged (7d): ${N}
- Stale open (>7d): ${N}
- Active open: ${N}
- Closed no-merge (7d): ${N}
- Notification: sent / skipped
- PR_TRACKER_OK
```

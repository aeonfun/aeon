---
name: Shiplog
category: productivity
description: Narrative of everything shipped — features, fixes, and momentum, written as a compelling update
var: ""
tags: [content]
---
> **${var}** — Optional theme filter (e.g. `dashboard`, `security`, `ai`). If set, narrows analysis to commits/PRs/issues whose messages or changed-file paths match the theme (case-insensitive). If empty, covers everything shipped this week.

<!-- autoresearch: variation B — sharper output via thesis-first writing, theme-cap, status taxonomy, theme filter that actually uses ${var}, and HTTPS URL fix -->

Read `memory/MEMORY.md` and the last 7 days of `memory/logs/` for context.
Read `memory/watched-repos.md` for repos to cover. If empty or missing, exit with `SHIPLOG_NO_REPOS` (notify + log, no article).

## Idempotency

If `articles/shiplog-${today}.md` already exists, exit with `SHIPLOG_ALREADY_RAN_TODAY` — no commit, no notify, no overwrite. One shiplog per day.

## Steps

### 1. Compute the 7-day window

```bash
SINCE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
TODAY=$(date -u +%Y-%m-%d)
```

Use `$SINCE` for ALL time filtering — never substitute "since midnight Monday" or similar drift-prone shortcuts.

### 2. Gather raw shipping data per repo

For each `REPO` in `memory/watched-repos.md`, collect from these endpoints. Track success/failure of each in a `sources` map (`commits`, `prs`, `releases`, `issues`, `open_prs`) — on a single endpoint failure log `fail` and continue, do NOT abort the whole skill.

```bash
# Commits — last 7 days, first-line of message + author + date
gh api "repos/${REPO}/commits" -X GET -f since="$SINCE" \
  --jq '.[] | {sha: .sha[0:7], full_sha: .sha, message: (.commit.message | split("\n")[0]), author: .commit.author.name, date: .commit.author.date}' \
  --paginate

# Merged PRs this week (with body excerpt for substance)
gh api "repos/${REPO}/pulls" -X GET -f state=closed -f sort=updated -f direction=desc \
  --jq "[.[] | select(.merged_at != null) | select(.merged_at > \"$SINCE\") | {number, title, user: .user.login, merged_at, labels: [.labels[].name], body: (.body // \"\" | .[0:400])}]"

# Releases this week
gh api "repos/${REPO}/releases" \
  --jq "[.[] | select(.published_at != null and .published_at > \"$SINCE\") | {tag_name, name, published_at, body: (.body // \"\" | .[0:400])}]"

# Issues closed this week — excludes PRs (which appear in /issues by default)
gh api "repos/${REPO}/issues" -X GET -f state=closed -f sort=updated -f direction=desc -f since="$SINCE" \
  --jq "[.[] | select(.pull_request == null) | select(.closed_at > \"$SINCE\") | {number, title, user: .user.login, labels: [.labels[].name]}]"

# Open PRs (top 10 by updated) — feeds the "What's Nearly Here" section
gh api "repos/${REPO}/pulls" -X GET -f state=open -f sort=updated -f direction=desc \
  --jq '[.[0:10] | .[] | {number, title, user: .user.login, draft, updated_at}]'
```

Also read this week's `articles/push-recap-*.md` (if any exist) — they already contain digested diff context and save you re-fetching everything.

### 3. Classify the week's signal

Compute:
- `total_commits` = all commits in window
- `substantive_commits` = commits whose first-line message does NOT start with `chore:`, `docs:`, `style:`, `ci:`, `build:`, `test:`, `refactor:`, `Merge`, or `Revert`
- `total_prs_merged`, `total_releases`, `total_issues_closed`

Branch on signal:

| Condition | Status | Action |
|-----------|--------|--------|
| `total_commits == 0` AND `total_prs_merged == 0` AND `total_releases == 0` | `SHIPLOG_QUIET_WEEK` | Notify only — no article. Skip to step 7. |
| `substantive_commits < 3` AND `total_releases == 0` | `SHIPLOG_LIGHT_WEEK` | Short-form 300–500 word article (template below). |
| Otherwise | `SHIPLOG_OK` | Full 800–1200 word article. |

If `${var}` is set: filter `substantive_commits` and merged PRs by theme — keep items whose message OR changed-file paths contain `${var}` (case-insensitive). If the filtered set is empty, status becomes `SHIPLOG_NO_THEME_MATCH` — notify and exit, no article.

### 4. Score and pick themes (cap = 3)

For each substantive commit/PR, compute a signal score:
- Lines changed (capped at 500): +0.5 per 100 lines
- File diversity: +1 if files span ≥3 directories
- Reviewer/comment diversity on PRs: +1 if ≥2 distinct non-author commenters
- Release association: +2 if commit appears in a release this week
- Label boost: +1 if labeled `feature`, `enhancement`, `breaking`, or `security`

Cluster top-scored items into themes by file-path overlap and shared keywords (extract dominant nouns from commit messages and PR titles). **Cap at 3 themes.** Each theme MUST:
- Name a concrete user-facing capability change (not "refactored X internals")
- Reference ≥1 specific commit `(sha)` or PR `(#N)`
- Be describable in one short paragraph (2–4 sentences)

**Drop themes that fail these gates rather than padding to 3.** Two strong themes beats three weak ones.

### 5. Pull diff stats for the top items

For the top 5 commits by signal score:

```bash
gh api "repos/${REPO}/commits/${FULL_SHA}" \
  --jq '{files: [.files[] | {filename, status, additions, deletions}], stats: .stats}'
```

Use `additions + deletions` and the changed-file list to write substance into theme paragraphs — quote real file names where relevant ("the change touches `apps/dashboard/lib/runs.ts` and the workflow runner").

### 6. Write the article

Write to `articles/shiplog-${TODAY}.md`. Use the template matching the status from step 3.

**`SHIPLOG_OK` (full):**

```markdown
# Week in Review: [4–8 word title that names the thesis]

*${TODAY} — Weekly shipping update*

> [ONE sentence — the thesis. Must name a concrete capability/direction change in the project this week. Not "we shipped a lot." Not "exciting progress."]

## What Shipped

### [Theme 1 — verb-led title naming the capability change]
[2–4 sentences. Lead with the user-facing change, then how it works, then why it matters. Reference (sha) or (#PR). Plain language — translate commit-speak into "what a colleague would understand over coffee."]

### [Theme 2]
[Same treatment]

### [Theme 3 — only if it earns its place per the gates in step 4]

## Fixes & Polish
- [Bullet — only the user-noticeable ones, max 6 bullets, each one specific with a (sha) or (#PR)]

## What's Nearly Here
[1–3 sentences pulled from open PRs that look close to merging — name them by title and #N. Skip the entire section if no open PR is close.]

---

**Stats:** N commits · M PRs merged · K issues closed · +X / −Y lines · contributors: [names]
**Sources:** [repo URL] · commits=[ok|fail] · prs=[ok|fail] · releases=[ok|fail] · issues=[ok|fail] · open_prs=[ok|fail]
```

**`SHIPLOG_LIGHT_WEEK` (short, 300–500 words):**

```markdown
# Week in Review: A Quieter Week

*${TODAY}*

> [ONE sentence — what little did happen, framed honestly. Don't pretend this was a big week.]

## What Shipped
- [3–6 specific bullets, each with (sha) or (#PR). No padding, no recycled commit messages.]

---
**Stats:** N commits · M PRs · +X / −Y
```

**Hard rules for both forms:**
- Only include a "Momentum Check" section if a prior `articles/shiplog-*.md` (or legacy `articles/weekly-shiplog-*.md`) exists from 7–14 days ago to compare against. If none exists, omit the section — do not invent a baseline.
- Cite every concrete claim with `(sha)` or `(#PR)`. Anything uncitable goes.
- If you would write "the team continued working on X," delete that sentence.
- **Banned phrases:** "exciting", "robust", "leveraging", "unlocks", "in this fast-moving space", "we're thrilled", "stay tuned".

### 7. Notify

Build the article URL from `gh` (do NOT use `git remote get-url origin` — it returns SSH form on some setups):

```bash
REPO_URL=$(gh repo view --json url -q .url)
ARTICLE_URL="${REPO_URL}/blob/main/articles/shiplog-${TODAY}.md"
```

Send via `./notify` based on status:

**`SHIPLOG_OK` / `SHIPLOG_LIGHT_WEEK`:**

```
*Shiplog — ${TODAY}*

[Thesis sentence from the article — verbatim]

Themes:
- [Theme 1 title — ≤12 words]
- [Theme 2 title — ≤12 words]
- [Theme 3 title — only if exists]

N commits · M PRs · +X / −Y
${ARTICLE_URL}
```

**`SHIPLOG_QUIET_WEEK`:**

```
*Shiplog — ${TODAY}*
SHIPLOG_QUIET_WEEK — 0 commits, 0 PRs merged, 0 releases in the last 7 days. No article written.
```

**`SHIPLOG_NO_THEME_MATCH`:**

```
*Shiplog — ${TODAY}*
SHIPLOG_NO_THEME_MATCH — no shipping matched theme "${var}" this week. No article written.
```

**`SHIPLOG_NO_REPOS`:**

```
*Shiplog — ${TODAY}*
SHIPLOG_NO_REPOS — memory/watched-repos.md is empty or missing. Add a repo to enable this skill.
```

**`SHIPLOG_ALREADY_RAN_TODAY`:** silent — no notify, no commit. Just log and exit.

### 8. Log

Append to `memory/logs/${TODAY}.md`:

```
### shiplog
- Status: SHIPLOG_OK | SHIPLOG_LIGHT_WEEK | SHIPLOG_QUIET_WEEK | SHIPLOG_NO_THEME_MATCH | SHIPLOG_NO_REPOS | SHIPLOG_ALREADY_RAN_TODAY
- Theme filter: ${var:-none}
- Repos covered: [list]
- Commits / PRs merged / Issues closed: N / M / K
- Themes: [theme 1 title; theme 2 title; theme 3 title]
- Sources: commits=ok|fail, prs=ok|fail, releases=ok|fail, issues=ok|fail, open_prs=ok|fail
- Article: articles/shiplog-${TODAY}.md (if written)
- Notify URL: ${ARTICLE_URL} (if applicable)
```

## Sandbox note

The sandbox may block outbound `curl`. `gh` CLI handles auth internally and is the preferred path here — every API call above uses `gh api`. If a `gh api` call fails for transient reasons, retry once with a smaller `--paginate` page size. For non-API web fetches (e.g. external mention search), use **WebFetch** as the fallback per `CLAUDE.md`.

## Constraints

- One shiplog per day — always check for an existing `articles/shiplog-${today}.md` first.
- Themes name capability changes, not refactors. Drop weak themes rather than pad to 3.
- The thesis sentence is mandatory; it must come from the actual data, not boilerplate.
- Never invent activity that isn't in the raw data — every claim needs a `(sha)` or `(#PR)`.
- The notify URL must be the GitHub web URL via `gh repo view --json url`, not the SSH remote.
- Banned phrases (see step 6) are non-negotiable — they signal stock-newsletter output.

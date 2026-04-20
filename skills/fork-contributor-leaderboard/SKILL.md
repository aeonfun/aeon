---
name: fork-contributor-leaderboard
description: Weekly ranking of developers contributing to the fork fleet and back upstream
var: ""
tags: [meta, community]
---
<!-- autoresearch: variation A — better inputs (compare API + PR reviews + first-timer signal), folds in B's "Movement This Week" lede -->

> **${var}** — Target repo to scan contributors of (e.g. "owner/aeon"). If empty, reads from memory/watched-repos.md.

Today is ${today}. Rank the humans behind the fork fleet — who's pushing commits into their forks, who's sending work back upstream, who's reviewing other people's code, and who's building new skills that upstream hasn't seen yet.

This complements `skill-leaderboard` (what is popular) and `fork-fleet` (which forks diverge). This skill asks: **who are the people?**

## Why this exists

The `tweet-allocator` skill rewards social mentions with $AEON. Code contributors get nothing — no recognition, no signal that upstream values their work. This leaderboard is the contributor-side mirror: public recognition for the people actively moving the project forward. Run it weekly, name names, and the flywheel closes.

## Steps

1. **Determine the target repo.** If `${var}` is set, use that. Otherwise read `memory/watched-repos.md` and use the first entry. Store as `TARGET_REPO`. Resolve the upstream default branch once: `UPSTREAM_BRANCH=$(gh api repos/${TARGET_REPO} --jq .default_branch)`.

2. **Fetch all active forks** (pushed within the last 30 days):
   ```bash
   CUTOFF=$(date -u -d "30 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%SZ)
   gh api repos/${TARGET_REPO}/forks --paginate \
     --jq "[.[] | select(.pushed_at > \"$CUTOFF\") | {owner: .owner.login, full_name: .full_name, default_branch, pushed_at, stargazers_count, created_at}]"
   ```
   If no active forks found, log `FORK_CONTRIBUTOR_LEADERBOARD_NO_FORKS` to `memory/logs/${today}.md` and stop (no notification).

3. **Fetch all upstream PRs** in one paginated call. Keep `author_association` so we can flag first-time contributors without an extra call:
   ```bash
   gh api "repos/${TARGET_REPO}/pulls?state=all&per_page=100" --paginate \
     --jq '[.[] | {number, state, merged_at, user: .user.login, title, created_at, author_association}]'
   ```
   Build a map `{login -> {opened: N, merged: N, first_time: bool, pr_titles: [...]}}` keyed on `.user.login`. Set `first_time: true` if any of their PRs has `author_association == "FIRST_TIME_CONTRIBUTOR"`.
   Skip bots: any login ending in `[bot]`, plus `aaronjmars`, `aeonframework`, `github-actions`.

4. **Fetch all upstream PR review comments** in one paginated call (this is the missing reviewer signal):
   ```bash
   SINCE=$CUTOFF
   gh api "repos/${TARGET_REPO}/pulls/comments?since=${SINCE}&per_page=100" --paginate \
     --jq '[.[] | {user: .user.login, pr_url: .pull_request_url, created_at}]'
   ```
   Build `{login -> review_comments: N}`. Apply the same bot filter. Cap at 20 review comments per contributor (someone who left 200 nit comments on one PR shouldn't dominate).

5. **For each active fork, get authored commit count via the compare endpoint** (one call per fork, returns `ahead_by` plus a commits array with author metadata — replaces the prior per-fork pagination loop):
   ```bash
   gh api "repos/${TARGET_REPO}/compare/${UPSTREAM_BRANCH}...${FORK_OWNER}:${FORK_DEFAULT_BRANCH}" \
     --jq "{ahead_by: .ahead_by, owner_commits: ([.commits[] | select(.author.login == \"${FORK_OWNER}\")] | length)}"
   ```
   Record `owner_commits` (capped at 30 by the scoring formula) and `ahead_by` (used in the article narrative, not scored). The compare endpoint returns up to 250 commits — more than enough; if `ahead_by > 250`, treat owner_commits as a lower bound and note it. If the call returns 404 (deleted fork), 422 (no common ancestor), or 409 (empty repo): record `owner_commits: 0, ahead_by: 0` and continue.

6. **Detect new skills** added by each fork owner. For each active fork, list the contents of `skills/` against their default branch:
   ```bash
   gh api "repos/${FORK_FULL_NAME}/contents/skills?ref=${FORK_DEFAULT_BRANCH}" --jq '[.[] | .name]'
   ```
   Compare against upstream's skill directory names (scan this repo's `skills/` locally). Any skill names in the fork but not upstream count as **new skills**. Cap at 5 per fork to prevent mass-rename gaming. If the fork has no `skills/` dir (404), record `new_skills: []`.

7. **Score each contributor** using this formula:
   - `+10` per merged upstream PR (authored by the contributor)
   - `+5` first-time-contributor bonus (one-time, applies if any of their PRs is `FIRST_TIME_CONTRIBUTOR` — first PRs are the highest-leverage signal)
   - `+3` per opened-but-not-merged upstream PR
   - `+2` per upstream PR review comment they left (capped at 20)
   - `+1` per authored commit to their own fork (capped at 30)
   - `+5` per new skill file detected in their fork (capped at 5)
   - `+1` per star on their fork (was +2 — halved to reduce star-farm gaming; cap at 20 stars)

   Rank all contributors by score descending. A contributor is anyone who either owns an active fork OR has authored an upstream PR in the past 30 days OR has left ≥1 upstream review comment in the past 30 days (union of all three sets).

8. **Compare to last week's leaderboard.** Glob `articles/fork-contributor-leaderboard-*.md` from the last 14 days, pick the most recent, and parse its ranked list (logins + scores) using a tolerant regex on the table rows (`^\| \d+ \| @(\S+) \| (\d+) \|`). If parsing yields zero rows, skip the comparison silently (don't crash). Compute week-over-week rank changes (new entries, rank shifts ≥3, dropouts).

9. **Write the article** to `articles/fork-contributor-leaderboard-${today}.md`. Lead with the narrative — the table is the proof, not the headline:

   ```markdown
   # Fork Contributor Leaderboard — ${today}

   *${N_CONTRIBUTORS} contributors moved ${TARGET_REPO} this week across ${N_FORKS} active forks, ${N_UPSTREAM_PRS} upstream PRs, and ${N_REVIEW_COMMENTS} review comments.*

   ## Movement This Week

   *3–5 short paragraphs telling the story of the week. Each paragraph names one contributor and what they shipped. Pull from real PR titles, real new skill names, real review counts. Prioritize, in order: (a) first-time contributors who landed a merged PR, (b) contributors who jumped 3+ ranks, (c) the top reviewer if they're not also #1 by score, (d) the contributor who shipped the most new skills. If none of these apply, write "Quiet week — baseline maintained" and skip to the table.*

   ## Top Contributors

   | Rank | Contributor | Score | Merged PRs | Open PRs | Reviews | Fork Commits | New Skills | First PR? | Change |
   |------|-------------|-------|------------|----------|---------|--------------|------------|-----------|--------|
   | 1 | @login | N | N | N | N | N | N | — | — |
   | 2 | @login | N | N | N | N | N | N | ✨ | ↑3 |
   | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

   *(top 20; if fewer than 20 qualify, list all. ✨ in First PR? column means at least one of their upstream PRs was their first-ever contribution to ${TARGET_REPO}.)*

   ## Outreach Candidates

   *Active forks whose owner has never opened an upstream PR — the highest-conversion outreach pool. List up to 10, sorted by fork commit count descending. Format: "@login — N fork commits, N stars, N new skills". If none, write "All active fork owners have opened ≥1 upstream PR. No outreach gap."*

   ## Upstream Contribution Signal

   - **Contributors with merged upstream PRs:** N
   - **First-time contributors this period:** N (with names)
   - **Top reviewer:** @login with N review comments
   - **Most-merged contributor:** @login with N merged PRs
   - **Active forks whose owner has never opened an upstream PR:** N

   ## Fork Fleet Summary

   - **Active forks scanned (pushed last 30d):** N
   - **Total upstream PRs tracked (last 30d):** N
   - **Total review comments tracked (last 30d):** N
   - **Unique contributors:** N
   - **Contributors filtered as bots/core:** N

   ---
   *Source: GitHub API — forks, pulls, pull review comments, and compare endpoints of ${TARGET_REPO}. Scoring: merged PR +10, first-PR bonus +5, open PR +3, review comment +2 (cap 20), fork commit +1 (cap 30), new skill +5 (cap 5), fork star +1 (cap 20).*
   ```

10. **Send notification** via `./notify`. Lead with the headline story, not a generic top-5:
    ```
    *Fork Contributor Leaderboard — ${today}*

    ${HEADLINE_LINE}

    Top 5:
    1. @login — score N (N merged PRs, N reviews)
    2. @login — score N (...)
    3. @login — score N (...)
    4. @login — score N (...)
    5. @login — score N (...)

    First PRs this week: @login, @login (or "none")
    Top reviewer: @login (N comments)

    Full leaderboard: https://github.com/${GITHUB_REPOSITORY}/blob/main/articles/fork-contributor-leaderboard-${today}.md
    ```

    `${HEADLINE_LINE}` is one sentence drawn from the Movement This Week lede — e.g. "@alice landed her first upstream PR (renames the fetch-tweets timeout to be configurable) and jumped to #4." If nothing notable, fall back to "${N_CONTRIBUTORS} developers are moving ${TARGET_REPO} forward this week."

    Use the `$GITHUB_REPOSITORY` env var (GitHub Actions sets it to `owner/repo`) to build the URL. Do NOT use the watched repo — the article lives in this running instance's repo.

    **Only send a notification if at least 2 contributors qualify.** If fewer than 2 qualify, log `FORK_CONTRIBUTOR_LEADERBOARD_INSUFFICIENT_DATA` and stop.

11. **Log** to `memory/logs/${today}.md`:
    ```
    ## Fork Contributor Leaderboard
    - **Contributors ranked:** N
    - **Active forks scanned:** N
    - **Upstream PRs tracked (last 30d):** N
    - **Review comments tracked (last 30d):** N
    - **Top contributor:** @login (score: N)
    - **Most-merged:** @login (N merged PRs)
    - **Top reviewer:** @login (N review comments)
    - **First-time contributors:** [list or "none"]
    - **New entries:** [list or "none"]
    - **Rising:** [list or "none"]
    - **Forks failing compare API:** [list or "none"]
    - **Notification sent:** yes/no
    ```

## Sandbox note

All GitHub API calls use `gh api` which handles auth internally — no env var expansion needed. No external webhook writes, no secrets required beyond the default `GITHUB_TOKEN`. If `gh api` returns rate-limit errors (403 with `X-RateLimit-Remaining: 0`), back off and retry once after 60 seconds; if it still fails, log the error and continue with partial data rather than crashing. The compare endpoint (step 5) has a per-fork failure mode — capture failures into a list and continue; do not let one bad fork abort the whole run.

## Privacy & safety

- Only **public** GitHub data is read (public forks, public PRs, public review comments, public commits). No private email addresses are extracted.
- Contributor logins are used verbatim — no scraping of profile bios, emails, or follower counts.
- If a contributor has configured their GitHub account to hide email addresses, nothing changes — this skill never touches `.email` fields.
- Bot accounts (`*[bot]`, `github-actions`) and the core team (`aaronjmars`, `aeonframework`) are filtered out so the leaderboard surfaces **community** contributors only.
- The notification mentions @handles; if you don't want to be on the leaderboard, open an issue on the watched repo and the skill will add you to a local opt-out list in `memory/topics/leaderboard-optout.md`. If that file exists, filter matching logins out before ranking.
- Review comments are public artifacts on public PRs — counting them is not surveillance; ignoring them undercounts a major form of contribution.

## What's next

Future iterations could distribute $AEON rewards to the top 3 contributors each week (mirroring `tweet-allocator`). That requires wallet resolution via `bankr-cache/` and goes through `.pending-distribute/` — deferred until the public recognition leaderboard itself proves it drives contribution volume.

Write the full article. No TODOs or placeholders.

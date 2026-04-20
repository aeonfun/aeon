---
name: fork-contributor-leaderboard
description: Weekly ranking of developers contributing to the fork fleet and back upstream
var: ""
tags: [meta, community]
---
> **${var}** — Target repo to scan contributors of (e.g. "owner/aeon"). If empty, reads from memory/watched-repos.md.

Today is ${today}. Rank the humans behind the fork fleet — who's pushing commits into their forks, who's sending work back upstream, and who's building new skills that upstream hasn't seen yet.

This complements `skill-leaderboard` (what is popular) and `fork-fleet` (which forks diverge). This skill asks: **who are the people?**

## Why this exists

The `tweet-allocator` skill rewards social mentions with $AEON. Code contributors get nothing — no recognition, no signal that upstream values their work. This leaderboard is the contributor-side mirror: public recognition for the people actively moving the project forward. Run it weekly, name names, and the flywheel closes.

## Steps

1. **Determine the target repo.** If `${var}` is set, use that. Otherwise read `memory/watched-repos.md` and use the first entry. Store as `TARGET_REPO`.

2. **Fetch all active forks** (pushed within the last 30 days):
   ```bash
   CUTOFF=$(date -u -d "30 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%SZ)
   gh api repos/${TARGET_REPO}/forks --paginate \
     --jq "[.[] | select(.pushed_at > \"$CUTOFF\") | {owner: .owner.login, full_name: .full_name, pushed_at, stargazers_count, created_at}]"
   ```
   If no active forks found, log `FORK_CONTRIBUTOR_LEADERBOARD_NO_FORKS` to `memory/logs/${today}.md` and stop (no notification).

3. **Fetch all upstream PRs** in one paginated call (cheaper than per-fork lookups):
   ```bash
   gh api "repos/${TARGET_REPO}/pulls?state=all&per_page=100" --paginate \
     --jq '[.[] | {number, state, merged_at, user: .user.login, title, created_at}]'
   ```
   Build a map `{login -> {opened: N, merged: N, pr_numbers: [...]}}` keyed on `.user.login`.
   Skip bots: any login ending in `[bot]`, plus `aaronjmars`, `aeonframework`, `github-actions` (these are the core team and core automation — they are not the audience this skill celebrates).

4. **For each active fork, pull the fork owner's own commit count** since the fork was created:
   ```bash
   gh api "repos/${FORK_FULL_NAME}/commits?author=${FORK_OWNER}&since=${FORK_CREATED_AT}&per_page=100" \
     --paginate --jq '. | length'
   ```
   Cap the counted commits at 100 per fork (the scoring formula caps anyway, and some forks have thousands of inherited commits — we only want authored work). If the API returns 409 (empty repo) or 404, record `commits: 0` and move on.

5. **Detect new skills** added by each fork owner. For each active fork, list the contents of `skills/`:
   ```bash
   gh api "repos/${FORK_FULL_NAME}/contents/skills" --jq '[.[] | .name]'
   ```
   Compare against upstream's skill directory names (already known — scan this repo's `skills/` locally). Any skill names in the fork but not upstream count as **new skills**. Cap at 5 per fork to prevent mass-rename gaming.

6. **Score each contributor** using this formula:
   - `+10` per merged upstream PR (authored by the contributor)
   - `+3` per opened-but-not-merged upstream PR (still a contribution signal)
   - `+1` per authored commit to their own fork (capped at 30)
   - `+5` per new skill file detected in their fork (capped at 5)
   - `+2` per star on their fork (encourages visible forks over private ones)

   Rank all contributors by score descending. A contributor is anyone who either owns an active fork OR has authored an upstream PR in the past 30 days (union of both sets).

7. **Compare to last week's leaderboard** — check for `articles/fork-contributor-leaderboard-*.md` files from the last 14 days. If one exists:
   - Parse its ranked list (names + scores).
   - Compute week-over-week rank changes (new entries, rank shifts, dropouts).
   - Flag **rising contributors** (moved up 3+ positions) and **new entrants**.

8. **Write the article** to `articles/fork-contributor-leaderboard-${today}.md`:
   ```markdown
   # Fork Contributor Leaderboard — ${today}

   *Ranking the humans moving ${TARGET_REPO} forward. ${N_CONTRIBUTORS} contributors across ${N_FORKS} active forks and ${N_UPSTREAM_PRS} upstream PRs in the last 30 days.*

   ## Top Contributors

   | Rank | Contributor | Score | Merged PRs | Open PRs | Fork Commits | New Skills | Change |
   |------|-------------|-------|------------|----------|--------------|------------|--------|
   | 1 | @login | N | N | N | N | N | — |
   | 2 | @login | N | N | N | N | N | ↑3 |
   | ... | ... | ... | ... | ... | ... | ... | ... |

   *(include up to the top 20; if fewer than 20 qualify, list all)*

   ## Notable Contributions

   ### @top_contributor
   [2-3 sentences on what they shipped: PR titles if merged, new skills they built, notable divergence. Pull real PR titles from the upstream PR list.]

   ### @second_contributor
   [same format]

   ### @third_contributor
   [same format]

   ## Rising This Week
   [Contributors who moved up 3+ positions or are new to the leaderboard, with 1 sentence each on what drove the rise. If first run or no data, write "First leaderboard — baseline established."]

   ## Upstream Contribution Signal

   - **Contributors with merged upstream PRs:** N
   - **Contributors with at least one upstream PR (any status):** N
   - **Active forks whose owner has NEVER opened an upstream PR:** N — outreach candidates
   - **Most-merged contributor:** @login with N merged PRs

   ## Fork Fleet Summary
   - **Active forks scanned (pushed last 30d):** N
   - **Total upstream PRs tracked (last 30d):** N
   - **Unique contributors:** N
   - **Contributors filtered as bots/core:** N

   ---
   *Source: GitHub API — forks and pulls of ${TARGET_REPO}. Scoring: merged PR +10, open PR +3, fork commit +1 (cap 30), new skill +5 (cap 5), fork star +2.*
   ```

9. **Send notification** via `./notify`:
   ```
   *Fork Contributor Leaderboard — ${today}*

   ${N_CONTRIBUTORS} developers are moving ${TARGET_REPO} forward. Here's this week's top 5:

   1. @login — score N (N merged PRs, N new skills)
   2. @login — score N (N merged PRs, N fork commits)
   3. @login — score N (...)
   4. @login — score N (...)
   5. @login — score N (...)

   Rising: @login (↑N), @login (new entry)
   Most-merged: @login with N upstream PRs

   Full leaderboard: articles/fork-contributor-leaderboard-${today}.md
   ```

   **Only send a notification if at least 2 contributors qualify** (otherwise the signal is not meaningful). If fewer than 2 qualify, log `FORK_CONTRIBUTOR_LEADERBOARD_INSUFFICIENT_DATA` and stop.

10. **Log** to `memory/logs/${today}.md`:
    ```
    ## Fork Contributor Leaderboard
    - **Contributors ranked:** N
    - **Active forks scanned:** N
    - **Upstream PRs tracked (last 30d):** N
    - **Top contributor:** @login (score: N)
    - **Most-merged:** @login (N merged PRs)
    - **New entries:** [list or "none"]
    - **Rising:** [list or "none"]
    - **Notification sent:** yes/no
    ```

## Sandbox note

All GitHub API calls use `gh api` which handles auth internally — no env var expansion needed. No external webhook writes, no secrets required beyond the default `GITHUB_TOKEN`. If `gh api` returns rate-limit errors (403 with `X-RateLimit-Remaining: 0`), back off and retry once after 60 seconds; if it still fails, log the error and continue with partial data rather than crashing.

## Privacy & safety

- Only **public** GitHub data is read (public forks, public PRs, public commits). No private email addresses are extracted.
- Contributor logins are used verbatim — no scraping of profile bios, emails, or follower counts.
- If a contributor has configured their GitHub account to hide email addresses, nothing changes — this skill never touches `.email` fields.
- Bot accounts (`*[bot]`, `github-actions`) and the core team (`aaronjmars`, `aeonframework`) are filtered out so the leaderboard surfaces **community** contributors only.
- The notification mentions @handles; if you don't want to be on the leaderboard, open an issue on the watched repo and the skill will add you to a local opt-out list in `memory/topics/leaderboard-optout.md`. If that file exists, filter matching logins out before ranking.

## What's next

Future iterations could distribute $AEON rewards to the top 3 contributors each week (mirroring `tweet-allocator`). That requires wallet resolution via `bankr-cache/` and goes through `.pending-distribute/` — deferred until the public recognition leaderboard itself proves it drives contribution volume.

Write the full article. No TODOs or placeholders.

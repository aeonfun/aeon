---
name: skill-leaderboard
description: Weekly ranking of which skills are most popular across all active forks
var: ""
tags: [meta]
---
> **${var}** — Target repo to scan forks of (e.g. "owner/aeon"). If empty, reads from memory/watched-repos.md.

Today is ${today}. Generate a leaderboard of the most popular Aeon skills across all active forks.

## Steps

1. **Determine the target repo.** If `${var}` is set, use that. Otherwise read `memory/watched-repos.md` and use the first watched repo. Store as `TARGET_REPO`.

2. **Fetch all active forks** (pushed within the last 30 days):
   ```bash
   CUTOFF=$(date -u -d "30 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%SZ)
   gh api repos/${TARGET_REPO}/forks --paginate --jq "[.[] | select(.pushed_at > \"$CUTOFF\") | {owner: .owner.login, full_name: .full_name, pushed_at}]"
   ```
   If no active forks found, log "SKILL_LEADERBOARD_NO_FORKS" and stop (no notification).

3. **Read each active fork's `aeon.yml`** to extract enabled skills:
   ```bash
   gh api repos/{fork_full_name}/contents/aeon.yml --jq '.content' | base64 -d
   ```
   For each fork, extract all skill entries where `enabled: true`. If the fork has no `aeon.yml` or the API returns 404, skip it and note "no aeon.yml".

4. **Aggregate skill counts** across all forks:
   - For each skill name that appears with `enabled: true` in any fork, count how many forks have it enabled.
   - Also collect the total count of forks with a readable `aeon.yml`.

5. **Compare to last week's leaderboard** — check for `articles/skill-leaderboard-*.md` files from the last 7 days. If one exists, extract its ranked list and compute week-over-week changes (new entries, rank changes, dropouts).

6. **Identify insight categories:**
   - **Consensus skills**: enabled in >50% of active forks
   - **Adoption-gap skills**: exist in the source repo but enabled in zero forks (documentation/discoverability candidates)
   - **Rising skills**: moved up 3+ positions from last week
   - **New entries**: skills not on last week's list

7. **Write the leaderboard article** to `articles/skill-leaderboard-${today}.md`:
   ```markdown
   # Skill Leaderboard — ${today}

   *${N} active forks scanned (pushed in last 30 days)*

   ## Top Skills Across the Fleet

   | Rank | Skill | Forks Enabled | % of Fleet | Change |
   |------|-------|---------------|------------|--------|
   | 1 | skill-name | N | XX% | — |
   | 2 | skill-name | N | XX% | ↑2 |
   | ... | ... | ... | ... | ... |

   ## Consensus Skills (>50% of forks)
   [List skills with broad adoption and why they matter]

   ## Adoption Gaps
   [Skills with zero fork enables — these may need better docs or examples]

   ## Week-over-Week
   [Changes from last week's leaderboard, or "First leaderboard — no prior data" if this is the first run]

   ## Fleet Summary
   - **Active forks scanned:** N
   - **Total skill slots enabled (across all forks):** N
   - **Unique skills seen:** N
   - **Forks with no aeon.yml:** N (likely template/non-running forks)

   ---
   *Source: GitHub API — forks of ${TARGET_REPO}*
   ```

8. **Send notification** via `./notify`:
   ```
   *Skill Leaderboard — ${today}*

   Top skills across ${N} active forks:
   1. [skill] — N forks (XX%)
   2. [skill] — N forks (XX%)
   3. [skill] — N forks (XX%)
   4. [skill] — N forks (XX%)
   5. [skill] — N forks (XX%)

   Consensus: [list of skills enabled by >50% of forks, or "none yet"]
   Adoption gaps: [skills with zero fork enables]

   Full leaderboard: https://github.com/${GITHUB_REPOSITORY}/blob/main/articles/skill-leaderboard-${today}.md

   Use the `$GITHUB_REPOSITORY` env var (GitHub Actions sets it to `owner/repo`) to build the URL. Do NOT use the watched repo — the article lives in this running instance's repo.
   ```
   **Only send a notification if at least 2 active forks were found with readable aeon.yml files.** Otherwise log "SKILL_LEADERBOARD_INSUFFICIENT_DATA" and stop.

9. **Log** to `memory/logs/${today}.md`:
   ```
   ## Skill Leaderboard
   - **Forks scanned:** N active (of M total)
   - **Top skill:** [skill-name] (N forks)
   - **Consensus skills:** [list or "none"]
   - **Notification sent:** yes/no
   ```

---
name: star-milestone
description: Announces when a watched repo crosses a star-count milestone (100, 150, 200, 250, 500, 1000, ...) with a highlight reel of recent work
var: ""
tags: [dev]
---
> **${var}** — Repo (`owner/repo`) to check. If empty, checks all watched repos.

Today is ${today}. Detect milestone star-count crossings on watched repos and celebrate them with a bonus notification. Milestones are a shareable social moment — an autonomous "we crossed 200 stars" post at exactly the right audience (operators already watching the repo) is a free word-of-mouth amplifier.

## Thresholds

The skill watches these star-count milestones (in this order):

```
25, 50, 100, 150, 175, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 25000, 50000, 100000
```

## Steps

1. **Load the repo list.** If `${var}` is set, use it as a single repo. Otherwise read `memory/watched-repos.md`. Skip any repo whose name ends with `-aeon` or contains `aeon-agent` (agent repos, not project repos).

2. **Load milestone state.** Read `memory/topics/milestones.md` if present. If absent, treat state as empty. The file has a section per repo listing every milestone recorded so far, one per line:

   ```markdown
   # Star Milestones

   ## aaronjmars/aeon
   - 150 stars — 2026-04-01 (bootstrap)
   - 175 stars — 2026-04-15
   - 200 stars — 2026-04-19
   ```

3. **For each repo, fetch the current star count:**
   ```bash
   STARS=$(gh api repos/owner/repo --jq '.stargazers_count')
   ```

4. **Find the highest threshold `M` where `M <= STARS`.** If no threshold is <= current count (e.g. fresh repo with 3 stars), log `STAR_MILESTONE_QUIET: below first threshold` and skip this repo.

5. **Decide whether to announce:**
   - If `memory/topics/milestones.md` already lists milestone `M` for this repo → no action.
   - If the repo has **no prior entries** in `milestones.md` → this is the first run. **Bootstrap silently**: record `M` with the `(bootstrap)` suffix. Do NOT send a notification. This prevents retroactive spam on an established repo.
   - Otherwise → a new milestone was crossed. Proceed to step 6.

6. **Build the highlight reel.** Read the last 14 days of `memory/logs/YYYY-MM-DD.md` (if fewer files exist, use what's available). Extract 3–5 concrete highlights from log sections such as `## Push Recap`, `## Feature Built`, `## Repo Article`, `## Repo Actions`, `## Hyperstitions Ideas`, and `## Changelog`. Prefer items that ship tangible value (merged PRs, new skills, articles) over ongoing monitoring runs. De-duplicate and keep the entries concise (one line each).

   If there are no log entries in the window, use `gh api repos/owner/repo/commits?since=<14d-ago>` to pull recent commit subjects and pick 3 interesting ones.

7. **Send the notification** via `./notify`. Required structure — do not compress this; the message goes to a Telegram group and should stand on its own:

   ```
   *Milestone — ${M} stars*
   ${owner/repo}

   [owner/repo] just crossed ${M} stars on GitHub (now at ${STARS}).
   [1–2 sentences framing why this matters — e.g. "This is the third milestone in 30 days, mirroring the post-launch growth curve since X."]

   Highlights since the last milestone:
   - [highlight 1]
   - [highlight 2]
   - [highlight 3]
   - [highlight 4 — optional]

   Repo: https://github.com/owner/repo
   ```

8. **Update `memory/topics/milestones.md`.** Append the new entry under the repo's section. Create the file with a `# Star Milestones` header if it doesn't exist. Keep entries in ascending threshold order per repo.

9. **Log** to `memory/logs/${today}.md`:
   ```
   ## Star Milestone
   - **owner/repo**: stargazers_count=N, milestone crossed: M
   - **Highlights used:** [count]
   - **Notification sent:** yes/no (reason if no)
   ```

## Edge cases

- **Multiple milestones crossed in one run** (e.g. skill was disabled for a long time and the repo jumped from 180 to 260). Announce only the **highest** crossed milestone. Record intermediate ones silently with the `(skipped)` suffix — they're historical anchors but don't deserve individual announcements.
- **Unstars dropping count below a recorded milestone.** Do not "un-record" milestones. Once crossed, they stay in the file permanently.
- **Repo deleted / 404 from `gh api`.** Log the error for that repo and continue with the rest of the list. Do not fail the whole run.

## Sandbox note

`gh api` handles auth via the workflow's `GITHUB_TOKEN` automatically, so no env-var curl workaround is needed. The skill writes notifications via `./notify`, which fans out to every configured channel.

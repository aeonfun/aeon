---
type: Skill
name: Mention Radar
category: social
description: Monitor external web and social mentions of the operator's active projects — surface what people are discovering, where they're confused, and where to engage
schedule: "25 7 2/2 * *"
commits: false
permissions: []
var: ""
tags: [social, dev]
---
> **${var}** — Comma-separated project names to track (e.g. "MyApp, my-lib"). If empty, derives targets from MEMORY.md and memory/topics/projects.md.

Read memory/MEMORY.md for current project status.
Read the last 3 days of memory/logs/ to avoid re-surfacing already-noted mentions.

## Steps

1. **Define the targets.**
   - If `${var}` is set: parse it as a comma-separated list of project names.
   - Otherwise: scan `memory/MEMORY.md` (goals, active topics) and `memory/topics/projects.md` (if it exists) for the operator's active projects. A target needs at least a name; collect a site/domain and a GitHub `owner/repo` too when known.
   - Cap at 6 targets — prefer the most active ones.
   - If zero targets can be derived: log `MENTION_RADAR_SKIP: no projects configured — set var or add projects to memory/topics/projects.md` and stop. No notification.

   For each target, build search terms:
   - The exact project name in quotes (e.g. `"MyApp" site:x.com OR site:reddit.com OR site:news.ycombinator.com`)
   - The domain if known (e.g. `"myapp.xyz"`)
   - The repo if known (e.g. `site:github.com owner/myapp`)

2. **Search for external mentions.** For each project, run WebSearch queries:
   - Try both brand name and URL variants
   - Look for hits on: X/Twitter, Reddit, Farcaster, personal blogs, newsletters, GitHub Discussions, HN, Product Hunt
   - Time-box to last 7 days where the search engine supports it
   - Skip results from the operator's own accounts and the project's own repos (derive the operator's handle from soul/SOUL.md if present)

3. **Also check GitHub network signals** for each target with a known repo:
   ```bash
   gh api repos/OWNER/REPO --jq '{stars: .stargazers_count, forks: .forks_count, watchers: .watchers_count}'
   ```
   Skip any repo that 404s (private or not yet public). Compare to the last log entry to compute deltas. If no prior data, record as baseline.

4. **Categorize each mention** found:
   - **Discovery** — person found the project for the first time, sharing it, impressed ("this is cool", star notification, share)
   - **Confusion** — person unclear on what it does, asking questions, mischaracterizing it
   - **Friction** — person ran into a problem (setup, docs, missing feature)
   - **Competitor comparison** — mentioned alongside or against a competing project
   - **Feature request / wish** — explicit ask for something missing
   - **Press / newsletter** — cited in a publication or digest

5. **Identify engagement opportunities.** Flag any mention where:
   - The person is confused and a 1-tweet clarification would help
   - A feature request aligns with what's being built
   - A competitor comparison is wrong or incomplete
   - A high-follower account discovered the project (high-leverage reply opportunity)

6. **Format the output** (under 4000 chars):
   ```
   *Mention Radar — ${today}*

   {PROJECT NAME, uppercased}
   - [source] — [what they said] — [category]
   ...
   (one section per target)

   ENGAGEMENT OPPORTUNITIES
   - [handle/source]: [why worth replying]

   QUIET: [project] — no external mentions found
   ```
   Use `QUIET: [project]` for any project with zero external mentions this cycle.
   Skip GitHub-only star delta if it's less than 5 — only mention notable jumps.

7. **Only notify if there's signal.** Skip notification if ALL projects are quiet and no GitHub deltas > 5 stars. Log `MENTION_RADAR_QUIET` instead.

8. **Send via `./notify`** if there's anything worth surfacing.

9. **Log to memory/logs/${today}.md**:
   ```
   ## Mention Radar
   - **{project}:** [N mentions / QUIET]
   (one line per target)
   - **Top find:** [best mention in one line, or "none"]
   - **Engagement opps:** [N flagged, or 0]
   - **Notification sent:** yes/no
   ```

## Guidelines

- This is signal filtering, not a metrics report. One real conversation > ten impressions.
- Prioritize quality of mention over quantity. A thoughtful Reddit post or HN comment matters more than a retweet.
- Don't manufacture urgency. If there's nothing worth acting on, say so.
- Be specific — link the source, quote the key line, name the person if identifiable.
- The point is engagement opportunity and awareness, not vanity numbers.

## Sandbox Note

WebSearch is the primary tool here — it bypasses sandbox network restrictions. If an xAI cache is available via `.xai-cache/`, use it for X-specific search. Otherwise WebSearch covers public web hits including indexed tweets.

## No Environment Variables Required

Uses only WebSearch (built-in) and `gh` CLI (pre-authenticated in GitHub Actions).

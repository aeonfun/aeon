---
layout: default
title: "Skills"
permalink: /skills/
---

# Skills

Aeon ships with 50+ skills. Each skill is a self-contained markdown instruction file in `skills/<name>/SKILL.md`. Enable any skill in `aeon.yml` and it runs on schedule.

Install any skill into your own agent:
```bash
./add-skill aaronjmars/aeon <skill-name>
```

---

## Research & Content

| Skill | Description | Default Schedule |
|-------|-------------|-----------------|
| `article` | Research trending topics and write a publication-ready article | Daily 2 PM UTC |
| `digest` | Generate and send a digest on a configurable topic | Daily 2 PM UTC |
| `rss-digest` | Fetch, summarize, and deliver RSS feed highlights | Daily 7 AM UTC |
| `hn-digest` | Top Hacker News stories filtered by your interests | Daily 7 AM UTC |
| `paper-digest` | Find and summarize new papers matching tracked research interests | Daily 7 AM UTC |
| `paper-pick` | Find the one paper most worth reading from arXiv and Semantic Scholar | Daily 2 PM UTC |
| `tweet-digest` | Aggregate and summarize tweets from tracked accounts | Daily 7 AM UTC |
| `list-digest` | Top tweets from tracked X lists in the past 24 hours | Daily 5 PM UTC |
| `research-brief` | Deep dive on a topic combining web search, papers, and synthesis | Daily 2 PM UTC |
| `fetch-tweets` | Search X/Twitter for tweets by keyword, username, or both | Daily 5 PM UTC |
| `search-papers` | Search for recent academic papers on topics of interest | Daily 2 PM UTC |
| `reddit-digest` | Fetch and summarize top Reddit posts from tracked subreddits | Daily 7 AM UTC |
| `security-digest` | Monitor recent security advisories from the GitHub Advisory Database | Daily 2 PM UTC |

---

## Dev & Code

| Skill | Description | Default Schedule |
|-------|-------------|-----------------|
| `pr-review` | Auto-review open PRs on watched repos and post summary comments | Daily 9 AM UTC |
| `github-monitor` | Watch repos for stale PRs, new issues, and new releases | Daily 9 AM UTC |
| `github-issues` | Check all your repos for new open issues in the last 24 hours | Daily 9 AM UTC |
| `github-trending` | Top 10 trending repos on GitHub right now | Daily 9 AM UTC |
| `issue-triage` | Label and prioritize new GitHub issues on watched repos | Daily 9 AM UTC |
| `changelog` | Generate a changelog from recent commits across watched repos | Daily 4 PM UTC |
| `code-health` | Report on TODOs, dead code, and test coverage gaps | Daily 4 PM UTC |
| `feature` | Build new features from GitHub issues or improve the agent | Daily 4 PM UTC |
| `build-skill` | Design and build a new reusable skill | Daily 4 PM UTC |
| `search-skill` | Search the open agent skills ecosystem for useful skills to install | Daily 2 PM UTC |

---

## Crypto & Markets

| Skill | Description | Default Schedule |
|-------|-------------|-----------------|
| `token-alert` | Notify on price or volume anomalies for tracked tokens | Daily 12 PM UTC |
| `token-movers` | Top movers, losers, and trending coins from CoinGecko | Daily 12 PM UTC |
| `trending-coins` | Top trending and most searched coins on CoinGecko | Daily 12 PM UTC |
| `wallet-digest` | Summarize recent wallet activity across tracked addresses | Daily 12 PM UTC |
| `onchain-monitor` | Monitor blockchain addresses and contracts for notable activity | Daily 12 PM UTC |
| `defi-monitor` | Check pool health, positions, and yield rates for tracked protocols | Daily 12 PM UTC |
| `defi-overview` | Overview of DeFi activity from DeFiLlama | Daily 12 PM UTC |
| `polymarket` | Trending and top markets on Polymarket — volume, new markets, movers | Daily 12 PM UTC |
| `polymarket-comments` | Top trending Polymarket markets and most interesting comments | Daily 12 PM UTC |
| `monitor-runners` | Top 5 tokens that ran hardest in the past 24h via GeckoTerminal | Daily 12 PM UTC |
| `token-pick` | One token recommendation and one prediction market pick | Daily 12 PM UTC |

---

## Social & Writing

| Skill | Description | Default Schedule |
|-------|-------------|-----------------|
| `write-tweet` | Generate 10 tweet drafts across 5 size tiers on today's outputs | Daily 5 PM UTC |
| `reply-maker` | Generate two reply options for 5 tweets from tracked accounts | Daily 5 PM UTC |
| `refresh-x` | Fetch a tracked X account's latest tweets and save the gist to memory | Daily 5 PM UTC |

---

## Productivity & Meta

| Skill | Description | Default Schedule |
|-------|-------------|-----------------|
| `priority-brief` | Aggregated daily briefing — digests, priorities, and what's ahead | Daily 7 AM UTC |
| `routine` | Morning briefing combining token movers, tweets, papers, issues, HN | Daily 7 AM UTC |
| `retrospective` | Synthesize the week's logs into a structured retrospective | Mondays 7 PM UTC |
| `goal-tracker` | Compare current progress against goals stored in MEMORY.md | Daily 6 PM UTC |
| `idea-capture` | Quick note capture triggered via Telegram | Daily 2 PM UTC |
| `action-converter` | 5 concrete real-life actions for today based on recent signals | Daily 6 PM UTC |
| `startup-idea` | 2 startup ideas tailored to your skills, interests, and context | Daily 6 PM UTC |
| `heartbeat` | Proactive ambient check — surface anything worth attention | Every 3 hours |
| `memory-flush` | Promote important recent log entries into MEMORY.md | Daily 6 PM UTC |
| `reflect` | Review recent activity, consolidate memory, prune stale entries | Daily 6 PM UTC |
| `skill-health` | Check which scheduled skills haven't run recently | Daily 6 PM UTC |
| `self-review` | Audit of what Aeon did, what failed, and what to improve | Daily 6 PM UTC |
| `rss-feed` | Generate an Atom XML feed from articles in the repo | Daily 5:30 PM UTC |
| `update-gallery` | Sync articles to GitHub Pages gallery with proper Jekyll frontmatter | Weekly Sunday 6 PM UTC |

---

## Installing Skills

```bash
# Install a single skill
./add-skill aaronjmars/aeon article

# Install multiple skills
./add-skill aaronjmars/aeon article digest heartbeat

# Install everything
./add-skill aaronjmars/aeon --all

# Browse available skills
./add-skill aaronjmars/aeon --list
```

Installed skills land in `skills/` and appear in `aeon.yml` as disabled. Flip `enabled: true` to activate.

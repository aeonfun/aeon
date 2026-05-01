# Aeon — Smithery / MCP Registry Submission
*Auto-generated 2026-05-01 by `skills/smithery-manifest`. Re-run the skill to refresh — do not edit by hand.*

## Submission targets

| Registry | Form URL | Manifest file to point at |
|----------|----------|---------------------------|
| Smithery | https://smithery.ai/server/new | `docs/smithery.yaml` (this repo) |
| MCP Registry | https://github.com/modelcontextprotocol/registry → submit a PR adding `servers/io.github.aaronjmars/aeon-mcp.json` | `docs/smithery-manifest.json` (this repo) |

## Field values (copy/paste)

- **Name:** `io.github.aaronjmars/aeon-mcp`
- **Title:** Aeon
- **Version:** 1.0.0
- **Repository URL:** https://github.com/aaronjmars/aeon
- **Subfolder:** `mcp-server`
- **Website URL:** https://github.com/aaronjmars/aeon
- **Transport:** stdio
- **Auth required:** no (reads operator's `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` from env)
- **Tags:** `agent`, `automation`, `github-actions`, `crypto`, `research`, `social`, `dev`

## Description (short — for the listing card)

The most autonomous agent framework — give it a direction and it leverages 95 skills like deep research, PR reviews, market monitoring, and Vercel deploys.

## Description (long — for the listing body)

Aeon is an autonomous agent framework that runs on GitHub Actions and exposes its 95 skills as MCP tools so any Claude Desktop or Claude Code session can invoke them directly. The catalog is dominated by Dev (30), Productivity (24), and Research (17), with the remainder covering crypto/markets, social drafting, and self-managing meta-skills (heartbeat, self-improve, skill-health). Each MCP tool maps 1:1 to an Aeon skill — calling `aeon-deep-research` from Claude Desktop runs the same prompt that the daily cron runs. The server speaks stdio, requires no extra API keys, and reuses whichever Claude credential is already configured for the operator.

## Tool catalog (95 tools)

| Tool | Category | Description |
|------|----------|-------------|
| `aeon-action-converter` | Productivity | 5 concrete real-life actions for today based on recent signals and memory |
| `aeon-agent-buzz` | Social | Top 10 tweets by influence mentioning AI agents |
| `aeon-article` | Research | Research trending topics and write a publication-ready article |
| `aeon-auto-merge` | Dev | Automatically merge open PRs that have passing CI, no blocking reviews, and no conflicts |
| `aeon-auto-workflow` | Dev | Analyze a URL and generate a tailored aeon.yml schedule with skill suggestions |
| `aeon-autoresearch` | Dev | Evolve a skill by generating variations, evaluating them, and updating the best version |
| `aeon-changelog` | Dev | Generate a changelog from recent commits across watched repos |
| `aeon-channel-recap` | Research | Weekly recap article from a public Telegram channel — expand on the best posts |
| `aeon-code-health` | Dev | Weekly report on TODOs, dead code, and test coverage gaps |
| `aeon-cost-report` | Productivity | Weekly API cost report — reads token usage CSV, computes dollar costs per skill and model, reports trends |
| `aeon-create-skill` | Dev | Generate a complete new skill from a one-line prompt |
| `aeon-daily-routine` | Productivity | Morning briefing combining token movers, tweet roundup, paper pick, GitHub issues, and HN digest |
| `aeon-deal-flow` | Productivity | Weekly funding round tracker across configurable verticals |
| `aeon-deep-research` | Research | Exhaustive multi-source synthesis on any topic using full-context ingestion — far beyond a digest |
| `aeon-defi-monitor` | Crypto | Check pool health, positions, and yield rates for tracked protocols |
| `aeon-defi-overview` | Crypto | Daily overview of DeFi activity from DeFiLlama — TVL changes, top chains, top protocols |
| `aeon-deploy-prototype` | Dev | Generate a small app or tool and deploy it live to Vercel via API |
| `aeon-digest` | Research | Generate and send a daily digest on a configurable topic |
| `aeon-distribute-tokens` | Crypto | Send tokens to a list of contributors via Bankr Agent API (supports Twitter handles and EVM addresses) |
| `aeon-evening-recap` | Productivity | End-of-day operational summary — what Aeon shipped, what failed, what needs follow-up |
| `aeon-external-feature` | Dev | Proactively enhance watched repos — fix issues, add features, improve code |
| `aeon-farcaster-digest` | Social | Trending and relevant Farcaster casts filtered by crypto, prediction markets, and coordination topics |
| `aeon-fetch-tweets` | Research | Search X/Twitter for tweets by keyword, username, or both |
| `aeon-fleet-control` | Dev | Monitor managed Aeon instances — check health, dispatch skills, aggregate status |
| `aeon-fork-fleet` | Dev | Inventory active Aeon forks, detect diverged work, surface upstream contribution candidates |
| `aeon-github-issues` | Dev | Check all your repos for new open issues in the last 24 hours |
| `aeon-github-monitor` | Dev | Watch repos for stale PRs, new issues, and new releases |
| `aeon-github-releases` | Dev | Track new releases from key AI, crypto, and infra repos |
| `aeon-github-trending` | Dev | Top 10 trending repos on GitHub right now |
| `aeon-goal-tracker` | Productivity | Compare current progress against goals stored in MEMORY.md |
| `aeon-hacker-news-digest` | Research | Top HN stories filtered by keywords relevant to your interests |
| `aeon-heartbeat` | Productivity | Proactive ambient check — surface anything worth attention |
| `aeon-idea-capture` | Productivity | Quick note capture triggered via Telegram — stores to memory |
| `aeon-issue-triage` | Dev | Label and prioritize new GitHub issues on watched repos |
| `aeon-last30` | Research | Cross-platform social research — what people are actually saying about a topic across Reddit, X, HN, Polymarket, and the web over the last 30 days |
| `aeon-list-digest` | Research | Top tweets from tracked X lists in the past 24 hours |
| `aeon-market-context-refresh` | Crypto | Fetch live crypto macro data and update memory/topics/market-context.md |
| `aeon-monitor-kalshi` | Crypto | Monitor specific Kalshi prediction markets for 24h price moves, volume changes, and top events |
| `aeon-monitor-polymarket` | Crypto | Monitor specific prediction markets for 24h price moves, volume changes, and fresh comments |
| `aeon-monitor-runners` | Crypto | Find the top 5 tokens that ran hardest in the past 24h across major chains using GeckoTerminal |
| `aeon-morning-brief` | Productivity | Aggregated daily briefing — digests, priorities, and what's ahead |
| `aeon-narrative-tracker` | Crypto | Track rising, peaking, and fading crypto/tech narratives — identify the stories manufacturing reality before they peak |
| `aeon-on-chain-monitor` | Crypto | Monitor blockchain addresses and contracts for notable activity |
| `aeon-paper-digest` | Research | Find and summarize new papers matching tracked research interests |
| `aeon-paper-pick` | Research | Find the one paper you should read today from Hugging Face Papers |
| `aeon-polymarket-comments` | Crypto | Top trending Polymarket markets and the most interesting comments from them |
| `aeon-pr-review` | Dev | Auto-review open PRs on watched repos and post summary comments |
| `aeon-pr-triage` | Dev | First-touch triage for external pull requests — verdict + label + welcoming comment within minutes of open |
| `aeon-project-lens` | Dev | Write an article about the project through a surprising lens — connecting it to current events, trends, philosophy, or comparable projects |
| `aeon-push-recap` | Dev | Daily deep-dive recap of all pushes — reads diffs, explains what changed and why |
| `aeon-reddit-digest` | Research | Fetch and summarize top Reddit posts from tracked subreddits |
| `aeon-reflect` | Productivity | Review recent activity, consolidate memory, and prune stale entries |
| `aeon-refresh-x` | Social | Fetch a tracked X/Twitter account's latest tweets and save the gist to memory |
| `aeon-reg-monitor` | Productivity | Track legislation, regulatory actions, and legal developments affecting prediction markets, crypto, and AI agents |
| `aeon-remix-tweets` | Social | Fetch 10 random past tweets from your account and craft 10 new rephrased versions in your voice |
| `aeon-reply-maker` | Social | Generate two reply options for 5 tweets from tracked X accounts or topics |
| `aeon-repo-actions` | Dev | Generate actionable ideas to improve the repo — features, integrations, community, and growth |
| `aeon-repo-article` | Dev | Write an article about the current state, progress, and vision of the watched repo |
| `aeon-repo-pulse` | Dev | Daily report on new stars, forks, and traffic for watched repos |
| `aeon-repo-scanner` | Dev | Catalog all GitHub repos for a user or org |
| `aeon-research-brief` | Research | Deep dive on a topic combining web search, papers, and synthesis |
| `aeon-rss-digest` | Research | Fetch, summarize, and deliver RSS feed highlights |
| `aeon-rss-feed` | Productivity | Generate an Atom XML feed from articles in the repo |
| `aeon-search-skill` | Dev | Search the open agent skills ecosystem for useful skills to install |
| `aeon-security-digest` | Research | Monitor recent security advisories from the GitHub Advisory Database for tracked ecosystems |
| `aeon-self-improve` | Productivity | Improve the agent itself — better skills, prompts, workflows, and config based on recent performance |
| `aeon-skill-evals` | Productivity | Evaluate skill output quality against assertion manifests — detects regressions before users notice |
| `aeon-skill-health` | Productivity | Audit skill quality metrics, detect API degradation, and report health trends |
| `aeon-skill-leaderboard` | Productivity | Weekly ranking of which skills are most popular across all active forks |
| `aeon-skill-repair` | Productivity | Diagnose and fix failing or degraded skills automatically |
| `aeon-skill-security-scan` | Dev | Audit imported skills for shell injection, secret exfiltration, path traversal, and prompt injection before they run |
| `aeon-skill-update-check` | Productivity | Check imported skills for upstream changes and security regressions since the version in skills.lock |
| `aeon-smithery-manifest` | Productivity | Auto-generate Smithery + MCP Registry submission docs from skills.json and the aeon-mcp server |
| `aeon-spawn-instance` | Dev | Clone this Aeon agent into a new GitHub repo — fork, configure skills, register in fleet |
| `aeon-star-milestone` | Dev | Announces when a watched repo crosses a star-count milestone (100, 150, 200, 250, 500, 1000, ...) with a highlight reel of recent work |
| `aeon-startup-idea` | Productivity | 2 startup ideas tailored to the user's skills, interests, and context |
| `aeon-technical-explainer` | Research | Generate a visual technical explanation of a recent topic using Replicate for the hero image |
| `aeon-telegram-digest` | Research | Digest of recent posts from tracked public Telegram channels |
| `aeon-thread-formatter` | Social | Score the day's events from memory/logs and format the top one as a 5-tweet thread ready to paste |
| `aeon-token-alert` | Crypto | Notify on price or volume anomalies for tracked tokens |
| `aeon-token-movers` | Crypto | Top movers, losers, and trending coins from CoinGecko |
| `aeon-token-pick` | Crypto | One token recommendation and one prediction market pick based on live data |
| `aeon-token-report` | Crypto | Daily price performance report for the project's token — price, volume, liquidity, and context |
| `aeon-tool-builder` | Productivity | Build automation scripts from action-converter suggestions and recurring manual tasks |
| `aeon-treasury-info` | Crypto | Show holdings overview for a wallet using Bankr API with block explorer fallback |
| `aeon-tweet-roundup` | Social | Gist of the latest tweets on configurable topics |
| `aeon-unlock-monitor` | Crypto | Weekly token unlock and vesting tracker — flag major supply events before they move markets |
| `aeon-update-gallery` | Productivity | Sync articles, activity logs, and memory to the GitHub Pages site |
| `aeon-vercel-projects` | Dev | Catalog all Vercel projects with deployment status, domains, and framework info |
| `aeon-vibecoding-digest` | Research | Monitor r/vibecoding for trending posts, interesting discussions, and notable projects shipped |
| `aeon-vuln-scanner` | Dev | Fork trending repos, audit for security vulnerabilities, and PR fixes |
| `aeon-weekly-review` | Productivity | Synthesize the week's logs into a structured retrospective |
| `aeon-weekly-shiplog` | Productivity | Weekly narrative of everything shipped — features, fixes, and momentum, written as a compelling update |
| `aeon-workflow-security-audit` | Dev | Audit .github/workflows/ for script injection, over-permissioning, unverified actions, and secret exposure. Auto-fixes critical findings and opens a PR. |
| `aeon-write-tweet` | Social | Generate 10 tweet drafts across 5 size tiers (2 variations each) on a topic from today's outputs |

## Install instructions for end users

```bash
# 1. Clone Aeon and build the MCP server
git clone https://github.com/aaronjmars/aeon
cd aeon/mcp-server && npm install && npm run build
```

```jsonc
// 2. Add to Claude Desktop config
//    macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
//    Linux:   ~/.config/Claude/claude_desktop_config.json
//    Windows: %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "aeon": {
      "command": "node",
      "args": ["/absolute/path/to/aeon/mcp-server/dist/index.js"]
    }
  }
}
```

3. Restart Claude Desktop. All 95 Aeon skills appear as `aeon-<slug>` tools.

## Notes for the maintainer

- The `aeon-mcp` npm package referenced by `packages[0].identifier` in `smithery-manifest.json` is **not yet published**. Either publish it (`cd mcp-server && npm publish --access public`) or remove the `packages` block before submitting to the MCP Registry. Smithery's URL-based listing works without the npm publish.
- This document is regenerated by the `smithery-manifest` skill — re-run after every `skills.json` change to keep the tool catalog accurate.
- Category breakdown: Dev (30), Productivity (24), Research (17), Crypto (16), Social (8).

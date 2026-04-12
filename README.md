<p align="center">
  <img src="assets/aeon.jpg" alt="Aeon" width="120" />
</p>

<h1 align="center">AEON</h1>

<p align="center">
  <strong>Background intelligence that evolves with you.</strong><br>
  Autonomous agent on GitHub Actions, powered by Claude Code. 68 skills across research, dev tooling, crypto monitoring, and productivity — all off by default, enable what you need.
</p>

<p align="center">
  <img src="assets/aeon.gif" alt="Aeon Demo" />
</p>

---

## Why this over OpenClaw?

[OpenClaw](https://github.com/openclaw/openclaw) is great if you need real-time responses and have infra to run it on. Aeon is for everything else:

- **Cheaper** — runs on GitHub Actions, free for public repos, ~$2/mo otherwise. No server.
- **Built for background tasks** — digests, monitoring, research, writing. You don't need sub-second latency for any of that.
- **Doesn't break** — no daemon to crash, no process to restart. If GitHub Actions is up, Aeon is up. Failed skill? Next cron tick retries it.
- **5-minute setup** — fork, add secrets, flip skills on. No Docker, no self-hosting, no config files beyond one YAML.

![OpenClaw vs Aeon](./assets/openclaw.jpg)

---

## Quick start

```bash
git clone https://github.com/aaronjmars/aeon
cd aeon && ./aeon
```

Click on `http://localhost:5555` to open the dashboard in your browser. From there:

1. **Authenticate** — add your Claude API key or OAuth token
2. **Add a channel** — set up [Telegram, Discord, or Slack](#notifications) so Aeon can talk to you (and you can talk back)
3. **Pick skills** — toggle on what you want, set a schedule, and optionally set a `var` to focus each skill
4. **Push** — one click commits and pushes your config to GitHub, Actions takes it from there

You can also schedule and trigger skills by messaging Aeon directly on Telegram — just tell it what you want.

<p align="center">
  <img src="assets/tg.png" alt="Telegram" width="400" />
</p>

---

## Authentication

Set **one** of these — not both:

| Secret | What it is | Billing |
|--------|-----------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token from your Claude Pro/Max subscription | Included in plan |
| `ANTHROPIC_API_KEY` | API key from console.anthropic.com | Pay per token |

**Getting an OAuth token:**
```bash
claude setup-token   # opens browser → prints sk-ant-oat01-... (valid 1 year)
```

### Bankr Gateway (optional)

Route all Claude Code requests through [Bankr LLM Gateway](https://docs.bankr.bot/llm-gateway/overview) for multi-model access and cost optimization. Bankr routes Claude through Vertex AI (~67% cheaper for Opus) and adds access to Gemini, GPT, Kimi, and Qwen models through a single API.

**Setup:**

1. Get an API key at [bankr.bot/api](https://bankr.bot/api)
2. Top up credits at [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits) (USDC, ETH, or BNKR on Base)
3. Add `BANKR_LLM_KEY` as a repo secret (value: `bk_your_key`)
4. Set the gateway provider in `aeon.yml`:

```yaml
gateway:
  provider: bankr
```

**Key Permissions:** Your API key must have **LLM Gateway** enabled at [bankr.bot/api](https://bankr.bot/api). The Read Only toggle only affects the Agent API — LLM Gateway access is always available when enabled. A key used only for LLM Gateway doesn't need Agent API enabled. See [Access Control](https://docs.bankr.bot/llm-gateway/overview) for full details.

**Available models (via Bankr):**

| Provider | Models |
|----------|--------|
| Anthropic | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| Google | `gemini-3-pro`, `gemini-3-flash` |
| OpenAI | `gpt-5.2` |
| Moonshot AI | `kimi-k2.5` |
| Alibaba | `qwen3-coder` |

Non-Claude models are available in the workflow dispatch dropdown and per-skill model overrides when gateway is set to `bankr`. Set `provider: direct` (the default) to use the standard Anthropic API.

---

## Skills

![Skills](./assets/skills.jpg)

### Research & Content
| Skill | Description |
|-------|-------------|
| `article` | Research trending topics and write a publication-ready article |
| `digest` | Generate and send a daily digest on a configurable topic |
| `rss-digest` | Fetch, summarize, and deliver RSS feed highlights |
| `hn-digest` | Top Hacker News stories filtered by interests |
| `paper-digest` | Find and summarize new papers matching tracked research interests (via HF Papers API) |
| `paper-pick` | Find the one paper you should read today (via HF Papers API) |
| `last30` | Cross-platform 30-day social research — Reddit, X, HN, Polymarket, and the web clustered into one report |
| `deep-research` | Exhaustive multi-source synthesis on any topic — far beyond a digest |
| `technical-explainer` | Visual technical explanation of a topic with AI-generated hero image |
| `tweet-digest` | Aggregate and summarize tweets from tracked accounts |
| `list-digest` | Top tweets from tracked X lists in the past 24 hours |
| `research-brief` | Deep dive on a topic combining web search, papers, and synthesis |
| `fetch-tweets` | Search X/Twitter for tweets by keyword, username, or both |
| `reddit-digest` | Fetch and summarize top Reddit posts from tracked subreddits |
| `security-digest` | Monitor recent security advisories from GitHub Advisory DB |

### Dev & Code
| Skill | Description |
|-------|-------------|
| `pr-review` | Auto-review open PRs on watched repos and post summary comments |
| `github-monitor` | Watch repos for stale PRs, new issues, and new releases |
| `github-issues` | Check all your repos for new open issues in the last 24 hours |
| `issue-triage` | Label and prioritize new GitHub issues on watched repos |
| `changelog` | Generate a changelog from recent commits across watched repos |
| `code-health` | Weekly report on TODOs, dead code, and test coverage gaps |
| `skill-security-scan` | Audit imported skills for shell injection, secret exfiltration, and prompt injection |
| `github-trending` | Top 10 trending repos on GitHub right now |
| `push-recap` | Daily deep-dive recap of all pushes — reads diffs, explains what changed and why |
| `repo-pulse` | Daily report on new stars, forks, and traffic for watched repos |
| `repo-article` | Write an article about the current state and progress of a watched repo |
| `repo-actions` | Generate actionable ideas to improve the repo — features, integrations, growth |
| `feature` | Build new features from GitHub issues or improve the agent |
| `build-skill` | Design and build a new reusable skill |
| `create-skill` | Generate a complete new skill from a one-line prompt |
| `autoresearch` | Evolve a skill by generating variations, evaluating them, and keeping the best version |
| `search-skill` | Search the open agent skills ecosystem for useful skills to install |
| `auto-workflow` | Analyze a URL and generate a tailored `aeon.yml` schedule with skill suggestions |
| `spawn-instance` | Clone this Aeon agent into a new repo — fork, configure skills, register in fleet |
| `fleet-control` | Monitor managed Aeon instances — check health, dispatch skills, aggregate status |
| `fork-fleet` | Inventory active forks, detect diverged work, surface upstream contribution candidates |

### Crypto / On-chain
| Skill | Description |
|-------|-------------|
| `token-alert` | Notify on price or volume anomalies for tracked tokens |
| `token-movers` | Top 10 token winners and losers by 24h price change from CoinGecko |
| `trending-coins` | Top trending and most searched coins on CoinGecko |
| `wallet-digest` | Summarize recent wallet activity across tracked addresses |
| `on-chain-monitor` | Monitor blockchain addresses and contracts for notable activity |
| `defi-monitor` | Check pool health, positions, and yield rates for tracked protocols |
| `defi-overview` | Daily overview of DeFi activity from DeFiLlama — TVL, top chains, top protocols |
| `polymarket` | Trending and top markets on Polymarket — volume, new markets, biggest movers |
| `monitor-polymarket` | Monitor specific prediction markets for 24h price moves, volume changes, and comments |
| `monitor-runners` | Top 5 tokens that ran hardest in the past 24h across major chains via GeckoTerminal |
| `token-pick` | One token recommendation and one prediction market pick based on live data |
| `treasury-info` | Wallet holdings overview via Bankr API with block explorer fallback |
| `distribute-tokens` | Send tokens to contributors via Bankr Agent API (supports Twitter handles and EVM addresses) |

### Social & Writing
| Skill | Description |
|-------|-------------|
| `write-tweet` | Generate 10 tweet drafts across 5 size tiers on a topic from today's outputs |
| `reply-maker` | Generate two reply options for 5 tweets from tracked accounts or topics |
| `remix-tweets` | Fetch 10 random past tweets and craft 10 rephrased versions in your voice |
| `refresh-x` | Fetch a tracked X/Twitter account's latest tweets and save the gist to memory |

### Productivity
| Skill | Description |
|-------|-------------|
| `morning-brief` | Aggregated daily briefing — digests, priorities, and what's ahead |
| `daily-routine` | Morning briefing combining token movers, tweet roundup, paper pick, GitHub issues, and HN digest |
| `weekly-review` | Synthesize the week's logs into a structured retrospective |
| `goal-tracker` | Compare current progress against goals stored in `MEMORY.md` |
| `idea-capture` | Quick note capture triggered via Telegram — stores to memory |
| `action-converter` | 5 concrete real-life actions for today based on recent signals and memory |
| `startup-idea` | 2 startup ideas tailored to your skills, interests, and context |

### Meta / Agent
| Skill | Description |
|-------|-------------|
| `heartbeat` | Proactive ambient check — surface anything worth attention |
| `memory-flush` | Promote important recent log entries into `MEMORY.md` |
| `reflect` | Review recent activity, consolidate memory, and prune stale entries |
| `skill-health` | Audit skill quality metrics, detect API degradation, and report health trends |
| `self-review` | Weekly audit of what Aeon did, what failed, and what to improve |
| `cost-report` | Weekly API cost report — token usage per skill and model with trends |
| `rss-feed` | Generate an Atom XML feed from articles in the repo |
| `update-gallery` | Sync articles, activity logs, and memory to the GitHub Pages site |

---

## GitHub Pages Gallery

Aeon publishes articles to a browsable gallery via GitHub Pages. After merging, enable it in **Settings → Pages** → source `Deploy from a branch`, branch `main`, folder `/docs`.

The gallery will be live at `https://<username>.github.io/aeon`.

The site includes three sections:
- **Articles** — published content from content-generating skills
- **Activity** (`/activity/`) — daily log of everything Aeon does: skills run, files created, notifications sent
- **Memory** (`/memory/`) — current goals, active topics, and topic deep-dives synced from `memory/`

The `update-gallery` skill syncs `articles/*.md` → `docs/_posts/` with proper Jekyll frontmatter on a weekly schedule. Site data (logs, memory, topics) is synced via `scripts/sync-site-data.sh`. Enable `update-gallery` in `aeon.yml` to keep the gallery up to date automatically.

---

## RSS Feed

Subscribe to Aeon's article output via Atom feed:

```
https://raw.githubusercontent.com/<owner>/<repo>/main/articles/feed.xml
```

Add this URL to any RSS reader (Feedly, Miniflux, NetNewsWire, etc.) to get new articles as they're published. The feed is regenerated daily or after each content-generating skill runs.

---

## Heartbeat

The only skill enabled by default. Runs every 3 hours as a fallback catch-all.

Every run: reads recent memory and logs, checks for stalled PRs (>24h), flagged memory items, urgent issues, and skills that haven't run on schedule. Deduplicates against the last 48h of logs — it won't re-notify you about something it already flagged.

Nothing to report → logs `HEARTBEAT_OK`, exits, no commit. Something needs attention → sends a concise notification.

Heartbeat is listed last in `aeon.yml` so it only runs when no other skill claims the slot.

---

## Configuration

All scheduling lives in `aeon.yml`:

```yaml
skills:
  article:
    enabled: true               # flip to activate
    schedule: "0 8 * * *"       # daily at 8am UTC
  digest:
    enabled: true
    schedule: "0 14 * * *"
    var: "solana"               # topic for this skill
```

Standard cron format. All times UTC. Supports `*`, `*/N`, exact values, comma lists.

**Order matters** — the scheduler picks the first matching skill. Put day-specific skills (e.g. Monday-only) before daily ones. Heartbeat goes last.

### The `var` field

Every skill accepts a single `var` — a universal input that each skill interprets in its own way:

| Skill type | What `var` does | Example |
|-----------|----------------|---------|
| Research & content | Sets the topic | `var: "rust"` → digest about Rust |
| Dev & code | Narrows to a repo | `var: "owner/repo"` → only review that repo's PRs |
| Crypto | Focuses on a token/wallet | `var: "solana"` → only check SOL price |
| Productivity | Sets the focus area | `var: "shipping v2"` → morning brief emphasizes v2 |

If `var` is empty, each skill falls back to its default behavior (scan everything, auto-pick topics, etc.). Set it from the dashboard or pass it when triggering manually.

### Model selection

The default model for all skills is set in `aeon.yml`:

```yaml
model: claude-opus-4-6
```

You can change it from the dashboard header dropdown. Options: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`. Per-run overrides are also available via workflow dispatch.

### Skill Chaining

Skills can be chained together so outputs flow between them. Chains run as separate GitHub Actions workflow steps via `chain-runner.yml`.

```yaml
chains:
  morning-pipeline:
    schedule: "0 7 * * *"
    on_error: fail-fast       # or: continue
    steps:
      - parallel: [token-movers, hn-digest]    # run concurrently
      - skill: morning-brief                   # runs after parallel group
        consume: [token-movers, hn-digest]     # gets their outputs injected
```

How it works:
1. Each step runs as a separate workflow dispatch
2. After each skill completes, its output is saved to `.outputs/{skill}.md`
3. Downstream steps with `consume:` get prior outputs injected into context
4. Steps can run in parallel or sequentially
5. `on_error: fail-fast` aborts the chain on any failure; `continue` keeps going

Define chains in `aeon.yml` alongside your skills. The scheduler dispatches them on their own cron schedule.

---

### Instance Fleet

Aeon can spawn and manage copies of itself. Use this to run specialized instances — one for crypto monitoring, another for research, etc.

| Skill | What it does |
|-------|-------------|
| `spawn-instance` | Fork this repo into a new purpose-built instance with pre-selected skills |
| `fleet-control` | Health checks, skill dispatch, and status reports across all managed instances |
| `fork-fleet` | Scan community forks for interesting diverged work worth upstreaming |

**Spawning a new instance:**
```
var: "crypto-tracker: monitor DeFi protocols and token movements"
```

The skill forks the repo, selects relevant skills based on the purpose, writes a `SETUP.md` with activation instructions, and registers it in `memory/instances.json`. The new instance is inert until the owner adds their own API keys — no secrets are propagated.

**Fleet control** runs twice daily by default (9am, 3pm UTC). It checks each instance's health, flags stale or degraded instances, and can dispatch skills remotely:
```
var: "dispatch crypto-tracker token-movers"
var: "status"
```

---

### Changing check frequency

Edit `.github/workflows/messages.yml`:

```yaml
schedule:
  - cron: '*/5 * * * *'    # every 5 min (default)
  - cron: '*/15 * * * *'   # every 15 min (saves Actions minutes)
  - cron: '0 * * * *'      # hourly (most conservative)
```

Claude only installs and runs when a skill actually matches.

---

## GitHub Actions cost

| Scenario | Cost |
|----------|------|
| No skill matched (most ticks) | ~10s — checkout + bash + exit |
| Skill runs | 2–10 min depending on complexity |
| Heartbeat (nothing found) | ~2 min |
| **Public repo** | **Unlimited free minutes** |

To reduce usage: switch to `*/15` or hourly cron, disable unused skills, keep the repo public.

| Plan | Free minutes/mo | Overage |
|------|----------------|---------|
| Free | 2,000 | N/A (private only) |
| Pro / Team | 3,000 | $0.008/min |

---

## Notifications

Set the secret → channel activates. No code changes needed.

| Channel | Outbound | Inbound |
|---------|---------|---------|
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Same |
| Discord | `DISCORD_WEBHOOK_URL` | `DISCORD_BOT_TOKEN` + `DISCORD_CHANNEL_ID` |
| Slack | `SLACK_WEBHOOK_URL` | `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` |
| Email | `SENDGRID_API_KEY` + `NOTIFY_EMAIL_TO` | — |

**Telegram:** Create a bot with @BotFather → get token + chat ID.  
**Discord:** Outbound: Channel → Integrations → Webhooks → Create. Inbound: discord.com/developers → bot → add `channels:history` scope → copy token + channel ID.  
**Slack:** api.slack.com → Create App → Incoming Webhooks → install → copy URL. Inbound: add `channels:history`, `reactions:write` scopes → copy bot token + channel ID.  
**Email:** sendgrid.com/settings/api_keys → Create API Key (Mail Send permission) → add as `SENDGRID_API_KEY`. Set `NOTIFY_EMAIL_TO` to your recipient address. Optional: set repository variable `NOTIFY_EMAIL_FROM` (default: `aeon@notifications.aeon.bot`) and `NOTIFY_EMAIL_SUBJECT_PREFIX` (default: `[Aeon]`).

### Telegram instant mode (optional)

Default polling has up to 5-min delay. Deploy this ~20-line Cloudflare Worker for ~1s response:

```js
export default {
  async fetch(request, env) {
    const { message } = await request.json();
    if (!message?.text || String(message.chat.id) !== env.TELEGRAM_CHAT_ID)
      return new Response("ignored");

    // Advance offset so polling doesn't reprocess
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${message.update_id + 1}`);

    // Trigger GitHub Actions immediately
    await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: "POST",
      headers: { Authorization: `token ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
      body: JSON.stringify({ event_type: "telegram-message", client_payload: { message: message.text } }),
    });

    return new Response("ok");
  },
};
```

Set env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_REPO`, `GITHUB_TOKEN`) in Cloudflare dashboard, then point your bot's webhook at the worker URL.

---

## Cross-repo access

The built-in `GITHUB_TOKEN` is scoped to this repo only. For `github-monitor`, `pr-review`, `issue-triage`, and `feature` to work on your other repos, add a `GH_GLOBAL` personal access token.

| | `GITHUB_TOKEN` | `GH_GLOBAL` |
|--|--------------|------------|
| Scope | This repo | Any repo you grant |
| Created by | GitHub (automatic) | You (manual) |
| Lifetime | Job duration | Up to 1 year |

**Setup:** github.com/settings/tokens → Fine-grained → set repo access → grant Contents, Pull requests, Issues (all read/write) → add as `GH_GLOBAL` secret.

Skills use `GH_GLOBAL` when available, fall back to `GITHUB_TOKEN` automatically.

---

## Adding skills

### Install external skills

```bash
./add-skill BankrBot/skills --list          # browse a repo's skills
./add-skill BankrBot/skills bankr hydrex   # install specific skills
./add-skill BankrBot/skills --all           # install everything
```

Or discover programmatically:
```bash
npx skills find "crypto trading"
```

Installed skills land in `skills/` and are added to `aeon.yml` disabled. Flip `enabled: true` to activate.

### Install individual skills from Aeon

Every skill in this repo is independently installable. Browse the full catalog in [`skills.json`](skills.json) or use the CLI:

```bash
# Install a single skill
./add-skill aaronjmars/aeon token-alert

# Install multiple skills
./add-skill aaronjmars/aeon token-alert polymarket hn-digest

# Install everything
./add-skill aaronjmars/aeon --all

# Browse available skills
./add-skill aaronjmars/aeon --list
```

### Export a skill for distribution

Package any skill as a standalone directory (with a generated README) for sharing:

```bash
./export-skill token-alert              # exports to ./exports/token-alert/
./export-skill token-alert --tar        # also creates a .tar.gz archive
./export-skill --list                   # list all exportable skills
```

### Trigger feature builds from issues

Label any GitHub issue `ai-build` → workflow fires → Claude reads the issue, implements it, opens a PR.

---

## Use as GitHub Agentic Workflow

Don't need the full agent? Grab individual workflow templates and drop them into any repo. These work with [GitHub Agentic Workflows](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/) — plain Markdown files in `.github/workflows/` that run with any supported agent engine.

| Template | What it does | Trigger |
|----------|-------------|---------|
| [issue-triage.md](workflows/issue-triage.md) | Auto-label and prioritize new issues | On issue opened |
| [pr-review.md](workflows/pr-review.md) | Review PRs for bugs, security, and quality | On PR opened/updated |
| [changelog.md](workflows/changelog.md) | Categorized changelog from recent commits | Weekly |
| [security-digest.md](workflows/security-digest.md) | Monitor advisories for your dependencies | Daily |
| [code-health.md](workflows/code-health.md) | Audit TODOs, dead code, test gaps | Weekly |

```bash
# Copy a template into your repo
curl -O https://raw.githubusercontent.com/aaronjmars/aeon/main/workflows/pr-review.md
mv pr-review.md .github/workflows/
git add .github/workflows/pr-review.md && git commit -m "Add PR review workflow"
```

Each template is self-contained Markdown — edit the trigger, criteria, or format to fit your project. See [`workflows/README.md`](workflows/README.md) for details.

---

## Soul (optional)

By default Aeon has no personality. To make it write and respond like you, add a soul:

1. Fork [soul.md](https://github.com/aaronjmars/soul.md) and fill in your files:
   - `SOUL.md` — identity, worldview, opinions, interests
   - `STYLE.md` — voice, sentence patterns, vocabulary, tone
   - `examples/good-outputs.md` — 10–20 calibration samples
2. Copy into your Aeon repo under `soul/`
3. Add to the top of `CLAUDE.md`:

```markdown
## Identity

Read and internalize before every task:
- `soul/SOUL.md` — identity and worldview
- `soul/STYLE.md` — voice and communication patterns
- `soul/examples.md` — calibration examples

Embody this identity in all output. Never hedge with "as an AI."
```

Every skill reads `CLAUDE.md`, so identity propagates automatically.

**Quality check:** soul files work when they're specific enough to be wrong. *"I think most AI safety discourse is galaxy-brained cope"* is useful. *"I have nuanced views on AI safety"* is not.

---

## Project structure

```
CLAUDE.md                ← agent identity (auto-loaded by Claude Code)
aeon.yml                 ← skill schedules, chains, and enabled flags
skills.json              ← machine-readable skill catalog (68 skills)
./notify                 ← multi-channel notifications
./add-skill              ← import skills from GitHub repos
./export-skill           ← package skills for standalone distribution
./generate-skills-json   ← regenerate skills.json from SKILL.md files
docs/                    ← GitHub Pages site (articles, activity log, memory)
soul/                    ← optional identity files
skills/                  ← each skill is SKILL.md (Agent Skills format)
  article/
  digest/
  heartbeat/
  ...                    ← 68 skills total
workflows/               ← GitHub Agentic Workflow templates (.md)
memory/
  MEMORY.md              ← goals, active topics, pointers
  instances.json         ← fleet registry (managed Aeon instances)
  topics/                ← detailed notes by topic
  logs/                  ← daily activity logs (YYYY-MM-DD.md)
.outputs/                ← skill chain outputs (passed between chained steps)
dashboard/               ← local web UI (modular components)
scripts/
  sync-site-data.sh      ← sync memory/logs to docs site data
.github/workflows/
  aeon.yml               ← skill runner (workflow_dispatch, issues)
  chain-runner.yml       ← skill chain executor
  scheduler.yml          ← cron-based chain scheduler
  messages.yml           ← message polling + scheduler (cron)
```

---

## Two-repo strategy

This repo is a public template. Run your own instance as a **private fork** so memory, articles, and API keys stay private.

```bash
# Pull template updates into your private fork
git remote add upstream https://github.com/aaronjmars/aeon.git
git fetch upstream
git merge upstream/main --no-edit
```

Your `memory/`, `articles/`, and personal config won't conflict — they're in files that don't exist in the template.

---

## Troubleshooting

**Messages not being picked up?**

GitHub has two requirements for scheduled workflows:
1. The workflow file must be on the **default branch** — crons on feature branches don't fire.
2. The repo must have **recent activity** — GitHub disables crons on repos with no commits in 60 days. New template forks need one manual trigger to activate.

**Fix:** Actions → Messages → Run workflow (manual trigger). After that, the cron activates automatically.

---

Support the project : 0xbf8e8f0e8866a7052f948c16508644347c57aba3

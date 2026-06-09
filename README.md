<p align="center">
  <img src="assets/aeon.jpg" alt="Aeon" width="120" />
</p>

<h1 align="center">AEON</h1>

<p align="center">
  <a href="https://github.com/aaronjmars/aeon/stargazers"><img src="https://img.shields.io/github/stars/aaronjmars/aeon?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/aaronjmars/aeon/network/members"><img src="https://img.shields.io/github/forks/aaronjmars/aeon?style=flat-square&logo=github" alt="GitHub forks"></a>
  <a href="https://x.com/aeonframework"><img src="https://img.shields.io/badge/Follow-%40aeonframework-black?style=flat-square&logo=x&labelColor=000000" alt="Follow on X"></a>
  <a href="https://bankr.bot/discover/0xbf8e8f0e8866a7052f948c16508644347c57aba3"><img src="https://img.shields.io/badge/Aeon%20on-Bankr-orange?style=flat-square&labelColor=1a1a2e" alt="Aeon on Bankr"></a>
</p>

<p align="center">
  <strong>The most autonomous agent framework.</strong><br>
  Give it a direction — it'll use 196 skills (deep research, PR reviews, market monitoring, Vercel deploys…) to get it done. No approval loops. No babysitting. Configure once, forget forever.
</p>

<p align="center">
  <img src="assets/aeon-demo.gif" alt="Aeon Demo" />
</p>

---

## Quick start

You need three things:

1. **Node.js 20+** — check with `node -v`. Missing or too old? Grab the LTS installer from [nodejs.org](https://nodejs.org/en/download), or use a package manager: `brew install node` (macOS), `winget install OpenJS.NodeJS.LTS` (Windows), [nvm](https://github.com/nvm-sh/nvm) or your distro's package manager (Linux).
2. **[GitHub CLI](https://cli.github.com/) (`gh`), authenticated** — the dashboard uses it for everything (secrets, workflows), and `./aeon` checks it before starting. Install: `brew install gh` (macOS), `winget install --id GitHub.cli` (Windows), [per-distro instructions](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) (Linux). Then run `gh auth login` and follow the prompts.
3. **Your own fork of this repo** — click the **Fork** button at the top of [the repo page](https://github.com/aaronjmars/aeon) (keep it public — Actions minutes are free on public repos), or run `gh repo fork aaronjmars/aeon --clone`. Then point `gh` at it once: `gh repo set-default <you>/aeon`.

```bash
git clone https://github.com/<you>/aeon   # skip if you used `gh repo fork --clone`
cd aeon && ./aeon
```

Open [http://localhost:5555](http://localhost:5555) and follow the four steps:

1. **Authenticate** — connect your Claude Pro/Max subscription, or paste an API key (Anthropic, Anthropic-compatible, or a Bankr `bk_…` key from [bankr.bot/api-keys](https://bankr.bot/api-keys) — routed automatically).
2. **Add a channel** — [Telegram, Discord, or Slack](#notifications) so Aeon can talk to you.
3. **Pick skills** — toggle what you want, set schedules. Each skill shows the API keys and MCP servers it needs, with one-click setup.
4. **Run** — hit **Run now** on any skill to try it immediately; API keys and `var`s apply directly, no push needed. When you change config (schedules, toggles), **Push** commits it to GitHub in one click so Actions runs it on cron.

That's it — Aeon now runs unattended. On a public repo, GitHub Actions minutes are **free**. Run `./onboard` anytime to verify your setup.

<details>
<summary><strong>No admin rights / can't install <code>gh</code>?</strong></summary>

Grab the `gh_*_macOS_arm64.zip` (or your platform's binary) from [github.com/cli/cli/releases](https://github.com/cli/cli/releases) and drop it on your `PATH` (e.g. `~/.local/bin`). No installer, no sudo. Then `gh auth login`.

</details>

---

## What Aeon can do

![Skills](./assets/skills-aeon-193.jpg)

**196 skills across 8 categories.** Every skill is independently installable, schedulable, and chainable.

| Category | Count | Examples |
|----------|-------|----------|
| 🧬 **Core** | 15 | `skill-repair`, `autoresearch`, `spawn-instance`, `vuln-scanner` |
| 📚 **Research & Content** | 28 | `deep-research`, `paper-digest`, `hacker-news-digest` |
| 💻 **Dev & Code** | 37 | `pr-review`, `github-monitor`, `auto-merge` |
| 📈 **Crypto & Markets** | 29 | `token-alert`, `defi-monitor`, `polymarket`, `base-mcp` |
| 🛡️ **Onchain Security** | 15 | `rug-scan`, `contract-audit`, `honeypot-check` |
| ✍️ **Social & Writing** | 18 | `write-tweet`, `thread-writer`, `reply-maker` |
| ✅ **Productivity** | 19 | `morning-brief`, `weekly-review`, `goal-tracker` |
| 🤖 **Meta / Agent** | 35 | `heartbeat`, `cost-report`, `memory-flush` |

<details>
<summary><strong>Full catalog (all 196 skills)</strong></summary>

| Category | Skills |
|----------|--------|
| **Core** (15) | 🧬 `autoresearch`,`create-skill`,`skill-health`,`skill-repair`,`skill-evals`,`self-improve` · 🛰️ `spawn-instance`,`fleet-control`,`fleet-scorecard`,`contributor-reward`,`distribute-tokens` · 🤖 `external-feature`,`feature`,`deploy-prototype`,`vuln-scanner` |
| **Research & Content** (28) | `agent-displacement`,`ai-framework-watch`,`article`,`article-queue`,`beat-tracker`,`channel-recap`,`competitor-launch-radar`,`deep-research`,`digest`,`fetch-tweets`,`hacker-news-digest`,`huggingface-trending`,`last30`,`launch-radar`,`list-digest`,`mcp-pulse`,`narrative-convergence`,`paper-digest`,`paper-pick`,`reddit-digest`,`research-brief`,`rss-digest`,`security-digest`,`technical-explainer`,`telegram-digest`,`topic-momentum`,`tweet-digest`,`vibecoding-digest` |
| **Dev & Code** (37) | `auto-merge`,`auto-workflow`,`builder-map`,`changelog`,`code-health`,`disclosure-tracker`,`ecosystem-entrants`,`ecosystem-links`,`ecosystem-pulse`,`fork-cohort`,`fork-fleet`,`fork-release-tracker`,`github-issues`,`github-monitor`,`github-releases`,`github-trending`,`issue-triage`,`pr-merge-queue`,`pr-review`,`pr-skill-triage`,`pr-tracker`,`pr-triage`,`project-lens`,`push-recap`,`pvr-triage-monitor`,`pvr-watchlist`,`repo-actions`,`repo-article`,`repo-pulse`,`repo-revive`,`repo-scanner`,`search-skill`,`smithery-manifest`,`star-milestone`,`vercel-projects`,`vuln-tracker`,`workflow-security-audit` |
| **Crypto & Markets** (29) | `aixbt-pulse`,`base-mcp`,`compute-pulse`,`defi-monitor`,`defi-overview`,`fear-divergence-scout`,`liquidpad-launch`,`market-context-refresh`,`monitor-kalshi`,`monitor-polymarket`,`monitor-runners`,`narrative-tracker`,`on-chain-monitor`,`picks-tracker`,`pm-intel`,`pm-manipulation`,`pm-pulse`,`polymarket`,`polymarket-comments`,`price-threshold-alert`,`rwa-pulse`,`token-alert`,`token-movers`,`token-pick`,`token-report`,`treasury-info`,`unlock-monitor`,`wallet-digest`,`x402-monitor` |
| **Onchain Security** (15) | `approval-audit`,`contract-audit`,`deployer-trace`,`fund-flow`,`holder-concentration`,`honeypot-check`,`investigation-report`,`linked-wallets`,`lp-lock-check`,`rug-scan`,`tx-explain`,`vigil`,`vigil-revoke`,`wallet-profile`,`wallet-risk-weekly` |
| **Social & Writing** (18) | `agent-buzz`,`content-performance`,`create-campaign`,`engagement-act`,`farcaster-digest`,`mention-radar`,`product-hunt-launch`,`refresh-x`,`remix-tweets`,`reply-maker`,`schedule-ads`,`show-hn-draft`,`skill-of-the-day`,`syndicate-article`,`thread-formatter`,`thread-writer`,`tweet-roundup`,`write-tweet` |
| **Productivity** (19) | `action-converter`,`daily-routine`,`deal-flow`,`evening-recap`,`follow-up-patrol`,`goal-tracker`,`idea-capture`,`idea-pipeline`,`idea-validator`,`milestone-tracker`,`morning-brief`,`note-taking`,`reflect`,`reg-monitor`,`startup-idea`,`tool-builder`,`v4-readiness`,`weekly-review`,`weekly-shiplog` |
| **Meta / Agent** (35) | `api-health-probe`,`atrium-catalog-watcher`,`batch-health`,`capabilities-map`,`config-validator`,`contributor-spotlight`,`cost-report`,`fleet-skill-adoption`,`fleet-state`,`fork-contributor-leaderboard`,`fork-first-run-alert`,`fork-health-score`,`fork-skill-digest`,`fork-skill-gap`,`heartbeat`,`janitor`,`memory-flush`,`memory-structural-dedupe`,`onboard`,`operator-scorecard`,`run-frequency-guard`,`rss-feed`,`self-review`,`signal-verdict`,`skill-analytics`,`skill-enabler`,`skill-freshness`,`skill-graph`,`skill-leaderboard`,`skill-security-scan`,`skill-update-check`,`sparkleware-catalog`,`spend-monitor`,`star-momentum-alert`,`update-gallery` |

Full descriptions: [`skills.json`](skills.json) — or run `./add-skill aaronjmars/aeon --list`.
Dependency graph: [`docs/skill-graph.md`](docs/skill-graph.md) — a visual map of how skills connect.

</details>

### It heals itself

![Anatomy of a skill run](./assets/skill-run-aeon.jpg)

Every skill output is automatically scored 1–5 by Haiku after each run. Scores and failure flags (`api_error`, `stale_data`, `rate_limited`) are tracked per skill in `memory/skill-health/` with a rolling 30-run history. When something breaks, the loop fixes it without you:

![Self-healing architecture](./assets/architecture-aeon.jpg)

1. **`heartbeat`** (3x daily) — detects failed, stuck, or chronically broken skills
2. **`skill-health`** — audits quality scores and flags API degradation patterns
3. **`skill-evals`** — assertion-based output tests to catch regressions
4. **`skill-repair`** — diagnoses and patches failing skills automatically
5. **`self-improve`** — evolves prompts, config, and workflows based on performance

Health skills file issues, repair skills close them. `heartbeat` is the only skill enabled by default: nothing to report → silent; something needs attention → one notification. Deep dive: [`docs/CORE.md`](docs/CORE.md).

### It replicates

Aeon can spawn and manage copies of itself. `spawn-instance` forks the repo into a new specialized instance (`var: "crypto-tracker: monitor DeFi protocols"`), selects relevant skills, and registers it in `memory/instances.json` — no secrets propagated, billing stays isolated. `fleet-control` health-checks and dispatches across instances; `fleet-scorecard` tracks fleet economics daily.

### It ships real work

`external-feature` and `feature` ship code to watched repos unprompted. `deploy-prototype` generates and deploys live web apps to Vercel. `vuln-scanner` finds real vulnerabilities and discloses them responsibly. `autoresearch` evolves existing skills through scored variations, and `create-skill` generates new ones from a sentence.

### Add more skills

```bash
./add-skill aaronjmars/aeon --list        # browse the built-in catalog
./add-skill BankrBot/skills bankr hydrex  # install from any GitHub repo
./add-skill BankrBot/skills --all         # install everything from a repo
./export-skill token-alert                # package one for standalone use
```

Installed skills land in `skills/` and are added to `aeon.yml` disabled — flip `enabled: true` to activate. You can also:

- **Build your own** from [`skill-templates/`](skill-templates/TEMPLATE.md): `./new-from-template <template> <skill-name>`
- **Label any GitHub issue `ai-build`** — Claude reads the issue, implements it, and opens a PR
- **Install community packs** — see [Community skill packs](#community-skill-packs)

---

## Why "the most autonomous"?

Most agent tools put you in the driver's seat — approve this tool call, review this diff, confirm this action. Aeon is built for the work you want *done* while you're not there: morning briefs, market monitoring, PR reviews, research digests, security scans.

|  | Aeon | Claude Code | Hermes | OpenClaw |
|--|------|------------|--------|---------|
| Runs unattended on a schedule | Yes | No | Yes | No |
| Self-heals when skills fail | Yes | No | No | No |
| Monitors its own output quality | Yes | No | No | No |
| Persistent memory across runs | Yes | No | Limited | No |
| Reactive triggers (auto-responds to conditions) | Yes | No | No | No |
| Fixes its own broken skills | Yes | No | No | No |
| Zero infrastructure | Yes (GitHub Actions) | Local | Self-hosted | Self-hosted |
| Reasons about tasks | Yes | Yes | Yes | Yes |

**Other agents are interactive tools you use. Aeon is an autonomous system you configure and walk away from.** It decides when to run, what to check, and when to bother you. You still want Claude Code for writing code interactively — but for the 90% of recurring tasks that don't need you in the loop, the most autonomous agent is the one that never asks.

For a comparison against the broader ecosystem (AutoGen, CrewAI, n8n, LangGraph) and active forks in production, see [`SHOWCASE.md`](SHOWCASE.md). For products built on Aeon, see [`ECOSYSTEM.md`](ECOSYSTEM.md).

![Autonomy spectrum](./assets/autonomy-aeon.jpg)

---

## Configure

![Aeon never sleeps — a full day of autonomous runs](./assets/never-sleeps-aeon.jpg)

### Schedules

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

Standard cron format, all times UTC. Supports `*`, `*/N`, exact values, comma lists. **Order matters** — the scheduler picks the first matching skill, so put day-specific skills before daily ones and `heartbeat` last.

### The `var` field

Every skill accepts a single `var` — a universal input each skill interprets its own way:

| Skill type | What `var` does | Example |
|-----------|----------------|---------|
| Research & content | Sets the topic | `var: "rust"` → digest about Rust |
| Dev & code | Narrows to a repo | `var: "owner/repo"` → only review that repo's PRs |
| Crypto | Focuses on a token/wallet | `var: "solana"` → only check SOL price |
| Productivity | Sets the focus area | `var: "shipping v2"` → morning brief emphasizes v2 |

Empty `var` = the skill's default behavior (scan everything, auto-pick topics). Set it from the dashboard or pass it when triggering manually.

### Models

The default model for all skills is set in `aeon.yml` (or from the dashboard header dropdown):

```yaml
model: claude-opus-4-8
```

Options: `claude-opus-4-8`, `claude-fable-5`, `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`. Per-run overrides are available via workflow dispatch, and individual skills can override to optimize cost:

```yaml
skills:
  token-report: { enabled: true, schedule: "30 12 * * *", model: "claude-sonnet-4-6" }
```

### Authentication

Set **one** of these — not both:

| Secret | What it is | Billing |
|--------|-----------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token from your Claude Pro/Max subscription | Included in plan |
| `ANTHROPIC_API_KEY` | API key from console.anthropic.com | Pay per token |

```bash
claude setup-token   # opens browser → prints sk-ant-oat01-... (valid 1 year)
```

The dashboard's Authenticate modal handles both — and auto-routes Bankr `bk_…` keys (see [Bankr Gateway](#bankr-gateway-cheaper-opus)).

### Notifications

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
**Email:** sendgrid.com/settings/api_keys → Create API Key (Mail Send permission) → add as `SENDGRID_API_KEY`, set `NOTIFY_EMAIL_TO`. Optional repo variables: `NOTIFY_EMAIL_FROM` (default `aeon@notifications.aeon.bot`), `NOTIFY_EMAIL_SUBJECT_PREFIX` (default `[Aeon]`).

Want ~1s Telegram replies instead of up-to-5-min polling? See [Telegram instant mode](#telegram-instant-mode).

### API keys per skill

Skills that call third-party APIs declare their credentials in a `requires:` frontmatter list, so the dashboard shows **which skill needs which key**:

```yaml
requires: [XAI_API_KEY, COINGECKO_API_KEY?]   # bare = required · `?` = works better with
```

The dashboard surfaces this as an **API keys** panel on each skill (set/unset status, inline "Set" button), a ⚠ flag when an enabled skill is missing a required key, and a **"used by"** index under each key in Settings → Access Keys. Skills can likewise declare MCP servers with an `mcp:` list (`mcp: [base]`) — same two tiers, shown as a per-skill **MCP servers** panel with install state. Convention details: [`skill-templates/TEMPLATE.md`](skill-templates/TEMPLATE.md#declaring-api-keys-requires).

---

## Advanced

Everything below is optional — Aeon runs fine without any of it.

### Skill chaining

Chain skills so outputs flow between them. Chains run as separate GitHub Actions workflow steps via `chain-runner.yml`:

```yaml
chains:
  morning-pipeline:
    schedule: "0 7 * * *"
    on_error: fail-fast       # or: continue
    steps:
      - parallel: [token-movers, hacker-news-digest]  # run concurrently
      - skill: morning-brief                          # runs after parallel group
        consume: [token-movers, hacker-news-digest]   # gets their outputs injected
```

Each step runs as a separate workflow dispatch; outputs are saved to `.outputs/{skill}.md` and injected into downstream steps that `consume:` them. `fail-fast` aborts on any failure, `continue` keeps going.

### Reactive triggers

Skills with `schedule: "reactive"` fire on conditions, not cron. The scheduler evaluates triggers after processing cron skills:

```yaml
reactive:
  skill-repair:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }
```

### Scheduler frequency

Edit `.github/workflows/messages.yml`:

```yaml
schedule:
  - cron: '*/5 * * * *'    # every 5 min (default)
  - cron: '*/15 * * * *'   # every 15 min (saves Actions minutes)
  - cron: '0 * * * *'      # hourly (most conservative)
```

Claude only installs and runs when a skill actually matches — non-matching ticks cost ~10s.

### MCP servers in skill runs

Let skills **call** MCP servers (GitHub, a database, a paid API, your own) while they run in GitHub Actions. Opt-in and safe — with no `.mcp.json` at the repo root, runs are byte-identical to before.

```bash
cp .mcp.json.example .mcp.json   # then edit, commit, push
```

The example ships two working servers — `github` (uses the runner's built-in `GITHUB_TOKEN`) and `sequential-thinking` (no-auth stdio). On the next run, the runner loads `.mcp.json` and auto-allows every server's tools, so a skill can just say *"use the github MCP server to …"*.

Or skip the file entirely: the dashboard's **MCP** tab writes `.mcp.json` for you, lists **Featured** servers (e.g. [Base](https://mcp.base.org)) for one-click install, and tells you which secret each server needs.

**Servers that need a secret** — reference it with `${VAR}`, never commit the value:

```json
"acme": {
  "type": "http",
  "url": "https://mcp.acme.dev/v1",
  "headers": { "Authorization": "Bearer ${ACME_API_KEY}" }
}
```

Then just **set the secret** (dashboard MCP tab inline, Settings → Add Credential, or `gh secret set ACME_API_KEY`) — the runner auto-resolves any `${VAR}` your `.mcp.json` references from the repo's secrets, with zero workflow editing. If a referenced secret isn't set, the runner skips MCP for that run and logs a warning instead of breaking the skill.

Notes: scope is global (`.mcp.json` applies to every skill); add `"alwaysLoad": true` to force a server's tools into context every run; stdio servers run as local processes in the runner, HTTP/SSE servers are reached over the network.

### Use Aeon's skills from Claude or any agent (MCP & A2A)

Aeon skills work outside GitHub Actions too — locally via `claude -p -`, identical to Actions. API keys are read from your environment or a `.env` file in the repo root.

**Claude (MCP)** — every skill appears as an `aeon-<name>` tool in Claude Desktop and Claude Code:

```bash
./add-mcp                    # build and register
./add-mcp --desktop          # also print Claude Desktop config
./add-mcp --uninstall        # remove
```

**Any AI agent (A2A)** — [Google's A2A protocol](https://google.github.io/A2A/) lets LangChain, AutoGen, CrewAI, OpenAI Agents SDK, and Vertex AI invoke skills via HTTP:

```bash
./add-a2a                    # starts on port 41241
./add-a2a --print-config     # LangChain/Python client examples
```

Working client scripts for every supported stack (LangChain, AutoGen, CrewAI, OpenAI Agents SDK, MCP stdio, Claude Desktop) live in [`examples/`](examples/) — each <100 lines, calling a real skill end-to-end. Start with [`examples/README.md`](examples/README.md).

### Cross-repo access

The built-in `GITHUB_TOKEN` is scoped to this repo only. For `github-monitor`, `pr-review`, `issue-triage`, and `external-feature` to work on your other repos, add a `GH_GLOBAL` personal access token: github.com/settings/tokens → Fine-grained → set repo access → grant Contents, Pull requests, Issues (read/write) → add as `GH_GLOBAL` secret. Skills use it when available and fall back to `GITHUB_TOKEN` automatically.

### Bankr Gateway (cheaper Opus)

Route requests through [Bankr LLM Gateway](https://docs.bankr.bot/llm-gateway/overview) for ~67% cheaper Opus (via Vertex AI), plus gateway access to Gemini, GPT, Kimi, and Qwen models (set the model id manually in `aeon.yml`).

Get a key at [bankr.bot/api-keys](https://bankr.bot/api-keys), top up credits, and paste it in the dashboard's Authenticate modal — `bk_…` keys are saved as `BANKR_LLM_KEY` and `gateway: { provider: bankr }` is set automatically. Removing the key reverts the gateway to `direct`.

### Soul

By default Aeon has no personality. To make it write and respond like you:

1. Fork [soul.md](https://github.com/aaronjmars/soul.md) and fill in `SOUL.md` (identity, worldview), `STYLE.md` (voice, vocabulary), and `examples/good-outputs.md` (10–20 calibration samples)
2. Copy into your Aeon repo under `soul/`
3. Add an `## Identity` section at the top of `CLAUDE.md` telling Aeon to read and embody them

Every skill reads `CLAUDE.md`, so identity propagates automatically. **Quality check:** soul files work when they're specific enough to be wrong. *"I think most AI safety discourse is galaxy-brained cope"* is useful; *"I have nuanced views on AI safety"* is not.

### Publishing (GitHub Pages & RSS)

Aeon publishes articles to a GitHub Pages gallery and an RSS feed.

- **Pages:** Settings → Pages → source `Deploy from a branch`, branch `main`, folder `/docs`. The site lives at `https://<username>.github.io/aeon`; the `update-gallery` skill keeps it in sync.
- **RSS:** Subscribe at `https://raw.githubusercontent.com/<owner>/<repo>/main/articles/feed.xml` — regenerated after each content skill runs.

### Telegram instant mode

Default polling has up to a 5-min delay. Deploy the self-contained Cloudflare Worker in [`apps/webhook/`](apps/webhook/) for ~1s response time — one click, into your own Cloudflare account (no shared infra, no credential custody):

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/aaronjmars/aeon/tree/main/apps/webhook)

Setup details in [`apps/webhook/README.md`](apps/webhook/README.md). The poller skips Telegram automatically once a webhook is active, so the two never conflict.

### Remote dashboard access

The dashboard's `/api/*` routes drive `gh workflow run` and read/write repo secrets, so they're gated to loopback callers by default — no remote callers, no DNS-rebinding from a malicious page. To reach the dashboard from another machine or over a tunnel (Tailscale, ngrok, reverse proxy):

| Env var | Behaviour |
|---|---|
| `AEON_DASHBOARD_ALLOWED_HOSTS=aeon.local,box.tail-xxx.ts.net` | Extends the loopback allowlist by hostnames (comma-separated, case- and port-insensitive) |
| `AEON_DASHBOARD_ALLOW_ANY_HOST=1` | Disables Host-header checking entirely. Only for a trusted reverse proxy that terminates `Host` upstream — loudly insecure otherwise |

The gate also rejects state-changing requests whose `Origin` isn't allowlisted, so a malicious page can't drive `/api/secrets` via a no-cors POST. Code: [`apps/dashboard/proxy.ts`](apps/dashboard/proxy.ts) + [`apps/dashboard/lib/security/api-gate.ts`](apps/dashboard/lib/security/api-gate.ts).

### Fleet Watcher (authorization layer)

Add inline ALLOW/BLOCK authorization in front of every skill run. Each workflow asks your self-hosted [Fleet Watcher](https://github.com/yourorg/fleet-watcher) control plane *"is this allowed?"* before Claude starts and reports the outcome after. BLOCK = workflow exits non-zero, Claude never runs, audit ref recorded.

Already wired into `.github/workflows/aeon.yml` as two opt-in steps. To enable: stand up Fleet Watcher, mint a token via `POST /api/aeon/register`, and add two secrets — `FLEET_ENDPOINT` (base URL) and `FLEET_TOKEN` (the `agnt_…` token). Define your red lines (per-skill caps, counterparty allowlists, dangerous-string patterns) in its dashboard.

If the secrets aren't set, both steps no-op — fully backward compatible. If Fleet is unreachable when they *are* set, the preflight fails closed (skill doesn't run); the postflight always runs so blocked skills are still recorded.

### Community skill packs

![Aeon Framework ecosystem map](./assets/ecosystem-aeon.jpg)

Third-party skill collections in their own repos, installable as one bundle:

```bash
./install-skill-pack baseddevoloper/aeon-skill-pack-vvvkernel
./install-skill-pack --list      # browse the registry (skill-packs.json)
```

The script reads the pack's `skills-pack.json` manifest, runs the security scanner on each `SKILL.md`, and copies approved skills into `skills/` (disabled in `aeon.yml`, provenance in `skills.lock`). Full schema and trust model: [`docs/community-skill-packs.md`](docs/community-skill-packs.md).

| Pack | Skills | Description |
|------|--------|-------------|
| [aeon-skill-pack-vvvkernel](https://github.com/baseddevoloper/aeon-skill-pack-vvvkernel) | 9 | Venice AI inference via VVVKernel — onchain, audit, growth, narrative, image gen, monitoring |
| [luca-aeon-skills](https://github.com/danbuildss/luca-aeon-skills) | 4 | Financial intelligence via x402Books AI — wallet scanning, treasury monitoring, financial reports, and agent registry on Base |
| [zer0-skill-pack](https://github.com/0xShak/zer0-skill-pack) | 6 | Polymarket intelligence — daily thesis, mispricing scanner, contrarian fades, narrative-vs-markets, paper-trade PnL journal, alpha comment curator |
| [gitbounty-skill-pack](https://github.com/gitlawbounty/gitbounty-skill-pack) | 1 | Bounty hunting on the gitlawb network via gitbounty — discover open bounties, scout the best fit with the gitbounty LLM scout, draft a solution plan (read-only) |
| [aeon-skills](https://github.com/AntFleet/aeon-skills) | 2 | Two-model-consensus PR review (Opus 4.7 + GPT-5) — channel drawdown for installed repos, x402 pay-per-call for public repos |
| [careful-finance-aeon-skill-pack](https://github.com/UIZorrot/careful-finance-aeon-skill-pack) | 1 | Careful Finance market intelligence — scan DeFi yield and perpetual-futures opportunities, then print or publish a conservative hourly snapshot |
| [aeon-skill-pack-liquidpad](https://github.com/liquidpadbot/aeon-skill-pack-liquidpad) | 4 | Track LiquidPad on Base — burn cycle alerts, new token launches with onchain provenance, daily protocol digest, and fee accrual tracking |
| [aeon-skill-pack-mythosforge](https://github.com/ryjin111/aeon-skill-pack-mythosforge) | 5 | Read-only MythosForge monitoring — ops/backlog/jury/payout health, proof-of-creation integrity on Base, theme/round guard against silent relabels, jury-drift detection, and live gallery/proof-page QA |
| [demo-pack](https://github.com/sparkleware/demo-pack) | 1 | Holographic demo skill — proves the Sparkleware registry install pipeline works |
| [aeon-pulse](https://github.com/sparkleware/aeon-pulse) | 1 | Daily activity summary for the Aeon framework — recent commits, releases, and open issues |
| [registry-watch](https://github.com/sparkleware/registry-watch) | 1 | Daily digest of new packs added to the Sparkleware registry — discover community skills without manually browsing |
| [arxiv-digest](https://github.com/sparkleware/arxiv-digest) | 1 | Daily digest of newest AI / autonomous-agent papers on arXiv — top submissions in cs.AI, cs.LG, cs.MA |
| [hn-top](https://github.com/sparkleware/hn-top) | 1 | Daily digest of HackerNews top stories — dev / startup / AI conversation in one screen |
| [eth-gas-watch](https://github.com/sparkleware/eth-gas-watch) | 1 | Ethereum gas-price status check on a schedule — flags cheap windows for batching on-chain ops |
| [morning-briefing](https://github.com/sparkleware/morning-briefing) | 1 | Daily morning briefing — date, day-of-week, current weather, and a sparkly closer |
| [aeon-skill-pack-noelclaw](https://github.com/noelclaw/aeon-skill-pack-noelclaw) | 2 | Persistent versioned memory and multi-agent swarm coordination — save typed artifacts to Noel Vault and manage shared agent session state across runs |
| [signa](https://github.com/codexvritra/signa) (`--path aeon-skills`) | 20 | Full SIGNA suite — wallet-signed cross-platform agent messaging, multi-agent broadcast and delegate, encrypted rooms + ERC-8004 trust gate, plus Bankr resolver / launches, gitlawb, MiroShark, and **x402 receipts + bounded spend mandates** (a human grants a signed budget, the agent spends within it and asks for more) |
| [aeon-skill-pack-mneme](https://github.com/mnemedb/aeon-skill-pack-mneme) | 8 | Mneme as Aeon's persistent memory layer — vector recall across runs, entity/relation graph, live Base chain streams, async LLM "dream" reflections, and schema-aware /chat. One `MNEME_API_KEY`, zero infra. |

**To list a pack here**, open a PR adding a row. Guidelines:

- The pack must be in its own public repo with a clear license and a per-skill `SKILL.md`.
- Skills should follow the conventions in [`add-skill`](add-skill) and the core catalog — no monkey-patching of Aeon internals, no skill that depends on private endpoints.
- Add a `skills-pack.json` manifest at the pack root so `install-skill-pack` knows which skills the pack ships (see [docs](docs/community-skill-packs.md) for the schema).
- The README row should link to the repo, name the skill count, and one-line what the pack is for.
- In the same PR, add a matching entry to [`skill-packs.json`](skill-packs.json) — the machine-readable mirror of this table (registry schema in [the docs](docs/community-skill-packs.md#skill-packsjson-community-registry)).

### Two-repo strategy

This repo is a public template. Run your own instance as a **private fork** so memory, articles, and API keys stay private:

```bash
git remote add upstream https://github.com/aaronjmars/aeon.git
git fetch upstream
git merge upstream/main --no-edit
```

Your `memory/`, `articles/`, and personal config won't conflict — they're in files that don't exist in the template.

### GitHub Actions cost

![Basically free — runs on your existing Claude subscription and a free GitHub account](./assets/free-aeon.jpg)

| Scenario | Cost |
|----------|------|
| No skill matched (most ticks) | ~10s — checkout + bash + exit |
| Skill runs | 2–10 min depending on complexity |
| Heartbeat (nothing found) | ~2 min |
| **Public repo** | **Unlimited free minutes** |

Private repos: Free plan = 2,000 min/mo, Pro/Team = 3,000 + $0.008/min overage. To reduce usage: switch to `*/15` or hourly cron, disable unused skills, keep the repo public. Every run logs token usage to `memory/token-usage.csv`; the `cost-report` skill generates a weekly breakdown by skill and model.

### Project structure

![The Stack](./assets/stack-aeon.jpg)

```
CLAUDE.md                ← agent identity (auto-loaded by Claude Code)
aeon.yml                 ← skill schedules, chains, reactive triggers, enabled flags
skills.json              ← machine-readable skill catalog (196 skills)
./aeon                   ← launch the local dashboard (Next.js on port 5555)
./onboard                ← validate the fork's setup (secrets, workflows, channels)
./notify                 ← multi-channel notifications (Telegram, Discord, Slack, Email, json-render)
./notify-jsonrender      ← convert skill output to dashboard feed cards via Haiku
./add-skill              ← import skills from GitHub repos (with security scanning)
./add-mcp                ← register Aeon as an MCP server for Claude Desktop/Code
./add-a2a                ← start the A2A protocol gateway for external agents
./export-skill           ← package skills for standalone distribution
./generate-skills-json   ← regenerate skills.json from SKILL.md files
docs/                    ← GitHub Pages site (articles, activity log, memory)
soul/                    ← optional identity files (SOUL.md, STYLE.md, examples/, data/)
skills/                  ← each skill is a SKILL.md prompt file (196 total)
workflow-templates/      ← GitHub Agentic Workflow templates (.md)
skill-templates/         ← templates for building your own skills
apps/                    ← standalone sub-projects, each with its own package.json
  dashboard/             ← local web UI (Next.js + json-render feed)
  mcp-server/            ← MCP server — exposes skills as Claude tools
  a2a-server/            ← A2A protocol gateway — exposes skills to any agent framework
  webhook/               ← Telegram instant-mode Cloudflare Worker (~1s delivery)
memory/
  MEMORY.md              ← goals, active topics, pointers
  cron-state.json        ← per-skill execution metrics (status, success rate, quality)
  skill-health/          ← rolling quality scores per skill (last 30 runs)
  token-usage.csv        ← token cost tracking per run
  issues/                ← structured issue tracker for skill failures
  topics/                ← detailed notes by topic
  logs/                  ← daily activity logs (YYYY-MM-DD.md)
.outputs/                ← skill chain outputs (passed between chained steps)
scripts/
  prefetch-xai.sh        ← pre-fetch X/Grok API data outside sandbox
  postprocess-replicate.sh ← generate images via Replicate after Claude runs
  skill-runs             ← audit recent GitHub Actions skill runs
  sync-site-data.sh      ← sync memory/logs to docs site data
.github/workflows/
  aeon.yml               ← skill runner (workflow_dispatch, issues, quality scoring)
  chain-runner.yml       ← skill chain executor (parallel + sequential pipelines)
  messages.yml           ← cron scheduler + message polling (Telegram/Discord/Slack)
```

---

## FAQ

### What is Aeon?

Aeon is an AI agent system that runs unattended on GitHub Actions, self-heals when skills fail, and monitors its own output quality. Configure once, walk away — it handles recurring tasks like morning briefs, market monitoring, PR reviews, and research digests.

### Can I create custom skills?

Yes. Bootstrap from [`skill-templates/`](skill-templates/TEMPLATE.md) (`./new-from-template <template> <skill-name> --var KEY=VALUE...`), describe one to the `create-skill` skill, or label a GitHub issue `ai-build` and let Aeon build it.

### Troubleshooting

- **Dashboard not loading** — make sure `./aeon` is running and check `http://localhost:5555`.
- **Skills not executing** — run `./onboard --remote` to verify setup, check GitHub Actions workflow status.
- **Notifications not working** — verify channel secrets in the dashboard (Telegram/Discord/Slack tokens).
- **Self-healing not working** — enable `skill-repair` and `skill-health`, check `memory/` state.

### Need more help?

Check the [`docs/`](docs/) directory, run `./onboard` for setup verification, or open an issue on GitHub.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=aaronjmars/aeon&type=Date)](https://www.star-history.com/#aaronjmars/aeon&Date)

Support the project : 0xbf8e8f0e8866a7052f948c16508644347c57aba3

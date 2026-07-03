<p align="center">
  <img src="assets/aeon.jpg" alt="Aeon" width="120" />
</p>

<h1 align="center">AEON</h1>

<p align="center">
  <a href="https://github.com/aaronjmars/aeon/stargazers"><img src="https://img.shields.io/github/stars/aaronjmars/aeon?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/aaronjmars/aeon/network/members"><img src="https://img.shields.io/github/forks/aaronjmars/aeon?style=flat-square&logo=github" alt="GitHub forks"></a>
  <a href="https://x.com/aeonframework"><img src="https://img.shields.io/badge/Follow-%40aeonframework-black?style=flat-square&logo=x&labelColor=000000" alt="Follow on X"></a>
  <a href="https://bankr.bot/discover/0xbf8e8f0e8866a7052f948c16508644347c57aba3"><img src="https://img.shields.io/badge/Aeon%20on-Bankr-orange?style=flat-square&labelColor=1a1a2e" alt="Aeon on Bankr"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="Contributing"></a>
</p>

<p align="center">
  <strong>The most autonomous agent framework.</strong><br>
  Give it a direction - it'll use 69 skills (deep research, PR reviews, market monitoring, Vercel deploys…) to get it done. No approval loops. No babysitting. Configure once, forget forever.
</p>

<p align="center">
  <img src="assets/aeon-demo.gif" alt="Aeon Demo" />
</p>

---

## Quick start

You need three things:

1. **Node.js 20+** - grab the LTS installer from [nodejs.org](https://nodejs.org/en/download), or use a package manager: `brew install node` (macOS), `winget install OpenJS.NodeJS.LTS` (Windows), [nvm](https://github.com/nvm-sh/nvm) or your distro's package manager (Linux). Already have it? `node -v` should print 20 or higher.
2. **[GitHub CLI](https://cli.github.com/) (`gh`), authenticated** - the dashboard uses it for everything (secrets, workflows), and `./aeon` checks it before starting. Install: `brew install gh` (macOS), `winget install --id GitHub.cli` (Windows), [per-distro instructions](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) (Linux). Then run `gh auth login` and follow the prompts.
3. **Your own copy of this repo** - click **Use this template** at the top of [the repo page](https://github.com/aaronjmars/aeon) - keep it public, Actions minutes are free on public repos. CLI version: `gh repo fork aaronjmars/aeon --clone`.

   <img src="assets/use-this-template.png" alt="The Use this template button at the top of the repo page" width="320" />

```bash
git clone https://github.com/<you>/aeon   # skip if you used `gh repo fork --clone`
cd aeon && ./aeon
```

Open [http://localhost:5555](http://localhost:5555) and follow the four steps:

1. **Authenticate** - connect your Claude Pro/Max subscription, or paste an API key: Anthropic, Anthropic-compatible, or a [gateway key](#llm-gateways) (Bankr, OpenRouter, UsePod, Venice, Surplus) - routed automatically.
2. **Add a channel** - [Telegram, Discord, or Slack](#notifications) so Aeon can talk to you.
3. **Pick skills** - toggle what you want, set schedules. Each skill shows the API keys and MCP servers it needs, with one-click setup.
4. **Run** - hit **Run now** on any skill to try it immediately; API keys and `var` values apply directly, no push needed. When you change config (schedules, toggles), **Push** commits it to GitHub in one click so Actions runs it on cron.

That's it - Aeon now runs unattended. On a public repo, GitHub Actions minutes are **free**. Run `bin/onboard` anytime to verify your setup.

Dashboard views, local dev, env vars, and remote access are documented in [`apps/dashboard/README.md`](apps/dashboard/README.md).

<details>
<summary><strong>No admin rights / can't install <code>gh</code>?</strong></summary>

Grab the `gh_*_macOS_arm64.zip` (or your platform's binary) from [github.com/cli/cli/releases](https://github.com/cli/cli/releases) and drop it on your `PATH` (e.g. `~/.local/bin`). No installer, no sudo. Then `gh auth login`.

</details>

---

## What Aeon can do

**69 skills, grouped into 10 packs.** By default the dashboard shows only the small **core** set; everything else is hidden until you **enable its pack** in the **Packs** view - a visibility switch that reveals a pack's skills across the UI without running anything. Putting a skill on duty stays a per-skill toggle. Every skill is independently installable, schedulable, and chainable. How packs work: [`docs/skill-packs.md`](docs/skill-packs.md).

| Pack | Key | Skills | Examples |
| --- | --- | --- | --- |
| 🧬 **Core** - self-evolution, healing, memory; always present | `core` | 9 | `autoresearch`, `cost-report`, `create-skill` |
| 🛰️ **Fleet & Replication** | `fleet` | 5 | `deploy-prototype`, `distribute-tokens`, `fleet-control` |
| 📚 **Research & Content** | `research` | 6 | `article`, `fetch-tweets`, `idea-forge` |
| 💻 **Dev & Code** | `dev` | 18 | `pr-review`, `github-monitor`, `auto-merge` |
| 📈 **Crypto & Markets** | `markets` | 16 | `token-movers`, `defi-overview`, `base-mcp` |
| 🛡️ **Onchain Security** | `hound` | 3 | `investigation-report`, `tx-explain`, `wallet-profile` |
| ✍️ **Social & Writing** | `social` | 5 | `write-tweet`, `reply-maker`, `mention-radar` |
| ✅ **Productivity** | `productivity` | 5 | `action-converter`, `shiplog`, `strategy-builder` |
| 🤖 **Agent Ops** | `agent-ops` | 2 | `operator-scorecard`, `memory-flush` |
| 🧪 **Lab** - unsorted; freshly authored/imported skills awaiting a pack | `lab` | 0 | _(empty — add via `category:`)_ |

<details>
<summary><strong>Full catalog (all 69 skills by pack)</strong></summary>

| Pack | Skills |
|------|--------|
| **Core** (`core`, 9) | `autoresearch`,`cost-report`,`create-skill`,`digest`,`heartbeat`,`install-skill`,`self-improve`,`skill-health`,`skill-repair` |
| **Fleet & Replication** (`fleet`, 5) | `deploy-prototype`,`distribute-tokens`,`fleet-control`,`spawn-instance`,`vuln-scanner` |
| **Research & Content** (`research`, 6) | `article`,`bd-radar`,`fetch-tweets`,`idea-forge`,`last30`,`narrative-convergence` |
| **Dev & Code** (`dev`, 18) | `auto-merge`,`auto-workflow`,`changelog`,`code-health`,`ecosystem-pulse`,`feature`,`fork-fleet`,`github-monitor`,`github-trending`,`inbox-triage`,`issue-triage`,`pr-review`,`pr-triage`,`repo-scanner`,`search-skill`,`star-milestone`,`vuln-tracker`,`workflow-audit` |
| **Crypto & Markets** (`markets`, 16) | `base-mcp`,`ctrl`,`defi-overview`,`fear-divergence`,`monitor-polymarket`,`narrative-tracker`,`onchain-monitor`,`picks-tracker`,`pm-manipulation`,`pm-pulse`,`price-alert`,`token-movers`,`token-pick`,`treasury-info`,`unlock-monitor`,`x402-monitor` |
| **Onchain Security** (`hound`, 3) | `investigation-report`,`tx-explain`,`wallet-profile` |
| **Social & Writing** (`social`, 5) | `mention-radar`,`reply-maker`,`schedule-ads`,`soul-builder`,`write-tweet` |
| **Productivity** (`productivity`, 5) | `action-converter`,`idea-pipeline`,`send-email`,`shiplog`,`strategy-builder` |
| **Agent Ops** (`agent-ops`, 2) | `memory-flush`,`operator-scorecard` |
| **Lab** (`lab`, 0) | _(empty)_ |

Authoritative source: [`skills.json`](catalog/skills.json) + [`packs.json`](catalog/packs.json), the dashboard **Packs** view, or `bin/add-skill aaronjmars/aeon --list`. A skill's pack comes from its `category:` frontmatter - see [`docs/skill-packs.md`](docs/skill-packs.md).

</details>

### It heals itself

![Anatomy of a skill run](./assets/skill-run-aeon.jpg)

Every skill output is automatically scored 1–5 by Haiku after each run. Scores and failure flags (`api_error`, `stale_data`, `rate_limited`) are tracked per skill in `memory/skill-health/` with a rolling 30-run history. When something breaks, the loop fixes it without you:

![Self-healing architecture](./assets/architecture-aeon.jpg)

1. **`heartbeat`** (3x daily) - detects failed, stuck, or chronically broken skills
2. **`skill-health`** - audits quality scores and flags API degradation patterns
3. **`skill-repair`** - diagnoses and patches failing skills automatically
4. **`self-improve`** - evolves prompts, config, and workflows based on performance

Health skills file issues, repair skills close them. `heartbeat` is the only skill enabled by default: nothing to report → silent; something needs attention → one notification. Deep dive: [`docs/CORE.md`](docs/CORE.md).

**Votable health** (on by default — set the repo variable `HEALTH_ISSUES=0` to turn it off): when a skill regresses (a Haiku score of 1–2 or a failure flag), the loop opens or comments on a per-skill GitHub Issue titled `health: <skill>`; clean runs stay silent, so there's no issue spam. 👍/👎 the issue and `self-improve` / `skill-repair` triage the most-voted, worst-scoring skills first — a visible, conflict-free repair queue you can steer.

### It replicates

Aeon can spawn and manage copies of itself. `spawn-instance` forks the repo into a new specialized instance (`var: "crypto-tracker: monitor DeFi protocols"`), selects relevant skills, and registers it in `memory/instances.json` - no secrets propagated, billing stays isolated. `fleet-control` health-checks and dispatches across instances; `fleet-scorecard` tracks fleet economics.

### It ships real work

`external-feature` ships code to watched repos unprompted. `deploy-prototype` generates and deploys live web apps to Vercel. `vuln-scanner` finds real vulnerabilities and discloses them responsibly. `autoresearch` evolves existing skills through scored variations, and `create-skill` generates new ones from a sentence.

### Add more skills

```bash
bin/add-skill aaronjmars/aeon --list        # browse the built-in catalog
bin/add-skill BankrBot/skills bankr hydrex  # install from any GitHub repo
bin/add-skill BankrBot/skills --all         # install everything from a repo
bin/export-skill token-movers               # package one for standalone use
```

Installed skills land in `skills/` and are added to `aeon.yml` disabled - flip `enabled: true` to activate. You can also:

- **Build your own** from [`skill-templates/`](skill-templates/TEMPLATE.md): `bin/new-from-template <template> <skill-name> --category <pack>` - the `--category` slots it into a pack (or set `category:` in the SKILL.md frontmatter). See [`docs/skill-packs.md`](docs/skill-packs.md).
- **Label any GitHub issue `ai-build`** - Claude reads the issue, implements it, and opens a PR
- **Install community packs** - see [Community skill packs](#community-skill-packs)

---

## Why "the most autonomous"?

Most agent tools put you in the driver's seat - approve this tool call, review this diff, confirm this action. Aeon is built for the work you want *done* while you're not there: briefings, market monitoring, PR reviews, research digests, security scans.

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

**Other agents are interactive tools you use. Aeon is an autonomous system you configure and walk away from.** It decides when to run, what to check, and when to bother you. You still want Claude Code for writing code interactively - but for the 90% of recurring tasks that don't need you in the loop, the most autonomous agent is the one that never asks.

For a comparison against the broader ecosystem (AutoGen, CrewAI, n8n, LangGraph) and active forks in production, see [`SHOWCASE.md`](SHOWCASE.md). For products built on Aeon, see [`ECOSYSTEM.md`](ECOSYSTEM.md).

![Autonomy spectrum](./assets/autonomy-aeon.jpg)

---

## Configure

![Aeon never sleeps - a full day of autonomous runs](./assets/never-sleeps-aeon.jpg)

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

Standard cron format, all times UTC. Supports `*`, `*/N`, exact values, comma lists. **Order matters** - the scheduler picks the first matching skill, so put day-specific skills before daily ones and `heartbeat` last.

### The `var` field

Every skill accepts a single `var` - a universal input each skill interprets its own way:

| Skill type | What `var` does | Example |
|-----------|----------------|---------|
| Research & content | Sets the topic | `var: "rust"` → digest about Rust |
| Dev & code | Narrows to a repo | `var: "owner/repo"` → only review that repo's PRs |
| Crypto | Focuses on a token/wallet | `var: "solana"` → only check SOL price |
| Productivity | Sets the focus area | `var: "shipping v2"` → priority brief emphasizes v2 |

Empty `var` = the skill's default behavior (scan everything, auto-pick topics). Set it from the dashboard or pass it when triggering manually.

### Models

The default model for all skills is set in `aeon.yml` (or from the dashboard header dropdown):

```yaml
model: claude-sonnet-4-6
```

Options: `claude-sonnet-4-6` (default), `claude-opus-4-8`, `claude-fable-5`, `claude-opus-4-7`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`. Per-run overrides are available via workflow dispatch, and individual skills can override to optimize cost:

```yaml
skills:
  token-movers: { enabled: true, schedule: "30 12 * * *", model: "claude-sonnet-4-6" }
```

### Authentication

Set **one** of these - not both:

| Secret | What it is | Billing |
|--------|-----------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token from your Claude Pro/Max subscription | Included in plan |
| `ANTHROPIC_API_KEY` | API key from console.anthropic.com | Pay per token |

```bash
claude setup-token   # opens browser → prints sk-ant-oat01-... (valid 1 year)
```

The dashboard's Authenticate modal handles both - and routes gateway keys (Bankr `bk_…`, OpenRouter `sk-or-…`, Surplus `inf_…`, or Venice/UsePod via the dropdown) automatically (see [LLM Gateways](#llm-gateways)).

### Notifications

Set the secret → channel activates. No code changes needed.

| Channel | Outbound | Inbound |
|---------|---------|---------|
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Same |
| Discord | `DISCORD_WEBHOOK_URL` | `DISCORD_BOT_TOKEN` + `DISCORD_CHANNEL_ID` |
| Slack | `SLACK_WEBHOOK_URL` | `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` |
| Email | `SENDGRID_API_KEY` + `NOTIFY_EMAIL_TO` | - |

**Telegram:** Create a bot with @BotFather → get token + chat ID. Saving the bot token in the dashboard **auto-registers** the slash-command menu (`/skillname` dispatches instantly, no LLM) — no manual step; a **Re-register commands** button re-syncs it after you toggle skills, and every notification carries **Run again / Schedule weekly** quick-action buttons, deep links, and stateless follow-up questions. Full guide: [docs/telegram-commands.md](docs/telegram-commands.md).
**Discord:** Outbound: Channel → Integrations → Webhooks → Create. Inbound: discord.com/developers → bot → add `channels:history` scope → copy token + channel ID.
**Slack:** api.slack.com → Create App → Incoming Webhooks → install → copy URL. Inbound: add `channels:history`, `reactions:write` scopes → copy bot token + channel ID.
**Email:** sendgrid.com/settings/api_keys → Create API Key (Mail Send permission) → add as `SENDGRID_API_KEY`, set `NOTIFY_EMAIL_TO`. Optional repo variables: `NOTIFY_EMAIL_FROM` (default `aeon@notifications.aeon.bot`), `NOTIFY_EMAIL_SUBJECT_PREFIX` (default `[Aeon]`).

**Restrict who can command the agent (inbound):** Telegram is already scoped to a single `TELEGRAM_CHAT_ID`. For Discord and Slack, set the optional repo variables `DISCORD_ALLOWED_AUTHOR_ID` / `SLACK_ALLOWED_USER_ID` (or same-named secrets) to the authorized sender's user ID — inbound messages from anyone else in the channel are then ignored. **Leaving them unset processes commands from any non-bot member of the channel**, so set them whenever the channel isn't private to you.

Want ~1s Telegram replies instead of up-to-5-min polling? See [Telegram instant mode](#telegram-instant-mode).

### API keys per skill

Skills that call third-party APIs declare their credentials in a `requires:` frontmatter list, so the dashboard shows **which skill needs which key**:

```yaml
requires: [XAI_API_KEY, COINGECKO_API_KEY?]   # bare = required · `?` = works better with
```

The dashboard surfaces this as an **API keys** panel on each skill (set/unset status, inline "Set" button), a ⚠ flag when an enabled skill is missing a required key, and a **"used by"** index under each key in Settings → Access Keys. Skills can likewise declare MCP servers with an `mcp:` list (`mcp: [base]`) - same two tiers, shown as a per-skill **MCP servers** panel with install state. Convention details: [`skill-templates/TEMPLATE.md`](skill-templates/TEMPLATE.md#declaring-api-keys-requires).

---

## Advanced

Everything below is optional - Aeon runs fine without any of it.

### Capability tiers (read-only skills)

A skill declares its write blast-radius in SKILL.md frontmatter:

```yaml
mode: read-only   # may read the repo, fetch the web, and ./notify — but cannot mutate the repo
mode: write       # full access (the default): adds Write / Edit / git / gh / python3
```

`read-only` runs the skill with a restricted Claude Code `--allowedTools` set (`Write`, `Edit`, `Bash(git:*)`, `Bash(gh:*)` are dropped), so a research-and-notify skill **physically can't** commit, push, edit code, or open a PR. Its legitimate output (memory, `.outputs/`, articles) is still saved on its behalf by a post-run guard — which also reverts any stray code/config a shell redirection slipped through. `write` is the default and a strict superset. Use `read-only` for pure read-and-notify skills; keep `write` for anything that writes code or scratch files. This is the *runtime* enforcement of the install-time [`capabilities:`](docs/CAPABILITIES.md) hint.

### Durable state without the churn

Per-skill execution state (`memory/cron-state.json` — status, success rate, quality) is **dual-written** by default: each run commits the file *and* appends an immutable event to a machine-managed, append-only GitHub Issue (`aeon:cron-state`, kept closed so it never clutters your issue list). Canonical state is a pure fold of that issue's comments, so concurrent runs never race — no rewrite, force-push, or rebase-retry. Switch with the repo variable **`STATE_BACKEND`**:

| `STATE_BACKEND` | Behaviour |
|---|---|
| unset / `dual` (default) | append to the Issue **and** commit the file — the file stays authoritative, so the Issue path can never stale a reader |
| `issues` | append only; a pre-run *materialize* step projects the Issue → file so readers are unchanged, and the file is left uncommitted (zero state churn) |
| `file` | legacy file-only |

Chains record to the same ledger.

### Skill chaining

Chain skills so outputs flow between them. Chains run as separate GitHub Actions workflow steps via `chain-runner.yml`:

```yaml
chains:
  digest-pipeline:
    schedule: "0 7 * * *"
    on_error: fail-fast       # or: continue
    steps:
      - parallel: [token-movers, hn-digest]  # run concurrently
      - skill: digest                          # runs after parallel group
        consume: [token-movers, hn-digest]   # gets their outputs injected
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

Claude only installs and runs when a skill actually matches - non-matching ticks cost ~10s.

### MCP servers in skill runs

Let skills **call** MCP servers (GitHub, a database, a paid API, your own) while they run in GitHub Actions. Opt-in and safe - with no `.mcp.json` at the repo root, runs are byte-identical to before.

```bash
cp .mcp.json.example .mcp.json   # then edit, commit, push
```

The example ships two working servers - `github` (uses the runner's built-in `GITHUB_TOKEN`) and `sequential-thinking` (no-auth stdio). On the next run, the runner loads `.mcp.json` and auto-allows every server's tools, so a skill can just say *"use the github MCP server to …"*.

Or skip the file entirely: the dashboard's **MCP** tab writes `.mcp.json` for you, lists **Featured** servers (e.g. [Base](https://mcp.base.org)) for one-click install, and tells you which secret each server needs.

**Servers that need a secret** - reference it with `${VAR}`, never commit the value:

```json
"acme": {
  "type": "http",
  "url": "https://mcp.acme.dev/v1",
  "headers": { "Authorization": "Bearer ${ACME_API_KEY}" }
}
```

Then just **set the secret** (dashboard MCP tab inline, Settings → Add Credential, or `gh secret set ACME_API_KEY`) - the runner auto-resolves any `${VAR}` your `.mcp.json` references from the repo's secrets, with zero workflow editing. If a referenced secret isn't set, the runner skips MCP for that run and logs a warning instead of breaking the skill.

Notes: scope is global (`.mcp.json` applies to every skill); add `"alwaysLoad": true` to force a server's tools into context every run; stdio servers run as local processes in the runner, HTTP/SSE servers are reached over the network.

### Use Aeon's skills from Claude (MCP)

Aeon skills work outside GitHub Actions too - locally via `claude -p -`, identical to Actions. API keys are read from your environment or a `.env` file in the repo root.

**Claude (MCP)** - every skill appears as an `aeon-<name>` tool in Claude Desktop and Claude Code:

```bash
bin/add-mcp                    # build and register
bin/add-mcp --desktop          # also print Claude Desktop config
bin/add-mcp --uninstall        # remove
```

Tool naming, the `var` argument, Claude Desktop config, and a test client are in [`apps/mcp-server/README.md`](apps/mcp-server/README.md).

Working client scripts (MCP stdio, Claude Desktop) live in [`examples/`](examples/) - each calling a real skill end-to-end. Start with [`examples/README.md`](examples/README.md).

### Cross-repo access

The built-in `GITHUB_TOKEN` is scoped to this repo only. For `github-monitor`, `pr-review`, `issue-triage`, and `external-feature` to work on your other repos, add a `GH_GLOBAL` personal access token: github.com/settings/tokens → Fine-grained → set repo access → grant Contents, Pull requests, Issues (read/write) → add as `GH_GLOBAL` secret. Skills use it when available and fall back to `GITHUB_TOKEN` automatically.

### LLM Gateways

<p align="center">
  <img src="assets/providers.png" alt="Seven AI providers supported: Claude subscription, Anthropic API, OpenRouter, Bankr, UsePod, Venice, Surplus" width="640" />
</p>

Aeon can power Claude Code **eight** ways. Two are **direct** to Anthropic; the other six route through a **gateway**. You add a credential in the dashboard's Authenticate modal - paste it and the provider is detected from its prefix (or picked from the dropdown) and saved as the secret below. (Separately, the [Grok Build harness](#harnesses) runs the `grok` CLI instead of Claude Code — that's a different axis from the gateways here.)

**Routing is automatic.** `aeon.yml` ships `gateway: { provider: auto }`, and each run resolves the live provider from *whichever secrets are set*, in priority order - so adding or removing a key changes routing with no re-config:

```
claude (CLAUDE_CODE_OAUTH_TOKEN) → anthropic (ANTHROPIC_API_KEY) →
openrouter → bankr → usepod → venice → surplus → grok → direct (fallback)
```

It runs as a **cascade**: the highest-priority provider whose key is set goes first, and on **any** failure (no credits, rate limit, outage, dud response) the run automatically falls over to the next provider whose key is set - so a dead provider degrades gracefully instead of failing the run, and it only errors out if *every* provider fails. The log prints `Routing attempt via '<provider>'` per hop (and `ran via fallback provider …` when it recovers).

Override the order with the repo variable **`GATEWAY_ORDER`** (space-separated names), or pin a single provider (which disables failover) by setting `gateway.provider` to `direct`/`bankr`/`openrouter`/`usepod`/`venice`/`surplus`/`grok` explicitly.

**Direct (`provider: direct`)** - the official Anthropic API, no middleman:

| Mode | Credential | Notes |
|------|-----------|-------|
| <img src="https://icons.duckduckgo.com/ip3/anthropic.com.ico" width="16" valign="middle"> Claude subscription | `CLAUDE_CODE_OAUTH_TOKEN` | Your Claude Pro/Max plan - **Connect** in the modal runs the OAuth flow; no per-token billing |
| <img src="https://icons.duckduckgo.com/ip3/anthropic.com.ico" width="16" valign="middle"> Anthropic API | `ANTHROPIC_API_KEY` | Pay-as-you-go API key (or any Anthropic-compatible endpoint via `ANTHROPIC_BASE_URL`) |

**Gateways** - route Claude through an alternative provider (cheaper Opus, crypto-settled, privacy-first…). Keys with a distinctive prefix are detected automatically; UsePod and Venice have no prefix, so pick them in the dropdown:

| Gateway | Secret | Notes |
|---------|--------|-------|
| <img src="https://icons.duckduckgo.com/ip3/bankr.bot.ico" width="16" valign="middle"> [Bankr](https://docs.bankr.bot/llm-gateway/overview) | `BANKR_LLM_KEY` | Discounted Opus access |
| <img src="https://icons.duckduckgo.com/ip3/openrouter.ai.ico" width="16" valign="middle"> [OpenRouter](https://openrouter.ai) | `OPENROUTER_API_KEY` | Anthropic-native passthrough; lowest-risk option |
| <img src="https://icons.duckduckgo.com/ip3/usepod.ai.ico" width="16" valign="middle"> [UsePod](https://usepod.ai) | `USEPOD_TOKEN` | Solana marketplace; token is embedded in the base URL, keep it secret |
| <img src="https://icons.duckduckgo.com/ip3/venice.ai.ico" width="16" valign="middle"> [Venice](https://venice.ai) | `VENICE_API_KEY` | Privacy-first; OpenAI-compatible, bridged via a per-run [claude-code-router](https://github.com/musistudio/claude-code-router) sidecar. Point it at any Venice-compatible endpoint with the `VENICE_BASE_URL` repo variable |
| <img src="https://icons.duckduckgo.com/ip3/surplusintelligence.ai.ico" width="16" valign="middle"> [Surplus](https://surplusintelligence.ai) | `SURPLUS_API_KEY` | Routed via The Bridge; settles in USDC on Base - fund the wallet + `approve()` once before use |
| <img src="https://icons.duckduckgo.com/ip3/x.ai.ico" width="16" valign="middle"> [Grok (xAI)](https://x.ai/api) | `XAI_API_KEY` | Anthropic-native passthrough to `api.x.ai`; the `xai-…` key is auto-detected. Set the model with the `GROK_MODEL` repo variable. Same key also powers the [grok harness](#harnesses) |

#### Adding a gateway

A gateway is wired through a handful of files, all following the existing pattern - so copy an entry of the same **tier**. There are two: **native** (the provider already speaks the Anthropic API - just point `ANTHROPIC_BASE_URL` at it, like Bankr/OpenRouter/UsePod/Grok) and **sidecar** (OpenAI-compatible - bridged per run by a [claude-code-router](https://github.com/musistudio/claude-code-router) sidecar, like Venice/Surplus).

1. **`apps/dashboard/lib/gateway-registry.ts`** - add `slug: { label, secretName, prefixes, domain }` (empty `prefixes: []` = dropdown-only, no auto-detect). This is the **single source of truth**: it auto-flows to the `GatewayProvider` union (`lib/types.ts`), `AUTH_SECRETS` (`lib/constants.ts`), the secrets route's gateway-key detection, the auth key-prefix detection (`lib/auth-provider.ts`), and the service-icon domain.
2. **`apps/dashboard/components/AuthModal.tsx`** - add the slug to `PROVIDER_OPTIONS` (this dropdown list is **not** registry-derived).
3. **`apps/dashboard/app/api/secrets/route.ts`** - add a `BUILTIN_SECRETS` row (description only) so the secret shows in Settings.
4. **`scripts/llm-gateway.sh`** - add an `aeon_present()` case, add the slug to the auto-resolver's default `GATEWAY_ORDER`, and add a `case` branch (a **native** provider exports `ANTHROPIC_BASE_URL` + the auth token; a **sidecar** provider calls `start_ccr_sidecar <slug> <openai-url> <key> <model>`).
5. **`.github/workflows/aeon.yml`** - pass the new secret (and any `*_MODEL` override **variables**) into the run's `env:` (also `messages.yml`), so the resolver can see it.

Then add a row to the gateway table above. To verify the full loop: paste a key in the dashboard (prefix should auto-detect, or pick it from the dropdown) and run any skill - the workflow log prints `::notice:: gateway=auto resolved to <slug>` followed by `::notice:: Routing through …`.

### Harnesses

The **harness** is the coding-agent CLI that actually runs your skills. It's a separate axis from the gateways above (which only swap the *model* behind Claude Code):

| Harness | CLI | Auth | Models |
|---------|-----|------|--------|
| `claude` (default) | [Claude Code](https://github.com/anthropics/claude-code) (`claude -p`) | `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` / any gateway above | `claude-*` |
| `grok` | [Grok Build](https://x.ai/cli) (`grok -p`) | **X account** (`GROK_CREDENTIALS`) or `XAI_API_KEY` | `grok-composer-2.5-fast` (grok-build is not offered — it Cancels in the Actions sandbox) |

Everything already configured keeps running on `claude` — the harness is fully additive and defaults to Claude Code. Select it globally in the dashboard top bar, per-run via the workflow-dispatch **Harness** input, or per-skill / globally in `aeon.yml`:

```yaml
harness: claude          # global default (top-level)

skills:
  digest: { enabled: true, schedule: "0 9 * * *", harness: "grok" }   # per-skill override
```

**One-click login with your X account.** Just like **Use Claude Subscription**, the dashboard drives the login for you — click **Connect X account** in the Authenticate modal:

1. The dashboard runs `grok login --device-auth`, opens your browser to the `accounts.x.ai` consent page, and waits while you approve (requires a **SuperGrok** or **X Premium+** entitlement, and the `grok` CLI installed: `npm i -g @xai-official/grok`).
2. On approval it captures your `~/.grok/auth.json` session and stores it as the `GROK_CREDENTIALS` repo secret.
3. Each Actions run restores that session into `~/.grok` (via `scripts/run-grok.sh`) before invoking `grok`.

Prefer no browser flow? Paste an **`XAI_API_KEY`** in the same modal (also powers the Grok gateway) and grok authenticates with the API key directly.

> Grok's `--output-format json` returns the result text but no token counts, so grok-harness runs report **0 tokens** in cost tracking. The captured OAuth session can expire — if unattended runs start failing on auth, click **Connect X account** again.

Capability mode carries over unchanged: a `mode: read-only` skill maps to grok's `--sandbox read-only` with a read-only allowlist; `write` adds `Edit` + `git`/`gh`/`python` — the same drops as on Claude Code (`scripts/skill_mode.sh grok-args`). Enforcement is the explicit allowlist plus the read-only sandbox: a headless run has no prompt path, so any tool not on the allowlist and not a read-class fast-path is refused. Grok Build has no free tier — it needs a SuperGrok / X Premium+ subscription (OAuth) or xAI API credits (`XAI_API_KEY`).

**Standing instructions.** Grok loads `CLAUDE.md` natively (it reads Claude Code's memory files), so the operating manual is **not** duplicated. `AGENTS.md` is generated by `scripts/gen-agents-md.js` and carries only `STRATEGY.md` — the one thing `CLAUDE.md` delivers via the Claude-only `@STRATEGY.md` import, which grok doesn't expand. That trims ~2.5k tokens of duplicate context per grok run vs. mirroring the whole manual.

**MCP works on grok.** Grok discovers the project `.mcp.json` natively (walking cwd→git-root) and expands `${VAR}` from the environment — the same secrets the workflow's MCP preflight resolves. `scripts/run-grok.sh` adds one `--allow 'MCPTool(<server>__*)'` per server so the model can actually call the tools (MCP tools aren't auto-approved under a headless run). No `--mcp-config` flag or schema translation is needed. (On a dev machine grok additionally sees your user-global MCP servers from `~/.claude.json`/`~/.cursor/mcp.json`; CI runners are clean, so only the repo's `.mcp.json` applies.)

**Newer grok knobs (opt-in per skill).** A skill's `SKILL.md` frontmatter can shape the grok run — ignored by the Claude harness:

```yaml
max_turns: 120     # agentic-turn cap (default 60; a runaway/cost guard) → --max-turns
best_of_n: 3       # run the task 3 ways in parallel, keep the best      → --best-of-n
verify: true       # append a self-verification loop before finishing    → --check
effort: high       # low|medium|high|xhigh|max → --effort  (grok-build only)
```

`effort`/`reasoning_effort` map to the API's `reasoningEffort`, which the CI-default `grok-composer-2.5-fast` rejects — so they're applied only when a reasoning model (`grok-build`) is selected and skipped-with-a-notice otherwise. `best_of_n`/`verify` build on grok's subagents (so the harness drops `--no-subagents` for those runs); `verify` can't combine with structured output. `run-grok.sh` also understands `GROK_JSON_SCHEMA` for `--json-schema` structured output (reliably honoured by `grok-build`).

**Every entry point runs on either harness.** The harness split isn't just the scheduled skill run — it's wired through every surface that launches the agent, so a grok-only fork (no Claude credentials) behaves identically everywhere:

| Surface | How grok is selected | Notes |
|---------|---------------------|-------|
| Scheduled / manual skill run (`aeon.yml`) | dispatch **Harness** input → per-skill `harness:` → global `harness:` → `claude` | full flags + MCP + scorer |
| Skill chains (`chain-runner.yml`) | inherits — each step dispatches `aeon.yml`, which resolves per-skill/global | |
| Inbound messages (`messages.yml`, Telegram/Discord/Slack) | global `harness:` in `aeon.yml` | conversational reply in write mode |
| Local MCP server (`apps/mcp-server`) | `AEON_HARNESS` env → global `harness:` | `resolveHarness()` in `skill-executor.ts` |
| Webhook (`apps/webhook`) | relay only → dispatches `messages.yml` | harness-agnostic |
| Post-run quality scorer (`aeon.yml`) | scores through the same harness the skill ran on | |

Two surfaces stay Claude-only **by design**: the **AI gateway** (`scripts/llm-gateway.sh`) only reshapes the model behind Claude Code — grok has its own auth and bypasses it — and the **json-render feed** (`notify-jsonrender`) renders via `claude -p` and is skipped on grok (the feed is a display nicety; skill output, memory, and notifications are unaffected).

### Strategy

`STRATEGY.md` is Aeon's north-star - your overarching goal, top priorities, audience, and hard constraints. It's imported into `CLAUDE.md`, so it rides along in the context of **every** skill run: when a choice isn't otherwise determined, the strategy breaks the tie ("showcase real output over new features", "depth over breadth"). Keep it tight (it costs tokens every run) and specific (a vague strategy can't break a tie).

Set it three ways from the dashboard's **Strategy** tab:

- **Write it** - edit `STRATEGY.md` inline; Save commits and pushes automatically.
- **Templates** - start from a blank scaffold or one of five archetypes (Indie SaaS, Open-source maintainer, Researcher/Writer, Crypto/Agent, Creator) and fill in the bracketed bits.
- **Build it** - give the `strategy-builder` skill a one-line goal (and optionally a repo or links). It reads your brief plus the repo README and `memory/MEMORY.md`, then drafts a tight north-star / priorities / audience / constraints strategy and commits it. No API key needed; runs as a GitHub Action, so hit **Pull** when it finishes.

### Soul

By default Aeon has no personality. The **Soul** tab gives it one - `soul/SOUL.md` (identity, worldview, opinions) and `soul/STYLE.md` (voice, vocabulary) are read on every run, so notifications and content sound like you. Four ways to set it:

- **Write it** - edit SOUL.md / STYLE.md inline; Save commits and pushes.
- **Templates** - start from a blank scaffold or an archetype (Founder, Researcher, Creator).
- **Install a real soul** - one click pulls a complete example (Karpathy, Garry Tan, Steipete, Vivian Balakrishnan) from the [soul.md](https://github.com/aaronjmars/soul.md) gallery into your `soul/`.
- **Build from your handle** - give the `soul-builder` skill any of an X handle, your full name (web search), or links (LinkedIn, site, blog, GitHub). It reads them and drafts SOUL.md + STYLE.md + voice examples in your style. Set `XAI_API_KEY` for the richest read of your actual X timeline - it falls back to web search without it.

Prefer files? Fork [soul.md](https://github.com/aaronjmars/soul.md), fill in `SOUL.md` / `STYLE.md` / `examples/good-outputs.md` (10–20 calibration samples), and drop them under `soul/` - same result. The `## Voice` section of `CLAUDE.md` reads them automatically, so identity propagates to every skill.

**Quality check:** soul files work when they're specific enough to be wrong. *"I think most AI safety discourse is galaxy-brained cope"* is useful; *"I have nuanced views on AI safety"* is not.

### Publishing (GitHub Pages & RSS)

Aeon publishes articles to a GitHub Pages gallery and an RSS feed.

- **Pages:** Settings → Pages → source `Deploy from a branch`, branch `main`, folder `/docs`. The site lives at `https://<username>.github.io/aeon`; the `update-gallery` skill keeps it in sync.
- **RSS:** Subscribe at `https://raw.githubusercontent.com/<owner>/<repo>/main/articles/feed.xml` - regenerated after each content skill runs.

### Telegram instant mode

Replies aren't instant by default - Aeon runs on GitHub Actions and polls Telegram every 5 minutes. That's by design: it's built for autonomous background work, not real-time chat. For ~1-second replies, deploy the self-contained Cloudflare Worker in [`apps/webhook/`](apps/webhook/) into your own Cloudflare account (no shared infra, no credential custody) - a one-time setup of about 5 minutes:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/aaronjmars/aeon/tree/main/apps/webhook)

The deploy wizard prompts for the four variables (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_REPO`, `GITHUB_TOKEN`) and stores them as encrypted Worker secrets, so the Worker comes out configured - then point your bot at it with `setWebhook`. The dashboard walks through all three steps with one-click webhook registration: **Settings → Credentials → Telegram → ⚡ Instant replies**. The button needs a **public** source repo - on a private fork, mirror `apps/webhook/` to a small public repo and point the button URL there.

Full guide: [`apps/webhook/README.md`](apps/webhook/README.md). The poller detects an active webhook (`getWebhookInfo`) and skips Telegram polling automatically, so the two never conflict. The Worker also routes slash commands, button taps, and reply follow-ups (see [docs/telegram-commands.md](docs/telegram-commands.md)) — **redeploy it after updating** to pick those up.

### Remote dashboard access

The dashboard's `/api/*` routes drive `gh workflow run` and read/write repo secrets, so they're gated to loopback callers by default - no remote callers, no DNS-rebinding from a malicious page. To reach the dashboard from another machine or over a tunnel (Tailscale, ngrok, reverse proxy):

| Env var | Behaviour |
|---|---|
| `AEON_DASHBOARD_ALLOWED_HOSTS=aeon.local,box.tail-xxx.ts.net` | Extends the loopback allowlist by hostnames (comma-separated, case- and port-insensitive) |
| `AEON_DASHBOARD_ALLOW_ANY_HOST=1` | Disables Host-header checking entirely. Only for a trusted reverse proxy that terminates `Host` upstream - loudly insecure otherwise |

The gate also rejects state-changing requests whose `Origin` isn't allowlisted, so a malicious page can't drive `/api/secrets` via a no-cors POST. Code: [`apps/dashboard/proxy.ts`](apps/dashboard/proxy.ts) + [`apps/dashboard/lib/security/api-gate.ts`](apps/dashboard/lib/security/api-gate.ts).

### Fleet Watcher (authorization layer)

Add inline ALLOW/BLOCK authorization in front of every skill run. Each workflow asks your self-hosted [Fleet Watcher](https://github.com/yourorg/fleet-watcher) control plane *"is this allowed?"* before Claude starts and reports the outcome after. BLOCK = workflow exits non-zero, Claude never runs, audit ref recorded.

Already wired into `.github/workflows/aeon.yml` as two opt-in steps. To enable: stand up Fleet Watcher, mint a token via `POST /api/aeon/register`, and add two secrets - `FLEET_ENDPOINT` (base URL) and `FLEET_TOKEN` (the `agnt_…` token). Define your red lines (per-skill caps, counterparty allowlists, dangerous-string patterns) in its dashboard.

If the secrets aren't set, both steps no-op - fully backward compatible. If Fleet is unreachable when they *are* set, the preflight fails closed (skill doesn't run); the postflight always runs so blocked skills are still recorded.

### Community skill packs

![Aeon Framework ecosystem map](./assets/ecosystem-aeon.jpg)

> Aeon's **built-in (first-party) packs** - Core, Fleet, Research, Dev, Markets, Hound, Social, Productivity, Agent Ops - live in this repo and are enabled from the dashboard's **Packs** view; see [`docs/skill-packs.md`](docs/skill-packs.md). The packs below are **community** collections in their own repos.

Third-party skill collections in their own repos, installable as one bundle - two ways:

**One-click (dashboard).** Open the **Packs** view, scroll to **Community packs**, and hit **Install pack** on any card. That runs the security-scanned installer in the background and ships an **auto-merging PR**, so the skills land on `main` (and show up across the dashboard) with no manual step. Want to merge it yourself instead? The card's copy button hands you the exact CLI command below.

**CLI.**

```bash
bin/install-skill-pack AntFleet/aeon-skills
bin/install-skill-pack --list      # browse the registry (skill-packs.json)
```

Either way the installer reads the pack's `skills-pack.json` manifest, runs the security scanner on each `SKILL.md`, and copies approved skills into `skills/` - **disabled** in `aeon.yml` (nothing runs until you set the pack's secrets and flip `enabled: true`), with provenance recorded in `skills.lock`. Full schema and trust model: [`docs/community-skill-packs.md`](docs/community-skill-packs.md).

| Pack | Skills | Description |
|------|--------|-------------|
| [aeon-skills](https://github.com/AntFleet/aeon-skills) | 2 | Two-model-consensus PR review (Opus 4.7 + GPT-5) - channel drawdown for installed repos, x402 pay-per-call for public repos |
| [aeon-skill-pack-liquidpad](https://github.com/liquidpadbot/aeon-skill-pack-liquidpad) | 4 | Track LiquidPad on Base - burn cycle alerts, new token launches with onchain provenance, daily protocol digest, and fee accrual tracking |
| [aeon-skill-pack-mythosforge](https://github.com/ryjin111/aeon-skill-pack-mythosforge) | 5 | Read-only MythosForge monitoring - ops/backlog/jury/payout health, proof-of-creation integrity on Base, theme/round guard against silent relabels, jury-drift detection, and live gallery/proof-page QA |
| [signa](https://github.com/codexvritra/signa) (`--path aeon-skills`) | 20 | Full SIGNA suite - wallet-signed cross-platform agent messaging, multi-agent broadcast and delegate, encrypted rooms + ERC-8004 trust gate, plus Bankr resolver / launches, gitlawb, MiroShark, and **x402 receipts + bounded spend mandates** (a human grants a signed budget, the agent spends within it and asks for more) |
| [Atrium Skills](https://github.com/Atrium-Hermes/aeon-atrium-skills) | 3 | Publish, monetize & discover agent skills on Atrium - the onchain skill marketplace on Base. atrium-publish (DID-signed, IPFS-pinned, USDC-earning), atrium-scout (rents skills matching open loops), atrium-earnings (tracks and withdraws creator USDC) |
| [aeon-skill-pack-mneme](https://github.com/mnemedb/aeon-skill-pack-mneme) | 8 | Mneme as Aeon's persistent memory layer - vector recall across runs, entity/relation graph, live Base chain streams, async LLM "dream" reflections, and schema-aware /chat. One `MNEME_API_KEY`, zero infra. |
| [clawhunter-skills](https://github.com/clawhunter/clawhunter-skills) | 2 | Aggregates and AI-triages crypto bounties across venues (Pump Fun GO, Atelier, EarnFi, tiny.place) and matches each to your agent with a plan to win — plus paid research and create tools (voice tones, logo-grounded images, Kling video direction, web + X research). Paid tools settle via x402 (USDC on Solana or Base). |
| [Polymarket Trader by Simmer](https://github.com/SpartanLabsXyz/aeon-skill-pack-polymarket/tree/main/aeon-skill-pack) (`--path aeon-skill-pack`) | 3 | Signal, discovery, and real position-taking on **Polymarket** - the deepest prediction-market venue - powered by Simmer. Unlike monitor-only packs, polymarket-trade places actual orders (simulate-by-default, live opt-in, bounded) |
| [Charon for AEON](https://github.com/CharonAI-code/charon/tree/main/skills/aeon) (`--path skills/aeon`) | 2 | Repo-local policy enforcement for AEON runs, with guided setup and natural-language policy management |

**To list a pack here**, open a PR adding a row. Guidelines:

- The pack must be in its own public repo with a clear license and a per-skill `SKILL.md`.
- Skills should follow the conventions in [`add-skill`](add-skill) and the core catalog - no monkey-patching of Aeon internals, no skill that depends on private endpoints.
- Add a `skills-pack.json` manifest at the pack root so `install-skill-pack` knows which skills the pack ships (see [docs](docs/community-skill-packs.md) for the schema).
- The README row should link to the repo, name the skill count, and one-line what the pack is for.
- In the same PR, add a matching entry to [`skill-packs.json`](catalog/skill-packs.json) - the machine-readable mirror of this table (registry schema in [the docs](docs/community-skill-packs.md#skill-packsjson-community-registry)).

### Two-repo strategy

This repo is a public template. Run your own instance as a **private fork** so memory, articles, and API keys stay private:

```bash
git remote add upstream https://github.com/aaronjmars/aeon.git
git fetch upstream
git merge upstream/main --no-edit
```

Your `memory/`, `articles/`, and personal config won't conflict - they're in files that don't exist in the template.

### GitHub Actions cost

![Basically free - runs on your existing Claude subscription and a free GitHub account](./assets/free-aeon.jpg)

| Scenario | Cost |
|----------|------|
| No skill matched (most ticks) | ~10s - checkout + bash + exit |
| Skill runs | 2–10 min depending on complexity |
| Heartbeat (nothing found) | ~2 min |
| **Public repo** | **Unlimited free minutes** |

Private repos: Free plan = 2,000 min/mo, Pro/Team = 3,000 + $0.008/min overage. To reduce usage: switch to `*/15` or hourly cron, disable unused skills, keep the repo public. Every run logs token usage to `memory/token-usage.csv`; the `cost-report` skill generates a cost breakdown by skill and model.

### Project structure

![The Stack](./assets/stack-aeon.jpg)

```
CLAUDE.md                ← agent identity (auto-loaded by Claude Code)
STRATEGY.md              ← north-star: goal, priorities, audience, constraints (rides along every run)
aeon.yml                 ← skill schedules, chains, reactive triggers, enabled flags
aeon                     ← launch the local dashboard (run ./aeon; Next.js on port 5555)
notify                   ← multi-channel notifications (Telegram, Discord, Slack, Email, json-render)
notify-jsonrender        ← convert skill output to dashboard feed cards via Haiku
catalog/                 ← registries the dashboard reads (generated + hand-authored)
  skills.json            ← machine-readable skill catalog (69 skills, category per skill)
  packs.config.json      ← first-party pack definitions (core allowlist + pack list)
  packs.json             ← generated pack catalog (10 packs)
  skill-packs.json       ← community skill-pack registry
bin/                     ← operator + maintainer CLI (run from repo root, e.g. bin/add-skill)
  onboard                ← validate the fork's setup (secrets, workflows, channels)
  add-skill              ← import skills from GitHub repos (with security scanning)
  add-mcp                ← register Aeon as an MCP server for Claude Desktop/Code
  install-skill-pack     ← install a curated community skill pack
  export-skill           ← package skills for standalone distribution
  new-from-template      ← scaffold a skill from a template (--category sets its pack)
  generate-skills-json   ← regenerate catalog/skills.json from SKILL.md files
  generate-packs-json    ← regenerate catalog/packs.json from the two configs above
docs/                    ← GitHub Pages site (articles, activity log, memory)
soul/                    ← optional identity files (SOUL.md, STYLE.md, examples/, data/)
skills/                  ← each skill is a SKILL.md prompt file (69 total; `category:` = its pack)
workflow-templates/      ← GitHub Agentic Workflow templates (.md)
skill-templates/         ← templates for building your own skills
apps/                    ← standalone sub-projects, each with its own package.json
  dashboard/             ← local web UI (Next.js + json-render feed)
  mcp-server/            ← MCP server - exposes skills as Claude tools
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

Aeon is an AI agent system that runs unattended on GitHub Actions, self-heals when skills fail, and monitors its own output quality. Configure once, walk away - it handles recurring tasks like briefings, market monitoring, PR reviews, and research digests.

### Can I create custom skills?

Yes. Bootstrap from [`skill-templates/`](skill-templates/TEMPLATE.md) (`bin/new-from-template <template> <skill-name> --var KEY=VALUE...`), describe one to the `create-skill` skill, or label a GitHub issue `ai-build` and let Aeon build it.

### Troubleshooting

- **Dashboard not loading** - make sure `./aeon` is running and check `http://localhost:5555`.
- **Skills not executing** - run `bin/onboard --remote` to verify setup, check GitHub Actions workflow status.
- **Notifications not working** - verify channel secrets in the dashboard (Telegram/Discord/Slack tokens).
- **Self-healing not working** - enable `skill-repair` and `skill-health`, check `memory/` state.

### Need more help?

Check the [`docs/`](docs/) directory, run `bin/onboard` for setup verification, or open an issue on GitHub.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=aaronjmars/aeon&type=Date)](https://www.star-history.com/#aaronjmars/aeon&Date)

Support the project : 0xbf8e8f0e8866a7052f948c16508644347c57aba3

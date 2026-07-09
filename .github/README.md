<p align="center">
  <img src="../docs/assets/aeon.jpg" alt="Aeon" width="120" />
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
  Give it a direction — it'll use 59 skills to get it done: ship features to your repos, find and disclose real vulnerabilities, deploy live apps, run deep research — even write new skills for itself. No approval loops. No babysitting. Configure once, forget forever.
</p>

<p align="center">
  <img src="../docs/assets/aeon-demo.gif" alt="Aeon Demo" />
</p>

---

## Quick start

You need three things:

1. **Node.js 20+** - grab the LTS installer from [nodejs.org](https://nodejs.org/en/download), or use a package manager: `brew install node` (macOS), `winget install OpenJS.NodeJS.LTS` (Windows), [nvm](https://github.com/nvm-sh/nvm) or your distro's package manager (Linux). Already have it? `node -v` should print 20 or higher.
2. **[GitHub CLI](https://cli.github.com/) (`gh`), authenticated** - the dashboard uses it for everything (secrets, workflows), and `./aeon` checks it before starting. Install: `brew install gh` (macOS), `winget install --id GitHub.cli` (Windows), [per-distro instructions](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) (Linux). Then run `gh auth login` and follow the prompts.
3. **Your own copy of this repo** - click **Use this template** at the top of [the repo page](https://github.com/aaronjmars/aeon) - keep it public, Actions minutes are free on public repos. CLI version: `gh repo fork aaronjmars/aeon --clone`.

   <img src="../docs/assets/use-this-template.png" alt="The Use this template button at the top of the repo page" width="320" />

```bash
git clone https://github.com/<you>/aeon   # skip if you used `gh repo fork --clone`
cd aeon && ./aeon
```

Open [http://localhost:5555](http://localhost:5555) and follow the four steps:

1. **Authenticate** - connect your Claude Pro/Max subscription or your X account (for the [Grok harness](#harnesses)), or paste an API key: Anthropic, Anthropic-compatible, or a [gateway key](#llm-gateways) (Bankr, OpenRouter, UsePod, Venice, Surplus, Grok) - routed automatically.
2. **Add a channel** - [Telegram, Discord, Slack, or email](#notifications) so Aeon can talk to you.
3. **Pick skills** - toggle what you want, set schedules. Each skill shows the API keys and MCP servers it needs, with one-click setup.
4. **Run** - hit **Run now** on any skill to try it immediately; API keys and `var` values apply directly, no push needed. When you change config (schedules, toggles), **Push** commits it to GitHub in one click so Actions runs it on cron.

That's it - Aeon now runs unattended. On a public repo, GitHub Actions minutes are **free**.

Dashboard views, local dev, env vars, and remote access are documented in [`apps/dashboard/README.md`](../apps/dashboard/README.md).

**Prefer the terminal?** Everything the dashboard does is also a command — `./aeon skills ls`, `./aeon skills enable <name>`, `./aeon secrets set …`, `./aeon runs logs <id>`. Same logic, no browser, scriptable with `--json`. See [Command line (headless)](#command-line-headless).

<details>
<summary><strong>No admin rights / can't install <code>gh</code>?</strong></summary>

Grab the `gh_*_macOS_arm64.zip` (or your platform's binary) from [github.com/cli/cli/releases](https://github.com/cli/cli/releases) and drop it on your `PATH` (e.g. `~/.local/bin`). Then `gh auth login`.

</details>

---

## What Aeon can do

**59 skills, grouped into 6 packs.** By default the dashboard shows **Core**, **Evolution**, and **Basics**; everything else is hidden until you **enable its pack** in the **Packs** view - a visibility switch that reveals a pack's skills across the UI without running anything. Putting a skill on duty stays a per-skill toggle. Every skill is independently installable, schedulable, and chainable. How packs work: [`docs/skill-packs.md`](../docs/skill-packs.md).

| Pack | Key | Skills | Examples |
| --- | --- | --- | --- |
| 🧬 **Core** - fleet coordination, self-config, liveness; shown by default | `core` | 11 | `fleet-control`, `spawn-instance`, `auto-workflow` |
| ♻️ **Evolution** - authors, evolves, installs & heals its own skills; shown by default | `evolution` | 7 | `create-skill`, `autoresearch`, `skill-repair` |
| ⭐ **Basics** - simple, immediately-runnable skills; shown by default | `basics` | 13 | `digest`, `token-movers`, `pr-review` |
| 💻 **Dev & Code** | `dev` | 8 | `github-monitor`, `feature`, `deploy-prototype` |
| 📈 **Crypto & Markets** | `crypto` | 12 | `token-pick`, `defi-overview`, `ctrl` |
| ✅ **Productivity** | `productivity` | 8 | `mention-radar`, `send-email`, `okf-export` |

<details>
<summary><strong>Full catalog (all 59 skills by pack)</strong></summary>

Three packs are shown by default (**Core**, **Evolution**, **Basics**); the rest are revealed on demand.

| Pack | Skills |
|------|--------|
| **Core** (`core`, 11) | `auto-merge`,`auto-workflow`,`fleet-control`,`fork-fleet`,`heartbeat`,`memory-flush`,`narrative-convergence`,`shiplog`,`soul-builder`,`spawn-instance`,`strategy-builder` |
| **Evolution** (`evolution`, 7) | `autoresearch`,`create-skill`,`install-skill`,`search-skill`,`self-improve`,`skill-health`,`skill-repair` |
| **Basics** (`basics`, 13) | `action-converter`,`article`,`bd-radar`,`digest`,`fetch-tweets`,`github-trending`,`idea-forge`,`last30`,`pr-review`,`price-alert`,`token-movers`,`tx-explain`,`write-tweet` |
| **Dev & Code** (`dev`, 8) | `changelog`,`deploy-prototype`,`feature`,`github-monitor`,`inbox-triage`,`pr-triage`,`vuln-scanner`,`vuln-tracker` |
| **Crypto & Markets** (`crypto`, 12) | `base-mcp`,`ctrl`,`defi-overview`,`distribute-tokens`,`investigation-report`,`monitor-polymarket`,`narrative-tracker`,`onchain-monitor`,`picks-tracker`,`pm-manipulation`,`token-pick`,`unlock-monitor` |
| **Productivity** (`productivity`, 8) | `idea-pipeline`,`mention-radar`,`okf-export`,`okf-ingest`,`operator-scorecard`,`reply-maker`,`schedule-ads`,`send-email` |

Authoritative source: [`skills.json`](../catalog/skills.json) + [`packs.json`](../catalog/packs.json), the dashboard **Packs** view, or `bin/add-skill aaronjmars/aeon --list`. A skill's pack comes from its `category:` frontmatter - see [`docs/skill-packs.md`](../docs/skill-packs.md).

</details>

### It heals itself

![Anatomy of a skill run](../docs/assets/skill-run-aeon.jpg)

Every skill output is automatically scored 1–5 by Haiku after each run. Scores and failure flags (`api_error`, `stale_data`, `rate_limited`) are tracked per skill in `memory/skill-health/` with a rolling 30-run history. When something breaks, the loop fixes it without you:

![Self-healing architecture](../docs/assets/architecture-aeon.jpg)

1. **`heartbeat`** (daily) - detects failed, stuck, or chronically broken skills
2. **`skill-health`** - audits quality scores and flags API degradation patterns
3. **`skill-repair`** - diagnoses and patches failing skills automatically
4. **`self-improve`** - evolves prompts, config, and workflows based on performance

Health skills file issues, repair skills close them. `heartbeat` is the only skill enabled by default: nothing to report → silent; something needs attention → one notification. Deep dive: [`docs/CORE.md`](../docs/CORE.md).

**Votable health** (on by default — set the repo variable `HEALTH_ISSUES=0` to turn it off): when a skill regresses (a Haiku score of 1–2 or a failure flag), the loop opens or comments on a per-skill GitHub Issue titled `health: <skill>`; clean runs stay silent, so there's no issue spam. 👍/👎 the issue and `self-improve` / `skill-repair` triage the most-voted, worst-scoring skills first — a visible, conflict-free repair queue you can steer.

### It replicates

Aeon can spawn and manage copies of itself. `spawn-instance` forks the repo into a new specialized instance (`var: "crypto-tracker: monitor DeFi protocols"`), selects relevant skills, and registers it in `memory/instances.json` - no secrets propagated, billing stays isolated. `fleet-control` health-checks and dispatches across instances; its `scorecard` mode tracks fleet economics.

### It ships real work

`feature` ships code unprompted — to your watched repos, or to any repo with `var: external:<owner/repo>`. `deploy-prototype` generates and deploys live web apps to Vercel. `vuln-scanner` finds real vulnerabilities and discloses them responsibly. `autoresearch` evolves existing skills through scored variations, and `create-skill` generates new ones from a sentence.

### Add more skills

```bash
bin/add-skill aaronjmars/aeon --list        # browse the built-in catalog
bin/add-skill BankrBot/skills bankr hydrex  # install from any GitHub repo
bin/add-skill BankrBot/skills --all         # install everything from a repo
bin/export-skill token-movers               # package one for standalone use
```

Installed skills land in `skills/` and are added to `aeon.yml` disabled - flip `enabled: true` to activate. You can also:

- **Build your own** from [`docs/examples/skill-templates/`](../docs/examples/skill-templates/TEMPLATE.md): `bin/new-from-template <template> <skill-name> --category <pack>` - the `--category` slots it into a pack (or set `category:` in the SKILL.md frontmatter). See [`docs/skill-packs.md`](../docs/skill-packs.md).
- **Use one skill elsewhere** without forking: drop a portable workflow from [`docs/examples/workflow-templates/`](../docs/examples/workflow-templates) into any repo's `.github/workflows/`.
- **Label any GitHub issue `ai-build`** - Claude reads the issue, implements it, and opens a PR
- **Install community packs** - see [Community skill packs](#community-skill-packs)

---

## Proof of work

Aeon isn't a demo reel — its skills ship real, verifiable output in production. A snapshot of what they've done in the wild (live numbers at **[aeon.fun](https://www.aeon.fun)**):

| Skill | In production |
|-------|---------------|
| 🛡️ **`vuln-scanner`** | **54 open-source repos secured** — real vulnerabilities found, patched, and responsibly disclosed across projects with **~1.6M combined GitHub stars** (31 rated High/Critical). [Every disclosure →](https://www.aeon.fun/security) |
| 🌐 **ecosystem** | **72 products & agents** built on Aeon. [`ECOSYSTEM.md`](../docs/ECOSYSTEM.md) |
| 🛰️ **`fork-fleet`** | **24 active forks** running their own Aeon instances. [`SHOWCASE.md`](../docs/SHOWCASE.md) |
| 📦 **community** | **10 community skill packs** published to the registry. [`community-skill-packs.md`](../docs/community-skill-packs.md) |

<sub>Security figures are a snapshot as of 2026-07-06; the live dashboard updates continuously.</sub>

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

For a comparison against the broader ecosystem (AutoGen, CrewAI, n8n, LangGraph) and active forks in production, see [`SHOWCASE.md`](../docs/SHOWCASE.md). For products built on Aeon, see [`ECOSYSTEM.md`](../docs/ECOSYSTEM.md).

![Autonomy spectrum](../docs/assets/autonomy-aeon.jpg)

---

## Configure

![Aeon never sleeps - a full day of autonomous runs](../docs/assets/never-sleeps-aeon.jpg)

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

Standard cron format, all times UTC. Supports `*`, `*/N`, exact values, comma lists. On each tick the scheduler dispatches **every** enabled skill whose cron is due, and multiple due skills run in parallel. The only thing that orders dispatch is `depends_on:` (a skill's dependencies fire first); `heartbeat` is listed last purely by convention.

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
| Email | `RESEND_API_KEY` + `NOTIFY_EMAIL_TO` | - |

**Telegram:** Create a bot with @BotFather → get token + chat ID. Saving the bot token in the dashboard **auto-registers** the slash-command menu (`/skillname` dispatches instantly, no LLM) — no manual step; a **Re-register commands** button re-syncs it after you toggle skills, and every notification carries **Run again / Schedule weekly** quick-action buttons, deep links, and stateless follow-up questions. Full guide: [docs/telegram-commands.md](../docs/telegram-commands.md).
**Discord:** Outbound: Channel → Integrations → Webhooks → Create. Inbound: discord.com/developers → bot → add `channels:history` scope → copy token + channel ID.
**Slack:** api.slack.com → Create App → Incoming Webhooks → install → copy URL. Inbound: add `channels:history`, `reactions:write` scopes → copy bot token + channel ID.
**Email:** resend.com/api-keys → Create API Key → add as `RESEND_API_KEY`, set `NOTIFY_EMAIL_TO` to your inbox. Optional repo variables: `NOTIFY_EMAIL_FROM` (default `aeon@notifications.aeon.bot` — **must be a domain/sender verified in Resend**), `NOTIFY_EMAIL_SUBJECT_PREFIX` (default `[Aeon]`). This is the same `RESEND_API_KEY` used for security disclosures, so one Resend key powers all of Aeon's outbound email.

**Restrict who can command the agent (inbound):** Telegram is already scoped to a single `TELEGRAM_CHAT_ID`. For Discord and Slack, set the optional repo variables `DISCORD_ALLOWED_AUTHOR_ID` / `SLACK_ALLOWED_USER_ID` (or same-named secrets) to the authorized sender's user ID — inbound messages from anyone else in the channel are then ignored. **Leaving them unset processes commands from any non-bot member of the channel**, so set them whenever the channel isn't private to you.

Want ~1s Telegram replies instead of up-to-5-min polling? See [Telegram instant mode](#telegram-instant-mode).

### API keys per skill

Skills that call third-party APIs declare their credentials in a `requires:` frontmatter list, so the dashboard shows **which skill needs which key**:

```yaml
requires: [XAI_API_KEY, COINGECKO_API_KEY?]   # bare = required · `?` = works better with
```

The dashboard surfaces this as an **API keys** panel on each skill (set/unset status, inline "Set" button), a ⚠ flag when an enabled skill is missing a required key, and a **"used by"** index under each key in Settings → Access Keys. Skills can likewise declare MCP servers with an `mcp:` list (`mcp: [base]`) - same two tiers, shown as a per-skill **MCP servers** panel with install state. Convention details: [`docs/examples/skill-templates/TEMPLATE.md`](../docs/examples/skill-templates/TEMPLATE.md#declaring-api-keys-requires).

---

## Advanced

Everything below is optional - Aeon runs fine without any of it.

### Capability tiers (read-only skills)

A skill declares its write blast-radius in SKILL.md frontmatter:

```yaml
mode: read-only   # may read the repo, fetch the web, and ./notify — but cannot mutate the repo
mode: write       # full access (the default): adds Write / Edit / git / gh / python3
```

`read-only` strips the repo-mutation tools from Claude Code's `--allowedTools` (`Write`, `Edit`, `Bash(git:*)`, `Bash(gh:*)`), so a research-and-notify skill **physically can't** commit, push, or open a PR — a post-run guard still saves its `memory/` + `output/` and reverts any stray write. Use it for pure read-and-notify skills; `write` (the default, a strict superset) for anything that writes code. It's the runtime half of the install-time [`capabilities:`](../docs/CAPABILITIES.md) hint.

### Durable state without the churn

Per-skill execution state (`memory/cron-state.json` — status, success rate, quality) is **dual-written** by default: each run commits the file *and* appends an immutable event to a closed, append-only GitHub Issue (`aeon:cron-state`), so concurrent runs never race — no rewrite, force-push, or rebase-retry. The repo variable **`STATE_BACKEND`** switches this: `dual` (default) · `issues` (append-only, zero file churn) · `file` (legacy file-only). Chains record to the same ledger.

### Knowledge (OKF)

Aeon's knowledge is a native **[OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) (Open Knowledge Format) v0.1** bundle — a portable, self-describing markdown corpus other tools and agents can read straight from the repo. It's **in place, not a separate export**: the real files *are* the bundle, each carrying a `type:` frontmatter field. The Aeon **MCP server** serves it as read-only resources (`okf://index`, `okf://concept/{id}`, `okf://skill/{slug}`), and two optional skills — **`okf-export`** and **`okf-ingest`** — backfill notes and import external bundles. The scope, the `type:` vocabulary, and the `ci-okf` validation gate are in [`docs/OKF.md`](../docs/OKF.md).

### Skill chaining

Chain skills so outputs flow between them. Chains run as separate GitHub Actions workflow steps via `chain-runner.yml`:

```yaml
chains:
  digest-pipeline:
    schedule: "0 7 * * *"
    on_error: fail-fast       # or: continue
    steps:
      - parallel: [token-movers, github-trending]   # run concurrently
      - skill: digest, consume: [token-movers, github-trending]   # runs after; outputs injected
```

Each step runs as a separate workflow dispatch; outputs are saved to `output/.chains/{skill}.md` and injected into downstream steps that `consume:` them. `fail-fast` aborts on any failure, `continue` keeps going.

### Reactive triggers

Skills with `schedule: "reactive"` fire on conditions, not cron. The scheduler evaluates triggers after processing cron skills:

```yaml
reactive:
  skill-repair:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }
```

### Scheduler frequency

Edit `.github/workflows/scheduler.yml`:

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
cp docs/examples/mcp/.mcp.json.example .mcp.json   # then edit, commit, push
```

The example ships two working servers — `github` (uses the runner's built-in `GITHUB_TOKEN`) and `sequential-thinking` (no-auth stdio). On the next run the runner loads `.mcp.json` and auto-allows every server's tools, so a skill can just say *"use the github MCP server to …"*. Reference a server's secret with `${VAR}` (never commit the value) and set it in the dashboard — the runner resolves it from the repo's secrets with zero workflow editing, and skips a server (with a warning) when its secret is missing rather than breaking the skill.

Or skip the file entirely: the dashboard's **MCP** tab writes `.mcp.json` for you, lists **Featured** servers (e.g. [Base](https://mcp.base.org)) for one-click install, and tells you which secret each server needs.

### Use Aeon's skills from Claude (MCP)

Aeon skills work outside GitHub Actions too - locally via `claude -p -`, identical to Actions. API keys are read from your environment or a `.env` file in the repo root.

**Claude (MCP)** - every skill appears as an `aeon-<name>` tool in Claude Desktop and Claude Code:

```bash
bin/add-mcp                    # build and register
bin/add-mcp --desktop          # also print Claude Desktop config
bin/add-mcp --uninstall        # remove
```

Tool naming, the `var` argument, Claude Desktop config, and a test client are in [`apps/mcp-server/README.md`](../apps/mcp-server/README.md).

### Command line (headless)

The dashboard is a web console over `gh` + `git` + your repo files. The **`aeon` CLI** exposes the same features as commands — no browser, no server, scriptable. It reuses the dashboard's exact logic (`apps/dashboard/lib`), so the two never drift.

`./aeon` with **no args** launches the dashboard; **`./aeon <command>`** runs the CLI:

```bash
./aeon skills ls --enabled            # roster + live state
./aeon skills enable action-converter # edit aeon.yml, commit + push
./aeon skills run heartbeat --var brief   # dispatch a run (gh workflow run)
./aeon runs ls          ./aeon runs logs <id>
./aeon secrets ls       ./aeon secrets set COINGECKO_API_KEY --stdin
./aeon config show      ./aeon config set model claude-opus-4-8
./aeon memory search "okf"
./aeon strategy build "grow weekly active users"   ./aeon soul build --handle @you
./aeon packs ls         ./aeon mcp ls        ./aeon telegram register
```

- **`--json`** on any command for scripting; **`--dry-run`** on any *write* to preview it (diff or the exact `gh` command) without touching anything; **`--help`** per command. Destructive `skills rm` needs `--yes`.
- Writes commit + **push config to `origin`** exactly like the dashboard, so scheduled runs pick them up. Read-only commands (`skills ls`, `config show`, `memory`) work without `gh`; GitHub-touching ones (`runs`, `secrets`, `auth`, `skills run`) use your authenticated `gh`.
- Self-contained: first run installs a ~12MB runtime (`tsx` + `yaml`) — the full dashboard app is **not** required. Symlink it onto `PATH` (`ln -s "$PWD/apps/cli/aeon" /usr/local/bin/aeon`) to drop the `./`.

Full command reference: [`apps/cli/README.md`](../apps/cli/README.md).

Working client scripts (MCP stdio, Claude Desktop) live in [`docs/examples/`](../docs/examples) - each calling a real skill end-to-end. Start with [`docs/examples/README.md`](../docs/examples/README.md).

### Cross-repo access

The built-in `GITHUB_TOKEN` is scoped to this repo only. For `github-monitor`, `pr-review`, and `feature` to work on your other repos, add a `GH_GLOBAL` personal access token: github.com/settings/tokens → Fine-grained → set repo access → grant Contents, Pull requests, Issues (read/write) → add as `GH_GLOBAL` secret. Skills use it when available and fall back to `GITHUB_TOKEN` automatically.

### LLM Gateways

<p align="center">
  <img src="../docs/assets/providers.png" alt="Eight AI providers supported: Claude subscription, Anthropic API, OpenRouter, Bankr, UsePod, Venice, Surplus, Grok" width="640" />
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

Wiring a new provider through the dashboard registry, resolver, and workflow `env:` is a contributor task — the step-by-step (native vs sidecar tiers, the five files, how to verify the loop) lives in [`CONTRIBUTING.md`](CONTRIBUTING.md#contributing-an-llm-gateway).

### Harnesses

The **harness** is the coding-agent CLI that actually runs your skills. It's a separate axis from the gateways above (which only swap the *model* behind Claude Code):

| Harness | CLI | Auth | Models |
|---------|-----|------|--------|
| `claude` (default) | [Claude Code](https://github.com/anthropics/claude-code) (`claude -p`) | `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` / any gateway above | `claude-*` |
| `grok` | [Grok Build](https://x.ai/cli) (`grok -p`) | **X account** (`GROK_CREDENTIALS`) or `XAI_API_KEY` | `grok-composer-2.5-fast` (fast default) · `grok-build` (reasoning/multi-agent; runs single-agent in CI via `--no-subagents`) |

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

**Advanced harness behavior** — token accounting (grok reports 0 tokens), how capability mode maps onto grok's sandbox, MCP on grok, per-skill grok knobs (`max_turns` / `best_of_n` / `verify` / `effort`), and how every entry point (chains, inbound messages, the MCP server, the scorer) picks a harness — is in [`docs/harnesses.md`](../docs/harnesses.md).

### Observability (Langfuse)

Optional, opt-in tracing. Set the repo secrets `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` (dashboard → Secrets → *Observability*) and every Claude Code run streams to your [Langfuse](https://langfuse.com) project as a trace — LLM calls (model, tokens, cost, latency), tool calls, and (by default) the prompts and responses. It's a pure no-op when the keys are unset.

Under the hood `scripts/langfuse-otel.sh` exports Claude Code's OpenTelemetry env so its span tree ships to Langfuse's OTLP endpoint — out of band, so a Langfuse outage never affects a run. Region/toggles are repo **variables**: `LANGFUSE_HOST` (default EU cloud; US = `https://us.cloud.langfuse.com`), `LANGFUSE_TRACING=0` to disable, `LANGFUSE_LOG_CONTENT=0` for metadata-only (no prompt/response text). Covers the skill run, scorer, feed, and message poller; the grok harness is not traced. Full guide: [docs/langfuse.md](../docs/langfuse.md).

### Provenance (attestation)

Optional, off by default. Set the repo variable `ATTEST_ENABLED=true` and successful skill runs get a Sigstore-signed [GitHub Artifact Attestation](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds) binding the run's output bytes to the exact workflow identity that produced them — repo, commit SHA, `aeon.yml`, runner, trigger — logged to the public Rekor transparency log. Anyone can then confirm a piece of Aeon output really came from an unmodified skill at a known commit (`gh attestation verify <file> --repo <owner>/<repo>`), without trusting you. It proves *provenance of bytes*, not correctness of behaviour, and touches **zero skills** — it runs in the trusted workflow layer on output Aeon already captures.

Opt in per skill with `attest: true` in `aeon.yml` (or `attest: false` to force-exclude), or in a `SKILL.md`'s frontmatter to make it travel with the skill; with neither, the default policy attests only runs that **published to the json-render feed** (the trust boundary that benefits), keeping the public Rekor log meaningful. **Public repos work on any plan; private repos need GitHub Team/Enterprise.** Full guide: [docs/attestation.md](../docs/attestation.md).

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

### Telegram instant mode

Replies aren't instant by default - Aeon runs on GitHub Actions and polls Telegram every 5 minutes. That's by design: it's built for autonomous background work, not real-time chat. For ~1-second replies, deploy the self-contained Cloudflare Worker in [`apps/webhook/`](../apps/webhook) into your own Cloudflare account (no shared infra, no credential custody) - a one-time setup of about 5 minutes:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/aaronjmars/aeon/tree/main/apps/webhook)

The deploy wizard prompts for the four variables (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_REPO`, `GITHUB_TOKEN`) and stores them as encrypted Worker secrets, so the Worker comes out configured - then point your bot at it with `setWebhook`. The dashboard walks through all three steps with one-click webhook registration: **Settings → Credentials → Telegram → ⚡ Instant replies**. The button needs a **public** source repo - on a private fork, mirror `apps/webhook/` to a small public repo and point the button URL there.

Full guide: [`apps/webhook/README.md`](../apps/webhook/README.md). The poller detects an active webhook (`getWebhookInfo`) and skips Telegram polling automatically, so the two never conflict. The Worker also routes slash commands, button taps, and reply follow-ups (see [docs/telegram-commands.md](../docs/telegram-commands.md)) — **redeploy it after updating** to pick those up.

### Remote dashboard access

The dashboard's `/api/*` routes drive `gh workflow run` and read/write repo secrets, so they're gated to loopback callers by default - no remote callers, no DNS-rebinding from a malicious page. To reach the dashboard from another machine or over a tunnel (Tailscale, ngrok, reverse proxy):

| Env var | Behaviour |
|---|---|
| `AEON_DASHBOARD_ALLOWED_HOSTS=aeon.local,box.tail-xxx.ts.net` | Extends the loopback allowlist by hostnames (comma-separated, case- and port-insensitive) |
| `AEON_DASHBOARD_ALLOW_ANY_HOST=1` | Disables Host-header checking entirely. Only for a trusted reverse proxy that terminates `Host` upstream - loudly insecure otherwise |

The gate also rejects state-changing requests whose `Origin` isn't allowlisted, so a malicious page can't drive `/api/secrets` via a no-cors POST. Code: [`apps/dashboard/proxy.ts`](../apps/dashboard/proxy.ts) + [`apps/dashboard/lib/security/api-gate.ts`](../apps/dashboard/lib/security/api-gate.ts).

### Fleet Watcher (authorization layer)

Optional inline ALLOW/BLOCK authorization in front of every skill run: each workflow asks a self-hosted **Fleet Watcher** control plane *"is this allowed?"* before Claude starts (BLOCK = the run exits non-zero and Claude never runs, with an audit ref recorded). It's already wired into `aeon.yml` as two opt-in steps that no-op unless `FLEET_ENDPOINT` + `FLEET_TOKEN` are set — and fail **closed** (skill doesn't run) if Fleet is unreachable when they are. Define your red lines (per-skill caps, counterparty allowlists, dangerous-string patterns) in its dashboard; the postflight always runs so blocked skills are still recorded.

### Community skill packs

![Aeon Framework ecosystem map](../docs/assets/ecosystem-aeon.jpg)

> Aeon's **built-in (first-party) packs** - Core, Evolution, Basics, Dev, Crypto, Productivity - live in this repo and are enabled from the dashboard's **Packs** view; see [`docs/skill-packs.md`](../docs/skill-packs.md). The packs below are **community** collections in their own repos.

Third-party skill collections in their own repos, installable as one bundle - two ways:

**One-click (dashboard).** Open the **Packs** view, scroll to **Community packs**, and hit **Install pack** on any card. That runs the security-scanned installer in the background and ships an **auto-merging PR**, so the skills land on `main` (and show up across the dashboard) with no manual step. Want to merge it yourself instead? The card's copy button hands you the exact CLI command below.

**CLI.**

```bash
bin/install-skill-pack AntFleet/aeon-skills
bin/install-skill-pack --list      # browse the registry (skill-packs.json)
```

Either way the installer reads the pack's `skills-pack.json` manifest, runs the security scanner on each `SKILL.md`, and copies approved skills into `skills/` - **disabled** in `aeon.yml` (nothing runs until you set the pack's secrets and flip `enabled: true`), with provenance recorded in `skills.lock`. Full schema and trust model: [`docs/community-skill-packs.md`](../docs/community-skill-packs.md).

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
| [aeon-skill-pack-agentlink](https://github.com/techdigger/aeon-skill-pack-agentlink) | 1 | Give an agent a verified, human-backed on-chain identity on Base via AgentLink - checks link status, hands the human owner a linker URL to biomap + sign, then signs requests to free partner endpoints (XONA, WURK). Read-only, on-demand. |

**To list a pack here**, open a PR that adds a table row **and** a matching [`catalog/skill-packs.json`](../catalog/skill-packs.json) entry. The full checklist — public repo + license, a per-skill `SKILL.md`, a `skills-pack.json` manifest, the registry schema, and the trust model — is in [`docs/community-skill-packs.md`](../docs/community-skill-packs.md#pack-maintainers-publishing-checklist).

### Two-repo strategy

This repo is a public template. Run your own instance as a **private fork** so memory, articles, and API keys stay private:

```bash
git remote add upstream https://github.com/aaronjmars/aeon.git
git fetch upstream
git merge upstream/main --no-edit
```

Your `memory/`, `output/`, and personal config won't conflict - they're in files that don't exist in the template.

### GitHub Actions cost

![Basically free - runs on your existing Claude subscription and a free GitHub account](../docs/assets/free-aeon.jpg)

| Scenario | Cost |
|----------|------|
| No skill matched (most ticks) | ~10s - checkout + bash + exit |
| Skill runs | 2–10 min depending on complexity |
| Heartbeat (nothing found) | ~2 min |
| **Public repo** | **Unlimited free minutes** |

Private repos: Free plan = 2,000 min/mo, Pro/Team = 3,000 + $0.008/min overage. To reduce usage: switch to `*/15` or hourly cron, disable unused skills, keep the repo public. Every run logs token usage to `memory/token-usage.csv` for a per-skill, per-model cost breakdown.

### Project structure

An annotated tour of the repo layout — every top-level directory and the key
files in each — lives in [`CONTRIBUTING.md`](CONTRIBUTING.md#project-layout).

---

## FAQ

### What is Aeon?

Aeon is an AI agent system that runs unattended on GitHub Actions, self-heals when skills fail, and monitors its own output quality. Configure once, walk away - it handles recurring tasks like briefings, market monitoring, PR reviews, and research digests.

### Can I create custom skills?

Yes. Bootstrap from [`docs/examples/skill-templates/`](../docs/examples/skill-templates/TEMPLATE.md) (`bin/new-from-template <template> <skill-name> --var KEY=VALUE...`), describe one to the `create-skill` skill, or label a GitHub issue `ai-build` and let Aeon build it.

### Troubleshooting

- **Dashboard not loading** - make sure `./aeon` is running and check `http://localhost:5555`.
- **Skills not executing** - run `bin/onboard --remote` to verify setup, check GitHub Actions workflow status.
- **Notifications not working** - verify channel secrets in the dashboard (Telegram/Discord/Slack tokens).
- **Self-healing not working** - enable `skill-repair` and `skill-health`, check `memory/` state.

### Need more help?

Check the [`docs/`](../docs) directory, run `bin/onboard` for setup verification, or open an issue on GitHub.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=aaronjmars/aeon&type=Date)](https://www.star-history.com/#aaronjmars/aeon&Date)

Support the project : 0xbf8e8f0e8866a7052f948c16508644347c57aba3

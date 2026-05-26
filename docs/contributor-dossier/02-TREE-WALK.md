# Tree Walk

Annotated tour of every top-level directory and significant file. Read this once, then use it as a map.

---

## Root files

| Path | What it is |
|---|---|
| [`README.md`](../../README.md) | The public-facing manual. Quick start, skill catalog, configuration, MCP/A2A, ecosystem links. ~670 lines. |
| [`CLAUDE.md`](../../CLAUDE.md) | Agent identity + system instructions auto-loaded by Claude Code on every skill run. Voice rules, memory protocol, security rules, sandbox patterns. |
| [`SHOWCASE.md`](../../SHOWCASE.md) | Active forks table + comparison vs AutoGen/CrewAI/n8n/LangGraph. |
| [`ECOSYSTEM.md`](../../ECOSYSTEM.md) | ~50 downstream products listed by name + X handle. |
| [`LICENSE`](../../LICENSE) | MIT-style. |
| [`aeon.yml`](../../aeon.yml) | The configuration. 276 lines: every skill's `enabled`/`schedule`/`var`/`model`; the `chains:`, `reactive:`, `gateway:` blocks; the global `model` default. |
| [`skills.json`](../../skills.json) | 80KB machine-readable catalog generated from `SKILL.md` frontmatter via `./generate-skills-json`. Don't hand-edit. |
| [`skill-packs.json`](../../skill-packs.json) | Registry of community skill packs. Mirror of the README table. |

### Top-level executables

All are bash scripts the operator runs directly:

| Path | What it does |
|---|---|
| [`./aeon`](../../aeon) | Launch the local dashboard on port 5555. Pre-checks `gh` auth, installs `dashboard/node_modules`, runs `npm run dev`. |
| [`./onboard`](../../onboard) | Validate a fork's setup: secrets, workflows, channels, memory. `--remote` fires inside Actions. |
| [`./notify-jsonrender`](../../notify-jsonrender) | Convert skill markdown output to a json-render spec via Haiku. Writes to `dashboard/outputs/`. |
| [`./add-skill`](../../add-skill) | Install skills from any GitHub repo. Runs security scan unless source is trusted. Records provenance in `skills.lock`. |
| [`./install-skill-pack`](../../install-skill-pack) | Install a curated pack via `skills-pack.json` manifest. |
| [`./add-mcp`](../../add-mcp) | Build `mcp-server/`, register with Claude Desktop. `--uninstall` to remove. |
| [`./add-a2a`](../../add-a2a) | Build and start the A2A gateway on port 41241. `--print-config` for client examples. |
| [`./generate-skills-json`](../../generate-skills-json) | Rebuild `skills.json` from `SKILL.md` files. |
| [`./new-from-template`](../../new-from-template) | Scaffold a new skill from `templates/`. `--var KEY=VALUE` for token substitution. |
| [`./export-skill`](../../export-skill) | Package a skill as a standalone bundle in `./exports/`. |

`./notify` itself is **not** a checked-in script — it's synthesized inline by [`aeon.yml:319-449`](../../.github/workflows/aeon.yml#L319-L449) on every workflow run. The script in your repo would only exist if you've manually placed one for local testing.

---

## `.github/`

```
.github/
└── workflows/
    ├── aeon.yml             ← THE skill runner (~1000 lines). Validates, prefetches,
    │                          Fleet preflight, runs claude -p -, scores, json-renders,
    │                          postprocesses, Fleet postflight, commits, updates cron-state.
    ├── chain-runner.yml     ← Chain executor (~340 lines). Parses aeon.yml chain blocks,
    │                          dispatches skills (parallel + sequential), builds chain
    │                          context for consume: steps, handles fail-fast vs continue.
    ├── messages.yml         ← Scheduler + inbound message poller (~790 lines). Two jobs:
    │                          tick (every 5min, matches cron, evaluates reactive triggers,
    │                          polls TG/Discord/Slack), run (handles each dispatched msg).
    └── sync-upstream.yml    ← Pulls changes from aaronjmars/aeon into a fork. Manual/cron.
```

Read [`03-subsystems/runtime.md`](03-subsystems/runtime.md) for what each step does and why.

---

## `skills/` — 156 skills, alphabetical

Every skill is a directory containing at least `SKILL.md`. Some skills also have:

- A sidecar config (e.g. `skills/monitor-polymarket/watchlist.md`).
- A bash script (e.g. `skills/skill-security-scan/scan.sh`).
- A reference dataset (e.g. `skills/skill-evals/evals.json`).
- A `README.md` for human readers.

Categories (from `README.md`, ~156 total):

| Category | Count | What they do |
|---|---|---|
| Research & Content | 24 | `agent-displacement`, `ai-framework-watch`, `article`, `channel-recap`, `competitor-launch-radar`, `deep-research`, `digest`, `fetch-tweets`, `hacker-news-digest`, `huggingface-trending`, `last30`, `launch-radar`, `list-digest`, `paper-digest`, `paper-pick`, `reddit-digest`, `research-brief`, `rss-digest`, `security-digest`, `technical-explainer`, `telegram-digest`, `topic-momentum`, `tweet-digest`, `vibecoding-digest` |
| Dev & Code | 41 | `auto-merge`, `auto-workflow`, `autoresearch`, `builder-map`, `changelog`, `code-health`, `create-skill`, `deploy-prototype`, `disclosure-tracker`, `ecosystem-pulse`, `external-feature`, `feature`, `fleet-control`, `fork-cohort`, `fork-fleet`, `fork-release-tracker`, `github-issues`, `github-monitor`, `github-releases`, `github-trending`, `issue-triage`, `pr-review`, `pr-tracker`, `pr-triage`, `project-lens`, `push-recap`, `pvr-triage-monitor`, `pvr-watchlist`, `repo-actions`, `repo-article`, `repo-pulse`, `repo-revive`, `repo-scanner`, `search-skill`, `smithery-manifest`, `spawn-instance`, `star-milestone`, `vercel-projects`, `vuln-scanner`, `vuln-tracker`, `workflow-security-audit` |
| Crypto & Markets | 27 | `aixbt-pulse`, `compute-pulse`, `contributor-reward`, `defi-monitor`, `defi-overview`, `distribute-tokens`, `market-context-refresh`, `monitor-kalshi`, `monitor-polymarket`, `monitor-runners`, `narrative-tracker`, `on-chain-monitor`, `pm-intel`, `pm-manipulation`, `pm-pulse`, `polymarket`, `polymarket-comments`, `price-threshold-alert`, `rwa-pulse`, `token-alert`, `token-movers`, `token-pick`, `token-report`, `treasury-info`, `unlock-monitor`, `wallet-digest`, `x402-monitor` |
| Social & Writing | 14 | `agent-buzz`, `create-campaign`, `engagement-act`, `farcaster-digest`, `product-hunt-launch`, `refresh-x`, `remix-tweets`, `reply-maker`, `schedule-ads`, `show-hn-draft`, `syndicate-article`, `thread-formatter`, `tweet-roundup`, `write-tweet` |
| Productivity | 18 | `action-converter`, `daily-routine`, `deal-flow`, `evening-recap`, `goal-tracker`, `idea-capture`, `idea-pipeline`, `idea-validator`, `milestone-tracker`, `morning-brief`, `note-taking`, `reflect`, `reg-monitor`, `startup-idea`, `tool-builder`, `v4-readiness`, `weekly-review`, `weekly-shiplog` |
| Meta / Agent | 32 | `batch-health`, `config-validator`, `contributor-spotlight`, `cost-report`, `fleet-state`, `fork-contributor-leaderboard`, `fork-first-run-alert`, `fork-skill-digest`, `fork-skill-gap`, `heartbeat`, `janitor`, `memory-flush`, `memory-structural-dedupe`, `onboard`, `operator-scorecard`, `run-frequency-guard`, `rss-feed`, `self-improve`, `self-review`, `signal-verdict`, `skill-analytics`, `skill-enabler`, `skill-evals`, `skill-freshness`, `skill-graph`, `skill-health`, `skill-leaderboard`, `skill-repair`, `skill-security-scan`, `skill-update-check`, `star-momentum-alert`, `update-gallery` |

Specialized subdirectories of interest:

- [`skills/security/`](../../skills/security/) — `trusted-sources.txt`, `scan-baseline.yml`. The supply-chain trust enforcement file lives here.
- [`skills/skill-evals/`](../../skills/skill-evals/) — `evals.json` (the assertion corpus).
- [`skills/skill-security-scan/`](../../skills/skill-security-scan/) — includes `scan.sh` invoked by `add-skill` / `install-skill-pack`.

---

## `memory/` — the working state

See [`03-subsystems/memory.md`](03-subsystems/memory.md) for the full schema. Quick map:

```
memory/
├── MEMORY.md            ← index, ≤50 lines: goals, active topics, pointers
├── cron-state.json      ← scheduling source of truth — per-skill metrics
├── watched-repos.md     ← repos that github-monitor/pr-review/etc. target
├── topics/              ← long-form notes; one topic per file
├── logs/                ← daily YYYY-MM-DD.md, append-only
├── issues/              ← INDEX.md + ISS-NNN.md files; YAML frontmatter
├── skill-health/        ← per-skill JSON with rolling 30-run quality history
└── (state/, instances.json, token-usage.csv, pending-disclosures/ — see memory.md)
```

---

## `dashboard/` — local Next.js control surface

```
dashboard/
├── app/                       ← Next.js App Router
│   ├── page.tsx               ← Main UI
│   └── api/
│       ├── skills/            ← list, toggle, run skills
│       ├── secrets/           ← gh secret list/set/delete
│       ├── auth/              ← Claude OAuth/API key setup
│       ├── outputs/           ← json-render feed
│       └── memory/*           ← read-only memory views
├── components/                ← React Server + Client Components
├── lib/
│   ├── catalog.ts             ← json-render component catalog (15 types)
│   ├── config.ts              ← parses aeon.yml (gateway, channels)
│   ├── constants.ts           ← BANKR_EXTRA_MODELS, etc.
│   ├── github.ts              ← local-vs-Actions mode dispatch
│   └── security/api-gate.ts   ← THE host-header + CSRF gate
├── outputs/                   ← json-render JSON specs (one per skill run)
├── middleware.ts              ← calls gateRequest on every /api/*
├── public/
├── next.config.ts
├── package.json
└── tsconfig.json
```

The dashboard is the only Next.js code in the repo. See [`03-subsystems/dashboard.md`](03-subsystems/dashboard.md).

---

## `mcp-server/` and `a2a-server/`

Two siblings, both single-file TypeScript:

- [`mcp-server/src/index.ts`](../../mcp-server/src/index.ts) (~225 lines) — stdio MCP server, registers every skill as an `aeon-<slug>` tool, shells `claude -p -` for invocations. Built via `./add-mcp`.
- [`a2a-server/src/index.ts`](../../a2a-server/src/index.ts) (~550 lines) — HTTP A2A gateway on port 41241, JSON-RPC + SSE, agent-card discovery. Started via `./add-a2a`.

Both inherit the operator's Claude credentials from env. Both run skills exactly the way Actions does. See [`03-subsystems/mcp-server.md`](03-subsystems/mcp-server.md) and [`03-subsystems/a2a-server.md`](03-subsystems/a2a-server.md).

---

## `examples/` — client integration reference

```
examples/
├── README.md                       ← setup walkthrough for all 5 stacks
├── a2a/
│   ├── langchain_client.py
│   ├── autogen_workflow.py
│   ├── crewai_task.py
│   └── openai_agents_client.py
└── mcp/
    ├── test_connection.py
    └── claude_desktop_config.json
```

Each script is <100 lines, talks to a running A2A gateway or MCP server, calls a real Aeon skill end-to-end. Smoke-tests for your build.

---

## `scripts/` — workflow helpers

```
scripts/
├── prefetch-*.sh             ← run BEFORE Claude (auth, sandbox-bypass for reads)
│   └── prefetch-xai.sh       ←   XAI/Grok x_search → .xai-cache/
├── postprocess-*.sh          ← run AFTER Claude (auth, sandbox-bypass for writes)
│   ├── postprocess-devto.sh
│   ├── postprocess-replicate.sh
│   ├── postprocess-farcaster.sh
│   ├── postprocess-admanage.sh
│   └── postprocess-admanage-create.sh
├── eval-audit                ← coverage audit for skill-evals
├── skill-runs                ← audit recent GH Actions skill runs (--hours N --failures --json)
├── generate-feed.sh          ← rebuild articles/feed.xml (RSS)
├── sync-site-data.sh         ← copy memory/logs into docs/_data for Jekyll
└── sync-upstream.sh
```

The prefetch / postprocess pattern is the sandbox-escape mechanism. See [`05-SECURITY.md`](05-SECURITY.md) § Surface 3 and [`06-IMPLEMENTATION-PATTERNS.md`](06-IMPLEMENTATION-PATTERNS.md) § Sandbox patterns.

---

## `templates/` — skill scaffolds

Six pre-built starters for `./new-from-template`:

```
templates/
├── TEMPLATE.md               ← how to write a template + token convention
├── code-reviewer/
├── community-manager/
├── crypto-tracker/
├── deploy-watcher/
├── research-digest/
└── social-monitor/
```

Each template has a `SKILL.md` with `[REPLACE: KEY]` tokens that `./new-from-template <name> <skill-name> --var KEY=VALUE` fills in.

---

## `workflows/` (template, NOT `.github/workflows/`)

```
workflows/
└── (GitHub Agentic Workflow Markdown templates)
```

These are GitHub's "Agentic Workflow" Markdown format — separate from the Actions YAML in `.github/workflows/`. Used for…(check the directory contents in your fork for current state).

---

## `docs/` — Jekyll site → GitHub Pages

```
docs/
├── _config.yml               ← Jekyll config
├── _data/                    ← synced from memory/logs by scripts/sync-site-data.sh
├── _layouts/
├── _posts/
├── activity.md               ← public activity feed
├── articles.md               ← article gallery
├── community-skill-packs.md  ← pack registry docs
├── index.md
├── memory.md                 ← public view into MEMORY.md
├── skill-graph.md            ← skill dependency graph (visual)
├── skills.md
├── status.md                 ← written by heartbeat on every run
├── telegram-instant.md       ← Cloudflare Worker for instant Telegram webhook
└── smithery-{manifest.json,submission.md,yaml}    ← Smithery / MCP Registry artifacts
```

Published to `https://<owner>.github.io/aeon` if Pages is enabled (Settings → Pages → Deploy from a branch, `/docs`).

---

## `soul/` — optional personality

```
soul/
├── SOUL.md          ← identity (empty/placeholder upstream)
├── STYLE.md         ← voice (empty/placeholder upstream)
├── examples/        ← 10–20 calibration samples
└── data/            ← raw source material (articles, influences)
```

Off by default. Populate to make every skill output sound like you. See [`03-subsystems/soul.md`](03-subsystems/soul.md).

---

## `articles/` — generated content

```
articles/
├── feed.xml          ← RSS, rebuilt after every content skill
├── feed.lock
└── (article files written by article/digest/research-brief/etc. skills)
```

This is the public output of the content-generating skills. Drives `docs/articles.md` for the Pages site.

---

## `assets/` and `images/`

Visual assets used by the README and the GitHub Pages site. Logos, demo GIFs, architecture diagrams. Not load-bearing for the runtime.

---

## Ephemeral / git-ignored

These dirs appear at runtime but are mostly gitignored:

- `.outputs/` — chain context + per-skill markdown outputs (committed only when memory hygiene runs).
- `.pending-notify/`, `.pending-<service>/` — queue dirs for retry / postprocess.
- `.xai-cache/`, `.<service>-cache/` — prefetch caches.
- `dashboard/.next/`, `dashboard/node_modules/` — Next.js build + deps.
- `mcp-server/dist/`, `mcp-server/node_modules/` — MCP build + deps.
- `a2a-server/dist/`, `a2a-server/node_modules/` — A2A build + deps.

The `janitor` skill cleans up the ephemerals on a 7–14 day TTL.

---

## File the operator should know exists

When you join a new Aeon fork as a contributor:

1. Read [`CLAUDE.md`](../../CLAUDE.md) first. It is the operator's persona + system instructions for every skill.
2. Read [`aeon.yml`](../../aeon.yml) — which skills are enabled tells you what this instance does.
3. Look at [`memory/MEMORY.md`](../../memory/MEMORY.md) — current goals and active topics.
4. Look at [`memory/cron-state.json`](../../memory/cron-state.json) — what's healthy, what's failing.
5. Look at the last few [`memory/logs/YYYY-MM-DD.md`](../../memory/logs/) — recent activity.
6. Check [`memory/issues/INDEX.md`](../../memory/issues/INDEX.md) — open issues.
7. Look at [`memory/watched-repos.md`](../../memory/watched-repos.md) — what repos are being monitored.
8. Look at [`skills/security/trusted-sources.txt`](../../skills/security/trusted-sources.txt) — the operator's supply-chain trust posture.

This sequence takes ~15 minutes and gives you the operator's mental model.

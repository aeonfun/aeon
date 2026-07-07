# Aeon CLI

Non-interactive, scriptable control of an Aeon repo — the dashboard's features as
plain commands. Every command reuses `apps/dashboard/lib`, so the CLI and the
dashboard's `/api/*` routes return **identical data from one source of truth**.

```
apps/cli/aeon <command> [subcommand] [--json]
```

## Why

The dashboard (`./aeon`) is a local web console. The CLI is the same capabilities
without a browser or a running server — good for scripts, CI, `ssh`, and quick
checks. It shells out to the same `gh` + `git` the dashboard does.

## Install / run

No separate setup for the repo owner — the launcher self-installs a tiny runtime
(`tsx` + `yaml`, ~12MB) into `apps/cli/node_modules` on first run. It does **not**
require the full dashboard app to be installed.

The shortest way to run it is the **repo-root `./aeon`**: bare `./aeon` launches
the web dashboard, and `./aeon <command> …` runs this CLI.

```sh
./aeon skills ls               # ← same as ./apps/cli/aeon skills ls
./aeon skills disable heartbeat --dry-run
./aeon                         # (no args) launches the dashboard
```

Or put it on your `PATH` as `aeon` to drop the `./`:

```sh
ln -s "$PWD/apps/cli/aeon" /usr/local/bin/aeon   # or: (cd apps/cli && npm link)
aeon skills ls
```

The launcher pins the repo it manages via `AEON_REPO_ROOT`, so `aeon` works from
any directory — and you can set `AEON_REPO_ROOT` yourself to target a *different*
Aeon checkout. It uses your authenticated `gh` CLI for the commands that touch
GitHub (`runs`, `secrets`, `auth`, `skills run`, …).

## Commands

### Read

| Command | What it shows |
|---|---|
| `aeon skills ls [--enabled] [--pack <k>]` · `aeon skills <name>` | roster + per-skill detail |
| `aeon runs ls [--limit <n>]` · `aeon runs logs <id>` | recent runs + a run's Run-step/`## Summary` |
| `aeon secrets ls [--set] [--unset]` | credential vault — names + set-state, **never values** |
| `aeon config show` | model / harness / gateway / repo from `aeon.yml` |
| `aeon memory [logs\|topics\|issues\|search] …` | the agent's persistent memory |
| `aeon packs ls` | first-party + community skill packs |
| `aeon mcp ls` · `aeon mcp catalog` | configured MCP servers + the featured catalog |
| `aeon strategy show` · `aeon soul show` | `STRATEGY.md` · `soul/SOUL.md` + `STYLE.md` |

### Write

These edit `aeon.yml` / `.mcp.json` (commit + **push to `origin`**, so scheduled
runs pick the change up), call `gh` (secrets/auth), or dispatch a workflow.

| Command | Effect |
|---|---|
| `aeon skills enable\|disable <name>` | toggle a skill in `aeon.yml` |
| `aeon skills schedule <name> "<cron>"` | set its schedule |
| `aeon skills set <name> [--var\|--model\|--harness]` | set per-skill fields |
| `aeon skills rm <name> --yes` | delete the skill dir + config entry |
| `aeon skills run <name> [--var\|--model]` | dispatch a run (`gh workflow run aeon.yml`) |
| `aeon secrets set <NAME> --stdin` · `aeon secrets rm <NAME>` | manage secrets via `gh` |
| `aeon auth --oauth \| --key <k> [--provider\|--base-url]` | set Claude auth |
| `aeon sync [--status]` | commit + push local changes |
| `aeon config set model\|harness\|gateway <v>` | set top-level config |
| `aeon strategy set --stdin\|--file` · `aeon strategy build "<goal>"` | write / regenerate STRATEGY.md |
| `aeon soul build [--handle\|--name\|--links]` | dispatch soul-builder |
| `aeon packs install <owner/repo> [slugs…]` | install a community pack (auto-merging PR) |
| `aeon mcp add <slug> \| <name> <url>` · `aeon mcp rm <name>` | edit `.mcp.json` |
| `aeon telegram register` | re-register the bot `/` command menu |

Add `--json` to any command for machine-readable output, `--dry-run` to any
**write** to preview it without touching anything, and `--help` per command.
Exit code is non-zero on error.

## How it reuses the dashboard

- Every command imports `apps/dashboard/lib` directly — `config.ts`, `gh.ts`,
  `github.ts`, `frontmatter.ts`, `memory.ts`, `gateway.ts`, `auth-provider.ts`,
  `mcp-catalog.ts`, `types.ts`.
- Route-embedded logic was lifted into shared lib so the dashboard routes **and**
  the CLI call the same functions (no duplication to drift):
  `skills.ts` (roster merge), `runs.ts` (run filter + log parsing),
  `secrets-catalog.ts` (credential catalog + set/delete side-effects),
  `run-skill.ts` (dispatch), `builders.ts` (strategy/soul briefs), `sync.ts`
  (git), `auth.ts` (auth flow), `packs.ts` (pack join). Ten routes now wrap these.
- `apps/dashboard/lib/gh.ts` honours `AEON_REPO_ROOT` so the shared lib is
  location-independent (unset = the dashboard's original cwd-relative behaviour).

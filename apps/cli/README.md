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

```sh
./apps/cli/aeon --help
```

Put it on your `PATH` as `aeon`:

```sh
ln -s "$PWD/apps/cli/aeon" /usr/local/bin/aeon   # or: (cd apps/cli && npm link)
aeon skills ls
```

The launcher pins the repo it manages via `AEON_REPO_ROOT`, so `aeon` works from
any directory. It uses your authenticated `gh` CLI for the commands that touch
GitHub (`runs`, `secrets`).

## Commands (Phase 1 — read-only)

| Command | What it shows |
|---|---|
| `aeon skills ls [--enabled] [--pack <k>]` | The skill roster with live enabled/schedule/pack state |
| `aeon skills <name>` | One skill's detail (var, model, harness, requires, mcp) |
| `aeon runs ls [--limit <n>]` | Recent Aeon-launched workflow runs |
| `aeon runs logs <id>` | A run's Run-step output + `## Summary` block |
| `aeon secrets ls [--set] [--unset]` | The credential vault — names + set-state, **never values** |
| `aeon config show` | Top-level `aeon.yml` settings (model, harness, gateway, repo) |
| `aeon memory [logs\|topics\|issues\|search] …` | Browse the agent's persistent memory |

Add `--json` to any command for machine-readable output. Every command supports
`--help`. Exit code is non-zero on error.

## Roadmap

- **Phase 2 (mutating):** `skills enable/disable/schedule/set/rm`, `skills run`
  (dispatches `gh workflow run aeon.yml`), `secrets set/rm`, `auth`, `sync`.
- **Phase 3:** `strategy`, `soul`, `packs`, `mcp`, `telegram`.

## How it reuses the dashboard

- Pure lib imported directly: `config.ts`, `gh.ts`, `github.ts`, `frontmatter.ts`,
  `memory.ts`, `skills.ts`, `runs.ts`, `secrets-catalog.ts`, `types.ts`.
- The route-embedded logic the dashboard used to inline — the credential catalog,
  the run event-filter, and the skills⨯catalog merge — was lifted into
  `apps/dashboard/lib/{secrets-catalog,runs,skills}.ts`. The dashboard routes now
  call those too, so there is no duplicated logic to drift.
- `apps/dashboard/lib/gh.ts` honours `AEON_REPO_ROOT` so the shared lib is
  location-independent (unset = the dashboard's original cwd-relative behaviour).

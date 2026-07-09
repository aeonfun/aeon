# Aeon Dashboard

The local web UI for running Aeon — enable skills, browse community packs, set schedules, manage secrets, and watch skill output in real time. It's the first screen you see after `./aeon`, and the one that turns "edit `aeon.yml` and `skills.json` by hand" into point-and-click.

## What it is

A [Next.js](https://nextjs.org) app that runs on your machine and drives your Aeon fork through the GitHub CLI. Its `/api/*` routes shell out to `gh` for everything that touches your repo — reading and writing secrets, dispatching workflow runs, and committing config changes — so there's no separate backend and no credential custody: the dashboard holds nothing your `gh` login doesn't already grant.

Every change you make in the UI maps to a file in the repo. Toggling a skill flips its `enabled` flag, editing a schedule rewrites its cron, pasting an API key sets a GitHub secret. **Push** commits those changes so Actions picks them up on the next run; **Run now** dispatches a workflow immediately without committing. It's the same `aeon.yml` / `catalog/skills.json` / secrets the cron runner reads — the dashboard is just the editor.

## Quickstart

From the **repo root** (recommended — `./aeon` runs the preflight checks the dashboard needs):

```bash
./aeon
```

That checks the `gh` CLI is installed and authenticated, installs dependencies on first run, finds a free port starting at **5555**, and opens the dev server. Visit [http://localhost:5555](http://localhost:5555).

Or run this app directly:

```bash
cd apps/dashboard
npm install
npm run dev              # next dev on :3000 (./aeon runs it on :5555)
npm run build            # next build (production)
npm run test             # node --test over lib/**/*.test.{ts,mjs}
```

### Requirements

- **Node.js 20+** and npm — Next.js 16 requires it.
- The **[GitHub CLI](https://cli.github.com/) (`gh`), authenticated** (`gh auth login`). The dashboard's API routes use it for secrets, workflow dispatch, and repo reads; `./aeon` refuses to start without it. Set your fork as the default repo once with `gh repo set-default <owner>/<repo>`.
- No app-specific env vars are required — auth flows through `gh`. See [Configuration](#configuration) for the two optional variables.

## Views

The left sidebar switches between the workspaces; the **Team** roster below the nav lists every skill in your enabled packs.

| View | What it does |
|------|--------------|
| **HQ** | Mission-control overview — team size, how many skills are on duty vs. working, pack breakdown, and the most recent runs. Click a run to inspect its output. |
| **Packs** | Enable or disable whole [skill packs](../../docs/skill-packs.md). By default only the small **Core** pack is visible; switching a pack on reveals its skills across the UI. Community packs install one-click from here (a security-scanned, auto-merging PR). |
| **Strategy** | Edit `STRATEGY.md` — the north-star goal, priorities, audience, and constraints that ride along with every run. |
| **Soul** | Manage the optional `soul/` voice files (identity, writing style, examples) so notifications and articles sound like you. |
| **MCP** | Browse featured MCP servers and write `.mcp.json` for one-click install; shows which secret each server needs. |
| **Settings** | Add and manage credentials (Anthropic / gateway keys, per-skill API keys, notification channel tokens) as GitHub secrets. Skills flag inline when a required key is missing. |

Selecting a skill from the roster opens its detail panel: description, schedule, the API keys and MCP servers it needs, a `var` input, and **Run now**.

## Configuration

Credentials are managed in-app (**Settings** → Add Credential) and stored as GitHub repo secrets, not in a local file — so `.env` is optional. The variables the app itself reads:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_TOKEN` | optional | Falls back to the `gh` CLI's own auth when unset. A PAT with `repo` + `workflow` scope if you'd rather pass one explicitly. |
| `GITHUB_REPO` | optional | `owner/repo` of your fork. Falls back to the `gh` default repo. |
| `PORT` | optional | Dev-server port (default `5555`; `./aeon` auto-increments if it's taken). |

See [`.env.example`](.env.example) for the GitHub values.

### Remote access

The `/api/*` routes drive `gh workflow run` and read/write repo secrets, so they're gated to **loopback callers** (`127.0.0.1`, `localhost`, `::1`) by default — a malicious web page can't DNS-rebind to reach `/api/secrets`. To open the dashboard to another machine or a tunnel (Tailscale, ngrok, reverse proxy):

| Variable | Effect |
|----------|--------|
| `AEON_DASHBOARD_ALLOWED_HOSTS=aeon.local,box.tail-xxx.ts.net` | Extends the loopback allowlist by hostname (comma-separated, case- and port-insensitive). |
| `AEON_DASHBOARD_ALLOW_ANY_HOST=1` | Disables Host-header checking entirely. Only for a trusted reverse proxy that terminates `Host` upstream — insecure otherwise. |

The gate also rejects state-changing requests whose `Origin` isn't allowlisted. Code: [`proxy.ts`](proxy.ts) + [`lib/security/api-gate.ts`](lib/security/api-gate.ts).

## How it works

- **Frontend:** Next.js App Router (`app/`) with React client components in `components/`. State is the repo itself — the UI reads `catalog/skills.json`, `catalog/packs.json`, `aeon.yml`, and `STRATEGY.md`, and writes back through the API.
- **API:** route handlers under `app/api/*` are the only place the dashboard touches your repo. They shell out to `gh` (`lib/gh.ts`) for secrets, workflow dispatch, and content reads, and run behind the loopback gate (`proxy.ts`).
- **Skill output feed:** skill runs drop json-render specs into `outputs/`; the feed renders them as cards via [`@json-render`](https://github.com/json-render). `./notify-jsonrender` (a post-run workflow step) produces those specs.
- **Deploy:** the repo auto-deploys `apps/dashboard/` to Vercel on push to `main` — no manual step. Most operators run it locally with `./aeon`; the hosted build is the same app.

## Sandbox / deployment note

This app is **not** part of the GitHub Actions cron path — that path runs skills on their schedule with no UI. The dashboard is the local control surface you use to configure which skills run, when, and with what credentials. Because its API routes execute `gh` against your repo, run it somewhere `gh` is installed and authenticated, and keep it on loopback unless you've deliberately opened it up (see [Remote access](#remote-access)).

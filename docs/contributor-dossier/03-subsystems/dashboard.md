# Subsystem: Dashboard

A local Next.js app that drives `gh` CLI behind the scenes. It is a control surface for the GitHub Actions runtime — not a server.

---

## At a glance

| Property | Value |
|---|---|
| Framework | Next.js 16.1.7 ([`dashboard/package.json:16`](../../../dashboard/package.json)) |
| Routing | App Router |
| Listen | `http://localhost:5555` only (by default) |
| Persistence | None local — all state lives in GitHub (repo files, repo secrets, workflow runs) |
| Auth | Loopback-only + Origin/Referer CSRF gate ([`dashboard/lib/security/api-gate.ts`](../../../dashboard/lib/security/api-gate.ts)) |
| Backend | Shells out to `gh` CLI via `execFileSync` — **not** `fetch` against the GitHub API |
| Launch | `./aeon` |

The mental model: the dashboard is a wrapper over `gh` and the local filesystem. It does not run skills (the workflow runner does). It does not store secrets (GitHub does). It does not host data (the repo does). Closing it loses nothing.

## Routes

| Route | Handler | What it does |
|---|---|---|
| `GET /api/skills` | [`dashboard/app/api/skills/route.ts`](../../../dashboard/app/api/skills/route.ts) | List skills, parse `aeon.yml` for enabled/schedule/var |
| `POST /api/skills/[name]/run` | [`dashboard/app/api/skills/[name]/run/route.ts`](../../../dashboard/app/api/skills/[name]/run/route.ts) | `gh workflow run aeon.yml -f skill=… -f var=… -f model=…` |
| `GET /api/secrets` | [`dashboard/app/api/secrets/route.ts:58`](../../../dashboard/app/api/secrets/route.ts#L58) | `gh secret list --json name -q '.[].name'` — names only, never values |
| `POST /api/secrets` | [`dashboard/app/api/secrets/route.ts:96`](../../../dashboard/app/api/secrets/route.ts#L96) | `gh secret set <name>` via stdin (no shell expansion) |
| `DELETE /api/secrets` | [`dashboard/app/api/secrets/route.ts:124`](../../../dashboard/app/api/secrets/route.ts#L124) | `gh secret delete <name>` |
| `POST /api/auth` | [`dashboard/app/api/auth/route.ts:48`](../../../dashboard/app/api/auth/route.ts#L48) | Manual paste or `claude setup-token` → stores as `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` secret |
| `GET /api/outputs` | [`dashboard/app/api/outputs/route.ts`](../../../dashboard/app/api/outputs/route.ts) | List json-render specs in `dashboard/outputs/`, parse filename for `<skill>-<timestamp>.json` |
| `GET /api/memory/*` | various | Read-only access to memory structure (MEMORY.md, topics, logs) |

## How a "Run skill" click reaches GitHub Actions

1. Frontend sends `POST /api/skills/<name>/run` with `var`, `model`.
2. The route handler validates the skill name against `/^[a-z][a-z0-9-]*$/` ([`dashboard/app/api/skills/[name]/run/route.ts:15`](../../../dashboard/app/api/skills/[name]/run/route.ts#L15)).
3. It sanitizes `var` via whitelist replacement `/[^a-zA-Z0-9_ .\-/#@]/g` ([`run/route.ts:25`](../../../dashboard/app/api/skills/[name]/run/route.ts#L25)).
4. It sanitizes `model` via whitelist replacement `/[^a-zA-Z0-9_\-]/g` ([`run/route.ts:28`](../../../dashboard/app/api/skills/[name]/run/route.ts#L28)).
5. It shells `gh workflow run aeon.yml -f skill=<name> -f var=<var> -f model=<model>` ([`run/route.ts:36`](../../../dashboard/app/api/skills/[name]/run/route.ts#L36)).
6. Returns 200 to the frontend, which polls `/api/outputs` to surface the result when the workflow lands a json-render spec.

The two whitelist substitutions are the only injection defense at the route layer. They are paired with the `gh` CLI's own `-f` flag handling (which does not pass values through a shell). The combination is sufficient — an attacker who controls `var` cannot escape into bash, but they can still pick an arbitrary value to drive the skill. That's not a vulnerability; it's the API working as designed.

## The json-render feed

`dashboard/outputs/` collects one JSON spec per skill run, written by `./notify-jsonrender` ([`aeon.yml:704-721`](../../../.github/workflows/aeon.yml#L704-L721)). The dashboard ([`dashboard/app/page.tsx:60`](../../../dashboard/app/page.tsx#L60)) tails this directory via `GET /api/outputs`, parses the filename for skill + timestamp, and feeds each spec to `@json-render/react` for declarative UI rendering.

The 15 component types (Card, Stack, Grid, Heading, Text, Badge, Link, Table, Stat, Progress, TweetCard, StoryLink, Alert, Button, Separator) are the entire UI vocabulary — every skill output renders as a composition of these.

**Implications:**
- The feed is purely declarative — there is no template eval, no client-side scripting from skill output. XSS risk is bounded to whatever the json-render library does with strings (it's React, so default-safe).
- The Haiku conversion cost (in `./notify-jsonrender`) is paid per skill run. For a busy operator, this is non-trivial — flip `channels.jsonrender.enabled: false` if not using the dashboard.

## Local vs Actions mode

The dashboard has dual-mode operation ([`dashboard/lib/github.ts:9-10`](../../../dashboard/lib/github.ts#L9-L10)):

- **Local mode** (default when running `./aeon` on operator's machine): uses the filesystem directly for memory reads, shells `gh` for everything that touches GitHub.
- **GitHub Actions mode**: when `GITHUB_TOKEN` and `GITHUB_REPO` are present (i.e. the dashboard is being rendered inside a workflow), reads/writes via the GitHub REST API + base64 encoding.

The local-mode is the canonical user path; Actions mode exists for in-workflow dashboards if someone wants to render one. Most contributors will only ever touch local-mode behavior.

## Authentication flow

### Initial setup

When the operator first opens the dashboard, they hit an "Authenticate" modal. Two paths:

1. **Manual paste** ([`dashboard/app/api/auth/route.ts:57-68`](../../../dashboard/app/api/auth/route.ts#L57-L68)) — operator pastes `sk-ant-oat-...` (OAuth) or `sk-ant-api-...` (API key). The route validates the prefix and `gh secret set`s it as `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`.
2. **Auto-setup** ([`dashboard/app/api/auth/route.ts:71-106`](../../../dashboard/app/api/auth/route.ts#L71-L106)) — runs `claude setup-token` locally, regex-parses the OAuth token out of the multi-line terminal output (handling wrapping with `/^[A-Za-z0-9_\-]+/` per line), `gh secret set`s it.

### Boot requirement

The dashboard requires `gh auth status` to succeed at startup ([`dashboard/app/api/secrets/route.ts:33-38`](../../../dashboard/app/api/secrets/route.ts#L33-L38)). If `gh` is not authenticated, `GET /api/secrets` returns `{ ghReady: false, error: "..." }` and the UI surfaces a setup prompt. The `./aeon` launcher pre-checks this and bails with a clear error.

## Security gate

`dashboard/middleware.ts` ([`dashboard/middleware.ts:2`](../../../dashboard/middleware.ts#L2)) routes every `/api/*` request through `gateRequest` in [`dashboard/lib/security/api-gate.ts`](../../../dashboard/lib/security/api-gate.ts). The full threat model is in [`../05-SECURITY.md`](../05-SECURITY.md) — the short version:

- **Host-header allowlist** ([`api-gate.ts:49-55,101-115`](../../../dashboard/lib/security/api-gate.ts#L49-L55)) — only loopback names accepted by default (`127.0.0.1, localhost, ::1, [::1], 0.0.0.0`), with port-stripped normalization.
- **Origin/Referer CSRF check** ([`api-gate.ts:128-148`](../../../dashboard/lib/security/api-gate.ts#L128-L148)) — for state-changing methods (POST/PUT/PATCH/DELETE), the Origin (or Referer fallback) must also be on the allowlist.
- **Two env-var hatches** for legitimate remote access:
  - `AEON_DASHBOARD_ALLOWED_HOSTS=<csv>` — extends the allowlist by one or more hostnames.
  - `AEON_DASHBOARD_ALLOW_ANY_HOST=1` — disables the gate entirely. **Loudly insecure** unless paired with an authenticating reverse proxy.

If the gate rejects, the response is HTTP 403 with a JSON explaining loopback requirement and the two escape hatches ([`api-gate.ts:165-179`](../../../dashboard/lib/security/api-gate.ts#L165-L179)).

## What changes when contributing to the dashboard

- **Adding a new `/api/*` route** — automatically protected by the middleware. Don't try to bypass it. If your route needs to be reachable from a different origin, that's an architectural change worth a discussion.
- **Adding a new dashboard page** — pure Next.js. No special wiring. Memory is read via `GET /api/memory/*`.
- **Adding a new json-render component** — the catalog lives in [`dashboard/lib/catalog.ts`](../../../dashboard/lib/) (also referenced by the json-render MCP server). Adding a component requires updating both the catalog and the Haiku prompt in `./notify-jsonrender` so existing skills can produce specs that use it.
- **Adding a new component to the existing UI** — `dashboard/components/`. React Server Components default; Client Components when needed for interactivity.

## Operational gotchas

- **The dashboard cannot run skills locally.** "Run skill" always dispatches to GitHub Actions. If you want to debug a skill against your local file state, run it via MCP or A2A instead.
- **`gh` CLI must be on PATH for the dashboard process.** Inherited from `./aeon` launch env.
- **Secrets are write-only from the dashboard's view.** You cannot read a secret's value back through any UI affordance. To rotate, post a new value over the old.
- **The dashboard does not currently support multi-repo.** It binds to the repo whose `gh repo view --json` it can read (or the `GITHUB_REPO` env var). If you want to manage multiple Aeon forks from one dashboard, that's an open question.

## Related docs

- [`runtime.md`](runtime.md) — what `gh workflow run` actually triggers.
- [`notifications.md`](notifications.md) — where the json-render specs come from.
- [`../05-SECURITY.md`](../05-SECURITY.md) — full threat model for the security gate and `gh` shellout.

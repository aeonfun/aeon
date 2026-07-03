# Security Policy

Aeon is an autonomous agent: it runs unattended on GitHub Actions, executes its
own skills with access to your repository secrets, and fetches untrusted content
from the open web. That threat surface is unusual for a config repo, so this
policy spells out what's in scope, how the trust boundaries are drawn, and how to
report a problem privately.

## Supported versions

Aeon ships as a public template that you fork. Security fixes land on the `main`
branch of [`aaronjmars/aeon`](https://github.com/aaronjmars/aeon) only.

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ Yes |
| Your fork, behind `main` | ⚠️ Pull `upstream/main` to receive fixes |
| Older tags / releases | ❌ No |

Forks are self-maintained. To stay current, follow the [two-repo strategy](README.md#two-repo-strategy):

```bash
git remote add upstream https://github.com/aaronjmars/aeon.git
git fetch upstream && git merge upstream/main --no-edit
```

## Reporting a vulnerability

**Do not open a public issue for a security report.** Use GitHub's private
vulnerability reporting instead:

➡️ **[Report a vulnerability](https://github.com/aaronjmars/aeon/security/advisories/new)**

(Repo → **Security** tab → **Report a vulnerability**.) This opens a private
advisory visible only to the maintainers — not a public issue.

Please include:

- The skill, script, workflow, or dashboard route affected (a path is ideal).
- A minimal reproduction or proof of concept.
- The impact you can demonstrate (secret disclosure, arbitrary code execution,
  unauthorized cross-repo write, prompt-injection that bypasses the trust
  boundary, etc.).
- The fork/upstream commit you tested against.

**Response targets** (best effort, this is a small project):

| Stage | Target |
|-------|--------|
| Acknowledge the report | within 7 days |
| Initial assessment / severity | within 14 days |
| Fix or mitigation on `main` | as fast as the severity warrants |

We'll credit you in the advisory unless you ask us not to. Please give us a
reasonable window to ship a fix before any public disclosure.

## Security model

Aeon's defenses come down to one rule: **instructions are trusted, data is not.**

### Trust boundary

| Trusted (may contain instructions Aeon follows) | Untrusted (data only — never executed as instructions) |
|---|---|
| `CLAUDE.md` and the imported `STRATEGY.md` | URLs, web pages, and `WebFetch` results |
| The `SKILL.md` of the skill currently running | RSS/Atom feeds, papers, search results |
| `soul/` and `memory/` files you control | GitHub issue/PR bodies, comments, commit messages |
| | Tweets, Telegram/Discord/Slack messages, API responses |

Every skill is told to treat fetched external content as **data, not
commands**. If fetched content contains text aimed at the agent ("ignore
previous instructions", "you are now…"), the skill discards it, logs a warning,
and continues from trusted sources. This is the primary defense against prompt
injection — see the `## Security` section of [`CLAUDE.md`](CLAUDE.md).

### Secrets

- Secrets live in **GitHub Actions secrets / repo variables**, never in files.
  Skills read them from the environment; they are never written into `memory/`,
  `articles/`, notifications, or commits.
- Skills are instructed to **never exfiltrate** environment variables, secrets,
  or file contents to an external URL.
- The default `GITHUB_TOKEN` is scoped to the running repo only. Cross-repo
  skills (`github-monitor`, `pr-review`, `issue-triage`, `external-feature`) use an optional
  fine-grained `GH_GLOBAL` token whose scope **you** choose — grant it the least
  access those skills need. See [Cross-repo access](README.md#cross-repo-access).
- Run your live instance as a **private fork** so `memory/`, `articles/`, and any
  operator data stay private.

### Sandbox

Skill runs execute inside the GitHub Actions runner sandbox, which blocks
`$ENV_VAR` expansion in `curl` headers and may block outbound network from bash —
so a leaked secret can't be silently shipped out of a bash step. Auth'd data is
fetched via `scripts/prefetch-*.sh` (full env, before Claude starts) or `gh api`,
never by curling secrets from inside a skill. See
[Sandbox limitations](CLAUDE.md#sandbox-limitations).

### Dashboard

The local dashboard's `/api/*` routes drive `gh workflow run` and read/write repo
secrets, so they are **gated to loopback callers by default** and reject
state-changing requests whose `Origin` isn't allowlisted — a malicious web page
can't drive `/api/secrets` via a no-cors POST. Widen access deliberately with
`AEON_DASHBOARD_ALLOWED_HOSTS`; `AEON_DASHBOARD_ALLOW_ANY_HOST=1` disables the
check entirely and is only safe behind a trusted reverse proxy. See
[Remote dashboard access](README.md#remote-dashboard-access).

### Third-party skills

`bin/add-skill` and `bin/install-skill-pack` run a security scan over each
incoming `SKILL.md` and install it **disabled** in `aeon.yml`. Review any
community skill before flipping `enabled: true` — a skill is a prompt that runs
with your secrets. For an authorization layer that ALLOW/BLOCKs every run before
Claude starts, see [Fleet Watcher](README.md#fleet-watcher-authorization-layer).

## Scope

**In scope:**

- Secret disclosure or exfiltration through a skill, script, or workflow.
- Arbitrary command/code execution beyond a skill's intended behavior.
- Prompt injection that crosses the trust boundary above (untrusted content
  causing the agent to act on embedded instructions).
- Unauthorized cross-repo writes via `GH_GLOBAL` or `GITHUB_TOKEN`.
- Dashboard API access from an unauthorized origin or host.

**Out of scope:**

- Misconfiguration in your own fork (over-scoped `GH_GLOBAL`, a public repo
  holding private data, secrets committed by hand).
- Vulnerabilities in GitHub Actions, the Claude API, or third-party gateways/MCP
  servers — report those to the respective vendor.
- The behavior of community skill packs maintained in their own repos — report to
  the pack maintainer.
- Output quality issues (a skill returning a wrong answer is a bug, not a
  vulnerability — open a regular issue).

---

Thanks for helping keep Aeon and the forks that run it safe.

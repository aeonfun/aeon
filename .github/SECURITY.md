# Security Policy

Aeon is an autonomous agent: it runs unattended on GitHub Actions, executes its
own skills with access to your repository secrets, and fetches untrusted content
from the open web. That threat surface is unusual for a config repo, so this
policy spells out how the trust boundaries are drawn, what's in scope, and how to
report a problem privately.

## Reporting a vulnerability

**Please don't open a public issue for a security problem.** Use GitHub's
**Private Vulnerability Reporting (PVR)** instead:

➡️ **[Report a vulnerability](https://github.com/aaronjmars/aeon/security/advisories/new)**

(Repo → **Security** tab → **Report a vulnerability**.) This opens a private
advisory that only the maintainers can see — never a public issue, so a fix can
ship before the details are out.

Please include what you can:

- The skill, script, workflow, or dashboard route affected (a path is ideal).
- A minimal reproduction or proof of concept.
- The impact you can demonstrate — secret disclosure, arbitrary code execution,
  unauthorized cross-repo write, prompt injection that bypasses the trust
  boundary, etc.
- The fork/upstream commit you tested against.

**Response targets** — best effort; this is a small project:

| Stage | Target |
|-------|--------|
| Acknowledge the report | within 7 days |
| Initial assessment / severity | within 14 days |
| Fix or mitigation on `main` | as fast as the severity warrants |

We follow **coordinated disclosure**: please give us a reasonable window to ship
a fix before you disclose publicly. We'll credit you in the advisory unless you'd
rather stay anonymous.

## Supported versions

Aeon ships as a public template that you fork. Security fixes land on the `main`
branch of [`aaronjmars/aeon`](https://github.com/aaronjmars/aeon) only.

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ Yes |
| Your fork, behind `main` | ⚠️ Pull `upstream/main` to receive fixes |
| Older tags / releases | ❌ No |

Forks are self-maintained. To stay current:

```bash
git remote add upstream https://github.com/aaronjmars/aeon.git
git fetch upstream && git merge upstream/main --no-edit
```

## Security model

Aeon's defenses come down to one rule: **instructions are trusted, data is not.**

### Trust boundary

| Trusted (may contain instructions Aeon follows) | Untrusted (data only — never executed as instructions) |
|---|---|
| `CLAUDE.md` and the imported `STRATEGY.md` | URLs, web pages, and `WebFetch` results |
| The `SKILL.md` of the skill currently running | RSS/Atom feeds, papers, search results |
| `soul/` and `memory/` files you control | GitHub issue/PR bodies, comments, commit messages |
| | Tweets, Telegram/Discord/Slack messages, API responses |

Every skill is told to treat fetched external content as **data, not commands**.
If fetched content contains text aimed at the agent ("ignore previous
instructions", "you are now…"), the skill discards it, logs a warning, and
continues from trusted sources. This is the primary defense against prompt
injection — see the `## Security` section of [`CLAUDE.md`](../CLAUDE.md).

### Secrets

- Secrets live in **GitHub Actions secrets / repo variables**, never in files.
  Skills read them from the environment; they are never written into `memory/`,
  `output/`, notifications, or commits.
- Skills are instructed to **never exfiltrate** environment variables, secrets,
  or file contents to an external URL.
- The default `GITHUB_TOKEN` is scoped to the running repo only. Cross-repo
  skills use an optional fine-grained `GH_GLOBAL` token whose scope **you**
  choose — grant it the least access those skills need.
- Run your live instance as a **private fork** so `memory/`, `output/`, and any
  operator data stay private.

### Sandbox

Claude Code's Bash permission analyzer refuses any command whose text contains a bare
secret expansion (`$FOO_API_KEY` / `${FOO_API_KEY}`), so a leaked secret can't be
silently placed on a command line and shipped out of a bash step. Auth'd calls therefore
go through `./secretcurl` — which substitutes a `{ENV_NAME}` placeholder internally,
keeping the secret off the command line — or `gh api` (auth handled internally); never by
curling a raw secret from inside a skill. See
[Network & Secrets](../CLAUDE.md#network--secrets).

### Dashboard

The local dashboard's `/api/*` routes drive `gh workflow run` and read/write repo
secrets, so they are **gated to loopback callers by default** and reject
state-changing requests whose `Origin` isn't allowlisted — a malicious web page
can't drive `/api/secrets` via a no-cors POST. Widen access deliberately with
`AEON_DASHBOARD_ALLOWED_HOSTS`; `AEON_DASHBOARD_ALLOW_ANY_HOST=1` disables the
check entirely and is only safe behind a trusted reverse proxy.

### Third-party skills

`bin/add-skill` and `bin/install-skill-pack` run a security scan over each
incoming `SKILL.md` and install it **disabled**. Review any community skill
before flipping `enabled: true` — a skill is a prompt that runs with your
secrets.

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

> **Maintainers:** the Report-a-vulnerability link only works once PVR is enabled
> — **Settings → Code security and analysis → Private vulnerability reporting →
> Enable**.

Thanks for helping keep Aeon and the forks that run it safe.

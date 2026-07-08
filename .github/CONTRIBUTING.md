# Contributing to Aeon

Thanks for helping make Aeon the default way people run autonomous agents. This
guide collects the conventions already used across the repo so you don't have to
reverse-engineer them from existing PRs.

## Ways to contribute

Most contributions fall into one of four buckets, each with its own checklist below:

- **A new skill** — a `skills/<name>/SKILL.md` prompt plus registration in `aeon.yml`.
- **A new LLM gateway** — wiring a provider through the five files that resolve it.
- **A community skill-pack listing** — adding your pack to the README + catalog.
- **A core fix** — dashboard, scripts, workflows, or docs.

## Before you start

- **Fork or use the template.** This repo is a public template — click **Use this
  template** (or `gh repo fork aaronjmars/aeon --clone`). Run your own instance as
  a fork; open PRs back here for changes that benefit everyone.
- **Branch from `main`.** Never push to `main`. Use a descriptive branch name
  (`feat/…`, `fix/…`, `docs/…`).
- **One change per PR.** A focused 20-line fix lands faster than a 500-line bundle.
- **PRs are squash-merged.** Write a clear PR title — it becomes the commit
  subject on `main`.

## Development setup

You need **Node.js 20+** and an authenticated **[GitHub CLI](https://cli.github.com/)
(`gh`)**. Then:

```bash
git clone https://github.com/<you>/aeon && cd aeon
./aeon                 # launches the dashboard on http://localhost:5555
```

The dashboard manages config (skills, schedules, secrets) and pushes it to GitHub
as repo secrets/vars. Run `bin/onboard` anytime to verify your setup. Local dev
for the dashboard app itself is documented in
[`apps/dashboard/README.md`](../apps/dashboard/README.md).

### Contributing a skill

Scaffold from a template or import from any repo:

```bash
bin/new-from-template <template> <skill-name> --category <pack>
bin/add-skill <owner/repo> <skill> [skill...]
```

Every `SKILL.md` opens with YAML frontmatter — the full contract is in
[`docs/examples/skill-templates/TEMPLATE.md`](../docs/examples/skill-templates/TEMPLATE.md). Essentials:

```yaml
---
name: my-skill
category: dev                                  # single source of truth for the pack
description: One-line description
requires: [XAI_API_KEY, COINGECKO_API_KEY?]    # bare = required · `?` = optional
mcp: [base]
---
```

- **Be explicit and self-contained** — a skill runs unattended.
- **Add a "Network note"** with the right path (`./secretcurl` with `{ENV_NAME}`
  placeholders for auth'd APIs, `gh api` for GitHub, `curl` + **WebFetch** fallback
  for keyless public APIs). See [`CLAUDE.md`](../CLAUDE.md#network--secrets).
- **Notify through `./notify`** — never call a channel API directly.
- **Don't monkey-patch Aeon internals** — a skill is a prompt, not a patch.
- **Regenerate the catalog** after adding/recategorizing a skill, and commit both:

  ```bash
  bin/generate-skills-json && bin/generate-packs-json
  ```

### Contributing an LLM gateway

A gateway is wired through **five files** — copy an entry of the same tier
(*native*: speaks the Anthropic API; *sidecar*: OpenAI-compatible, bridged per
run): `apps/dashboard/lib/types.ts`, `apps/dashboard/lib/auth-provider.mjs`,
`apps/dashboard/app/api/secrets/route.ts`, `scripts/llm-gateway.sh`, and the
workflow `env:`. Then add a row to the gateway table in the README and verify a
run logs `gateway=auto resolved to <slug>`.

### Listing a community skill pack

Open a PR that adds **both** a README table row and a matching
[`skill-packs.json`](../catalog/skill-packs.json) entry, links your public repo,
and confirms the pack has a `skills-pack.json` manifest, a clear license, and a
`SKILL.md` per skill. Validate first:

```bash
./scripts/validate-pack.sh /path/to/your-pack-dir
```

## Testing & CI

Locking gates run on every PR; all are fast and only trigger on the paths they
protect:

| Gate | Enforces |
|------|----------|
| `ci-skills-json` | `skills.json` matches a fresh `bin/generate-skills-json` |
| `ci-packs-json` | `packs.json` matches a fresh `bin/generate-packs-json` |
| `ci-skill-category` | every `SKILL.md` declares a valid `category:` |
| `ci-capabilities-parity` | the capabilities taxonomy stays in sync |

Run the checks locally before pushing:

```bash
bash scripts/check-skill-categories.sh
bash scripts/check-capabilities-parity.sh
```

If `ci-skills-json`/`ci-packs-json` fails, you changed a generator input without
committing the regen — run both `generate-*` scripts and commit the result.

## Submitting a pull request

- Keep the diff focused and the title conventional; it becomes the squash commit.
- Explain **what** changed and **why**; link the issue (`Fixes #123`).
- Fill in the matching checklist from the PR template.
- Ran the relevant local checks and they pass.

## Reporting bugs & requesting features

Open an issue. For a bug, include the skill name, the relevant (redacted)
`memory/logs/` entry, whether the failure was an API or sandbox issue, and whether
notifications came through. For a feature you'd like Aeon to build itself, label
the issue `ai-build`.

**Found a security problem?** Don't open an issue — follow
[`SECURITY.md`](SECURITY.md) and report it privately.

## License

By contributing, you agree that your contributions are licensed under the
repository's [LICENSE](../LICENSE).

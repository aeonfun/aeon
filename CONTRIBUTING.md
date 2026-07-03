# Contributing to Aeon

Thanks for helping make Aeon the default way people run autonomous agents. This guide collects the conventions already used across the repo so you don't have to reverse-engineer them from existing PRs.

Most contributions fall into one of four buckets — **a new skill**, **a new LLM gateway**, a **community skill pack** listing, or a **core fix** (dashboard, scripts, workflows, docs). Each has its own checklist below.

## Before you start

- **Fork or use the template.** This repo is a public template — click **Use this template** (or `gh repo fork aaronjmars/aeon --clone`). Run your own instance as a fork; open PRs back here for changes that benefit everyone.
- **Branch from `main`.** Never push to `main`. Use a descriptive branch name (`feat/...`, `fix/...`, `docs/...`).
- **One change per PR.** A focused 20-line fix lands faster than a 500-line bundle. Don't mix a new skill with an unrelated refactor.
- **PRs are squash-merged.** Write a clear PR title — it becomes the commit subject on `main`. Squashing also rewrites per-skill commit hashes, which is why the CI gate below normalizes them.

## Contributing a skill

A skill is a single `skills/<name>/SKILL.md` prompt file plus a registration in `aeon.yml`. The fastest paths:

```bash
bin/new-from-template <template> <skill-name> --category <pack>   # scaffold from skill-templates/
bin/add-skill <owner/repo> <skill> [skill...]                     # import from any GitHub repo
```

You can also describe one to the `create-skill` skill, or label a GitHub issue `ai-build` and let Aeon implement it and open the PR.

### Frontmatter contract

Every `SKILL.md` opens with YAML frontmatter. The full contract lives in [`skill-templates/TEMPLATE.md`](skill-templates/TEMPLATE.md); the essentials:

```yaml
---
name: my-skill
category: dev                                  # the pack this skill joins
description: One-line description of what this skill does
var: ""
tags: [dev, crypto]
requires: [XAI_API_KEY, COINGECKO_API_KEY?]   # bare = required · `?` = works better with
mcp: [base]                                    # MCP servers, same two tiers
---
```

- `category:` is the **single source of truth** for which [pack](docs/skill-packs.md) the skill belongs to. Use one of `research` `dev` `crypto` `onchain-security` `social` `productivity` `meta`. (`core` and `fleet` are curated in [`packs.config.json`](catalog/packs.config.json), not set here.) Omit it and the skill lands in the **Lab** catch-all until triaged. `bin/new-from-template ... --category <pack>` and the dashboard import dropdown set it for you.
- `requires:` is the **single source of truth** the dashboard reads to show which skill needs which key. Use the exact env-var name. A bare name is required; a trailing `?` means the skill still runs without it (degraded). Omit `requires:` (or use `[]`) for skills that only need the built-in Claude + GitHub tokens.
- `mcp:` declares [MCP servers](README.md#mcp-servers-in-skill-runs) the skill calls, with the same two-tier semantics. Slugs reference `apps/dashboard/lib/mcp-catalog.ts`.
- Match the names to the registry in [`apps/dashboard/app/api/secrets/route.ts`](apps/dashboard/app/api/secrets/route.ts) so the dashboard can describe the key and link where to get it.

### Write the skill body

- **Be explicit and self-contained.** A skill runs unattended — spell out the steps, the data sources, and what to do on failure.
- **Add a "Sandbox note".** GitHub Actions blocks `$ENV_VAR` expansion in `curl` headers and may block outbound network from bash. Use the right fallback: a WebFetch fallback for keyless public APIs, a `scripts/prefetch-*.sh` cache for auth'd APIs, or `gh api` for GitHub. See [`CLAUDE.md`](CLAUDE.md#sandbox-limitations).
- **Notify through `./notify`** — never call a channel API directly. It fans out to every configured channel and silently skips the rest.
- **Don't monkey-patch Aeon internals.** A skill should be a prompt, not a patch to the runner, scheduler, or dashboard.

### Regenerate the catalog

`skills.json` (the skill catalog) and `packs.json` (the [pack](docs/skill-packs.md) catalog the dashboard reads) are both **generated**, never hand-edited. After adding or recategorizing a skill, regenerate both:

```bash
bin/generate-skills-json   # skill catalog (reads each SKILL.md's category:)
bin/generate-packs-json    # pack catalog (groups skills by category + packs.config.json)
# then commit both results
```

The `ci-skills-json` and `ci-packs-json` workflows fail any PR that leaves either manifest stale. They normalize out the `generated` timestamp (and `ci-skills-json` also the per-skill `sha`/`updated`), so only real catalog drift fails them. `ci-packs-json` also fails if a skill ends up unassigned to any pack with no Lab catch-all declared.

## Contributing an LLM gateway

A gateway is wired through **five files**, all following the existing pattern — copy an entry of the same tier (**native**: already speaks the Anthropic API; **sidecar**: OpenAI-compatible, bridged per run). The exact checklist is in the README: [Adding a gateway](README.md#adding-a-gateway).

1. `apps/dashboard/lib/types.ts` — add the slug to the `GatewayProvider` union and `GATEWAY_PROVIDERS`.
2. `apps/dashboard/lib/auth-provider.mjs` — add `slug: { label, secretName, prefixes }`.
3. `apps/dashboard/app/api/secrets/route.ts` — list the secret in `BUILTIN_SECRETS` and map it in `GATEWAY_SECRETS`.
4. `scripts/llm-gateway.sh` — add a `case` branch and register the slug + secret in the auto-resolver order.
5. `.github/workflows/aeon.yml` (and `messages.yml`) — pass the new secret into the run's `env:`.

Then add a row to the gateway table in the README. Verify the loop end to end: paste a key in the dashboard and run any skill — the log should print `::notice:: gateway=auto resolved to <slug>`.

## Listing a community skill pack

Skill packs are third-party skill collections in their own repos, installable as one bundle. To list yours in the README's [Community skill packs](README.md#community-skill-packs) table, open a PR that:

- Adds a README table row linking to your public repo, with the skill count and a one-line description.
- Adds a matching entry to [`skill-packs.json`](catalog/skill-packs.json) — the machine-readable mirror.
- Confirms the pack has a `skills-pack.json` manifest, a clear license, and a per-skill `SKILL.md`.

Before opening the PR, run the local pre-flight validator against your pack directory — it checks the same structural invariants `install-skill-pack` enforces (valid manifest, slugs, paths, capability taxonomy, present `SKILL.md`s) plus the publishing-checklist items, so you catch problems before a reviewer does:

```bash
./scripts/validate-pack.sh /path/to/your-pack-dir      # add --path <subdir> if skills-pack.json is nested
```

It exits `0` when the pack is valid (warnings are advisory) and `1` on any blocking error.

Packs must not monkey-patch Aeon internals or depend on private endpoints. Full schema and trust model: [`docs/community-skill-packs.md`](docs/community-skill-packs.md).

## Continuous integration

Locking gates run on every PR. All are fast and only trigger on the paths they protect:

| Gate | Triggers on | What it enforces |
|------|-------------|------------------|
| `ci-skills-json` | `skills/**`, `aeon.yml`, `generate-skills-json`, `skills.json` | `skills.json` matches a fresh `bin/generate-skills-json` |
| `ci-packs-json` | `packs.config.json`, `skills.json`, `generate-packs-json`, `packs.json` | `packs.json` matches a fresh `bin/generate-packs-json` |
| `ci-skill-category` | `skills/**`, the category-check script | every `SKILL.md` declares a valid `category:` |
| `ci-capabilities-parity` | `install-skill-pack`, `docs/CAPABILITIES.md`, the parity script | the capabilities taxonomy stays in sync across its sources |

Run the checks locally before pushing: `bash scripts/check-skill-categories.sh` (categories) and `bash scripts/check-capabilities-parity.sh` (taxonomy). If `ci-packs-json` or `ci-skills-json` fails, you changed a generator input without committing the regen — run `bin/generate-skills-json && bin/generate-packs-json`.

## Reporting bugs and requesting features

Open an issue. For a bug, include the skill name, the relevant (redacted) `memory/logs/` entry, whether the failure was an API or sandbox issue, and whether notifications came through. For a feature you'd like Aeon to build itself, label the issue `ai-build`.

## License

By contributing, you agree that your contributions are licensed under the repository's [LICENSE](LICENSE).

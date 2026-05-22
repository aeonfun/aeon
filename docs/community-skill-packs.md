---
layout: default
title: Community Skill Packs
---

# Community Skill Packs

A **skill pack** is a third-party collection of Aeon skills that lives in its own GitHub repo. Packs let domain experts ship curated bundles (financial intelligence, on-chain analysis, devops, niche research workflows) without fighting Aeon's core release cadence.

This page documents the **install protocol** — the `skills-pack.json` manifest format and the `./install-skill-pack` CLI that consumes it.

---

## One-command install

```bash
./install-skill-pack baseddevoloper/aeon-skill-pack-vvvkernel
```

That single command:

1. Downloads the pack tarball from GitHub
2. Parses `skills-pack.json` from the pack root
3. Runs the security scanner against each declared `SKILL.md`
4. Prompts on any HIGH-severity findings (or fails closed when `--yes` / `--force` aren't passed in non-interactive contexts)
5. Copies skills into `skills/`
6. Records provenance in `skills.lock`
7. Adds catalog rows to `skills.json`
8. Inserts entries into `aeon.yml` (disabled by default — operator must enable explicitly)

Run `./install-skill-pack --help` for the full flag list.

---

## skills-pack.json schema

The manifest lives at the pack root (or under `--path <subdir>` if the pack is nested):

```json
{
  "name": "Pack Name",
  "version": "1.0",
  "description": "One-line summary of what the pack offers",
  "author": "github-handle-or-name",
  "license": "MIT",
  "homepage": "https://example.com/pack-home",
  "skills": [
    {
      "slug": "skill-name",
      "path": "skills/skill-name",
      "description": "What this skill does",
      "category": "research",
      "schedule": "0 12 * * *",
      "default_enabled": false
    }
  ]
}
```

### Field reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | recommended | Human-readable pack name. Falls back to repo name. |
| `version` | string | recommended | Pack release version (semver-flavored is fine; not enforced). |
| `description` | string | recommended | One-line summary shown by `--list`. |
| `author` | string | recommended | Maintainer handle, surfaced in `skills.lock` and pack listings. |
| `license` | string | optional | SPDX identifier (e.g. `MIT`, `Apache-2.0`). |
| `homepage` | string | optional | Project page, docs, or Twitter handle. |
| `skills[]` | array | **required** | At least one entry. |
| `skills[].slug` | string | **required** | Aeon skill slug. Must match `[A-Za-z0-9_-]+`. Used as the directory name under `skills/`. |
| `skills[].path` | string | optional | Path inside the pack repo (relative). Defaults to `skills/<slug>`. May not contain `..`. |
| `skills[].description` | string | optional | Falls back to the SKILL.md frontmatter `description:`. |
| `skills[].category` | string | optional | One of `research`, `dev`, `crypto`, `social`, `productivity`. Defaults to `research` in `skills.json`. |
| `skills[].schedule` | string | optional | Cron string written into `aeon.yml`. Default `0 12 * * *`. |
| `skills[].default_enabled` | boolean | optional | If `true`, the skill is added to `aeon.yml` with `enabled: true`. Default `false` (operator opts in explicitly). |

### What's enforced

- `slug` must look like a slug — no `/`, `..`, or whitespace. Invalid slugs abort the install before any file is written.
- `path` may not contain `..`. Pack maintainers can't reach outside their own repo tarball.
- The manifest must be valid JSON. Parse failures abort cleanly.

### Fallback when no manifest exists

If the pack repo has no `skills-pack.json`, `install-skill-pack` falls back to scanning `skills/*/SKILL.md` and installs each discovered skill with the defaults above (`schedule = "0 12 * * *"`, `default_enabled = false`, `category = "research"`). This means existing repos that follow the `skills/<name>/SKILL.md` convention work out of the box — adding a manifest is an optional upgrade that lets the pack maintainer name and version the bundle.

---

## Worked example

A minimal pack repo `acme/aeon-research-pack` might look like:

```
.
├── README.md
├── skills-pack.json
└── skills/
    ├── arxiv-watcher/
    │   └── SKILL.md
    └── citation-graph/
        └── SKILL.md
```

With this manifest:

```json
{
  "name": "Acme Research Pack",
  "version": "0.2.0",
  "description": "Daily arXiv watch + citation-graph traversal",
  "author": "acme-research",
  "license": "MIT",
  "skills": [
    {
      "slug": "arxiv-watcher",
      "description": "Daily arXiv digest filtered by interest profile",
      "category": "research",
      "schedule": "0 8 * * *"
    },
    {
      "slug": "citation-graph",
      "description": "Walks BFS over citations from a seed paper",
      "category": "research",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

An operator installs the pack with:

```bash
./install-skill-pack acme/aeon-research-pack
```

The two skills land in `skills/arxiv-watcher` and `skills/citation-graph`, with rows added to `skills.json`, entries appended to `aeon.yml` (disabled), and provenance recorded in `skills.lock`. The operator then sets `enabled: true` on whichever skills they want scheduled.

---

## Trust model

`install-skill-pack` runs the same security scanner as `./add-skill` (`skills/skill-security-scan/scan.sh`). Behavior:

- **Trusted source** (listed in `skills/security/trusted-sources.txt` as either `owner` or `owner/repo`) — the deep content scan is skipped. Format validation still applies.
- **Untrusted source, clean scan** — install proceeds.
- **Untrusted source, HIGH findings** — install pauses. Interactive runs prompt `y/N`. Non-interactive runs require `--yes` (accept anyway) or `--force` (skip the check entirely). Without either, the skill is blocked.

The operator is always the trust boundary. The install script does not auto-trust packs based on manifest claims.

---

## Pack maintainers: publishing checklist

1. Repo is public with a clear license file.
2. Each skill has a `SKILL.md` in `skills/<slug>/SKILL.md`.
3. Skills follow Aeon's `SKILL.md` conventions (frontmatter `name:`, `description:`, etc.).
4. `skills-pack.json` declares every skill the pack intends to install. Skills present in `skills/` but missing from the manifest are not installed.
5. Optional but encouraged: a `README.md` that names each skill, explains scheduling assumptions, and lists any required environment variables.
6. Open a PR against `aaronjmars/aeon` to add a row to the **Community Skill Packs** table in the project README.

---

## Listed packs

See the [Community Skill Packs section](https://github.com/aaronjmars/aeon#community-skill-packs) in the main README for the current registry.

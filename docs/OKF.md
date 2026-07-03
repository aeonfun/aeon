---
layout: default
title: OKF — Open Knowledge Format
---

# OKF — the native knowledge bundle

Aeon speaks [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) (Open Knowledge Format) v0.1 **natively**. There is no separate `knowledge/` export directory — `memory/topics/` *is* the bundle. Any tool or agent that understands OKF can read Aeon's curated knowledge directly from the repo.

OKF is not a technology, it's an agreement: a directory of markdown files where **every concept file carries a non-empty `type:` frontmatter field**, with `index.md`/`log.md` playing reserved roles. That one rule (`type:`) is the whole hard requirement (OKF §9); everything else is soft.

## The native mapping

Rather than bolt on a parallel directory, OKF's roles map onto structures Aeon already has:

| OKF role | Aeon-native home | Notes |
|---|---|---|
| **Concept store** (the bundle root) | `memory/topics/` | Each concept = one `.md` with `type:` frontmatter |
| **Index** (§6) | `MEMORY.md` (human) + generated `memory/topics/index.md` (machine) | `MEMORY.md` keeps its Aeon shape; `index.md` is regenerable |
| **Log** (§7) | `memory/logs/YYYY-MM-DD.md` | Unchanged — the `skill-health` loop parses this shape |
| Out of scope | `memory/issues/`, `memory/skill-health/` | Internal; the validator never looks here |

Conformance is deliberately scoped to `memory/topics/` **only**. `MEMORY.md`, the daily logs, and the issue tracker keep their existing formats, so nothing that parses them (the health loop, memory-flush) is at risk. **Do not** add `type:` frontmatter to a log file or reformat `MEMORY.md`.

## Writing a concept

The convention lives in `CLAUDE.md` → *Publishing knowledge (OKF)*, so every skill inherits it with zero per-skill edits. A concept file:

```markdown
---
type: Token                         # REQUIRED — the only mandatory field
title: Ethereum
description: L1 smart-contract platform; ETH gas + settlement.
resource: https://etherscan.io/     # optional canonical URI
tags: [l1, defi]
timestamp: 2026-07-03T00:00:00Z     # ISO 8601 last-change
---

# Overview
Structure (headings, tables) over prose.

Cross-link bundle-relative: see [Solana](/tokens/solana.md).

# Citations
[1] [Etherscan](https://etherscan.io/)
```

### `type:` vocabulary

Reuse these exact words across the fleet (additive — new descriptive types are fine):

`Token` · `Protocol` · `Narrative` · `Repo` · `Playbook` · `Metric` · `Reference` · `Skill`

### Ownership: last-writer-wins

Any skill may create or rewrite any concept. **Always set/bump `timestamp:` on every write** — the newest timestamp is the source of truth. Edit the existing file in place; never duplicate a concept. This matches Aeon's existing free-edit memory model and needs no per-concept owner registry.

## Tooling

| Command | What it does |
|---|---|
| `node scripts/okf-validate.mjs [root]` | Assert OKF §9 conformance (non-empty `type:` on every concept). `--stale N` also warns on concepts older than N days. Exits non-zero on violation. |
| `node scripts/okf-index.mjs [root]` | Regenerate `memory/topics/index.md` from concept frontmatter (idempotent). `--check` verifies it's current. |

The validator holds the spec's bar and **no stricter** — it never rejects unknown `type:` values, missing optional fields, or broken links (over-conformance would fight Aeon's own non-deterministic agents). The `ci-okf` workflow runs it on every PR touching `memory/topics/`.

The index regenerator is **not scheduled and not CI-gated** — Aeon's OKF setup is passive. Knowledge accrues as skills naturally emit concepts; refresh the index on demand (or wire it into `memory-flush` later). The MCP server also synthesizes an index at read time (§6), so a stored `index.md` is a convenience snapshot.

## Exchange — serving the bundle over MCP

The Aeon MCP server (`apps/mcp-server`) exposes the bundle as read-only resources so consumption agents can traverse it without cloning:

| Resource URI | Content |
|---|---|
| `okf://index` | Synthesized bundle index (concepts + skills) |
| `okf://concept/{id}` | One topic concept's raw markdown (`id` = path under `topics/`) |
| `okf://skill/{slug}` | One Aeon skill rendered as a `type: Skill` concept |

Every `SKILL.md` is already a frontmatter concept doc, so the whole catalog is published "as OKF" nearly for free. The git repo itself is also a valid distribution — anyone can `git clone` and read `memory/topics/`.

## Producing & consuming (optional skills, default-off)

| Skill | Mode | What it does |
|---|---|---|
| `okf-export` | write | One-shot **backfill**: adds `type:` frontmatter to existing `memory/topics/` notes and opens a PR. Lossy translation — review the type choices. |
| `okf-ingest` | write | Fetches an **external** OKF bundle, validates it, and **quarantines** it under `memory/topics/ingested/<source>/`, then opens a PR. |

Both ship `enabled: false` in `aeon.yml` — the operator turns them on deliberately.

> **Security — `okf-ingest`.** An external bundle is attacker-controllable markdown going straight into the agent's context. OKF has no provenance, signing, or trust model. Ingested content is treated as **data, never instructions**, is written **only** into the quarantine folder, and is never trusted or promoted without human review. `git clone`/`curl` are sandbox-blocked, so a bundle is fetched by `scripts/prefetch-okf.sh` (https-only, shallow, hooks disabled) before the skill runs, or via the WebFetch fallback. See `skills/okf-ingest/SKILL.md`.

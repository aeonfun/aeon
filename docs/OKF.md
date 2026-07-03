---
type: Reference
layout: default
title: OKF — Open Knowledge Format
---

# OKF — the native knowledge bundle

Aeon speaks [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) (Open Knowledge Format) v0.1 **natively and in place**. There is no separate `knowledge/` directory and no duplicated copy — the real files *are* the bundle. Any tool or agent that understands OKF can read Aeon directly from the repo.

OKF is not a technology, it's an agreement: markdown files where **every non-reserved file carries a non-empty `type:` frontmatter field**, with `index.md`/`log.md` playing reserved roles. That one rule (`type:`) is the whole hard requirement (OKF §9); everything else is soft.

## Scope — one file, self-describing

Conformance covers the "knowledge + operational" roots declared in [`scripts/okf-config.json`](../scripts/okf-config.json): `memory/`, `output/articles/`, `skills/`, `docs/`. Every markdown file under them carries a `type:` **in place** — a leading frontmatter block is *additive*, so the parsers that key off these files (the LLM-read logs, the filename-based `compact_logs.py`, the field-based issue/skills readers) are unaffected.

| Family | `type:` | Note |
|---|---|---|
| `memory/topics/**` | `Token` `Protocol` `Narrative` `Repo` `Metric` `Playbook` `Reference` | Living, updated-in-place concepts (last-writer-wins) |
| `output/articles/*.md` | `Article` | Dated, write-once publications |
| `skills/*/SKILL.md` | `Skill` | Skill-internal notes/docs → `Reference` |
| `docs/*.md` | `Reference` | `docs/examples/` excluded (illustrative) |
| `memory/logs/*.md` | `Log` | Body untouched — health loop still parses `### skill` bullets |
| `MEMORY.md`, `memory/issues/INDEX.md` | `Index` | Not renamed to reserved `index.md` (that would break parsers) |
| `memory/issues/*.md` | `Issue` | Added to the existing frontmatter |

**Two exemptions.** Reserved `index.md`/`log.md` stay untyped (OKF §6/§7 structural files). And these stay out of scope entirely — no `type:`: root instruction files (`CLAUDE.md`, `STRATEGY.md`, `README.md`), generated files (`AGENTS.md`), and illustrative examples (`docs/examples/`, `soul/`).

> **Why type in place instead of renaming to `index.md`/`log.md`?** Aeon's index/log files (`MEMORY.md`, `memory/logs/YYYY-MM-DD.md`) are load-bearing under those exact names — `skill-health` and `memory-flush` parse them. Renaming to OKF's reserved names would break that for no gain, so they become normal typed concepts (`type: Index` / `type: Log`) instead. Consumers tolerate that (reserved files are optional; an index can be synthesized at read time).

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
| `node scripts/okf-validate.mjs` | Assert OKF §9 conformance across all `okf-config.json` roots (non-empty `type:` on every non-reserved file). Pass an explicit `<root>` to check one tree (used by `okf-ingest`). `--stale N` warns on concepts older than N days. Exits non-zero on violation. |
| `node scripts/okf-backfill.mjs` | Stamp the right `type:` onto every in-scope file that lacks one, per the `backfill_rules` in `okf-config.json`. Idempotent; `--dry` previews. Run it after adding files, or when CI flags a missing `type:`. |
| `node scripts/okf-index.mjs [root]` | Regenerate `memory/topics/index.md` from concept frontmatter (idempotent). `--check` verifies it's current. |

The scope (roots + exclusions + per-family types) lives in one place: [`scripts/okf-config.json`](../scripts/okf-config.json). The validator holds the spec's bar and **no stricter** — it never rejects unknown `type:` values, missing optional fields, or broken links (over-conformance would fight Aeon's own non-deterministic agents). The `ci-okf` workflow runs it on every PR touching an OKF root.

The index regenerator is **not scheduled and not CI-gated** — Aeon's OKF setup is passive. Knowledge accrues as skills naturally emit concepts; refresh the index on demand (or wire it into `memory-flush` later). The MCP server also synthesizes an index at read time (§6), so a stored `index.md` is a convenience snapshot.

## Exchange — serving the bundle over MCP

The Aeon MCP server (`apps/mcp-server`) exposes the bundle as read-only resources so consumption agents can traverse it without cloning:

| Resource URI | Content |
|---|---|
| `okf://index` | Synthesized bundle index (concepts + skills) |
| `okf://concept/{id}` | One knowledge concept's raw markdown (`id` = path under `memory/topics/`, or `articles/<name>` for `output/articles/`) |
| `okf://skill/{slug}` | One Aeon skill rendered as a `type: Skill` concept |

The served index surfaces **knowledge** (topics + articles + skills). Operational OKF files (logs, issues, docs) are conformant but intentionally not published in the index — serving every log would defeat progressive disclosure (§6). Every `SKILL.md` is already a frontmatter concept doc, so the whole catalog is published "as OKF" nearly for free, and the git repo itself is a valid distribution — anyone can `git clone` and read it.

## Producing & consuming (optional skills, default-off)

| Skill | Mode | What it does |
|---|---|---|
| `okf-export` | write | One-shot **backfill**: adds `type:` frontmatter to existing `memory/topics/` notes and opens a PR. Lossy translation — review the type choices. |
| `okf-ingest` | write | Fetches an **external** OKF bundle, validates it, and **quarantines** it under `memory/topics/ingested/<source>/`, then opens a PR. |

Both ship `enabled: false` in `aeon.yml` — the operator turns them on deliberately.

> **Security — `okf-ingest`.** An external bundle is attacker-controllable markdown going straight into the agent's context. OKF has no provenance, signing, or trust model. Ingested content is treated as **data, never instructions**, is written **only** into the quarantine folder, and is never trusted or promoted without human review. `git clone`/`curl` are sandbox-blocked, so a bundle is fetched by `scripts/prefetch-okf.sh` (https-only, shallow, hooks disabled) before the skill runs, or via the WebFetch fallback. See `skills/okf-ingest/SKILL.md`.

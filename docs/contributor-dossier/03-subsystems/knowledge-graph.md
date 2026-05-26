# Subsystem: Knowledge Graph

Queryable graph over `memory/`, `articles/`, and `.outputs/`. Lets any skill ask "what has any skill said about X in the last N days?" — turning flat Markdown memory into a recall layer that scales past 80+ topic files.

> **Status:** Scaffolded inside the Sealed Sprint (Session 02). The shape is in place; `skills/graphify-memory/` SKILL.md is written; `./memory-query` + `scripts/memory-query.mjs` work against the JSON layout. The indexer script (`scripts/graphify-memory.mjs`) and the live entity extraction are PLACEHOLDERS — they wait for the repo owner to enable real embedding/extraction providers post-seal.

---

## At a glance

| Property | Value |
|---|---|
| Implemented | Session 02 scaffold (Sealed Sprint, 2026-05-26) |
| Source — indexer | [`scripts/graphify-memory.mjs`](../../../scripts/graphify-memory.mjs) (PLACEHOLDER inside seal) |
| Source — query | [`scripts/memory-query.mjs`](../../../scripts/memory-query.mjs) + [`./memory-query`](../../../memory-query) wrapper |
| Indexer skill | [`skills/graphify-memory/SKILL.md`](../../../skills/graphify-memory/SKILL.md) |
| Storage | `memory/graph/{manifest,entities,edges,chunks}.json` (JSON for portability; can migrate to SQLite later) |
| Default provider | `mock` — deterministic 384-dim hash-based vectors. **NO network.** |
| Real providers | `openai`, `workers` — scaffolded but disabled until repo owner enables |
| Surface — bash | `./memory-query "<topic>" [--window N] [--limit K] [--type <entity_type>] [--format md\|json]` |
| Surface — MCP | `memory-query` tool (to be wired in mcp-server when the indexer is real) |
| Surface — A2A | `memory-query` skill (to be wired when the indexer is real) |

## Storage shape

```
memory/graph/
├── manifest.json     ← provider, last_indexed_at, totals
├── entities.json     ← { entities: [{ id, type, name, canonical, first_seen, last_seen, mention_count }] }
├── edges.json        ← { edges: [{ src_id, dst_id, relation, source, source_skill, ts, weight }] }
└── chunks.json       ← { chunks: [{ id, source, ts, text, embedding }] }
```

Entity types: `topic | token | repo | person | article | concept`.
Edge relations: `mentions | derives-from | cites | contradicts | supersedes`.

JSON is committed to the repo by default. The Sealed Sprint scaffold uses JSON across the board for grep-friendliness and zero-extension portability. Once the corpus exceeds a few MB, the repo owner can swap the storage backend to SQLite (sqlite-vss) without changing the query interface — `scripts/memory-query.mjs` becomes the only file that needs to read SQLite instead of JSON.

## Enabling real embeddings (post-seal)

Inside the Sealed Sprint, the embedding provider is `mock` — same deterministic hash-based vectors used by skill-discovery. The **recommended** post-seal provider is **Workers AI** (operator decision 2026-05-26 — see [`skill-discovery.md`](skill-discovery.md) § `workers` for rationale).

Repo owner enables:

1. Set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` as repo secrets.
2. In `scripts/graphify-memory.mjs`: remove the `throw` in `workersEmbed()` and uncomment the fetch.
3. In `scripts/memory-query.mjs`: same change to its `embed()` function.
4. Set `manifest.provider` to `workers`.
5. Re-run the `graphify-memory` skill.

(OpenAI is the fallback — same pattern with `openaiEmbed()`. Different dim count means full re-index.)

## Enabling real entity extraction (post-seal)

The Sealed Sprint scaffold's entity extraction is a regex-based heuristic (matches uppercased multi-word names, ticker patterns, owner/repo strings, etc.). For high-quality extraction:

1. Implement `extractEntities(text)` in `scripts/graphify-memory.mjs` to call Haiku with the prompt:
   > "Extract entities of type topic|token|repo|person|concept from the following text. Return JSON: `[{entity, type, context}]`."
2. Set `ANTHROPIC_API_KEY`.
3. Re-run with `--full` to backfill against existing memory.

## What skills use it (post-seal)

Five skills are the priority integration targets:

| Skill | What it gains |
|---|---|
| `morning-brief` | Queries last-24h activity around active topics from MEMORY.md before composing. |
| `deep-research` | Queries prior research on the topic; cites/contradicts. |
| `article` | Queries related articles to avoid duplication; threads in citations. |
| `security-digest` | Queries past CVE mentions to detect repeat-offender packages. |
| `weekly-review` | Richer recap using mention-cluster signals from the graph. |

Each gets one numbered step added to its `SKILL.md` (not yet done inside the seal — listed in `08-OPEN-QUESTIONS.md` as a post-seal task).

## What's deferred to post-seal

- The full `scripts/graphify-memory.mjs` (PLACEHOLDER — only the skill prose ships in this scaffold).
- The MCP/A2A `memory-query` tool registrations.
- The integration into the 5 priority skills above.
- The `topic-arc` and `memory-graph-health` skills (Session 02 Phase 4).

All decisions documented; implementation is incremental.

## Related docs

- [`memory.md`](memory.md) — what's being indexed.
- [`skill-discovery.md`](skill-discovery.md) — sibling embedding subsystem (Session 06).
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #2.
- [`../_session-prompts/session-02-kg-memory.md`](../_session-prompts/session-02-kg-memory.md).
- [`../_sprint-log/2026-05-26-full-menu.md`](../_sprint-log/2026-05-26-full-menu.md).

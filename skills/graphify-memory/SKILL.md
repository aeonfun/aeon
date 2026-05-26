---
name: Graphify Memory
description: Incrementally index memory + articles + skill outputs into a queryable knowledge graph
var: ""
tags: [meta]
---

> **${var}** — Empty for incremental (default). `full` to re-index from scratch. `<path>` to target one file.

Today is ${today}. Maintain `memory/graph/` as a queryable index over the operator's memory.

## Steps

1. **Check manifest.** Read `memory/graph/manifest.json` (create if absent). Compute new files since `last_indexed_at`:
   - All `memory/topics/*.md` modified since.
   - All `memory/logs/*.md` from the last 30 days (rolling window).
   - All `articles/*.md` modified since.
   - All `.outputs/*.md` modified since.

2. **Entity extraction (placeholder for real provider).** For each new file, identify entities. Inside the Sealed Sprint this is delegated to the indexer script's heuristic extractor (regex-based topic/token/repo/person/concept patterns). Post-seal, the repo owner enables Haiku-backed extraction in `scripts/graphify-memory.mjs` by setting `ANTHROPIC_API_KEY` and removing the throw in `extractEntities()`.

3. **Embed chunks.** For each new file, chunk to ~500 tokens, embed via the configured provider (mock by default, openai/workers post-seal). Same provider pattern as `./index-skills`.

4. **Persist.** Insert entities, edges, and chunks into `memory/graph/entities.json`, `memory/graph/edges.json`, `memory/graph/chunks.json`. (Inside the seal we use JSON files for portability; post-seal these can migrate to SQLite for query speed if the catalog grows large.)

5. **Update manifest.** Set `last_indexed_at`, `total_entities`, `total_edges`, `total_chunks`, `provider`.

6. **Log.** Append to `memory/logs/${today}.md`:
- SKILL_GRAPHIFY_MEMORY_OK files=<N> entities=<E> chunks=<C>
- Or SKILL_GRAPHIFY_MEMORY_OK_SILENT if no new files (no notify).

7. **Notify (silent on no-op).** If new entities were extracted, send via `./notify` (max 1000 chars):
Memory graph updated. +<N> files, +<E> entities, +<C> chunks. Query: ./memory-query "<topic>"

## Sandbox note

Uses local filesystem + the script `scripts/graphify-memory.mjs`. No outbound network when provider is `mock` (the Sealed Sprint default). Real provider modes are scaffolded but disabled — see [`docs/contributor-dossier/03-subsystems/knowledge-graph.md`](../../docs/contributor-dossier/03-subsystems/knowledge-graph.md) § Enabling real embeddings.

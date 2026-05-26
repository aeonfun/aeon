# Session 02 — Knowledge-Graph Memory Layer

> **Goal:** Build a queryable knowledge graph over `memory/`, `articles/`, and `.outputs/` so any skill can ask "what has any skill said about X in the last N days?" — turning flat Markdown memory into a recall layer that scales past 80+ topic files.
>
> **Effort:** 3–5 weeks.
> **Risk:** Low — purely additive, no existing surface changes.
> **Author gate:** No (memory architecture decision documented in dossier).
> **Reference:** [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #2.

---

## The prompt to paste

```
You are implementing the Knowledge-Graph Memory Layer for the Aeon framework.
Read these dossier docs first:
  - docs/contributor-dossier/03-subsystems/memory.md
  - docs/contributor-dossier/03-subsystems/skills.md
  - docs/contributor-dossier/03-subsystems/mcp-server.md
  - docs/contributor-dossier/09-EXPANSION-OPTIONS.md (Option #2 section)

Your task: build an incrementally-indexed knowledge graph over the existing
file-based memory, plus a query interface exposed as a bash tool (`./memory-query`)
and an MCP tool (`memory-query`).

Architecture:
  - SQLite-backed (sqlite-vss for vector similarity).
  - Lives at memory/graph/{entities.db, edges.db, chunks.db, manifest.json}.
  - Built on-demand by a new skill `graphify-memory` (incremental + full modes).
  - NOT committed to git; manifest is committed so any operator can regenerate.
  - Embeddings via OpenAI text-embedding-3-small (or Workers AI bge-small if
    available); operator can configure via aeon.yml graph.embedding_provider.
  - Cosine-similarity top-K for retrieval; entity-graph walk for related concepts.

Five high-value skills get the `memory-query` tool wired in: morning-brief,
deep-research, article, security-digest, weekly-review.

Constraints:
  - Indexing is idempotent. Re-running graphify-memory on the same content
    produces the same graph.
  - Indexing cost is bounded — full re-index of current corpus < $0.05.
  - Skills that DON'T use memory-query work identically — backward-compatible.
  - The query tool surfaces provenance (source path + snippet) for every result.
  - sqlite3 must be in the workflow allowlist (add to .github/workflows/aeon.yml).

Out of scope:
  - Cross-instance queries (that's option #3 + #9 territory).
  - Rewriting any existing skill's prompt — only ADD memory-query usage to
    the 5 listed skills.
  - Replacing MEMORY.md or the existing memory hygiene skills.

Operate in feature branches: expansion/kg-memory-*. Open one PR per phase.
```

---

## Punchlist

### Phase 1 — Schema + indexer (week 1)

- [ ] Schema design: `entities.db` (nodes: topic, token, repo, person, article, concept), `edges.db` (mentions, derives-from, cites, contradicts), `chunks.db` (with vector embeddings).
- [ ] `skills/graphify-memory/SKILL.md` written following the conventions ([`../06-IMPLEMENTATION-PATTERNS.md`](../06-IMPLEMENTATION-PATTERNS.md)).
  - Incremental mode (var=""): index new files since `manifest.last_indexed_at`.
  - Full mode (var="full"): re-index everything.
  - Targeted mode (var="<path>"): index one specific file.
- [ ] Entity extraction via Haiku — JSON triples format: `[{entity, type, context}]`.
- [ ] Embedding writes via OpenAI SDK (or Workers AI).
- [ ] `memory/graph/.gitignore` — `*.db` and `embeddings/`.
- [ ] `memory/graph/manifest.json` committed (small, regeneration-friendly).
- [ ] `aeon.yml` entry: `graphify-memory: { enabled: false, schedule: "reactive" }`.
- [ ] Reactive trigger: fire after any content skill completes.
- **Acceptance:** Full index of current corpus completes in <5 minutes, costs <$0.05; manifest shape stable across runs.

### Phase 2 — Query interface (week 2)

- [ ] `./memory-query` bash script (root-level, alongside `./notify`).
  - Usage: `./memory-query "<query>" [--type <entity_type>] [--window <days>] [--limit <N>]`.
  - Outputs JSON or Markdown (`--format json|md`).
  - Markdown format returns top-K chunks with source paths, dates, and similarity scores.
- [ ] MCP tool `memory-query` added to `mcp-server/src/index.ts` with the same params.
- [ ] sqlite3 added to bash allowlist in `.github/workflows/aeon.yml`.
- [ ] Test corpus: 20 sample queries with expected results, regression-tested via Vitest.
- **Acceptance:** `./memory-query "Solana" --window 7` returns relevant chunks in <500ms with citations.

### Phase 3 — Skill integration (week 3)

For each of these 5 skills, add a numbered step that calls `./memory-query` and uses the result in context:

- [ ] `morning-brief` — query recent activity around topics in MEMORY.md before composing.
- [ ] `deep-research` — query prior research on the topic; cite/contradict.
- [ ] `article` — query related articles to avoid duplication; thread in citations.
- [ ] `security-digest` — query past CVE mentions to detect repeat-offender packages.
- [ ] `weekly-review` — richer recap using mention-cluster signals from the graph.

For each: add to the skill's `evals.json` an assertion about citation presence.

- **Acceptance:** Each modified skill produces output that includes at least one provenance citation when prior data exists; eval coverage maintained.

### Phase 4 — Tooling + ops (week 4–5)

- [ ] New skill `topic-arc` — given a topic, render its evolution across all skill outputs as a timeline. Beautiful operator surface; uses the graph.
- [ ] New skill `memory-graph-health` — periodic audit: orphaned entities, stale edges, embedding-drift. Mirrors the `skill-health` pattern for the graph itself.
- [ ] Docs: `docs/contributor-dossier/03-subsystems/memory.md` updated with the graph section; new file `docs/contributor-dossier/03-subsystems/knowledge-graph.md`.
- [ ] Operator runbook: how to inspect the graph, manually edit `memory/graph/canonical-aliases.md` for entity merging, force a re-index.
- **Acceptance:** A new operator can answer "what topics has my Aeon discussed most?" in <2 commands.

---

## Files touched

| Path | Action |
|---|---|
| `skills/graphify-memory/SKILL.md` | New |
| `skills/topic-arc/SKILL.md` | New |
| `skills/memory-graph-health/SKILL.md` | New |
| `memory/graph/` | New directory (mostly gitignored) |
| `memory/graph/manifest.json` | New (committed) |
| `memory/graph/canonical-aliases.md` | New (operator-curated) |
| `./memory-query` | New bash wrapper |
| `mcp-server/src/index.ts` | Add `memory-query` tool |
| `a2a-server/src/index.ts` | Add `memory-query` as an A2A skill |
| `.github/workflows/aeon.yml` | Add sqlite3 to bash allowlist; add `./memory-query` to allowlist |
| `skills/{morning-brief,deep-research,article,security-digest,weekly-review}/SKILL.md` | Add memory-query step |
| `skills/skill-evals/evals.json` | Add citation-presence assertions |
| `aeon.yml` | Add `graphify-memory`, `topic-arc`, `memory-graph-health` (disabled) |
| `docs/contributor-dossier/03-subsystems/memory.md` | Update with graph section |
| `docs/contributor-dossier/03-subsystems/knowledge-graph.md` | New subsystem doc |

---

## Dependencies

- **Anthropic API key** for entity extraction (Haiku is fine; cheapest).
- **OpenAI API key** OR Workers AI binding for embeddings. Default to OpenAI; Workers AI is an optimization for the Cloudflare runtime port (Session 01).
- **sqlite3 CLI** must be available in workflow runners (GitHub Actions ships it; on operator's local dev machine they need `brew install sqlite`).
- **`sqlite-vss` extension** for vector similarity — bundled via the indexer skill's setup, or via `npm install sqlite-vss`.

---

## Out of scope

- Cross-instance graph federation (option #3 / #9 territory).
- Real-time indexing on every skill output (incremental on a tick is sufficient; ~5-min latency is fine).
- Rewriting MEMORY.md or migrating any existing memory structure.
- Touching `memory/cron-state.json`, `memory/issues/`, or `memory/skill-health/`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Hallucinated entities (Haiku invents or merges) | `memory/graph/canonical-aliases.md` for operator-curated merges; periodic `memory-graph-health` audit. |
| Index drift after manual edits | `graphify-memory --full` is fast (<5 min); ship as a one-liner in `./scripts/doctor`. |
| SQLite-vss not available in some envs | Fall back to brute-force cosine in TypeScript for <1000 chunks; document the limit. |
| Embedding cost surprises | Per-skill budget cap; log to `memory/token-usage.csv` with a `purpose: embedding` column. |
| Skills become dependent on graph being healthy | Skills must degrade gracefully when `./memory-query` returns empty — never block, always log warning. |

---

## Doctor check

```bash
./scripts/doctor
```

Should show:

- ✓ `memory/graph/manifest.json` exists and is valid JSON
- ✓ Last `graphify-memory` run within 24h
- ✓ `./memory-query "test"` returns either results or a clean empty response
- ✓ `mcp-server/__tests__/memory-query.test.ts` passes

---

## Related dossier docs

- [`../03-subsystems/memory.md`](../03-subsystems/memory.md) — what's being indexed
- [`../03-subsystems/skills.md`](../03-subsystems/skills.md) — how skills consume the new tool
- [`../03-subsystems/mcp-server.md`](../03-subsystems/mcp-server.md) — where the MCP tool lands
- [`../06-IMPLEMENTATION-PATTERNS.md`](../06-IMPLEMENTATION-PATTERNS.md) — skill conventions
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #2 — full PoC sketch

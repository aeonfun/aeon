# Session 06 — Skill Discovery via Embeddings

> **Goal:** Vector-embed every `SKILL.md`; expose a similarity-search tool so operators (and Claude itself) can describe a goal and find the closest skills. The cheapest win in the entire expansion menu.
>
> **Effort:** ~4–5 days. Ship inside a week.
> **Risk:** Very low.
> **Author gate:** No.
> **Reference:** [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #6.

---

## The prompt to paste

```
You are implementing skill discovery via embeddings for the Aeon framework.
Read these dossier docs first:
  - docs/contributor-dossier/03-subsystems/skills.md
  - docs/contributor-dossier/03-subsystems/mcp-server.md
  - docs/contributor-dossier/03-subsystems/dashboard.md
  - docs/contributor-dossier/09-EXPANSION-OPTIONS.md (Option #6 section)

Your task: build a tiny skill-discovery layer:
  1. Embed every skills/*/SKILL.md (frontmatter + first 500 tokens of prose).
  2. Store as docs/skills-index.db (SQLite, ~1MB, committed to git).
  3. Wrap the regeneration into ./generate-skills-json (or a sibling
     ./index-skills script).
  4. Expose a search function via:
     - MCP tool: skill-search
     - A2A skill: skill-search
     - Dashboard /api/skills/search?q=<query>
     - Bash: ./skill-search "<query>"

Default embedding model: Workers AI (@cf/baai/bge-small-en-v1.5, 384 dims,
free). Fallback to OpenAI text-embedding-3-small (1536 dims) if Workers AI
unavailable.

The index commits to git. Regeneration is part of ./generate-skills-json so
adding a skill keeps everything in sync.

Constraints:
  - Pure additive change. Existing surfaces unaffected.
  - Total index size <2MB at current catalog size (156 skills).
  - Search latency <500ms for top-K=10.
  - No new external service dependencies beyond optional API key for the
    embedding model.

Out of scope:
  - Embedding articles/, memory/topics/, or any other corpus (that's
    Session 02 — KG memory).
  - Cross-instance skill search (Session 03 — federation).
  - Algorithmic recommendation ("you might also like...") — pure similarity
    search for v1.

Operate in feature branches: expansion/skill-discovery-*. One PR for the
whole session.
```

---

## Punchlist

### Day 1 — Embedder + storage

- [ ] `./index-skills` bash script:
  - Reads every `skills/*/SKILL.md`.
  - For each: extract frontmatter (`name, description, tags`) + first 500 tokens of prose.
  - Compute embedding via Workers AI (preferred) or OpenAI.
  - Write to `docs/skills-index.db` (SQLite with vss extension, or JSON fallback).
- [ ] Schema: `skill_embeddings(slug, name, description, tags, category, embedding BLOB, updated_at)`.
- [ ] Integrate: `./generate-skills-json` invokes `./index-skills` at the end.
- **Acceptance:** Running `./generate-skills-json` produces both `skills.json` and `docs/skills-index.db`; index size <2MB.

### Day 2 — MCP + A2A integration

- [ ] Add `skill-search` tool to `mcp-server/src/index.ts`:
  - Input schema: `{ query: string, limit?: number }`.
  - Embeds query, runs cosine-sim top-K, returns ranked list with score + invocation hint.
- [ ] Same tool added to `a2a-server/src/index.ts`.
- [ ] Smoke test in `mcp-server/__tests__/skill-search.test.ts`.
- **Acceptance:** Claude Desktop can call `skill-search` with a natural-language query and get a ranked list of `aeon-<slug>` tools.

### Day 3 — Dashboard UI

- [ ] `GET /api/skills/search?q=<query>` route in `dashboard/app/api/skills/search/route.ts`.
- [ ] Search box in the skills list page.
- [ ] Results panel: name, description, score, enable/run buttons.
- [ ] Auto-completion: as the operator types, debounced 200ms search.
- **Acceptance:** Operator types "track new GitHub stars" → gets `star-milestone`, `star-momentum-alert`, `github-trending` in ranked order; one click enables/runs.

### Day 4 — Polish + docs

- [ ] CI lint that fails if `skills.json` and `docs/skills-index.db` are out of sync (hash mismatch on the slug list).
- [ ] `docs/contributor-dossier/03-subsystems/skill-discovery.md` (new subsystem doc).
- [ ] README addition under "Skills" section: "Try `./skill-search '<goal>'` to find the right skill."
- [ ] Cross-link from `03-subsystems/skills.md` to discovery doc.
- **Acceptance:** A new operator finds the right skill for a goal in <2 commands without browsing the catalog.

### Day 5 — Test + ship

- [ ] 20 query/expected-result pairs in `docs/skills-index-evals.json`, regression-tested.
- [ ] Run `./scripts/doctor`; verify integration.
- [ ] PR opened with the dossier reference + screen recording of the dashboard UX.

---

## Files touched

| Path | Action |
|---|---|
| `./index-skills` | New bash script |
| `./skill-search` | New bash wrapper for CLI use |
| `./generate-skills-json` | Modify to invoke `./index-skills` at end |
| `docs/skills-index.db` | New (committed, ~1MB) |
| `docs/skills-index-evals.json` | New (test corpus) |
| `mcp-server/src/index.ts` | Add `skill-search` tool |
| `a2a-server/src/index.ts` | Add `skill-search` as A2A skill |
| `dashboard/app/api/skills/search/route.ts` | New route |
| `dashboard/components/SkillSearch.tsx` | New component |
| `dashboard/app/page.tsx` | Mount the search box |
| `docs/contributor-dossier/03-subsystems/skill-discovery.md` | New subsystem doc |
| `docs/contributor-dossier/03-subsystems/skills.md` | Cross-link |
| `README.md` | "Try `./skill-search`" pointer |
| `.github/workflows/lint.yml` | Add `skills-index-coherence` check |

---

## Dependencies

- **OpenAI API key** (`OPENAI_API_KEY`) OR Workers AI binding for embeddings.
- **sqlite3 CLI** and `sqlite-vss` extension (optional — fall back to brute-force cosine for <200 skills).
- **`@modelcontextprotocol/sdk`** (already in `mcp-server/`).

---

## Out of scope

- Indexing memory/, articles/, .outputs/ (that's Session 02).
- Cross-instance search (Session 03).
- Algorithmic recommendation, personalization.
- Re-embedding on every skill prose change (manual `./generate-skills-json` is sufficient).

---

## Risks

| Risk | Mitigation |
|---|---|
| Embedding quality (similar-sounding skills get confused) | Tune the embedded text — include tags + first paragraph; tweak via the eval corpus. |
| Stale index after skill edits | CI lint enforces coherence; doctor checks; auto-regen on `./generate-skills-json`. |
| Workers AI vs OpenAI dim mismatch | Pick one provider per index; document; re-index when switching. |
| Operator has no API key | Ship the prebuilt index in the repo; operators only regenerate when adding custom skills. |

---

## Doctor check

```bash
./scripts/doctor
```

Should show:

- ✓ `docs/skills-index.db` exists
- ✓ Hash of skill slugs in DB matches hash in `skills.json` (coherence)
- ✓ `./skill-search "test"` returns results in <500ms
- ✓ MCP `skill-search` smoke test passes

---

## Related dossier docs

- [`../03-subsystems/skills.md`](../03-subsystems/skills.md) — the catalog being indexed
- [`../03-subsystems/mcp-server.md`](../03-subsystems/mcp-server.md) — where the tool lands
- [`../03-subsystems/dashboard.md`](../03-subsystems/dashboard.md) — the UI surface
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #6 — full PoC sketch
- [`session-02-kg-memory.md`](session-02-kg-memory.md) — the next embedding-powered subsystem

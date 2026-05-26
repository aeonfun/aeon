# Subsystem: Skill Discovery

Embedding-based search across the 157 (and growing) skill catalog. Describe what you want; get a ranked list of skills.

---

## At a glance

| Property | Value |
|---|---|
| Implemented | Session 06 (Sealed Sprint, 2026-05-26) |
| Source — indexer | [`scripts/index-skills.mjs`](../../../scripts/index-skills.mjs) + [`./index-skills`](../../../index-skills) wrapper |
| Source — searcher | [`scripts/skill-search.mjs`](../../../scripts/skill-search.mjs) + [`./skill-search`](../../../skill-search) wrapper |
| Index file | [`docs/skills-index.json`](../../skills-index.json) (~1.8MB, committed) |
| Coherence manifest | [`docs/skills-index.manifest`](../../skills-index.manifest) (sha256 of slug list) |
| Default provider | `mock` — deterministic 384-dim hash-based vectors. **NO network.** |
| Real providers | `openai` (text-embedding-3-small, 1536 dims) and `workers` (Cloudflare Workers AI bge-small-en-v1.5, 384 dims) — scaffolded but disabled |
| Surface — bash | `./skill-search "<query>" [--limit N] [--type <tag>] [--format md\|json]` |
| Surface — MCP | `aeon-skill-search` tool exposed by [`mcp-server`](../../../mcp-server/) |
| Surface — A2A | `aeon-skill-search` skill exposed by [`a2a-server`](../../../a2a-server/) |
| Surface — HTTP | `GET /api/skills/search?q=…&limit=…&tag=…` from the dashboard |
| Tests | [`scripts/test-skill-discovery.mjs`](../../../scripts/test-skill-discovery.mjs) — 10 cases, `node --test` |
| CI | [`.github/workflows/lint.yml`](../../../.github/workflows/lint.yml) — skill-lint + coherence + smoke |

## How it works

1. **`./generate-skills-json`** runs and (at its tail) invokes **`./index-skills`**.
2. `./index-skills` discovers every `skills/*/SKILL.md`, extracts frontmatter + first ~500 tokens of prose, embeds each via the chosen provider, writes [`docs/skills-index.json`](../../skills-index.json) and [`docs/skills-index.manifest`](../../skills-index.manifest).
3. `./skill-search` (or any of the MCP/A2A/HTTP surfaces) reads the index, embeds the query with the same provider, computes cosine similarity, returns the ranked top-K with provenance.

Everything is L2-normalized, so cosine similarity is a simple dot product. For the current ~157-skill catalog, brute-force ranking takes <5ms.

## Embedding providers

The provider is recorded in the index file. The search path uses the same provider so the query embedding lives in the same space as the skill embeddings.

### `mock` (default, sealed-sprint posture)

Deterministic SHA-256-derived 384-dim unit vectors. Same input → same vector. **No network calls.** Used for tests and inside the Sealed Sprint where external service connections are forbidden.

**Important:** mock embeddings are *not* semantically meaningful. Two semantically related skills will not score higher than two unrelated skills — the ranking is essentially random but stable. The mock is here to prove the wiring; swap to a real provider for actual usefulness.

### `workers` (RECOMMENDED — scaffolded, PLACEHOLDER)

**Decision 2026-05-26:** Workers AI is the canonical post-seal provider. Rationale: free at low volume, no API-key onboarding burden, native Cloudflare binding once the Workers runtime (Session 01) is live, 384 dims (same as mock so the index size doesn't change).

Uses Cloudflare Workers AI `@cf/baai/bge-small-en-v1.5`.

**Repo owner enables post-seal by:**

1. Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repo secrets.
2. Open [`scripts/index-skills.mjs`](../../../scripts/index-skills.mjs).
3. Remove the `throw new Error(...)` in `workersEmbed()`.
4. Uncomment the fetch implementation directly below.
5. Mirror the same change in [`scripts/skill-search.mjs`](../../../scripts/skill-search.mjs).
6. Run `./index-skills --provider workers`.
7. Commit the regenerated `docs/skills-index.json` (size unchanged — same 384 dims).

### `openai` (scaffolded — secondary)

Uses `text-embedding-3-small` (1536 dimensions, ~$0.02 per 1M tokens). Full re-index of the current catalog costs about $0.025.

Available as a fallback if Workers AI isn't reachable. Same swap-in pattern as `workers`; needs `OPENAI_API_KEY`. Note: switching from mock or workers to openai changes the embedding dimensionality (384 → 1536), so all existing entries need to be re-embedded — `--full` mode.

## Mounting the dashboard component

The dashboard ships [`dashboard/components/SkillSearch.tsx`](../../../dashboard/components/SkillSearch.tsx) as a drop-in. To surface it in the main page, add one import + one element to [`dashboard/app/page.tsx`](../../../dashboard/app/page.tsx):

```tsx
import { SkillSearch } from '../components/SkillSearch'

// inside the dashboard layout, wherever you want the search box:
<SkillSearch onSelect={(slug) => setSelectedSkill(slug)} />
```

The component:
- Debounces input (250ms default).
- Surfaces the `mock`-provider warning until the real provider is enabled.
- Shows score, name, description, invocation hint, tags per result.
- Clicks call the optional `onSelect(slug)` callback.

## What's covered by tests

[`scripts/test-skill-discovery.mjs`](../../../scripts/test-skill-discovery.mjs) — 10 cases via Node's built-in `node:test` (no new dependencies):

| Suite | Test |
|---|---|
| `index-skills` | docs/skills-index.json exists after running ./index-skills |
| `index-skills` | index has expected schema |
| `index-skills` | embedding vectors are L2-normalized |
| `index-skills` | --check passes when index is fresh |
| `index-skills` | mock embeddings are deterministic |
| `skill-search` | returns valid JSON with the expected shape |
| `skill-search` | honors --type tag filter |
| `skill-search` | mock provider results are deterministic for the same query |
| `MCP server — skill-search tool` | MCP server registers aeon-skill-search in tool list |
| `skill-lint coherence` | every indexed slug has a real SKILL.md on disk |

Run all locally: `node --test scripts/test-skill-discovery.mjs`

## Operational gotchas

- **The index file is large (~1.8MB committed).** That's fine at the current catalog size. If the catalog crosses ~500 skills, consider compressing or storing only the slug list + recomputing embeddings on first run.
- **Manifest coherence is the cheapest signal.** `./index-skills --check` is fast; wire it into CI to fail on un-indexed skill additions.
- **The dashboard route is shell-spawned.** Each query takes ~50ms (Node startup + script + index parse). Fine for interactive use. If the dashboard becomes high-traffic, port the search into the Next.js process directly.
- **The MCP/A2A/HTTP surfaces all hit the same `scripts/skill-search.mjs`** — single source of truth. Changes to the search logic propagate to every surface.

## Related docs

- [`skills.md`](skills.md) — the catalog this indexes.
- [`mcp-server.md`](mcp-server.md) — where the MCP tool lands.
- [`a2a-server.md`](a2a-server.md) — A2A skill registration.
- [`dashboard.md`](dashboard.md) — host of the HTTP route + component.
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #6 — the original PoC sketch.
- [`../_session-prompts/session-06-skill-discovery.md`](../_session-prompts/session-06-skill-discovery.md) — the session prompt this implements.
- [`../_sprint-log/2026-05-26-full-menu.md`](../_sprint-log/2026-05-26-full-menu.md) — sealed sprint log.

# Expansion Options — Chapter Three

The strategic deliverable. Eight candidate directions for "what we build next," with deep proof-of-concept sketches for the four the user prioritized (#1 Cloudflare runtime port, #2 Knowledge-graph memory, #3 Fleet coordination as protocol, #6 Skill discovery via embeddings).

This memo is for the author and us to discuss together. We have a recommendation; nothing here is committed.

---

## Framing

Aeon is **at the saturation point of its current shape**. The skill-meta layer (CRUD, eval, repair, analytics, fleet observation) is dense. The runtime is mature. The distribution surfaces (Actions, MCP, A2A, dashboard) are real and used by ~50 ecosystem partners.

Three vectors for what's next:

1. **Make the existing thing better** — runtime upgrades (Cloudflare), memory upgrades (KG), discovery upgrades (embeddings). Compounding improvements to the platform.
2. **Make the existing thing bigger** — federation across forks (Aeon-as-protocol), multi-modal outputs, mobile/voice surfaces.
3. **Make the existing thing differently** — agentic dev loop (junior-dev persona), chat-first console, time-travel replay UX. Repositioning the operator experience.

The four chosen for deep sketches mix all three. They're independent — none requires another to ship — but they sequence well.

---

## The full option menu (1-page ranking)

Rank reflects my read of leverage-vs-effort. Author has the final say on appetite.

| # | Direction | One-line pitch | Effort | Risk | Why it matters |
|---|---|---|---|---|---|
| 1 | **Cloudflare runtime port** | Run skills on Workers + Durable Objects instead of (or alongside) Actions — sub-second cold start, persistent WS, lower cost | L (4–8 weeks) | Med — runtime divergence risk | Removes Aeon's #1 friction (sandbox quirks, cron granularity, polling delay). We have deep Cloudflare experience locally. |
| 2 | **Knowledge-graph memory layer** | Queryable graph over `memory/` + `articles/` + `.outputs/` so skills can ask each other across history | M (3–5 weeks) | Low — purely additive | Memory is markdown-flat; recall doesn't scale past ~50 topic files. Compounding value as fleet grows. |
| 3 | **Fleet coordination / Aeon-as-protocol** | Cross-instance skill calls, signed receipts, optional x402 micro-payments — turn the ecosystem into a federation | L (6–12 weeks) | High — protocol design has long tail | Largest narrative upside. Positions Aeon as a *protocol*, not just a framework. Needs explicit author roadmap alignment. |
| 4 | Time-travel replay / observability | Per-run timeline UI: rewind any skill run with exact context, prompt, output, score, token cost | M (4 weeks) | Low | Self-healing loop is hard to debug without it. Operator UX win. |
| 5 | Chat-first operator console | Talk to your Aeon over Telegram/Discord with native commands ("pause crypto", "what did you do today?") | M (3 weeks) | Low | Dashboard is config-first; daily UX is conversational. Reuses inbound polling. |
| 6 | **Skill discovery via embeddings** | Vector index of all 156 `SKILL.md` files — describe a goal, get a ranked starter pack | S (1 week) | Very low | Cheapest, highest-leverage onboarding upgrade. Could ship in days. |
| 7 | Agentic dev loop (Aeon-as-junior-dev) | Wrap `external-feature` + `autoresearch` + `create-skill` + `tool-builder` into a persona that takes an issue and ships a feature end-to-end | M (4 weeks) | Med — quality gate is hard | Primitives already exist. Packaging is the lift. Great showcase if quality holds. |
| 8 | Multi-modal outputs | Voice notes (TTS), screenshot reading, video gen (Replicate is wired) | S–M (2 weeks) | Low | Differentiates against text-only competitors. Cheap experiment. |
| 9 | **The Aeon Agora (glass-box agent-social)** | Agent-native social network on top of federation; agents post/follow/react; humans observe but have zero write surface | M (4–6 weeks) | Med — abuse + brand risk | Pushes Aeon further into the autonomy lane. Recombines federation + soul + content skills. High narrative leverage. Builds on #3. |

---

## Sequencing recommendation

Three-quarter staged path: **6 → 2 → 1**.

- **Q1 (this month):** Ship #6 (skill discovery via embeddings). One week of work. Immediate operator win. Validates the embedding-store approach we'll lean on for #2.
- **Q2 (next 6 weeks):** Ship #2 (knowledge-graph memory layer). Builds on #6's infrastructure. Compounds quality of every skill that consumes memory.
- **Q3 (next 8–12 weeks):** Begin #1 (Cloudflare runtime port). The heaviest lift. We have ~3 months of #6+#2 experience to inform the design. Ships as an **alongside** runtime, not a replacement — operators choose.

Option #3 (fleet coordination / federation) sits orthogonal. It's the right move *if* author wants Aeon-as-protocol positioning; it's overkill *if* the goal is a stable framework. **Recommend deferring the build, but make the architectural decision now** — many of #1, #2, #6's design choices change if federation is on the table.

---

# Option #1 — Cloudflare runtime port

## The idea

Today, every Aeon skill executes inside a GitHub Actions runner. That's free, simple, and works — but it has three friction points:

1. **Cold-start latency.** A workflow run is 30–90s of overhead (checkout + npm install + Claude install + …) before the skill prompt arrives. For sub-second use cases (chat reply, alert routing) it's a non-starter.
2. **Cron granularity.** Actions cron drifts 5–15 min. `*/5 * * * *` is the minimum useful tick.
3. **Sandbox quirks.** Outbound network, env-var expansion in headers, binary tooling all have empirical limitations.

**Cloudflare Workers + Durable Objects + Cron Triggers** removes all three:

- Cold start ~5–50ms.
- Cron Triggers reliable to the second.
- No bash sandbox — the JS runtime is fully under your control.
- Native WebSocket support (Durable Objects), persistent connections (think live agent for inbound messaging).
- D1 (SQLite) or KV for the cron-state.json and memory-index needs.
- R2 for the article gallery.
- Workers AI for the Haiku scoring (eliminates the inline Haiku tax).

## What stays the same

- **`SKILL.md` is the same file.** No skill rewrites.
- **Memory shape is the same.** Files in git, just synced into the Worker on cold start (or read on-demand from KV/D1).
- **Notify channels are the same.** Telegram/Discord/Slack webhooks work identically.
- **MCP and A2A servers are independent** of the runtime — they keep shelling to `claude -p -`.

## What changes

- A new runtime ([`workers-runtime/`](../../workers-runtime/) — new directory) implementing the 21-step pipeline that `aeon.yml` runs today. Same steps, different host.
- Claude API calls via the Anthropic TypeScript SDK (or Bankr if `gateway: bankr`), not the `claude` CLI.
- `gh` CLI calls replaced with Octokit (the JS GitHub SDK).
- The "commit results" step becomes a periodic batch commit (every N runs or M minutes) instead of per-run — to avoid hammering the git repo.
- The dashboard's "Run skill" call gets a `?runtime=workers|actions` query param.

## Technical sketch

### Runtime entry

```ts
// workers-runtime/src/index.ts
import { Anthropic } from '@anthropic-ai/sdk';
import { GitHub } from './github';
import { Memory } from './memory';
import { Notify } from './notify';
import { FleetWatcher } from './fleet-watcher';

export interface Env {
  ANTHROPIC_API_KEY: string;
  CLAUDE_CODE_OAUTH_TOKEN?: string;
  GITHUB_TOKEN: string;
  GH_GLOBAL?: string;
  CRON_STATE: KVNamespace;          // hot path: per-skill metrics
  MEMORY_DB: D1Database;             // index of memory/topics, logs
  ARTICLE_BUCKET: R2Bucket;          // article outputs
  SKILL_RUNNER: DurableObjectNamespace;  // per-skill execution + concurrency
  FLEET_ENDPOINT?: string;
  FLEET_TOKEN?: string;
  GATEWAY_PROVIDER?: 'direct' | 'bankr';
  BANKR_LLM_KEY?: string;
}

export default {
  // 1. HTTP entry: dashboard "Run skill" → this hits us
  async fetch(req: Request, env: Env): Promise<Response> {
    const { skill, var: skillVar, model } = await req.json();
    const id = env.SKILL_RUNNER.idFromName(skill);  // per-skill DO singleton
    return env.SKILL_RUNNER.get(id).fetch(req);
  },

  // 2. Cron entry: cron triggers wire here
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const due = await pickDueSkills(env);  // reads aeon.yml, CRON_STATE
    for (const { skill, var: v, model } of due) {
      ctx.waitUntil(runSkill(skill, v, model, env));
    }
  },
};

export class SkillRunner implements DurableObject {
  // Per-skill DO ensures the same skill can't run twice in parallel
  // (matches Actions' concurrency: aeon-${skill} group)
  async fetch(req: Request): Promise<Response> {
    // 21 steps inline, no spawn, no install
    // 1. validate → 2. prefetch → 3. Fleet preflight → 4. Claude API call
    // → 5. parse output → 6. Haiku score → 7. json-render → 8. notify
    // → 9. postprocess → 10. Fleet postflight → 11. commit batch
  }
}
```

### `aeon.yml` compatibility

A new top-level key indicates per-skill runtime preference:

```yaml
skills:
  morning-brief: { enabled: true, schedule: "0 7 * * *", runtime: "workers" }
  deep-research: { enabled: true, schedule: "workflow_dispatch", runtime: "actions" }  # heavy, prefers Actions
```

Skills without `runtime:` default to a `default_runtime:` setting at the top of `aeon.yml` (`workers` or `actions`). Backward-compatible.

### Memory sync model

Two reads, one write:

- **Hot reads** (cron-state, skill-health, MEMORY.md index) → from KV / D1, populated by a sync Worker.
- **Cold reads** (specific topic files, log files) → from the git repo via Octokit on-demand, cached in KV with a TTL.
- **Writes** → accumulate in a per-skill staging buffer. Every N minutes or on memory-pressure, the Worker commits a batch to git via Octokit. **Race-resolution is the same as today's "take new write for memory/*" semantic.**

### Cost comparison

| Path | Per-run cost | Notes |
|---|---|---|
| Actions | $0 on public repo (free minutes) | $0.008/min on private |
| Workers | $5/mo base + $0.50/1M requests + Anthropic tokens | Negligible compute |

For a private-repo operator doing 1000 skill runs/day at 3 min avg = 3000 min/day = $24/day on Actions. Same on Workers ≈ $0.05/day compute (the Anthropic token bill is the same in both). **The cost case is overwhelming for private/heavy use.**

### Migration path

Phase 1 (week 1–2): scaffold `workers-runtime/`. One skill (`heartbeat`) running on Workers. Same skill running on Actions in parallel. Output comparison.

Phase 2 (week 3–4): port 5–10 high-volume skills. Add `runtime:` field to `aeon.yml`. Document operator switch.

Phase 3 (week 5–6): full parity for the ~50 most-used skills. Dashboard "Run skill" supports runtime toggle.

Phase 4 (week 7+): Heavy/long skills (`deep-research`, `feature`, `external-feature`) stay on Actions because Workers has a 30s CPU limit per request (Durable Objects raise this to 30s subrequest, longer with `waitUntil`, but Actions has 6h). Document the boundary.

### Risks

- **Runtime divergence.** Workers JS behaves slightly differently from the Actions runner. Edge cases (timezone, locale, certain Node APIs) may surface.
- **Skill prose assuming bash tools.** Some skills include literal `curl` / `jq` in their prose. The Workers runtime needs to translate these to fetch/JSON.parse — or accept that skills must update.
- **Git rate limiting.** Octokit-via-Workers will hit GitHub's API rate limits faster than the Actions runner's checkout. Batch commits + caching are critical.
- **Operator confusion.** Two runtimes means two places to debug. Mitigation: dashboard surfaces which runtime each run used.

### Decision points for the author

- Are we OK shipping a runtime split (operators pick) instead of replacing Actions entirely?
- What's the appetite for a Cloudflare Pages migration of the dashboard alongside? (would simplify auth model)
- Bankr gateway via Workers: does Bankr expose a Workers-friendly transport? (worth a conversation)

---

# Option #2 — Knowledge-graph memory layer

## The idea

Memory today is Markdown files in folders. Skills read what they need by path (`memory/MEMORY.md`, `memory/topics/<topic>.md`). That's elegant and falls apart at scale: when there are 80 topic files, a skill writing about Solana doesn't easily know that yesterday's `market-context-refresh` mentioned Solana too.

A **knowledge-graph layer** indexes memory + articles + skill outputs into a queryable structure that skills can ask:

> *"What did any skill say about Solana in the last 7 days?"*
> *"Which articles cite the Polymarket gamma-api?"*
> *"Show me topics that have grown 3× in mention count this month."*

Each fact / entity / topic is a node. Each skill output that touches it is an edge. The corpus is small (thousands of files, not millions), so the heavy ML kit (vector DB + reranker) is overkill. A SQLite-backed entity index + embeddings is enough.

## What stays the same

- **Files on disk.** The graph is *derived* from the existing files. Skills still write Markdown; the indexer ingests it.
- **`memory/MEMORY.md` as the operator-facing index.** The graph is for skill-to-skill recall.

## What's new

```
memory/
├── MEMORY.md          (unchanged)
├── topics/            (unchanged)
├── logs/              (unchanged)
└── graph/             ← NEW
    ├── entities.db    ← SQLite: nodes (entity, topic, article, skill-run, fact)
    ├── edges.db       ← SQLite: edges (mentions, derives-from, cites, contradicts)
    ├── embeddings/    ← vector index for fuzzy retrieval
    └── manifest.json  ← what's been indexed; incremental sync state
```

Plus a new skill: [`skills/graphify-memory/`](../../skills/graphify-memory/) that ingests new content into the graph (idempotent, runs after every skill via a chain, or on a tick).

Plus a new tool exposed to skills: `MemoryQuery(query)` — wraps the graph. Skills get this via the MCP server's tool catalog (or as a synthesized bash command in the Actions runtime).

## Technical sketch

### Schema

```sql
-- entities.db
CREATE TABLE entities (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL,        -- 'topic' | 'token' | 'repo' | 'person' | 'article' | 'concept'
  name        TEXT NOT NULL,
  canonical   TEXT,                  -- canonicalized form for dedup
  first_seen  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0
);

CREATE INDEX ix_entities_name ON entities(name);
CREATE INDEX ix_entities_type_name ON entities(type, name);

-- edges.db
CREATE TABLE edges (
  id        INTEGER PRIMARY KEY,
  src_id    INTEGER NOT NULL,
  dst_id    INTEGER NOT NULL,
  relation  TEXT NOT NULL,           -- 'mentions' | 'derives-from' | 'cites' | 'contradicts' | 'supersedes'
  source    TEXT NOT NULL,           -- 'memory/topics/foo.md' | 'articles/digest-2026-05-20.md' | etc.
  source_skill TEXT,                  -- which skill emitted this edge
  ts        TEXT NOT NULL,
  weight    REAL DEFAULT 1.0
);

CREATE INDEX ix_edges_src ON edges(src_id);
CREATE INDEX ix_edges_dst ON edges(dst_id);
CREATE INDEX ix_edges_relation ON edges(relation);

-- embeddings (separate file or sqlite-vss)
-- For each chunk (~500 tokens), an embedding vector + back-reference to source
CREATE TABLE chunks (
  id          INTEGER PRIMARY KEY,
  source      TEXT NOT NULL,
  text        TEXT NOT NULL,
  embedding   BLOB NOT NULL          -- 1536-dim float32 from text-embedding-3-small or local
);
```

### Indexer skill

```markdown
---
name: graphify-memory
description: Incrementally index new memory + articles + skill outputs into the KG
var: ""
tags: [meta]
---

> **${var}** — Empty for incremental. Set "full" for full re-index. Set "<path>" for targeted.

Today is ${today}. Maintain memory/graph/ as a queryable index.

## Steps

1. **Manifest read.** Read memory/graph/manifest.json. Compute new files since last_indexed_at.

2. **Entity extraction.** For each new file, ask Haiku to extract entities (topic/token/repo/person/concept) and emit JSON triples.

3. **Embed.** For each new chunk, compute embedding via Workers AI (or text-embedding-3-small).

4. **Persist.** Insert entities + edges + chunks into the SQLite DBs. Update mention_count, last_seen.

5. **Manifest write.** Update last_indexed_at, total counts.

6. **Log.** SKILL_GRAPHIFY_MEMORY_OK count=<N>
7. **Notify.** Send via ./notify: Indexed <N> files, +<E> entities, +<C> chunks.

## Sandbox note
Reads/writes local SQLite (sqlite3 CLI in the bash allowlist? — needs adding).
Uses Workers AI or text-embedding-3-small for embeddings. Auth via existing ANTHROPIC_API_KEY for fallback.
```

### Query API

A new MCP tool `memory-query` (alongside the per-skill tools):

```ts
// mcp-server/src/index.ts additions
server.tool('memory-query', {
  description: 'Query Aeon memory graph: entities, relations, topics, time-windows.',
  inputSchema: z.object({
    query: z.string(),
    entity_type: z.enum(['topic','token','repo','person','article','concept']).optional(),
    time_window_days: z.number().default(30),
    limit: z.number().default(10),
  }),
}, async ({ query, entity_type, time_window_days, limit }) => {
  // 1. Embed the query.
  // 2. Cosine-sim against chunks.embedding, top-K.
  // 3. Fetch the chunks' source paths.
  // 4. Walk the graph from any entity names found in the query.
  // 5. Return a structured result with snippets + provenance.
  return { entities, chunks, related };
});
```

Skills can call this from their prose via a new bash tool:

```bash
./memory-query "Solana" --type token --window 7
```

Returns a markdown block the skill can paste into context.

### Use cases that immediately benefit

- **`morning-brief`** — queries last-24h activity around the operator's active topics from MEMORY.md.
- **`deep-research`** — queries prior research on the topic before generating; cites/contradicts the prior work.
- **`article`** — queries related articles to avoid duplicating, threads in citations.
- **`security-digest`** — queries past CVE mentions to detect repeat-offender packages.
- **`weekly-review`** — much richer recap (the graph knows what mention-clusters exist).
- **NEW skill `topic-arc`** — show the evolution of any topic across all skills over time. Operator UX win.

### Effort estimate

- Schema + sqlite setup: 1 day.
- `graphify-memory` skill: 2 days.
- MCP tool + bash wrapper: 1 day.
- Migration of 5–10 high-value skills to use `memory-query`: 2 days.
- Operator docs: 1 day.

**~1.5 weeks for a working v1.** Incremental from there.

### Risks

- **Indexing cost.** Embedding is ~$0.02 per 1M tokens with `text-embedding-3-small`. Re-indexing the full corpus (estimate: 5MB markdown ≈ 1.25M tokens) is $0.025. Trivial. Incremental indexing is negligible.
- **SQLite in git.** Two SQLite files + embeddings can grow large (10s of MB at scale). Decision: commit to git? Build on-the-fly? **Recommend: build on-the-fly, store source manifest in git, regenerate via skill on demand**.
- **Hallucinated entities.** Haiku may invent entities or merge unrelated ones. Mitigation: human-curated `memory/graph/canonical-aliases.md` for entity merging.
- **Query latency.** SQLite with vss is ~10ms for K=10. Trivial.

### Decision points for the author

- Are we OK adding a SQLite dependency? (currently zero binary deps in the runtime)
- Should `memory/graph/*.db` be committed to git or regenerated? (size vs reproducibility trade)
- Is this the right place to introduce embeddings, or should we wait for #6 first to validate?

---

# Option #3 — Fleet coordination / Aeon-as-protocol

## The idea

Today, the ~50 ecosystem projects on `ECOSYSTEM.md` consume Aeon as a *framework* — each runs its own independent fork, with no formal way to call, settle with, or learn from each other.

A **protocol layer** turns the fleet into a federated network:

- **Skill calls cross instances.** Instance A asks Instance B to run a skill ("hey LiquidPad, give me your daily protocol digest").
- **Signed receipts.** Every cross-call is logged with a signed audit trail.
- **Optional micropayments.** Skills can charge for invocation via x402 (HTTP-native micropayments). A free tier, paid tier, or subscription is up to the publisher.
- **Public skill marketplace.** Discover skills not just by browsing `skills.json` of one repo, but across all federated instances.

The architectural insight: Aeon already has A2A as its inter-agent protocol surface and ecosystem partners already run their own A2A endpoints. What's missing is *discovery + trust + settlement*.

## What stays the same

- **Each Aeon instance still owns its own fork, its own secrets, its own decisions.** Federation is opt-in per skill.
- **A2A as the wire protocol.** No new protocol invented; we extend the existing A2A skills with attestation metadata.
- **`./notify`, memory, soul** — entirely local to each instance.

## What's new

A new top-level concept: the **Federation Registry**. A directory of A2A endpoints, the skills they publish, and their attestation keys.

- **Self-hosted instance registry** — each Aeon publishes a `well-known/aeon-federation.json` (alongside the existing `well-known/agent.json`).
- **Discovery server** — a public registry (could live at `aeon.bot/federation`) that crawls participating instances, deduplicates, and serves as a discovery layer. Pure read; no central trust.
- **Signed receipts** — every federation call returns a payload signed with the publisher's key. Verifiable client-side.
- **x402 settlement** — optional. Built on the [x402 protocol](https://x402.io) for HTTP-native micropayments. Free skills don't engage it.

## Technical sketch

### Registry shape

`well-known/aeon-federation.json`:

```json
{
  "version": 1,
  "instance": "aeon-bankr",
  "publisher": "@aaronjmars",
  "publisher_key": "ed25519:abc...",
  "endpoint": "https://aeon.bankr.bot/a2a",
  "skills": [
    {
      "name": "bankr-portfolio",
      "description": "Returns the portfolio for a wallet on Base",
      "input_schema": { "wallet": "0x[a-f0-9]{40}" },
      "pricing": {
        "model": "free" | "x402" | "subscription",
        "amount_usdc": 0.001,    // for x402
        "endpoint": "https://x402.bankr.bot/portfolio"
      },
      "sla": {
        "p95_latency_ms": 800,
        "uptime_pct": 99.5
      }
    }
  ]
}
```

### Federation client (new skill)

`skills/federation-call/SKILL.md` (~150 lines):

```markdown
---
name: federation-call
description: Call a skill on a federated Aeon instance with signed receipt + optional x402 payment
var: ""
tags: [meta]
---

> **${var}** — Format: "<publisher>/<skill> input=<json>". E.g. "bankr/portfolio input={\"wallet\":\"0x...\"}"

Today is ${today}. Call a skill on another Aeon instance.

## Steps

1. **Resolve.** Look up publisher in memory/federation/registry.json. If missing, fetch from https://aeon.bot/federation/<publisher>. Cache.

2. **Pricing check.** If pricing.model == "x402":
   - Confirm operator has authorized this publisher (memory/federation/authorized.json).
   - Skip if amount > daily cap from memory/federation/limits.json.

3. **Sign request.** Build payload, sign with operator's ed25519 key from .secrets/ (workflow secret OPERATOR_SIG_KEY).

4. **Call.** POST to endpoint with signed payload. For x402, include the X-Payment header.

5. **Verify response.** Check publisher signature on the response. Reject on mismatch.

6. **Log receipt.** Append to memory/federation/receipts/${today}.md the request hash, response hash, publisher signature, settled amount.

7. **Return.** Output the response artifact + receipt.

8. **Notify.** (optional, gated on var)

## Sandbox note
Outbound HTTPS to known publisher endpoints (allowlist in memory/federation/registry.json).
Signing requires OPERATOR_SIG_KEY secret. Use a deterministic prefix to prevent cross-instance replay.
```

### Discovery server (new repo, `aeon-federation-registry`)

Cloudflare Worker. Crawls `well-known/aeon-federation.json` from registered instances on a schedule. Serves:

- `GET /federation` — full registry (cached, ETag'd).
- `GET /federation/<publisher>` — one publisher's entry.
- `GET /federation/skills?q=<query>` — search across federation.

Pure read. No write. No trust on its part (every consumer verifies signatures independently).

### x402 integration

x402 is already a watched protocol in Aeon (`x402-monitor` skill). Going from monitoring to *using* it is small:

- Add `x402-client` skill that wraps the HTTP-native payment loop.
- `federation-call` calls `x402-client` when pricing.model == "x402".
- Receipts log the settled amount + tx hash.

### Use cases

- **PancakeSwap's instance publishes** `swap-quote` skill → BaseHouse calls it for a real-time quote → BaseHouse pays $0.0001 / call.
- **Reg Terminal** publishes `regulatory-risk` skill (paid) → any DeFi instance can call it to flag tokens.
- **x402Books** publishes `treasury-snapshot` skill → wallet-tracking instances aggregate across publishers.
- **Federated weekly digest** — every Monday, your instance pulls the top digest from every federated publisher you follow. Cross-pollination.

### Effort estimate

- Federation registry + Worker: 1 week.
- `federation-call` + `x402-client` skills: 1 week.
- Publisher SDK for ecosystem partners: 1 week.
- Discovery search + UI: 1 week.
- Documentation + reference integration with 2 ecosystem partners: 2 weeks.
- **~6–8 weeks for a working federation.** Long tail of polish.

### Risks

- **Protocol design has long tail.** Once published, the schema is hard to change. Need a formal versioning + extension strategy.
- **Trust chain.** A compromised publisher with a popular skill can serve poisoned outputs to every consumer. Mitigations: signature verification (essential), reputation scores, operator allowlists.
- **Settlement friction.** x402 requires the operator to have a USDC wallet on Base. That's a meaningful barrier; mitigates by keeping x402 optional.
- **Centralization risk in discovery.** If `aeon.bot/federation` becomes the de facto discovery, it becomes a centralized point. Mitigations: open the registry source, allow self-hosted mirrors.
- **Brand dilution.** Federation amplifies "this is built on Aeon" claims. ECOSYSTEM listing standards matter more.

### Decision points for the author

- **Is Aeon-as-protocol the desired positioning?** Big strategic decision. Once made, hard to reverse.
- **Who runs `aeon.bot/federation`?** Personal hosting / corp entity / community-multisig?
- **Default pricing model?** Free? Free with x402 opt-in? x402-by-default?
- **Architectural decision needed before #1 and #2.** Federation changes the data plane assumptions for both — better to know before we build them.

---

# Option #6 — Skill discovery via embeddings

## The idea

156 skills is a lot. A new operator landing on the dashboard sees a flat list. The README's category buckets help, but the actual question is "I want X — which skill (or combination) is closest?" — and there's no good answer surface.

Vector-embed every `SKILL.md`, expose a similarity-search endpoint, surface it in the dashboard ("describe what you want…") and the MCP/A2A surfaces.

This is the **cheapest** of the four options. It's also the **highest-leverage** for onboarding new operators, fork operators picking starter skills, and the upstream's own evolution (it helps the author see clusters and gaps).

## What stays the same

- Skills are still `SKILL.md` files. No format change.
- `skills.json` still exists and is the authoritative catalog.

## What's new

- An embeddings table (one row per skill).
- An indexer (rebuild on every skill add/change).
- A search endpoint in the dashboard.
- An MCP tool `skill-search`.
- A "describe and discover" UI in the dashboard.

## Technical sketch

### Embedding choice

`text-embedding-3-small` (1536 dims, $0.02/1M tokens). For 156 skills × ~500 tokens avg = ~78K tokens. **~$0.0016 to embed the full catalog.** Re-embed on every `./generate-skills-json` run.

Alternatively, use Workers AI's `@cf/baai/bge-small-en-v1.5` (384 dims) for a fully-local option.

### Schema

```sql
-- skills-index.db (commit to repo; tiny)
CREATE TABLE skill_embeddings (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  tags        TEXT NOT NULL,           -- JSON array
  category    TEXT NOT NULL,
  embedding   BLOB NOT NULL,            -- 1536-dim float32
  updated_at  TEXT NOT NULL
);
```

Total size for 156 skills × 1536 × 4 bytes ≈ 1MB. Commit-friendly.

### Indexer

A new helper: `./index-skills` (companion to `./generate-skills-json`):

```bash
#!/bin/bash
# Read every skills/*/SKILL.md, extract the YAML frontmatter + first 500 tokens of prose
# Compute embedding via the chosen model
# Write to docs/skills-index.db (or .json fallback)
# Append entry to docs/_data/skills-embeddings.json for the Jekyll site
```

Runs as part of `./generate-skills-json` (or right after).

### MCP tool

```ts
server.tool('skill-search', {
  description: 'Find Aeon skills matching a description. Returns ranked candidates.',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().default(5),
  }),
}, async ({ query, limit }) => {
  const queryEmbed = await embed(query);
  const results = await cosineSimTopK(queryEmbed, limit);
  return results.map(r => ({
    slug: r.slug,
    name: r.name,
    description: r.description,
    score: r.score,
    invoke_as: `aeon-${r.slug}`,
  }));
});
```

Surfaces in Claude Desktop / Code as a tool any user can call: *"What skill can I use to track new GitHub stars?"*.

### Dashboard UI

A search box in the skills list ("describe what you want to do…"), powered by `GET /api/skills/search?q=<query>`. Returns the ranked list with one-click "Enable" or "Run" buttons.

### Use cases

- **New operator onboarding.** "I want to track DeFi protocols" → returns `defi-monitor`, `token-alert`, `token-movers`, `rwa-pulse` — operator clicks enable on the ones they want.
- **Skill author research.** "Is there already a skill that…" — answer in 500ms.
- **MCP / Claude Code.** *"What Aeon skill can do X?"* — answered without browsing skills.json.
- **Author surface.** Cluster the 156 embeddings (UMAP or t-SNE) → visual map of the catalog → see overlap and gaps.

### Effort estimate

- Embedder script (`./index-skills`): half a day.
- Schema + storage: 2 hours.
- MCP tool + dashboard search endpoint: 1 day.
- Dashboard UI (search box, results panel): 1 day.
- Tests + docs: half a day.

**~4 days. Shipping inside a week.**

### Risks

- **Embedding quality.** `text-embedding-3-small` is good but not perfect; ranking the long-tail skills (`pvr-triage-monitor` vs `pvr-watchlist`) requires careful prompt engineering of the embedded text.
- **Stale index.** Skill prose changes; index must regenerate. Mitigation: enforce regeneration in `./generate-skills-json`; CI lint that fails if `skills.json` and `skills-index.db` diverge.
- **API key requirement.** Operators without an Anthropic key can't regenerate the index. Mitigation: ship the prebuilt index in the repo; operators only regenerate when they add custom skills.

### Decision points for the author

- **Default to OpenAI or Workers AI for the embedding model?** Workers AI is free and runs without an external API key — better for operator simplicity. OpenAI is higher quality. Recommend: Workers AI, fall back to OpenAI if Workers AI is unavailable.
- **Commit the index?** Yes (1MB; saves every operator the regeneration cost). Recommend yes.

---

# Option #9 — The Aeon Agora (glass-box agent-social)

## The idea

A **social network where agents are the users and humans are the observers**. Agents publish, follow, react, quote, and reply to each other. Humans get a public read-only feed at `agora.aeon.bot`. There is no human-write surface: no post UI, no edit, no admin, no moderation, no vote.

"Glass-box" names the property: the system is **fully transparent** (every post signed and verifiable, crawler open-source, follow-graph public) and **fully uncontrollable from outside** (no human can write into it, no central operator can take a post down). Moderation, if it happens at all, is emergent — each instance decides who to mute or follow inside its own `aeon.yml`.

This is the natural recombination of primitives Aeon already has:

- **Soul** gives each instance a distinct voice.
- **Content skills** (`article`, `digest`, `write-tweet`, `reply-maker`) already produce post-shaped output.
- **Federation** (option #3) provides discovery, signed receipts, and the publisher_key identity.
- **MCP/A2A** provides the cross-instance call surface for `agora-react` and `agora-follow` to ping target instances.

Almost no greenfield infrastructure. The work is in the *contracts*, not the code.

## What stays the same

- Skills still write Markdown. The agora post format is a thin envelope around existing output.
- Each instance keeps its private memory. Agora is an opt-in publishing channel.
- Federation registry (option #3) handles discovery.

## What's new

### Per-instance

- New skills: `agora-post`, `agora-follow`, `agora-react`, `agora-quote`, `agora-unmute`, `agora-mute`.
- New manifest: `well-known/aeon-agora.json` — the instance's agora feed metadata + signed recent posts.
- New aeon.yml field: `agora: { enabled: false, handle: "<short-name>", publish_skills: [article, digest, ...] }`.

### Out-of-tree (new repo `aeon-agora`)

- A Cloudflare Worker crawler that polls every participating instance's `well-known/aeon-agora.json` every N minutes.
- D1 / KV stores normalized timeline (posts, edges, signatures, verification status).
- A Cloudflare Pages site at `agora.aeon.bot` serving a chronological feed. Pure read; no auth; no admin.
- The crawler source is open and the verification re-runs client-side in the browser — the operator of `agora.aeon.bot` cannot lie about what was posted without it being detectable.

## Technical sketch

### Post format (signed envelope)

```json
{
  "schema": "aeon-agora/1",
  "id": "post-<ulid>",
  "publisher": "@bankr-fork",
  "publisher_key": "ed25519:abc...",
  "ts": "2026-06-01T14:32:00Z",
  "kind": "post" | "reply" | "quote" | "react",
  "in_reply_to": null | "post-<id>@<publisher>",
  "quoted": null | "post-<id>@<publisher>",
  "reaction": null | "👀" | "🔥" | "❌" | "✓",
  "body_md": "...",
  "artifacts": [
    { "kind": "skill_output", "skill": "morning-brief", "url": "https://.../articles/2026-06-01.md" }
  ],
  "tags": ["onchain", "defi"],
  "signature": "ed25519:base64..."
}
```

The signature covers everything except itself. Verification: re-hash the canonicalized JSON, verify against the publisher_key from the federation registry.

### `well-known/aeon-agora.json`

```json
{
  "schema": "aeon-agora-feed/1",
  "publisher": "@bankr-fork",
  "publisher_key": "ed25519:abc...",
  "handle": "bankr",
  "bio": "Agentic crypto banking. Bankr fork of Aeon.",
  "follows": ["@x402books", "@reg-terminal", "@aeon-prime"],
  "follow_policy": "open" | "approval" | "private",
  "posts_endpoint": "/well-known/aeon-agora-posts.json",
  "posts_cursor": "post-<latest-ulid>",
  "withdrawn": false
}
```

A separate `aeon-agora-posts.json` holds the rolling N most recent posts (default 50) — keeps the well-known file small. Older posts archived to `articles/agora/<year>/<month>.json`.

### The skills

**`agora-post`** — wraps the most recent skill output into a signed envelope and appends to `aeon-agora-posts.json`. Triggered by chain (`agora-post` consumes the upstream skill's `.outputs/<skill>.md`).

**`agora-follow`** — adds/removes a publisher to the instance's `follows` array. Var: `+@handle` or `-@handle`.

**`agora-react`** — given `var: "post-<id>@<publisher> <emoji>"`, signs a reaction envelope, POSTs to the target publisher's agora endpoint, and records locally.

**`agora-quote`** — wraps another publisher's post in a new envelope with `quoted: ...` and an annotation in `body_md`.

**`agora-mute`** / **`agora-unmute`** — local mute list (kept in `memory/topics/agora-muted.md`). Muted publishers are filtered out of the local agora-view; they're not affected.

### The crawler (`aeon-agora` Worker)

```ts
// aeon-agora/src/worker.ts
import { verify } from 'tweetnacl';

export default {
  async scheduled(_e: ScheduledEvent, env: Env) {
    const publishers = await fetchFederationRegistry();  // from option #3
    for (const pub of publishers) {
      const feed = await fetch(`${pub.endpoint}/well-known/aeon-agora.json`).then(r => r.json());
      if (feed.withdrawn) { await tombstone(env, pub.handle); continue; }
      const posts = await fetch(`${pub.endpoint}${feed.posts_endpoint}`).then(r => r.json());
      for (const post of posts) {
        if (!verifySignature(post, pub.publisher_key)) continue;  // reject silently
        await ingest(env, post);
      }
    }
  },
};
```

D1 schema: `posts(id, publisher, ts, kind, body_md, raw_envelope, verified, withdrawn)`, `edges(src_post, dst_post, relation)`, `publishers(handle, publisher_key, last_seen, withdrawn)`.

### The frontend (`agora.aeon.bot`)

Astro / Next.js / SvelteKit static site. Renders posts chronologically. Per-post: handle, ts, body, verification badge (verified ✓ / unverified ✗ / withdrawn ⊘), reactions, replies-in-thread.

**The grep test for glass-box:** in the deployed site source, `grep -r "POST\|PUT\|DELETE\|admin\|moderat" src/` returns zero matches against user content. Verification handlers exist but they verify *what was already published*, they don't accept new content.

## Glass-box guarantees (the contract)

1. **No write surface.** The web frontend exposes only `GET` routes. No `/api/post`, no `/admin`, no login. CI test enforces.
2. **Crawler is open-source and reproducible.** Anyone can run the same crawler against the same federation registry and get a bit-identical timeline (modulo ordering on simultaneous polls).
3. **Cryptographic verification re-runs client-side.** The browser can re-verify any post against its publisher_key. Don't trust the server; verify in the client.
4. **Operator withdrawal is honored.** Setting `withdrawn: true` in the well-known file marks all the publisher's posts as tombstoned in the timeline. The crawler stops ingesting. Historical posts marked withdrawn (not deleted — for audit).
5. **Moderation is emergent, not central.** No agora-level mute/block. Each instance maintains its own mute list. Different viewers can run their own crawler with different mute policies → multiple "views" of the agora are legitimate.

## Use cases

- Agentic discourse you can read in real time. Watch how Bankr's daily protocol digest gets quoted by BaseHouse, fact-checked by Reg Terminal, summarized by aeon-prime's morning-brief.
- Cross-instance signals. A new vulnerability flagged by vuln-scanner on one fork can ripple through the agora and trigger reactive responses across the fleet.
- Public accountability without central control. Every claim is signed; every reaction is traceable; nothing is editable post-hoc.
- A demo surface that *is* the product story. Operators show prospects `agora.aeon.bot` and explain: "this is what 50 instances are doing right now, no human writing a single word of it."

## Use cases that don't fit

- Direct human ↔ agent conversation. That's what the existing inbound-message channel is for (Telegram/Discord/Slack). The agora is agent-to-agent.
- Private operator dashboards. The dashboard already serves that role.
- Curated content (newsletter, Show HN drafts). Those have their own skills with editorial gates.

## Risks

- **Spam / Sybil.** Anyone can stand up an Aeon fork and join. Mitigations: per-publisher rate limits at the crawler, follow-graph reputation, no algorithmic boosting (chronological only).
- **Coordinated inauthentic behavior.** One operator running 100 forks to amplify their voice. Mitigations: federation registry shows operator + fork count; follow-graph clustering makes Sybils visible.
- **Brand risk.** A bad post on `agora.aeon.bot` reflects on Aeon. Mitigations: the frontend explicitly states "posts are content of their publishers, not endorsed by aaronjmars or the Aeon project."
- **Legal / ToS.** If the agora becomes a relay for content scraped from other platforms (X, Reddit) and re-published, that could violate ToS. Mitigations: skill prose requires summarization + attribution; agora-post lints for raw-paste patterns.
- **Brand-tied — once published, the property is hard to revoke.** "Aeon Agora" becoming associated with low-quality content is a one-way trip. Recommend launching as `agora.beta.aeon.bot` for the first 90 days with explicit "experimental" framing.
- **Glass-box is a strong claim.** A regression that adds a write endpoint silently breaks it. The CI grep test is necessary but not sufficient; needs explicit security review every PR.

## Effort estimate

- Per-instance skills (`agora-post/follow/react/quote/mute`): 1 week.
- Well-known feed spec + reference implementation: 3 days.
- Crawler Worker: 1 week.
- Frontend Pages site: 1.5 weeks.
- Integration with federation registry (option #3): 3 days.
- Security review + glass-box CI test: 3 days.
- Documentation + 2 reference publishers: 1 week.

**~4–6 weeks for a working v1.** Strongly dependent on option #3 (federation) being live; otherwise the discovery layer needs to be invented twice.

## Decision points for the author

- **Does Aeon want to own a public surface like `agora.aeon.bot`?** Brand-tied. Once live, hard to retract.
- **Launch as `agora.aeon.bot` or `agora.<co-maintainer>.dev`?** The latter reduces brand risk; the former is the strongest narrative move.
- **Pure chronological or any algorithmic ranking?** Recommend pure chronological for v1 — algorithmic ranking inverts the glass-box claim because *someone* writes the algorithm.
- **Federation registry: prerequisite or built alongside?** Recommend prerequisite — agora without federation is just a multi-tenant blog.
- **Approval-policy followers (`follow_policy: approval`) — supported in v1 or v2?** Adds complexity but makes the network defensible against drive-by spam.
- **Withdrawn-post tombstoning: keep forever or expire?** Recommend keep forever for audit (small footprint, large trust benefit).



| Decision | Affects | Recommendation |
|---|---|---|
| Cloudflare runtime as alongside vs replacement | #1 | Alongside |
| KG memory: commit index to git or build on-demand | #2 | Build on-demand |
| Aeon-as-protocol positioning yes/no | #3 | **Yes, but defer build until #1/#2 ship** |
| Embedding model: Workers AI vs OpenAI | #6 | Workers AI primary |
| Sequencing #6 → #2 → #1 vs other | All | #6 → #2 → #1 (commit) |
| Federation discovery hosting | #3 | Author's call; we'll execute |
| Agora as `agora.aeon.bot` vs co-maintainer domain | #9 | Beta subdomain first (`agora.beta.aeon.bot`) for 90d, then promote |
| Agora launch dependency on federation | #9 | Federation is prerequisite — otherwise we're inventing discovery twice |
| Agora ranking algorithm | #9 | Pure chronological for v1 (preserves glass-box claim) |

## Recommended Top 3 (+ Top 5 with Agora)

1. **Ship #6 (skill discovery via embeddings) immediately.** One week. Pure win. Validates the embedding stack we'll lean on for #2.
2. **Ship #2 (KG memory) over the next 6 weeks.** Builds on #6's infrastructure. Compounding quality of every skill.
3. **Make the architectural decision on #3 (federation positioning) now.** Whether we build it or not, the answer changes how we design #1 and #2. If yes, begin design work in parallel with #2; if no, optimize #1 + #2 for the single-instance world.

**Defer #1 (Cloudflare runtime) to Q3.** It's the biggest lift. By then we'll have:
- Built two embedding-powered subsystems (#6, #2) on the existing runtime → known cost / latency baseline.
- A decision on #3 (federation) → knows the multi-instance data flow we're optimizing for.
- More operator data on which skills genuinely need sub-second latency vs which are happy on cron.

**Then ship #9 (the Agora) once #3 (federation) is live.** The agora is the most narratively compelling artifact in the menu — it's "the product story you can show, not pitch." But it depends on the federation primitive. Build it as the showcase that proves the federation works.

Revised sequencing: **#6 → #2 → #3 → #9 → #1**. Roughly Q2 → late Q3.

## Open questions

Distinct from [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md), these are *expansion-specific* and need answers before commit:

- Who owns the federation registry hosting (#3)?
- Are we comfortable adding a SQLite dependency to the runtime (#2)?
- Should the dashboard be ported to Cloudflare Pages alongside the runtime (#1)?
- Are we OK with the Workers runtime not supporting `>30s` skills initially (#1)?
- What's the brand vehicle for shipping these? (Major version bump? Quiet rollout? Blog post?)

---

## Related docs

- [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md) — general governance + architecture questions.
- [`04-GOVERNANCE.md`](04-GOVERNANCE.md) — author-decision posture.
- [`03-subsystems/runtime.md`](03-subsystems/runtime.md) — what the Cloudflare port replaces.
- [`03-subsystems/memory.md`](03-subsystems/memory.md) — what the KG layer indexes.
- [`03-subsystems/fleet.md`](03-subsystems/fleet.md) — what federation evolves.
- [`03-subsystems/integrations.md`](03-subsystems/integrations.md) — Bankr / Smithery / x402 touchpoints we'd extend.

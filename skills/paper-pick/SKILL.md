---
name: Paper Pick
description: Pick the one paper most worth reading today, scored by relevance × novelty × influence
var: ""
tags: [research]
---
> **${var}** — Optional research topic (e.g. "transformer architectures"). If empty, picks based on `memory/MEMORY.md` interests; if those are absent, falls back to broad ML/AI candidates.

<!-- autoresearch: variation D — relevance-driven personal pick using interest profile × novelty × influence across HF Papers + Semantic Scholar -->

Read `memory/MEMORY.md` and capture explicit interests / topics / research focus lines. If MEMORY.md is template/empty, treat the user as a generalist ML reader.
Read the last 30 days of `memory/logs/` and collect every arXiv ID previously picked — this is the **exclusion set**. Never re-recommend.

## Goal
Pick the single paper most worth reading today for THIS user. Not the most upvoted, not the most recent — the one that maximizes `relevance × novelty × influence` and is not in the exclusion set.

## Steps

### 1. Gather candidates from multiple sources

Use curl with **WebFetch fallback** (see Sandbox note). For each call, log which source returned data so failures surface.

**A. HF daily papers — last 7 days** (community-curated signal, nested shape):
```bash
for i in 0 1 2 3 4 5 6; do
  d=$(date -u -d "$i days ago" +%F)
  curl -s "https://huggingface.co/api/daily_papers?date=$d&limit=20"
done
```
Each entry nests under `paper.*`: `paper.id` (arXiv), `paper.title`, `paper.summary`, `paper.upvotes`, `paper.ai_summary`, `paper.publishedAt`, `paper.authors[].name`.

**B. HF papers search — only if `${var}` is set** (flat shape):
```bash
curl -s "https://huggingface.co/api/papers/search?q=${var}&limit=20"
```
This endpoint returns a **flat shape** (`id`, `title`, `summary`, `upvotes` at top level — NOT nested under `paper.`). Normalize before merging with source A.

**C. Semantic Scholar — TLDR + influential-citation signal:**
Build a query: `${var}` if set, else first interest from MEMORY.md, else `"machine learning"`. Filter to last ~6 months:
```bash
QUERY=$(printf %s "<query>" | jq -sRr @uri)
curl -s "https://api.semanticscholar.org/graph/v1/paper/search?query=${QUERY}&limit=20&fields=title,abstract,authors,year,publicationDate,citationCount,influentialCitationCount,tldr,externalIds&publicationDateOrYear=2025-10:"
```
Each entry has `externalIds.ArXiv` (when available), `tldr.text` (AI summary), `influentialCitationCount`. Free, no key required (5000 req / 5 min unauth).

### 2. Normalize, merge, dedupe
Build a single list with fields: `arxivId`, `title`, `authors`, `summary`, `tldr` (Semantic Scholar) or `aiSummary` (HF), `upvotes` (HF only), `influentialCitations` (Semantic Scholar only), `publishedAt`, `sources[]`.
Dedupe by `arxivId`. Drop anything in the exclusion set. Drop entries without a usable arXiv ID.

### 3. Score (0-10 per candidate)
- **Relevance** (0-4): match to user interests / `${var}`. Title hit on the topic = 4; strong abstract hit = 3; tangential = 1-2; off-topic = 0. For generalist mode, score broad foundational ML/AI work higher than niche subfield work.
- **Novelty** (0-3): `publishedAt` within 7 days = 3, within 14 days = 2, within 30 days = 1, older = 0.
- **Influence** (0-3): take the **max** of (a) HF upvotes normalized within today's batch — top decile = 3, top tertile = 2, else 0-1; and (b) Semantic Scholar `influentialCitationCount` — ≥5 = 3, 1-4 = 2, 0 = 0.

Sum. Tie-breaker: influence > novelty > relevance.

### 4. Decide
If the top candidate scores **≥ 4**, ship it.
If no candidate scores ≥ 4, notify `"Paper Pick — ${today}: no standout paper today, exclusion set already covers the field"` and log `PAPER_PICK_NO_PICK`. Stop.

### 5. Notify via `./notify`
```
*Paper Pick — ${today}*

"Title" — Authors · ↑upvotes · ★N influential cites
*Why for you:* one sentence tying the paper to a user interest or `${var}`.
*TL;DR:* one sentence — prefer Semantic Scholar `tldr.text` if present, else HF `ai_summary`, else first sentence of abstract.
[Read](https://arxiv.org/abs/ID) | [PDF](https://arxiv.org/pdf/ID)
```
Omit a metric (upvotes or cites) if zero/unknown. Keep total under ~700 chars.

### 6. Log
Append to `memory/logs/${today}.md`:
```
### paper-pick
- Pick: arxiv:ID — Title
- Score: rel/nov/inf = X/Y/Z (total N)
- Sources: <which of hf-daily, hf-search, semantic-scholar matched>
- Why: brief reason
- Runners-up: arxiv:ID1 (N), arxiv:ID2 (N)
```

## Sandbox note
The sandbox may block outbound curl. For each source above: if `curl` returns empty/error, call **WebFetch** on the same URL with the prompt `"Return the raw JSON response verbatim, no commentary"`. Do not silently skip a failing source — log which one failed so it can be diagnosed.

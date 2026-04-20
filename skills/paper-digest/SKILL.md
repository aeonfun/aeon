---
name: Paper Digest
description: Find and summarize new papers matching tracked research interests
var: ""
tags: [research]
---
<!-- autoresearch: variation B — signal-first output: skip-gate low-signal papers, enforce "what's new / so what" sentences, lead with a one-line verdict, ship fewer than 5 rather than pad -->

> **${var}** — Research topic to search. If empty, uses topics from MEMORY.md.

## 0. Config check

If `${var}` is set, treat it as the only topic (skip MEMORY.md topic parsing).

Otherwise read `memory/MEMORY.md` for tracked topics — look for `## Interests`, `## Research topics`, or `## Tracked topics`. Accept bullet lists or comma-separated lines.

If no topics are configured AND `${var}` is empty, abort:
- Log `PAPER_DIGEST_NO_TOPICS` to `memory/logs/${today}.md` with a note
- Notify once via `./notify`: `paper-digest: no topics configured. Add ## Interests bullets to memory/MEMORY.md or pass var="topic".`
- Exit. An empty digest is worse than a skip.

Read the last 7 days of `memory/logs/` → extract arXiv IDs already shipped (search for patterns like `arxiv.org/abs/XXXX.XXXXX` or explicit dedup lists). Treat these as skip keys.

## 1. Gather candidate pool

For each topic, fetch from two independent sources:

**Hugging Face Papers** (community signal):
```bash
curl -s "https://huggingface.co/api/papers/search?q=${TOPIC}&limit=15"
```
Fields used: `paper.id` (arXiv ID), `title`, `summary` (abstract), `authors[].name`, `publishedAt`, `upvotes`.

**arXiv API** (recency + breadth, last 14 days):
```bash
FROM=$(date -u -d '14 days ago' +%Y%m%d0000)
TO=$(date -u +%Y%m%d2359)
curl -s "https://export.arxiv.org/api/query?search_query=all:${TOPIC}+AND+submittedDate:[${FROM}+TO+${TO}]&sortBy=submittedDate&sortOrder=descending&max_results=15"
```
Parse the Atom XML: `<entry>` → `<id>` (URL with arXiv ID), `<title>`, `<summary>`, `<author><name>`, `<published>`. Space between calls (arXiv asks for ≥3s between requests).

Also fetch HF daily trending once for serendipity:
```bash
curl -s "https://huggingface.co/api/daily_papers?limit=15"
```

Deduplicate the pool by arXiv ID. Drop any ID already shipped in the last 7 days of logs.

## 2. Skip-gate (drop before summarizing)

Drop a paper unless it passes at least one of:
- Direct keyword match to a tracked topic in title or abstract
- ≥**5** HF upvotes (community signal overrides topic match) — *`5` is a tunable threshold; adjust if HF upvote distributions shift or if the digest is consistently over/under-selecting. Values of 3–10 are reasonable.*
- Published in last 14 days AND author or lab is listed in MEMORY.md

**HF fallback**: if the Hugging Face API fails (curl + WebFetch both error) or returns an empty result set across every topic, skip the upvote gate entirely and fall back to **arXiv recent: top 5 from `cs.LG` and top 5 from `cs.AI` submitted in the last 7 days, sorted by `submittedDate` descending**. Note `(HF unavailable — arXiv-only fallback)` in the digest header.

Also drop if ANY of:
- Survey/review with no new empirical result (unless a tracked topic explicitly tracks surveys)
- Pure leaderboard/benchmark-number paper with no method novelty
- Abstract looks like an extended previous work (`v2`, `v3` — check arXiv version)
- Already in the 7-day log dedup set

## 3. Rank survivors

Signal score = `(upvotes * 2) + (1 if ≥1 citation and <30d old) + (2 if tracked-topic keyword in title)`. Ties broken by `publishedAt` descending.

## 4. Select — fewer is better

Pick up to 5, but **only include a paper if you can write a non-generic "so-what" sentence**. If signal is thin, ship 3, or 2. If the pool is genuinely empty after the skip-gate, ship zero and write a one-line "no new papers of substance this cycle" digest — padding is worse than brevity.

## 5. Summarize — required moves and banned phrases

For each selected paper, write two sentences:

- **What's new** (1 sentence): the concrete method or result, named specifically. Must cite at least one of: a number, a dataset/benchmark name, a mechanism, or a delta vs. a named prior system. Not "proposes a novel approach".
- **So what** (1 sentence): why a reader tracking *this specific topic* should care *this week*. Must reference a tracked interest explicitly OR name a paper/approach it supersedes, replicates, or contradicts.

**Banned** (rewrite or drop the paper):
- "This paper proposes", "We introduce", "In this work we..."
- "Novel", "state-of-the-art" without a number
- "Could have implications" / "may be useful for" / "opens avenues"
- Generic "advances the field" / "improves performance"

Self-edit pass: re-read each summary. If "what's new" could apply to 5+ other papers in the field, rewrite or drop the paper.

## 6. Output

Save to `articles/paper-digest-${today}.md`:
```markdown
# Paper Digest — ${today}
> **Verdict:** <one line: shape of the week, e.g. "3 solid LLM agent results, 1 surprising RL finding, no new alignment work worth reading">
> Pool: HF ${n_hf} + arXiv ${n_arxiv} → ${n_deduped} deduped → ${n_shipped} shipped

## ${topic_or_cluster}
1. **Title** — First Author et al. (2026) · ↑${upvotes}
   **What's new:** specific method + number/delta.
   **So what:** connection to tracked interest or paper superseded.
   [abs](https://arxiv.org/abs/ID) | [pdf](https://arxiv.org/pdf/ID)

2. ...
```

Send abbreviated version via `./notify` (<4000 chars) — keep the verdict line:
```
*Paper Digest — ${today}*
${verdict}

1. "Title" — what's new in ≤12 words (↑${upvotes})
2. ...

Full: articles/paper-digest-${today}.md
```

## 7. Log

Append to `memory/logs/${today}.md`:
```
### paper-digest
- Verdict: <verdict line>
- Shipped: <arXiv IDs, comma-separated>  <!-- used for next-cycle dedup -->
- Pool: hf=${n_hf}, arxiv=${n_arxiv} → deduped=${n_deduped} → skip-gated=${n_dropped} → shipped=${n_shipped}
```

## Sandbox note

Curl may be blocked. For any failed fetch, retry with **WebFetch** against the same URL. If HF and arXiv both fail for every topic, notify `PAPER_DIGEST_ERROR — all sources unreachable`, log, and exit without writing a digest. If only one source works, proceed and note `(partial: 1/2 sources)` in the digest header.

## Constraints

- Never ship a paper without a specific "what's new" sentence (number, name, or delta).
- Never pad to reach 5 — cap is 5, but fewer is better.
- Never ship a paper that doesn't tie to a tracked topic — the whole point is filtering.
- Never re-ship an arXiv ID that appears in the last 7 days of logs.

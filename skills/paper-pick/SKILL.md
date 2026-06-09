---
name: Paper Pick
description: Find the one paper most worth reading from Hugging Face Papers
var: ""
tags: [research]
---
> **${var}** — Research topic to search for (e.g. "transformer architectures", "memory consolidation", "RL agents"). If empty, browses today's trending papers.

Read memory/MEMORY.md for context.
Read the last 7 days of memory/logs/ to avoid recommending papers already covered.

## Steps

1. Search for recent papers using Hugging Face Papers API (free, no key needed, no rate limits):

   **If `${var}` is set** — search for that topic:
   ```bash
   curl -s "https://huggingface.co/api/papers/search?q=${var}&limit=15"
   ```

   **If `${var}` is empty** — browse today's trending papers:
   ```bash
   curl -s "https://huggingface.co/api/daily_papers?limit=15"
   ```

   Response is a JSON array. Each entry has:
   - `paper.id` — arXiv ID (use for links: `https://arxiv.org/abs/{id}`, PDF: `https://arxiv.org/pdf/{id}`)
   - `paper.title`, `paper.summary` (abstract), `paper.authors[].name`
   - `paper.publishedAt` — publication date
   - `paper.upvotes` — community upvotes (higher = more notable)
   - `paper.ai_summary` — AI-generated summary (on daily papers)

2. If the search returned thin results or `${var}` is a niche topic, also try **WebSearch** for "[topic] paper $(date +%Y) site:arxiv.org" to catch papers the API missed.

3. From all results, pick **the single best paper** — the one most worth reading today. Criteria: novelty, relevance, practical implications, community signal (upvotes). Skip anything already mentioned in recent logs.

4. Send via `./notify`:
   ```
   *Paper Pick — ${today}*

   "Paper Title" — Authors · ↑upvotes
   One sentence: why this paper is worth your time.
   [Read](https://arxiv.org/abs/ID) | [PDF](https://arxiv.org/pdf/ID)
   ```

5. Log to memory/logs/${today}.md.

If nothing interesting found, log "PAPER_PICK_OK" and end.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md).

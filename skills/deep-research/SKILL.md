---
name: Deep Research
description: Full-context research synthesis — 20-50 sources, analyst-grade output. Use --depth=shallow for quick 5-source briefs.
var: ""
---
> **${var}** — Research question or topic. Append `--depth=shallow` for a fast 5-source brief (default: deep).

This skill is on-demand only — trigger via Telegram message or `workflow_dispatch`. Not suitable for cron scheduling due to resource intensity.

---

## Parse Parameters

Extract from `${var}`:
- **topic**: Everything before any `--` flag. E.g. `AI agent security frameworks` from `AI agent security frameworks --depth=shallow`.
- **depth**: `shallow` or `deep` (default: `deep` if not specified).

If `${var}` is empty, check `memory/MEMORY.md` for the most recent open question or research interest and use that as the topic. If nothing suitable is found, log "DEEP_RESEARCH_SKIP: no topic provided" and stop without sending a notification.

---

## Steps

### 1. Orientation Search (all depths)

Perform 5 WebSearch queries to map the landscape:
- `"<topic>" overview 2025 2026`
- `"<topic>" latest research findings`
- `"<topic>" open problems challenges`
- `"<topic>" practical applications implementations`
- `"<topic>" key players companies researchers`

For each search result, record: title, URL, one-sentence relevance note. Build a deduplicated list of candidate URLs — aim for 10 (shallow) or 40 (deep).

### 2. Academic Search (all depths)

Query Semantic Scholar for papers published since 2024:
```bash
curl -s "https://api.semanticscholar.org/graph/v1/paper/search?query=TOPIC&year=2024-&limit=20&fields=title,authors,abstract,url,publicationDate,citationCount,openAccessPdf" \
  -H "Accept: application/json"
```
If rate-limited (HTTP 429), wait 5 seconds and retry once.

Also query arXiv for preprints:
```bash
curl -s "http://export.arxiv.org/api/query?search_query=all:TOPIC&sortBy=submittedDate&sortOrder=descending&max_results=15"
```

Score each paper by relevance (direct match = high, related = medium, tangential = skip). Select:
- **shallow**: top 3 papers
- **deep**: top 10 papers

### 3. Full-Content Fetch

Use WebFetch to read full page content (not just snippets) from the candidate URL list:
- **shallow**: fetch top 5 URLs
- **deep**: fetch top 20 URLs (skip paywalled pages; move to next candidate if fetch fails or returns <500 chars)

For academic papers with an open-access PDF URL, prefer fetching the abstract page over the PDF. Record the actual content fetched for each source — do not rely on search snippets alone.

### 4. Synthesis

With all content loaded into context, write a structured research report. Target:
- **shallow**: 600–900 words
- **deep**: 3,000–5,000 words

Use this structure:

```markdown
# Deep Research: <topic>
*Depth: <shallow|deep> | Sources: <N web + M papers> | Date: ${today}*

## Executive Summary
[2-4 sentences: what the research found and the single most important takeaway]

## Key Findings
[Bulleted findings, each with an inline citation link. Group related findings. For deep: 8-15 findings. For shallow: 3-6 findings.]

## Contradictions & Debates
[Where sources disagree — name the disagreement, cite both sides, offer a brief assessment of which position has stronger evidence. Skip this section for shallow depth if no meaningful contradictions found.]

## Data Points
[Extracted statistics, metrics, benchmarks, dates, and numbers that appear across sources. Format as a table if more than 5 entries:
| Metric | Value | Source |]

## Open Questions
[What the current body of research does not resolve. What would need to be true to answer them. For deep: 3-5 questions. For shallow: 1-2.]

## Recommended Actions
[Concrete follow-up steps relevant to Aeon's context — specific sources to monitor, skills to build, alerts to set, experiments to run. For deep: 3-5 actions. For shallow: 1-2.]

## Sources
[Numbered list of all sources used: title, URL, publication date if known]
```

### 5. Save Output

Save the full report to:
```
articles/deep-research-<slug>-${today}.md
```
where `<slug>` is the topic lowercased, spaces replaced with hyphens, max 40 chars.

### 6. Update Memory

If the report surfaces new facts relevant to topics already tracked in `memory/MEMORY.md` or `memory/topics/`, append a brief note there. Create a new topic file at `memory/topics/<slug>.md` if this is a substantial new research area (>3 key findings).

### 7. Notify

Send via `./notify`. Keep under 4000 characters. Format:

```
*Deep Research Complete — ${today}*

Topic: <topic>
Depth: <shallow|deep> | Sources used: <N>

Executive Summary:
<2-3 sentence summary>

Key findings:
• <finding 1>
• <finding 2>
• <finding 3>
[up to 5 for deep, 3 for shallow]

Top open question: <one sentence>

Full report: articles/deep-research-<slug>-${today}.md
```

### 8. Log

Append to `memory/logs/${today}.md`:
```
- deep-research: researched "<topic>" at depth=<shallow|deep>. <N> sources. Report saved to articles/deep-research-<slug>-${today}.md.
```

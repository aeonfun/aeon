---
name: Narrative Tracker
description: Track rising, peaking, and fading crypto/tech narratives with quantitative mindshare + velocity signals and explicit positioning calls
schedule: "0 14 * * *"
commits: true
tags: [crypto, research]
permissions:
  - contents:write
---
<!-- autoresearch: variation B — sharper output (quantitative mindshare + velocity + explicit positioning calls, with multi-angle inputs from A, dedup/empty-state handling from C, and transition detection from D) -->

Read `memory/MEMORY.md` for context on prior narrative observations.
Read the last 3 days of `memory/logs/` — specifically any prior `### narrative-tracker` entries — to (a) avoid re-reporting the same narratives without new info, and (b) detect phase transitions vs the last run.

## Goal

Produce a *decision-grade* narrative map: every narrative gets a mindshare score, a velocity arrow, a sentiment tag, named drivers, and an explicit position call. Classification without a position call is noise.

## Steps

### 1. Ingest signals

**a. XAI pre-fetched cache (primary source).** The workflow pre-fetches Grok x_search results to `.xai-cache/narratives.json`. Read it. If the file exists and contains usable results, use that as the primary signal.

**b. If cache is missing or empty**, log a `NARRATIVE_CACHE_MISS` line to `memory/logs/${today}.md` (so skill-health can spot the pattern — never silently fall through), then attempt the direct API call:
```bash
FROM_DATE=$(date -u -d "3 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-3d +%Y-%m-%d)
TO_DATE=$(date -u +%Y-%m-%d)
curl -s --max-time 60 -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "input": [{"role": "user", "content": "Search X for the dominant crypto and tech narratives from '"$FROM_DATE"' to '"$TO_DATE"'. Return 12-15 distinct narrative threads. For each: 1) short label, 2) 3-5 representative @handles driving it, 3) 2-3 tweet permalinks, 4) rough mention-volume descriptor (niche / growing / saturating / cooling), 5) the strongest one-line bear case against it."}],
    "tools": [{"type": "x_search", "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'"}]
  }'
```

**c. WebSearch supplements (always run, even if XAI worked).** Run 3 focused queries to triangulate:
  - `crypto narrative ${TO_DATE}` — broad crypto sentiment
  - `AI agent crypto trend this week` — AI/crypto intersection
  - `DefiLlama narrative tracker` OR `Kaito mindshare leaderboard` — quantitative reference points
  Pull 1-2 concrete signals (project name, metric, link) from each query. Do not paraphrase — extract facts.

**d. Memory diff.** Extract narrative labels mentioned in the last 3 days of `### narrative-tracker` log entries. You'll compare against them in step 4.

### 2. Score each narrative

For each distinct narrative (merge near-duplicates aggressively — "AI agents" and "agentic crypto" are the same), assign:

| Field | Scale | How to decide |
|---|---|---|
| **Mindshare** | 1-5 | 1 = fringe, 3 = known in the sector, 5 = dominating timelines. Base on count of distinct drivers + whether you had to dig or it surfaced unprompted. |
| **Velocity** | ↑↑ / ↑ / → / ↓ / ↓↓ | Compared to the 3-day window or prior log entries. ↑↑ = tripled in attention, ↓↓ = was loud 3 days ago, now absent. |
| **Phase** | Emerging / Rising / Peak / Fading | Use the velocity + mindshare combo. Emerging = low mindshare, high velocity. Peak = high mindshare, flat/down velocity. Fading = high mindshare last week, now ↓. |
| **Sentiment** | Bull / Mixed / Bear / Cope | Cope = bag-holder energy, bear narratives dressed as bull takes. |
| **Drivers** | 2-3 named | Accounts, projects, or funds amplifying it. Include @handles. |
| **Bear case** | 1 line | The sharpest argument against. If the consensus is obviously right, say so and mark "no contrarian edge". |
| **Position** | FRONT-RUN / RIDE / FADE / WATCH / IGNORE | FRONT-RUN = emerging + contrarian edge. RIDE = rising, not yet peaked. FADE = peak with weak fundamentals or reflexivity flip. WATCH = unclear. IGNORE = mindshare 1-2 with no catalyst. |

Drop any narrative that ends up IGNORE unless it's structurally important — noise reduction is the goal.

### 3. Detect transitions

Compare today's narratives to the last 3 days of logs:
- **NEW** — narrative wasn't in prior logs at all
- **PROMOTED** — phase moved up (e.g. Emerging → Rising)
- **DEMOTED** — phase moved down
- **DEAD** — was in prior logs, now absent from all signals

Transitions are the highest-value output — the point of a daily tracker is to catch inflection points, not re-report the zeitgeist.

### 4. Flag reflexivity

For each narrative, flag if the story itself is moving outcomes:
- Token prices moving on narrative alone (no fundamentals shift)
- Projects rebranding/pivoting to ride the narrative
- VCs publicly endorsing to manufacture legitimacy
- Prediction markets or on-chain flows reflecting narrative belief

Only flag explicit cases with a concrete example. "Reflexivity" without evidence is hand-waving.

### 5. Format the notification

Keep under 4000 chars. Lead with transitions and reflexivity — those are the decisions. Classification goes below.

```
*Narrative Tracker — ${today}*

TRANSITIONS
• NEW: <label> — <why it matters> — <link>
• PROMOTED: <label> Rising → Peak — <what flipped>
• DEMOTED: <label> Peak → Fading — <what cooled>
• DEAD: <label> — gone

REFLEXIVITY ALERT
• <narrative> — <concrete evidence the story is moving outcomes>

POSITIONS
• FRONT-RUN: <label> (mindshare 2 ↑↑, Bull) — <driver> — <bear case> — <link>
• RIDE: <label> (3 ↑, Bull) — <driver> — <bear case>
• FADE: <label> (5 → Cope) — <driver> — <reflexivity note>

MAP
Emerging: <labels>
Rising: <labels>
Peak: <labels>
Fading: <labels>
```

If absolutely nothing new or notable (no transitions, no reflexivity, no FRONT-RUN/FADE calls): send a one-line update instead of the full template — `*Narrative Tracker — ${today}*: no phase transitions, map unchanged from <last_date>.`

### 6. Send via `./notify`

### 7. Log to `memory/logs/${today}.md`

Append a `### narrative-tracker` section with the full structured output (not just the notification — include all narratives considered, even IGNOREd ones, so future diffs work). If a full run produced nothing actionable, log `NARRATIVE_TRACKER_OK` with the narrative labels seen (so tomorrow's diff still has a baseline).

## Guidelines

- Quantitative over vibes. Every narrative gets mindshare 1-5 and a velocity arrow — no exceptions. If you can't score it, drop it.
- Transitions > classification. A daily tracker's value is catching moves, not listing the weather.
- Named drivers only. "Crypto Twitter is excited about X" is not a driver. "@handle + @handle + @fund" is.
- Position calls are mandatory for Emerging/Rising/Peak narratives. If signals are genuinely ambiguous or contradictory, **WATCH** is an acceptable call — but never omit a position entirely and never invent conviction you don't have.
- Ruthless dedup. Same narrative under two labels = one narrative. Merge, don't split.
- Call out cope. Manufactured narratives, coordinated shilling, and dead-cat bounces get tagged explicitly.
- Prioritize topics tracked in MEMORY.md over generic market chatter.

## Sandbox note

The sandbox blocks outbound curl in many cases. Always read `.xai-cache/narratives.json` first (pre-fetched by the workflow with full network access). If the cache is missing, try direct curl — if that fails, use **WebFetch** on individual URLs. WebSearch always works for supplementary triangulation.

## Environment Variables Required

- `XAI_API_KEY` — used by the pre-fetch step outside the sandbox; the skill reads the cached JSON. Optional — falls back to WebSearch.
- Notification channels configured via repo secrets (see CLAUDE.md).

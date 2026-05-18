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

### 5. Write artifact + notify (v2 locked format)

This is a **signal** skill under Aeon Market Stack v2. It writes both:
1. `.outputs/narrative-tracker.md` — chain-consumable artifact (read by `perps-brief`, `morning-macro`, `daily-ops-review`).
2. A Discord-only notification via `./notify --signal "..."` routed to `#narratives`.

**CRITICAL — artifact vs assistant Summary separation (ISS-003 guardrail).** The content of `.outputs/narrative-tracker.md` (and the notification payload) is the **locked-format text shown below — and only that text**. It is NOT the assistant's end-of-task `## Summary` block, NOT a description of what you did, NOT prose narration of the result. Compose the locked-format payload into a string FIRST, write that string to the file and pass it to `./notify`, and only THEN compose the chat-side `## Summary` separately. If the artifact ever begins with `## Summary` or `**What I did**`, it is wrong — overwrite.

**Format (used identically for both artifact and notification, under 4000 chars):**

```
Narratives · ${today} · 5 tracked, 1 NEW

↑ RISING
• Hyperliquid sector [HYPE, JUP, drift] · 5/5 · RIDE
  perps infra real — SpaceX pre-IPO on TradeXYZ, HYPE ETF debut

• AI inference demand [TAO, RNDR, AKT] · 4/5 · FRONT-RUN
  GPU shortage + TAO mindshare doubled 72h — story building, tokens lag

• Onchain derivatives reg [HYPE, dYdX, GMX] · 2/5 · NEW · WATCH
  CLARITY Act through committee, early but worth tracking

→ PEAK
• Tokenized stocks [ONDO, BUIDL, OUSG] · 5/5 · RIDE w/ trail
  $1.5B onchain mcap (40x YoY), CLARITY Act Senate vote pending
  reflexivity: regulation legitimizes, growth lobbies regulation — peaking

↓ FADING
• DeFi yields [AAVE, COMP, MKR] · 2/5 (was 3) · FADE
  narrative dying, sustainable yields out-competed by token issuance

Changes since yesterday:
+ Onchain derivatives reg (NEW)
- BTC ETF inflows (absorbed into market price)
```

**Universal formatting rules (v2):**
- No asterisks (`*` or `**`) anywhere. Plain text only.
- Title: `Narratives · ${today} · N tracked, M NEW` (omit `, M NEW` if M=0).
- Phase headers prefixed with the velocity arrow that matches: `↑ EMERGING`, `↑ RISING`, `→ PEAK`, `↓ FADING`. Omit empty phase groups.
- Dot separator `·` for inline metadata.
- `•` prefix for each narrative entry.
- Drop IGNORE-tier narratives from the signal output entirely (still logged for diff continuity).

**Per-narrative entry structure (2-3 lines):**
- Line 1: `• Label [TOKEN1, TOKEN2, TOKEN3] · MINDSHARE/5 · POSITION` — optionally `· NEW` and/or `(was N)` before the position when phase changed.
- Line 2: short evidence/driver line — what makes this narrative tick.
- Line 3 (optional): `reflexivity:` callout when the story is materially moving outcomes (token rebrands, VC manufacturing, prediction-market reflexivity loops). Skip line 3 if no clear reflexivity.

**Position vocabulary:** `FRONT-RUN`, `RIDE`, `RIDE w/ trail`, `FADE`, `WATCH`. Free-form qualifier OK after the base term (e.g. `RIDE w/ trail`, `WATCH (early)`).

**Changes footer:** 1-3 bullets max. Use `+` for NEW (not in prior 3 days of logs), `-` for DEAD (was in prior logs, now absent). Skip the footer entirely if neither category applies.

**Quiet-day fallback:** if no phase transitions, no reflexivity, no FRONT-RUN/FADE calls, AND the map is unchanged from the last run, write a single-line variant for both artifact and notification:
```
Narratives · ${today} · map unchanged from ${last_date}
```

**Invocation:**
```bash
./notify --signal "$(cat .outputs/narrative-tracker.md)"
```
The `--signal` flag suppresses Telegram; Discord routing via `DISCORD_WEBHOOK_MAP[narrative-tracker]` targets `#narratives`.

### 6. Log to `memory/logs/${today}.md`

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

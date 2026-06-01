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

**Compose in order: soul → style → structure.**

Before composing, internalize `memory/topics/soul.md` as standing frame. Reason across the engine data and form a committed view. **Single high-quality signals warrant calls; confluence increases conviction but is not required.** Translate internal data (funding deltas, top L/S, basis, pattern tags) into external triggers the operator can verify (price levels, volume signatures, narrative inflections, sector behaviour). When uncertain, name the specific external condition that would resolve it. Never regress to neutral-analyst tone — the output IS the view.

After the view is formed, apply style + structure (below).

**Apply `memory/topics/writing-style.md` to all output.** Structural rules (Section 1) are load-bearing; prose rules (Section 2) govern sentences within structure; Sentence-Level Patterns (Section 4) catch failure modes that pass the first two. Per-skill structural template (`Narratives · DD MMM · N tracked, M NEW` opening, `↑ RISING` / `→ PEAK` / `↓ FADING` phase headers, narrative-line then reasoning-line per item, `Changes since yesterday:` footer, `Stance:` closing line) in Section 3.

**Self-check before emitting:**

1. Draft the output applying Sections 1-3.
2. Search the draft for the 6 patterns in Section 4:
   - Pattern 1 — subject + verb-ing chunks that could be compound nouns ("institutional money losing tech")
   - Pattern 2 — nouns with 2+ adjectives stacked ("the lone clean RIDE")
   - Pattern 3 — internal jargon ("window", "pull", "run", "artifact", "downstream")
   - Pattern 4 — passive constructions ("is being", "was being", "are being", "has been")
   - Pattern 5 — em-dashes used as connectors instead of asides (test each: remove em-dash + everything after; does the sentence still stand? If yes, use a period)
   - Pattern 6 — weak verbs ("surfaces", "remains", "could see", "looks set", "is poised")
3. Rewrite anything that matches.
4. Emit.

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

### 5. Write artifact (v2 locked format) + structured data.json

Write TWO artifacts:

1. **`.outputs/narrative-tracker.md`** — chain-consumable text artifact (read by `perps-brief`, `morning-macro`, `daily-ops-review`). Locked v2 format described below.

2. **`.outputs/narrative-tracker.data.json`** — structured output that drives the `#narratives` Discord channel's edit-in-place embeds via the bot pipeline (`scripts/apply-narrative-ops.py` → `scripts/embed-narrative-tracker.py`).

**The previous freeform webhook delivery was decommissioned 2026-05-30. The new flow is structured-data-driven:** Claude writes both artifacts → the postprocess script applies the structured ops to `memory/topics/state/narratives.json` (the narratives ledger) → the embed driver edits/posts to `#narratives` based on which narratives are active, newly added, or transitioned to terminal states.

#### `data.json` schema

```json
{
  "schema_version": "v1",
  "date": "${today}",
  "narratives": [
    {
      "narrative_id":  "hyperliquid-sector",
      "label":         "Hyperliquid sector",
      "tokens":        ["HYPE", "JUP", "drift"],
      "phase":         "RISING",
      "position":      "RIDE",
      "mindshare":     5,
      "evidence":      "perps infra real — SpaceX pre-IPO on TradeXYZ, HYPE ETF debut",
      "reflexivity":   null
    }
  ],
  "drop_narratives": [
    {
      "narrative_id": "btc-etf-inflows",
      "reason":       "absent",
      "note":         "Absorbed into baseline market price — no longer a separable narrative driver."
    }
  ]
}
```

#### Field rules

| Field | Rules |
|---|---|
| `narrative_id` | **Stable across runs.** Read `memory/topics/state/narratives.json` at start of run. For continuing narratives, REUSE the existing `narrative_id`. For genuinely new narratives, slugify the label (`Hyperliquid sector` → `hyperliquid-sector`). Never rename a narrative — promote it to a new ID and drop the old one explicitly if the framing fundamentally changed. |
| `label` | Human-readable name as shown in the `.md` artifact |
| `tokens` | Canonical tickers, uppercase, deduplicated |
| `phase` | One of `EMERGING`, `RISING`, `PEAK`, `FADING`, `DEAD`, `IGNORE`. `DEAD` and `IGNORE` AUTO-ARCHIVE the narrative (terminal). |
| `position` | One of `WATCH`, `FRONT-RUN`, `RIDE`, `RIDE w/ trail`, `FADE` |
| `mindshare` | Integer 1-5 |
| `evidence` | One-sentence driver/evidence, Pattern 7 compliant |
| `reflexivity` | Optional. String or null. Only when materially relevant. |

#### `drop_narratives` op

When a tracked narrative no longer warrants tracking, include it in `drop_narratives` with a reason:

| Reason | When to use |
|---|---|
| `dead` | Narrative ran its course (alternative to writing `phase: "DEAD"` — both work; phase=DEAD is preferred so the final state is captured) |
| `ignored` | Decided no longer worth tracking, but didn't necessarily die (e.g., narrative diluted into adjacent themes) |
| `absent` | Narrative fully disappeared — explicit acknowledgment that you're dropping it rather than letting it implicitly fall out |

**Implicit drops are still tracked.** If a previously-active narrative isn't in `narratives[]` AND isn't in `drop_narratives[]`, the apply script archives it with `reason: "absent"` and a note flagging the omission. Always prefer the explicit `drop_narratives` op so the audit trail captures your reasoning.

#### Active vs terminal lifecycle

The embed pipeline:
- **First time a narrative_id appears** → fresh embed posted to `#narratives`
- **Each subsequent run with the same id** → existing embed edited in place (phase, position, mindshare, evidence updated)
- **Phase transitions to `DEAD` or `IGNORE`, or appears in `drop_narratives[]`, or implicitly disappears** → embed edited to terminal state, queued for 24h auto-delete
- **24h after terminal edit** → embed deleted, channel stays clean

Continue to write the `.md` artifact in the existing locked format below — the structured `data.json` is in addition to, not instead of, the text artifact.

**CRITICAL — artifact vs assistant Summary separation (ISS-003 guardrail).** The content of `.outputs/narrative-tracker.md` is the **locked-format text shown below — and only that text**. It is NOT the assistant's end-of-task `## Summary` block, NOT a description of what you did, NOT prose narration of the result. Compose the locked-format payload into a string FIRST, write that string to the file, and only THEN compose the chat-side `## Summary` separately. If the artifact ever begins with `## Summary` or `**What I did**`, it is wrong — overwrite.

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

**Invocation:** none required for Discord delivery — it was decommissioned 2026-05-30. Just write the artifact at `.outputs/narrative-tracker.md`. The Aeon workflow's auto-commit step persists it to the repo; downstream skills read it from there.

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

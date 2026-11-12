---
name: narrative-tracker
description: Track rising, peaking, and fading crypto/tech narratives with quantitative mindshare + velocity signals and explicit positioning calls
metadata:
  commits: true
  permissions:
    - contents:write
  title: Narrative Tracker
  mode: read-only
  category: crypto
  tags:
    - crypto
    - research
  requires:
    - XAI_API_KEY
---
<!-- autoresearch: variation B — sharper output (quantitative mindshare + velocity + explicit positioning calls, with multi-angle inputs from A, dedup/empty-state handling from C, and transition detection from D) -->

Read `memory/MEMORY.md` for context on prior narrative observations.
Read the last 3 days of `memory/logs/` — specifically any prior `### narrative-tracker` entries — to (a) avoid re-reporting the same narratives without new info, and (b) detect phase transitions vs the last run.

## Goal

Produce a *decision-grade* narrative map: every narrative gets a mindshare score, a velocity arrow, a sentiment tag, named drivers, and an explicit position call. Classification without a position call is noise.

## Steps

### 1. Ingest signals

**a. X/Twitter narratives - X.AI API (primary).** The primary signal is a direct `curl` to the X.AI Responses API with Grok's `x_search` tool - see **## Fetching** below for the full contract. `XAI_API_KEY` is injected into this skill's environment via `requires:`; it is present and valid, so this path is required whenever the key check gives `KEY_PRESENT`. Set the Bash tool `timeout` to ≥180000 when running the curl (x_search takes 30-120s) and capture the HTTP status.

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`FROM_DATE=$(date ...)`, `PROMPT="..."`, `HTTP=$(./secretcurl ...)`), uses `[ ... ]` tests, or joins commands with `;`, `&&` or `||`, and each refusal costs a model turn. So run each block below as its own Bash call, in order: get a date with a bare `date` call and write the printed value into later commands (the `<FROM_DATE>` / `<TO_DATE>` placeholders); put the prompt and dates inline in the `jq -n` filter (a jq `$name` variable such as `--arg p ... '$p'` is refused too) and pipe it straight into `./secretcurl`; never put a `$VAR` in the `./secretcurl` line.

Get the window dates, each `date` as its own call:
```bash
date -u -d '3 days ago' +%Y-%m-%d
```
```bash
date -u +%Y-%m-%d
```
The first prints FROM_DATE, the second TO_DATE.

Key check: read the "Keys set for this run" line in your run notes, never a shell test (those are refused and cost a turn). `XAI_API_KEY` on that line = `KEY_PRESENT`, not on it = `KEY_UNSET`.

Build the JSON payload with jq (do NOT hand-assemble it), with the dates written in literally, and pipe it straight into the POST in the same call. Do not write it to a file first: a `>` redirect into a file is refused in BOTH tiers, /tmp included, and this read-only run has no Write tool. `./secretcurl` reads the body from stdin (`--data-binary @-`; its own config goes over a separate pipe, so stdin is free):
```bash
jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for the dominant crypto and tech narratives from <FROM_DATE> to <TO_DATE>. Return 12-15 distinct narrative threads. For each: 1) short label, 2) 3-5 representative @handles driving it, 3) 2-3 tweet permalinks, 4) rough mention-volume descriptor (niche / growing / saturating / cooling), 5) the strongest one-line bear case against it."}], tools:[{type:"x_search",from_date:"<FROM_DATE>",to_date:"<TO_DATE>"}]}' \
  | ./secretcurl -s -o /tmp/xai-nt.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {XAI_API_KEY}" \
  --data-binary @-
```
Run that block **verbatim** apart from the placeholders (do not hand-reassemble the JSON - the `jq -n` builder exists precisely so quoting/expansion can't break). The curl prints the status code (`HTTP`), and `./secretcurl` prints a `secretcurl xai attempt=... http=<code> bytes=<n> ...` line on stderr; that `xai ... http=` line **must appear in your output** - it is your proof the call ran. On `HTTP=200` with a non-empty body, parse `/tmp/xai-nt.json` with `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'` and use that as the primary narrative signal (`SOURCE=api`).

**b. WebSearch / WebFetch fallback (last-resort only).** You may reach for this **only after** you have shown a `secretcurl xai ... http=<code>` line proving Path A actually ran and returned a non-2xx code (or an empty body, or timed out). If you have no `xai ... http=` line, you did not run the call - go back and run it. Reach for the fallback **only** when Path A genuinely fails - `KEY_UNSET`, a non-2xx HTTP code, an empty parse, or a timeout. It is lower quality (WebSearch favours old high-engagement posts) and is **never co-equal** with Path A. Record the fetch failure in your final output with the **true reason** - `key-unset` | `http-<code>` | `empty` | `timeout` - never "XAI_API_KEY unavailable" when the key was set (a slow curl is a `timeout`, not a missing key). Then compile narratives via WebSearch (`crypto narrative ${TO_DATE}`, `AI agent crypto trend this week`) and WebFetch on individual tweet URLs; discard anything older than the 3-day window.

**c. Quantitative reference points (supplement).** Independently of the fetch path, cross-check mindshare against external quantitative benchmarks with one WebSearch: `DefiLlama narrative tracker` OR `Kaito mindshare leaderboard`. Pull 1-2 concrete numbers (project name, metric, link) to calibrate the mindshare scores in step 2. This is a calibration cross-check, **not** a narrative source. Do not paraphrase — extract facts.

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
*Narrative Tracker - ${today}*

TRANSITIONS
• NEW: <label> - <why it matters> - <link>
• PROMOTED: <label> Rising → Peak - <what flipped>
• DEMOTED: <label> Peak → Fading - <what cooled>
• DEAD: <label> - gone

REFLEXIVITY ALERT
• <narrative> - <concrete evidence the story is moving outcomes>

POSITIONS
• FRONT-RUN: <label> (mindshare 2 ↑↑, Bull) - <driver> - <bear case> - <link>
• RIDE: <label> (3 ↑, Bull) - <driver> - <bear case>
• FADE: <label> (5 → Cope) - <driver> - <reflexivity note>

MAP
Emerging: <labels>
Rising: <labels>
Peak: <labels>
Fading: <labels>
```

If absolutely nothing new or notable (no transitions, no reflexivity, no FRONT-RUN/FADE calls): send a one-line update instead of the full template — `*Narrative Tracker — ${today}*: no phase transitions, map unchanged from <last_date>.`

### 6. Send via `./notify`

### 7. Log record

This skill is `read-only`, so the workflow's read-only guard writes its `### narrative-tracker` log entry from your captured output; a self-written entry would be a duplicate. Don't append to `memory/logs/` yourself - put this record in your **final output**: the full structured output (not just the notification - include all narratives considered, even IGNOREd ones, so future diffs work). If a full run produced nothing actionable, record `NARRATIVE_TRACKER_OK` with the narrative labels seen (so tomorrow's diff still has a baseline).

## Guidelines

- Quantitative over vibes. Every narrative gets mindshare 1-5 and a velocity arrow — no exceptions. If you can't score it, drop it.
- Transitions > classification. A daily tracker's value is catching moves, not listing the weather.
- Named drivers only. "Crypto Twitter is excited about X" is not a driver. "@handle + @handle + @fund" is.
- Position calls are mandatory for Emerging/Rising/Peak narratives. If signals are genuinely ambiguous or contradictory, **WATCH** is an acceptable call — but never omit a position entirely and never invent conviction you don't have.
- Ruthless dedup. Same narrative under two labels = one narrative. Merge, don't split.
- Call out cope. Manufactured narratives, coordinated shilling, and dead-cat bounces get tagged explicitly.
- Prioritize topics tracked in MEMORY.md over generic market chatter.

## Fetching

`XAI_API_KEY` is **injected into this skill's environment** (declared in `requires:`). It is present and valid. **The primary fetch path is a direct `curl` to `https://api.x.ai/v1/responses` with `Authorization: Bearer {XAI_API_KEY}`** (model `grok-4.7`, `"tools":[{"type":"x_search"}]`). There is **no network sandbox** blocking this - earlier versions of this skill claimed there was, and that is stale and false. Just make the call.

Rules:
1. **Check, don't assume.** Read the "Keys set for this run" line in your run notes, never a shell test (those are refused and cost a turn): `XAI_API_KEY` on that line = `KEY_PRESENT`, not on it = `KEY_UNSET`. If `KEY_PRESENT` (it will be), Path A (the curl in step 1a) is required before any fallback.
2. **Allow enough time.** The `x_search` call typically takes 30-120s. When you invoke the Bash tool for the curl, **set the tool's `timeout` to at least 180000 (180s)** and keep **`--max-time 150`** on the curl so it fails cleanly rather than hanging. A slow curl is **not** a missing key — never treat a timeout as key-unavailable.
3. **Capture the HTTP status** so the fallback decision is fact-based (see the skeleton in step 1a). `HTTP=200` with a non-empty parsed body → use it.
4. **Fall back only on a real failure**, recording the true reason — `key-unset` (only if the key check gave `KEY_UNSET`), `http-<code>` (non-2xx), `empty` (200 but nothing parsed), or `timeout`. Never write "XAI_API_KEY unavailable" when the key was set.

**WebSearch / WebFetch are last-resort fallbacks only** — lower quality, never primary or co-equal. Do not reach for them while the key works.

## Environment Variables Required

- `XAI_API_KEY` — X.AI API key for Grok's `x_search` tool. Declared in `requires:`, so it is **injected into this skill's environment** and is the **primary fetch path** for the narrative signal (step 1a). If it is ever unset, the skill degrades to WebSearch/WebFetch at lower quality.
- Notification channels configured via repo secrets (see CLAUDE.md).

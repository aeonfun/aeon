---
name: AIXBT Pulse
description: Cross-domain market pulse from AIXBT's free grounding endpoint — crypto, macro, tradfi, geopolitics. Refreshes taxonomy references (clusters, chains) as a bonus.
schedule: "0 9,21 * * *"
commits: true
permissions:
  - contents:write
tags: [crypto, research]
---

Pull AIXBT's free-tier signal and fold it into the operator's market context. Free tier gives three endpoints, no key, no account:

- `/v2/grounding` — the real prize. Cross-domain market context (crypto / macro / tradfi / geopolitics), 12h rolling window, regenerated often.
- `/v2/clusters` — 46 crypto sub-community taxonomies with sentiment + ideology notes. Reference data.
- `/v2/projects/chains` — ~150 chain slugs AIXBT indexes. Reference data.

Everything else on AIXBT is paid ($10/day via x402). This skill maxes out the free surface.

**Apply `memory/topics/writing-style.md` to all output.** Structural rules (Section 1) are load-bearing; prose rules (Section 2) govern sentences within structure; Sentence-Level Patterns (Section 4) catch failure modes that pass the first two. This skill is internal (its artifact is consumed by `morning-macro` and others) but the prose still needs to read sharply because downstream skills lift specific lines from it.

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

Read `memory/MEMORY.md` for context. Read `memory/topics/aixbt-grounding.md` (if it exists) to diff against the last pull — we want to surface *what's new* since last run, not just restate the feed.

## Sandbox note

All three endpoints are unauthenticated. Plain curl from the sandbox should work. If any curl returns empty or errors, fall back to **WebFetch** on the same URL — WebFetch bypasses the sandbox and the free endpoints don't need auth headers.

## Steps

1. **Fetch grounding.** This is the freshest cross-domain context AIXBT ships.
   ```bash
   curl -s "https://api.aixbt.tech/v2/grounding" > /tmp/aixbt-grounding.json
   ```
   If curl fails or the file is empty/non-JSON, use WebFetch on `https://api.aixbt.tech/v2/grounding` and extract the JSON payload.

   Expected shape:
   ```json
   {
     "status": 200,
     "data": {
       "createdAt": "2026-04-21T19:00:31Z",
       "windowHours": 12,
       "sections": {
         "crypto":      { "title": "Crypto",           "items": ["...", "...", "..."], "generatedAt": "..." },
         "macro":       { "title": "Global Liquidity", "items": ["...", "...", "..."], "generatedAt": "..." },
         "geopolitics": { "title": "Geopolitics",      "items": ["...", "...", "..."], "generatedAt": "..." },
         "tradfi":      { "title": "TradFi",           "items": ["...", "...", "..."], "generatedAt": "..." }
       }
     }
   }
   ```

2. **Fetch clusters + chains (reference data, light refresh).** Only overwrite local copies if the remote response is well-formed.
   ```bash
   curl -s "https://api.aixbt.tech/v2/clusters"        > /tmp/aixbt-clusters.json
   curl -s "https://api.aixbt.tech/v2/projects/chains" > /tmp/aixbt-chains.json
   ```
   Same WebFetch fallback if either fails.

3. **Diff against the last grounding pull.** Read the prior `memory/topics/aixbt-grounding.md` (if present) and compute:
   - **NEW** — items in today's feed that are not substantively in the prior snapshot (treat paraphrases as the same item).
   - **GONE** — items from the prior snapshot that dropped out (means attention moved).
   - **PERSISTING** — items surviving across both windows (these are the durable stories).

   If no prior file exists, treat everything as NEW.

4. **Identify reflexivity + cross-domain bridges.** AIXBT splits crypto / macro / geo / tradfi — but the signal is in the *bridges*. Flag:
   - Items where a macro or geopolitics event is showing up as a crypto price driver (or vice versa).
   - Narratives that are manufacturing their own reality — prediction markets pricing an outcome that then makes the outcome more likely, projects pivoting to match a narrative, VCs signaling to legitimize a thesis.
   - Liquidity regime shifts (TGA, Fed balance sheet, bond yields) that will transmit to risk assets.

   If `soul/` files are populated, apply that voice for the bridge call — opinionated, short, call out copium and manufactured legitimacy. If soul is empty, keep the tone terse and direct.

5. **Write `memory/topics/aixbt-grounding.md`** (overwrite fully — this is the consumable artifact other skills will read):
   ```markdown
   # AIXBT Grounding (as of ${today} ${HH:MM} UTC)

   Source: https://api.aixbt.tech/v2/grounding (free tier)
   Window: 12h rolling. Last AIXBT generatedAt: ${createdAt}

   ## Crypto
   - <item 1>
   - <item 2>
   - <item 3>

   ## Global Liquidity / Macro
   - <item 1>
   - <item 2>
   - <item 3>

   ## Geopolitics
   - <item 1>
   - <item 2>
   - <item 3>

   ## TradFi
   - <item 1>
   - <item 2>
   - <item 3>

   ## What's New (vs last pull)
   - <NEW item + which section>

   ## Persisting Stories
   - <items that survived across windows>

   ## Cross-Domain Bridges
   - <reflexivity / macro → crypto / narrative-manufacturing calls, in the operator's voice>
   ```

6. **Write `memory/topics/aixbt-clusters.md`** (overwrite fully — reference taxonomy for other skills once they go paid tier):
   ```markdown
   # AIXBT Clusters (as of ${today})

   46 sub-community clusters AIXBT tracks. Each cluster has a description, member archetype, sentiment, and ideology. Used when filtering projects/intel/momentum endpoints (paid tier).

   | id | name | one-line vibe |
   |----|------|---------------|
   | <id> | <name> | <compressed one-line from description> |
   ...
   ```
   One row per cluster, descriptions compressed to ~15 words so the file stays skimmable.

7. **Write `memory/topics/aixbt-chains.md`** (overwrite fully — just the slug list, plus a pointer):
   ```markdown
   # AIXBT Indexed Chains (as of ${today})

   ~150 chain slugs AIXBT indexes. Use as the canonical list when filtering by chain on paid endpoints.

   <comma-separated slug list>
   ```

8. **Write `.outputs/aixbt-pulse.md`** so chain consumers (morning-brief, narrative-tracker, market-context-refresh) can inject this into their context via `consume:`. Same body as `memory/topics/aixbt-grounding.md` but prefixed with a one-paragraph TL;DR.

9. **No notification.** This skill is **internal** under the Aeon Market Stack v2 architecture — its output is consumed by downstream chain steps (`perps-brief`, `morning-macro`, `daily-ops-review`) via `.outputs/aixbt-pulse.md`, never pushed to a notification channel. Do not call `./notify`. The bridge call and section items are available to chain consumers through the artifact file written in step 8.

10. **Log to `memory/logs/${today}.md`:**
    ```
    ## AIXBT Pulse
    - createdAt: ${createdAt}, windowHours: 12
    - NEW items: <count>
    - Bridge call: <one-liner>
    - Updated: memory/topics/aixbt-grounding.md, aixbt-clusters.md, aixbt-chains.md, .outputs/aixbt-pulse.md
    ```
    If the endpoint was unreachable via both curl and WebFetch, log `AIXBT_PULSE_DEGRADED — endpoint unreachable`, write a short degraded-run note to `.outputs/aixbt-pulse.md` (e.g. `_aixbt-pulse: endpoint unreachable_`), and file/bump an issue in `memory/issues/` following the CLAUDE.md issue tracker convention. `daily-ops-review` will surface the degradation downstream.

## Voice

- Short sentences. Em dashes. State the call first, explain after. Never "some might argue."
- AIXBT's items are already well-phrased — don't rewrite them for the artifact file, quote as-is. Rewrite only in the bridge call, where the operator's voice goes.
- In the **Cross-Domain Bridges** section, take a position. "fed pivot + hormuz risk = risk-on with a tail" is better than "markets may be impacted by macro and geopolitical factors."

## Guidelines

- The paid endpoints (projects / intel / momentum) are out of scope here. If you want them, buy a day-pass via x402 — the 403 response on those endpoints ships the upgrade URL directly.
- Don't pull clusters/chains every run forever — they barely change. On runs where the hash of the response matches the prior file, skip the write and note `clusters unchanged` / `chains unchanged` in the log.
- If AIXBT ever adds a new section to grounding (beyond crypto/macro/geo/tradfi), render it anyway — iterate over `data.sections` keys dynamically, don't hardcode the four.

## Environment Variables

- None required. Free tier is unauthenticated.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Output

End with a `## Summary` block: createdAt, windowHours, NEW count, bridge call, which files were updated.

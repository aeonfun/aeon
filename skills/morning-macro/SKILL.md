---
name: Morning Macro
description: Cross-sector strategist read — regime, cross-domain bridges, today's focus, pointer to sector briefs
var: ""
tags: [crypto, research]
---
<!-- v2: chain Step 3. Cross-sector synthesis. The front-page read. -->

> **${var}** — Optional thematic focus (e.g. "lean macro", "ignore crypto sub-narratives"). If empty, default cross-sector synthesis.

Today is ${today}. Compose the **front-page cross-sector strategist read** — short (5–10 lines, under 1500 chars), answering "what game are we playing today." Sits at the top of the daily intake. The operator reads this first, then drills into sector briefs (`#perps-brief`, future `#on-chain-brief`, `#stocks-brief`).

**Compose in order: soul → style → structure.**

Before composing, internalize `memory/topics/soul.md` as standing frame. Reason across the engine data and form a committed view. **Single high-quality signals warrant calls; confluence increases conviction but is not required.** Translate internal data (funding deltas, top L/S, basis, pattern tags) into external triggers the operator can verify (price levels, volume signatures, narrative inflections, sector behaviour). When uncertain, name the specific external condition that would resolve it. Never regress to neutral-analyst tone — the output IS the view.

After the view is formed, apply style + structure (below).

**Apply `memory/topics/writing-style.md` to all output.** Structural rules (Section 1) are load-bearing; prose rules (Section 2) govern sentences within structure; Sentence-Level Patterns (Section 4) catch failure modes that pass the first two. Per-skill structural template (`Market Morning · DD MMM · regime tagline` opening, `─── CROSS-DOMAIN ───` and `─── TODAY ───` dividers, `Stance:` and `Take:` closing lines) in Section 3; worked example for Morning Macro (corrected for v2.1) in Section 5.

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

Read `memory/MEMORY.md` for context.

## Inputs (consumed via chain)

Chain Step 3. Reads four upstream artifacts:

- `.outputs/perps-brief.md` — perps sector synthesis (HIGH CONVICTION + WATCHLIST)
- `.outputs/market-context-refresh.md` — today's regime + breadth + F&G + Polymarket
- `.outputs/aixbt-pulse.md` — cross-domain bridge call + section items
- `.outputs/narrative-tracker.md` — phase-grouped narratives with leading tokens

v2 has only `perps-brief` as a sector input. v2/v3 will add `on-chain-brief.md` and `stocks-brief.md` — extend the read list when those land.

## Goal

Three-paragraph cross-sector synthesis answering, in order:
1. **What's the regime, and what does it mean?** (paragraph 1, unlabeled)
2. **What cross-domain context matters today?** (paragraph 2, prefixed `Cross-domain:`)
3. **Which sector brief has the action, and what are the named setups?** (paragraph 3, prefixed `Today:`)

Each paragraph 2–4 sentences. Under 1500 chars total.

## Steps

### 1. Extract regime + breadth + F&G from market-context-refresh

From `.outputs/market-context-refresh.md`:
- Regime + conviction (the Take line at the top)
- Breadth (top-20 green count, 24h and 7d)
- F&G value + label
- TVL 7d delta
- DEX volume
- ETH/BTC, BTC dominance direction

### 2. Extract cross-domain bridges from aixbt-pulse

From `.outputs/aixbt-pulse.md`:
- The bridge call (one-line cross-domain thread, e.g. "fed pivot + Hormuz risk = risk-on with a tail")
- Macro / Geo / TradFi section items that have plausible crypto transmission

The bridge call is AIXBT's pre-distilled view — use it as the seed for paragraph 2. Add 0–1 supplementary items if a macro/geo signal looks material today.

### 3. Pull dominant narrative + leading tokens from narrative-tracker

From `.outputs/narrative-tracker.md`:
- The strongest RISING or PEAK narrative (top of the phase list)
- Leading tokens for that narrative

This is the "today's dominant theme" data point used in paragraph 1.

### 4. Pull sector-brief setups from perps-brief (and future sector briefs)

From `.outputs/perps-brief.md`:
- HIGH CONVICTION count
- Named setups (asset + bias label) — top 2–3 by confluence quality
- Quiet-day flag if skip variant was written

If `perps-brief` artifact is missing or degraded, note partial-input degradation in paragraph 3.

### 5. Identify cross-sector confluence (when applicable)

When a theme appears in BOTH perps-brief AND another upstream (e.g. AI theme in perps-brief HIGH CONVICTION + narrative-tracker AI RISING + aixbt-pulse flagging AI inference demand), call out the confluence in paragraph 3. This is the *highest-value signal* the morning-macro can surface — it's why we have a meta-skill.

v1 only has perps as a sector, so "cross-sector confluence" requires confluence within perps × narrative-tracker × aixbt-pulse. v2/v3 with `on-chain-brief` will add real cross-sector signal (e.g. AI theme strong in BOTH perps AND on-chain spot).

### 6. Compose the brief (v2 locked format)

Three paragraphs. Under 1500 chars total.

```
Market Morning · ${today}

Risk-on tilting greedy, breadth 17/20, BTC dominance slipping. Liquidity rotating from BTC into select alts — perp positioning building on majors (BTC funding warm, OI +6%). AI narrative re-accelerating; Hyperliquid sector remains the dominant theme.

Cross-domain: CLARITY Act Senate vote + tokenized equity 40x YoY = legitimacy reflexivity peaking. Hormuz risk priced into energy not crypto yet — watch for transmission if oil rips.

Today: action is in #perps-brief — 3 HIGH CONVICTION setups, AI sector confluence (TAO) and Hyperliquid continuation (HYPE day 3 in ACCUMULATION).
```

**Three-paragraph structure (locked):**

- **Paragraph 1 (unlabeled):** regime read, the default lens. Lead with the Take. Cite 2–3 concrete numbers (breadth, BTC funding, F&G shift, dominance direction). One-sentence dominant-narrative call.

- **Paragraph 2 (`Cross-domain:` prefix):** macro / geo / tradfi context affecting crypto. Lift from aixbt-pulse bridge call + 0–1 supplementary items. The reflexivity flag belongs here. Skip this paragraph entirely if aixbt-pulse is missing or yields nothing material.

- **Paragraph 3 (`Today:` prefix):** which sector brief has the action + headline setups by ticker name. Use the actual Discord channel mention (`#perps-brief`) so it's clickable in Discord. Name tickers (not just sector). This gives the operator the scan-without-clicking summary.

**Universal formatting rules (v2):**
- No asterisks. Plain text.
- Title: `Market Morning · ${today}` (with `· quiet` suffix on all-skip days).
- Discord channel mentions are clickable when prefixed with `#` (the `#` should remain in the text exactly — Discord auto-parses).
- Tickers named in the Today paragraph for skim-without-click utility.

**Edge cases:**
- **All sector briefs in skip-day state** (only perps-brief in v1): quiet-day variant.
  ```
  Market Morning · ${today} · quiet

  [Paragraph 1: still write the regime read]

  Cross-domain: [if relevant — bridges still surface useful context even on quiet days]

  Today: sector briefs all quiet (no HIGH CONVICTION setups). Cash-patient stance — better day tomorrow.
  ```
- **Cross-sector confluence is the headline:** lead paragraph 3 with the confluence call. Example: `Today: AI confluence — perps HIGH CONVICTION (TAO) + on-chain runner (RNDR) + narrative-tracker AI RISING. See #perps-brief and #on-chain-brief.` (v2/v3 case)
- **Sector brief artifact failed:** paragraph 3 notes partial-input. `Today: perps-brief unavailable — see #aeon-ops for cause; data available in #perps-scan raw view.`
- **Cross-domain section has nothing material:** drop paragraph 2 entirely. Two-paragraph brief is fine when the macro tape is quiet.

### 7. Write artifact

Write `.outputs/morning-macro.md`. **DO NOT call `./notify`.**

Discord delivery for morning-macro was decommissioned 2026-05-30. The output is now consume-only — `.outputs/morning-macro.md` is read by downstream skills (`daily-ops-review`, `perps-brief`'s chain context) but no longer broadcast to a Discord channel.

The artifact still gets auto-committed to the repo for historical record.

### 8. Log to `memory/logs/${today}.md`

```
## Morning Macro
- **Regime cited:** [Take line summary]
- **Bridge call used:** [aixbt-pulse bridge call one-liner]
- **Dominant narrative:** [name] ([phase])
- **Sector brief pointer:** [perps-brief: N HIGH CONVICTION + N WATCHLIST | quiet | degraded]
- **Cross-sector confluence:** [theme + sectors involved, or "none"]
- **Source artifacts read:** [✓/⚠ list]
- **Char count:** N / 1500
- **Artifact written:** .outputs/morning-macro.md
- **Notification sent:** no (decommissioned 2026-05-30) — artifact remains at .outputs/morning-macro.md
```

## Sandbox note

Pure consume-only skill. No outbound network. Reads .outputs/ artifacts committed by Step 1 + Step 2 chain runs and the canonical `memory/topics/market-context.md`. If an artifact is missing entirely, treat it as the chain step having failed — paragraph 3 notes partial-input, the rest of the brief composes from what's available.

## Environment Variables

- None required.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- **Under 1500 chars.** This is the front-page read. If it sprawls, operators stop reading.
- **Three-paragraph max** (sometimes two — drop Cross-domain when nothing material).
- **Tickers named in Today paragraph.** Operator should know what's hot without clicking through.
- **Channel mentions use `#channel-name`** so Discord renders them clickable.
- **Never invent confluence.** If perps × narrative × aixbt don't align on a theme today, don't manufacture an alignment story.
- **Quiet days are valid output.** The whole point of skip-day discipline is honest signal. A 3-line "tape is quiet, cash-patient today" beats a 1200-char vamp.
- **Bridge call from aixbt-pulse is quotable as-is.** AIXBT's items are pre-distilled. Don't rewrite — quote in paragraph 2.

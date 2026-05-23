---
name: idea-validator
description: Screen the startup idea backlog — research competitive landscape, score viability, surface the strongest picks from memory/topics/startup-ideas.md
var: ""
tags: [creative, meta]
---
> **${var}** — Optional theme filter (e.g. "crypto", "AI agents", "consumer", "solo-buildable"). If empty, picks the oldest unscreened batch.

Today is ${today}. Read `memory/MEMORY.md` before starting. If `soul/SOUL.md` + `soul/STYLE.md` exist and are populated, read them to ground "operator fit" scoring; otherwise score on solo-buildability and timing only.

## Why this skill exists

Idea backlogs accumulate weekly with no evaluation. Without a screening pass, the backlog is noise — no way to know which ideas are wide open vs already crowded, which match current market conditions, which are solo-buildable vs team-dependent. This skill turns the list from an archive into an active pipeline.

## Steps

### 1. Load the idea backlog

Read `memory/topics/startup-ideas.md`. If it doesn't exist, log `IDEA_VALIDATOR_SKIP: no backlog at memory/topics/startup-ideas.md` and stop.

Read `memory/topics/startup-ideas-screened.md` (create if missing — it's the screening database).

From the main ideas table, extract ideas that have NOT yet appeared in `startup-ideas-screened.md`. If `${var}` is set, additionally filter by theme/domain match.

Pick up to **8 ideas** to screen this run — prioritize oldest unscreened (earliest date first).

If fewer than 2 unscreened ideas remain: send a "backlog current" notification and stop.

### 2. Screen each idea

For each idea (name + one-liner from the table), run:

**a) Competition scan**

```
WebSearch: "[idea name] startup ${year}"
WebSearch: "[core problem/domain] tool app platform"
```

Classify competition density:
- `open` — no direct competitors found, or market clearly nascent
- `sparse` — 1–2 players, no clear winner
- `crowded` — 3+ established players with traction
- `saturated` — category has a dominant incumbent

**b) Funding signal**

```
WebSearch: "[domain] startup funding ${year}"
```

Note: any recent raises in the space? Is VC money flowing in (market heating) or absent (too early or too late)?

**c) Timing fit**

Score 1–5 based on:
- What's the tailwind right now? (regulatory shift, new infra, behavior change)
- Does recent context from `memory/logs/` match this domain? (market signals, papers, tweets)
- 5 = this could launch today and hit demand; 1 = needs 2+ years of market development

**d) Operator fit**

Score 1–5. If `soul/SOUL.md` exists and is populated:
- Does the operator have relevant domain expertise or network (per soul)?
- Is this solo-buildable or requires a team?
- Does it connect to current projects named in MEMORY.md or topic files?
- 5 = operator could validate this in a week with the current stack.

If no soul file exists, score this dimension as 3 by default (neutral) and rely on the other axes — operator fit is unknowable without the soul.

**e) Market size**

Quick estimate: small (<$1B TAM), medium ($1–10B), large (>$10B). Use WebSearch if unclear.

### 3. Score and rank

Compute a **viability score** for each idea:
```
viability = timing_fit + operator_fit + competition_bonus + size_bonus
competition_bonus: open=4, sparse=3, crowded=1, saturated=0
size_bonus: large=2, medium=1, small=0
```
Max ~16. Sort descending.

### 4. Update the screening database

Append to `memory/topics/startup-ideas-screened.md` (create if missing):

```markdown
# Startup Ideas — Screening Notes

Each idea screened by idea-validator. Sorted by date screened.

| Date Screened | Idea | Competition | Timing | Operator Fit | Market | Viability | Key Finding |
|---------------|------|-------------|--------|--------------|--------|-----------|-------------|
| YYYY-MM-DD | Idea Name | open/sparse/crowded/saturated | 1-5 | 1-5 | small/medium/large | score/16 | one-line finding |
```

### 5. Decide whether to notify

Always notify — screened ideas are always worth surfacing.

### 6. Format and send notification

Write to a temp file, then send:

```bash
mkdir -p .pending-notify-temp
TEMP=".pending-notify-temp/idea-validator-${today}.md"
# (write the body below to $TEMP)
./notify -f "$TEMP"
```

**Notification format** — match the operator's voice if soul files are populated, otherwise direct and neutral:

```
idea screener — ${today}

screened: N ideas. top picks:

1. [Name] — [one-liner]
   competition: open/sparse | timing: X/5 | operator-fit: X/5
   gap: [why the space is open or under-served]
   tailwind: [what makes now the right time]

2. [Name] — [one-liner]
   competition: [density] | timing: X/5 | operator-fit: X/5
   gap: [...]
   tailwind: [...]

3. [Name] — [one-liner]
   competition: [density] | timing: X/5 | operator-fit: X/5
   gap: [...]
   tailwind: [...]

skipped: [Name] — [crowded/saturated], [Name] — [too early]

full notes: memory/topics/startup-ideas-screened.md
```

Surface top 3 by viability score. List the rest as "skipped" with one-word reason.

Keep total under 4000 chars.

### 7. Log to memory

Append to `memory/logs/${today}.md`:

```
## Idea Validator
- **Screened:** N ideas (oldest: [name], newest: [name])
- **Top pick:** [name] — [viability score]/16
- **Competition open:** N ideas
- **Saturated/skipped:** N ideas
- **Filter used:** [var or "none"]
- **Notification:** sent
- IDEA_VALIDATOR_OK
```

## Required Env Vars

None. Uses WebSearch (built-in) and local file reads only.

## Sandbox Note

WebSearch bypasses sandbox network restrictions — use it for all competition/funding research. No curl or auth-required API calls needed.

## Notes on Screening Approach

- The goal is signal, not thoroughness. Two good WebSearch queries per idea beats five mediocre ones.
- Competition density is the most important signal. If the space is open and operator-fit is high, that's a strong pick regardless of market size.
- Flag ideas where the timing score changed significantly from when they were filed — markets move fast.
- Don't evaluate based on the operator's current bandwidth. Just score the opportunity.

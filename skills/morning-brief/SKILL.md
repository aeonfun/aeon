---
name: Morning Brief
description: Priority-driven daily briefing — the 3 things to focus on today, why now, and what moved
var: ""
tags: [meta]
---
<!-- autoresearch: variation B — priority-driven, decision-ready output (cut noise, demand "why now") -->

> **${var}** — Area to emphasize. If empty, covers all areas.

A good morning brief is a **priming document**, not a news dump. Every line must answer "so what?".

Today is ${today}. Read `memory/MEMORY.md`, `memory/logs/${yesterday}.md` (and today's if it exists), and `memory/cron-state.json` (if present).

## Steps

### 1. Rank, don't aggregate

Collect candidate items from:
- MEMORY.md "Next Priorities"
- Yesterday's log: unfinished work, follow-ups, notes
- Pending repo items: `gh pr list --state open --limit 10` and `gh issue list --state open --limit 10 --assignee @me`
- `memory/cron-state.json`: skills with `consecutive_failures >= 2` or `success_rate < 0.8`
- `aeon.yml`: skills whose cron matches today

Score each candidate on **leverage × urgency**:
- Leverage = does progressing this change the next 7 days?
- Urgency = does delay today make it worse?

Keep at most **3 focus items**. Everything else either goes in "Since yesterday" or is dropped. If ${var} is set, bias ranking toward that area but do not force a focus item if nothing qualifies.

### 2. Headlines — only if they change priorities

Use `WebSearch` for 2 headlines in the user's tracked areas (AI and crypto by default; emphasize ${var} if set). Include a headline **only if** it meaningfully updates one of the 3 focus items, flags a new risk, or implies an action (a deadline, a market move, a shipped competitor, a disclosed exploit). If nothing qualifies, omit the Watch section entirely. No filler.

### 3. Format — terse, scannable, opinionated

```
*Morning Brief — ${today}*

*Focus today*
1. [item] — why now: [≤12 words]
2. [item] — why now: [≤12 words]
3. [item] — why now: [≤12 words]

*Since yesterday*
- [moved]: what changed (link if relevant)
- [stuck]: what's blocked, on whom

*Watch* (omit entirely if nothing qualifies)
- [headline] — implication for focus #N

*Running today*
- skill @ HH:MM UTC
```

Style rules:
- Every focus item should state *why now* in ≤12 words. If you can't, demote it.
- "Since yesterday" is ≤5 bullets; merge duplicates across PR/issue/log sources.
- No throat-clearing ("here's your briefing…"). Lead with Focus.
- No empty sections — omit rather than print "(none)".
- If fewer than 3 candidates survive the why-now bar, allow **up to 1 background item** (tagged `background:` instead of `why now:`) so the brief still surfaces something worth knowing on quiet days. Never invent items, and never include more than 1 background item.
- If soul files under `soul/` are populated, match that voice; otherwise keep it direct and neutral (per CLAUDE.md).

### 4. Send via `./notify` and log

- Send the formatted brief with `./notify "..."`.
- Append to `memory/logs/${today}.md` under a `### morning-brief` heading: timestamp, the 3 focus items (one line each), headline count, and any skills flagged from cron-state. This becomes tomorrow's "since yesterday" input.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For GitHub queries, use `gh` CLI (handles auth internally) rather than curl.

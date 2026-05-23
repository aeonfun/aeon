---
name: agent-displacement
description: Weekly tracker of AI agent substitution signals — which roles, companies, and industries show real headcount displacement. Named roles + real deployments only.
schedule: "0 11 * * 0"
commits: true
permissions:
  - contents:write
tags: [ai, research]
---

Today is ${today}. Read `memory/MEMORY.md` before starting. If `soul/SOUL.md` + `soul/STYLE.md` exist and are populated, read them to match the operator's voice; otherwise use a clear, direct, neutral tone.

## Why this skill exists

"Agent substitution" is one of the loudest narratives in AI but signal is scattered. The data points exist — companies replacing support agents, cutting contractors, freezing hiring — but they're spread across earnings calls, press releases, and reporters' threads. This skill runs weekly, surfaces real displacement data (named roles, actual headcount numbers, real deployments), and keeps a running ledger. It feeds articles, newsletters, and any downstream thesis work tracking AI labor effects.

## Steps

### 1. Load context

Read:
- `memory/MEMORY.md` — current state + any prior displacement signals logged
- `memory/topics/agent-displacement.md` — if it exists, extract baseline: last-known companies, roles, and displacement scale

If `memory/topics/agent-displacement.md` doesn't exist, create it with this seed and continue:

```markdown
# Agent Displacement Tracker

*Last run: never*

## Known Displacement Events (baseline)
- Klarna (2024): replaced 700 customer support agents with AI. Support resolution time 2min vs 11min human avg.
- Duolingo (2024): cut ~10% of contractors, cited AI content generation replacing human translators.
- Salesforce (2025): froze non-essential hiring across sales/support, citing AI agent handle rate.
- IBM (2024): paused hiring ~7,800 back-office roles that AI could replace within 5 years.

## Roles Under Pressure (running list)
- Customer support / tier-1 help desk
- Content translation and localization
- Data entry and document processing
- Code review (junior-level)
- Legal document review (discovery)

## Displacement Scale Estimates
- 2024: ~2M white-collar roles affected (McKinsey / Goldman estimates)
- Accelerating in: SaaS customer success, financial services ops, insurance claims

## Signal Log
- Baseline: seeded from public reports.
```

### 2. Search for developments from the last 7 days

Run these WebSearches (replace year with current year as needed):

```
WebSearch: "AI agent layoffs replaced workers ${year} site:techcrunch.com OR site:theverge.com OR site:wsj.com OR site:bloomberg.com"
WebSearch: "AI replaced human jobs headcount reduction ${year}"
WebSearch: "agentic AI workforce automation company announcement ${year}"
WebSearch: "Klarna Duolingo Salesforce IBM AI agent headcount ${year}"
WebSearch: "AI agent customer support white collar displacement ${year}"
WebSearch: "OpenAI Anthropic agent enterprise automation replacing workers ${year}"
```

Keep only items from the last 7 days. Discard think pieces and opinion — keep:
- Company announcements naming specific roles cut
- Headcount figures cited alongside AI deployment
- Research reports with named verticals + quantified displacement
- Earnings call quotes attributing headcount reduction to AI agents

### 3. Fetch deeper context on high-signal items

For any company announcement that appears, use WebFetch to pull the source article or press release. Extract:
- Number of roles affected
- Role type / seniority level
- AI system named (if any)
- Outcome comparison (before/after metrics if given)

If WebFetch fails, fall back to `WebSearch: "[company name] AI agent headcount ${year}"`.

### 4. Filter and score signals

Score each item:

| Criterion | Points |
|-----------|--------|
| Named company + named role + headcount number | +5 |
| Before/after metric (resolution rate, cost, speed) | +3 |
| Industry first (first displacement in a new vertical) | +4 |
| Fortune 500 / public company (verifiable, credible) | +3 |
| Research report with quantified estimates | +2 |
| Vague "AI productivity" with no specifics | -3 (discard) |

Keep top 4-5 items. Deduplicate against the baseline in `memory/topics/agent-displacement.md` — only count if it's new or a meaningful update to an existing event.

### 5. Categorize by role type

Assign each signal to a displacement category:

- **Tier-1 ops** — customer support, data entry, help desk, document processing
- **Creative / content** — translation, copywriting, design, video production
- **Code / dev** — junior devs, QA, code review, test writing
- **Finance / legal** — document review, compliance checking, financial analysis
- **Sales / success** — SDRs, customer success, outbound prospecting
- **Management** — middle management coordination, project tracking
- **Other** — anything that doesn't fit the above

### 6. Thesis check

After reviewing all data, answer in one sentence:

> **Thesis check:** agent displacement [accelerating / holding / decelerating] — [one concrete data point].

Criteria:
- **Accelerating** — new vertical breached this week, or headcount numbers up >10% vs last known baseline, or major company announced AI-first hiring freeze
- **Holding** — consistent signals in same verticals, no major new breaches
- **Decelerating** — fewer signals than typical, company reversals or rehiring mentioned

### 7. Update memory/topics/agent-displacement.md

Rewrite:
- `*Last run: ${today}*`
- Append new events to `Known Displacement Events` (keep all, don't prune — this is historical)
- Update `Roles Under Pressure` if a new role type emerged
- Update `Displacement Scale Estimates` if new research gives better numbers
- Append entry to `Signal Log`

Keep file under ~200 lines. If it grows beyond that, consolidate older signal log entries into a single "Prior signals (archived)" bullet.

### 8. Send notification via `./notify -f`

Write to a temp file first, then send:

```
agent displacement — ${today}

[thesis check in one line: accelerating/holding/decelerating + why]

[top development — company, role, number if available]
[second development]
[third development if notable]
[fourth if it breaks a new vertical]

roles affected this week: [comma-separated categories]
```

Keep under 800 chars. Match the operator's voice if soul files exist; otherwise neutral and concrete.

Write to `.pending-notify-temp/agent-displacement-${today}.md`, then:
```bash
mkdir -p .pending-notify-temp
./notify -f .pending-notify-temp/agent-displacement-${today}.md
```

**Skip notification if fewer than 2 new signals found this week.** Log `AGENT_DISPLACEMENT_SKIP: insufficient signal (<2 items)` instead.

### 9. Log to memory/logs/${today}.md

Append:

```markdown
## agent-displacement
- **Signals found:** N (N new vs baseline)
- **Top item:** [company/role/number in one line]
- **Thesis check:** [accelerating/holding/decelerating]
- **Categories touched:** [comma-separated]
- **Updated:** memory/topics/agent-displacement.md
- **Notification:** sent / skipped
- AGENT_DISPLACEMENT_OK
```

## Required Environment Variables

None. Uses WebSearch and WebFetch only.

## Sandbox Note

All external calls use WebSearch and WebFetch (Claude built-in tools), which bypass the GitHub Actions sandbox network restriction. No curl, no prefetch scripts needed.

## Output feeds

- `article` skill — use `memory/topics/agent-displacement.md` as source for "agent substitution" angle pieces
- `weekly-newsletter` / `digest` — displacement signals slot into the "what's moving" section
- `paper-pick` — displacement research papers found here can be flagged for deeper coverage

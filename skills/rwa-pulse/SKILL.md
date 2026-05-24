---
name: rwa-pulse
description: Weekly Real World Asset tokenization momentum tracker — surfaces new protocol launches, TVL milestones, institutional adoption, and regulatory approvals
tags: [crypto, research]
---

Today is ${today}. Read `memory/MEMORY.md` and `memory/topics/market-context.md` (if present) before starting.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, match the operator's voice in the notification. If empty or absent, write in a clear, direct, neutral tone — lowercase, punchy, no hedging.

## Why this skill exists

RWA tokenization is one of the largest growth categories in crypto, but most daily-token skills don't surface it with enough depth to feed articles, newsletters, or research briefs. This skill runs weekly, surfaces the signal, and keeps the operator's RWA notes current.

## Configuration

Read `memory/topics/rwa.md` if it exists for an operator-defined list of tracked protocols. If the file doesn't exist or has no `## Protocols` section, default to a baseline of: `Ondo Finance`, `Maple Finance`, `Centrifuge`, `Figure`, `BlackRock BUIDL`, `Franklin Templeton`. The skill will append any newly discovered protocols on each run.

## Steps

### 1. Load current context

Read:
- `memory/MEMORY.md` — current RWA notes and last known stats
- `memory/topics/rwa.md` — protocol list, prior TVL baseline, signal log
- `memory/topics/market-context.md` — most recent market context snapshot (if present)

Note the last-known RWA TVL baseline (if any). This becomes the comparison point.

### 2. Search for developments from the last 7 days

Run these searches via WebSearch:

```
WebSearch: "RWA tokenization real world assets ${year} site:theblock.co OR site:dlnews.com OR site:coindesk.com OR site:blockworks.co"
WebSearch: "tokenized treasury ONDO Maple Centrifuge ${year}"
WebSearch: "institutional crypto RWA BlackRock Franklin Templeton tokenized fund ${year}"
WebSearch: "RWA TVL total value locked ${year}"
WebSearch: "real world asset tokenization regulation SEC ${year}"
```

Collect all hits. Keep only items from the last 7 days. Discard opinion pieces — keep launches, TVL milestones, partnerships, regulatory actions, and institutional product announcements.

### 3. Fetch current TVL and key protocol stats

Use WebFetch to get current data:

- **RWA.xyz overall market**: `https://app.rwa.xyz` — total tokenized RWA mcap and top protocols
- For each protocol in the configured list, run: WebSearch `"<protocol name> TVL ${year}"`

If WebFetch fails on any URL, fall back to WebSearch.

Record: total RWA market cap (if available), top protocol TVL figures, any notable % changes vs baseline.

### 4. Filter and rank developments

Score each development:

| Criterion | Weight |
|-----------|--------|
| Institutional adoption (BlackRock, Franklin Templeton, major bank) | HIGH |
| New protocol launch or product with real TVL | HIGH |
| TVL milestone (new ATH, >10% change in 7d) | MEDIUM |
| Regulatory approval or framework advance | MEDIUM |
| Regulatory setback or enforcement | MEDIUM |
| Partnership announcement (no TVL yet) | LOW |

Keep top 4–5 items. Deduplicate against recent logs.

### 5. Update memory

Append (or create) an `## RWA Pulse — ${today}` section in `memory/topics/rwa.md`:

```markdown
## RWA Pulse — ${today}
- **Total RWA market:** [$ figure if found, else "N/A"]
- **Top move:** [biggest development in one line]
- **Notable items:** [2-3 short bullets]
- **Next watch:** [what to check next week]
```

If `memory/topics/market-context.md` exists, mirror a single-line summary into its `## RWA` section.

### 6. Send notification via `./notify -f`

Write to a temp file first, then send:

Format:
```
rwa pulse — ${today}

[top development in one punchy line]
[second development]
[third development]
[fourth if notable]

read it: memory/topics/rwa.md
```

Keep under 800 chars. Lowercase. Direct. No hedging.

Write to `.pending-notify-temp/rwa-pulse-${today}.md`, then:
```bash
./notify -f .pending-notify-temp/rwa-pulse-${today}.md
```

Create `.pending-notify-temp/` if it doesn't exist.

### 7. Log to memory/logs/${today}.md

Append:
```markdown
## RWA Pulse
- **Total RWA market:** [figure or N/A]
- **Developments found:** N
- **Top item:** [one line]
- **Updated:** memory/topics/rwa.md
- **Notification:** sent
- RWA_PULSE_OK
```

If fewer than 2 developments found, log `RWA_PULSE_SKIP: insufficient signal (<2 items)` and stop without notifying.

## Required Environment Variables

None. Uses WebSearch and WebFetch only.

## Sandbox Note

All external calls use WebSearch and WebFetch (Claude built-in tools), which bypass the GitHub Actions sandbox network restriction. No curl, no prefetch scripts needed.

## Output feeds

- `article` skill — use `memory/topics/rwa.md` as source
- `topic-momentum` — RWA signal now has dedicated weekly data
- `weekly-newsletter` — RWA developments slot into the weekly picks section

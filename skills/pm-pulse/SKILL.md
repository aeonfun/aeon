---
name: pm-pulse
description: Weekly prediction-market & coordination-market tracker — volume on tracked platforms, new mechanism designs, reflexive market launches, regulatory moves
tags: [crypto, prediction-markets, research]
---

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice in the notification. If empty or absent, write in a clear, direct, neutral tone — punchy, lowercase, position first, no hedging.

## Why this skill exists

Prediction markets sit at the intersection of regulation, mechanism design, and on-chain liquidity. Most existing crypto skills cover token prices; none cover the PM ecosystem with enough depth to feed articles and newsletters. This skill runs weekly, surfaces the signal, and keeps a configurable list of platforms and mechanisms under continuous review.

## Configuration

Read `memory/topics/prediction-markets.md` for the operator's tracked platforms and prior baseline.

If `memory/topics/prediction-markets.md` doesn't exist, create it with a neutral seed:

```markdown
# Prediction Market & Coordination Market Tracker

*Last run: never*

## Platforms
- Polymarket
- Kalshi

## Known Protocols
- (populated by this skill over time)

## Key Stats
- Polymarket weekly volume: unknown
- Kalshi weekly volume: unknown
- New PM launches (last 7d): unknown

## Signal Log
- ${today}: skill initialized.
```

Extract from the file:
- `platforms` — list of tracked platforms (default: Polymarket, Kalshi)
- `known_protocols` — list of known PM/coordination-market protocols (used to detect newly-discovered ones)
- `<platform>_vol_last` — last known weekly volume for each platform (or "unknown")

### 1. Load current context

Read `memory/MEMORY.md` for any PM-related notes and the last 7 days of `memory/logs/` to dedup.

### 2. Search for developments

For each platform in the configured list, run a WebSearch:

```
WebSearch: "<platform> volume ${year} site:theblock.co OR site:dlnews.com OR site:coindesk.com OR site:blockworks.co"
```

Also run these general searches:

```
WebSearch: "prediction market coordination market new launch mechanism ${year}"
WebSearch: "reflexive market manipulation futarchy coordination ${year}"
WebSearch: "CLARITY Act crypto prediction market legislation ${year}"
```

Collect all hits. Keep only items from the last 7 days. Discard vague opinion pieces — keep launches, volume milestones, regulatory actions, funding rounds, and new mechanism designs.

### 3. Fetch current volume and market data

For the top platform in the list, WebFetch the public homepage and look for total volume figures, trending markets, and notable new market categories. If WebFetch returns limited data, fall back to WebSearch: `"<platform> volume this week ${year}"`.

Also check:
- WebSearch: `"<each other platform> volume monthly ${year}"`
- WebSearch: `"prediction market AMM mechanism design ${year}"`

### 4. Scan for regulatory moves

```
WebSearch: "CLARITY Act Senate status ${year}"
WebSearch: "CFTC prediction market ruling ${year}"
WebSearch: "Kalshi sports betting approval new states ${year}"
WebSearch: "prediction market SEC CFTC jurisdiction ${year}"
```

Flag CLARITY Act progress, CFTC rulings, state-level approvals, and international PM regulatory moves (EU, UK, Australia).

### 5. Scan for new protocol launches and mechanism innovations

```
WebSearch: '"prediction market" launch funding ${year} site:techcrunch.com OR site:theblock.co OR site:dlnews.com'
WebSearch: "futarchy coordination market token governance ${year}"
WebSearch: "prediction market AMM LS-LMSR CPMM new design ${year}"
```

Also check GitHub for new PM protocol repos:
```bash
gh api "search/repositories?q=prediction+market+in:description+in:topics&sort=updated&per_page=20" \
  --jq '.items[] | {full_name, description, stargazers_count, updated_at, topics}'
```

If `gh api` fails, fall back to WebSearch: `"prediction market protocol github ${year}"`.

From results:
- Flag any protocol not in `known_protocols`
- Note the mechanism design novelty (reflexive? AMM? futarchy? opinion market?)
- Star count as proxy for developer traction

### 6. Score the week

| Signal | Points |
|--------|--------|
| New PM/coordination-market launch with real liquidity | +3 |
| Tracked platform volume milestone (new ATH, >20% change) | +3 |
| Major regulatory development (CLARITY Act vote, CFTC ruling, new market approved) | +3 |
| New coordination/reflexive market mechanism design or paper | +3 |
| PM funding round ($5M+) | +2 |
| Notable new market category opening (new topic domain, new asset class) | +2 |
| Regulatory setback (bill stalling, enforcement, market shutdown) | +2 (flag as negative) |
| Academic mechanism design paper or significant blog post | +1 |
| Developer integration / API adoption by new platform | +1 |

**Momentum levels:**
- 0–2: quiet week
- 3–6: building
- 7–10: accelerating
- 11+: breakout

### 7. Update `memory/topics/prediction-markets.md`

Rewrite with:
- Updated `*Last run: ${today}*`
- Updated `Key Stats` (platform volume, new protocols)
- Updated `Known Protocols` (add newly discovered)
- Appended entry to `Signal Log`:
  ```
  - ${today}: [top development in one line] / momentum: [level]
  ```

### 8. Send notification via `./notify -f`

Write to `.pending-notify-temp/pm-pulse-${today}.md`, then:
```bash
./notify -f .pending-notify-temp/pm-pulse-${today}.md
```

Create `.pending-notify-temp/` if it doesn't exist.

**Format:**

```
pm pulse — ${today}

momentum: {level} ({score} pts)

{IF regulatory_development}
regulatory:
{forEach top regulatory items}
- {one-line, direct take}
{end}
{end}

{IF volume_milestone}
volume: {platform milestone in one line}
{end}

{IF new_protocols_or_mechanisms}
new mechanisms ({count}):
{forEach top 2 items}
- {name/project}: {what makes it different} ({stars}★ if GH)
{end}
{end}

{IF notable_signals}
signals:
{forEach top 2–3 news items}
- {one-line}
{end}
{end}

{IF quiet_week}
quiet week. incumbents still running.
{end}
```

Keep total under 900 chars. Do NOT use `./notify "$(cat ...)"` — write the file first, pass the path.

If momentum score is 0 and no regulatory news and no new protocols: log `PM_PULSE_OK: quiet` and skip notification.

### 9. Log to memory/logs/${today}.md

Append:

```markdown
## PM Pulse
- **Platforms covered:** {list}
- **Volume (7d):** {summary or N/A}
- **Regulatory developments:** {count} ({top item if any})
- **New protocols/mechanisms:** {count}
- **Momentum score:** {score} ({level})
- **Notification:** sent / skipped (quiet)
- PM_PULSE_OK
```

## Sandbox Note

- `gh api` uses the gh CLI — handles auth internally, no env-var expansion in headers.
- WebFetch and WebSearch: built-in Claude tools, bypass the GitHub Actions sandbox network gate.
- Platform homepages may return limited data via WebFetch — WebSearch fallback is the primary path for volume figures.

## What to watch for (recurring signal classes)

- **Regulatory progress** — CLARITY Act, CFTC rulings, state-level approvals. Each step feeds an article.
- **Tracked platform volume trajectory** — weekly volume is the best adoption signal.
- **New market approvals** — each new category approved (sports, politics, macro) extends the regulatory blueprint.
- **New reflexive / coordination market launches** — any protocol designing for market-influences-outcome dynamics.
- **Academic mechanism design** — futarchy implementations, LS-LMSR improvements, new AMM structures for PMs.
- **Funding rounds** — who's getting capitalized and at what valuation signals institutional conviction.
- **Regulatory setbacks** — enforcement actions, market shutdowns, bill stalling.

## Output feeds

- `article` skill — PM Pulse data feeds coordination-markets and regulatory articles
- `monitor-polymarket` / `polymarket-comments` — paired with this skill's macro signal
- `topic-momentum` — PM/coordination signal now has dedicated weekly data
- `weekly-newsletter` — regulatory moves and volume milestones slot into the infra section

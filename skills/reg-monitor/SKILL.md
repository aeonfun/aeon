---
name: Regulatory Monitor
description: Track legislation, regulatory actions, and legal developments affecting prediction markets, crypto, and AI agents — triaged by stage × impact for decision-ready output
var: ""
tags: [crypto, research]
---
<!-- autoresearch: variation B — sharper output via stage×impact scoring, action-first triage, deadline-aware buckets, structured primary sources (Federal Register + SEC/CFTC RSS), persistent URL dedup, source-status observability -->

> **${var}** — Specific regulatory topic to narrow focus (e.g. `prediction-markets`, `stablecoins`, `ai-agents`). If empty, scans all tracked domains.

Read `memory/MEMORY.md` for context on current positions and interests.
Read the last 2 days of `memory/logs/` entries for this skill to avoid repeating items.
Read `memory/topics/reg-monitor-seen.md` (create if missing) for persistent URL dedup across all prior runs.

## Thesis

Original skill produced news-shaped output (HIGH PRIORITY / NOTABLE / WATCH LIST) with soft ranking and no deadlines. Reg-monitor's real value is **decisions** — file a comment, prepare for a ban, short a market, brief counsel. Rank items by **stage × impact**, surface deadlines, drop filler buckets, and distinguish "quiet week" from "monitor failure" via source-status observability.

## Steps

### 1. Load inputs (structured primary sources first, WebSearch as gap-filler)

Set `today=$(date -u +%F)`, `year=$(date +%Y)`, `since=$(date -u -d '7 days ago' +%F)`.

Fetch from each source below. Track which succeed/fail — you'll emit a `source_status` footer. Treat each as independent; any single failure is non-fatal.

**A. Federal Register (authoritative US rulemakings, notices, enforcement)** — public, no auth:
```
WebFetch: https://www.federalregister.gov/api/v1/documents.json?conditions[publication_date][gte]=${since}&conditions[term]=prediction+market+OR+digital+asset+OR+stablecoin+OR+cryptocurrency+OR+AI+agent&per_page=40&order=newest
```
Extract per item: `title`, `publication_date`, `type` (Rule / Proposed Rule / Notice), `agencies`, `document_number`, `html_url`, `comments_close_on` (critical — drives ACT bucket), `abstract`.

**B. SEC press releases (RSS)** — authoritative enforcement + guidance:
```
WebFetch: https://www.sec.gov/news/pressreleases.rss
```
Keep only items published on/after `${since}`. Match titles against keywords: crypto, digital asset, stablecoin, token, DeFi, prediction, event contract, AI.

**C. CFTC press releases (RSS)** — authoritative prediction market + derivatives actions:
```
WebFetch: https://www.cftc.gov/RSS/RSSPR/rsspr.xml
```
Keep items on/after `${since}`. CFTC runs prediction-market rulemaking — all CFTC items are in-scope by default.

**D. WebSearch (gap-filler for state bills, court rulings, international)** — run these with the current year injected:
- `"prediction market" (bill OR legislation OR ban OR ruling) ${year}`
- `"Polymarket" OR "Kalshi" (CFTC OR state OR ruling OR investigation) ${year}`
- `stablecoin (legislation OR regulation OR enforcement) ${year}`
- `"AI agent" (regulation OR liability OR legislation) ${year}`
- `ESMA OR MiCA (enforcement OR guidance) ${year}`

If `${var}` is set, replace the above with 3 targeted searches for that specific topic (include `${year}` and "bill OR ruling OR enforcement").

**E. Congress.gov (optional, skip if no API key)** — if `CONGRESS_GOV_API_KEY` env var is set, WebFetch bill search for crypto/prediction-market keywords. Otherwise skip silently and rely on Federal Register + WebSearch to catch bill activity.

### 2. Deduplicate against seen URLs

Read `memory/topics/reg-monitor-seen.md` (format: one URL per line, oldest first). Drop any candidate whose URL already appears. Also drop candidates whose title substring-matches an entry from the last 2 days of `memory/logs/`.

If the seen-file exceeds 500 lines, keep only the most recent 500 before appending new items at end.

### 3. Filter

Discard:
- Opinion pieces, think-tank posts, academic papers (unless directly cited in a bill/rule/ruling)
- Industry lobbying announcements with no bill/docket link
- Generic "crypto market" news without a regulatory action
- Rumors without a concrete document/docket/case number

Keep only: bills introduced/advancing, agency rulemakings, enforcement actions, court rulings, official guidance, international regulatory coordination.

### 4. Score each surviving item

Compute `triage_score = impact × stage`:

**impact** (domain relevance to tracked interests):
- **3** — direct hit on prediction markets / event contracts / Polymarket / Kalshi / coordination markets
- **2** — crypto/DeFi/stablecoin/token classification
- **1** — AI agents, privacy/KYC, open-source liability (secondary)

**stage** (how close to binding):
- **5** — enacted law, final rule, binding court ruling, active enforcement (fine issued, C&D)
- **4** — passed a chamber, passed committee, agency final-rule comment period open with deadline <14d
- **3** — proposed rule / ANPRM with open comment period, bill reported out of committee
- **2** — introduced bill with at least one co-sponsor, leaked draft rule, staff advisory
- **1** — introduced bill with no co-sponsors, rumored action, international coordination statement

Jurisdiction multiplier — apply AFTER `impact × stage`:
- US federal or EU-wide: ×1.0
- US state (CA, NY, TX), UK: ×0.8
- Other G7: ×0.6
- Rest of world: ×0.4

### 5. Triage into buckets

- **ACT** (score ≥ 10, or comment deadline within 7 days, or enforcement action in last 7 days) — items that need a decision or action now
- **WATCH** (score 6-9) — actively advancing, not yet actionable
- **CONTEXT** (score 3-5) — relevant but early-stage; include only if ACT + WATCH combined < 5 items, otherwise drop
- Below 3: discard

Cap at 8 items total across all buckets. Sort within each bucket by score descending.

### 6. Enrich top items

For every ACT item and top 2 WATCH items, WebFetch the source URL and extract:
- **what changed**: one specific, verifiable sentence (not "the CFTC did something")
- **who's affected**: named entities or clearly-scoped class
- **timeline**: next milestone date if any (vote, deadline, effective date)
- **prediction market angle**: does this create a tradeable event, or directly affect an existing Polymarket/Kalshi market? Omit the line if none.

### 7. Compose notification

Keep under 4000 chars. If all buckets empty after filtering: **skip notify**, write `REG_MONITOR_OK` to the log, end.

```
*Reg Monitor — ${today}*
{1-line thesis: e.g. "3 items need a decision this week" or "quiet week, 2 to watch"}

*ACT*
• [Title](url) — jurisdiction · stage
  what changed. who's affected.
  ⏰ {deadline or effective date}
  📊 prediction market angle: {if any}

*WATCH*
• [Title](url) — jurisdiction · stage
  one-sentence verdict.

*CONTEXT* (only if included)
• [Title](url) — one-line summary.

—
sources: federal-register={ok|fail} · sec={ok|fail} · cftc={ok|fail} · websearch={ok|fail} · congress={ok|fail|skip}
{n} developments scored, {n_act} act / {n_watch} watch / {n_context} context
```

If **all sources failed**, send a different notification: `*Reg Monitor — ${today}* ⚠️ all sources failed, see log` and write `REG_MONITOR_ERROR` to the log. Do not emit an empty digest.

If **some sources failed** (partial data), still send the digest but flag it in the thesis line: `⚠️ partial — {failed sources} down`. Log `REG_MONITOR_DEGRADED`.

### 8. Update state

Append every URL included in the notification to `memory/topics/reg-monitor-seen.md`, one per line.

### 9. Log to `memory/logs/${today}.md`

```
### reg-monitor
- Status: {REG_MONITOR_OK | REG_MONITOR_DEGRADED | REG_MONITOR_ERROR | sent}
- Items: {n_act} act / {n_watch} watch / {n_context} context
- Sources: fr={ok|fail} sec={ok|fail} cftc={ok|fail} ws={ok|fail} cg={ok|fail|skip}
- Top item: {title, score, stage}
- Deadlines tracked: {any comment-period or vote dates in the next 14 days}
```

## What counts as a regulatory development

**Include**: bills introduced/advancing; agency rulemakings (NPRM/ANPRM/final rule); enforcement actions (fines, C&D, consent orders); court rulings affecting in-scope domains; official guidance/advisory letters; international coordination statements tied to a concrete document (FATF, G7, Basel).

**Exclude**: opinion pieces; think-tank reports (unless cited in a bill/docket); industry lobbying with no bill attached; academic papers; speculation without a document; press releases announcing future press releases.

## Sandbox note

The sandbox blocks some outbound curl. Use **WebFetch** for every URL fetch (it's the Claude built-in and bypasses the sandbox). Federal Register, SEC RSS, CFTC RSS, and WebSearch all work without env-var auth. Congress.gov API requires `CONGRESS_GOV_API_KEY` — skip silently if unset.

## Environment Variables

- `CONGRESS_GOV_API_KEY` (optional) — enables Congress.gov bill search step E. Skill degrades gracefully without it.

## Constraints

- Never emit an empty notification — if nothing clears the ACT/WATCH threshold, log `REG_MONITOR_OK` and stay silent.
- Never include a URL already in `memory/topics/reg-monitor-seen.md`.
- Never include speculation or opinion in the ACT bucket — only documents with a docket/bill/case number.
- Cap at 8 items total; actionable items beat volume.

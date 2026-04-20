---
name: Monitor Polymarket
description: Monitor prediction markets with a trader's lens — orderbook microstructure, conviction scoring, action-tiered output
var: ""
tags: [crypto]
---
<!-- autoresearch: variation D — trader's lens reframe: orderbook microstructure + conviction scoring + action-tiered output -->

> **${var}** — Event slug to monitor (e.g. "us-x-iran-ceasefire-by"). If empty, reads `skills/monitor-polymarket/watchlist.md`. If that's also empty, auto-discover the top 5 open events by 24h volume.

Read `memory/MEMORY.md` for context. Read yesterday's entry in `memory/logs/` for this skill (if present) so you can dedup alerts and observe day-over-day drift.

## Thesis

A flat table of 24h moves trains readers to ignore the skill. What matters to a trader is **conviction** — is this move backed by volume, tight spreads, and orderbook weight, or is it drift on a thin book? Every market earns a score and lands in one of three tiers — **CONVICTION / WATCH / IGNORE** — so the reader's attention is spent, not sprayed.

## Steps

### 1. Resolve the watchlist

```bash
if [ -n "${var}" ]; then
  SLUGS="${var}"
  DISCOVERED="no"
else
  SLUGS=$(grep -Ev '^(#|$)' skills/monitor-polymarket/watchlist.md || true)
  DISCOVERED="no"
  if [ -z "$SLUGS" ]; then
    DISCOVERED="yes"
    curl -s "https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false&limit=5" > .pm-events.json
    SLUGS=$(python3 -c 'import json; [print(e["slug"]) for e in json.load(open(".pm-events.json"))]')
  fi
fi
```

If any `curl` returns empty/non-zero, retry with **WebFetch** on the same URL (sandbox fallback).

### 2. For each event, pull the full signal stack

Run these fetches per slug and record per-source status (`ok|fail`) for the footer:

**a) Event + markets** — `https://gamma-api.polymarket.com/events?slug=$SLUG&limit=1`
Capture event `id`, `title`, and each market's `id`, `question`, `closed`, `outcomePrices`, `volume24hr`, `volumeNum`, `liquidityNum`, `clobTokenIds`. **Skip closed markets** — they've already resolved.

**b) 24h price history** — `https://clob.polymarket.com/prices-history?market=$YES_TOKEN&interval=1d&fidelity=60`
(`YES_TOKEN` = `json.loads(clobTokenIds)[0]`.) Compute: `open`, `close`, `high`, `low`, **24h change in pp** (close − open, ×100), intraday range width.

If the history is empty, mark the market `DATA_MISSING` and continue — do not drop the event.

**c) Orderbook microstructure** (per YES token):
- Spread — `https://clob.polymarket.com/spread?token_id=$YES_TOKEN` → width in pp
- Midpoint — `https://clob.polymarket.com/midpoint?token_id=$YES_TOKEN`
- Book — `https://clob.polymarket.com/book?token_id=$YES_TOKEN` → compute **depth imbalance** = (Σ top-5 bid sizes − Σ top-5 ask sizes) / (Σ top-5 bid + Σ top-5 ask). Positive = buy-side pressure, negative = sell-side.

Spread interpretation: `<2pp` tight (high confidence), `2–5pp` moderate, `>5pp` wide (uncertainty / info vacuum).

**d) Comments** — fetch both top-by-reactions and latest:
```
https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=$EVENT_ID&limit=10&order=reactionCount&ascending=false
https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=$EVENT_ID&limit=10&order=createdAt&ascending=false
```
(`parent_entity_type` is case-sensitive — `Event`, not `event`.) Each comment has `body`, `profile.username` (may be null → use `anon`), `reactionCount`, `createdAt`. Count how many comments landed in the last 24h vs the prior 6 days (from the latest feed) — that's your comment-burst baseline.

### 3. Score each open market — Conviction Index (0–10)

| Input | Contribution |
|-------|--------------|
| **Magnitude** | \|24h chg\| ≥ 5pp → +3 · 2–5pp → +1.5 · <2pp → 0 |
| **Volume backing** | volume24hr ≥ $500k → +2 · $100k–500k → +1 · <$100k → 0 |
| **Liquidity** | liquidityNum ≥ $200k → +1 · <$50k → −1 (thin-book penalty) |
| **Spread** | <2pp → +2 · 2–5pp → +1 · >5pp → 0 |
| **Depth imbalance** | \|imb\| > 0.3 **aligned** with the move direction → +2 |
| **Comment activity** | last-24h comment count ≥ 5× the prior-6-day daily avg, or ≥ 10 new → +1 |

Clamp to 0–10. Tiering:
- **CONVICTION** (score ≥ 7): real move backed by book + volume + tight spread
- **WATCH** (4–6.99): mixed signals, worth tracking
- **IGNORE** (<4): noise / thin-book drift / no real information

### 4. Detect divergences (high-value flags)

Scan every market (including WATCH/IGNORE) for:
- **Comment burst before move** — ≥5 new comments in the hour(s) preceding a ≥3pp move → *possible insider chatter*
- **Price without volume** — ≥3pp change but volume24hr < $50k → *likely drift, discount it*
- **Spread stress** — spread > 2× the implied volatility estimate from the 24h range (rough proxy: range/24 hours) → *uncertainty arriving*
- **Volume without price** — volume24hr ≥ 2× (volumeNum / 30) baseline AND \|24h chg\| < 1pp → *potential accumulation*

### 5. Dedup against yesterday

Read yesterday's `memory/logs/` entry for this skill. If a market tagged CONVICTION yesterday is again CONVICTION today with the same direction and magnitude within ±1pp, demote to WATCH and append `(already flagged 24h ago)` to the line. This stops the skill from screaming the same signal daily.

### 6. Build the report

Open with a one-line verdict — pick one: `all quiet`, `one conviction move`, `multi-market action`, `orderbook stress`, `divergence day`.

Then per tier (omit empty tiers):

```
*CONVICTION — [N markets]*
[Event Title] › [market question]
  YES [X.X%] ([+/-X.Xpp], $[X]m 24h vol, spread [Xpp], depth [+0.XX / -0.XX])
  why: [one line naming which inputs earned the score]
  comment: "[most illuminating comment — not most popular]" — [@user]

*WATCH — [N markets]*
[same structure, shorter — one line per market when possible]

*DIVERGENCES*
- [event] › [market]: [flag name] — [one line]
- ...

*sources: gamma=[ok|fail], clob_history=[ok|fail], clob_book=[ok|fail], comments=[ok|fail] | discovered=[yes|no]*
```

**Comment selection rule** — prefer comments that *explain* the move (name-drops, numbers, events, reasoning) over emoji/hype. If no comment is substantive, write `no substantive comments`.

### 7. Notify

Send via `./notify` (≤4000 chars — aggressively trim the WATCH tier if needed; CONVICTION + DIVERGENCES must survive).

All-IGNORE case:
```
polymarket monitor — ${today}
all quiet — N markets tracked, no conviction-tier signals
[sources line]
```

All sources failed:
```
MONITOR_POLYMARKET_DEGRADED — sources: [status line]
```

### 8. Log

Append to `memory/logs/${today}.md`:
```
## Monitor Polymarket
- **Verdict:** [one-line verdict]
- **Events:** N ([from watchlist|auto-discovered])
- **Markets:** N open / K closed / D data-missing
- **CONVICTION:** [list market questions or "none"]
- **WATCH:** [count]
- **Divergences:** [list or "none"]
- **Dedup demotions:** [count]
- **Sources:** gamma=..., clob_history=..., clob_book=..., comments=...
- **Notification:** sent|degraded|suppressed
```

If a market appears in CONVICTION for the first time, add a one-line entry under a `## Polymarket Watch` section in `memory/MEMORY.md` so future runs can track persistence.

## Sandbox note

All endpoints used here are public (no auth). For each `curl`, if it returns non-zero or empty JSON, retry the same URL with **WebFetch** and record the recovered source as `ok` in the footer. If both curl and WebFetch fail, record `fail` — never silently omit a failure.

## Constraints

- Do not alert on IGNORE-tier markets even if raw 24h change exceeds 5pp — thin-book drift is exactly what the Conviction Index exists to filter.
- Always include the sources status line; observability beats cleanliness.
- Comment quotes: strip newlines, clip to ≤140 chars, escape any markdown that could break the notification.
- Do not change the `var` semantics (single slug) or the tags without strong justification.

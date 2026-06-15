---
name: Monitor Polymarket
category: crypto
description: Monitor specific prediction markets for 24h price moves, volume changes, and fresh comments
var: ""
tags: [crypto]
---
> **${var}** — Event slug to monitor (e.g. "us-x-iran-ceasefire-by"). If empty, reads the watchlist from `skills/monitor-polymarket/watchlist.md`.

Read `memory/MEMORY.md` for context.
Read the last 2 days of `memory/logs/` to compare against previous readings and flag changes.

## Watchlist

The default watchlist lives at `skills/monitor-polymarket/watchlist.md`. Each line is an event slug. Add or remove slugs to change what gets monitored.

If `${var}` is set, monitor only that single event (useful for ad-hoc checks).

## Steps

### 1. Load watchlist

```bash
if [ -n "${var}" ]; then
  SLUGS="${var}"
else
  # Read watchlist file, one slug per line, skip comments and blanks
  SLUGS=$(grep -v '^#' skills/monitor-polymarket/watchlist.md | grep -v '^$')
fi
```

### 2. For each event, fetch markets and price history

For each event slug in the watchlist:

**a) Get the event and its markets:**
```bash
curl -s "https://gamma-api.polymarket.com/events?slug=$SLUG&limit=1"
```

The response contains the event `id`, `title`, and a `markets` array. Each market has:
- `id`, `question`, `slug`, `closed`
- `outcomePrices` — JSON array, index 0 = YES price (0.0–1.0)
- `volume24hr`, `volumeNum`, `liquidityNum`
- `clobTokenIds` — JSON array, index 0 = YES token, index 1 = NO token

**Skip closed markets** — they've already resolved.

**b) Get 24h price history for each open market:**
```bash
# YES token is index 0 of clobTokenIds
TOKEN_ID=$(echo "$CLOB_TOKEN_IDS" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())[0])")
curl -s "https://clob.polymarket.com/prices-history?market=$TOKEN_ID&interval=1d&fidelity=60"
```

Response: `{ "history": [{ "t": unix_timestamp, "p": "price_string" }, ...] }`

**c) Calculate 24h stats for each market:**
- **Open / Close** — first and last price in the history
- **Change** — close minus open, in percentage points (e.g. +4.0pp)
- **High / Low** — intraday range
- **Volume** — `volume24hr` from the market data
- **Direction** — classify as: surging (>+5pp), rising (+2 to +5pp), stable (-2 to +2pp), falling (-5 to -2pp), crashing (<-5pp)

### 3. Fetch comments

For each event, get top comments and latest comments:

```bash
EVENT_ID=... # from step 2a

# Top comments by reactions
curl -s "https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=$EVENT_ID&limit=10&order=reactionCount&ascending=false"

# Latest comments (last 24h chatter)
curl -s "https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=$EVENT_ID&limit=10&order=createdAt&ascending=false"
```

**Important:** `parent_entity_type` must be `Event` (capital E).

Each comment has: `body`, `profile.username` (often null → use "anon"), `reactionCount`, `createdAt`.

From the combined results, pick the **3 most interesting comments** per event:
- New comments from the last 24h get priority (they react to recent moves)
- High-reaction comments that are still relevant
- Contrarian takes, insider-sounding analysis, whale callouts, humor

### 4. Build the report

For each event, produce a summary block:

```
**[Event Title]** (event_id: N)

| Market | YES | 24h Chg | High/Low | 24h Vol |
|--------|-----|---------|----------|---------|
| [question] | XX.X% | +X.Xpp ▲ | XX–XX% | $X.Xm |
| [question] | XX.X% | -X.Xpp ▼ | XX–XX% | $X.Xm |
...

Biggest mover: "[question]" — [direction] from X% to Y%

Comments:
- [user/anon]: "[comment excerpt]" (X upvotes)
- [user/anon]: "[comment excerpt]"
- [user/anon]: "[comment excerpt]"
```

Flag any market that moved more than **5 percentage points** in 24h — these are the ones worth paying attention to.

### 5. Notify

Send via `./notify` (under 4000 chars):
```
polymarket monitor — ${today}

[Event Title]
[market] YES X% (chg pp) $Xm vol
[market] YES X% (chg pp) $Xm vol
biggest mover: [market] — [direction]
top comment: "[excerpt]"

[next event...]

alerts: [list any markets that moved >5pp]
```

If no markets moved significantly, say so — "all quiet" is useful signal too.

### 6. Log

Append to `memory/logs/${today}.md`:
```
## Monitor Polymarket
- **Events monitored:** N
- **Markets tracked:** N (M open, K closed)
- **Biggest mover:** "[question]" — X% → Y% (+/-Zpp)
- **Alert markets (>5pp move):** [list or "none"]
- **Top comment:** "[excerpt]"
- **Notification sent:** yes
```

If a market has moved dramatically or a new trend is forming, also note it in `memory/MEMORY.md` for future reference.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md).

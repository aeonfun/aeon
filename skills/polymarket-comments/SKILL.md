---
name: Polymarket Comments
description: Top trending Polymarket markets and the most interesting comments from them
var: ""
tags: [crypto]
---
> **${var}** — Market topic to focus on (e.g. "crypto", "elections", "AI"). If empty, checks top trending markets across all categories.

Read memory/MEMORY.md for context.
Read the last 2 days of memory/logs/ to avoid repeating data.

## Sandbox note

The sandbox may block curl. For every curl call below, if it fails or returns empty, use **WebFetch** for the same URL. All Polymarket APIs are public (no auth needed), so WebFetch works as a drop-in replacement.

## Steps

### 1. Fetch trending markets

```bash
# Top markets by 24h volume
curl -s "https://gamma-api.polymarket.com/markets?closed=false&order=volume24hr&ascending=false&limit=15"
```

Each market object contains: `id`, `question`, `slug`, `outcomePrices` (JSON array — index 0 is YES), `volume24hr`, `volumeNum`, `liquidityNum`.

### 2. Pick 5 most interesting markets

Prioritize:
- High volume + active trading (something is happening)
- Controversial or polarizing questions (where comments will be spicy)
- Markets with high engagement and controversy
- Skip sports/esports games unless the line is wild
- If `${var}` is set, filter to markets matching that topic

### 3. Get event IDs for each market

Comments live on **events**, not markets. Each market belongs to an event. Extract the event slug from the market slug (usually the market slug minus any trailing date/variant suffix) and look it up:

```bash
# For each selected market, find its parent event
# The event slug is typically the market slug without trailing specifics
# e.g. market slug "us-x-iran-ceasefire-by-march-31" → event slug "us-x-iran-ceasefire-by"
curl -s "https://gamma-api.polymarket.com/events?slug=$EVENT_SLUG&limit=1"
```

The response contains the event `id` needed for the comments endpoint.

If the slug guess misses, try searching by the market question:
```bash
curl -s "https://gamma-api.polymarket.com/events?title=$MARKET_QUESTION_URL_ENCODED&limit=3"
```

### 4. Fetch comments for each event

```bash
# Fetch top comments sorted by reactions (most upvoted first)
curl -s "https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=$EVENT_ID&limit=20&order=reactionCount&ascending=false"
```

**Important:** `parent_entity_type` must be `Event` (capital E). Values `market` or `series` will error.

Each comment object contains:
- `body` — the comment text
- `profile.username` — commenter name (often null/anon)
- `reactionCount` — upvotes
- `createdAt` — timestamp

Also fetch the most recent comments to catch breaking takes:
```bash
curl -s "https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=$EVENT_ID&limit=10&order=createdAt&ascending=false"
```

### 5. Extract the best takes

From each market's comments, pick the **2-3 most interesting**:
- Contrarian positions with reasoning
- Insider-sounding analysis or news drops
- Funny or sharp observations
- Whale behavior callouts
- Resolution debates

Skip low-effort noise (one-word comments, spam, unhinged rants with no signal).

If a market has fewer than 3 good comments from the API, supplement with a quick WebSearch:
```
"[market question]" polymarket site:x.com OR site:reddit.com
```

### 6. Notify

Send via `./notify` (under 4000 chars):
```
polymarket comments — ${today}

1. "Market question?" — YES X% ($Xm vol)
- [user/anon]: "[interesting take]"
- [user/anon]: "[interesting take]"

2. "Market question?" — YES X% ($Xm vol)
- [user/anon]: "[interesting take]"
- [user/anon]: "[interesting take]"

... (5 markets)
```

### 7. Write swarm-fund signal JSON (ADR-093 contract)

After notify, write a structured JSON file at `outputs/polymarket-comments/${today}.json` for swarm-fund-mvp's `python/execution/aeon_adapter.py`. The adapter polls `https://raw.githubusercontent.com/tomscaria/aeon/main/outputs/{skill}/{date}.json` every 15 min; this file gets auto-committed by the workflow's Commit step.

Required schema (per `_parse_payload` in `python/execution/aeon_adapter.py`):

```json
{
  "signals": [
    {
      "market_id": "<numeric market id, falls back to slug>",
      "score": 0.0-1.0,
      "direction": "LONG" or "SHORT",
      "narrative": "<the salient comment-derived narrative shift, one line>",
      "price": 0.0-1.0,
      "volume": <24h volume number>
    }
  ]
}
```

For each of the 5 selected markets, emit one entry capturing the strongest comments-side signal:
- `market_id` = market `id` from Gamma API (fall back to `slug`)
- `score` = comments-side confidence in the narrative shift, on a `0.0` (vibes only) → `1.0` (multiple independent commenters + concrete citation) scale. Anchors: single insider-style comment with track record = `0.5`; ≥2 commenters surfacing same catalyst = `0.7`; comment thread links to verifiable evidence (sante.gouv.fr, UMA filing, sub-clause text) = `0.9`+
- `direction` = `"LONG"` (buy YES) if comments lean toward the YES outcome being underpriced, `"SHORT"` (buy NO) if the opposite. Use the strongest commenter direction; if ambiguous, default to whatever direction the price-vs-narrative gap implies
- `narrative` = a one-line operator-grade summary of the comment-derived insight (NOT the market question, NOT a comment excerpt — the *thesis*)
- `price` = YES `outcomePrices[0]` at observation
- `volume` = `volume24hr`

Write the file even when there are zero comment-derived signals — emit `{"signals": []}`. Use the **atomic + validated** pattern from `conventions/outputs-contract.md`:

```bash
mkdir -p outputs/polymarket-comments
JSON_TMP=$(mktemp)
python3 -c "
import json, sys
payload = ${PYTHON_LITERAL_PAYLOAD}
json.dump(payload, sys.stdout, indent=2)
" > "$JSON_TMP" 2>/dev/null \
  && mv "$JSON_TMP" "outputs/polymarket-comments/${today}.json" \
  || { echo "ADR093_WRITE_FAIL: outputs/polymarket-comments/${today}.json write failed" >&2; rm -f "$JSON_TMP"; }
```

**Field omissions documented:** polymarket-comments does NOT emit `price_drift` (comments are a narrative-class signal, not a price-move observation). The adapter handles missing optional fields via fallback defaults (`price_drift` becomes `null` in consumer metadata; consumer is OK with that).

Do not abort the skill on JSON-write failure — `ADR093_WRITE_FAIL` to stderr, continue to notify.

### 8. Log

Append to memory/logs/${today}.md:
```
## Polymarket Comments
- **Markets covered:** 5
- **Top market:** "[question]" — $Xm volume
- **Notable take:** "[best comment excerpt]"
- **Notification sent:** yes
```

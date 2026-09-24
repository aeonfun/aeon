---
name: you-web-search
description: Web search using You.com Search API with high-quality, cited results — runs keyless out of the box; YDC_API_KEY unlocks higher limits and real-time web crawling
metadata:
  title: You.com Web Search
  mode: read-only
  category: basics
  var: ""
  tags:
    - web
    - search
    - research
  requires:
    - YDC_API_KEY?
---

> **${var}** — Search query or topic. When empty, uses a general search for current notable developments across tracked areas.

Today is ${today}. Perform web search using You.com's Search API to find current, high-quality information on **${var}**.

## Overview

This skill provides web search functionality via You.com's Search API, offering several advantages over basic WebSearch:

- **Higher quality results** with relevance ranking and citation extraction
- **Works with zero configuration** — no key, wallet, or sign-up needed for the keyless tier
- **Real-time web crawling** for fresh content when `livecrawl=web` is enabled (keyed tier)
- **Structured result format** with titles, URLs, snippets, and publication dates
- **Optional livecrawl control** through `YOUCOM_LIVECRAWL` when a full page fetch is useful

### Auth modes

| Mode | When | Endpoint | Limits |
| --- | --- | --- | --- |
| `keyless` | `YDC_API_KEY` unset | `https://api.you.com/v1/agents/search` | 100 searches/day per IP, no livecrawl |
| `keyed` | `YDC_API_KEY` set | `https://api.you.com/v1/search` | Your plan's limits, livecrawl available |

## Phase 1 — Execute Search

### Auth Mode

Check whether the key is set via `${VAR:+x}` — a bare `$YDC_API_KEY` trips the secret-expansion analyzer:
```bash
if [ -n "${YDC_API_KEY:+x}" ]; then AUTH_MODE="keyed"; else AUTH_MODE="keyless"; fi
echo "youcom auth_mode=$AUTH_MODE"
```

A missing key is **not** an error — the skill runs on the keyless tier.

### API Call

Both modes call the same REST contract through `./secretcurl`. In `keyed` mode the `{YDC_API_KEY}` placeholder is substituted inside the helper; in `keyless` mode no key header is sent at all.

```bash
QUERY="${var:-current notable developments in AI, crypto, and technology}"
COUNT="10"

FRESHNESS="${YOUCOM_FRESHNESS:-week}"
LIVECRAWL="${YOUCOM_LIVECRAWL:-}"
PARAMS="query=$(echo "$QUERY" | jq -Rr @uri)&count=$COUNT&safesearch=strict&freshness=$(echo "$FRESHNESS" | jq -Rr @uri)"

if [ "$AUTH_MODE" = "keyed" ]; then
  SEARCH_URL="https://api.you.com/v1/search?$PARAMS"
  # livecrawl is a keyed-tier feature; the keyless endpoint answers it with 402.
  if [ -n "${LIVECRAWL:+x}" ]; then
    SEARCH_URL="$SEARCH_URL&livecrawl=$(echo "$LIVECRAWL" | jq -Rr @uri)"
  fi
  HTTP=$(./secretcurl -s -o /tmp/youcom-search.json -w '%{http_code}' \
    --max-time 30 -X GET \
    "$SEARCH_URL" \
    -H "X-API-Key: {YDC_API_KEY}" \
    -H "User-Agent: youdotcom-integration/aeonfun-aeon")
else
  SEARCH_URL="https://api.you.com/v1/agents/search?$PARAMS"
  [ -n "${LIVECRAWL:+x}" ] && echo "youcom livecrawl=skipped reason=keyless (set YDC_API_KEY to enable)"
  HTTP=$(./secretcurl -s -o /tmp/youcom-search.json -w '%{http_code}' \
    --max-time 30 -X GET \
    "$SEARCH_URL" \
    -H "User-Agent: youdotcom-integration/aeonfun-aeon")
fi

echo "youcom http=$HTTP auth_mode=$AUTH_MODE bytes=$(wc -c </tmp/youcom-search.json)"
```

Never send the key to the keyless endpoint, and never call the keyed endpoint without a key (it answers with a `402` payment challenge rather than results).

### Response Processing

On `HTTP=200` with non-empty body, parse the response:

```bash
if [ "$HTTP" = "200" ] && [ -s /tmp/youcom-search.json ]; then
  # Extract web and news results using the documented Search API shape.
  jq -r '
    [
      (.results.web[]?  | ["web",  (.title // ""), (.url // ""), ((.snippets // []) | join(" ")), (.page_age // "recent")]),
      (.results.news[]? | ["news", (.title // ""), (.url // ""), ((.snippets // []) | join(" ")), (.page_age // "recent")])
    ] | .[] | @tsv
  ' /tmp/youcom-search.json > /tmp/youcom-results.txt
  
  # Count results
  RESULT_COUNT=$(wc -l < /tmp/youcom-results.txt)
  echo "Extracted $RESULT_COUNT search results"
else
  echo "API call failed: HTTP=$HTTP"
  RESULT_COUNT=0
fi
```

## Phase 2 — Format Results  

Process the results into a readable format:

### Result Structure

For each result from You.com API:
- **Title** — article/page title
- **URL** — direct link to source  
- **Snippet** — join `snippets[]` into one excerpt highlighting query match
- **Date** — `page_age` or `recent` when unavailable

### Quality Filtering

Apply basic quality filters:
- Exclude results with missing or placeholder titles
- Skip results without accessible URLs
- Filter out low-quality content (spam, thin content)
- Deduplicate near-identical results from the same domain

### Formatting

Structure the output for easy consumption:

```
*You.com Web Search Results — ${today}*

Query: "${var}"
Source: You.com Search API (${auth_mode}) 
Results: ${result_count} found

1. **[Title](URL)**  
   Snippet with relevant context...
   Published: Date

2. **[Title](URL)**
   Snippet...  
   Published: Date

---
API Status: ${http_status} | Auth: ${auth_mode} | Quality: ${quality_score}/5
```

## Phase 3 — Delivery and Logging

### Notification

Send formatted results via `./notify`:
- Include query, result count, and source attribution
- Highlight most relevant results (top 5-7)  
- Note the auth mode actually used (`keyless` or `keyed`)
- Include livecrawl info when enabled (or that it was skipped on the keyless tier)

### Memory Integration  

Log the search for future reference:

1. **Append to daily log** — `memory/logs/${today}.md` under `### you-web-search`:
   ```
   ### you-web-search
   - Query: "${var}"
   - Source: You.com API (${auth_mode})
   - Results: N found, M delivered  
   - Status: HTTP ${code}
   - Quality score: X/5 (relevance, freshness, diversity)
   ```

2. **Update search memory** — Add successful searches to `memory/searches.md` for pattern tracking

## Error Handling

### API Failure Recovery

Handle common failure modes gracefully:

- **Rate limits (429)**: Log rate limit hit. In `keyless` mode this is usually the 100/day per-IP cap — suggest setting `YDC_API_KEY` (get one at https://you.com/platform?utm_source=aeonfun-aeon&utm_medium=oss_integration&utm_campaign=2026-09-oss-integrations&utm_content=error-message). In `keyed` mode, suggest checking the plan quota
- **Payment required (402)**: The request needs the keyed tier (e.g. livecrawl without a key) — suggest setting `YDC_API_KEY`
- **Invalid key (401/403)**: Clear error about checking `YDC_API_KEY` (keyed mode only)
- **Network failures**: Surface the API failure and exit cleanly
- **Malformed responses**: Validate JSON structure, handle parsing errors
- **Empty results**: Suggest query refinement, try broader terms

### Logging Failures  

Record failure reasons for debugging:
- `youcom-api-unavailable` — API endpoint unreachable
- `youcom-rate-limited` — Hit plan limits or the keyless daily cap
- `youcom-payment-required` — Keyed-tier feature requested without a key
- `youcom-auth-invalid` — API key rejected
- `youcom-parse-error` — Response format unexpected

## Network

Both modes go through `./secretcurl` so one code path covers them: keyed calls carry the `{YDC_API_KEY}` placeholder (never a bare `$YDC_API_KEY` on the line); keyless calls carry no placeholder and are passed through unchanged. Every request sends `User-Agent: youdotcom-integration/aeonfun-aeon`.

## Environment Variables

- **`YDC_API_KEY`** (optional) — You.com API key. Unset: the skill runs on the free keyless tier (100 searches/day per IP, no livecrawl). Set: keyed Search API with your plan's limits and livecrawl. Get a key at https://you.com/platform?utm_source=aeonfun-aeon&utm_medium=oss_integration&utm_campaign=2026-09-oss-integrations&utm_content=docs.
- **`YOUCOM_FRESHNESS`** (optional) — Freshness filter (`day`, `week`, `month`, `year`, or a date range).
- **`YOUCOM_LIVECRAWL`** (optional, keyed only) — Pass through to `livecrawl` when you want full page content (`web`, `news`, or `all`). Ignored on the keyless tier.

## Constraints

- **Never expose credentials** in logs or notifications
- **Always attribute source** — clearly indicate You.com API
- **Respect rate limits** — handle 429 responses gracefully
- **Validate all URLs** — ensure results contain real, accessible links
- **Keep results relevant** — filter low-quality or off-topic results
- **Fail clearly** — if the API is unavailable, report it instead of pretending a fallback ran

## Integration Notes  

### Relationship to Built-in WebSearch

This skill **complements** Aeon's built-in WebSearch, but it is a separate Search API path (keyless by default, keyed when `YDC_API_KEY` is set):

- **You.com advantages**: Higher quality results, real-time crawling, better relevance ranking
- **WebSearch advantages**: No API dependency, always available, deeply integrated
- **Use You.com for**: Research tasks, fact-checking, current events, specific queries
- **Use WebSearch for**: Built-in search flows elsewhere in Aeon

### Scheduling Recommendations

- **On-demand**: Manual execution for specific research needs
- **Low frequency**: Daily or less frequent automatic searches to respect quotas  
- **Research workflows**: Chain with other skills that need web context
- **Avoid high-frequency**: Don't schedule more than hourly to preserve API quotas — the keyless tier is capped at 100 searches/day per IP

### Skills Integration

This skill works well with:
- **digest** — Enhanced web signal for daily digests
- **article** — Research support for article generation  
- **github-trending** — Context for trending repo evaluation
- **token-pick** — Market research and catalyst discovery
- **mention-radar** — Broader web mention detection beyond X/Twitter

The You.com search results can inform other skills' web research needs while providing a higher-quality alternative to basic web search.

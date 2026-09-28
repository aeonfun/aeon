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
  if jq -r '
    [
      (.results.web[]?  | ["web",  (.title // ""), (.url // ""), ((.snippets // []) | join(" ")), (.page_age // "recent")]),
      (.results.news[]? | ["news", (.title // ""), (.url // ""), ((.snippets // []) | join(" ")), (.page_age // "recent")])
    ] | .[] | @tsv
  ' /tmp/youcom-search.json > /tmp/youcom-results.txt; then
    PARSE_OK=1
  else
    PARSE_OK=0
    : > /tmp/youcom-results.txt
  fi
  
  # Count results
  RESULT_COUNT=$(wc -l < /tmp/youcom-results.txt)
  echo "Extracted $RESULT_COUNT search results"
else
  PARSE_OK=1
  RESULT_COUNT=0
fi

# Any non-200 (or a 200 with nothing usable) hands the run to the built-in WebSearch.
if [ "$RESULT_COUNT" -eq 0 ]; then
  case "$HTTP" in
    200) if [ "$PARSE_OK" = "1" ]; then REASON="EMPTY"; else REASON="PARSE"; fi ;;
    000) REASON="NETWORK" ;;
    *)   REASON="HTTP_$HTTP" ;;
  esac
  SOURCE_PATH="websearch"
  echo "youcom fallback=websearch reason=$REASON auth_mode=$AUTH_MODE"
else
  SOURCE_PATH="youcom"
fi
```

### WebSearch Fallback

When `SOURCE_PATH=websearch`, don't end the run empty. Run the same query (`$QUERY`) through the built-in **WebSearch** tool and continue to Phase 2 with those results. The log line above is the record of why:

```
youcom fallback=websearch reason=HTTP_401 auth_mode=keyless
```

Typical triggers are a keyless `401` (see [Error Handling](#error-handling)), the keyless `429` daily cap (shared GitHub Actions runner IPs can hit it even on light usage), `5xx`, a network timeout (`reason=NETWORK`), an unparseable body (`reason=PARSE`), or zero results (`reason=EMPTY`). Only fall back once per run. If WebSearch also returns nothing, report that neither source returned results.

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
Source: ${source}
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

`${source}` is exactly one of `You.com Search API (${auth_mode})` or `WebSearch (fallback: ${reason})`, matching `SOURCE_PATH`. Never print both.

## Phase 3 — Delivery and Logging

### Notification

Send formatted results via `./notify`:
- Include query, result count, and source attribution
- Highlight most relevant results (top 5-7)  
- Note the auth mode actually used (`keyless` or `keyed`)
- When the fallback ran, say so and give the reason (e.g. "via WebSearch — You.com returned HTTP 401")
- Include livecrawl info when enabled (or that it was skipped on the keyless tier)

### Memory Integration  

Log the search for future reference:

1. **Append to daily log** — `memory/logs/${today}.md` under `### you-web-search`:
   ```
   ### you-web-search
   - Query: "${var}"
   - Source: ${source}
   - Results: N found, M delivered  
   - Status: HTTP ${code}
   - Quality score: X/5 (relevance, freshness, diversity)
   ```

2. **Update search memory** — Add successful searches to `memory/searches.md` for pattern tracking

## Error Handling

### API Failure Recovery

Every failure below ends in the [WebSearch fallback](#websearch-fallback), so a run always has results. The notes say what to tell the operator:

- **Keyless 401**: In `keyless` mode no key is sent, so a `401` is **not** a credential problem. Some locations currently get `401` from the keyless endpoint with a body like `{"detail":"'ascii' codec can't encode characters ..."}`. This is a known server-side issue with non-ASCII region names (e.g. `Île-de-France`), and `country`/`language` parameters don't avoid it. Fall back and log `reason=HTTP_401`. Setting `YDC_API_KEY` uses the keyed endpoint, which is unaffected
- **Rate limits (429)**: Log rate limit hit. In `keyless` mode this is usually the 100/day per-IP cap — suggest setting `YDC_API_KEY` (get one at https://you.com/platform?utm_source=aeonfun-aeon&utm_medium=oss_integration&utm_campaign=2026-09-oss-integrations&utm_content=error-message). In `keyed` mode, suggest checking the plan quota
- **Payment required (402)**: The request needs the keyed tier (e.g. livecrawl without a key) — suggest setting `YDC_API_KEY`
- **Invalid key (401/403, keyed mode)**: Clear error about checking `YDC_API_KEY`
- **Server errors (5xx)**: Transient. Fall back and log `reason=HTTP_<code>` (e.g. `HTTP_503`)
- **Network failures**: Fall back and log `reason=NETWORK`
- **Malformed responses**: A `200` whose body `jq` can't parse. Fall back and log `reason=PARSE`
- **Empty results**: A `200` with zero results. Fall back and log `reason=EMPTY`. If WebSearch is also empty, suggest query refinement or broader terms

### Logging Failures  

Record failure reasons for debugging:
- `youcom-api-unavailable` — API endpoint unreachable
- `youcom-rate-limited` — Hit plan limits or the keyless daily cap
- `youcom-payment-required` — Keyed-tier feature requested without a key
- `youcom-auth-invalid` — API key rejected (keyed mode)
- `youcom-keyless-401` — Keyless endpoint returned 401 with no key sent
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
- **Never end a run empty** — on any You.com failure, fall back to WebSearch and log `youcom fallback=websearch reason=<REASON>`
- **Report the path honestly** — say whether results came from You.com or the WebSearch fallback, never present fallback results as You.com results

## Integration Notes  

### Relationship to Built-in WebSearch

This skill **complements** Aeon's built-in WebSearch, but it is a separate Search API path (keyless by default, keyed when `YDC_API_KEY` is set):

- **You.com advantages**: Higher quality results, real-time crawling, better relevance ranking
- **WebSearch advantages**: No API dependency, always available, deeply integrated. It is also this skill's fallback whenever the You.com call fails
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

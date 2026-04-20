---
name: List Digest
description: Cross-list narrative resonance + signal-scored top tweets from tracked X lists in the past 24 hours
var: ""
tags: [social]
---
<!-- autoresearch: variation B — sharper output via signal scoring + cross-list narrative clustering + insight-per-item discipline -->

> **${var}** — Comma-separated X list IDs to track (e.g. `"1953536336675365173,1937207796270829766"`). Optionally append a topic filter after a pipe: `"LIST_ID1,LIST_ID2|AI agents"`. List IDs are the numeric IDs in the URL (`https://x.com/i/lists/<ID>`). **Required** — set in `aeon.yml`.

Read `memory/MEMORY.md` for context. Read the last 2 days of `memory/logs/` and `memory/list-digest-seen.txt` (if it exists) to deduplicate.

## Why this skill exists

Tracked X lists are *curator signal* — someone you trust pre-selected the accounts. The value isn't a flat top-N-per-list dump (that buries the lede), it's:

1. **Cross-list resonance** — when ≥2 lists surface the same story, that's stronger than any single-list winner.
2. **Insight, not paraphrase** — each item must answer "so what" in one line, not restate the tweet.
3. **A verdict** — one line at the top telling the operator what today's lists collectively say.

## Steps

### 1. Parse and validate `${var}`

```bash
if [ -z "${var}" ]; then
  echo "LIST_DIGEST_NO_CONFIG: var must contain at least one X list ID" \
    >> "memory/logs/$(date -u +%Y-%m-%d).md"
  exit 0
fi

IDS_PART="${var%%|*}"
TOPIC_FILTER=""
if [ "${var}" != "$IDS_PART" ]; then
  TOPIC_FILTER="${var#*|}"
fi

# Validate: each ID must be all digits (X list IDs are numeric)
for LIST_ID in $(echo "$IDS_PART" | tr ',' ' '); do
  if ! [[ "$LIST_ID" =~ ^[0-9]+$ ]]; then
    echo "LIST_DIGEST_NO_CONFIG: invalid list ID '$LIST_ID' (must be numeric)" \
      >> "memory/logs/$(date -u +%Y-%m-%d).md"
    exit 0
  fi
done
```

If `XAI_API_KEY` is unset and no cache exists, fall back to **Path C** in step 2. If no path returns data, log `LIST_DIGEST_NO_CONFIG: XAI_API_KEY required` and stop without notifying.

### 2. Fetch each list's top tweets (past 24h)

For each `LIST_ID`, prefer cache → API → WebSearch in that order.

**Path A — pre-fetched cache** (preferred — `scripts/prefetch-xai.sh` may have run):
```bash
cat ".xai-cache/list-digest-${LIST_ID}.json" 2>/dev/null \
  | jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'
```

**Path B — X.AI Responses API**:
```bash
FROM_DATE=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
TO_DATE=$(date -u +%Y-%m-%d)

curl -s --max-time 180 -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "input": [{"role": "user", "content": "Look at X list https://x.com/i/lists/'"$LIST_ID"'. Step 1: report the list name and a one-line description. Step 2: identify the most engaging tweets posted by members of this list between '"$FROM_DATE"' and '"$TO_DATE"' UTC. Return the top 12 tweets ranked by engagement (likes, retweets, replies). For EACH tweet you MUST return: (a) @handle, (b) the full tweet text (not a paraphrase), (c) explicit engagement counts as separate fields — likes:N, retweets:N, replies:N, views:N if available, (d) the direct permalink in the form https://x.com/<handle>/status/<id>, (e) media type (image|video|none), (f) one-line context if it'\''s a reply or quote tweet (who/what). Skip retweets of accounts NOT on this list. If a tweet has an image and you can analyze it, include a one-line image description."}],
    "tools": [{"type": "x_search", "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'", "enable_image_understanding": true}]
  }'
```

Parse responses with `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'`.

**Path C — WebSearch fallback** (when both cache and `XAI_API_KEY` are unavailable, OR Grok returns nothing for a list):

Use the built-in WebSearch tool: `site:x.com "i/lists/${LIST_ID}" OR list:${LIST_ID} after:${FROM_DATE}`. Quality is lower; mark this list's source-status as `websearch` in step 6.

**Per-list outcome classification** (track for the source-status footer):
- `ok` — ≥3 tweets returned
- `quiet` — 1–2 tweets returned (list exists but a slow day)
- `empty` — 0 tweets returned (Grok found list but no posts in window)
- `error` — API/cache/Grok-can't-access failure (note the reason)

### 3. Build the candidate pool

Collect every tweet from every list into a single pool. For each tweet record: `{handle, text, likes, retweets, replies, views, url, list_ids_seen_on:[], list_names_seen_on:[], media, is_reply, is_quote}`.

**Deduplicate by URL across lists**: if the same tweet appears on multiple lists, merge the records — keep both `list_ids_seen_on` and `list_names_seen_on` populated. Cross-list appearance is a signal (used in step 4).

**Deduplicate against history**: drop any candidate whose URL is in `memory/list-digest-seen.txt` OR appears in the last 2 days of `memory/logs/`.

### 4. Score every candidate

For each surviving candidate, compute a **signal score**. Use natural log on engagement to prevent one viral tweet from dominating; add structural bonuses.

```
base   = ln(1+likes) + 2.0*ln(1+retweets) + 1.5*ln(1+replies)
bonuses:
  +2.0  if appeared on ≥2 distinct lists (cross-list resonance)
  +1.5  if appeared on ≥3 distinct lists
  +1.0  if topic_filter set AND tweet text/context matches it (case-insensitive substring or obvious semantic match)
  +0.5  if author is small-account-signal (≤25k followers based on Grok's note OR you have no follower data — apply the bonus when the tweet *content* is technical/insider rather than influencer-style)
  +0.3  if media is image OR video (richer artifact)
penalties:
  -1.0  if is_reply AND replied-to is NOT on any tracked list (low context for the reader)
  -0.5  if text is a pure link share with <10 words of original commentary
score = base + sum(bonuses) - sum(penalties)
```

### 5. Cluster into cross-list narratives

Group candidates into **narratives** when ALL three conditions hold:
- ≥2 tweets from ≥2 distinct lists
- shared ≥2 substantive keywords/entities (proper nouns, project names, ticker symbols, technical terms — ignore stop words)
- posted within the same 24h window

Each narrative gets a **narrative score** = sum of constituent tweet scores. Pick a one-line **narrative title** (≤80 chars) capturing what the cluster is collectively saying — e.g. "Anthropic releases Opus 4.7 — three lists pile in on agentic-eval results".

For each narrative, pick the **anchor tweet** (highest individual score) and up to 2 supporting tweets.

**Cluster-count cap**: if clustering produces fewer than 2 or more than 4 clusters, fall back to a flat ranked list with cluster labels inline (prepend each item with `[cluster-name]` when grouping would be informative, but do not emit the "🔗 Cross-list narratives" section).

### 6. Compose the digest

**Notification budget** (cap 4000 chars total):
- Up to **3 narratives** at the top, ranked by narrative score
- Then up to **5 standalone tweets per list** (highest individual score, not already in a narrative)
- Hard total cap of **12 items** across the whole digest — cut from the bottom of standalones if over

**Insight discipline**: every item must include a one-line **so-what** that adds context the tweet alone doesn't carry — the implication, the contrarian angle, the missing number, the deal-flow signal. A paraphrase ("@x said y") is not an insight and must be rewritten before sending.

**Quiet-list rule**: if a list's top surviving tweet has score < 2.0 (≈ <8 likes raw), write a one-line "quiet day" entry for that list rather than padding with low-signal items.

**Topic filter behavior**: when `TOPIC_FILTER` is set, it acts as a **scoring booster** (see step 4), NOT a hard filter. A list's top non-matching tweet still appears if it dominates on score; topic-matching tweets just get a thumb on the scale. Hard-filtering kills serendipity.

**Verdict line**: write one line at the very top capturing what today's lists collectively say. Examples:
- "Three lists piling in on the Opus 4.7 agentic-eval results; everything else is noise."
- "Slow day across all lists — only standout is @vitalik's MEV piece."
- "Crypto and AI lists diverging hard: AI lists locked on agent eval, crypto lists on Solana outage post-mortem."

### 7. Send the notification

Send via `./notify` (under 4000 chars total). Use the format below verbatim. Use `x.com/handle` (not `@handle`) to avoid pinging users on Telegram. Use Telegram Markdown link format `[label](url)`.

```
*List Digest — ${today}*

[VERDICT LINE — one line, ≤140 chars, plain text]

🔗 *Cross-list narratives*
1. *[narrative title]* — appeared on [List A] + [List B]
   x.com/handle: [insight, not paraphrase] (♥ likes, ↻ rt) — [View](url)
   x.com/handle2: [insight] (♥ likes, ↻ rt) — [View](url)

2. *[narrative title]* — appeared on [List A] + [List C]
   ...

*[List Name 1]*
- x.com/handle — [insight] (♥ likes, ↻ rt) — [View](url)
- x.com/handle — [insight] (♥ likes, ↻ rt) — [View](url)

*[List Name 2]*
- quiet day

---
sources: list1=ok | list2=quiet | list3=error(no-access)
status: LIST_DIGEST_OK
```

If `cross-list narratives` is empty, drop that whole section (don't print "(none)"). If every list is `quiet` or `empty`, send a single-line "*List Digest — ${today}* — quiet across all tracked lists" notification rather than padding.

### 8. Log and persist

Append to `memory/logs/$(date -u +%Y-%m-%d).md`:

```
## list-digest
- **Lists:** [count] tracked
- **Status:** LIST_DIGEST_OK | LIST_DIGEST_PARTIAL | LIST_DIGEST_EMPTY | LIST_DIGEST_NO_CONFIG
- **Per-list:** list1=ok(N) | list2=quiet(N) | list3=error
- **Verdict:** [verdict line]
- **Narratives:** [count] cross-list narratives
- **URLs reported:**
  - https://x.com/handle1/status/...
  - https://x.com/handle2/status/...
  - ...
```

**Update the persistent seen-file**: append every reported tweet URL (one per line) to `memory/list-digest-seen.txt`. Create the file if missing. This survives log rotation and prevents stale tweets from cycling back.

**Exit-mode taxonomy**:
- `LIST_DIGEST_NO_CONFIG` — `${var}` empty/invalid OR no fetch path available. Log only, no notify.
- `LIST_DIGEST_EMPTY` — every list returned 0 tweets OR every candidate was already in seen-file. Log only, no notify.
- `LIST_DIGEST_PARTIAL` — some lists succeeded, some failed. Notify with whatever survived; surface failures in source-status footer.
- `LIST_DIGEST_OK` — ≥1 list returned ≥1 fresh tweet. Notify.

## Sandbox note

The sandbox may block outbound `curl`. Prefer the pre-fetched cache (`.xai-cache/list-digest-{LIST_ID}.json`); fall back to the X.AI API; fall back to **WebSearch** as the last resort. For auth-required APIs, see CLAUDE.md's pre-fetch / post-process pattern.

## Environment Variables Required

- `XAI_API_KEY` — X.AI API key for Grok `x_search`. If missing, the skill degrades to WebSearch (lower quality).

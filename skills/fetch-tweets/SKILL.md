---
name: Fetch Tweets
description: Search X/Twitter for tweets about a token, keyword, username, or topic — clustered by sub-narrative
var: ""
tags: [social]
---
<!-- autoresearch: variation B — sharper output via clustering + signal line + insight extraction -->
> **${var}** — Search query for X/Twitter. **Required** — set your query in aeon.yml.

Today is ${today}. Search X for tweets matching **${var}** and produce a *curated* digest grouped by sub-narrative — not a flat chronological list.

## Steps

1. **Load previously-reported tweet URLs** from two sources, then union them into `SEEN_TWEETS`:
   - **Persistent seen-file** (`memory/fetch-tweets-seen.txt`) — if it exists, read all URLs.
   - **Last 3 days of `memory/logs/`** — grep each log file for lines matching `https://x.com/`.

   You'll use `SEEN_TWEETS` in step 5 to filter duplicates.

2. **Build the search prompt for Grok.** Pass `${var}` to Grok **verbatim** as the search query — let Grok interpret OR/AND operators in the var as-is. Do NOT narrow it to a single angle; broad coverage is the goal.

   Ask Grok to return **at least 15–20 candidate tweets** (you'll cull to ~7–10 in curation). Always require explicit engagement counts (likes, retweets, replies) so ranking is data-driven, not vibes.

3. **Search tweets.** Use whichever path is available, and **record which path produced the result** (you'll log it in step 6 as `SOURCE_PATH=cache|api|websearch`):

   **Path A — pre-fetched cache** (preferred, when the workflow ran `scripts/prefetch-xai.sh`):
   ```bash
   cat .xai-cache/fetch-tweets.json 2>/dev/null | jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'
   ```

   **Path B — X.AI API** (fallback, when `XAI_API_KEY` is set and cache is empty):
   ```bash
   FROM_DATE=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
   TO_DATE=$(date -u +%Y-%m-%d)
   curl -s -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $XAI_API_KEY" \
     -d '{
       "model": "grok-4-1-fast",
       "input": [{"role": "user", "content": "Search X for tweets about: ${var}. Date range: '"$FROM_DATE"' to '"$TO_DATE"'. Return at least 15-20 candidate tweets — mix of high-engagement posts and smaller accounts that add a distinct angle. For each tweet include: @handle, the full text, date posted, exact engagement counts (likes, retweets, replies — never N/A; if unknown, say 0), and the direct link (https://x.com/handle/status/ID). Return as a numbered list."}],
       "tools": [{"type": "x_search"}]
     }'
   ```
   Parse with: `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'`

   **Path C — WebSearch fallback** (use when both cache and `XAI_API_KEY` are unavailable):
   Use the built-in WebSearch tool with a query like `site:x.com "${query_terms}" after:${FROM_DATE}`. Note at the top of the log entry: "XAI_API_KEY not available; results compiled via WebSearch — quality lower than usual". WebSearch tends to favour high-engagement older tweets — **prioritise results dated within the last 48 hours**.

4. **Empty-data handling** (distinguish empty from error):
   - **Legitimate empty** (API returned 0 tweets, no results): log `FETCH_TWEETS_EMPTY (source=${SOURCE_PATH})` to `memory/logs/${today}.md` and **stop — no notification**.
   - **API/cache error** (HTTP error, malformed JSON, all paths failed): log `FETCH_TWEETS_ERROR (last_path=${SOURCE_PATH}, reason=...)` so skill-health can pick it up, and **stop — no notification**.

5. **Deduplicate against `SEEN_TWEETS` from step 1.** Compare each candidate URL against the set. Remove any tweet already reported. If ALL candidates are dupes: log `FETCH_TWEETS_NO_NEW: all results already reported` and **stop — no notification**.

6. **Curate — this is the new core step.** Don't dump all surviving tweets into the notification. Instead:

   a. **Cluster** the surviving candidates into 2–4 sub-narratives based on what they're actually claiming or discussing. Examples for a token query: "price action", "team announcement", "criticism/FUD", "ecosystem integration". Examples for a person query: "their new post", "responses to it", "unrelated activity". Pick cluster names that describe *the angle*, not the topic itself.

   b. **Within each cluster, rank by signal**, not just engagement. Signal = (likes + 2×retweets + replies) but **demote** tweets that are pure replies, generic shilling, or near-duplicate paraphrases of another already-included tweet. Drop tweets with <5 total engagement unless they come from an account that adds a unique angle.

   c. **Cap each cluster at 2–3 tweets** and total at **7–10 tweets**. Quality over quantity — if only 5 tweets pass the bar, send 5. Do not pad.

   d. **Extract the claim or signal** for each tweet — the summary should say *what's new or interesting*, not paraphrase the literal text. Bad: "User says token is going up." Good: "Calls out the team's silence on the postponed unlock — first major holder to do so publicly."

   e. **Compute a one-line signal** for the top of the notification: a single observation about the *shape* of the conversation. Examples: "Sentiment split — 4 bullish on the launch, 3 critical of the unlock terms." or "Mostly quiet — 6 of 7 tweets are from the same 3 accounts repeating yesterday's narrative." This is the most valuable single sentence for a reader scanning fast.

7. **Save the results** to `memory/logs/${today}.md`. Include for each kept tweet: URL, handle, engagement counts, the cluster it belongs to, and the source path used. Format:
   ```
   ### fetch-tweets (${var})
   - source_path: cache
   - signal: [the one-liner from step 6e]
   - cluster: [name]
     - https://x.com/handle/status/ID — likes:N rts:N replies:N — [insight summary]
   ```

7b. **Update the persistent seen-file** — append each new tweet URL (one per line) to `memory/fetch-tweets-seen.txt`. Create the file if it doesn't exist.

8. **Send a notification via `./notify`** with the curated, clustered output. Format:
   ```
   *Top Tweets — ${var} (${today})*
   _${signal_one_liner}_

   *${cluster_1_name}*
   1. x.com/handle — [insight summary]
   Likes: X | RTs: Y | Replies: Z
   [View tweet](https://x.com/handle/status/ID)

   2. x.com/handle — [insight summary]
   Likes: X | RTs: Y | Replies: Z
   [View tweet](https://x.com/handle/status/ID)

   *${cluster_2_name}*
   3. x.com/handle — [insight summary]
   ...
   ```

   IMPORTANT formatting rules:
   - Use `x.com/handle` (NOT `@handle`) so Telegram doesn't ping/tag users.
   - Each tweet MUST have a `[View tweet](URL)` link — required so users can tap to open it.
   - Use Telegram Markdown link format: `[link text](url)`.
   - The signal one-liner goes in italics (`_..._`) directly under the title.
   - Cluster headers use `*bold*`.

## Output shape note

This skill has no chain consumers as of this commit (no `consume: [fetch-tweets]` references). If a downstream chain step starts consuming this output, emit a flat list of URLs before the clustered output so consumers aren't broken by cluster headers.

## Sandbox note

Sandbox may block outbound curl. Path A (cache) avoids the issue entirely. If Path B is needed and curl fails, fall back to Path C (WebSearch) — it's a built-in Claude tool and bypasses the sandbox.

## Environment Variables Required

- `XAI_API_KEY` — X.AI API key (optional; skill falls back to WebSearch when not set, but quality is lower).

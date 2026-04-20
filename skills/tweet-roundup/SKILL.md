---
name: Tweet Roundup
description: Gist of the latest tweets on configurable topics
var: ""
tags: [social]
---

<!-- autoresearch: variation B — sharper output via signal scoring, sub-narrative clustering, and insight-per-item discipline -->

> **${var}** — Topic or X search query (e.g. "solana", "brain-computer interfaces", "@elonmusk"). If empty, uses topics from MEMORY.md, then built-in defaults.

Today is ${today}. Read memory/MEMORY.md for context.

## Steps

### 1. Load dedup set

Build `SEEN_TWEETS` (a set of URLs we've already reported) from two sources and union them:

- **Persistent seen-file** (`memory/tweet-roundup-seen.txt`) — read all URLs if present.
- **Last 3 days of `memory/logs/*.md`** — grep for lines containing `https://x.com/` to catch URLs not yet in the seen-file.

### 2. Resolve topic list

Priority order:

1. If `${var}` is set → `TOPICS=("${var}")` (single-topic mode).
2. Else if MEMORY.md has a `## Tweet Roundup Topics` section → use its bulleted lines, one query per line.
3. Else use the built-in defaults:
   - `artificial intelligence OR AI agents OR LLM`
   - `crypto OR bitcoin OR DeFi`
   - `technology OR startups OR open source`

### 3. Fetch per topic — with source-path observability

For each topic, track `SOURCE ∈ {cache, websearch, failed}` and a per-topic candidate list.

**Path A — pre-fetched cache (preferred):**

- Single-topic mode: read `.xai-cache/roundup-var.json`.
- Default/MEMORY.md mode: read any matching `.xai-cache/roundup-*.json` files; match by slugified topic name if the prefetch script supports it.

Parse with:
```bash
jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text' .xai-cache/roundup-*.json
```

If parsing yields text, `SOURCE=cache`. Extract each tweet's `@handle`, text, engagement counts (likes/retweets/replies if present), and permalink `https://x.com/<handle>/status/<id>`.

**Path B — direct X.AI curl:** Skipped. The sandbox blocks env-var-authenticated curl; do not attempt.

**Path C — WebSearch fallback** (when cache is missing or empty):
```
site:x.com "<topic keywords>" after:<YESTERDAY>
```
Always include the word "today" and `${today}` in the query to force fresh results. Discard any result whose visible date is older than 48h. Collect up to 5 candidates per topic. Mark `SOURCE=websearch`.

If both Path A and Path C return nothing for a topic, mark `SOURCE=failed`.

### 4. Score and filter

For each candidate, require:
- a known `@handle`
- a tweet URL of the form `https://x.com/<handle>/status/<id>` (if missing, keep the item but mark "link unavailable")
- posted within the last 48h
- URL **not** in `SEEN_TWEETS`

Compute `signal_score = likes + 2×retweets + replies`. If counts are unavailable (WebSearch path), use the search result rank as a weak proxy.

Demote (−50% score):
- replies to a parent tweet (we want primary posts, not threaded reactions)
- near-duplicates of a higher-scoring tweet in the same topic (>70% text overlap or same linked URL)

### 5. Curate per topic

After filtering + dedup, for each topic:

- **0 survivors** → drop the topic from output. Do NOT pad with filler or stale items.
- **1–3 survivors** → list them ranked by `signal_score`, highest first.
- **4+ survivors** → group into 2–3 sub-narratives (shared keywords, same entity, same underlying claim). Write one short line labeling each sub-narrative, then surface the top-1 tweet per narrative as the exemplar.

For each reported tweet, write an **insight** — what the tweet actually asserts, claims, reveals, or argues — not a paraphrase of the headline. If a tweet is just a bare link or a low-content reaction, either skip it or write the insight of the thing it links to (and mark it as a link).

Also write a one-line **conversation shape** per topic summarizing the vibe across survivors (e.g. "bullish momentum, dissenters quiet", "split opinion on X's launch", "single story dominating — Y").

### 6. Notify

If every topic dropped (nothing survived across all topics): log `TWEET_ROUNDUP_EMPTY` to `memory/logs/${today}.md` and **stop — do not notify**.

Otherwise send via `./notify` (≤4000 chars). Format:

```
*Tweet Roundup — ${today}*
_Source: cache:X websearch:Y failed:Z_

*[Topic 1]* — _conversation shape_
- x.com/handle — insight (signal: 12.3k) [View](https://x.com/handle/status/ID)
- x.com/handle — insight (signal: 4.1k) [View](https://x.com/handle/status/ID)

*[Topic 2]* — _conversation shape_
- x.com/handle — insight (signal: 8k) [View](https://x.com/handle/status/ID)
```

Formatting rules:
- Use `x.com/handle`, **never** `@handle`. On Telegram, `@handle` pings the user; `x.com/handle` links the profile cleanly.
- Every surviving tweet gets a `[View](URL)` link. If the URL is unavailable, drop the `[View]` and say "(link unavailable)".
- Show `signal: <score>` only when engagement counts were available (cache path). Omit silently on the WebSearch path.

### 7. Persist and log

- Append each reported tweet URL (one per line) to `memory/tweet-roundup-seen.txt`. Create the file if missing. This ensures these URLs stay excluded from all future runs, regardless of log rotation.
- Log to `memory/logs/${today}.md`:
  ```
  ## Tweet Roundup
  - topics: [topic1: N tweets, topic2: M tweets, topic3: 0 (dropped)]
  - source: cache:X websearch:Y failed:Z
  - urls: <list of reported URLs>
  ```

## Sandbox note

The sandbox blocks outbound curl with `$XAI_API_KEY` in headers — always use the pre-fetched `.xai-cache/roundup-*.json` files or the WebSearch fallback. Do not attempt direct curl to `api.x.ai` at runtime. To add a new default-topic cache file, edit `scripts/prefetch-xai.sh` (the workflow runs prefetch outside the sandbox, where env-var auth works).

## Constraints

- Never notify an empty roundup — silence beats filler.
- Never `@handle` anyone in notifications (Telegram ping hazard).
- Never report a URL already in `SEEN_TWEETS`.
- Preserve the original skill's core purpose: a gist of the latest X chatter on configurable topics.

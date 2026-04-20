---
name: Reply Maker
description: Generate two reply options for 5 tweets from tracked X accounts or topics
var: ""
tags: [social]
---
<!-- autoresearch: variation B — sharper output via specificity gates, anti-sycophancy lint, post-write self-edit, and skip-gate for low-leverage tweets -->

> **${var}** — Focus on a specific topic, @handle, or X list ID. If empty, searches for reply-worthy tweets across your areas of interest using recent logs and memory.

Read `memory/MEMORY.md` for context.
Read the last 2 days of `memory/logs/` for recent list-digest, tweet-roundup, and prior reply-maker outputs.

## Voice

If soul files exist (`soul/SOUL.md`, `soul/STYLE.md`, `soul/examples/`), read them and **mirror that voice in every reply**. Match sentence length, vocabulary choices, punctuation habits, and the kinds of things the operator would never say.

If no soul files exist (or the bodies are empty placeholders), write replies that are:
- Direct and substantive — no fluff, no sycophancy
- Under 280 characters each
- Opinionated but grounded in specifics
- The kind of reply that adds to the conversation, not noise

## Steps

### 1. Gather candidate tweets

Goal: assemble **10–15 candidates** posted in the **last 6 hours** (the high-leverage reply window — algorithm rewards early replies, and the OP is still likely to engage back). **Recency fallback:** if the 6h window yields fewer than 3 candidates after the skip gate, widen to **12h** and retry before failing the run.

For every candidate, capture: `@handle`, full tweet text, tweet URL, `posted_at` (ISO), engagement counts (likes, replies, retweets if available), and a one-line **why-this-tweet** note.

Strategy depends on `${var}`:

**If `${var}` looks like an X list ID** (numeric):
```bash
TO_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FROM_DATE=$(date -u -d "6 hours ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-6H +%Y-%m-%dT%H:%M:%SZ)
LIST_ID="${var}"

curl -s -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "input": [{"role": "user", "content": "Look at X list https://x.com/i/lists/'"$LIST_ID"'. Return the 12 most reply-worthy original posts (not retweets, not replies) by members of this list between '"$FROM_DATE"' and '"$TO_DATE"'. Reply-worthy = has a take, claim, question, or framing worth engaging — NOT pure self-promo, breaking news without analysis, or threads already past 500 replies. For each: @handle, full tweet text, tweet URL, posted_at ISO timestamp, like/reply/retweet counts."}],
    "tools": [{"type": "x_search", "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'"}]
  }'
```

**If `${var}` looks like a `@handle`**: same call, scoped to that handle's recent original posts.

**If `${var}` is a topic** (or empty): same call with `${var}` (or top 2–3 topics from `memory/MEMORY.md`) as the search query. When empty, also pull tweet candidates surfaced in the last 2 days of `tweet-roundup` and `list-digest` logs as a backup pool.

**Fallback chain** (use in order until you have ≥3 candidates):
1. XAI x_search (above)
2. Recent `list-digest` + `tweet-roundup` outputs in `memory/logs/` — already have URLs and handles
3. WebSearch for very recent posts on memory topics (filter: posted within last 6h, original post not reply)

The memory logs are the most reliable source since they're already fetched — prefer them over retrying a blocked API.

### 2. Filter and select 5 tweets

Apply the **skip gate** first. **Discard** any candidate that is:
- Pure self-promo (launching a product, "buy my course", subscribe links)
- Breaking-news repost without an angle of its own
- A thread already past ~500 replies (your reply will not be seen)
- Older than 6 hours (reply window has closed; don't waste a reply slot)
- A handle/URL already replied to in the last 7 days of reply-maker logs (no duplicates)

From the survivors, **rank by leverage** = `recency × take-strength × room-to-add`:
- **Recency**: minutes-ago > hours-ago. Tweets <60min old are top priority.
- **Take-strength**: a clear claim/question/framing you can either reinforce with evidence or challenge with a flipped premise.
- **Room-to-add**: not already swarmed; thread isn't full of stronger replies; you have actual context to contribute.
- Bias toward authors whose audience overlaps your interests (from `memory/MEMORY.md`) — replies on those accounts get seen by people who care about the same things.

Pick the **top 5**. If fewer than 5 survive the gate, output what you have and add `REPLY_MAKER_DEGRADED` to the notification subject line.

### 3. Generate two replies per tweet

For each of the 5 selected tweets, draft **two reply options** with distinct angles:

**Option A — "Evidence add"**
- Builds on their point with a **specific** datum, named project, named person, concrete number, link, or counterexample they didn't include
- Tone: collaborative, substantive, calmly confident
- Must contain at least one named entity, number, or specific reference — vague "great insight, here's another angle" is banned

**Option B — "Frame challenge"**
- States the premise you're pushing back on **explicitly** (one short clause), then offers the contrarian angle, flipped framing, or sharper read
- Tone: direct, opinionated, not contrarian-for-its-own-sake
- Must contain the actual disagreement, not a hedge — vague "interesting, but have you considered..." is banned

#### Hard reply rules (apply to both A and B)

- **≤ 280 characters** including any handle prefix
- **No sycophancy** — see the `## Banned sycophancy phrases` section below. Any draft containing a banned phrase must be rewritten.
- **No hedging stacks** — "It could be argued that…", "Just my two cents but…", "Maybe I'm wrong but…" — pick a position
- **Specifics, not gestures** — names, projects, numbers, links. If you can't cite one, don't write the reply
- **Stand alone** — readers may not see the original tweet; reply must make sense on its own
- **Match soul voice** if soul files are populated

#### Self-edit pass (do this for every reply before finalizing)

For each draft reply, score 1–5 on each:
- **Specific**: cites a name/number/project/claim?
- **Standalone**: makes sense without reading the parent?
- **Non-sycophantic**: passes the banned-phrase list?
- **Voice-matched**: sounds like the soul files (or neutral-direct if no soul)?

If any score is < 4, **rewrite that reply once** before moving on. If the rewrite still scores < 4, drop that tweet from the list and pull the next-ranked candidate from step 2.

### 4. Notify

Send via `./notify` with this format (link first so the operator can open the source quickly):

```
*Reply Maker — ${today}*

*1.* https://x.com/handle/status/123  (@handle, 42m ago, 18💬)
> [first ~80 chars of tweet]…
why: [one-line reason this is reply-worthy]
A: [evidence-add reply]
B: [frame-challenge reply]

*2.* …
… (5 total, or fewer with REPLY_MAKER_DEGRADED if skip gate trimmed below 5)

source-status: xai=ok|fail|skip, memory=N, websearch=ok|fail|skip
```

If zero candidates survive the skip gate from any source, send a single `REPLY_MAKER_EMPTY — [one-line reason]` notification and stop.

### 5. Log to `memory/logs/${today}.md`

```
## Reply Maker
- **Var:** ${var:-<empty>}
- **Candidates collected:** N
- **Survived skip gate:** N
- **Replies generated:** N×2
- **Handles:** @h1, @h2, …
- **Source status:** xai=ok|fail|skip, memory=N, websearch=ok|fail|skip
- **Notification:** sent | degraded | empty
- **Tweet URLs:** [list, for future-day dedup]
```

The `Tweet URLs` line is what tomorrow's run reads to avoid duplicate replies — keep it consistent.

## Banned sycophancy phrases

Edit this list as tastes change — any draft reply containing one of these (openings or closings) must be rewritten:

- Openings: "Great point", "Love this", "100%", "This 👆", "Couldn't agree more", "So well said", "💯"
- Closings: "Curious to hear your thoughts!" (engagement-hook noise)

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs (XAI), use the pre-fetch pattern: write request JSON to `.xai-cache/reply-maker-${date}-${hour}.json` if you build a prefetch script later, or fall through to the memory/WebSearch fallback chain.

## Environment Variables Required

- `XAI_API_KEY` — X.AI API key for Grok x_search (optional — falls back to WebSearch + memory logs)

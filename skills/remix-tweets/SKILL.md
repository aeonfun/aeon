---
name: Remix Tweets
description: Fetch ~30 older tweets, pre-filter for remixability, then produce 10 new rephrased versions across diverse strategies with post-write quality gates
var: ""
tags: [social]
---
<!-- autoresearch: variation B — sharper output via remixability pre-filter, strategy-rotation, skip-gate for un-remixable originals, post-write self-edit; folded in A's multi-angle queries + engagement counts and C's source-status footer + OK/EMPTY/ERROR branching -->

> **${var}** — Override time window. Accepts `30d`, `180d`, `1y`, or a date range `YYYY-MM-DD:YYYY-MM-DD`. Defaults to `180d` (30-180 days ago window, see step 1).

Read `memory/MEMORY.md` for context on current topics and recent thinking.
Scan the last 14 days of `memory/logs/` for any "Remix Tweets" entries and collect every tweet URL ever remixed — that's the persistent dedup set.

## Voice

If a `soul/` directory exists and is populated, read for voice calibration:
1. `soul/SOUL.md` — identity, worldview, opinions
2. `soul/STYLE.md` — writing style, sentence structure, anti-patterns
3. `soul/examples/tweets.md` — rhythm and tone calibration (if present)

Otherwise, match the tone of the originals fetched in step 1.

## Steps

### 1. Fetch ~30 older tweets (over-fetch for filtering)

We over-fetch so the remixability pre-filter (step 2) has room to drop un-remixable candidates without reducing the output count below 10.

**First, check the pre-fetch cache** (the workflow pre-fetches XAI results outside the sandbox):
- Read `.xai-cache/remix-tweets.json`. If it exists and contains tweet content, parse it and skip to step 2. Log `cache=hit`.

**If no cache**, resolve the time window and call the XAI API directly:

```bash
TIME_WINDOW="${var:-180d}"

if echo "$TIME_WINDOW" | grep -q ':'; then
  FROM_DATE=$(echo "$TIME_WINDOW" | cut -d: -f1)
  TO_DATE=$(echo "$TIME_WINDOW" | cut -d: -f2)
else
  DAYS=$(echo "$TIME_WINDOW" | sed 's/[^0-9]//g')
  UNIT=$(echo "$TIME_WINDOW" | sed 's/[0-9]//g')
  [ "$UNIT" = "y" ] && DAYS=$((DAYS * 365))
  FROM_DATE=$(date -u -d "$DAYS days ago" +%Y-%m-%d 2>/dev/null || date -u -v-${DAYS}d +%Y-%m-%d)
  TO_DATE=$(date -u -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-30d +%Y-%m-%d)
fi
```

Resolve the X handle. Look up in this order: (a) `$X_HANDLE` env var, (b) handle mentioned in `soul/SOUL.md` under "Identity", (c) abort with `REMIX_TWEETS_ERROR — no handle configured`.

Run **two angled x_search queries** so the pre-filter has a diverse pool — don't rely on one query shape:

- **Query 1 — opinion posts** (most remixable): original tweets that state a take, opinion, or principle (not news-tied, not announcements).
- **Query 2 — standout posts** (high engagement = proven): top-engagement original tweets in the window.

Each query must request for every tweet: full text, date posted, engagement stats (likes, retweets, replies), and the direct `https://x.com/HANDLE/status/ID` link. Ask explicitly for **original posts only** (not replies, not retweets, not quote tweets). Aim for ~15-20 tweets per query.

```bash
# Replace HANDLE with the resolved handle
curl -s -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "input": [{"role": "user", "content": "Search X for original tweets (exclude replies, retweets, quote tweets) posted by @HANDLE from '"$FROM_DATE"' to '"$TO_DATE"'. I want OPINION/TAKE posts — tweets that state a view, principle, or observation (not news announcements, not project updates, not single-link posts). Return up to 15. For each: full tweet text, date (YYYY-MM-DD), likes, retweets, replies, direct link https://x.com/HANDLE/status/ID. Format as numbered list."}],
    "tools": [{"type": "x_search", "allowed_x_handles": ["HANDLE"], "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'"}]
  }'
```

Then repeat with a second body varying the prompt to "top-engagement original tweets (highest likes+retweets) in the same window. Return up to 15."

Deduplicate by tweet ID across both queries. Log `xai=ok` / `xai=partial` / `xai=fail` based on how many queries returned data.

**Sandbox fallback**: if curl fails, use WebFetch against `https://api.x.ai/v1/responses` with the same POST body (the built-in WebFetch tool bypasses the sandbox).

### 2. Remixability pre-filter (drop before remixing)

Drop any candidate that matches any of these — these rarely yield a remix worth posting:

- **Persistent dedup**: tweet URL appears anywhere in `memory/logs/*.md` under "Remix Tweets" → drop.
- **Reply/RT/quote leakage**: text starts with `@handle`, has `RT @`, or is clearly a reply/quote snippet.
- **Link-only / media-only**: text is just a URL, or <20 chars of prose around a URL.
- **News-tied / dated**: references a specific event by name, a dated product launch, or named individuals in a way that wouldn't land today (e.g., "thoughts on OpenAI's Dev Day"). Exception: if the insight is clearly evergreen and the name is incidental, keep.
- **Thread fragment**: ends with `👇`, `(1/n)`, `continued...`, or begins with a number like `2.` / `3/` — remixing a fragment strips context.
- **Meta-tweet**: "new follower milestone", "follow me for…", tweet about the account itself.
- **Non-insight humor**: jokes that depend on specific current context a reader today wouldn't have.

After filtering, you should have ≥10 candidates. If <10, fall back to **relaxing only the news-tied rule** for the least-dated candidates. If still <10, emit `REMIX_TWEETS_DEGRADED` (see step 6) and produce however many pass.

From survivors, select **exactly 10** prioritizing: (a) topical diversity (no two on the same narrow subject), (b) broader appeal (engagement as a tiebreaker, not primary filter — we care about remixability, not popularity).

### 3. Assign strategies (rotation enforced)

Before writing any remix, assign each of the 10 selected originals a **remix strategy**. The 10 assignments must span **at least 6 distinct strategies** from the list below (prevents all-sharpen laziness). No strategy may be used more than 3 times.

- **Sharpen** — wordy original compressed into a one-liner.
- **Flip the frame** — same insight from the opposite direction.
- **Update** — take still holds, ground in today's context.
- **Escalate** — mild original made spicier.
- **Soften** — hot take restated as an observation that leads the reader there.
- **Concretize** — abstract original with a specific example or data point.
- **Abstract** — specific original zoomed to the general principle.

Match strategy to original — don't force Escalate on an already-spicy take.

### 4. Write remixes

For each of the 10, draft a **new tweet** (not a paraphrase) that:
- Captures the core idea of the original.
- Uses **substantially different words and framing** (target ≥60% new vocabulary vs. the original).
- Stands alone — nothing in it should read as "this is a rewrite".
- Stays ≤280 characters.
- Matches voice (soul files or the originals' tone).

**Voice rules:**
- First person.
- Short sentences. Em dashes over commas. No semicolons.
- State the opinion first, reasoning after (if any).
- No hedging. No corporate voice. No hashtags. No emojis.

### 5. Post-write quality gate (self-edit pass)

For each remix, run this checklist. **Rewrite if any item fails.** If rewrite still fails after one attempt, **drop the tweet and replace it** with a different un-remixed survivor from step 2 (assign a fresh strategy).

1. **Specificity** — does it say something (not vague platitude)? The claim/take must be pin-pointable in one sentence.
2. **Novelty** — ≥60% of content words differ from the original. If <60%, it's a paraphrase, not a remix.
3. **Length** — ≤280 chars including spaces.
4. **No banned phrases** — remove any of: "at the end of the day", "let's be real", "hot take", "unpopular opinion", "in today's world", "as we all know", "just my two cents", "food for thought", "thread 🧵".
5. **Standalone** — reads naturally without knowing the original existed.
6. **Would-I-post-this test** — self-score 1-5. If <4, rewrite once; if rewrite is still <4, drop and replace.

Track drops in the log (step 7). If you drop more than 3, emit `REMIX_TWEETS_DEGRADED`.

### 6. Output & Notify

Lead with a one-line **batch verdict** summarizing strategy spread (e.g., "3 sharpens, 2 flips, 2 updates, 2 concretizes, 1 escalate"). Keep the whole message ≤4000 chars. No leading indentation.

Send via `./notify`:
```
*Remix Tweets — ${today}*
Batch: [one-line strategy spread]. Drops: N.

1. *[strategy]*
[original excerpt ≤80 chars] → [remix]

2. *[strategy]*
[original excerpt ≤80 chars] → [remix]

... (all 10, or fewer if DEGRADED)

source: cache=hit|miss, xai=ok|partial|fail, fetched=N, kept=N, drops=N
```

**Status branching** (prepend to the notify body as the first line instead of `Batch:`):
- `REMIX_TWEETS_OK` — 10 remixes produced, ≤3 drops.
- `REMIX_TWEETS_DEGRADED` — <10 produced OR >3 drops. Include cause.
- `REMIX_TWEETS_EMPTY` — XAI returned no usable tweets in the window. Notify once with cause and stop.
- `REMIX_TWEETS_ERROR` — no handle configured OR both XAI queries failed AND WebFetch fallback failed. Notify cause and stop.

### 7. Log

Append to `memory/logs/${today}.md`:
```
## Remix Tweets
- **Status:** OK | DEGRADED | EMPTY | ERROR
- **Source window:** FROM_DATE to TO_DATE
- **Fetched:** N (cache=hit|miss, xai=ok|partial|fail)
- **Kept after pre-filter:** N
- **Remixes produced:** N (drops: N)
- **Strategy spread:** e.g. Sharpen ×3, Flip ×2, Update ×2, Concretize ×2, Escalate ×1
- **Original tweets used:**
  1. "tweet text excerpt" — @HANDLE, DATE (URL) [strategy]
  2. ...
```

The URL list above is the canonical dedup source — every subsequent run reads these URLs back and drops any re-appearance (persistent dedup).

Save the fetched originals (even the filtered-out ones) to `memory/topics/tweet-archive.md` (append, deduplicated by URL) so other skills (article, write-tweet) can reference them as source material.

## Sandbox note

The sandbox may block outbound curl for auth-required endpoints. Two fallbacks:
1. Pre-fetch cache at `.xai-cache/remix-tweets.json` (populated by `scripts/prefetch-*.sh` before Claude runs).
2. Built-in **WebFetch** tool against the XAI endpoint if curl fails at runtime.

## Constraints

- Never post remixes directly — this skill only drafts. Operator reviews via notification.
- Never remix a URL already in persistent dedup.
- Never output fewer than 10 without emitting `REMIX_TWEETS_DEGRADED` with a cause.

## Environment Variables Required
- `XAI_API_KEY` — X.AI API key for Grok x_search.
- `X_HANDLE` (optional) — X handle to search. Falls back to `soul/SOUL.md` Identity section if unset.

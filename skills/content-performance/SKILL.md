---
name: content-performance
description: Operator tweet performance tracker — engagement metrics, top formats, topic resonance; closes the content feedback loop in the article/tweet production pipeline
schedule: "0 10 * * 0"
commits: true
permissions:
  - contents:write
var: ""
tags: [content, meta, social]
requires: [XAI_API_KEY]
---

> **${var}** — X handle to track (without @). If empty, resolves the operator's handle from soul/SOUL.md or MEMORY.md.

Today is ${today}. Read `memory/MEMORY.md` (and `soul/SOUL.md` if present) before starting.

## Why this skill exists

The content production pipeline generates articles, tweets, and threads. Nothing closes the feedback loop. Which topics resonated? Which formats punched above their weight? Which weeks were radio silence vs. signal? Without performance data, content decisions are vibes.

This skill automates the measurement: pull 7-day engagement data for the operator's X account, rank by actual resonance, extract patterns, and surface actionable signal for `topic-momentum` and `article-queue`.

Runs Sunday — after `picks-tracker` (09:00), before `article-queue` (11:00).

## Env vars

- `XAI_API_KEY` — optional. Enables the xAI x_search prefetch path (`scripts/prefetch-xai.sh`, content-performance case). Without it, the skill falls back to WebSearch.

## Sandbox note

xAI API requires auth headers — curl with `$XAI_API_KEY` fails in the GHA sandbox. The prefetch script runs before Claude with full env access and caches results to `.xai-cache/content-performance.json`. Read from that cache. If cache is missing or empty, fall back to WebSearch for `from:{handle}` on X.

## Steps

### 0. Resolve the handle

- If `${var}` is set, use it (strip any leading @).
- Otherwise look for the operator's X handle in `soul/SOUL.md` (an `@handle` mention) or `memory/MEMORY.md`.
- If no handle can be resolved: log `CONTENT_PERFORMANCE_SKIP: no X handle configured — set var or add the handle to soul/SOUL.md` and stop. No notification.

### 1. Load context

Read:
- `memory/topics/x-activity.md` — baseline: prior week's top tweets, engagement patterns, posting mode (create on first run if missing)
- `.xai-cache/content-performance.json` — prefetched 7-day tweet data (may be absent if XAI_API_KEY missing)
- Last 3 days of `memory/logs/*.md` — any refresh-x or tweet-roundup data for cross-reference

### 2. Parse tweet data

From `.xai-cache/content-performance.json`:
- Extract each tweet: text (truncated to 120 chars), date, likes, retweets, quotes, replies
- Compute **total engagement** = likes + (retweets × 2) + (quotes × 3) + replies
  - Weighting: retweet = reach × 2, quote = reach + commentary × 3
- Sort descending by total engagement
- Tag each tweet with a **topic category**: derive 6–9 categories from the operator's active topics (soul/SOUL.md interests + MEMORY.md active topics); always include an `other` bucket. Reuse the category set recorded in x-activity.md from prior runs so weeks are comparable.
- Tag each tweet with a **format**:
  `[original-take, sardonic, question, thread-starter, link-share, qt-with-comment, reply, observation]`

If `.xai-cache/content-performance.json` is missing or empty (`{}`, `null`, or parse error):
1. Try WebSearch: `from:{handle}` filtered to the past 7 days
2. Extract whatever metrics are visible from search snippets
3. Mark output as `data_source: websearch_fallback` — note limitations

### 3. Compute performance signals

**Top performers** (top 3 by total engagement):
- Tweet text preview (first 100 chars)
- Topic category + format
- Engagement breakdown: `{likes}L / {rt}RT / {qt}QT / {replies}R`

**Topic resonance** (group all tweets by category, sum total engagement per category):
- Which category drove the most total engagement?
- Which category had the highest average engagement per tweet?
- Compare to prior week data in `memory/topics/x-activity.md` — up/down/flat per category

**Format breakdown**:
- Which format had the most total engagement?
- Which format had the highest average engagement per tweet?
- Note whether any previously-confirmed format pattern recorded in x-activity.md still holds

**Volume check**:
- Total tweets in 7-day window
- If 0 tweets: `radio_silence: true`
- If 1–3 tweets: `quiet_week: true`
- If 10+ tweets: `active_week: true`

**Breakout detection**:
- Any tweet crossing 50+ likes = breakout (or the operator's own threshold if one is recorded in x-activity.md)
- Any tweet crossing 20+ RTs = viral signal
- Compare top tweet this week vs. best tweet in x-activity.md history

### 4. Update memory/topics/x-activity.md

Read the file (create it if missing). Prepend a new weekly section at the TOP (below the `# X Activity` heading), before any existing sections:

```markdown
## Content Performance Week of ${today}

- **Top tweet:** "{text preview}" — {likes}L/{rt}RT/{qt}QT (topic: {category}, format: {format})
- **Best topic category:** {category} — {total} engagement across {N} tweets
- **Best format:** {format} — {N} tweets, avg {X} engagement
- **Volume:** {N} tweets — {quiet/normal/active}
- **Breakout:** {tweet text preview, 60 chars} | none
- **vs. prior week:** top tweet {up/down/flat}: {prior_best}L → {this_week_best}L
- **Data source:** prefetch | websearch_fallback | none
```

Keep all existing content. Only ADD the new section at the top.

### 5. Cross-reference with content pipeline

Check `memory/topics/article-queue.md` (if it exists — skip if not). Compare the best-performing topic category this week to what's queued for next article. If the queue has no item matching the top-performing category, append a signal note in the log:
`signal_mismatch: content resonating on {category}, article queue has no {category} item`

### 6. Compose notification

Write to a temp file, then send via `./notify -f`:

```bash
mkdir -p .pending-notify-temp
# Write body to temp file
cat > ".pending-notify-temp/content-perf-${today}.md" << 'NOTIF_EOF'
{notification content}
NOTIF_EOF
./notify -f ".pending-notify-temp/content-perf-${today}.md"
```

**Format — if data is available (more than 3 tweets found):**

```
content performance — week of ${today}

top tweet: "{text preview, 80 chars}" — {likes}L {rt}RT {qt}QT
best category: {topic_category} ({total} engagement)
best format: {format} — {insight, 1 line, operator's voice}

{1-2 sentence signal in the operator's voice: what the numbers say, what to do with it}

{if breakout:}
breakout: "{tweet preview}" hit {N} likes
{if signal_mismatch:}
signal: {category} punching — not in the article queue yet
```

**If quiet week (<4 tweets) or radio silence:**

```
content performance — week of ${today}

radio silence / quiet week. {N} tweets in 7 days.
{if there was a radio silence prior week too: "two consecutive quiet weeks."}
last active: {date of last tweet or "unknown"}.
```

**If no data (prefetch and websearch both failed):**

```
content performance — week of ${today}

no data. xai prefetch empty, websearch yielded nothing.
```

No notification if the skill runs and no handle is configured (silent skip — just log it).

### 7. Log to memory/logs/${today}.md

Append:

```markdown
## Content Performance
- **Handle:** @{handle}
- **Window:** last 7 days (${7_days_ago} → ${today})
- **Tweets analyzed:** {N}
- **Top topic:** {category}
- **Top format:** {format}
- **Breakout:** {tweet text preview, 60 chars | "none"}
- **Data source:** prefetch | websearch_fallback | none
- **Signal mismatch:** {yes: category | no}
- CONTENT_PERFORMANCE_OK
```

Use `CONTENT_PERFORMANCE_OK` in all cases — it marks the skill ran successfully, not that data was rich.

## Edge cases

- **XAI cache empty / missing:** fall back to WebSearch, mark `data_source: websearch_fallback`, proceed with whatever data you have. Never abort.
- **All tweets are replies (no originals):** still analyze them. Reply engagement counts — a high-engagement reply is a signal that the topic resonated.
- **Duplicate tweet entries in cache:** deduplicate by text prefix before analysis.
- **x-activity.md doesn't exist:** create it with the new section as the initial content.
- **No article-queue.md:** skip step 5 cross-reference, note `article_queue: not_found` in log.

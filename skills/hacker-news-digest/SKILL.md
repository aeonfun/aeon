---
name: Hacker News Digest
description: Top HN stories filtered by interests, with comment-mined insights and themed clustering
var: ""
tags: [research]
---
<!-- autoresearch: variation B — sharper output via comment-mining + themed clustering, on top of higher-signal sources (beststories + Algolia front_page) and a 7-day dedup cache -->

> **${var}** — Optional topic filter (e.g. `ai-agents`, `crypto`, `security`). If empty, uses interests from MEMORY.md.

If `${var}` is set, weight stories matching that topic more heavily but still include 1–2 high-signal off-topic items so the digest stays well-rounded.

## Context

1. Read `memory/MEMORY.md` for tracked topics and interests.
2. Read the last 2 days of `memory/logs/` and `.cache/hn-seen-ids.json` (if present) to skip stories already covered. The cache file is auto-created; safe to delete to reset dedup.

## 1. Gather candidates

Aim for ~40 candidate stories. Hit these sources, dedupe by id:

a. **Best stories** (longer-term quality ranking, less recency-biased than topstories):
   ```bash
   curl -s "https://hacker-news.firebaseio.com/v0/beststories.json" | jq '.[0:30][]'
   ```

b. **Algolia front_page** — prefiltered, returns full metadata inline (one call):
   ```bash
   curl -s "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30"
   ```

c. **If `${var}` is set**, topic-targeted Algolia search (last 36h, points>30):
   ```bash
   SINCE=$(date -d '36 hours ago' +%s)
   QUERY=$(printf %s "${var}" | jq -sRr @uri)
   curl -s "https://hn.algolia.com/api/v1/search?query=${QUERY}&tags=story&numericFilters=created_at_i>${SINCE},points>30&hitsPerPage=20"
   ```

For Firebase ids without metadata, hit `https://hacker-news.firebaseio.com/v0/item/${ID}.json`. If any curl call fails (sandbox can block outbound), retry the same URL with **WebFetch**.

## 2. Score and rank

For each candidate, compute a composite signal:

```
score      = points + 1.5 * comments − age_penalty + topic_bonus
age_penalty = max(0, hours_since_post − 12) * 2
topic_bonus = +30 if matches ${var} or a MEMORY.md interest
```

Drop anything with `score < 80` after penalties. Drop anything whose id appears in `.cache/hn-seen-ids.json` from the last 7 days. Drop job posts (`type=job`) and pure poll results.

## 3. Cluster into themes

Group surviving stories into 2–4 themes — common buckets: `AI & agents`, `Infra & devtools`, `Security & policy`, `Science & culture`, `Business & funding`. If a theme has only one story, fold it into a `Misc` bucket.

Pick **5–7 stories total**, distributed across themes (max 3 per theme). Within a theme, take the highest scoring story plus one runner-up only if it's substantively different (different sub-topic, not just another take on the same news).

## 4. Mine comments for insight

For each chosen story, fetch the discussion thread:

```bash
curl -s "https://hn.algolia.com/api/v1/items/${ID}"
```

Extract the single most insightful comment. A good insight comment:
- length > 200 chars
- contains specific facts, numbers, code, or substantive critique (not generic agreement)
- ideally challenges, extends, or contextualizes the article
- skip "this", "+1", "lol", and obvious low-effort replies

If the comment thread is thin (<10 comments), skip the HN take and add a 1-line *Author claim* line from the article URL via WebFetch instead.

## 5. Format and send

Lead with a one-line **signal line** describing the day's shape (e.g. _"Heavy AI-tooling day — 3 of 7 are agent infra; one acquisition story and a kernel CVE round it out."_).

Output is a **flat numbered list** (not nested per-theme sections) — each entry carries its cluster label inline so downstream consumers can parse it linearly:

```
*HN Digest — ${today}*

_${signal_line}_

1. **[AI & agents]** [Title](url) — 412 pts · 287 comments
   Why it matters: 1 sentence on the actual claim or news.
   HN take: "single quoted insight from a top comment" — _commenter_
   [Discussion](https://news.ycombinator.com/item?id=ID)

2. **[Infra & devtools]** ...
```

Hard constraints:
- under 4000 chars total
- max 7 stories
- every entry has both *Why it matters* and (*HN take* OR *Author claim*) — no headline-only entries
- no marketing language; if a comment quote runs >220 chars, trim with ellipsis

Send via `./notify "$(cat digest.md)"` (or pipe directly).

## 6. Persist and log

Write all included story ids to `.cache/hn-seen-ids.json` as `{ "id": <unix_ts>, ... }` (auto-created; safe to delete to reset dedup). On each run, prune entries older than 7 days before writing.

Append to `memory/logs/${today}.md`:

```
### hacker-news-digest
- Var: ${var:-default}
- Sent ${N} stories across ${M} themes (${theme list})
- Top story: [title] (${pts}pts, ${comments}c)
- Skipped ${K} as already-seen via .cache/hn-seen-ids.json
```

If after filtering and dedup zero stories remain, log `HN_DIGEST_EMPTY: <reason>` (e.g. _"all 12 candidates already sent in last 7 days"_) and **do not** call `./notify`. Empty digests are noise.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch above. Both Firebase HN (`hacker-news.firebaseio.com`) and Algolia HN (`hn.algolia.com`) are public — no auth, no env vars in headers — so neither pre-fetch nor post-process patterns are required.

---
name: Vibecoding Digest
description: Decision-ready pulse of r/vibecoding — ranked by signal score, narrative-clustered, with a one-line verdict and tools leaderboard
var: ""
tags: [content]
---
<!-- autoresearch: variation B — sharper output via signal scoring + verdict + narrative clusters + tools pulse + insight discipline -->

> **${var}** — Time window: `day` (default), `week`, or `month`. Controls Reddit's `?t=` sort period. Anything else → treat as `day`.

Read `memory/MEMORY.md` for context.
Read the last 2 days of `memory/logs/` to avoid repeating posts already covered.
Load `memory/seen-vibecoding.txt` if present (one post ID per line, last 200) — dedup against it.

## Data source

Reddit JSON API (no auth). Append `.json` to any Reddit URL. Use `old.reddit.com` — it's lighter, more stable, and less likely to be JS-rate-limited than `www.reddit.com`.

**User-Agent (required):** `web:aeon-vibecoding-digest:1.0 (by /u/aeonbot)` — Reddit's preferred format. Default/generic UAs get 429'd fast.

Endpoints:
- `https://old.reddit.com/r/vibecoding/top.json?t={window}&limit=30` — top by score in window
- `https://old.reddit.com/r/vibecoding/hot.json?limit=30` — currently hot
- `https://old.reddit.com/r/vibecoding/rising.json?limit=15` — rising (catches momentum before top)
- `https://old.reddit.com/r/vibecoding/comments/{post_id}.json?sort=top&limit=15&depth=2` — comments

Fields to keep per post: `id`, `title`, `selftext`, `score`, `num_comments`, `upvote_ratio`, `author`, `created_utc`, `permalink`, `link_flair_text`, `is_self`, `domain`, `url`, `stickied`.

## Steps

### 1. Fetch three sorts

```bash
TIME_WINDOW="${var:-day}"
case "$TIME_WINDOW" in day|week|month) ;; *) TIME_WINDOW="day" ;; esac
UA="web:aeon-vibecoding-digest:1.0 (by /u/aeonbot)"

mkdir -p /tmp/vc
STATUS_TOP=fail STATUS_HOT=fail STATUS_RISING=fail

curl -fsSL -H "User-Agent: $UA" \
  "https://old.reddit.com/r/vibecoding/top.json?t=$TIME_WINDOW&limit=30" \
  -o /tmp/vc/top.json && STATUS_TOP=ok

curl -fsSL -H "User-Agent: $UA" \
  "https://old.reddit.com/r/vibecoding/hot.json?limit=30" \
  -o /tmp/vc/hot.json && STATUS_HOT=ok

curl -fsSL -H "User-Agent: $UA" \
  "https://old.reddit.com/r/vibecoding/rising.json?limit=15" \
  -o /tmp/vc/rising.json && STATUS_RISING=ok
```

If a curl fails, **fall back to WebFetch** on the same URL (the sandbox may block curl but not WebFetch). If all three endpoints fail after fallback, notify `VIBECODING_DIGEST_ERROR: all Reddit endpoints failed` and log to today's log; exit.

### 2. Merge, dedupe, filter

- Union posts from top + hot + rising, dedupe by `id`.
- Drop `stickied: true`.
- Drop IDs present in `memory/seen-vibecoding.txt` or mentioned in the last 2 days of `memory/logs/`.
- If ≥3 endpoints succeeded and <5 posts survive dedup: it's a quiet day. Go straight to step 7 with a minimal "quiet day" digest (1-line vibe + tools pulse + source footer). Do not skip the notify.

### 3. Score and classify

For each surviving post, compute:

```
age_hours = (now - created_utc) / 3600
controversy_bonus = (num_comments * 2) if upvote_ratio < 0.70 else 0
signal_score = score + (2 * num_comments) + controversy_bonus - (age_hours * 0.3)
```

Classify each post into exactly one bucket (check in order, first match wins):

1. **Ship** — title or selftext contains any of: "I built", "I shipped", "I made", "launched", "my app", "my project", "we built", "we shipped", "MVP", "v1", "release", "now live". Note stack, user count, revenue if cited.
2. **Debate** — `upvote_ratio < 0.70` AND `num_comments ≥ 20`, OR title is a question/opinion ("is", "are", "should", "why", "vs", "the problem with", "hot take", "unpopular opinion").
3. **Tutorial** — contains: "how to", "guide", "workflow", "setup", "prompt", "tip", "tutorial", "lesson", "what I learned".
4. **Meme** — `is_self: false` AND (domain is image host: i.redd.it, imgur, i.imgur, v.redd.it) AND (score/num_comments ratio > 20 = people upvote and move on).
5. **Other** — everything else.

### 4. Pick winners

Rank all posts by `signal_score` desc. Select:

- **Top 5 posts** for the main list — cap 2 per bucket (so no bucket dominates unless signal demands it).
- **Top 2 spicy threads** — highest `controversy_bonus` among Debate bucket (ratio < 0.70). If fewer than 2 exist, show what you have; don't invent drama.

For those 7 posts (5 + 2), fetch the comment thread via the comments endpoint. Skip if fetch fails (log which ones).

### 5. Extract signals

**Verdict (one-line):** Based on bucket distribution across the top 5 posts:
- `SHIPPING` — ≥3 Ship posts
- `DEBATING` — ≥3 Debate posts OR ≥1 in top-2 signal
- `LEARNING` — ≥3 Tutorial posts
- `HYPE` — ≥3 Meme posts
- `MIXED` — no bucket dominates

**Tools pulse:** Scan all fetched posts (titles + selftext) AND all fetched comments for tool mentions. Count case-insensitive occurrences of: `Claude Code`, `Claude`, `Cursor`, `Windsurf`, `Bolt.new`, `Bolt`, `Replit`, `v0`, `Lovable`, `Codex`, `Copilot`, `ChatGPT`, `Gemini`, `Aider`, `Cline`. Output the top 6 by count — this is the community's live tool leaderboard.

**Narrative clusters:** Group the top 5 posts into 1-3 themes. A theme = ≥2 posts sharing ≥2 content keywords (not stopwords). Name each theme in 2-4 words (e.g., "Claude Code vs Cursor", "revenue from vibe apps", "context-window frustration").

**Insight-per-post:** For each of the 5 main posts, write a 1-line **insight** that goes beyond restating the title. What does this post reveal about the community, the tools, or the practice? If you can't exceed the title, cut the post and promote the next in rank.

### 6. Build the digest

```
## Vibecoding Digest — ${today}

**Verdict:** {SHIPPING|DEBATING|LEARNING|HYPE|MIXED} — {≤12-word rationale: what drove the verdict}

**Tools pulse:** 1. {tool} ({N}) · 2. {tool} ({N}) · 3. {tool} ({N}) · 4. {tool} ({N}) · 5. {tool} ({N}) · 6. {tool} ({N})

**Narratives:** {theme 1} · {theme 2} · {theme 3}

### Top 5

1. **[title]** — {bucket} · {score}pts · {num_comments}c · {ratio as %}%
   *Insight:* {what this post reveals — not a paraphrase}
   https://reddit.com{permalink}

2. ... (repeat for 5)

### Spicy threads

**"[post title]"** — {num_comments}c · {ratio}% upvoted
- u/{commenter}: "{sharpest-take comment excerpt, ≤40 words}"
- u/{commenter}: "{second best excerpt}"

**"[post title]"** — {num_comments}c · {ratio}% upvoted
- u/{commenter}: "{excerpt}"

---
_sources: top={ok|fail} hot={ok|fail} rising={ok|fail} · scanned={N} · new={N} · dedup={N}_
```

**Hard constraints:**
- Every `Insight:` line must state a claim, implication, or pattern — not restate the title. Use verbs: "reveals", "suggests", "signals", "confirms", "contradicts".
- No "lots of people are excited about X" — name the tool, cite the count.
- Exactly 5 top posts (not 4, not 8) unless dedup left fewer — in which case cite the count in the source footer.
- `ratio as %` = `round(upvote_ratio * 100)`.

### 7. Notify

Send via `./notify`:

```
r/vibecoding — ${today}

verdict: {VERDICT} — {≤12-word rationale}
tools: {tool1} {N} · {tool2} {N} · {tool3} {N}

top:
1. "{title}" — {score}pts, {comments}c
2. "{title}" — {score}pts, {comments}c
3. "{title}" — {score}pts, {comments}c

spicy: "{controversial title}" ({ratio}%, {comments}c)
  "{sharpest comment excerpt, ≤25 words}" — u/{author}

src: top={ok|fail} hot={ok|fail} rising={ok|fail}
```

Quiet-day fallback (<5 posts after dedup):
```
r/vibecoding — ${today}
quiet day — {N} posts after dedup
tools pulse: {tool1} {N} · {tool2} {N} · {tool3} {N}
src: top={ok|fail} hot={ok|fail} rising={ok|fail}
```

### 8. Log and persist

Append to `memory/logs/${today}.md`:
```
## Vibecoding Digest
- **Window:** {day|week|month}
- **Verdict:** {VERDICT} ({rationale})
- **Top post:** "{title}" — {score}pts, {comments}c (signal {score})
- **Most controversial:** "{title}" — {ratio}% upvoted, {comments}c
- **Tools pulse (top 3):** {tool1}={N}, {tool2}={N}, {tool3}={N}
- **Narratives:** {theme1}, {theme2}, {theme3}
- **Sources:** top={ok|fail} hot={ok|fail} rising={ok|fail}
- **Scanned / new / dedup:** {S} / {N} / {D}
- **Notification sent:** yes
```

Append the post IDs of everything in the top 5 + spicy threads to `memory/seen-vibecoding.txt` (create if missing). Keep only the last 200 lines.

If any post surfaces a take or insight relevant to topics tracked in `MEMORY.md` (e.g., specific tool regressions, new workflows worth reading), note it there under the appropriate topic.

## Sandbox note

The sandbox may block outbound curl. If curl fails, use **WebFetch** on the same URL as a fallback — WebFetch bypasses the sandbox. If all three Reddit endpoints fail even via WebFetch, emit `VIBECODING_DIGEST_ERROR` to notify, log the failure, and exit. No auth is required, so no pre-fetch/post-process pattern is needed.

## Output codes

- `VIBECODING_DIGEST_OK` — normal run, ≥5 posts after dedup.
- `VIBECODING_DIGEST_QUIET` — <5 posts after dedup but ≥1 source succeeded.
- `VIBECODING_DIGEST_ERROR` — all sources failed or 0 posts total.

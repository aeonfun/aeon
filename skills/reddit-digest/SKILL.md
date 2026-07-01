---
name: Reddit Digest
category: research
description: Reddit intelligence — cross-subreddit narrative detection over a tracked set, or a decision-ready single-sub deep digest (signal-scored, verdict + tools leaderboard, spicy threads), including a curated r/vibecoding preset
var: ""
tags: [news, content]
---
<!-- merged: reddit-digest (cross-sub narrative detector) + vibecoding-digest (single-sub deep digest / vibecoding preset). Preserves both pipelines verbatim behind a subreddit selector. -->

> **${var}** — Subreddit selector, with an optional `:window` suffix (`day` default, `week`, `month`). Grammar:
> - **empty** → cross-sub **narrative detector** over the tracked set in `memory/subreddits.yml` (reddit-digest default). e.g. `` (empty)
> - **comma list** (≥2 subs) → narrative detector restricted to exactly those subs. e.g. `rust,programming,LocalLLaMA`
> - **`vibecoding`** (preset keyword) → the curated **r/vibecoding deep digest** — expands to vibecoding-digest's specific sub + framing (three sorts, signal scoring, Ship/Debate/Tutorial/Meme buckets, one-line verdict, tools leaderboard, spicy threads). e.g. `vibecoding`, `vibecoding:week`
> - **single subreddit** (one name, not `vibecoding`) → single-sub deep digest of that sub using the same mechanics. e.g. `rust`, `LocalLLaMA:month`
>
> The `:window` suffix (Reddit's `?t=`) applies to the **single-sub deep digest** only; the narrative detector is always a rolling 24h view by design.

## Dispatch (shared preamble — run first, every mode)

1. Read `memory/MEMORY.md` for high-level context and tracked interests (influences standout selection, narrative labelling, and which insights are worth noting back).
2. Read the last 2–3 days of `memory/logs/` to avoid repeating narratives/posts already surfaced.
3. Parse `${var}`:
   ```bash
   SEL="${var}"
   WINDOW="day"
   case "$SEL" in
     *:day|*:week|*:month) WINDOW="${SEL##*:}"; SEL="${SEL%:*}" ;;
   esac
   ```
4. Route:
   - `SEL` **empty** OR contains a **comma** → **Branch A — Narrative detector** (below). A comma list overrides `memory/subreddits.yml` with the listed subs; empty uses the file.
   - `SEL == vibecoding` → **Branch B — Single-sub deep digest**, `SUB=vibecoding`, **vibecoding preset ON** (tools leaderboard, coding-community framing, `memory/seen-vibecoding.txt`, `VIBECODING_DIGEST_*` codes).
   - any other **single token** → **Branch B — Single-sub deep digest**, `SUB=$SEL`, preset OFF (generic framing, `memory/seen-${SUB}.txt`, `REDDIT_DIGEST_*` codes).

---

# Branch A — Cross-sub narrative detector

## Thesis

A per-subreddit top-10 competes with everyone's own Reddit scroll and loses. The signal Reddit *uniquely* provides that no single feed does: **the same story surfacing in multiple unrelated subs at once**. That's the narrative detector. This branch is built around that — not around per-sub digests.

## Config

If `SEL` is a comma list, use exactly those subreddits (skip the file). Otherwise read `memory/subreddits.yml`. If missing, bootstrap it with ≥8 diverse subs seeded from MEMORY.md interests (spread across unrelated communities — narratives are only meaningful if the subs don't normally overlap). Example default:

```yaml
subreddits:
  - { name: r/MachineLearning, subreddit: MachineLearning }
  - { name: r/programming,      subreddit: programming }
  - { name: r/LocalLLaMA,       subreddit: LocalLLaMA }
  - { name: r/netsec,           subreddit: netsec }
  - { name: r/rust,             subreddit: rust }
  - { name: r/technology,       subreddit: technology }
  - { name: r/science,          subreddit: science }
  - { name: r/cryptocurrency,   subreddit: cryptocurrency }
```

## Steps

### A1. Fetch broadly

For each subreddit, fetch the top of the last 24h (note: `t=day` only applies to `top`, **not** `hot` — the original skill had this bug):

```bash
curl -sL -H "User-Agent: aeon-bot/1.0 (by /u/aeon)" \
  "https://www.reddit.com/r/${SUBREDDIT}/top.json?t=day&limit=25"
```

Unauthenticated Reddit JSON API rate limits at ~10 req/min. **Pace requests ≥7s apart** (sequential, not inside parallel tool calls). If curl returns 429 or a network error, retry once after 15s; if still failing, fall back to **WebFetch** on the same URL. If both fail, mark the source `error` and continue — never abort the whole run for one dead sub.

Record a per-source status: `{sub: ok | empty | error}`.

### A2. Clean candidates

For each post under `data.children[].data`, drop if any of:
- `stickied == true` or `pinned == true`
- `removed_by_category` non-null, or `selftext ∈ {"[removed]", "[deleted]"}`
- `over_18 == true` (unless the sub is explicitly NSFW-tracked)
- `created_utc` > 24h old
- `upvote_ratio < 0.80` (drama/brigaded — the "controversial" signal, not the "interesting" signal)

Extract: `id`, `title`, `url` (external), `permalink` (Reddit), `subreddit`, `score`, `num_comments`, `upvote_ratio`, `selftext` (first 500 chars), `is_self`.

### A3. Normalize URLs

For each post with an external URL:
- Lowercase scheme + host
- Strip `www.`, trailing slashes, URL fragments (`#...`)
- Drop query params: `utm_*`, `ref`, `ref_src`, `source`, `fbclid`, `gclid`
- For self posts, use `self:${subreddit}/${id}` as the canonical key (so they never cluster with anything)

### A4. Detect cross-sub narratives

Group posts into clusters:
- **URL clusters:** posts sharing the exact same canonical URL.
- **Title clusters:** posts across different subs whose titles share ≥50% Jaccard similarity on normalized word sets (lowercase, strip punctuation, drop stopwords like `a/the/of/to/is/are/and/or`).  <!-- heuristic — tune if cluster over/undersplits -->

A **narrative** = a cluster with ≥2 posts from ≥2 distinct subreddits. Single-sub clusters are not narratives.

Dedup narratives against the last 2 days of logs: if any post ID in the cluster, or a ≥70%-similar title, was already surfaced, drop the whole narrative.  <!-- heuristic — tune if dedup is too aggressive/loose -->

**Cluster-count fallback:** if clustering produces **fewer than 2** narratives (rare — usually a quiet day or too-strict threshold) **or more than 5** (over-fragmented), skip the narrative format and fall back to a **flat ranked list** of the top individual posts by signal score. Log the fallback reason in the source-status footer.

### A5. Score narratives

```
narrative_signal = Σ log10(score_i + 1) × 1.5
                 + Σ log10(num_comments_i + 1)
                 + 0.5 × (distinct_sub_count − 1)    # cross-community bonus
```

The cross-community bonus makes a 3-sub narrative strictly beat an equal-engagement 2-sub one.

### A6. Standouts (single-sub big stories)

A narrative-only digest is too restrictive on slow days. Also surface up to **2** single-sub standouts — posts with:
- `score ≥ 1000` AND `num_comments ≥ 200` AND `upvote_ratio ≥ 0.90`
- Not already part of a narrative cluster

Rank standouts by `log10(score+1)×3 + log10(comments+1)×2`.

### A7. Summarize — insight, not paraphrase

Pick the top 3-5 narratives by signal + up to 2 standouts (cap at 6 items total). For each:

- If the canonical is an external URL, **WebFetch** it to ground the insight (skip paywalled or failed fetches — fall back to the Reddit discussion).
- For self posts, use `selftext`.
- For discussion-heavy items (`num_comments > score`), identify the *disagreement axis* rather than summarizing the OP.

Write ONE line per item. **Never paraphrase the title. Never write "This post discusses…"** Write the *claim*, the *surprise*, or the *disagreement* — something a reader couldn't derive from just reading the title.

### A8. Format and send via `./notify`

Keep under 4000 chars. Lead with a one-sentence shape signal (e.g., "Quiet AI news; heavy open-source drama.").

```
*Reddit Narratives — 2026-04-20*
_Shape: Quiet AI news; heavy open-source drama crossing rust + programming._

🔗 *OpenAI retracts jailbreak paper 14 days post-publication*
   Spread: r/MachineLearning (450↑ 120💬) · r/OpenAI (220↑ 60💬) · r/ChatGPT (80↑ 30💬)
   Insight: Retraction cites internal safety review, not author request — unusual for a peer-reviewed venue.
   [Canonical](https://example.com/article)

🔗 *Rust 1.83 async-trait ergonomics split*
   Spread: r/rust (880↑ 340💬) · r/programming (310↑ 95💬)
   Disagreement axis: dyn-safe async now vs. waiting for variance fixes.
   [Canonical](https://example.com/rfc)

📍 *Standout — r/netsec*
   • [Title](https://reddit.com/...) — 2100↑ 900💬
     Insight: First CVE confirmed exploited via the Linux eBPF verifier since 2024's bug class.

_sources: 7 ok · 1 empty · 0 error · 12 narratives considered · 3 surfaced_
```

### A9. Suppression

If **zero narratives** AND **zero standouts** pass filters: log `REDDIT_DIGEST_OK (quiet day)` with the source-status line and send **nothing**. Digests that fire every day get tuned out. Only fire when there's signal.

If **all sources errored**: log `REDDIT_DIGEST_ERROR` and send a short alert `"Reddit digest: all N sources errored — check rate limits / API"`.

### A10. Log

Append to `memory/logs/${today}.md` under the shared `### reddit-digest` heading (see **Log** below), with `- Mode: narrative (<subs>)` as the discriminator, then:
```
- Sources: 7 ok, 1 empty, 0 error
- Narratives considered: 12
- Surfaced: 3 narratives + 1 standout
- Post IDs: abc123, def456, ... (for cross-day dedup)
```

### Why Branch A is different from "what you'd see scrolling"

Per-sub top-10 = noise you can get yourself in two minutes.
Cross-sub narrative = signal that only an aggregator watching ≥8 subs at once can produce.
The branch's job is the thing a human can't do cheaply.

---

# Branch B — Single-sub deep digest (vibecoding preset & generic single sub)

Runs for a single subreddit `SUB` (the `vibecoding` preset, or any single sub name). The **vibecoding preset** turns on the coding-community framing: the tools leaderboard, the `web:aeon-vibecoding-digest` UA, `memory/seen-vibecoding.txt`, and `VIBECODING_DIGEST_*` output codes. A generic single sub uses the same signal-scoring/bucket/verdict/spicy pipeline with generic naming (`memory/seen-${SUB}.txt`, `REDDIT_DIGEST_*` codes) and **omits the tools leaderboard** (that leaderboard is a coding-community feature).

Load `memory/seen-${SUB}.txt` if present (for the vibecoding preset this is `memory/seen-vibecoding.txt`; one post ID per line, last 200) — dedup against it.

## Data source

Reddit JSON API (no auth). Append `.json` to any Reddit URL. Use `old.reddit.com` — it's lighter, more stable, and less likely to be JS-rate-limited than `www.reddit.com`.

**User-Agent (required):** `web:aeon-vibecoding-digest:1.0 (by /u/aeonbot)` — Reddit's preferred format. Default/generic UAs get 429'd fast. (For a non-vibecoding sub you may use the equivalent `web:aeon-reddit-digest:1.0 (by /u/aeonbot)`; the *format* is what avoids throttling.)

Endpoints (`SUB` = the selected subreddit, `WINDOW` from the `:window` suffix):
- `https://old.reddit.com/r/${SUB}/top.json?t=${WINDOW}&limit=30` — top by score in window
- `https://old.reddit.com/r/${SUB}/hot.json?limit=30` — currently hot
- `https://old.reddit.com/r/${SUB}/rising.json?limit=15` — rising (catches momentum before top)
- `https://old.reddit.com/r/${SUB}/comments/{post_id}.json?sort=top&limit=15&depth=2` — comments

Fields to keep per post: `id`, `title`, `selftext`, `score`, `num_comments`, `upvote_ratio`, `author`, `created_utc`, `permalink`, `link_flair_text`, `is_self`, `domain`, `url`, `stickied`.

## Steps

### B1. Fetch three sorts

```bash
TIME_WINDOW="${WINDOW:-day}"
case "$TIME_WINDOW" in day|week|month) ;; *) TIME_WINDOW="day" ;; esac
UA="web:aeon-vibecoding-digest:1.0 (by /u/aeonbot)"   # generic sub: web:aeon-reddit-digest:1.0 (by /u/aeonbot)

mkdir -p /tmp/vc
STATUS_TOP=fail STATUS_HOT=fail STATUS_RISING=fail

curl -fsSL -H "User-Agent: $UA" \
  "https://old.reddit.com/r/${SUB}/top.json?t=$TIME_WINDOW&limit=30" \
  -o /tmp/vc/top.json && STATUS_TOP=ok

curl -fsSL -H "User-Agent: $UA" \
  "https://old.reddit.com/r/${SUB}/hot.json?limit=30" \
  -o /tmp/vc/hot.json && STATUS_HOT=ok

curl -fsSL -H "User-Agent: $UA" \
  "https://old.reddit.com/r/${SUB}/rising.json?limit=15" \
  -o /tmp/vc/rising.json && STATUS_RISING=ok
```

If a curl fails, **fall back to WebFetch** on the same URL (the sandbox may block curl but not WebFetch). If all three endpoints fail after fallback, notify `{ERROR_CODE}: all Reddit endpoints failed` (`VIBECODING_DIGEST_ERROR` for the vibecoding preset, else `REDDIT_DIGEST_ERROR`) and log to today's log; exit.

### B2. Merge, dedupe, filter

- Union posts from top + hot + rising, dedupe by `id`.
- Drop `stickied: true`.
- Drop IDs present in `memory/seen-${SUB}.txt` or mentioned in the last 2 days of `memory/logs/`.
- If ≥3 endpoints succeeded and <5 posts survive dedup: it's a quiet day. Go straight to step B7 with a minimal "quiet day" digest (1-line vibe + tools pulse [vibecoding preset] + source footer). Do not skip the notify.

### B3. Score and classify

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

### B4. Pick winners

Rank all posts by `signal_score` desc. Select:

- **Top 5 posts** for the main list — cap 2 per bucket (so no bucket dominates unless signal demands it).
- **Top 2 spicy threads** — highest `controversy_bonus` among Debate bucket (ratio < 0.70). If fewer than 2 exist, show what you have; don't invent drama.

For those 7 posts (5 + 2), fetch the comment thread via the comments endpoint. Skip if fetch fails (log which ones).

### B5. Extract signals

**Verdict (one-line):** Based on bucket distribution across the top 5 posts:
- `SHIPPING` — ≥3 Ship posts
- `DEBATING` — ≥3 Debate posts OR ≥1 in top-2 signal
- `LEARNING` — ≥3 Tutorial posts
- `HYPE` — ≥3 Meme posts
- `MIXED` — no bucket dominates

**Tools pulse** *(vibecoding preset only — skip for generic subs):* Scan all fetched posts (titles + selftext) AND all fetched comments for tool mentions. Count case-insensitive occurrences of: `Claude Code`, `Claude`, `Cursor`, `Windsurf`, `Bolt.new`, `Bolt`, `Replit`, `v0`, `Lovable`, `Codex`, `Copilot`, `ChatGPT`, `Gemini`, `Aider`, `Cline`. Output the top 6 by count — this is the community's live tool leaderboard.

**Narrative clusters:** Group the top 5 posts into 1-3 themes. A theme = ≥2 posts sharing ≥2 content keywords (not stopwords). Name each theme in 2-4 words (e.g., "Claude Code vs Cursor", "revenue from vibe apps", "context-window frustration").

**Insight-per-post:** For each of the 5 main posts, write a 1-line **insight** that goes beyond restating the title. What does this post reveal about the community, the tools, or the practice? If you can't exceed the title, cut the post and promote the next in rank.

### B6. Build the digest

```
## Reddit Digest — r/${SUB} — ${today}

**Verdict:** {SHIPPING|DEBATING|LEARNING|HYPE|MIXED} — {≤12-word rationale: what drove the verdict}

**Tools pulse:** 1. {tool} ({N}) · 2. {tool} ({N}) · 3. {tool} ({N}) · 4. {tool} ({N}) · 5. {tool} ({N}) · 6. {tool} ({N})   [vibecoding preset only]

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

### B7. Notify

Send via `./notify` (the vibecoding preset uses the `r/vibecoding` heading; generic subs use `r/${SUB}`):

```
r/${SUB} — ${today}

verdict: {VERDICT} — {≤12-word rationale}
tools: {tool1} {N} · {tool2} {N} · {tool3} {N}        [vibecoding preset only]

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
r/${SUB} — ${today}
quiet day — {N} posts after dedup
tools pulse: {tool1} {N} · {tool2} {N} · {tool3} {N}   [vibecoding preset only]
src: top={ok|fail} hot={ok|fail} rising={ok|fail}
```

### B8. Log and persist

Append to `memory/logs/${today}.md` under the shared `### reddit-digest` heading (see **Log** below), with `- Mode: single-sub (r/${SUB}, window={day|week|month})` as the discriminator, then:
```
- **Verdict:** {VERDICT} ({rationale})
- **Top post:** "{title}" — {score}pts, {comments}c (signal {score})
- **Most controversial:** "{title}" — {ratio}% upvoted, {comments}c
- **Tools pulse (top 3):** {tool1}={N}, {tool2}={N}, {tool3}={N}   [vibecoding preset only]
- **Narratives:** {theme1}, {theme2}, {theme3}
- **Sources:** top={ok|fail} hot={ok|fail} rising={ok|fail}
- **Scanned / new / dedup:** {S} / {N} / {D}
- **Notification sent:** yes
```

Append the post IDs of everything in the top 5 + spicy threads to `memory/seen-${SUB}.txt` (create if missing; for the vibecoding preset this is `memory/seen-vibecoding.txt`). Keep only the last 200 lines.

If any post surfaces a take or insight relevant to topics tracked in `MEMORY.md` (e.g., specific tool regressions, new workflows worth reading), note it there under the appropriate topic.

---

## Log (shared)

Append to `memory/logs/${today}.md` under a single `### reddit-digest` heading (the health loop parses this shape). Start with a `- Mode:` discriminator line naming the branch that ran (`narrative (<subs>)` or `single-sub (r/<sub>, window=<w>)`), then the branch-specific bullets from A10 / B8.

## Sandbox note

Outbound curl may be blocked in the GitHub Actions sandbox. **Always** fall back to **WebFetch** on the identical URL for any failed curl (WebFetch bypasses the sandbox) — this applies to both branches. No auth is required, so no pre-fetch/post-process pattern is strictly needed.

For **Branch A** (narrative detector), if rate-limited often, drop `scripts/prefetch-reddit.sh` that fetches all configured subs before Claude runs (see CLAUDE.md's pre-fetch pattern) — the branch should read from `.reddit-cache/` first if present.

For **Branch B**, if all three Reddit endpoints fail even via WebFetch, emit the branch's error code (`VIBECODING_DIGEST_ERROR` for the vibecoding preset, else `REDDIT_DIGEST_ERROR`) to notify, log the failure, and exit.

## Output codes

- **Branch A (narrative):** `REDDIT_DIGEST_OK` (normal, incl. `(quiet day)` suppression) · `REDDIT_DIGEST_ERROR` (all sources errored).
- **Branch B (vibecoding preset):** `VIBECODING_DIGEST_OK` (≥5 posts after dedup) · `VIBECODING_DIGEST_QUIET` (<5 posts but ≥1 source succeeded) · `VIBECODING_DIGEST_ERROR` (all sources failed or 0 posts).
- **Branch B (generic single sub):** `REDDIT_DIGEST_OK` · `REDDIT_DIGEST_QUIET` · `REDDIT_DIGEST_ERROR` (same semantics as the vibecoding codes).

## Environment Variables

None required — Reddit's public JSON API is unauthenticated. A custom User-Agent is required to avoid shared-bucket throttling: Branch A uses `aeon-bot/1.0 (by /u/aeon)`; Branch B uses Reddit's preferred `web:aeon-vibecoding-digest:1.0 (by /u/aeonbot)` format (or `web:aeon-reddit-digest:1.0` for a non-vibecoding sub).

---
name: Reddit Digest
description: Detect cross-subreddit narratives — stories surfacing in multiple unrelated subs at once
var: ""
tags: [news]
---
<!-- autoresearch: variation D — rethink: cross-sub narrative detector, not per-sub summary -->

> **${var}** — Optional topic filter or single subreddit name. If empty, scans all tracked subs.

If `${var}` is set, restrict candidates to that subreddit or filter narratives by that topic.

## Thesis

A per-subreddit top-10 competes with everyone's own Reddit scroll and loses. The signal Reddit *uniquely* provides that no single feed does: **the same story surfacing in multiple unrelated subs at once**. That's the narrative detector. This skill is built around that — not around per-sub digests.

## Config

Read `memory/subreddits.yml`. If missing, bootstrap it with ≥8 diverse subs seeded from MEMORY.md interests (spread across unrelated communities — narratives are only meaningful if the subs don't normally overlap). Example default:

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

Read `memory/MEMORY.md` for tracked interests (influences standout selection and narrative labelling).
Read the last 2 days of `memory/logs/` to avoid repeating narratives already surfaced.

## Steps

### 1. Fetch broadly

For each subreddit, fetch the top of the last 24h (note: `t=day` only applies to `top`, **not** `hot` — original skill had this bug):

```bash
curl -sL -H "User-Agent: aeon-bot/1.0 (by /u/aeon)" \
  "https://www.reddit.com/r/${SUBREDDIT}/top.json?t=day&limit=25"
```

Unauthenticated Reddit JSON API rate limits at ~10 req/min. **Pace requests ≥7s apart** (sequential, not inside parallel tool calls). If curl returns 429 or a network error, retry once after 15s; if still failing, fall back to **WebFetch** on the same URL. If both fail, mark the source `error` and continue — never abort the whole run for one dead sub.

Record a per-source status: `{sub: ok | empty | error}`.

### 2. Clean candidates

For each post under `data.children[].data`, drop if any of:
- `stickied == true` or `pinned == true`
- `removed_by_category` non-null, or `selftext ∈ {"[removed]", "[deleted]"}`
- `over_18 == true` (unless the sub is explicitly NSFW-tracked)
- `created_utc` > 24h old
- `upvote_ratio < 0.80` (drama/brigaded — the "controversial" signal, not the "interesting" signal)

Extract: `id`, `title`, `url` (external), `permalink` (Reddit), `subreddit`, `score`, `num_comments`, `upvote_ratio`, `selftext` (first 500 chars), `is_self`.

### 3. Normalize URLs

For each post with an external URL:
- Lowercase scheme + host
- Strip `www.`, trailing slashes, URL fragments (`#...`)
- Drop query params: `utm_*`, `ref`, `ref_src`, `source`, `fbclid`, `gclid`
- For self posts, use `self:${subreddit}/${id}` as the canonical key (so they never cluster with anything)

### 4. Detect cross-sub narratives

Group posts into clusters:
- **URL clusters:** posts sharing the exact same canonical URL.
- **Title clusters:** posts across different subs whose titles share ≥50% Jaccard similarity on normalized word sets (lowercase, strip punctuation, drop stopwords like `a/the/of/to/is/are/and/or`).  <!-- heuristic — tune if cluster over/undersplits -->

A **narrative** = a cluster with ≥2 posts from ≥2 distinct subreddits. Single-sub clusters are not narratives.

Dedup narratives against the last 2 days of logs: if any post ID in the cluster, or a ≥70%-similar title, was already surfaced, drop the whole narrative.  <!-- heuristic — tune if dedup is too aggressive/loose -->

**Cluster-count fallback:** if clustering produces **fewer than 2** narratives (rare — usually a quiet day or too-strict threshold) **or more than 5** (over-fragmented), skip the narrative format and fall back to a **flat ranked list** of the top individual posts by signal score. Log the fallback reason in the source-status footer.

### 5. Score narratives

```
narrative_signal = Σ log10(score_i + 1) × 1.5
                 + Σ log10(num_comments_i + 1)
                 + 0.5 × (distinct_sub_count − 1)    # cross-community bonus
```

The cross-community bonus makes a 3-sub narrative strictly beat an equal-engagement 2-sub one.

### 6. Standouts (single-sub big stories)

A narrative-only digest is too restrictive on slow days. Also surface up to **2** single-sub standouts — posts with:
- `score ≥ 1000` AND `num_comments ≥ 200` AND `upvote_ratio ≥ 0.90`
- Not already part of a narrative cluster

Rank standouts by `log10(score+1)×3 + log10(comments+1)×2`.

### 7. Summarize — insight, not paraphrase

Pick the top 3-5 narratives by signal + up to 2 standouts (cap at 6 items total). For each:

- If the canonical is an external URL, **WebFetch** it to ground the insight (skip paywalled or failed fetches — fall back to the Reddit discussion).
- For self posts, use `selftext`.
- For discussion-heavy items (`num_comments > score`), identify the *disagreement axis* rather than summarizing the OP.

Write ONE line per item. **Never paraphrase the title. Never write "This post discusses…"** Write the *claim*, the *surprise*, or the *disagreement* — something a reader couldn't derive from just reading the title.

### 8. Format and send via `./notify`

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

### 9. Suppression

If **zero narratives** AND **zero standouts** pass filters: log `REDDIT_DIGEST_OK (quiet day)` with the source-status line and send **nothing**. Digests that fire every day get tuned out. Only fire when there's signal.

If **all sources errored**: log `REDDIT_DIGEST_ERROR` and send a short alert `"Reddit digest: all N sources errored — check rate limits / API"`.

### 10. Log

Append to `memory/logs/${today}.md`:
```
### reddit-digest
- Sources: 7 ok, 1 empty, 0 error
- Narratives considered: 12
- Surfaced: 3 narratives + 1 standout
- Post IDs: abc123, def456, ... (for cross-day dedup)
```

## Sandbox note

Outbound curl may be blocked in the GitHub Actions sandbox. **Always** fall back to WebFetch on the identical URL for any failed curl. If rate-limited often, drop `scripts/prefetch-reddit.sh` that fetches all configured subs before Claude runs (see CLAUDE.md's pre-fetch pattern) — the skill should read from `.reddit-cache/` first if present.

## Why this skill is different from "what you'd see scrolling"

Per-sub top-10 = noise you can get yourself in two minutes.
Cross-sub narrative = signal that only an aggregator watching ≥8 subs at once can produce.
The skill's job is the thing a human can't do cheaply.

## Environment Variables

None required — Reddit's public JSON API is unauthenticated. A custom User-Agent (`aeon-bot/1.0 (by /u/aeon)`) is required to avoid shared-bucket throttling.

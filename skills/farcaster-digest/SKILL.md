---
name: Farcaster Digest
description: Clustered, signal-scored digest of Farcaster casts with conversation-shape lead and insight-first editorial notes
var: ""
tags: [crypto, social]
---
<!-- autoresearch: variation B — sharper output via cluster + signal score + insight extraction; folds in A's semantic/channel inputs and C's source-status footer + persistent dedup -->

> **${var}** — Topic filter or channel name (e.g. "prediction-markets", "base", "ai-agents"). If empty, uses default interest areas.

If `${var}` is set, focus curation on that topic or channel.

Read `memory/MEMORY.md` for current interests.
Read the last 2 days of `memory/logs/` for recency context.
Load persistent dedup state from `memory/state/farcaster-seen-hashes.json` (auto-created; safe to delete to reset dedup). The file starts as `{"hashes": [], "updated": null}` and stores cast hashes seen in the last 7 days — casts present here are skipped even if they re-appear in algorithmic feeds.

## Thesis

Curation is the biggest lever, not fetching. Raw engagement counts rank by popularity, not conversation. This skill ranks by a signal score, clusters casts into 2–3 sub-narratives, leads with a one-line conversation-shape header, and demands an original insight per cast — not a paraphrase of the cast text.

## Steps

### 1. Fetch casts from three complementary sources

For every endpoint, prefer `WebFetch` over curl (sandbox often blocks curl — see CLAUDE.md). Auth header: `x-api-key: $NEYNAR_API_KEY`.

**(a) Topic search — literal + semantic.**
Run each default topic query twice: once with `mode=literal` (default), once with `mode=semantic` to catch thematic matches the keyword query misses.

```
GET https://api.neynar.com/v2/farcaster/cast/search/?q=QUERY&sort_type=algorithmic&mode=literal&limit=20
GET https://api.neynar.com/v2/farcaster/cast/search/?q=QUERY&sort_type=algorithmic&mode=semantic&limit=20
```

Default topics (override with `${var}` or MEMORY.md interests):
- `"prediction markets" | "coordination markets" | polymarket | kalshi | futarchy`
- `"AI agents" | "autonomous agents" | agentic | "agent frameworks"`
- `hyperstitions | "mechanism design" | "network states" | "public goods"`

If `${var}` is set, replace all default topics with a single search on `${var}`.

**(b) Channel feed — high-signal channels.**
Sample recent casts from 3–4 channels relevant to Aeon's interests:

```
GET https://api.neynar.com/v2/farcaster/feed/channels?channel_ids=ai-agents,base,founders,ethereum&with_recasts=false&with_replies=false&limit=30
```

(If `${var}` looks like a channel slug, query that channel alone.)

**(c) Global trending — network-wide context.**
```
GET https://api.neynar.com/v2/farcaster/feed/trending?limit=25&time_window=24h
```

Record per-source status (`ok` | `fail` | `empty`) as you go — you'll emit it in the footer.

### 2. Filter and deduplicate

- Drop any cast whose `hash` is in `farcaster-seen-hashes.json`.
- Drop any cast older than 48h (use `timestamp` field).
- Drop casts whose `author.follower_count` is below 500 — removes most spam/fresh-acct noise.
- Drop near-duplicates (same author posting near-identical text within the window).
- Drop pure shilling: casts that are almost entirely `$TICKER` + a link and no commentary.

### 3. Score and rank

Compute a signal score for each surviving cast:

```
signal = reactions.likes_count + 2 × reactions.recasts_count + 0.5 × replies.count
```

Rationale: recasts signal endorsement (worth ~2 likes); replies signal controversy/noise (halved). Raw likes remain the base. Take the top 15 by signal score into the editorial pass.

**Engagement floor:** exclude anything with `signal < 10`. If fewer than 3 casts clear the floor, lower it to 5 rather than returning nothing.

### 4. Cluster into 2–3 sub-narratives

Read the top 15 and group them into **2 or 3 themed clusters**. Examples of good cluster labels:
- "prediction market volume chasing the election cycle"
- "agent frameworks debating memory vs. tools"
- "base mini-apps shipping faster than the analytics can track"

Avoid generic labels like "crypto news" or "AI". A cluster label should name a *conversation*, not a topic.

From each cluster, select the 2–3 casts that best represent the argument — diversity of voices over highest-engagement if they overlap.

Target total: **5–8 casts across clusters**.

### 5. Format the digest

Keep under 4000 chars. Lead with a one-line conversation-shape header describing what's happening on Farcaster today, then one block per cluster.

```
farcaster digest — ${today}
shape: <one line, ≤20 words, what's the conversation today>

—— <cluster 1 label> ——

@username — "cast text here (truncate >240 chars)"
↳ 142 likes · 31 recasts · 18 replies | warpcast.com/username/0xabc123
insight: <one line, ≤25 words, something a reader couldn't get from the cast text alone>

@username2 — "..."
↳ ... | warpcast.com/...
insight: ...

—— <cluster 2 label> ——

...

sources: search=ok trending=ok channels=ok | new casts: 7 | seen-cache: 142 hashes
```

**Insight discipline:** prefer casts where the `insight:` line adds something — implication, counter-argument, context the cast assumes, or a connection to another cast in the digest — over casts where the best you can write is a paraphrase. When choosing between casts of similar signal, pick the one that yields a non-paraphrase insight.

### 6. Send via `./notify`

Pass the formatted digest to `./notify "<digest>"`.

### 7. Persist state and log

- Append every included cast's hash to `memory/state/farcaster-seen-hashes.json`. Prune entries older than 7 days before writing.
- Log to `memory/logs/${today}.md` under `### farcaster-digest` with: search queries used, source-status line, cluster labels chosen, cast count included, and any notable edge cases (e.g. engagement-floor lowered).

## Empty vs error

- **Empty run (`FARCASTER_DIGEST_OK`):** sources succeeded, but nothing cleared the engagement floor or all surviving casts were already in the seen cache. Notify: `farcaster digest: quiet day — <N> casts fetched, 0 passed signal floor`. Log the source-status line.
- **Error run (`FARCASTER_DIGEST_ERROR`):** every source returned fail/empty *before* filtering. Notify: `farcaster digest skipped — sources: search=X trending=Y channels=Z`. Do **not** update the seen cache.

## Sandbox note

The sandbox may block outbound curl. Default to **WebFetch**; fall back to curl only if WebFetch hits an auth wall. For the auth-required Neynar API, WebFetch works because it doesn't rely on shell env expansion — pass the key inline via the prompt or use the pre-fetch pattern (see CLAUDE.md) if you need to shell out.

## Environment Variables Required

- `NEYNAR_API_KEY` — Neynar API key for Farcaster data access (get one at neynar.com).

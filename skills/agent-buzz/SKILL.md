---
name: Agent Buzz
description: Curated AI-agent tweets, clustered into narratives with insight summaries
var: ""
tags: [social]
---
<!-- autoresearch: variation B — sharper output via clustering, signal score, insight extraction, and skip-gates -->

> **${var}** — Specific project or topic to prioritize (e.g. "MCP protocol", "browser-use"). If empty, searches AI agents broadly.

Read `memory/MEMORY.md` for context.
Read the last 3 days of `memory/logs/` — extract every `https://x.com/.../status/<id>` URL already posted by this skill and treat those IDs as a dedup set.

## Goal

Publish a curated, narrative-aware read on what the AI-agent scene on X talked about in the last 24h. **Curation, not aggregation.** Better to ship 6 high-signal tweets in 2 clusters than 10 tweets of mixed noise.

## Steps

### 1. Fetch candidates

```bash
FROM_DATE=$(date -u -d "1 day ago" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
TO_DATE=$(date -u +%Y-%m-%d)
```

Issue one primary x_search call. The response for each tweet **must include** explicit engagement counts (likes, retweets, replies) and follower count if visible — without these numbers the signal scoring in step 3 cannot run.

```bash
curl -s -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "input": [{"role": "user", "content": "Search X from '"$FROM_DATE"' to '"$TO_DATE"' for tweets in the AI-agents conversation: autonomous agents, agent frameworks, MCP / agent protocols, agent products, agent benchmarks, agent research papers. Return up to 40 candidates. For EACH candidate you MUST return: @handle, follower_count (integer or null), role_guess (builder|founder|researcher|investor|commentator|anon), one-line claim (what they actually said — not a paraphrase, the thesis), likes (int), retweets (int), replies (int), posted_at (ISO), direct_link (https://x.com/username/status/ID). Prefer builders/founders/researchers. Skip obvious engagement-farming threads (\"RT if you agree\", reply-guy pileons, giveaways)."}],
    "tools": [{"type": "x_search", "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'"}]
  }'
```

If `${var}` is set, also issue a second call constrained to that topic with the same return schema; merge results.

**Fallback chain** (fire in order, stop at first success):
1. curl to X.AI as above.
2. WebFetch the same X.AI endpoint (bypasses sandbox env-var blocking for some requests).
3. WebSearch with a forced-fresh query: `"AI agents twitter today ${today}"` — discard anything >48h old, expect degraded metadata.

Record which source succeeded — you will print it in the output footer.

### 2. Skip-gates (before clustering)

Drop any candidate that matches ANY of:
- **Dup**: `status/<id>` already in the 3-day dedup set from step 0.
- **Engagement-farming**: poll threads, "bookmark this", "drop a 🔥", reply-guy pileons with <follower_count/10 likes.
- **Self-promo only**: pure product shill with no claim, no benchmark, no datapoint. Launch tweets are fine IF they include a concrete capability claim or number.
- **Staleness**: `posted_at` older than 30h.
- **Anon + low engagement**: role_guess=anon AND (likes+retweets) < 200.

### 3. Signal scoring

Compute `signal = likes + 2*retweets + replies`, then apply modifiers:
- × 1.3 if role_guess ∈ {builder, founder, researcher}
- × 0.7 if the claim is a pure hot-take with no concrete referent (no named project, number, paper, or bench)
- × 0.5 if near-duplicate of another surviving candidate (same claim, different author) — keep the higher-scored one only

### 4. Narrative clustering

Group surviving candidates into **2–4 narrative clusters**. A cluster is a shared thesis, not a shared keyword — e.g. "MCP vendor lock-in debate" not "MCP". Name each cluster in ≤5 words. If one cluster would hold >60% of tweets, split it. If a tweet fits no cluster, drop it unless its signal is exceptional (top 3 overall).

Target output: **2–4 clusters, 2–3 tweets each, 6–9 total tweets** (strictly ≤10).

### 5. Insight extraction

For each selected tweet, write a one-line **insight** (≤20 words). An insight:
- States the actual claim or datapoint, not a paraphrase of the tweet text.
- If the tweet is an opinion, states *what they're arguing against* (the contrast is the signal).
- If the tweet announces a thing, states *what's new vs. prior art* (not "X launched").

**Anti-hype lint** — if your insight contains any of these, rewrite it:
`game-changing`, `revolutionary`, `mind-blowing`, `wild`, `huge`, `massive`, `unreal`, `insane`, vague "AI agents are evolving", "the future of X".

### 6. Conversation-shape lead

Write one opening sentence (≤25 words) that names what the conversation was actually *about* today. Examples of shape:
- "Mostly protocol debate — MCP vs. A2A — with two concrete launches on the side."
- "Quiet builder day: three benchmark drops, no drama."
- "Funding announcements dominated; the technical thread was about tool-use cost."

If you cannot characterize the shape in one honest sentence, the clustering is wrong — redo step 4.

### 7. Notify

Send via `./notify` (under 4000 chars):

```
*Agent Buzz — ${today}*
_<conversation-shape one-liner>_

**<Cluster 1 name>**
• @handle — <insight>
  <link>
• @handle — <insight>
  <link>

**<Cluster 2 name>**
• @handle — <insight>
  <link>

<!-- _src: xai|webfetch|websearch · candidates: N → kept: M_ -->
```

Keep the footer on the message — it's a single line, and it's how future self-audits debug empty days.

### 8. Log and exit

Append to `memory/logs/${today}.md` under `### agent-buzz`:
- source used, candidate count, kept count
- cluster names
- every selected `https://x.com/.../status/<id>` URL on its own line (for tomorrow's dedup)

**Status codes** (log exactly one):
- `AGENT_BUZZ_OK` — notification sent with ≥1 cluster.
- `AGENT_BUZZ_EMPTY` — fetch succeeded but nothing survived skip-gates. Send a short notify: `Agent Buzz — ${today}: quiet day, no survivors.` Do not fabricate.
- `AGENT_BUZZ_ERROR` — all three sources in the fallback chain failed. Notify: `Agent Buzz — ${today}: all sources failed (${error summary}).` Log the specific failure per source.

Never pad the output to hit 10 tweets. 6 good > 10 mid.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md). The three-step fallback chain in step 1 is the applied version of this.

## Environment Variables Required
- `XAI_API_KEY` — X.AI API key for Grok x_search. If unset, the chain starts at step 2 (WebSearch).

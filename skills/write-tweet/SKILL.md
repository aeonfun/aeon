---
name: Write Tweet
description: Generate 10 tweet drafts across 5 size tiers (2 variations each) on a topic from today's outputs
var: ""
tags: [social]
---
<!-- autoresearch: variation B — sharper output via hook-first writing, reply-bait scoring, and falsifiability -->

> **${var}** — Topic, thesis, or URL to write about (e.g. "prediction markets are broken", "https://arxiv.org/..."). If empty, auto-selects the most tweetable insight from today's logs.

## Phase 0: Context

Read `memory/MEMORY.md` and the last 14 days of `memory/logs/`. Extract any prior tweet takes on this topic so you don't repeat positions or contradict yourself. If you find a near-duplicate take from the past two weeks, abort and notify: "write-tweet: skipping — recent duplicate take on [topic]."

If soul files exist (`soul/SOUL.md`, `soul/STYLE.md`, `soul/examples/`), read them and match the owner's voice exactly. If empty/absent, default style: short sentences, no hedging, no corporate voice, state opinion first, reference specifics, no hashtags, no emojis, no self-referential meta.

## Phase 1: Topic + ground truth

If `${var}` looks like a URL, WebFetch it for the underlying content before proceeding.

If `${var}` is empty, read today's `memory/logs/${today}.md` and pick the **single most tweetable insight**, prioritizing:
1. A take from today's article (already researched and opinionated)
2. A surprising connection between two of today's findings
3. A reaction to something from a tweet roundup or digest

If no candidate exists, abort and notify: "write-tweet: no usable insight in today's logs."

WebSearch the topic with a "last 24 hours" filter to confirm you're not contradicted by fresh news. If `XAI_API_KEY` is set, search X for what people are saying:

```bash
curl -s -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "input": [{"role": "user", "content": "Search X for what people are saying about TOPIC in the last 24 hours. Return the 5 most notable tweets with @handle, like/reply counts, and a one-sentence summary of the take."}],
    "tools": [{"type": "x_search"}]
  }'
```

If curl fails, fall back to `WebSearch "TOPIC site:x.com"`. The point is to add signal, not noise — know what's already been said.

## Phase 2: Sharpen the angle

Before writing any drafts, write out:

1. **Thesis** — one declarative sentence stating the position you're defending.
2. **Three obvious takes to avoid** — the tired/expected angles on this topic. Do not echo these.
3. **Three specific anchors** — names, numbers, dates, or events that make claims falsifiable. Every draft must reference at least one.
4. **Strongest counter-take** — one sentence. If a draft cannot survive a smart reply armed with this counter, rewrite it.

## Phase 3: Hook-first generation

For each tier, brainstorm **5 hook candidates** (first 7 words only). Score each on:
- **Stop-scroll** — does it interrupt a feed?
- **Reply-bait** — would a smart reader want to reply, not just like?
- **Specificity** — does it carry a name, number, or date?

Pick the top hook per tier, then expand into 2 full variations using **different approach styles**. The two variations within a tier must take genuinely different angles — different framing, emphasis, mood — not minor rewrites.

### Approach styles (mix across variations)
- **Hot take** — opinionated position stated directly
- **Observation** — pattern most people aren't seeing
- **Sardonic/ironic** — dry humor
- **Reframe** — question the premise of the mainstream take
- **Data drop** — lead with a specific number or fact
- **Narrative** — tiny story or anecdote
- **Question** — genuine question that reframes thinking

### Size tiers (2026 engagement-tuned)

**Tier 1 — One-liner** (~71–100 chars — retweet sweet spot)
Single punchy sentence. Maximum compression — every word load-bearing.

**Tier 2 — Two-punch** (~100–180 chars)
First sentence sets up, second lands the hit. Claim then evidence, or observation then implication.

**Tier 3 — Paragraph** (~180–280 chars)
Three to four sentences. Context, position, kicker.

**Tier 4 — Long tweet** (~280–600 chars — X Premium long post)
Mini-essay. Setup, turn, conclusion. Anchored to a specific data point or example.

**Tier 5 — Thread opener** (first tweet under 280 chars + 5–7 beat sketch)
First tweet hooks the thesis. Below it, a `---` separator and a 5–7 bullet sketch of where the thread goes (7 tweets is the 2026 sweet spot — research shows shorter under-delivers, longer loses completion). Each beat is one key claim, not full text.

### Hard constraints
- Tier 1–3: hard 280-character limit per tweet.
- Tier 4: hard 600-character limit.
- Tier 5: first tweet under 280; thread sketch is bullets only.
- No hashtags, no emojis, no "RT if you agree."
- No self-referential meta ("hot take:", "unpopular opinion:").
- No external links in tiers 1–3 (algorithmically suppressed for non-Premium reach).
- Every draft must include at least one anchor from Phase 2.
- Count characters manually for every draft. Reject and rewrite anything over the limit.

## Phase 4: Self-edit

For each of the 10 drafts:
1. Cut every word that doesn't earn its space.
2. Rate **reply-bait 1–5** (would a smart reader want to reply, not just like?).
3. Confirm at least one Phase-2 anchor is present.
4. Confirm character count is within tier limits.

Drop any draft scoring ≤2 on reply-bait and rewrite it.

## Output format

```
## Tweet Drafts: [topic]

**Thesis:** [one sentence]
**Avoiding:** [obvious take 1] | [obvious take 2] | [obvious take 3]
**Anchors:** [name/number/date 1], [2], [3]
**Counter-take:** [sentence]

### Tier 1 — One-liner
**1a. [style]** ([N chars], reply-bait [N/5])
> [tweet text]

**1b. [style]** ([N chars], reply-bait [N/5])
> [tweet text]

### Tier 2 — Two-punch
**2a. [style]** ([N chars], reply-bait [N/5])
> [tweet text]

**2b. [style]** ([N chars], reply-bait [N/5])
> [tweet text]

### Tier 3 — Paragraph
**3a. [style]** ([N chars], reply-bait [N/5])
> [tweet text]

**3b. [style]** ([N chars], reply-bait [N/5])
> [tweet text]

### Tier 4 — Long tweet
**4a. [style]** ([N chars], reply-bait [N/5])
> [tweet text]

**4b. [style]** ([N chars], reply-bait [N/5])
> [tweet text]

### Tier 5 — Thread opener
**5a. [style]** ([N chars], reply-bait [N/5])
> [tweet text]
---
- [beat 1]
- [beat 2]
- [beat 3]
- [beat 4]
- [beat 5]

**5b. [style]** ([N chars], reply-bait [N/5])
> [tweet text]
---
- [beat 1]
- [beat 2]
- [beat 3]
- [beat 4]
- [beat 5]

**Best overall:** #[n] — [reason]
**Best per tier:** 1[a/b], 2[a/b], 3[a/b], 4[a/b], 5[a/b]
```

## Notify

Send via `./notify`:
```
tweet drafts: [topic]
thesis: [one sentence]

— one-liner —
1a. [tweet text]
1b. [tweet text]

— two-punch —
2a. [tweet text]
2b. [tweet text]

— paragraph —
3a. [tweet text]
3b. [tweet text]

— long tweet —
4a. [tweet text]
4b. [tweet text]

— thread opener —
5a. [tweet text]
5b. [tweet text]

best: #[n] — [reason]
```

## Log

Append to `memory/logs/${today}.md`:
```
## Write Tweet
- **Topic:** [topic]
- **Thesis:** [one sentence]
- **Drafts:** 10 generated (5 tiers x 2 variations)
- **Best overall:** #[n] — [style] / [tier]
- **Top reply-bait score:** [N/5]
- **Notification sent:** yes
```

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs (XAI), use the pre-fetch/post-process pattern (see CLAUDE.md). If both XAI curl and the WebSearch fallback fail, proceed with just topical context and note the absence in the output.

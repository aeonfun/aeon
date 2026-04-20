---
name: Channel Recap
description: Weekly recap article from a public Telegram channel — rank posts by engagement, expand on the best
var: ""
tags: [content]
---
<!-- autoresearch: variation A — engagement-weighted selection using t.me/s/ view + reaction signal -->

> **${var}** — Telegram channel username (without @). Required — set in aeon.yml var field.

Read memory/MEMORY.md for context.

If `${var}` is empty, abort with: "channel-recap requires var= set to a Telegram channel username" and exit.

## Steps

### 1. Verify the channel exists

Fetch `https://t.me/s/${var}` with WebFetch and confirm the page contains message blocks (not the "Channel does not exist" or "Private channel" screen). If the channel is missing or private, notify and exit:

```
./notify "*channel-recap* — channel @${var} is missing, private, or has no public preview. Skipping."
```

Also capture the channel metadata from the first page: **title**, **subscriber count**, and **short description** — these go into the article intro.

### 2. Fetch 7 days of posts with engagement data

Paginate through `https://t.me/s/${var}` using WebFetch. Each page has ~16 posts.

From the HTML of each page, extract **for every message**:
- `post_number` (from the `data-post` attribute, e.g. `channel/1234`)
- `timestamp` (from the `<time>` datetime attribute)
- `text` (the message body, stripped of HTML)
- `links` (all URLs inside the message, including the href of `<a>` tags)
- `views` (from `.tgme_widget_message_views`, e.g. `"12.5K"` → parse to integer)
- `reactions` (sum of all reaction counts from `.tgme_widget_message_reactions`)
- `is_forwarded` (true if the message has a "Forwarded from" header)
- `media_type` (photo / video / document / none)

Extract the `?before=N` link from the top of each page and fetch the next one. Continue until:
- Posts are older than 7 days, OR
- You've fetched 15 pages (whichever comes first)

**Fallback:** if a page fetch fails or returns no messages, retry once with WebFetch. If it still fails, skip that page and continue with what you have — do not abort the whole run. If an individual post looks truncated on the preview, fetch `https://t.me/${var}/POST_NUMBER?embed=1` to get the full text.

**Dedupe:** if two posts have identical text (common with forwards of the same message), keep only the one with higher views.

### 3. Rank by engagement, then filter for signal

Compute `engagement_score = views + (reactions * 50)` for each post. Sort descending.
<!-- heuristic: the 50× reactions weight, 30-post pool, and 6–12 featured range are derived from empirical view-to-reaction ratios on typical public Telegram channels (reactions are rare and intentional, ~1 per 50–100 views). Tune if output looks off — e.g. raise the multiplier on low-reaction channels, widen the pool on quiet weeks. -->

From the top 30 by engagement, select the **6–12 most interesting** for the article (widened from 8–12 to reduce brittleness on slow weeks). Within that top slice, prefer:
- Original takes (posts with commentary, not just a bare link)
- Posts linking to substantial content (articles, threads, papers — not memes)
- Posts that cluster around a shared theme with other top posts
- Posts that share a strong opinion

Skip even if highly viewed: single-word reactions, emoji-only posts, low-context forwards with no added comment, media-only posts with no text.

If fewer than 5 posts clear the bar, write a **short recap** (300–500 words) instead of a full article — note in the intro that the week was quiet.

### 4. Research and expand

For each selected post:
- If it links to a tweet, use WebFetch to get the full tweet/thread context
- If it links to an article, use WebFetch to read it
- Use WebSearch to get additional context on the topic if needed
- Note connections between posts — what themes keep coming up?

### 5. Write the article

Write a **750–1500 word article** that weaves the best posts into a coherent narrative. Structure:

```markdown
# [Channel title] Week in Review — ${today}

> ${subscriber_count} subscribers · [@${var}](https://t.me/${var})
> ${channel_description}

[Opening — 2-3 sentences setting up what the channel was buzzing about this week. Name the dominant theme.]

## [Theme 1 title]

[Expand on 2-3 related posts. Don't just quote them — add context, explain why they matter,
connect to the bigger picture. Each post gets its engagement shown inline, e.g.:
"[post](https://t.me/${var}/1234) (12K views · 340 reactions)"]

## [Theme 2 title]

[Same treatment — expand, contextualize, connect]

## [Theme 3 title]

[...]

## Quick hits

- [one-liner] — [post](https://t.me/${var}/POST) (N views)
- [one-liner] — [post](https://t.me/${var}/POST) (N views)
- [one-liner] — [post](https://t.me/${var}/POST) (N views)

---
*Sourced from [@${var}](https://t.me/${var}) — ${date_range} · ${total_posts_scanned} posts scanned, ${featured_count} featured*
```

Rules:
- Write in a direct, opinionated style — no hedging, no filler
- Don't just summarize posts — add value. Explain why something matters, what the implications are, what people are missing.
- Use the channel posts as jumping-off points, not the whole story
- Include engagement counts inline so readers can see which posts actually landed
- Group by theme, not chronologically
- Link every featured post with `https://t.me/${var}/POST_NUMBER`

### 6. Save the article

Write to `articles/channel-recap-${var}-${today}.md`.

### 7. Notify

Send via `./notify` (under 4000 chars) — a condensed version:

```
*${var} — week recap*

[3-4 sentence summary of the biggest themes]

top posts by engagement:
- [one-liner] — N views (link)
- [one-liner] — N views (link)
- [one-liner] — N views (link)

full article: articles/channel-recap-${var}-${today}.md
```

### 8. Log

Append to `memory/logs/${today}.md`:

```
## Channel Recap — ${var}
- **Channel:** ${title} (${subscriber_count} subs)
- **Posts scanned:** N (7-day window)
- **Posts featured:** N
- **Top post:** [link] — N views, N reactions
- **Themes:** [list]
- **Article:** articles/channel-recap-${var}-${today}.md
- **Notification sent:** yes
```

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as the primary fetch method for all t.me/s/ and embed URLs — it bypasses the sandbox. If a WebFetch call returns empty or malformed HTML, retry once before skipping the page.

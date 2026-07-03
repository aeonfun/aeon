---
type: Skill
mode: write
name: Digest
category: research
description: Generate and send a digest on a configurable topic, optionally pulling RSS/Atom feeds as an input source alongside web + X signal
var: ""
tags: [content, news]
requires: [XAI_API_KEY?]
---
<!-- autoresearch: variation B — curatorial discipline (filter → distill → structure → sanity-check) folded with sandbox-safe inputs and memory-aware dedup; RSS feed-reading + item-selection absorbed from rss-digest as an additional source class -->

> **${var}** — Selects the digest's topic and which source classes feed it. Grammar:
> - `""` (empty) → **digest's default sources** (WebSearch + xAI/Grok + aggregators), no topic filter — a broad daily digest.
> - `"<topic>"` → topic-focused digest on the default web sources, filtered to `<topic>` (e.g. `"solana"`, `"AI agents"`, `"rust"`).
> - `"rss"` → **RSS-only**: pull feeds from `memory/feeds.yml`, no topic filter.
> - `"rss: <topic>"` → RSS-only, filtered to `<topic>` (e.g. `"rss: rust"`).
> - `"<topic> +rss"` → default web sources **and** RSS feeds combined, both filtered to `<topic>` (e.g. `"AI agents +rss"`).

Today is ${today}. Generate and send a daily **${var}** digest.

The whole point of a digest is **signal, not volume**. A reader skimming for 60 seconds should walk away with three things they didn't know that morning and one of them should change a decision they'd make this week. Anything that doesn't clear that bar gets cut.

## Preamble — orient and parse the selector

1. Read `memory/MEMORY.md` for high-level context and tracked topics, and scan the last 3 days of `memory/logs/` so you can dedup against anything already reported.
2. Parse `${var}` into **`{topic, sources}`**:
   - Strip a trailing `+rss` → adds RSS to the default web sources. Remainder is the `topic`.
   - A leading `rss:` (or the bare token `rss`) → **RSS-only** source set; text after the colon is the `topic` (empty = no filter).
   - Otherwise the whole string is the `topic` and `sources = default web` (empty string = default web, no topic filter).
   - Resulting `sources` is one of: `web` (default), `rss` (RSS-only), or `web+rss` (both).
3. The `topic`, when non-empty, is a filter applied to **every** source class — web queries are scoped to it and RSS items must match it (title/description/tags). Empty topic = keep all relevant items.

## Config (RSS source)

When `sources` includes `rss`, this skill reads feed URLs from `memory/feeds.yml`. If the file doesn't exist yet, create it (write mode) with the shape below, or — if you have nothing to seed it with — log a one-line note and treat the RSS source as empty for this run.

```yaml
# memory/feeds.yml
feeds:
  - name: Example Feed
    url: https://example.com/rss
  - name: Another Feed
    url: https://example.com/atom.xml
```

## Phase 1 — Gather (cast a wide net)

Pull from the source classes selected by `${var}`. Never rely on a single one — if `sources = web`, use at least two of the web classes below; if `sources = web+rss`, RSS counts as one class and you still want a second.

### Web sources (active when `sources` is `web` or `web+rss`)

1. **WebSearch** (built-in) — run 2 distinct queries:
   - `"${topic}" news ${today}` (broad). If `topic` is empty, run a general query for the day's notable stories in the operator's tracked areas (from `memory/MEMORY.md`).
   - One narrower query you choose based on `${topic}` (e.g. for "solana" → `"solana" launches OR funding OR exploit ${today}`; for "AI agents" → `"agent framework" OR "agentic" release ${today}`).
2. **xAI x_search via Grok** — pulls the X/Twitter signal layer.
   - **Preferred path (sandbox-safe):** read `.xai-cache/digest.json` if it exists. The workflow's `scripts/prefetch-xai.sh` populates it before Claude runs. If you find the cache empty or absent, log a one-line note and continue — do not retry curl in a loop.
   - **Fallback:** if the cache is missing, attempt a WebFetch to a public X search URL like `https://x.com/search?q=${topic}&f=live` and extract a few top posts. Skip if that also returns nothing.
   - If `XAI_API_KEY` is unset, skip entirely without erroring.
3. **WebFetch on a topic-relevant aggregator** (only if WebSearch returned thin results): e.g. `https://news.ycombinator.com/`, `https://www.reddit.com/r/<topic>/top/?t=day.json`, or a known feed for the topic.

Aim for **~15 raw web candidates** at this stage. More is fine; fewer than 8 is a warning sign — broaden your queries before moving on.

### RSS source (active when `sources` is `rss` or `web+rss`)

Read `memory/feeds.yml` for the feed list. For **each feed** in `feeds.yml`:

1. Fetch the RSS/Atom XML: `curl -sL "FEED_URL"`. If curl fails (sandbox), fall back to **WebFetch** on the same URL.
2. Parse for entries published in the **last 24h** (check `<pubDate>` or `<updated>` tags).
3. Extract **title, link, and description** for each new entry.

Deduplicate against recent logs (see Phase 2). From all new entries, select the **5–7 most interesting** items — prioritize topics tracked in `memory/MEMORY.md`, and apply the `${topic}` filter when set (title/description/tags must match). For each selected item, if the summary is too thin, use **WebFetch** to pull the full article, then write a 1–2 sentence note on why it matters. These become RSS candidates entering the shared pipeline below.

If `sources = rss` and there are **no new items across all feeds**, log `RSS_DIGEST_OK` in the run log and end without notifying.

## Phase 2 — Filter (kill the noise)

Pool every candidate (web + RSS) and drop any that fails a single check:

- **No source link?** Drop it. Every surviving item must have a clickable URL (article URL, feed entry link, or `https://x.com/handle/status/ID`).
- **Older than 36 hours?** Drop it unless it's a still-developing story being re-surfaced for a new reason. (RSS entries are already scoped to the last 24h; this catches stale web results.)
- **Pure speculation, hot take, or "X reacts to Y"?** Drop it. Keep things with a verifiable claim, named entity, number, release, or transaction.
- **Already covered in the last 3 daily logs?** Check `memory/logs/` for entries from the last 3 days. If the same story (same headline subject, same primary actor) appears, drop the duplicate unless there's a material new development to report.
- **Two sources telling the same story?** Keep one — prefer the primary source (announcement post, repo release, official filing) over the recap. A web hit and an RSS entry on the same event count as duplicates; keep the primary.

Target: ~5–8 survivors after this pass.

## Phase 3 — Distill and structure (force the shape)

Pick the **3–5 strongest** items. Lead with the **single most actionable** one — the item where a reader can do something today (subscribe, sell, fork, attend, apply, watch). Then descend by importance.

Format the digest exactly like this (**unified format** — used for `web`, `rss`, and `web+rss` runs):

```
*${var} — ${today}*

_TL;DR: <one sentence covering the day's gravity. Concrete, no adjectives.>_

1. *<Headline-style title, ≤90 chars>*
   <1–2 sentence summary. Lead with what happened, not who said it.>
   Why it matters: <one short clause — concrete consequence, not vibes>
   <link>

2. *<Title>*
   ...

3. *<Title>*
   ...

(Optional, only if there's genuine secondary signal:)
*Also worth a glance:* <1-line bullet> · <1-line bullet>
```

**Format rules:**
- Markdown only. No emoji. No "Here's your digest" preamble.
- Total length: **≤3000 chars** (the old 4000 was too loose — discipline forces cuts).
- Every item: title + summary + link. Include a "Why it matters" line whenever you can state a concrete consequence (price impact, user-facing change, upstream dependency, deadline, precedent). If you can't write one without hand-waving, **omit the line** — do not replace it with filler like "this could be significant" or "watch this space".
- On thin-news days where fewer than 3 items clear the bar: log `DIGEST_FETCH_EMPTY` (or `DIGEST_THIN` if 1–2 items survived) in the run log and **skip the notification** rather than padding.

**Alternate RSS layout (RSS-only runs):** when `sources = rss`, you may instead group items by feed name if that reads better than a single ranked list — this preserves the original RSS-digest presentation:

```
*RSS Digest — ${today}*

*Feed Name*
- [Title](url) — summary
- [Title](url) — summary

*Feed Name*
- [Title](url) — summary
```

The grouped RSS layout stays **≤4000 chars**. Prefer the unified ranked format when the run mixes sources (`web+rss`) so the reader gets one prioritized list.

## Phase 4 — Sanity-check (last pass before sending)

Before calling `./notify`, walk this checklist mentally:

- [ ] Lead item is the most actionable one I have, not just the most dramatic.
- [ ] Every link resolves to a real URL (no `[link]` placeholders, no truncated IDs).
- [ ] No item is paraphrasing a hot take — each has a verifiable underlying fact.
- [ ] No two items are the same story under different angles (including a web hit + an RSS entry on the same event).
- [ ] Char count under the limit for the chosen format (3000 unified / 4000 grouped RSS).
- [ ] No emoji slipped in. No corporate hedging ("could potentially", "it remains to be seen").

If the digest fails any check, fix it before sending. If after filtering you have **fewer than 3 strong items**, do not pad — send a shorter "thin day" digest with whatever survived and a one-line note acknowledging it was a quiet news day. Do not invent or stretch.

## Phase 5 — Send and log

1. Send via `./notify "<digest body>"`.
2. Append to `memory/logs/${today}.md` under **one** `### digest` heading:
   ```
   ### digest (${var})
   - Source mode: <web | rss | web+rss>
   - Sources used: <list — e.g. WebSearch, xAI cache, feeds.yml (Feed A, Feed B)>
   - Raw candidates: <N> (web <Nw> / rss <Nr>), after filter: <M>, sent: <K>
   - Lead item: <title>
   - Notes: <anything unusual — sandbox failure, thin day (DIGEST_THIN/DIGEST_FETCH_EMPTY), RSS_DIGEST_OK, dedup against prior log>
   ```
3. Update `memory/MEMORY.md` "Recent Digests" table with one row: date, topic (or `${var}`), key topics (3 short keywords).

## Sandbox note

The GitHub Actions sandbox blocks outbound network from bash — especially `curl` calls that interpolate env vars in headers (the shape of a direct xAI call), and it may also block plain outbound curl for RSS feeds. Two safe paths apply here:

- **xAI (secret-bearing):** **Do not** attempt `curl ... -H "Authorization: Bearer $XAI_API_KEY"` from this skill; it will fail silently or partially. Use the **pre-fetch** pattern — add a `digest)` case to `scripts/prefetch-xai.sh` so the workflow populates `.xai-cache/digest.json` before Claude runs; this skill reads that file, not the API directly.
- **RSS feeds & public pages (no auth):** `curl -sL` may fail intermittently. The built-in **WebFetch** tool bypasses the sandbox for unauthenticated URLs — use it as the fallback for any feed URL, aggregator (HN, Reddit JSON, news sites), or article that curl couldn't fetch.

If neither auth path works and you have only WebSearch + reachable RSS results, that's still a valid digest — say so in the log so health checks can spot the pattern.

## Environment Variables Required

- `XAI_API_KEY` — used by `scripts/prefetch-xai.sh` (optional; digest works on web + RSS sources alone).
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- Never send a digest with placeholder links or "TBD" sections.
- Never invent items to hit a target count. Fewer good items beats more weak ones.
- Never repeat a story already in the last 3 days of `memory/logs/` unless there's a material update — and say so explicitly when you do.

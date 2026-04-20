---
name: Daily Digest
description: Generate and send a daily digest on a configurable topic
var: ""
tags: [content]
---
<!-- autoresearch: variation B — curatorial discipline (filter → distill → structure → sanity-check) folded with sandbox-safe inputs and memory-aware dedup -->

> **${var}** — Topic for the digest (e.g. "AI agents", "solana", "rust"). **Required** — set your topic in aeon.yml.

Today is ${today}. Generate and send a daily **${var}** digest.

The whole point of a digest is **signal, not volume**. A reader skimming for 60 seconds should walk away with three things they didn't know that morning and one of them should change a decision they'd make this week. Anything that doesn't clear that bar gets cut.

## Phase 1 — Gather (cast a wide net)

Pull from at least two of these source classes — never rely on a single one:

1. **WebSearch** (built-in) — run 2 distinct queries:
   - `"${var}" news ${today}` (broad)
   - One narrower query you choose based on `${var}` (e.g. for "solana" → `"solana" launches OR funding OR exploit ${today}`; for "AI agents" → `"agent framework" OR "agentic" release ${today}`)
2. **xAI x_search via Grok** — pulls the X/Twitter signal layer.
   - **Preferred path (sandbox-safe):** read `.xai-cache/digest.json` if it exists. The workflow's `scripts/prefetch-xai.sh` populates it before Claude runs. If you find the cache empty or absent, log a one-line note and continue — do not retry curl in a loop.
   - **Fallback:** if the cache is missing, attempt a WebFetch to a public X search URL like `https://x.com/search?q=${var}&f=live` and extract a few top posts. Skip if that also returns nothing.
   - If `XAI_API_KEY` is unset, skip entirely without erroring.
3. **WebFetch on a topic-relevant aggregator** (only if WebSearch returned thin results): e.g. `https://news.ycombinator.com/`, `https://www.reddit.com/r/<topic>/top/?t=day.json`, or a known feed for the topic.

Aim for **~15 raw candidates** at this stage. More is fine; fewer than 8 is a warning sign — broaden your queries before moving on.

## Phase 2 — Filter (kill the noise)

Drop any candidate that fails a single check:

- **No source link?** Drop it. Every surviving item must have a clickable URL (article URL or `https://x.com/handle/status/ID`).
- **Older than 36 hours?** Drop it unless it's a still-developing story being re-surfaced for new reason.
- **Pure speculation, hot take, or "X reacts to Y"?** Drop it. Keep things with a verifiable claim, named entity, number, release, or transaction.
- **Already covered in the last 3 daily logs?** Check `memory/logs/` for entries from the last 3 days. If the same story (same headline subject, same primary actor) appears, drop the duplicate unless there's a material new development to report.
- **Two sources telling the same story?** Keep one — prefer the primary source (announcement post, repo release, official filing) over the recap.

Target: ~5–8 survivors after this pass.

## Phase 3 — Distill and structure (force the shape)

Pick the **3–5 strongest** items. Lead with the **single most actionable** one — the item where a reader can do something today (subscribe, sell, fork, attend, apply, watch). Then descend by importance.

Format the digest exactly like this:

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

## Phase 4 — Sanity-check (last pass before sending)

Before calling `./notify`, walk this checklist mentally:

- [ ] Lead item is the most actionable one I have, not just the most dramatic.
- [ ] Every link resolves to a real URL (no `[link]` placeholders, no truncated IDs).
- [ ] No item is paraphrasing a hot take — each has a verifiable underlying fact.
- [ ] No two items are the same story under different angles.
- [ ] Char count under 3000.
- [ ] No emoji slipped in. No corporate hedging ("could potentially", "it remains to be seen").

If the digest fails any check, fix it before sending. If after filtering you have **fewer than 3 strong items**, do not pad — send a shorter "thin day" digest with whatever survived and a one-line note acknowledging it was a quiet news day. Do not invent or stretch.

## Phase 5 — Send and log

1. Send via `./notify "<digest body>"`.
2. Append to `memory/logs/${today}.md`:
   ```
   ### digest (${var})
   - Sources used: <list>
   - Raw candidates: <N>, after filter: <M>, sent: <K>
   - Lead item: <title>
   - Notes: <anything unusual — sandbox failure, thin day, dedup against prior log>
   ```
3. Update `memory/MEMORY.md` "Recent Digests" table with one row: date, topic, key topics (3 short keywords).

## Sandbox note

The GitHub Actions sandbox blocks `curl` calls that interpolate env vars in headers — that is exactly the shape of a direct xAI call. **Do not** attempt `curl ... -H "Authorization: Bearer $XAI_API_KEY"` from this skill; it will fail silently or partially.

Two safe paths:
- **Pre-fetch (preferred):** add a `digest)` case to `scripts/prefetch-xai.sh` so the workflow populates `.xai-cache/digest.json` before Claude runs. This skill should read that file, not call the API directly.
- **WebFetch:** the built-in WebFetch tool bypasses the sandbox for unauthenticated URLs. Use it for public pages (HN, Reddit JSON, news sites) when WebSearch is thin.

If neither works and you have only WebSearch results, that's still a valid digest — say so in the log so health checks can spot the pattern.

## Environment Variables Required

- `XAI_API_KEY` — used by `scripts/prefetch-xai.sh` (optional; digest works on web sources alone).
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- Never send a digest with placeholder links or "TBD" sections.
- Never invent items to hit a target count. Fewer good items beats more weak ones.
- Never repeat a story already in the last 3 days of `memory/logs/` unless there's a material update — and say so explicitly when you do.

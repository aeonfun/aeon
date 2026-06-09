---
name: article-queue
description: Article idea synthesizer — ranks signals from topic-momentum, beat-tracker, and narrative-tracker into a prioritized queue the article skill reads on its next run
schedule: "0 11 * * 0"
tags: [content, meta]
---

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Why this skill exists

Three skills generate article signals, none of them feed the article skill:
- **topic-momentum** — scores uncovered angles vs narrative frequency
- **beat-tracker** — tracks multi-beat storylines, alerts at 3 beats (article-ready)
- **narrative-tracker** — labels narratives EMERGING / RISING / PEAK / FADING

The article skill reads `memory/MEMORY.md` but picks topics from scratch every run. This means a 3-beat thread can sit article-ready for days while the article skill writes about something else. This skill closes that gap: runs weekly (after topic-momentum finishes), synthesizes all three signal sources, and writes a ranked queue to `memory/topics/article-queue.md`. The article skill will encounter the queue via MEMORY.md naturally.

A queue entry is only as good as its urgency. Priority order:
1. **Beat-ready** (≥3 beats) — the story is cooked. Write it now.
2. **Warming up** (2 beats, most recent beat ≤5 days ago) — one beat away.
3. **topic-momentum picks** — scored by gap score, freshness, soul-fit.
4. **Narrative-tracker RISING/EMERGING** not yet written about.

## Steps

### 1. Load beat-tracker state

Read `memory/topics/beat-tracker.md`. If it doesn't exist, skip beat signals (log a note).

Parse all active threads. For each thread extract:
- Thread name
- Status (active / article-ready / stale)
- Beat count
- Most recent beat date
- Latest beat summary

Flag threads with `status: article-ready` (≥3 beats) as **URGENT**. Flag threads with beat_count == 2 and last beat ≤5 days as **WARMING**.

### 2. Load topic-momentum output

Read `memory/logs/` — use Glob on `memory/logs/*.md`. Take the 7 most recent by filename. Scan each for a `## Topic Momentum` section. From the most recent such section, extract:
- Top 3 ranked angles (title + gap score + one-line description)

If no topic-momentum output found in logs, note it as "no recent topic-momentum run."

### 3. Load narrative-tracker signals

Same log scan as step 2. From the most recent `## Narrative Tracker` section, extract:
- Narratives labeled `RISING` or `EMERGING`
- Their current phase and momentum direction

### 4. Load recent article coverage (dedup)

Use Glob on `articles/*.md`. Sort by filename date descending. Take the 30 most recent.

For each, extract the date from the filename and the H1 title from the first line. Build a **covered list**: `[{ date, title }]`.

Any article filed in the last 7 days → suppress any queue entry that covers the same topic (fuzzy match: shared key noun or phrase).

Any article filed 8–21 days ago → downrank matching queue entries by 2 points.

### 5. Score and rank the queue

Create a unified candidate list from all sources. Score each candidate:

| Criterion | Points |
|-----------|--------|
| Beat-ready (≥3 beats) | 15 |
| Warming (2 beats, recent ≤5d) | 8 |
| topic-momentum gap score ≥ 10 | 6 |
| topic-momentum gap score 6–9 | 4 |
| topic-momentum gap score ≤ 5 | 2 |
| narrative-tracker RISING | 3 |
| narrative-tracker EMERGING | 2 |
| Not covered in last 30 days | +3 |
| Covered 8–21 days ago | -2 |
| Covered in last 7 days | discard |
| Soul-fit (maps to the core interests in soul/SOUL.md; skip this criterion if soul is absent) | +2 |

Keep top 5. Discard below score 2.

### 6. Write the queue file

Overwrite `memory/topics/article-queue.md`:

```markdown
# Article Queue

Last updated: {today}
Source run: topic-momentum ({date found} | "not found") + beat-tracker ({N} threads) + narrative-tracker ({date found} | "not found")

## Ranked Picks

### 1. {Topic Name} [URGENT | READY | FRESH]
- **Score:** {N}
- **Source:** beat-tracker ({N} beats) | topic-momentum (gap score {N}) | narrative-tracker (RISING)
- **Why now:** {one sentence — what makes this timely. specific data point or beat development.}
- **Suggested angle:** {one sentence — the contrarian or non-obvious frame the operator would take}
- **Format hint:** {essay | cold-open | X-vs-Y | data-driven | short-take} — why this format fits
- **Suppress after:** {today + 14 days} — if no article by this date, re-score next week

### 2. ...

### 3. ...

(up to 5 entries)

## Stale / Suppressed

{entries that scored below threshold or were suppressed by recent coverage}
```

### 7. Update MEMORY.md pointer

Find the line in `memory/MEMORY.md` that begins with `- [Article Queue]` and update it to reflect today's top pick. If the line doesn't exist, add it under the `## Topic Files` section:

```
- [Article Queue](topics/article-queue.md) — {top pick name} [{URGENT|READY|FRESH}] + {2nd pick name} + {3rd pick name} (updated {today})
```

This is the line the article skill will encounter when it reads MEMORY.md.

### 8. Send notification

Write notification to `.pending-notify-temp/article-queue-${today}.md`. Create dir if missing.

Only notify if:
- At least one beat-ready thread (URGENT), OR
- Queue changed from last week (new #1 pick), OR
- A warming thread just crossed to beat_count 2 this week

Notification format (keep under 400 chars):
```
article queue — {today}

{if URGENT:}
READY TO WRITE — {beat count} beats:
→ {topic}: {one punchy hook sentence in the operator's voice}

{if no URGENT, queue updated:}
queue updated. top pick: {topic} ({source} — {why now, one line}).

read it: https://github.com/aaronjmars/aeon/blob/main/memory/topics/article-queue.md
```

Then run:
```bash
./notify -f .pending-notify-temp/article-queue-${today}.md
```

If nothing urgent and queue didn't change: skip notification.

### 9. Log to memory/logs/${today}.md

Append:
```markdown
## Article Queue
- **Sources:** beat-tracker ({N} threads, {N} article-ready) | topic-momentum ({date} run) | narrative-tracker ({date} run)
- **Top pick:** {topic name} (score {N}, {source})
- **Queue size:** {N} entries
- **URGENT items:** {topic names | "none"}
- **Suppressed:** {N} entries (covered in last 7d)
- **Updated:** memory/topics/article-queue.md
- ARTICLE_QUEUE_OK
```

If no valid signals found across all sources:
```markdown
## Article Queue
- ARTICLE_QUEUE_SKIP: {reason — e.g. "no logs found", "all candidates suppressed by recent coverage"}
```

## Required Env Vars

None. Uses Glob/Read/Write tools and local memory files only.

## Sandbox Note

No network calls needed. All inputs are local memory files. Output is local file write + `./notify -f`.

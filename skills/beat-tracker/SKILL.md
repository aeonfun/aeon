---
name: beat-tracker
description: Multi-beat news thread tracker — persists beat counts per active storyline, searches for new developments, alerts when a thread hits the article-ready threshold (3rd beat)
schedule: "0 9 * * 3"
tags: [content, meta, research]
---

Today is ${today}. Read memory/MEMORY.md (and soul/SOUL.md if present) before starting.

## Why this skill exists

tweet-roundup and reflect note when a storyline gets a new beat — but that state lives in daily logs, not in a persistent counter. By the time a thread hits 3 beats (article-ready), the signal is buried across 3 different log entries and nobody fires the alert. This skill fixes that: persistent beat counts per storyline, automated threshold detection, no manual tracking required.

A **beat** is a distinct new development in an ongoing news story: a new source weighing in, a new actor making a statement, a new policy move, a price/volume reaction. Three beats in <30 days = the story has enough material to write about.

This fills the gap between:
- **topic-momentum** (scores what to write based on signal frequency) — broad, pattern-based
- **narrative-tracker** (EMERGING/RISING/PEAK/FADING phases) — narrative-level, not event-level
- **beat-tracker** (THIS) — event-level, specific stories, fires when threshold is crossed

## Steps

### 1. Load beat state

Read `memory/topics/beat-tracker.md`.

If the file doesn't exist, initialize it as an empty Active Threads list:

```
# Beat Tracker

Last updated: ${today}

## Active Threads

(none — will populate from memory on first inject pass)

## Closed Threads

(none yet)
```

Parse all threads under `## Active Threads`. For each thread, extract:
- Thread name
- Search query
- Status (active / article-ready / stale)
- Beat count
- Last checked date
- List of existing beats (date + source + summary)

### 2. Inject new threads from memory

Scan these sources for threads NOT already in beat-tracker.md:

**a) MEMORY.md content signals:**
Read `memory/MEMORY.md`. Look for content-signal notes that mention multi-beat storylines with at least 2 beats. Extract them.

Pattern to detect: "N beats" or "beat count: N" or "2 parallel threads" near a topic name.

**b) Recent logs (last 7 days):**
Use Glob on `memory/logs/*.md`. Take the 7 most recent by filename. Scan each for lines mentioning "beat" next to a number ≥ 2, or "thread" with a beat count. Extract thread name and any dated beat events listed.

For each newly discovered thread:
- Infer a **search query** from the topic name (2–5 keywords, specific enough to find news, not so broad it matches noise)
- Pull any historical beats already mentioned in the logs (date + source)
- Add to Active Threads with those historical beats pre-loaded
- Set `last_checked: ${today}`

If zero new threads are discovered and Active Threads is empty: log `BEAT_TRACKER_SKIP: no threads to track — check memory injection` and stop.

### 3. Search for new beats

For each thread in Active Threads where `status != stale`:

Run a **WebSearch** using the thread's search query. Focus on results from the past 7 days (mention the date window in your query, e.g. "after:{date 7 days ago}").

Evaluate results for **new beats** not already listed in the beats array:
- Different source/actor than existing beats
- New factual development (not a repost/recap of old news)
- Occurred AFTER the most recent beat date in the list

If a new beat is found:
- Add: `- ${today}: {Source/Handle} — {one-line factual summary}`
- Increment beat_count by 1
- Update last_checked: ${today}

If no new beat: update last_checked only (no increment).

### 4. Flag thresholds

After updating all threads:

**Article-ready (≥3 beats):**
Set `status: article-ready`. Prepare a hook line in the operator's voice (soul files):
- Observe what the 3-beat pattern reveals (not just what happened)
- Diagnose why it keeps getting a new beat
- End on the implication — punchy, no hedge

**Warming up (2 beats, most recent beat within 5 days):**
Note these as "watch closely" — one beat from article-ready.

**Stale (0 new beats for 14+ days AND beat_count < 3):**
Set `status: stale`. Will be moved to Closed Threads in step 6.

### 5. Cross-check articles

Use Glob on `articles/*.md`. For any article-ready thread, check if an article was already published on this topic (scan article filenames and H1s from the past 30 days).

If yes: mark thread as `status: converted` with the article date. Move to Closed Threads.

### 6. Write updated state

Overwrite `memory/topics/beat-tracker.md`:

```markdown
# Beat Tracker

Last updated: {today}

## Active Threads

### {Thread Name}
- **Query:** {search terms used to find new beats}
- **Topic:** {one-line description of the storyline}
- **Status:** active | article-ready | stale
- **Article ready:** YES ({N} beats) | NO ({N} beats, need 3+)
- **Last checked:** {today}
- **Beats:**
  - {date}: {Source} — {one-line summary}
  - {date}: {Source} — {one-line summary}
- **Beat count:** {N}

(repeat for each active thread)

## Closed Threads

### {Thread Name}
- **Status:** stale | converted
- **Reason:** {14d no new beat | article published {date}}
- **Final beat count:** {N}
- **Closed:** {today}
```

### 7. Send notification

Write the notification to a temp file, then run `./notify -f`.

Only notify if:
- At least one thread is `article-ready` (≥3 beats), OR
- At least one thread jumped to beat count 2 this run (warming up), OR
- At least one new thread was injected this run

Notification content:

```
beat tracker — {today}

{if article-ready threads:}
ARTICLE READY — {beat_count} beats:
→ {thread name}: {hook line in the operator's voice}

{if warming-up (beat 2 newly):}
one beat away:
→ {thread name}: {latest beat summary}

{if new threads injected:}
tracking {N} new threads

{if quiet run — no alerts:}
{N} threads tracked. highest: {beat_count} beats on {thread name}. nothing article-ready yet.
```

Write to `.pending-notify-temp/beat-tracker-${today}.md`. Create the dir if missing. Then:

```bash
./notify -f .pending-notify-temp/beat-tracker-${today}.md
```

Keep under 500 chars. Do NOT use `./notify "$(cat ...)"` — the sandbox trips on long multi-line argv; the `-f` flag reads the file inside the script.

If `BEAT_TRACKER_SKIP` was logged in step 2: skip notification entirely.

### 8. Log to memory/logs/${today}.md

Append:

```markdown
## Beat Tracker
- **Threads tracked:** {N}
- **New beats found:** {N (thread names)}
- **Article-ready:** {thread names | "none"}
- **Newly injected:** {thread names | "none"}
- **Pruned stale:** {thread names | "none"}
- **Updated:** memory/topics/beat-tracker.md
- BEAT_TRACKER_OK
```

## Required Env Vars

None. Uses WebSearch (built-in tool) and local memory files only.

## Sandbox Note

No curl calls needed. WebSearch is a built-in Claude Code tool — bypasses the sandbox network block. All reads/writes are local filesystem via Read/Write/Glob tools.

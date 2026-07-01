---
name: article-queue
category: research
description: Content planner — tracks multi-beat storylines over time (beat continuity via WebSearch), scans content gaps for uncovered angles, and synthesizes both (plus narrative-tracker signals) into a ranked article queue the article skill reads on its next run. `var` scopes to the combined planner (default), gap-scan only, or beat-tracking only, with an optional domain filter.
var: ""
schedule: "0 11 * * 0"
tags: [content, meta, research]
---
> **${var}** — Scope selector + optional domain filter, space/colon separated. Empty (default) → the **combined planner**: refresh beats, scan gaps, then write the ranked queue. `beats` → storyline-tracking only. `gaps` → content-gap scan only. Append or supply a domain to filter the gap scan and bias the queue (e.g. `gaps:crypto`, or a bare `crypto` for the combined planner scoped to one domain). Reserved scope words: `all`/`queue` (combined), `beats`, `gaps`. Examples: `` (combined, all domains) · `beats` (mid-week beat sweep) · `gaps:AI` (AI-only gap scan) · `prediction-markets` (combined, that domain).

Today is ${today}. Read `memory/MEMORY.md` and the last ~3 days of `memory/logs/` before starting.

## Why this skill exists

This is the operator's **content planner**. Three gaps used to be filled by three separate skills; this one closes all of them and then synthesizes their signal into a single ranked queue the article skill picks from:

- **Storyline tracking (beats).** `tweet-roundup` and `reflect` note when a storyline gets a new beat, but that state lives scattered across daily logs — by the time a thread hits 3 beats (article-ready), the signal is buried across 3 different entries and nobody fires the alert. The Beats phase keeps persistent beat counts per storyline, searches for new developments, and fires when the article-ready threshold is crossed. Event-level, specific stories.
- **Content-gap scan.** The article skill picks one trending topic per run; nothing cross-references **what's been covered** against **what keeps surfacing**, so timely angles get missed or covered weeks late. The Gaps phase is a pattern detector that finds the signal the operator keeps receiving but hasn't written about. Pattern-level, frequency-based.
- **Queue synthesis.** The article skill reads `memory/MEMORY.md` but picks topics from scratch every run — a 3-beat thread can sit article-ready for days while the article skill writes about something else. The Synthesis phase ranks the fresh beat threads, the fresh content gaps, and narrative-tracker's EMERGING/RISING phases into `memory/topics/article-queue.md`, which the article skill encounters via MEMORY.md naturally.

A **beat** is a distinct new development in an ongoing news story: a new source weighing in, a new actor making a statement, a new policy move, a price/volume reaction. Three beats in <30 days = the story has enough material to write about.

Queue priority order (Synthesis phase):
1. **Beat-ready** (≥3 beats) — the story is cooked. Write it now.
2. **Warming up** (2 beats, most recent beat ≤5 days ago) — one beat away.
3. **Gap-scan picks** — scored by gap score, freshness, soul-fit.
4. **Narrative-tracker RISING/EMERGING** not yet written about.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice when drafting any hook line (gap angles, beat-ready hooks) and every notification body. If they are empty templates or absent, use a clear, direct, neutral tone — short, declarative, position-first.

## Selector & dispatch

Parse `${var}`:
- Split on whitespace/colon. The **first token**, if it is a reserved scope word (`all`, `queue`, `beats`, `gaps`), sets the **scope**; otherwise scope defaults to `all` (combined) and the whole value is treated as the domain filter.
- Any remaining text (or the whole value when no scope word leads) is the **domain filter** (e.g. `crypto`, `AI`, `prediction-markets`), matched substring/keyword against theme names in the Gaps phase and used to bias the Synthesis ranking toward that domain (downrank clearly off-domain candidates). Empty domain = no filter (scan every domain declared in `content-domains.md`).

Dispatch:
| Scope | Runs | Primary output |
|---|---|---|
| `all` / `queue` / *(empty)* | **Phase B → Phase G → Phase S** | `memory/topics/article-queue.md` (+ refreshed `beat-tracker.md` + `content-gaps.md`) |
| `beats` | **Phase B** only | `memory/topics/beat-tracker.md` |
| `gaps` | **Phase G** only | `memory/topics/content-gaps.md` |

The combined planner is the default. `beats` and `gaps` exist so an operator can schedule a lighter mid-cycle run (e.g. a Wednesday `beats` sweep alongside the weekly Sunday combined run) — wiring lives in `aeon.yml`, not here.

## Config (shared)

Domain filters and signal-source aliases live in `memory/topics/content-domains.md`. If the file doesn't exist, create the seed below and continue with the default (no filter):

```markdown
# Content Domains

## Domains
- crypto
- AI
- prediction-markets
- macro
- protocols

## Signal Sources
(Skill log section names that produce candidate signals. Add more as you wire up trackers.)

- narrative-tracker     # rising/peaking narratives
- tweet-roundup         # topic-grouped tweet picks
- paper-pick            # research papers
- repo-actions          # GitHub-ecosystem ideas

## Topic Memory Files
(Files in memory/topics/ that hold cross-run context the gap scanner should also read.)

- market-context.md
- papers.md
```

---

## Phase B — Storyline tracking (beats)

*Runs for scope `all` and `beats`. Uses WebSearch (built-in) + local memory files.*

### B1. Load beat state

Read `memory/topics/beat-tracker.md`. If it doesn't exist, initialize it as an empty Active Threads list:

```
# Beat Tracker

Last updated: ${today}

## Active Threads

(none — will populate from memory on first inject pass)

## Closed Threads

(none yet)
```

Parse all threads under `## Active Threads`. For each thread, extract: Thread name, Search query, Status (active / article-ready / stale), Beat count, Last checked date, List of existing beats (date + source + summary).

### B2. Inject new threads from memory

Scan these sources for threads NOT already in `beat-tracker.md`:

**a) MEMORY.md content signals:** Read `memory/MEMORY.md`. Look for content-signal notes that mention multi-beat storylines with at least 2 beats. Pattern to detect: "N beats" or "beat count: N" or "2 parallel threads" near a topic name.

**b) Recent logs (last 7 days):** Use Glob on `memory/logs/*.md`. Take the 7 most recent by filename. Scan each for lines mentioning "beat" next to a number ≥ 2, or "thread" with a beat count. Extract thread name and any dated beat events listed.

For each newly discovered thread:
- Infer a **search query** from the topic name (2–5 keywords, specific enough to find news, not so broad it matches noise).
- Pull any historical beats already mentioned in the logs (date + source).
- Add to Active Threads with those historical beats pre-loaded. Set `last_checked: ${today}`.

If zero new threads are discovered and Active Threads is empty: record `BEAT_TRACKER_SKIP: no threads to track — check memory injection` for the Log, skip the rest of Phase B (and, in combined mode, continue to Phase G).

### B3. Search for new beats

For each thread in Active Threads where `status != stale`:

Run a **WebSearch** using the thread's search query. Focus on results from the past 7 days (mention the date window in your query, e.g. `after:{date 7 days ago}`).

Evaluate results for **new beats** not already listed in the beats array:
- Different source/actor than existing beats
- New factual development (not a repost/recap of old news)
- Occurred AFTER the most recent beat date in the list

If a new beat is found: add `- ${today}: {Source/Handle} — {one-line factual summary}`, increment `beat_count` by 1, update `last_checked: ${today}`. If no new beat: update `last_checked` only (no increment).

### B4. Flag thresholds

After updating all threads:
- **Article-ready (≥3 beats):** Set `status: article-ready`. Prepare a hook line in the operator's voice — observe what the 3-beat pattern reveals (not just what happened), diagnose why it keeps getting a new beat, end on the implication (punchy, no hedge).
- **Warming up (2 beats, most recent beat within 5 days):** Note as "watch closely" — one beat from article-ready.
- **Stale (0 new beats for 14+ days AND beat_count < 3):** Set `status: stale`. Will be moved to Closed Threads in B6.

### B5. Cross-check articles

Use Glob on `articles/*.md`. For any article-ready thread, check if an article was already published on this topic (scan article filenames and H1s from the past 30 days). If yes: mark thread `status: converted` with the article date and move it to Closed Threads.

### B6. Write updated beat state

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

Record for the Log: threads tracked, new beats found (thread names), article-ready (thread names or "none"), newly injected (or "none"), pruned stale (or "none"), and `BEAT_TRACKER_OK`.

---

## Phase G — Content-gap scan (gaps)

*Runs for scope `all` and `gaps`. All reads local; WebSearch only as a last resort (see Sandbox Note). If `${var}` carries a domain, restrict the gap-scan to themes matching that domain (substring/keyword match against the theme name).*

### G1. Load recent article coverage

Use Glob to list `.md` files in `articles/` modified in the last 30 days (filename pattern `YYYY-MM-DD.md` makes this easy). For each file: read the H1 and first 2 sentences — extract the core topic and angle; note the date from the filename.

Build a **covered-topics list**: `[{ date, topic, angle }]`, with these recency weights for G3:
- Articles ≤ 7 days old: "very recent" → suppress re-suggestion (−5 in scoring)
- Articles 8–14 days old: "recent" → penalize (+1 only)
- Articles 15–30 days old: still penalized lightly (+3)
- Articles > 30 days old or never written: full credit (+5)

### G2. Load narrative signals from recent logs

Read `memory/logs/` for the last 7 days (Glob `memory/logs/*.md`, sort by name, take last 7). From each daily log, extract entries under each `Signal Source` declared in `content-domains.md`. For each entry extract: the theme/narrative name; whether it was labeled "rising", "peaking", or otherwise high-signal; how many sources/days surfaced it.

Also read each `Topic Memory File` from `content-domains.md` (default: `memory/topics/market-context.md`, `memory/topics/papers.md`) for current macro themes and hot narratives.

Build a **signal-map**: `{ theme: { frequency_score, source_list, first_seen, last_seen } }`. If `${var}` carries a domain, filter the signal-map to themes matching that domain.

### G3. Score the gaps

For each theme in signal-map:

| Criterion | Points |
|---|---|
| Surfaced 5+ days/sources in last 7d | +5 |
| Surfaced 3–4 days/sources | +3 |
| Surfaced 1–2 days/sources | +1 |
| Never written about | +5 |
| Last covered 15+ days ago | +3 |
| Last covered 8–14 days ago | +1 |
| Last covered in past 7 days | −5 (suppress) |
| Domain-fit: matches a declared domain in content-domains.md | +1 |

**Max score: ~14.** Drop themes with net score < 2. Rank descending. Pick top 3.

### G4. Develop the angles

For each top-3 gap:
- Define a **specific angle** — not "write about X" but "X from the angle of Y; the thing everyone's missing is Z".
- Draft a **hook line** (voice per the Voice section).
- Note **what triggered it** (sources from G2).
- Note **last coverage** date or "never".

### G5. Write content gaps

Write `memory/topics/content-gaps.md` (overwrite):

```markdown
# Content Gaps — Last Updated: ${today}

## Top 3 Angles (Ranked by Signal Score)

### 1. <Theme Name> — Score: N/14
**Angle:** <specific take — not generic>
**Hook:** <suggested opener>
**Sources:** <what surfaced this, e.g. "narrative-tracker 4d, tweet-roundup 3d">
**Last coverage:** <date or "never">

### 2. <Theme Name> — Score: N/14
...

### 3. <Theme Name> — Score: N/14
...

---
*Generated by article-queue (gaps phase) on ${today}. Consumed by: article skill, remix-tweets.*
```

Record for the Log: themes scanned, gaps scored, top 3 (names), lowest gap score included (N/14), `content-gaps.md` updated, and `TOPIC_MOMENTUM_OK`. If fewer than 3 scoreable gaps were found: record `TOPIC_MOMENTUM_SKIP: insufficient signal (<3 themes above threshold)` instead — in `gaps`-only mode this means no notification.

---

## Phase S — Queue synthesis

*Runs for scope `all` only, after Phases B and G. Reads the fresh state those phases just wrote (`beat-tracker.md`, `content-gaps.md`) plus narrative-tracker signals and article coverage, then ranks everything into `article-queue.md`.*

### S1. Load beat signals

Read the freshly written `memory/topics/beat-tracker.md` (from Phase B; if Phase B skipped or the file is absent, log a note and proceed without beat signals). For each active thread extract: name, status, beat count, most recent beat date, latest beat summary. Flag threads with `status: article-ready` (≥3 beats) as **URGENT**; flag threads with `beat_count == 2` and last beat ≤5 days as **WARMING**.

### S2. Load gap signals

Read the freshly written `memory/topics/content-gaps.md` (from Phase G) and take its Top 3 angles (title + gap score N/14 + one-line angle). If it's absent this run, fall back to the most recent `## Topic Momentum`/planner gaps section across the last 7 daily logs (Glob `memory/logs/*.md`, take 7 newest); if none, note "no recent gap scan."

### S3. Load narrative-tracker signals

Scan the last 7 daily logs (same Glob). From the most recent `## Narrative Tracker` section, extract narratives labeled `RISING` or `EMERGING` plus their current phase and momentum direction. (narrative-tracker is a separate skill; this reads its log output.)

### S4. Load recent article coverage (dedup)

Use Glob on `articles/*.md`. Sort by filename date descending; take the 30 most recent. For each, extract the date from the filename and the H1 title from the first line. Build a **covered list** `[{ date, title }]`. Any article filed in the last 7 days → suppress any queue entry covering the same topic (fuzzy match: shared key noun or phrase). Any article filed 8–21 days ago → downrank matching queue entries by 2 points.

### S5. Score, rank, and write the queue

Create a unified candidate list from all sources (beats, gaps, narratives). Score each candidate:

| Criterion | Points |
|-----------|--------|
| Beat-ready (≥3 beats) | 15 |
| Warming (2 beats, recent ≤5d) | 8 |
| Gap score ≥ 10 | 6 |
| Gap score 6–9 | 4 |
| Gap score ≤ 5 | 2 |
| narrative-tracker RISING | 3 |
| narrative-tracker EMERGING | 2 |
| Not covered in last 30 days | +3 |
| Covered 8–21 days ago | −2 |
| Covered in last 7 days | discard |
| Soul-fit (maps to the core interests in soul/SOUL.md; skip this criterion if soul is absent) | +2 |

If `${var}` carries a domain filter, downrank candidates clearly outside that domain (drop below threshold if plainly off-domain). Keep top 5. Discard below score 2.

Overwrite `memory/topics/article-queue.md`:

```markdown
# Article Queue

Last updated: {today}
Source run: gaps ({date found} | "not found") + beats ({N} threads) + narrative-tracker ({date found} | "not found")

## Ranked Picks

### 1. {Topic Name} [URGENT | READY | FRESH]
- **Score:** {N}
- **Source:** beats ({N} beats) | gaps (gap score {N}) | narrative-tracker (RISING)
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

Then update the MEMORY.md pointer: find the line in `memory/MEMORY.md` beginning with `- [Article Queue]` and update it to today's top pick; if it doesn't exist, add it under the `## Topic Files` section:

```
- [Article Queue](topics/article-queue.md) — {top pick name} [{URGENT|READY|FRESH}] + {2nd pick name} + {3rd pick name} (updated {today})
```

This is the line the article skill encounters when it reads MEMORY.md.

Record for the Log: sources (beats/gaps/narrative with dates), top pick (name, score, source), queue size, URGENT items (or "none"), suppressed count, `article-queue.md` updated, and `ARTICLE_QUEUE_OK`. If no valid signals found across all sources: record `ARTICLE_QUEUE_SKIP: {reason — e.g. "no logs found", "all candidates suppressed by recent coverage"}`.

---

## Notify

Write the notification to a temp file, then run `./notify -f` (create `.pending-notify-temp/` if missing). Do NOT use `./notify "$(cat ...)"` — the sandbox trips on long multi-line argv; the `-f` flag reads the file inside the script. **Notify only on signal.** Send exactly one notification, chosen by mode:

### Combined mode (scope `all`) — lead with the queue

Write `.pending-notify-temp/article-queue-${today}.md`. Only notify if: at least one beat-ready thread (URGENT), OR the queue changed from last week (new #1 pick), OR a thread just crossed to beat_count 2 this week. Keep under 400 chars:

```
article queue — {today}

{if URGENT:}
READY TO WRITE — {beat count} beats:
→ {topic}: {one punchy hook sentence in the operator's voice}

{if no URGENT, queue updated:}
queue updated. top pick: {topic} ({source} — {why now, one line}).

read it: https://github.com/aaronjmars/aeon/blob/main/memory/topics/article-queue.md
```

If nothing urgent and the queue didn't change: skip notification.

### `beats` mode

Write `.pending-notify-temp/beat-tracker-${today}.md`. Only notify if: at least one thread is `article-ready` (≥3 beats), OR at least one thread jumped to beat count 2 this run (warming up), OR at least one new thread was injected this run. If `BEAT_TRACKER_SKIP` was recorded, skip entirely. Keep under 500 chars:

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

### `gaps` mode

Write `.pending-notify-temp/topic-momentum-${today}.md`. If `TOPIC_MOMENTUM_SKIP` was recorded (fewer than 3 scoreable gaps), skip entirely. Keep total under 800 chars:

```
topic momentum — ${today}

3 angles with high signal, no recent article:

1. <theme name> — <angle in one line>
2. <theme name> — <angle in one line>
3. <theme name> — <angle in one line>

full breakdown: memory/topics/content-gaps.md
```

Then, for whichever file you wrote:

```bash
./notify -f .pending-notify-temp/<the-file-you-wrote>.md
```

## Log

Append ONE entry to `memory/logs/${today}.md` under a single `### article-queue` heading, with a `**Mode:**` discriminator line naming the branch that ran. Preserve each phase's status code (`BEAT_TRACKER_OK`/`_SKIP`, `TOPIC_MOMENTUM_OK`/`_SKIP`, `ARTICLE_QUEUE_OK`/`_SKIP`) as bullets so the health loop can parse them.

**Combined mode:**
```markdown
### article-queue
- **Mode:** combined (beats + gaps + queue)
- **Beats:** {N} threads tracked | new beats: {N (thread names)} | article-ready: {names|none} | injected: {names|none} | pruned: {names|none} — BEAT_TRACKER_OK   (or BEAT_TRACKER_SKIP: {reason})
- **Gaps:** {N} themes scanned, {N} scored | top 3: {t1}, {t2}, {t3} | lowest included: {N}/14 — TOPIC_MOMENTUM_OK   (or TOPIC_MOMENTUM_SKIP: insufficient signal)
- **Queue:** top pick {name} (score {N}, {source}) | size {N} | URGENT: {names|none} | suppressed {N} — updated memory/topics/article-queue.md — ARTICLE_QUEUE_OK   (or ARTICLE_QUEUE_SKIP: {reason})
```

**`beats` mode:** `### article-queue` + `- **Mode:** beats` then the Beats bullet and `BEAT_TRACKER_OK`/`_SKIP`.

**`gaps` mode:** `### article-queue` + `- **Mode:** gaps` then the Gaps bullet and `TOPIC_MOMENTUM_OK`/`_SKIP`.

## Required Env Vars

None. Uses Glob/Read/Write and the built-in **WebSearch** tool; all state comes from local `memory/` and `articles/` files. No external API keys, no curl, no prefetch/postprocess scripts.

## Sandbox Note

No secret-bearing network calls. The Beats phase relies on **WebSearch** (a built-in Claude tool that bypasses the sandbox network block) to find new beats — no curl needed. The Gaps and Synthesis phases read only local memory files written by other skills; if `memory/logs/` is sparse (e.g. first run), fall back to reading the `Topic Memory Files` declared in `content-domains.md` directly as the signal source, and use **WebSearch** as a last resort for current narrative heat if local data is too thin (rarely needed). All output is local file writes plus `./notify -f`.

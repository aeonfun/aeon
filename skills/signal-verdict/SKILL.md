---
name: signal-verdict
description: Accountability check on a configured set of tracker skills. Verifies each tracker is producing citable signals in articles/newsletters. Surfaces uncited trackers so the operator can demote or kill them.
schedule: "0 8 * * 1"
commits: true
permissions:
  - contents:write
tags: [meta, ops]
---

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice for the notification. If they are empty templates or absent, write in a clear, direct, neutral tone — position first, no hedging, no corporate softeners.

## Why this skill exists

When you ship many tracker skills in a short window, it's easy to lose track of which trackers are actually feeding written output and which are just running. `skill-health` answers "did the skill run?" — `signal-verdict` answers a different question: **did the output inform anything that got published outward?** Trackers that fail this check repeatedly should be demoted (less-frequent schedule) or retired.

## Config

This skill is parameterized via `memory/topics/tracked-skills.md`. If the file doesn't exist, create the seed below and exit on this run (no notification — operator needs to fill it in):

```markdown
# Tracked Skills (signal-verdict)

## Verdict Bar
- **Deadline:** <YYYY-MM-DD>   # by this date, each tracker must have ≥1 citation
- **Rule:** Each tracker must cite a signal in a daily/newsletter article between its first run and the deadline, or get demoted.

## Trackers Under Review

| Tracker | First Run | Verdict Bar | Status | Citation Weeks | Total Weeks |
|---------|-----------|-------------|--------|----------------|-------------|
| <skill-name> | YYYY-MM-DD | YYYY-MM-DD | pending | 0 | 0 |

## Keyword Map

```yaml
<skill-name>:
  - "<keyword 1>"
  - "<keyword 2>"
<skill-name-2>:
  - "<keyword 1>"
```

## Weekly Log
(populated on each run)
```

Each `Tracker` row + the matching `Keyword Map` entry defines one tracker under review. To add or remove a tracker, edit this file — no skill code changes.

## Steps

### 1. Load context

Read `memory/MEMORY.md` and the tracker list + keyword map from `memory/topics/tracked-skills.md`. Extract:
- Per-tracker current status and citation counts
- Date of last run
- Verdict deadline
- Keyword map (used in step 3)

If the keyword map is empty for a tracker, log a warning and skip that tracker for this run.

### 2. Find articles from the past 14 days

```bash
ls articles/ | grep -E "^[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$" | sort | tail -14
ls articles/ | grep -E "newsletter|weekly" | sort | tail -10
```

Read each file. **Exclude** ops articles (these don't count as "outward content"):
- `articles/self-review-*.md`
- `articles/skill-evals-*.md`
- `articles/vuln-scan-*.md`
- `articles/batch-health-*.md`
- `articles/repo-pulse-*.md`

What counts as "outward content":
- Daily articles (`articles/YYYY-MM-DD.md`)
- Weekly newsletters (`articles/newsletter-*.md`, `articles/weekly-*.md`)
- Any article whose main thesis or a substantive section discusses the tracker's topic area

### 3. Score each tracker for this week

For each tracker in the keyword map, search the article texts (from step 2) for any keyword match. A tracker is:

- **CITED** if at least one of its keywords appears in a substantive paragraph (not just a passing reference) of an outward-content article from the last 7 days
- **UNCITED** if no qualifying mention exists

**Citation threshold:** Minimum 1 substantive mention. A log entry in `memory/logs/` does NOT count — this check is about content published outward. A passing mention in a notification preamble does NOT count.

### 4. Compute verdict status

For each tracker:
- **CITED** this week: `citation_weeks += 1`, `total_weeks += 1`
- **UNCITED** this week: `total_weeks += 1` only

**Verdict determination** (only if today ≥ deadline):
- `citation_weeks ≥ 1` → **PASS** (keep on current schedule)
- `citation_weeks == 0` → **FAIL** (demote to monthly)

If today < deadline: status stays `pending`, but track the running score.

**Running labels** (used in the notification):
- `0/N` weeks cited — at risk
- `1–2/N` weeks cited — borderline
- `3+/N` weeks cited — tracking well

### 5. Update `memory/topics/tracked-skills.md`

- Rewrite the `Trackers Under Review` table with updated `Citation Weeks`, `Total Weeks`, and `Status`
- Append a `Weekly Log` entry:

```
- ${today}: [N/total cited] — cited: [tracker1, tracker2] | uncited: [tracker3, tracker4] | articles scanned: N
```

If any tracker status becomes `demote`, append a `## Demotion Queue` section listing each demoted tracker with the recommended `aeon.yml` schedule edit.

### 6. Notify

Write notification to `.pending-notify-temp/signal-verdict-${today}.md`, then:

```bash
./notify -f .pending-notify-temp/signal-verdict-${today}.md
```

Format (voice per the Voice section above):

Normal week:
```
signal verdict — ${today}

<N>/<total> trackers cited this week. <M> weeks to verdict bar (<deadline>).

cited:
- <tracker>: <article_date> — <one-line on the signal it contributed>

uncited:
- <tracker>: no article cited <main_topic_keyword> this week

⚠️ <tracker>: at risk — <N> weeks to deadline, 0 citations so far    ← only if any are at risk

state: memory/topics/tracked-skills.md
```

All cited:
```
signal verdict — ${today}

all <total> trackers cited this week. tracker fleet earning its schedule.
```

Verdict week (today ≥ deadline):
```
signal verdict — verdict run

<N>/<total> trackers pass. <M>/<total> demoted.

pass: <list>
demote → monthly: <list>

demotion: update aeon.yml schedule for <demoted_trackers> to monthly
```

Keep total under 700 chars. Skip notification only if this is the first run AND no articles exist yet — log `SIGNAL_VERDICT_OK: no articles yet` instead.

### 7. Log

Append to `memory/logs/${today}.md`:

```markdown
## Signal Verdict
- **Cited this week:** <N>/<total> — <list of cited trackers>
- **Uncited this week:** <list of uncited trackers or "none">
- **Articles scanned:** <count>
- **Weeks to verdict bar:** <days> days (<deadline>)
- **Verdict status:** <pass/fail/pending summary>
- SIGNAL_VERDICT_OK
```

If verdict bar passed and any tracker demoted:
```
- SIGNAL_VERDICT_DEMOTE: <tracker1>, <tracker2>
```

## Required Env Vars

None. Uses file reads and `./notify`. No external API calls.

## Sandbox Note

Pure file I/O — reads articles and writes memory files. No network calls needed. `./notify -f` handles the notification (use Write tool to create the file, then run `./notify -f path`).

## What counts as a citation

✓ Counts:
- Daily article (`articles/YYYY-MM-DD.md`) with substantive paragraph about the tracker's topic area
- Weekly newsletter with a section on the tracker's topic
- A thesis or angle that originated from the tracker's output, even if the tracker isn't named

✗ Does NOT count:
- Memory log entries or skill run logs
- Ops articles (self-review, skill-evals, vuln-scan, batch-health, repo-pulse)
- Passing mention in a notification preamble

## Notes

- This skill is a **meta-auditor** — it works for any tracker fleet the operator wires up.
- Add a tracker → add a row to the table + a stanza in the keyword map. No code changes.
- Remove a tracker → delete its row + keyword stanza. The next run drops it from the verdict.

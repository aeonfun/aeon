---
name: Weekly Review
description: KALM retrospective grounded in objective metrics, with closed-loop tracking of last week's actions and SMART next-week actions
var: ""
tags: [meta]
---
<!-- autoresearch: variation B — sharper output: KALM frame + close-the-loop + SMART actions -->
> **${var}** — Optional area to focus on (e.g. `crypto`, `notifications`). If empty, covers the whole system.

If `${var}` is set, scope every section below to that area only. Skip findings that don't touch it.

## Why this skill exists

A weekly review is only valuable if (a) findings rest on objective data, not vibes, and (b) findings turn into **specific actions that get checked next week**. This skill enforces both: pull metrics from multiple sources, frame findings as KALM (Keep/Add/Less/More), and emit each action as SMART (specific, measurable, owner, deadline) so the next run can audit follow-through.

## Inputs (gather all before writing)

Read in this order. If any source is empty or missing, note it explicitly in the article — don't silently skip.

1. **Context** — `memory/MEMORY.md` for goals; `soul/SOUL.md` for voice (skip if empty).
2. **Activity logs** — every `memory/logs/YYYY-MM-DD.md` from the last 7 days.
3. **Objective skill metrics** — run `./scripts/skill-runs --hours 168 --json` and parse pass/fail counts per skill. If the script fails or the JSON is empty, fall back to `cat memory/cron-state.json` and note the degraded source.
4. **Open issues** — `memory/issues/INDEX.md` (treat any new `open` issues this week as findings).
5. **Code activity** — `git log --since="7 days ago" --pretty=format:"%h %s"` to see what shipped (skills added/changed, fixes, PRs merged).
6. **Prior review** — the most recent `articles/weekly-review-*.md`. Extract its "Next week priorities" section — you will audit those actions in step 1 below.

## Steps

### 1. Close the loop on last week's actions (do this FIRST)

For each action item in the prior weekly-review's "Next week priorities":
- Did it ship? (Check git log + this week's logs for evidence.)
- If yes: note as **shipped** with the commit/log line that proves it.
- If no: classify as **slipped** (still relevant, carry over), **abandoned** (no longer needed, explain why), or **blocked** (needs unblocking — name the blocker).

If there is no prior weekly-review, write `_No prior review to audit — this is the baseline._` and continue.

### 2. Compile objective metrics

A short table at the top of the article. Use exact numbers from step 3-5 inputs above.

| Metric | This week | Prior week (if known) | Δ |
|---|---|---|---|
| Skill runs | N | M | ±X |
| Successes / failures | N / M | — | — |
| Articles written | N | — | — |
| Notifications sent | N | — | — |
| New issues opened | N | — | — |
| Issues resolved | N | — | — |
| Commits / PRs merged | N | — | — |

If you can't compute prior-week numbers (no prior article, missing data), leave the column blank — don't fabricate.

### 3. KALM findings, prioritized

Group findings into four buckets. **Each finding must cite at least one log line, commit, or issue ID** as evidence — no unsupported claims.

- **Keep** — what's working and should continue unchanged.
- **Add** — capabilities or sources missing this week that would have helped.
- **Less** — things consuming time/runs/notifications without proportional value (noisy alerts, redundant skill runs, churn).
- **More** — things that worked but are under-invested (a skill producing high-signal output that only ran twice, an issue category that needs more attention).

After listing, score each finding by **Frequency × Impact ÷ Effort** (1-5 each). Compute the priority number; sort descending. Keep the top 5; drop the rest. Generic items ("improve documentation") fail the priority threshold and must be dropped or rewritten.

### 4. Translate top findings into SMART next-week actions

For each of the top 3-5 prioritized findings, write a next-week action in this exact shape:

```
- [ ] {action verb} {specific change} in {file/skill/path} by {YYYY-MM-DD}
  - Why: {finding it addresses}
  - Done when: {observable outcome — a file exists, a metric crosses a threshold, a PR merges}
```

Owner is implicitly Aeon. Deadline must be within the next 7 days from `${today}`. If you can't write an action that concrete, the finding wasn't ready — drop it and note why.

### 5. Compare to goals in MEMORY.md

For each goal listed in `memory/MEMORY.md` "Next Priorities" (or whatever the current goals section is named):
- **Progress** — cite the specific log line or commit that moved it.
- **Stalled** — name the blocker.
- **Retire/revise** — propose explicitly if the goal no longer matches reality.

If MEMORY.md has no concrete goals (placeholder content), flag that as itself an Add finding.

### 6. Write the article

Save to `articles/weekly-review-${today}.md`. Required structure:

```markdown
# Weekly Review — ${today}

## TL;DR
{one paragraph: the single most important thing this week + the #1 action for next week}

## Last week's actions — closed loop
{from step 1}

## Metrics
{table from step 2}

## Findings (KALM, prioritized)
### Keep
### Add
### Less
### More

## Next week — actions
{from step 4, as the SMART checklist}

## Goals progress
{from step 5}

## Notes
{anything worth recording but not actionable: trivia, half-formed observations}
```

### 7. Send the notification

Via `./notify`, send **only if there is signal worth sharing**. Skip the notification (and note the skip in the article + log) if all of these hold: zero skill failures, zero new issues, zero next-week actions ranked priority ≥10. A silent week deserves a silent notification.

When you do notify, lead with the action, not the count:

```
*Weekly Review — ${today}*
Top action: {the #1 SMART action, in one line}
Health: N/M skill runs ok, K new issues
Full review: articles/weekly-review-${today}.md
```

### 8. Log to memory

Append to `memory/logs/${today}.md`:

```
### weekly-review
- Period: {7-day window covered}
- Metrics: N skill runs (M failures), K articles, J notifications
- Top finding: {one-line summary}
- Top action: {one-line summary, with deadline}
- Closed-loop result: X shipped / Y slipped / Z abandoned (of N prior actions)
- Article: articles/weekly-review-${today}.md
```

## Sandbox note

`./scripts/skill-runs` and `git log` run locally — no network. If `./scripts/skill-runs` errors out, fall back to `memory/cron-state.json` and mark the metrics row as `_degraded source_`. The notify step uses the post-process pattern (writes to `.pending-notify/`); do not retry on failure — the postprocess script handles it.

## Constraints

- **Evidence required.** Every finding cites a log line, commit, or issue ID. No unsupported claims.
- **No generic actions.** "Improve X" is a finding, not an action. If you can't make it SMART, drop it.
- **Audit before generating.** Always run step 1 (close the loop) first — skipping it breaks the feedback cycle this skill exists to enforce.
- **Don't pad.** A short, sharp review beats a long, mushy one. If only 2 findings clear the priority threshold, write 2.
- **Voice.** If `soul/SOUL.md` is populated, match it in the TL;DR and notification. Otherwise neutral.

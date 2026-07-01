---
name: Reflect
category: productivity
description: Reflect on recent activity — either consolidate and prune long-term memory (default), or run a KALM retrospective (Keep/Add/Less/More) grounded in objective metrics, with closed-loop tracking of prior actions and SMART next actions (retro)
var: ""
tags: [meta]
requires: [RESEND_API_KEY?]
---
> **${var}** — Selector + optional area filter. Empty (or a bare area name) runs the
> **reflect** branch (memory consolidation & pruning). A value starting with `retro`
> runs the **retro** branch (KALM retrospective). Any text after the selector keyword
> (or the whole value in the reflect branch) is an optional area to scope the work to.

## Preamble (run for every branch)

Today is ${today}.

1. Read `memory/MEMORY.md` for current goals and memory state.
2. Scan the last ~3 days of `memory/logs/` so you don't re-report or re-consolidate
   something already handled.
3. Parse `${var}` to pick the branch and the optional area filter:
   - **Selector** — if `${var}` starts with `retro`, run **Branch B — Retrospective**.
     Otherwise (empty or any other text), run **Branch A — Reflect**.
   - **Area filter** — the remaining text (for `retro`, whatever follows `retro`; for
     reflect, the whole value). If set, scope every section of the chosen branch to that
     area only and skip findings/notes that don't touch it. If empty, cover everything.

Selector examples:
- `` (empty) → reflect, whole system.
- `crypto` → reflect, focused on the crypto area.
- `retro` → retrospective, whole system.
- `retro crypto` → retrospective, scoped to the crypto area.

---

## Branch A — Reflect (memory consolidation & pruning)

Your task is to review the agent's recent activity and maintain long-term memory. Be
ruthless about pruning. Memory should be a living, useful document — not an append-only log.

### Steps

1. Read `memory/MEMORY.md` to understand current memory state (done in the preamble —
   re-skim if needed).
2. **Time-weighted log compaction (hardening §10).** Run
   `python3 scripts/compact_logs.py memory/logs --today ${today}` to get an age-banded
   plan. Fidelity falls off with age, so the context you load each run stays bounded
   no matter how old the agent gets:
   - **keep** band (≤7d) — read these verbatim for the consolidation below.
   - **summarize** band (8–30d) — fold each into a single paragraph in the relevant
     `memory/topics/` file, then they can go.
   - **drop** band (>30d) — already captured in topics; after summarizing, run the same
     command with `--apply` to delete the drop band.
3. Read the recent articles in `articles/` (last 7 days if available).
4. Consolidate what you've learned:
   - What topics have been covered recently? Note any patterns or gaps.
   - What features were built? Record key decisions and outcomes.
   - Are there any stale entries in MEMORY.md that are no longer relevant? Remove them.
   - Are there recurring errors or issues worth noting for future runs?
   - Check `memory/skill-health/*.json` for quality trends — note any skills with declining
     scores or persistent flags. Summarize overall skill health in the appropriate topic file.
5. **Distill, don't just append (the `/dream` discipline, hardening §10).** When you fold
   notes into memory, do three things, not one:
   - **Compress** — collapse repetition into the smallest true statement.
   - **De-contradict** — when two notes disagree, resolve it: the newer/corroborated one
     wins, and note that it changed. Never leave both standing.
   - **Verify before promoting** — only turn a vague observation into a stated fact if
     it's corroborated (a source, a number that reconciles, a second run). If it can't be
     verified, keep it tagged as a hypothesis, not a fact.
6. Reorganize memory:
   - Keep MEMORY.md as a short index (~50 lines): goals, active topics, and pointers to topic files.
   - Move detailed notes into `memory/topics/` files (e.g. `crypto.md`, `research.md`, `projects.md`).
   - If a topic file already exists, update it rather than creating a new one.
   - Never add a second `## Heading` with a name that already exists in MEMORY.md — update the
     existing section in place. Duplicate H2 headings are a known drift mode that otherwise has
     to be repaired later.
7. Log what you did (see **Log** below, discriminator `reflect`).
8. Send a notification via `./notify`: "Memory consolidated — ${today}".

---

## Branch B — Retrospective (KALM, metric-grounded, closed-loop)

<!-- autoresearch: variation B — sharper output: KALM frame + close-the-loop + SMART actions -->

A retrospective is only valuable if (a) findings rest on objective data, not vibes, and
(b) findings turn into **specific actions that get checked next week**. This branch enforces
both: pull metrics from multiple sources, frame findings as KALM (Keep/Add/Less/More), and
emit each action as SMART (specific, measurable, owner, deadline) so the next run can audit
follow-through. If an area filter is set, scope every section to that area only.

### Inputs (gather all before writing)

Read in this order. If any source is empty or missing, note it explicitly in the article —
don't silently skip.

1. **Context** — `memory/MEMORY.md` for goals; `soul/SOUL.md` for voice (skip if empty).
2. **Activity logs** — every `memory/logs/YYYY-MM-DD.md` from the last 7 days.
3. **Objective skill metrics** — run `./scripts/skill-runs --hours 168 --json` and parse
   pass/fail counts per skill. If the script fails or the JSON is empty, fall back to
   `cat memory/cron-state.json` and note the degraded source.
4. **Open issues** — `memory/issues/INDEX.md` (treat any new `open` issues this week as findings).
5. **Code activity** — `git log --since="7 days ago" --pretty=format:"%h %s"` to see what
   shipped (skills added/changed, fixes, PRs merged).
6. **Prior review** — the most recent `articles/retrospective-*.md` (if none exists, fall back
   to the most recent legacy `articles/weekly-review-*.md`). Extract its "Next week priorities"
   section — you will audit those actions in step 1 below.

### Steps

#### 1. Close the loop on last week's actions (do this FIRST)

For each action item in the prior retrospective's "Next week priorities":
- Did it ship? (Check git log + this week's logs for evidence.)
- If yes: note as **shipped** with the commit/log line that proves it.
- If no: classify as **slipped** (still relevant, carry over), **abandoned** (no longer
  needed, explain why), or **blocked** (needs unblocking — name the blocker).

If there is no prior retrospective, write `_No prior review to audit — this is the baseline._`
and continue.

#### 2. Compile objective metrics

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

If you can't compute prior-week numbers (no prior article, missing data), leave the column
blank — don't fabricate.

#### 3. KALM findings, prioritized

Group findings into four buckets. **Each finding must cite at least one log line, commit, or
issue ID** as evidence — no unsupported claims.

- **Keep** — what's working and should continue unchanged.
- **Add** — capabilities or sources missing this week that would have helped.
- **Less** — things consuming time/runs/notifications without proportional value (noisy
  alerts, redundant skill runs, churn).
- **More** — things that worked but are under-invested (a skill producing high-signal output
  that only ran twice, an issue category that needs more attention).

After listing, score each finding by **Frequency × Impact ÷ Effort** (1-5 each). Compute the
priority number; sort descending. Keep the top 5; drop the rest. Generic items ("improve
documentation") fail the priority threshold and must be dropped or rewritten.

#### 4. Translate top findings into SMART next-week actions

For each of the top 3-5 prioritized findings, write a next-week action in this exact shape:

```
- [ ] {action verb} {specific change} in {file/skill/path} by {YYYY-MM-DD}
  - Why: {finding it addresses}
  - Done when: {observable outcome — a file exists, a metric crosses a threshold, a PR merges}
```

Owner is implicitly Aeon. Deadline must be within the next 7 days from `${today}`. If you can't
write an action that concrete, the finding wasn't ready — drop it and note why.

#### 5. Compare to goals in MEMORY.md

For each goal listed in `memory/MEMORY.md` "Next Priorities" (or whatever the current goals
section is named):
- **Progress** — cite the specific log line or commit that moved it.
- **Stalled** — name the blocker.
- **Retire/revise** — propose explicitly if the goal no longer matches reality.

If MEMORY.md has no concrete goals (placeholder content), flag that as itself an Add finding.

#### 6. Write the article

Save to `articles/retrospective-${today}.md`. Required structure:

```markdown
# Retrospective — ${today}

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

#### 7. Send the notification

Via `./notify`, send **only if there is signal worth sharing**. Skip the notification (and note
the skip in the article + log) if all of these hold: zero skill failures, zero new issues, zero
next-week actions ranked priority ≥10. A silent week deserves a silent notification.

When you do notify, lead with the action, not the count:

```
*Retrospective — ${today}*
Top action: {the #1 SMART action, in one line}
Health: N/M skill runs ok, K new issues
Full review: articles/retrospective-${today}.md
```

#### 8. Send email via Resend

Send the full retrospective article (not just the `./notify` summary) to the board:
- Build the full retrospective as HTML (wrap each section in `<h2>` headers, `<ul>/<li>` bullets)
- Also keep a plain-text copy (the full retrospective text)
- Parse `$BRIEF_RECIPIENTS` as a comma-separated list of addresses
- POST to `https://api.resend.com/emails`:
  ```
  Authorization: Bearer $RESEND_API_KEY
  Content-Type: application/json

  {
    "from": "Aeon Briefings <onboarding@resend.dev>",
    "to": ["<each recipient>"],
    "subject": "[Aeon] Retrospective — ${today}",
    "html": "<html version of full review>",
    "text": "<plain-text version of full review>"
  }
  ```
- Log the `id` field from the Resend response as a comment on the current Paperclip execution
  issue for traceability
- If Resend returns an error, log the full error body as a comment and fail loudly (do not
  silently continue)

#### 9. Log to memory

Append to `memory/logs/${today}.md` (see **Log** below, discriminator `retro`).

### Retrospective constraints

- **Evidence required.** Every finding cites a log line, commit, or issue ID. No unsupported claims.
- **No generic actions.** "Improve X" is a finding, not an action. If you can't make it SMART, drop it.
- **Audit before generating.** Always run step 1 (close the loop) first — skipping it breaks the
  feedback cycle this branch exists to enforce.
- **Don't pad.** A short, sharp review beats a long, mushy one. If only 2 findings clear the
  priority threshold, write 2.
- **Voice.** If `soul/SOUL.md` is populated, match it in the TL;DR and notification. Otherwise neutral.

---

## Log

Append to `memory/logs/${today}.md` under ONE `### reflect` heading. The first bullet is a
discriminator naming which branch ran.

**Reflect branch:**

```
### reflect
- Branch: reflect (memory consolidation & pruning)
- Compacted: {N logs kept / M summarized into topics / K dropped}
- Consolidated: {topics touched, stale entries pruned, contradictions resolved}
- Skill health: {any declining scores or persistent flags noted}
- Area: {area filter, or "whole system"}
```

**Retrospective branch:**

```
### reflect
- Branch: retro (KALM retrospective)
- Period: {7-day window covered}
- Metrics: N skill runs (M failures), K articles, J notifications
- Top finding: {one-line summary}
- Top action: {one-line summary, with deadline}
- Closed-loop result: X shipped / Y slipped / Z abandoned (of N prior actions)
- Article: articles/retrospective-${today}.md
```

## Sandbox note

- **Reflect branch:** `scripts/compact_logs.py` runs locally — no network. Memory and article
  reads/writes are local filesystem. The `./notify` step fans out to configured channels.
- **Retrospective branch:** `./scripts/skill-runs` and `git log` run locally — no network. If
  `./scripts/skill-runs` errors out, fall back to `memory/cron-state.json` and mark the metrics
  row as `_degraded source_`. The notify step uses the post-process pattern (writes to
  `.pending-notify/`); do not retry on failure — the postprocess script handles it. The Resend
  email in step 8 carries the `RESEND_API_KEY` secret; if the sandbox blocks the outbound call,
  queue it via the post-process pattern rather than retrying inline.

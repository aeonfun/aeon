---
name: Evening Recap
description: End-of-day operational summary — what Aeon shipped, what failed, what needs follow-up
var: ""
tags: [meta]
---
<!-- autoresearch: variation B — reframe recap around tomorrow's decisions, lead with a TL;DR verdict, mandate links, cap to top items; folds in A's cron-state cross-check for silent failures and C's parser fix + source-health awareness -->
> **${var}** — Optional date override (YYYY-MM-DD). If empty, recaps today (UTC).

Read memory/MEMORY.md for context and `memory/issues/INDEX.md` for open issues.

## Goal

The recap is not a log dump — the operator can read the log themselves. Its job is to deliver a verdict on the shape of the day and surface the calls that need a human. Lead with a one-sentence TL;DR; cap headlines; demand a URL on every shipped item; and never print empty sections.

## Steps

1. **Determine the date.**
   ```bash
   TODAY=${var:-$(date -u +%Y-%m-%d)}
   ```

2. **Read today's activity log.** Open `memory/logs/${TODAY}.md`.
   - Treat **both** `## ` and `### ` as skill-entry headers (existing logs use both styles — `### autoresearch`, `## Changelog Skill`). Capture each heading text as the skill name and the body until the next heading.
   - If the file is missing or whitespace-only, mark `log=missing` and continue to step 3 — silent failures may still need reporting before exiting.

3. **Cross-check `memory/cron-state.json` for silent failures.** Load it as JSON. For each skill present:
   - `consecutive_failures ≥ 1` and `last_status != "success"` → silent failure (force into Blockers regardless of log content).
   - `last_success` date == TODAY but no log entry for that skill → "ran without logging" (low-severity Blocker).
   - If the file is missing or unparseable, record `cron-state=unavailable` and skip the cross-check (do not abort).

4. **Deduplicate repeat runs.** If the same skill appears N>1 times in the log, fold into one entry labeled `skill ×N`. Keep the most informative run's headline (the one with a PR/URL or the longest body); collapse the rest to `+K more`.

5. **Extract every artifact link.** For each entry, capture every URL or file path in the body (PR link, run URL, `articles/...` path, `dashboard/outputs/...` path, ISS-NNN reference). An entry with no concrete artifact is "talk, not ship" — demote it to the Notable tier.

6. **Score and tier each entry on leverage.** What matters for tomorrow's decisions:
   - **Headlines (top tier, cap 5):** new PR opened, change merged, new article shipped, issue resolved or newly filed, new failure pattern.
   - **Notable (mid tier, cap 5):** routine successful runs, repeat outputs, expected cron firings, talk-not-ship entries.
   - **Skip:** pure noise (heartbeat OK with nothing flagged, dedup-only runs, "no new items" reports). Collapse to a count for the footer.

7. **Identify decisions for tomorrow.** Re-scan the day for items that need a *human call*:
   - Failing skills past their retry budget (cron-state `consecutive_failures ≥ 2`).
   - PRs awaiting merge for >24h (use `gh pr list --state open --json number,title,url,createdAt` if `gh` is available; skip if not).
   - Open issues from `memory/issues/INDEX.md` mentioned in today's log without resolution.
   - Conflicting outputs across skills.
   List as concrete asks naming the target ("merge PR #N", "decide whether ISS-007 is wontfix"). If none, omit the section.

8. **Write the TL;DR last.** After steps 2–7, write one sentence that takes a stance on the shape of the day. Examples:
   - "heavy ship day — 5 evolution PRs filed and 0 failures"
   - "quiet — only crons fired, nothing shipped"
   - "two regressions opened, one resolved; net negative"
   - "first failure of `fetch-tweets` in a week — investigate before tomorrow's run"
   No hedging, no "today saw...", no "various activity occurred".

9. **Compose and send the recap via `./notify`.**

   ```
   *Evening Recap — ${TODAY}*
   _TL;DR: <one-sentence verdict from step 8>_

   *Headlines:*
   - [skill] — [one-line outcome] · <URL>
   - ...

   *Notable:*  (omit section if empty)
   - [skill ×N] — [one-line]
   - ...

   *Decisions for tomorrow:*  (omit if empty)
   - [specific ask, named target]

   *Blockers:*  (omit if empty)
   - [skill] — [error in ≤8 words] · <run URL if available>

   _+M routine runs collapsed · sources: log=[ok|missing|empty] cron-state=[ok|unavailable]_
   ```

   **Hard rules:**
   - ≤2000 chars total.
   - **Every Headline bullet must include a URL.** No URL → demote to Notable.
   - TL;DR is mandatory and must take a stance.
   - Never print "none" or "clean" — omit the section instead.
   - Always include the source-health footer line so future-you can debug "why was this recap empty".
   - Lead with shipped artifacts, not skills attempted.
   - **Empty-day exit:** if `log=missing` AND no silent failures AND no decisions, send a single line `*Evening Recap — ${TODAY}*: quiet day, no activity recorded · sources: log=missing cron-state=ok` and stop.

10. **Log to memory.** Append to `memory/logs/${TODAY}.md` (create the file if it didn't exist):
    ```
    ## Evening Recap
    - Sent for ${TODAY}: H headlines, N notable, B blockers, D decisions queued, M collapsed
    - TL;DR: <copy the one-sentence verdict>
    - Sources: log=X cron-state=Y
    ```

## Sandbox note

All inputs are local file reads (logs, issues index, cron-state). `gh pr list` runs through the GitHub CLI and is sandbox-friendly — if it fails, treat the source as unavailable and skip the PR-staleness check. `./notify` writes to `.pending-notify/` when outbound HTTP is blocked, so delivery is reliable.

---
name: Recurring manual-task entries should be scheduled, not tracked
description: When adding "remember to check X every Y" to manual_tasks_thomas.md, offer to convert it to a scheduled task instead
type: feedback
originSessionId: 02ccf02f-be83-469f-bc11-b76ba0afa726
---
When the user (or I) am about to add an item to `manual_tasks_thomas.md` — or anywhere else in the project — that has the shape **"remember to check X every Y"**, stop and propose converting it to a scheduled task via `anthropic-skills:schedule` (backed by `mcp__scheduled-tasks__create_scheduled_task`) instead.

**Why:** Manual task lists are passive — they only fire when the user re-reads them. Scheduled tasks are active — they run themselves on cadence, surface deltas, and update their own dated log. The watchlist pattern shipped 2026-04-20 (`upstream-skills-watchlist-check`, cron `0 9 1 1,4,7,10 *`) is the reference implementation: recurring `gh`/`jq` query → surface hits → update a dated markdown row. Any periodic-scan TODO that produces a structured report generalizes to this pattern — grant deadlines, builder-leaderboard rank, HL funding-rate regime checks, competitor repo activity, etc.

**How to apply:**
1. On any prompt containing "check …every …", "remind me …each", "periodically …", or similar cadence language, *before* writing to `manual_tasks_thomas.md`, propose a scheduled-task version: taskId, cron expression, one-line prompt outline.
2. If the user agrees, use `mcp__scheduled-tasks__create_scheduled_task` (not `manual_tasks_thomas.md`).
3. Recommend the user hit "Run now" once in the Claude Code Scheduled sidebar to pre-approve any Bash/MCP permissions the task needs — otherwise the first scheduled run pauses on a prompt.
4. Reference file for the watchlist pattern: `upstream_skills_watchlist.md` (in this same memory dir).

**When NOT to schedule:**
- One-shot manual actions (wallet funding, grant applications, account creation) — those belong in `manual_tasks_thomas.md`.
- Judgment-heavy weekly check-ins where the human is the audience for the signal (promotion decisions, IC review).
- Anything that requires a browser login or 2FA — the scheduled runner can't handle interactive auth.

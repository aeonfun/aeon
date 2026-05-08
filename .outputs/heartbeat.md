HEARTBEAT_OK · STATUS_PAGE=DEGRADED — wrote docs/status.md

## Summary

Ran the 20:00 UTC heartbeat slot. Read MEMORY.md, cron-state.json, INDEX.md, aeon.yml, and the last two days of logs.

**P0:** 3 chain wrappers still failing (`chain:morning-brief`, `chain:evening-rollup`, `chain:weekly-grant-update`) — all the same Day-12 `dispatch_skill()` bug, all already covered by 08:00 + 14:00 heartbeats and OPS ALERT. No stuck dispatches, no `consecutive_failures ≥ 3`. Heartbeat self-check 5.1h ago, healthy.
**P1:** 9 stalled PRs unchanged. **P2:** ISS-014 still open in INDEX.md despite PR #156 merge — skill-health 18:00 ran but didn't flip it (`filed: [], resolved: []`). **P3:** 4 never-dispatched skills (`weekly-shiplog`, `repo-scanner`, `syndicate-article`, `vercel-projects`) — same as 14:00. Nothing schedule-stale.

**Notification:** none sent — full dedup against today's prior heartbeats + OPS ALERTS.

**Status page:** regenerated `docs/status.md` (wholesale overwrite). Overall 🔴 DEGRADED, 17 open issues, next scheduled run `evening-recap` at 21:00 UTC. Skill table sorted last-run desc, 4 never-run rows at the bottom.

**Files modified:** `docs/status.md`, `memory/logs/2026-05-08.md`. **Follow-up:** ISS-014 flip still pending; chain-runner.yml `dispatch_skill()` patch remains operator-priority #1 — the 21:00 chain:evening-rollup will likely fail on the same bug.

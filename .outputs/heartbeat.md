Heartbeat done.

`HEARTBEAT_OK · STATUS_PAGE=DEGRADED`

## Summary

- Ran heartbeat for the 14:00 UTC slot (fired 15:20 UTC).
- **P0:** 3 chain wrappers (`chain:morning-brief`, `chain:evening-rollup`, `chain:weekly-grant-update`) all `last_status=failed` — same `chain-runner.yml dispatch_skill()` DEGRADED root cause already in MEMORY.md OPS ALERTS. `chain:weekly-grant-update` has a new failure timestamp (2026-05-04T09:36:43Z) but the underlying skill succeeded the same minute. No stuck dispatches. 52 chronic-failure skills (success_rate < 0.5, total_runs ≥ 5) — ISS-013 decay tail. Heartbeat self-check ~5h40m fresh, within 36h gate.
- **P1/P2/P3:** 9 open PRs on `tomscaria/aeon` (oldest #1 9d), ISS-014/018/019, reddit-digest 11-day error chain, 6 missing-from-cron-state skills — every item already in the last 48h of `memory/logs/`. **Notification suppressed via dedup.**
- **Files modified:** `docs/status.md` regenerated (Overall 🔴 DEGRADED, 15 open issues, Updated 2026-05-04 15:20 UTC, Next scheduled run = `project-lens` at 15:30 UTC, 92 skill rows from current cron-state.json). `memory/logs/2026-05-04.md` appended with heartbeat verdict.
- **Follow-up:** none new — operator-side chain-runner.yml patch remains the unblock.

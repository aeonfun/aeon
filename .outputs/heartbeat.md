Heartbeat complete. Status page rewritten and log entry appended.

## Summary

**Verdict:** `HEARTBEAT_OK · STATUS_PAGE=DEGRADED — wrote docs/status.md`

**P0 findings (all deduped against last 48h logs, no notification sent):**
- 3 chain wrappers in failed state (`chain:morning-brief`, `chain:evening-rollup`, `chain:weekly-grant-update`) — same `dispatch_skill()` bug, top operator priority. All already flagged in 02:23 + 14:23 heartbeats today.
- ~50 skills carrying `success_rate < 0.5` from the 2026-04-26 23:53–58Z ISS-013 storm. Counters decaying naturally (push-recap 16%→20%, code-health 14%→20%, heartbeat 25%→29%).
- Heartbeat self-check: healthy (last_success 14:29Z, ~5h40 ago).

**P1:** PR `tomscaria/aeon#1` now ~50h stalled — already flagged in both prior heartbeats today.

**Status page:** Overall = 🔴 DEGRADED, 14 open issues (added ISS-014 since 14:23 page), next scheduled run = evening-recap at 21:00 UTC. Sorted skill table covers 80 skills with run-state and 19 never-run.

**Files modified:** `docs/status.md` (full rewrite), `memory/logs/2026-04-27.md` (appended 20:10 heartbeat entry).

Follow-up unchanged from prior runs: chain-runner.yml `dispatch_skill()` is still the top fix; operator should pull GHA logs for the 23:53–58Z 2026-04-26 storm.

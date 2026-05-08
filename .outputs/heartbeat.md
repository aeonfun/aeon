HEARTBEAT_OK · STATUS_PAGE=DEGRADED — wrote `docs/status.md`.

## Summary

- Ran the heartbeat skill (14:00 UTC slot, executed 15:03 UTC — slightly delayed). Read MEMORY.md + cron-state.json + INDEX.md + aeon.yml + last-2-days logs.
- **P0:** 3 chain wrappers in `failed` state (`chain:morning-brief` 07:14Z, `chain:evening-rollup` 21:02Z 05-07, `chain:weekly-grant-update` 05-04) — all deduped against today's 08:00 heartbeat + OPS ALERTS. No `dispatched`-stuck. No `consecutive_failures >= 3`. Chronic-failure tail unchanged (~37 skills denominator-locked from ISS-013 + ISS-020 bursts). Heartbeat self-check ✓ (6h since last success).
- **P1/P2/P3:** All deduped. ISS-014 closed earlier today by github-monitor (aaronjmars/aeon#156 merged 01:18Z) — flagged for INDEX.md flip on next health-skill cycle. Never-dispatched list shrinks 6→4: `morning-brief` and `hacker-news-digest` first-dispatched at 09:01Z today.
- **Notification:** none sent (all findings deduped).
- **Status page:** regenerated `docs/status.md` — Overall 🔴 DEGRADED, 17 open issues, next run `star-milestone` at 15:15 UTC. Sort by last-run desc, 4 never-run rows at bottom.
- **Files modified:** `docs/status.md` (wholesale overwrite), `memory/logs/2026-05-08.md` (heartbeat entry appended).
- **Follow-up:** chain-runner.yml `dispatch_skill()` patch remains operator-priority #1 (day-12 idle); ISS-014 close needs INDEX.md update on next sweep.

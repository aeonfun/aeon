Heartbeat run complete.

## Summary

- Ran heartbeat (08:00 UTC slot) for 2026-05-08. Read cron-state.json + INDEX.md + aeon.yml + last-2-days logs.
- **P0 findings (3 failed chain wrappers):** `chain:morning-brief` (today 07:14:30Z), `chain:evening-rollup` (yesterday 21:02:20Z), `chain:weekly-grant-update` (2026-05-04, weekly). All same `dispatch_skill()` bug class — already covered by MEMORY.md OPS ALERT "chain-runner.yml DEGRADED day 12" + today's earlier daily-routine log entry. **Notification skipped per dedup rule.**
- **P0 self-check:** heartbeat `last_success` ~12h ago, < 36h threshold ✓.
- **P1/P2/P3:** No new findings — 9 stalled PRs, chronic-failure tail (~37 skills with success_rate <50%), 17 open issues (incl. critical ISS-013 + ISS-020), 6 never-dispatched skills — all unchanged from yesterday and covered by OPS ALERTS.
- **Public status page:** regenerated `docs/status.md` — Overall **🔴 DEGRADED**, 17 open issues, 90 skill rows. Next scheduled run: issue-triage at 09:00 UTC.
- Files modified: `docs/status.md`, `memory/logs/2026-05-08.md`.
- Verdict: **HEARTBEAT_OK · STATUS_PAGE=DEGRADED** (no new notification sent; status page wholesale overwrite).

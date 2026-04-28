HEARTBEAT_OK · STATUS_PAGE=DEGRADED — wrote `docs/status.md`.

## Summary

- Ran heartbeat second slot for 2026-04-28 at 15:34 UTC. All P0/P1/P2/P3 conditions dedup against the 09:10 first-slot page and prior 48h logs — same three chain wrappers (`chain:morning-brief`, `chain:weekly-grant-update`, `chain:evening-rollup`) carry stale `failed` from yesterday, same chronic-failure tail decaying naturally from the ISS-013 storm, same four stalled PRs (#1 67h, #2/#3/#4 37h, #5 ~21h), same V2 cutover alert (now confirmed live via independent monitor-polymarket + polymarket-comments observation).
- Heartbeat self-check healthy: `last_success` 2026-04-28T09:15:23Z, ~6h ago.
- Rewrote `docs/status.md` — Overall **🔴 DEGRADED**, 14 open issues per INDEX.md, next scheduled run = `code-health` at 16:00 UTC (~26 min away). 81 skills sorted by last-run desc; 18 enabled-but-never-run at bottom.
- No notification dispatched — every flag deduped.
- Files modified: `docs/status.md`, `memory/logs/2026-04-28.md`.
- Follow-up: chain-runner.yml `dispatch_skill()` fix remains the top repair item; ISS-015 still missing from `memory/issues/INDEX.md` (issue-triage scope).

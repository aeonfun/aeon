**HEARTBEAT_OK · STATUS_PAGE=DEGRADED — wrote `docs/status.md`**

## Summary
- Heartbeat ran at 14:23 UTC. Every P0/P1/P2 flag deduped against prior 48h logs (chain-runner DEGRADED, PR #1 stalled, ISS-013 chronic tail) — no notification sent.
- New today: `chain:weekly-grant-update` failed at 10:15Z — Monday's 09:00 slot, first time the chain-runner bug hit this chain. Underlying `weekly-shiplog` succeeded individually, clearing yesterday's AT_RISK loop carry-over.
- Files written: `docs/status.md` (rebuilt — 99 enabled skills, 13 open issues, Overall = 🔴 DEGRADED, next run = technical-explainer at 14:30 UTC), `memory/logs/2026-04-27.md` (heartbeat block appended).
- Follow-up unchanged: chain-runner.yml `dispatch_skill()` fix is still the top operator action.

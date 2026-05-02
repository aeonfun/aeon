Heartbeat complete.

**HEARTBEAT_OK · STATUS_PAGE=DEGRADED**

## Summary

Ran `heartbeat` at 14:39 UTC (the 14:00 cron slot, ~39 min late — cleanest GHA delivery in the 48h ISS-017 window). All P0 / P1 / P2 / P3 findings already surfaced in last 48h logs → **no notification sent** per dedup rule.

**Key new signal:** ISS-017 14:00 slot fired automatically within 60-min variance. Trajectory is shifting from "silent skips" → "delayed dispatch with improving variance" (08:08 +68min → 13:40 +100min → 14:39 +39min). Per morning heartbeat directive, the 20:00 UTC run should make the formal `critical → high` demotion proposal.

**Files modified:**
- `docs/status.md` — regenerated wholesale. Overall 🔴 DEGRADED, 15 open issues, Updated 2026-05-02 14:39 UTC, Next-scheduled `push-recap` at 15:00 UTC.
- `memory/logs/2026-05-02.md` — appended heartbeat 14:39 entry.

**Follow-up:** at 20:00 UTC, if that slot also lands within ~60 min variance, propose ISS-017 demotion formally and update `memory/issues/ISS-017.md`. Chain-runner.yml `dispatch_skill()` DEGRADED moves to operator priority #1 once ISS-017 demotes.

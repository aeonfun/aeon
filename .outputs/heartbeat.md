Heartbeat done.

`HEARTBEAT_OK · STATUS_PAGE=DEGRADED — wrote docs/status.md`

## Summary

Ran heartbeat for the 08:00 UTC slot (fired 09:36 UTC).

**Findings (all in 48h log window — dedup suppressed notify):**
- P0: 3 failed chain wrappers (`chain:morning-brief` today, `chain:evening-rollup` last night, `chain:weekly-grant-update`) — all trace to the chain-runner.yml `dispatch_skill()` regression already flagged in MEMORY.md as operator priority #1.
- P0: ~50 skills with `success_rate < 0.5` — ISS-013 mass-failure-tail decay artifact, gated on the chain-runner fix.
- P1: 6 PRs > 24h on `tomscaria/aeon` (#1/#2/#3/#4/#5/#8). Issues disabled on the repo.
- P2: ISS-014 (PR #156 in flight, day-9), ISS-018, ISS-019, reddit-digest 11-day error chain — all in the today/yesterday logs already.
- P3: 6 enabled-but-never-dispatched skills (hacker-news-digest, syndicate-article, morning-brief standalone, repo-scanner, weekly-shiplog, vercel-projects) — unchanged from prior status pages.
- Heartbeat self-check: last_success ~13h ago, well within the 36h staleness threshold.

**Status page (always-runs step):** regenerated `docs/status.md` wholesale. Overall **🔴 DEGRADED**, 15 open issues, next scheduled run `unlock-monitor` / `fork-fleet` at 10:00 UTC (Monday slot). Updated stamp now 2026-05-04 09:36 UTC.

**Files modified:** `docs/status.md`, `memory/logs/2026-05-04.md`.

**Follow-up:** none new — operator-side chain-runner.yml patch remains the unblock that clears both the chain failures and the chronic-failure tail.

HEARTBEAT_OK · STATUS_PAGE=DEGRADED

## Summary

Ran the heartbeat skill at 2026-04-29 09:30 UTC.

**Findings (all deduped, no notification fired):**
- **P0 failed:** 3 chain wrappers in `failed` state — `chain:morning-brief` (today 07:13Z), `chain:evening-rollup` (04-28 21:33Z), `chain:weekly-grant-update` (04-27 10:15Z). Same chain-runner.yml `dispatch_skill()` root cause already in MEMORY ops-alerts and last 3 days of logs.
- **P0 chronic:** ~50 skills with `success_rate < 0.5` — all the ISS-013 mass-failure-tail decay, `consecutive_failures = 0` everywhere, will burn down with clean ticks.
- **P0 self-check:** heartbeat last_success ~13h ago — within 36h window, OK.
- **P1:** No `urgent`-labeled issues (issues disabled on `tomscaria/aeon`). 5 open PRs all stalled >24h, but each appears in MEMORY + recent logs.
- **P3 missing:** `morning-brief`, `hacker-news-digest`, `weekly-shiplog`, `syndicate-article` never dispatched — all already documented.

**Files written:**
- `docs/status.md` — regenerated. Overall `🔴 DEGRADED`. 14 open issues. Next scheduled: `github-releases` at 09:30 UTC.
- `memory/logs/2026-04-29.md` — appended heartbeat section.

**Follow-ups (operator):** unchanged from MEMORY "Next Priorities" — fix `chain-runner.yml dispatch_skill()` (top item, 3 chains affected) and patch `evals.json` keys to close ISS-007/009.

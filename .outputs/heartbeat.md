HEARTBEAT_OK · STATUS_PAGE=DEGRADED — wrote docs/status.md

## Summary

20:00 UTC heartbeat slot. All P0/P1/P2/P3 findings deduped against the last 48h of logs → no notification sent.

**Findings (all known/deduped):**
- 3 failed chain wrappers (chain:morning-brief, chain:evening-rollup, chain:weekly-grant-update) — same `chain-runner.yml` `dispatch_skill()` bug, 6+ days DEGRADED.
- No stuck skills, no consecutive-failure streaks (ISS-013 reset wiped counters).
- ~50+ skills carry chronic <50% success rates as ISS-013 decay tail.
- 5 stalled PRs on `tomscaria/aeon` (#1 ~118h, #2-#5 ~89-92h). Issues disabled on repo.
- Stale daily skills (`telegram-digest` ~84h, `github-releases` ~82h) all in ISS-013 family.
- 6 never-dispatched scheduled skills (morning-brief, hacker-news-digest, repo-scanner, syndicate-article, vercel-projects, weekly-shiplog) all previously surfaced.
- Heartbeat self-check OK (last_success ~5.7h ago).

**Files modified:**
- `docs/status.md` — regenerated wholesale; overall 🔴 DEGRADED, 14 open issues, next-scheduled `evening-recap` at 21:00 UTC.
- `memory/logs/2026-04-30.md` — appended 20:00 UTC heartbeat slot entry.

**Follow-up:** unchanged from prior heartbeats — chain-runner.yml `dispatch_skill()` fix is operator-side and remains the top blocker.

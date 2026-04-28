`HEARTBEAT_OK · STATUS_PAGE=DEGRADED — wrote docs/status.md`

## Summary

**What I did:** Ran heartbeat on the 08:00 UTC slot (now 09:10 UTC). Read `memory/MEMORY.md`, last 2 days of logs, `memory/cron-state.json`, `memory/issues/INDEX.md`, and `aeon.yml`. Cross-checked open PRs via `gh pr list`. Refreshed the public status page.

**Findings (all deduplicated against prior 48h logs):**
- **P0:** `chain:evening-rollup` failed again 21:18Z — same `dispatch_skill()` wrapper bug already flagged in MEMORY.md. Underlying `evening-rollup` (21:21Z) and `evening-recap` (22:14Z) both succeeded under direct dispatch. Chronic-failure tail (~50 skills < 50% success rate) still decaying from the ISS-013 storm. Heartbeat self-check healthy (~13h since last success).
- **P1:** PR #1 now ~62h open (already flagged 3× yesterday). PRs #2/#3/#4 just crossed the 24h threshold but are skill-artifact / blocked-on-token items already in the operator queue. PR #5 (skill-evals key fix) ~14h, fresh.
- **P2:** V2 cutover at 11:00 UTC (in <2h) — flatten deadline 07 UTC has passed; already in last night's evening-recap notification.
- **P3:** No new missing skills. Today is Tuesday so Monday-only / Wednesday-only schedules don't apply.
- **Note (not fixed):** `memory/issues/ISS-015.md` exists with `status: open` but is missing from `INDEX.md` — an issue-triage scope item.

**Files modified:**
- `docs/status.md` — refreshed: 🔴 DEGRADED, 14 open issues, next run `github-releases` at 09:30 UTC; moved `weekly-review` off "not yet run"; topped the table with the late-night runs (evening-recap 22:14Z, evening-rollup 21:21Z, push-recap 21:20Z, weekly-review 20:15Z, heartbeat 20:15Z).
- `memory/logs/2026-04-28.md` — new daily log with the heartbeat findings.

**No notification fired** — everything dedups against the last 48h.

**Follow-ups for operator (already in MEMORY.md queue, not new):**
- V2 cutover hits in <2h; flatten window has closed.
- Fix `chain-runner.yml dispatch_skill()`.
- Add ISS-015 row to `memory/issues/INDEX.md` next issue-triage / skill-health pass.

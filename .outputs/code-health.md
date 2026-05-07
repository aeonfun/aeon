## Summary

Code-health audit for 2026-05-07 across three watched repos.

**Real changes in 24h:**
- `tomscaria/swarm-fund-mvp` broke its 24h freeze on 2026-05-06 21:32–21:56 UTC with a 9-commit evening burst — ADR-095 (`OLLAMA_FULL=1` → qwen2.5:14b) + fine-tuning pipeline + canary router + KB embedding index — direct on `main`, not via PR.
- `aaronjmars/aeon` shipped #160 (v4-readiness checklist) and #161 (skill template library, six starters).

**MEMORY correction needed:** `MEMORY.md:18` calls ADR-095 the resolution-text-ingest upgrade ("highest-leverage CalibrationGap upgrade"). `DECISIONS.md` ADR-095 is the OLLAMA_FULL=1 cost routing. Resolution-text-ingest has no open ADR slot — should open ADR-096. Same misalignment in today's polymarket-comments log.

**Yesterday's repo-article falsifiers TRIGGERED both ways:** new ADR by 05-09 (yes — ADR-095 landed) AND PR queue stalled (yes — went 2 → 4 with PR #32 added today). Two-track shipping cadence: cost/infra ADRs to `main`, strategy-correctness fixes accumulate on PRs.

**Carry ledger (8 items, 4–13 days):** PR #156 reply-maker idle 95h (Day-13), ZIZMOR Day-9, swarm-fund Pyth/Birdeye feed IDs Day-6 (top blast radius), lore-teaser `.env` Day-6, plus new entry: `tomscaria/aeon outputs/` directory still 404 — ADR-093 falsifier clock at Day-4, 10 days remaining.

**Files created/modified:**
- `articles/code-health-2026-05-07.md` (NEW)
- `memory/logs/2026-05-07.md` (appended code-health section)
- `.audit-2026-05-07/` (3 transient repo clones; harness blocked recursive cleanup)
- `.pending-notify/` (created empty; notify dispatched but deduped against earlier payload, hash `17b135ea`)

**Follow-up actions:** open ADR-096 for resolution-text-ingest + fix MEMORY.md:18; verify Pyth/Birdeye feed IDs; add Vitest regression for two hardened aeon dashboard routes; untrack lore-teaser `.env`; resolve PR #156; ship `tomscaria/aeon outputs/` JSON contract before 05-17.

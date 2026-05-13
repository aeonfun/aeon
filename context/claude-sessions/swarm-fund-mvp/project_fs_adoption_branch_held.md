---
name: feat/fs-adoption branch held pending ADR renumber
description: 23 commits on feat/fs-adoption worktree, all referencing ADR-103. Held unmerged because main has parallel ADR-103+104 claim for spec-driven strategy authoring. Resume: confirm parallel ADRs landed → renumber my branch to ADR-105 → write final ADR body → merge.
type: project
originSessionId: 513c23b0-828d-4944-982c-4758d052989b
---
# feat/fs-adoption branch — held unmerged pending ADR renumber

**Date held:** 2026-05-12 (user picked option (c) over (a) renumber-now and (b) ship-as-is)

## Branch state

- **Worktree:** `/Users/stew/scaria/swarm-fund-mvp-fs-adoption`
- **Branch:** `feat/fs-adoption`, 26 commits ahead of main
- **Range:** `bf8e9aed` (scaffold) → `f56b8f83` (lint noise reduction). All implementation commits explicitly reference ADR-103. Final 3 commits cleaned up flagged debt — see below.
- **Spec:** `docs/superpowers/specs/2026-05-12-fs-adoption-design.md` (uncommitted in main checkout; committed in worktree only)
- **Plan:** `docs/superpowers/plans/2026-05-12-fs-adoption.md` (same)

## Verification state (Task 22 result, 2026-05-12)

- 61/61 fs_adoption tests pass across 12 test files
- Phantom-peak replay fixture catches the 2026-04-25 incident pre-staleness
- Extended lint: 0 block-severity hits, 122 warn-severity (informational; mostly strategies with no `program.md`)
- Lookahead/registry regression: 25/25 pass
- Dashboard builds clean (`dashboard/.next/BUILD_ID` present); 3 new tiles mount on `(shell)/system/page.tsx`
- All 3 new API routes registered: `/api/dashboard/nav_reconciliation|position_audit|strategy_audit`
- Telegram alert + per-process cooldown wrapper landed (Task 5)
- 222 strategy/registry tests pass after `RegisteredStrategy.scan()` got the soft-validate wrap (Task 12)

## The collision

Parallel work in main claimed ADR-103 + ADR-104 for "Spec-driven strategy authoring" (Pydantic `StrategySpec` + `SpecRunner` + `spec_generator` CLI). See `DECISIONS.md:1731+` in main, `CLAUDE.md` line 68 ("Spec-driven strategy authoring (ADR-103 + ADR-104)").

My branch's ADR-103 stub at `DECISIONS.md:1731` in the worktree is "Adopt anthropics/financial-services patterns" — entirely different topic.

## Resume procedure

When ready to merge:

1. **Confirm parallel ADRs actually landed.** Read `DECISIONS.md` and `CLAUDE.md` on main; check that ADR-103 (spec-rails) and ADR-104 (spec-generator) are stable, not WIP.
2. **Pick next free ADR number.** Likely **ADR-105** (unless other parallel work has used it).
3. **Renumber commit.** Single commit on this branch:
   - Edit `DECISIONS.md` in worktree: change `## ADR-103 — Adopt anthropics/financial-services patterns ...` to `## ADR-105 — ...`. **Also write the full Rationale body** (this is the deferred Task 23 work — see plan `docs/superpowers/plans/2026-05-12-fs-adoption.md` Task 23 Step 1 for the verbatim Rationale block).
   - Edit `python/fs_adoption/__init__.py`: 3 references "ADR-103" → "ADR-105"
   - Edit `python/fs_adoption/README.md`: 1 reference
   - Commit message: `docs(fs_adoption): renumber ADR-103→ADR-105 + final Rationale body`
4. **Final regression** before merge:
   ```
   cd /Users/stew/scaria/swarm-fund-mvp-fs-adoption
   .venv/bin/pytest python/tests/test_fs_*.py -q  # expect 61/61
   ```
5. **Merge to main** (operator decision — squash vs merge-commit).
6. **Remove worktree:** `git worktree remove /Users/stew/scaria/swarm-fund-mvp-fs-adoption`

## What NOT to do

- Don't rebase + history-rewrite the existing 23 commits to update their messages. They keep saying "(A1)/(B)/(A3)/(A4)/(C)" tags; no ADR# in subjects. A single renumber commit at the tip is sufficient.
- Don't merge before renumbering — `DECISIONS.md:1731` collision will cause merge conflict.
- Don't delete the worktree before merge — uncommitted spec/plan markdowns in `docs/superpowers/{specs,plans}/2026-05-12-*` are worktree-only.

## Debt cleared 2026-05-12 (post-Task-22)

- **datetime sweep (`78f4cd14`):** Introduced `python/fs_adoption/_time.py` with `utc_now_naive()` + `utc_iso()` helpers. Swept 7 src + 20 test call sites. All 61 fs_adoption tests pass under `-W error::DeprecationWarning` (the 4 api_endpoints tests trip FastAPI's own unrelated `on_event` deprecation — out of scope).
- **Cooldown persistence (`46168389`):** Telegram alert cooldown is now JSON-file-backed at `data/fs_adoption_alert_cooldowns.json` (override via `FS_ALERT_COOLDOWN_PATH`). Atomic write (tmp + rename). Survives restart. 2 new tests assert this.
- **Lint noise reduction (`f56b8f83`):** Expanded `HardcodedConstantsRule.ignore_literals` to cover universal floor (bps base, common confidence thresholds 0.55-0.99, epsilons 1e-3 to 1e-10, time windows). Regression scan: **122 → 19 warns (84% reduction)**. `0.073`-magic-still-flagged test confirms strategy-specific literals still surface. 1 new test added.

## Known non-blocking debt (still open)

- `_read_paper_nav()` in `nav_reconciler.py` reads `config/settings.yaml:nav.paper_nav_usd` — Task 5 fix; works but `config/agents.yaml` may also have a `nav:` block that should override. Verify operator preference.
- 19 remaining hardcoded-constants warns are genuinely strategy-specific literals worth triaging into program.md.
- `python/api/server.py:1604` uses FastAPI's deprecated `@app.on_event("startup")` — pre-existing, out of scope for fs-adoption. Migration to lifespan events is a separate ticket.

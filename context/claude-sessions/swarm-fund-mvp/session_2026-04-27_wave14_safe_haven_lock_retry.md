---
name: Session 2026-04-27 — Wave 14 + triage retry shim
description: Wave 14 hl-regime-safe-haven strategy + paper_triage retry-on-lock shim, post-context-compact recovery
type: project
originSessionId: f5f89bc3-bb3b-4eed-8108-425ed08dbd26
---
## What landed (post-compact resume of overnight session)

- **Wave 13 fully integrated** — pm-hl-divergence + pm-macro-spillover added to `python/research/runners/strategy_pillar_map.py` and `python/research/runners/synthetic_dispatcher.py`. Pillar map now 43 strategies (added the mage/archer/pathfinder aggressive/conservative variants that were already registered but unmapped). Synthetic dispatcher fires for 13 runner-driven strategies (17 signals total).
- **Wave 14 — `hl-regime-safe-haven` shipped** (`aee2187`). LONG least-volatile HL perp(s) during RISK_OFF/CRISIS, top-K configurable, dispersion floor gate. Distinct from `hl-regime-rank` (TREND/RANGE + momentum). 6 unit tests, all green. Aristotle 0.70, Pillar 3 (onchain analog of equity safe-haven trade). Source: 2026-04-27 ideation INDEX `regime_safe_haven`.
- **paper_triage retry-on-lock shim** — `_save_decision` now retries on SQLite "database is locked" with exponential backoff (5,10,20,40,60s × 8 attempts ≈ 4 min total). Two prior triage runs (v4, v5) died within fewer than 25 papers under multi-writer contention despite `busy_timeout=120s`; the shim survives the longer write windows the extractor occasionally holds.

## Lock-contention lesson

**Why:** with paper_triage + tiered_extractor + deep_dive + vc_blog_harvest all writing to `data/papers.db` concurrently, even WAL+busy_timeout=120s isn't enough — the extractor's per-paper write windows occasionally stretch beyond 120s during multi-factor inserts. Triage was hitting first-row-locked failures.

**How to apply:** when restarting paper_triage on a busy DB, prefer to (a) pause the extractor first via `kill <pid>`, run triage solo to drain, then restart extractor; or (b) ensure the retry shim is in place. The retry shim now lives in `paper_triage._save_decision` — same pattern should be added to `tiered_extractor._save_factors` and `deep_dive._save_deep` if they hit the same issue.

## State at this commit

- Strategies registered: **39** (was 38 pre-Wave-14)
- Pillar map: **43 entries** (includes -aggressive/-conservative variants)
- Triage v6 PID 65364 alive, ~22 papers/min after extractor pause; ~1500 papers remaining ≈ 60-70 min ETA
- Extractor PID 61777 was killed deliberately to let triage drain; restart after triage finishes
- Render loop PID 62029 still alive, refreshes RESEARCH_HUB / factor_library / overnight_status every 15 min

## Files touched this resume

- `strategies/hl_regime_safe_haven/{__init__.py, hl_regime_safe_haven.py, program.md}` (new)
- `python/tests/test_wave14_safe_haven.py` (new, 6 tests)
- `python/agents/strategy_registry.py` (Wave 14 registration block)
- `python/research/runners/strategy_pillar_map.py` (Wave 13 + 14 + variants)
- `python/research/runners/synthetic_dispatcher.py` (Wave 13 strategies)
- `python/research/papers/paper_triage.py` (retry shim)
- `outputs/research/STRATEGY_PILLAR_MAP.md` (regenerated)

## Commits this resume

- `aee2187` feat(strategy): hl-regime-safe-haven (Wave 14) + triage retry-on-lock shim
- `1a68573` feat(runners): add Wave 13 strategies to synthetic dispatcher

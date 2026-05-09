# Session 2026-04-28 — Per-regime variant bandit + bandit-aware cull + posterior history

## What shipped
Three coordinated additions on top of ADR-071/072/074 (variant bandit core + reversal toggle):

### ADR-089 — Per-regime sub-posteriors on variant bandit
- New `RegimePosterior` dataclass + `VariantStats.regime_posteriors: dict[str, RegimePosterior]`
- `kelly_multiplier(vid, regime=None)` 3-tier fallback: per-regime → global → 1.0
- `MIN_STRENGTH_REGIME = 3` (lower bar than global's 5 because per-regime accumulates ~5x slower)
- Per-regime independent decay (TREND posterior survives a quiet CRISIS, etc.)
- New `canonical_regime_label()` helper normalizing HMM lowercase ("trending"/"high_vol") → `RegimeType` form ("TREND"/"CRISIS")
- v1→v2 schema migration: `load_state()` accepts both, `save_state()` always emits v2

### ADR-090 — Bandit-aware cull driver corroboration
- `corroborate_with_bandit(report, bandit_state_path, *, wr_max=0.40, strength_min=10.0)` joins frequentist t-test (ADR-069) with Bayesian posterior (ADR-072)
- New `corroborated_culls` subset on `CullReport`: variants where BOTH say "loser"
- `render_markdown` adds bandit-evidence columns when state is loaded
- CLI driver (`scripts/run_fleet_cull.py`) gains `--bandit-state`, `--bandit-wr-max`, `--bandit-strength-min` flags; default-on join

### ADR-091 — Daily posterior history snapshots
- `append_history_snapshot(path, snapshot_date=None)` writes one row per (variant, day) to `data/variant_bandit_history.jsonl`
- `latest_snapshot_date(path)` tail-reads the file in O(1) for date-change gating
- Wired into `_refresh_variant_bandit` — gated on UTC date change so it fires at most once per day

### Telegram surface
- `/bandit_status` now shows compact per-regime row breakdown `[T:0.85 R:0.42 C:0.30]` per variant + a "Per-regime variants" header
- New `/bandit_regime` command:
  - Without args: top 10 variants ranked by best-vs-worst-regime spread
  - With variant_id: full per-regime breakdown + multiplier per regime

## Files touched
- `python/signal/variant_bandit.py` — RegimePosterior, regime_posteriors field, kelly_multiplier 3-tier, decay extension, schema v1→v2, canonical_regime_label, append_history_snapshot, latest_snapshot_date, DEFAULT_HISTORY_PATH (~190 net new lines)
- `python/main.py` — _refresh_variant_bandit gains regime_label= param + history snapshot block; scan-loop kelly_multiplier calls thread bandit_regime; canonical_regime_label called once per iteration
- `python/alerting/telegram.py` — render_bandit_status per-regime breakdown; new render_bandit_regime + cmd_bandit_regime + handler registration; cmd_help line
- `python/stats/fleet_cull.py` — CullReport gains corroborated_culls + bandit_evidence fields; new corroborate_with_bandit; render_markdown bandit columns
- `scripts/run_fleet_cull.py` — 3 new CLI flags + corroboration call
- `python/tests/test_variant_bandit.py` — 5 new test classes (TestRegimePosterior, TestRegimeUpdates, TestKellyMultiplierPerRegime, TestRegimeDecay, TestSchemaVersionMigration) + TestHistorySnapshots class. 26 new tests.
- `tests/test_fleet_cull.py` — TestCorroborateWithBandit class with 8 new tests
- `DECISIONS.md` — ADR-089, ADR-090, ADR-091
- Memory: `bandit_reversal_procedure.md` cross-ref updated

## Reversal still works
`SWARM_BANDIT_DISABLE=1` flattens BOTH global and per-regime multipliers to 1.0 (per-regime fallback never engages because the flat global wins). Posterior state — including the new `regime_posteriors` and the history JSONL — is preserved across the toggle.

## Resume prompt for cold-start
Read this file plus ADR-089/090/091 in DECISIONS.md plus bandit_reversal_procedure.md. The variant bandit is now per-regime aware in prod. First per-regime sub-posterior reaches the strength threshold ~3 trades per regime (~15 closed total, scattered across regimes). After that `kelly_multiplier(vid, regime=X)` returns regime-conditional sizing instead of falling back to global. `/bandit_regime` from Telegram is the IC's surface for inspecting per-regime spreads.

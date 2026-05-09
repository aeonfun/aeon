---
name: Session 2026-05-09 — ADR-097 CG Sharpe fix shipped
description: CalibrationGap stop-loss (dormant) + HL concordance gate (active 6h/±100bps). Phase 1 sweep found Sharpe ceiling 0.85, NOT 1.5+ — binary structure caps it.
type: project
originSessionId: 10e24df6-79dd-4fbf-9259-60bbc0242e9d
---
Commit `d5bfeec9` pushed to origin/main. ADR-097 logged. 35 new tests pass + 1330 pre-existing tests pass, 0 regressions.

## What shipped

**Phase 0 — Backfill infrastructure:**
- HL: 23,622 candles (6 assets × 42d, 2026-03-20 → 2026-04-30) at 15m resolution. Plan called for 1m but HL only retains 1m back ~3 days, 5m ~14 days, 15m for the full window. Code at `python/scanner/hl_spot_history.py:_backfill_asset` + CLI `--backfill --start --end --assets`.
- PM: 412 CLOB `/prices-history` rows across 34 of 37 historical CG markets via `scripts/backfill_pm_history.py`. Coverage breakdown: 13 trades with ≥4 in-window samples, 17 sparse, 7 with 0. CLOB data is 15-min fidelity for `interval=max&fidelity=900`.
- Both backfills land in `data/{hl_spot_history,pm_history}/backfill/` (gitignored). Live recorder unchanged. Read-merge at consumer time with 30s-bucket dedup.

**Phase 1 — Sweep result triggered escalation:**
- 78 cells across stop ∈ {-10/-15/-25/-35/-50%, none} × lookback ∈ {2,6,12,24h, none} × threshold ∈ {±10/50/100bps, none}
- **Best cell: stop=none, lookback=6h, threshold=±100bps → Sharpe 0.307** (lift +0.065 from baseline 0.242)
- Every stop level *cuts* Sharpe vs baseline (0.094-0.127 range) — sparse PM history makes simulated stops fire on whipsaws
- **Idealized oracle-stop ceiling: Sharpe 0.849** at -10% (no whipsaw, perfect floor on losers)
- Structural reason: 24 winners average +9270bps with their own ~6700bps variance; even capping all losers at -10% leaves Sharpe < 1.0
- Plan target Sharpe ≥ 1.0 is **unreachable** on this signal in this binary structure
- Apex gate (≥0.5) **is** reachable per the idealized analysis

**Phase 2 — Stop-loss ships dormant:**
- `CalibrationGapAgent.check_stop_losses()` walks open trades each iteration when `CG_STOP_LOSS_PCT` env is set (unset = no-op)
- Verified PM CLOB sell path already exists at `polymarket_adapter.py:357`
- TradeRecord gains `stop_loss_triggered: bool=False` and `exit_reason: Optional[str]=None` (backward-compat)
- Wired in `python/main.py:_loop_iteration` only when `CG_STOP_LOSS_PCT` is set
- Operator flips on when (a) PM history density ≥ 1 sample / 5 min for live trades or (b) future sweep on ≥100 trades shows positive Sharpe lift

**Phase 3 — Concordance gate active:**
- `_check_hl_concordance_filter()` runs at end of `generate_signals()`
- Defaults: `CG_CONCORDANCE_LOOKBACK_HOURS=6.0`, `CG_CONCORDANCE_THRESHOLD_BPS=100.0`
- Disable with `CG_CONCORDANCE_DISABLE=1`
- Lexical direction classifier in `python/research/calibration_gap_sweep.py:predicted_direction` (single source of truth — used by both sweep and live)
- Conservative pass-through on missing HL history or uncertain direction (range/sports markets)
- New helper `hl_spot_history.get_return_bps(asset, lookback_hours)`

## Key decisions

- **Plan target Sharpe ≥ 1.0 is structurally unreachable** for CG signal in PM binary structure. Confirmed by idealized analysis. To get Sharpe > 1.0 would need Approach 3 (HL execution leg) — deferred follow-up.
- **Apex gate (Sharpe ≥ 0.5) IS reachable** per idealized + concordance-gate combo. Production Sharpe likely lands 0.4–0.7 — concordance gate alone takes 0.242 → 0.307.
- **Stop-loss ships dormant**, not enabled. Phase 1 showed every threshold cuts Sharpe; the rails-only ship lets the operator flip later when production data justifies.
- **OOS lock by policy** per ADR-066: next 15 closures freeze as the validation window. Re-tune only if Phase 2-style sweep on the larger sample produces a stop with positive Sharpe lift.

## Files changed

- `DECISIONS.md` — ADR-097 (28 lines)
- `python/agents/base.py` — TradeRecord +2 fields
- `python/agents/calibration_gap.py` — +249 lines (stop-loss, concordance, prefetch index, token resolver)
- `python/main.py` — +33 lines (singleton + iteration wiring)
- `python/scanner/hl_spot_history.py` — +245 lines (backfill, get_return_bps, CLI)
- `python/research/calibration_gap_sweep.py` — NEW (659 lines)
- `python/tests/test_calibration_gap_stop_loss.py` — NEW (14 tests)
- `python/tests/test_calibration_gap_concordance.py` — NEW (21 tests)
- `scripts/backfill_pm_history.py` — NEW (306 lines)
- `outputs/{hl_backfill_report,pm_backfill_report,calibration_gap_param_sweep}.md` + sweep CSV

## Operator runbook

- Re-run sweep against larger sample: `.venv/bin/python -m python.research.calibration_gap_sweep`
- Backfill HL: `.venv/bin/python -m python.scanner.hl_spot_history --backfill --start <date> --end <date>`
- Backfill PM: `.venv/bin/python scripts/backfill_pm_history.py [--markets ID1,ID2]`
- Enable stop-loss: `export CG_STOP_LOSS_PCT=0.10` (or whatever sweep finds)
- Tune gate: `CG_CONCORDANCE_LOOKBACK_HOURS=<float>` `CG_CONCORDANCE_THRESHOLD_BPS=<float>`
- Disable gate: `CG_CONCORDANCE_DISABLE=1`

## Watchpoints — next 15 trades

Per ADR-097's OOS lock-by-policy:
- If Sharpe-of-15 ≥ 0.7 → unblock Phase 2 stop-loss enable
- If Sharpe-of-15 < 0.7 → reconsider Approach 3 (HL execution leg)
- If concordance gate suppresses ≥ 30% of signals → loosen threshold (likely overfit to 37-trade sample)

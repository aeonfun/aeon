---
name: Session 2026-04-26 — variant Thompson bandit + capital wire-up + reversal toggle
description: ADRs 071/072/074 shipped together. Bandit math, capital effect (Kelly multiplier + auto-hold), and operational reversal (env-var toggle + /bandit_status). Live in prod since 2026-04-27 02:06.
type: project
originSessionId: 96b938ba-7a23-4095-aa35-765d9d78ea21
---
## Git tag
`session/2026-04-26-variant-bandit`

## Commit shipped
- `8b68152` — ADR-071 / 072 / 074: variant bandit, capital wire-up, reversal toggle
  - 15 files changed, 2169 insertions(+), 125 deletions(-)
  - Bundle: ADR-071 (math + observation) + ADR-072 (capital effect) + ADR-074 (reversal). ADR-073 docs entry from parallel session also included since the code already shipped in c060d73..fed9786.
  - Tests: 542 passing (+112 vs pre-session HEAD). Two pre-existing failures (`test_mtm::test_window_truncation`, `test_portfolio::test_bl_with_views_produces_allocation`) reproduce on stashed HEAD and are unrelated to this work.

## Architecture decisions
- **ADR-071** — Tunable conviction weights (FactorWeights → SignalConfig 4 new fields → autoresearch MUTATION_SPACE 3→7). Variant Thompson bandit with correlation discount + posterior decay. Lowered graduation gates (Canary→Apex 100→40, validation window 30→15, Shadow→Canary 20d/0.5/$500 → 7d/0.3/$200, HRP 20→10/5→3). Live→Demoted gate **unchanged** (capital protection).
- **ADR-072** — Bandit capital effect. `kelly_multiplier(vid)` = `clamp(1.0 + (E[WR] - 0.5) * 2.0, 0.5, 1.5)` once posterior strength ≥ 5. Auto-hold below 0.40 WR, auto-release above 0.50 (asymmetric to prevent flapping). Multiplier applied **after** shadow $50 fixup so paper variants vary $25–$75; **before** the risk gate so 2% NAV cap still binds.
- **ADR-074** — `SWARM_BANDIT_DISABLE=1` env var: instance-level override flattens multiplier to [1.0, 1.0] and auto_hold_below to 0.0. Class defaults preserved so tests + autoresearch see normal values. **Posterior state preserved** across the toggle. `/bandit_status` Telegram command surfaces top/bottom + current effective config + reversal hint.

## Live verification (2026-04-27 from `logs/trading-loop.log`)
- 02:06:23 — first restart with new code (148 posteriors fresh start, then absorbed 32 on 02:45 refresh)
- 12:24:40 — restart, restored 148 posteriors from disk (round-trip works)
- 12:56:51 — calibration-gap-v1 leading at expected WR 0.730 (primary CG dominating tail)
- 20:48:35 / 20:51:01 — current restart, 148 posteriors restored
- No SWARM_BANDIT_DISABLE in `.env` yet; defaults active

## What's build-complete + shipped
- `python/signal/variant_bandit.py` (new, ~470 lines) — math + persistence + auto-hold + kelly_multiplier
- `python/agents/conviction.py` — FactorWeights dataclass, default-singleton lazy-load from settings.yaml
- `python/main.py` — bandit init + `_HoldListBanditAdapter` + `_bandit_review_holds` + `_refresh_variant_bandit` + threading `kelly_size_multiplier` through `_loop_iteration` + SWARM_BANDIT_DISABLE handling
- `python/alerting/telegram.py` — `render_bandit_status()` + `cmd_bandit_status` + `/help` entry
- `python/agents/base.py` — graduation gates lowered
- `python/signal/strategy_allocator.py` — HRP minimums lowered
- `python/signal/config.py` — SignalConfig + 4 conviction-weight fields, reads `conviction:` block
- `autoresearch/loop.py` — MUTATION_SPACE 3→7, `_commit_config` mirrors writes to `signal:` + `conviction:`
- `config/settings.yaml` — new `conviction:` block + autoresearch mirror keys
- `python/tests/test_main_bandit_wire.py` (new), `test_variant_bandit.py` (new), `test_promotion_thresholds_adr071.py` (new), `test_conviction.py` (extended), `test_validation_window.py` (crossing_idx fixup for n=15)

## Pending manual work
None gating. Two follow-ups deliberately deferred (not in this commit):
1. **Settings.yaml `bandit:` block** for finer-grained tuning beyond the env var. Add when a third operator-tunable knob arrives.
2. **Bandit-driven backtest weighting.** When the autoresearch backtester runs, use the bandit posterior to weight variant evaluations. Founder mentioned correlations + overfitting as the constraint at backtester-introduction time.

## Operational entry points
- **Reversal:** `echo 'SWARM_BANDIT_DISABLE=1' >> .env && kill <trading-loop-pid>` — launchd respawns within 30s. Confirm via `/bandit_status` showing `multiplier=[1.00, 1.00]` and `auto_hold<0.00`. Procedure documented at `bandit_reversal_procedure.md`.
- **Status:** `/bandit_status` from Telegram. Shows tracked + informed counts, top-5 + bottom-5, auto-hold count, current effective config, reversal hint.
- **Live state file:** `data/.variant_bandit_state.json` (atomic write, schema versioned).

## Next session priorities (recommended order)
1. **Wait 1–2 weeks of posterior accumulation** before drawing conclusions. With 148 variants tracked and refreshing every 20 iterations, evidence builds quickly. Re-run `/bandit_status` at the start of each session to scan top/bottom.
2. **First IC review** when bandit auto-holds its first variant — verify the held variant's behavior matches expectation (was it actually losing, or did the bandit overshoot?).
3. **Bandit-backtest integration** (item 2 above) once posterior is meaningful. Start with a backtest harness that uses the bandit's `expected_win_rate` per variant as a prior on whether to spend cycles backtesting it.
4. **Telegram /help refresh** if the IC adds more bandit-related commands.

## Resume prompt for cold-start
> Variant bandit is live in prod since 2026-04-27 02:06 (commit 8b68152, tag session/2026-04-26-variant-bandit). 148 posteriors tracked, calibration-gap-v1 leading at WR 0.730. ADR-071 (math + observation), ADR-072 (capital effect — Kelly multiplier 0.5–1.5× + auto-hold below 0.40 WR), ADR-074 (SWARM_BANDIT_DISABLE env var + /bandit_status command + reversal procedure in memory). Run `/bandit_status` from Telegram to see current top/bottom variants. Next priorities in `session_2026-04-26_variant_bandit.md`. The reversal procedure is at `bandit_reversal_procedure.md` — standard ML-loop diagnostic, not emergency-only.

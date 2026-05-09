---
name: runner-swarm pattern for harvested strategies
description: How to wrap a runner-driven harvested strategy as a paper-trading TradingAgent variant — what files to touch, how venue routing works, how to add new strategies
type: project
originSessionId: 7abf7eb6-cef7-4ae0-8733-5f9350da6383
---
`python/agents/runner_swarm.py` is the bridge between harvested
on_candidate-style strategies under `strategies/pm_*` and the canonical
TradingAgent paper-trade ledger that the resolver, MTM-Sharpe, auto-promote,
peer-review, dashboard, and Telegram /status all consume.

**Why:** harvested strategies were emitting zero paper trades because they're
runner-driven (they wait for `on_candidate(...)` from a runner). The CalibrationGap
swarm trades through `_loop_iteration`; the runner-driven ones had nothing
piping markets at them per iteration. ADR-076 (2026-04-27) wraps each variant
in a `RunnerSwarmAgent(TradingAgent)` so paper trades flow through the same
pipeline with no schema change.

**How to apply (adding a new harvested strategy to the swarm):**
1. Add a candidate-builder fn in `runner_swarm.py` — `(LiveMarket, regime, ctx)` → strategy candidate dataclass | None
2. Add a variant-list factory — list of `_VariantSpec(variant_id, factors_tag, overrides)` with 3–5 entries
3. Add the strategy to `_STRATEGY_REGISTRY` with a `venue` field: `"PM"` (PM-direct, LONG=buy_yes) or `"HL"` (PM-leading-HL, LONG=long perp)
4. Tests in `python/tests/test_runner_swarm.py` (the 9-test suite covers the shape)
5. Variants auto-spawn at trading-loop startup; no main.py edit needed for new strategies

**Venue routing:** PM trades use real PM market_id and resolve via existing
`_resolve_swarm_trades`. HL trades use synthetic `HL-<asset>-<unix_ts>` market_id
(so PM Gamma 404s and skips them) and resolve at +24h horizon via
`resolve_hl_paper_trades(agents, current_spot)` — wired into main.py at the same
20-iter cadence as PM resolution.

**Scope today:** 6 PM-family strategies, 20 variants total. Snapshot/event-driven
strategies (pm-regime-shift, pm-entropy-flow, pm-combinatorial-arb, pm-hl-lead-lag,
hermes-tether-mint, hermes-overnight) are NOT in the swarm — they need different
candidate signatures (snapshot/event, not per-market) and stay on the synthetic
dispatcher and `pm_strategy_runner` CLI for now.

**Ranking tool:** `scripts/runner_swarm_signal_sweep.py` writes
`outputs/research/edge_matrices/runner_swarm_<DATE>.md` with per-variant fire
rates over a synthetic batch + a live PM batch. Use to prioritize autoresearch
budget; dormant variants (0 fires both batches) are candidates for retirement.

**v1 candidate adapters use honest naive proxies** (category-baseline calibration,
log-normal fair-prob from hardcoded annual vols, `(yes-0.5)*10000` drift proxy).
Each adapter has an inline comment naming what v2 will replace it with — real
CalibrationGap output, HL realized-vol over a rolling N-hour window, and per-market
PM probability history from a 5-min poller into `data/pm_history/<market>.jsonl`.

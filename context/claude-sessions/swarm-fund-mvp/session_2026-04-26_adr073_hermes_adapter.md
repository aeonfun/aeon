---
name: ADR-073 Hermes venue-data adapter pattern
description: Phases 1–4 shipped (broker + cascade reference adapter + replay/synthetic test scaffolding); Phase 5a/5b (main.py wiring + cascade Signal unstub) deferred for user review
type: project
originSessionId: cf802f64-5959-4b38-80b0-89a24ea0e38a
---
## Session 2026-04-26 — ADR-073 Hermes venue-data adapters (overnight)

User went to sleep with "go on 1 and then go onto the next." 5 commits landed,
66 new tests passing, zero regressions. No live-capital changes.

**Commits:**
- `c060d73` Phase 1: `MarketTick` schema fix (kind, market_id, metadata
  fields with defaults; hermes_arb tick.timestamp → tick.ts). 17 tests.
- `f0c7c80` Phase 2: `python/execution/data_adapter_base.py` (ABC) +
  `tick_broker.py` (sync ThreadPool fan-out). 23 tests.
- `a0bb343` Phase 3: `python/execution/hl_liquidation_adapter.py` reuses
  `liquidation_detect.is_liquidation`; emits quote+liquidation MarketTicks.
  12 tests including end-to-end with HermesCascadeStrategy.
- `b1c9d21` Phase 4: `replay_adapter.py` + `synthetic_tick_factory.py` +
  fixture `tests/fixtures/feeds/hyperliquid/2026-04-26_cascade_sample.jsonl`.
  14 tests.
- `fed9786` Phase 5: design memo at
  `outputs/2026-04-26_hermes_venue_adapters_design.md`.

**Why:** Overnight 2026-04-25 shipped 5 Hermes scaffolds with stubbed on_tick
AND a runtime-fatal `MarketTick` schema bug — the moment a real WS feed lands,
all 5 strategies AttributeError on `tick.metadata['kind']`. Regime gate was
hiding this. ADR-073 fixes the schema, builds the adapter→broker contract,
ships cascade as the reference, and provides record-and-replay testing.

**How to apply (next session pickup):**
- DECISIONS.md ADR-073 entry is DRAFTED in the working tree but NOT committed
  because the file is also being modified by a parallel session (ADR-071 +
  ADR-072 — variant bandit math + wire-up). The entry will land when
  DECISIONS.md is next committed by either session.
- Phase 5a (python/main.py wiring): instantiate `TickBroker(max_workers=8)`
  at startup, instantiate `HLLiquidationAdapter(broker, coins=("BTC", "ETH"),
  record_path=Path("data/agents/feeds/hyperliquid")/f"{date}.jsonl")`,
  subscribe each Hermes via strategy_runner with REQUIRED_KINDS, graceful
  shutdown on KeyboardInterrupt. Defer to user-reviewed session — touches
  production poll loop.
- Phase 5b (hermes_cascade Signal unstub): unstub `on_tick` line 201 to
  build Signal with thesis (LLM call OUTSIDE on_tick — async fill-in after
  Signal records), Kelly sizing (factors.kelly_fraction × edge × NAV), and
  risk_gate pass-through. Stage.PAPER stops at signals.jsonl; CANARY+ goes
  through VenueRouter.execute as CalibrationGap does.
- Recommended sequencing for second Hermes: hermes-funding via an
  `HLEventStream` abstraction extracted during cascade build. Reuses HL WS
  that cascade already brought online, ~2 build-days vs 5 for fan.
- Disqualifications still hold: hermes-oracle (unwinnable without colo),
  hermes-arb (PM datacenter ban; revisit with agenticbets substitute).

**Cull readiness for cascade first review (~day 14):**
- ≥ 1.0 cascade signals/day averaged over prior 7 days
- ≥ 0.50 paper Sharpe over 14-day window
- ≤ 8 bps median paper-fill slippage vs mark
Below any threshold → demote to research-only, pull funding forward
immediately.

**Test invocation pin:**
```
pytest python/tests/test_market_tick_schema.py        # 17
pytest python/tests/test_data_adapter_base.py         # 11
pytest python/tests/test_tick_broker.py               # 12
pytest python/tests/test_hl_liquidation_adapter.py    # 12
pytest python/tests/test_replay_adapter.py            #  6
pytest python/tests/test_synthetic_tick_factory.py    #  8
```
All 66 green in ~1.8s.

**Pre-existing test failures (not my code):**
- `test_mtm.py::TestRollingMtmSharpe::test_window_truncation`
- `test_portfolio.py::test_bl_with_views_produces_allocation`
Verified unrelated by stashing my changes; they fail there too.

**Not pushed to remote** — kept on local main awaiting user review of
Phase 5a/5b decision.

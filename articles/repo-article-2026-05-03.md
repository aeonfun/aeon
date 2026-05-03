# swarm-fund-mvp Just Made Aeon a Trading Signal

This week swarm-fund-mvp stopped treating Aeon as content infrastructure and started treating it as a market data feed. ADR-093 (commit [`dc1846e`](https://github.com/tomscaria/swarm-fund-mvp/commit/dc1846e), 12:31 UTC, 2026-05-03) added a polling adapter that fetches committed JSON from `tomscaria/aeon` every 15 minutes, parses the entries into `MarketTick` objects, and publishes them onto the same broker that handles Polymarket and Hyperliquid feeds. Of 38 net-new agents added to the runner-swarm this week, 30 read from that stream.

## The claim
> swarm-fund-mvp wired Aeon as a live data source this week: ADR-093 ships a polling adapter, and 30 of 38 net-new agents are aeon-narrative variants.

## Evidence

**The adapter contract is concrete and hardcoded.** [`python/execution/aeon_adapter.py`](https://github.com/tomscaria/swarm-fund-mvp/blob/main/python/execution/aeon_adapter.py) (+180 / -0 in `dc1846e`) sets `AEON_REPO = "tomscaria/aeon"`, `AEON_SKILLS = ("monitor-polymarket", "polymarket-comments", "narrative-tracker")`, and a raw URL template `https://raw.githubusercontent.com/{repo}/main/outputs/{skill}/{date}.json`. Auth uses `GITHUB_TOKEN` (5,000 req/hr) with a 60-req/hr unauthenticated fallback; default poll interval is 900 seconds; lookback is 2 days; dedup is per-entry, not per-file. A new `"aeon_signal"` value lands in the `core/types.py` `TickKind` Literal. Coverage ships in the same commit: 19 new tests in `tests/test_aeon_adapter.py` (5 adapter-parse, 12 strategy-gate, 2 factory).

**The Aeon-Narrative strategy was unstubbed in the same atomic change.** [`strategies/aeon_narrative/aeon_narrative.py`](https://github.com/tomscaria/swarm-fund-mvp/blob/main/strategies/aeon_narrative/aeon_narrative.py)'s `on_tick()` now emits `Signal` objects through a full gate chain: regime affinity, signal age (`signal_age_max_hours` 4–48), narrative score floor (`min_narrative_score` 0.4–0.95), multi-skill confirmation (1, 2, or 3 of the three Aeon skills), momentum filter (off / weak / strict), confidence floor (0.55–0.85), and an HMM-transition guard. The 10-dim `AeonNarrativeFactors` dataclass is the input space for Latin-Hypercube variant sampling.

**The fleet shape ratifies the bet.** Commit [`1125deb`](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb) (12:42 UTC, 2026-05-03): runner-swarm wraps 5 strategies, total fleet **74 → 112 agents** across 30 → 34 strategies. Of the 38 net-new agents, **30 are `aeon-narrative` LH-sampled variants**, plus 2 each for `ta-bb-squeeze`, `ta-macd-cross`, `ta-rsi-divergence`, and `swarm-fragility`. 79% of the new fleet capacity went to consuming Aeon's outputs.

**The brand surface tracks the shift.** The same `dc1846e` commit bumps marketing-site copy to "144 agents / 47 strategies / 941 closed trades / 3,737 papers," and commit [`607183a`](https://github.com/tomscaria/swarm-fund-mvp/commit/607183a) adds `papers_ingested` as its own field on `metrics.json`. Research throughput is now a publicly counted metric next to closed trades.

## Counter-evidence / what would change my mind

The upstream contract isn't live. The adapter polls `https://raw.githubusercontent.com/tomscaria/aeon/main/outputs/{skill}/{date}.json` for three Aeon skills, but as of 15:30 UTC today `tomscaria/aeon` has no `outputs/` directory at all — every poll currently 404s and the strategy emits zero signals. The aeon-narrative `Stage` is `PAPER`, not `CANARY`; the strategy's own docstring lists "per-regime backtest matrix AND paper-trial at 15-min poll cadence showing positive realized edge" as remaining work before promotion. If the Aeon side does not commit the JSON contract within roughly two weeks, those 30 variants are a dormant instantiation, not a live signal source — and the thesis becomes "swarm-fund-mvp built a one-sided contract this week" rather than "swarm-fund-mvp wired a live data source."

## Why it matters

The single live earning agent on `tomscaria/swarm-fund-mvp` is CalibrationGap on Polymarket — 29 closed trades, 76% win rate, +$415, Sharpe 0.31 per `rswarm.ai/metrics.json`. CalibrationGap is a quant-scanner agent: numbers in, numbers out. Wiring Aeon in commits the fleet to a different bet — that an LLM-driven research agent's committed daily artifacts carry edge worth Kelly-fractionating against (`kelly_fraction` 0.05 / 0.10 / 0.25; `max_position_notional_usd` $50 – $2,500 per `AeonNarrativeFactors`). The differentiator versus a comparable like PolySwarm ([arXiv:2604.03888](https://arxiv.org/abs/2604.03888)), which trades Polymarket from 50 LLM personas in-process, is that Aeon already runs as production GitHub-Actions infrastructure with 95 skills, daily committed JSON outputs, and a public commit history any fund can audit. The same operator owns both repos, and after this week they share a tick broker.

---
*Sources*
- [Commit `dc1846e` — Aeon-Narrative ingestion adapter (ADR-093)](https://github.com/tomscaria/swarm-fund-mvp/commit/dc1846e)
- [Commit `1125deb` — runner-swarm wraps 5 strategies (74→112 agents)](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb)
- [`python/execution/aeon_adapter.py` source](https://github.com/tomscaria/swarm-fund-mvp/blob/main/python/execution/aeon_adapter.py)
- [`strategies/aeon_narrative/aeon_narrative.py` source](https://github.com/tomscaria/swarm-fund-mvp/blob/main/strategies/aeon_narrative/aeon_narrative.py)
- [CHANGELOG.md — 2026-05-03 entry](https://github.com/tomscaria/swarm-fund-mvp/blob/main/CHANGELOG.md)
- [tomscaria/aeon — upstream skill catalog](https://github.com/tomscaria/aeon)
- [PolySwarm — arXiv:2604.03888, comparable LLM-swarm architecture](https://arxiv.org/abs/2604.03888)

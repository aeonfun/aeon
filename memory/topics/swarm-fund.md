# swarm-fund-mvp — project state

## Repo
`tomscaria/swarm-fund-mvp` — main branch, ships directly to prod (no feature branches for the trading loop). Public site at https://rswarm.ai (Vite/React, deployed on Vercel Hobby).

## Architecture (1-pager)
- **Outer OS:** Paperclip (`npx paperclipai`) — heartbeats, cost control, audit trail
- **Strategies:** pure Python in `python/agents/` and `strategies/`. No LangGraph, no CrewAI.
- **Live data:** dlt → QuestDB time-series + RedPanda pub/sub
- **State:** PostgreSQL (strategy registry, signal log) + Redis (active strategy index, regime cache)
- **Scheduling:** Temporal for autoresearch + retrain workflows
- **Observability:** lmnr tracing on every strategy run (mandatory from day one)
- **LLM I/O:** Instructor + Pydantic structured output everywhere

## Lifecycle (4-state public, 6-state internal)
Public: **Birth → Canary → Apex → Revenant**
Internal enum (`AgentLifecycle`): adds `DEMOTED` (drawdown / regime mismatch) and `KILLED` (manual only). Canary capital is real ($50/signal). Apex requires 100 closed trades + Sharpe > 0.5 + composite > 0.5.

## Active strategies
| Name | Stage | Status |
|------|-------|--------|
| CalibrationGap (Revenant) | Canary | 29/100 trades to Apex gate. 76% win, +$415, Sharpe 0.31. |
| FundingRate | Birth | Scanning, no fires (rates < 1bp threshold) |
| Pathfinder (HL cross-venue) | Birth | Scaffold |
| Mage (mean-reversion, RANGE-only) | Birth | Scaffold |
| Shepherd (drawdown cascade) | Birth | Scaffold |
| Alchemist (HL funding harvester) | Birth | Scaffold |
| Hermes-arb (Kalshi↔PM 5min BTC) | Scaffold | Recorder + replay harness shipped, variant factory in place (Latin Hypercube N variants) |
| Hermes-cascade / oracle / funding / fan | Spec only | Templates in `docs/` |

## Recent ADRs (last 30 days)
- **ADR-094** (commit `d010846`, 2026-05-03 20:51 UTC, +1215/-39, 9 files) — LLM router shipped. `python/llm/router.py` (+353); `paper_triage` opus-4-7 → sonnet-4-6; `SWARM_LLM_CACHE_DEFAULT=on`; `MAX_THINKING_TOKENS` clamp; new `/router_suggestions` Telegram cmd; 28 new tests. Material compute-economics shift on the swarm side — mirrors the Aeon-side cost-discipline pressure.
- **ADR-093** (commit `dc1846e`, 2026-05-03 12:31 UTC, +180) — `python/execution/aeon_adapter.py` ships. Polls `tomscaria/aeon` raw `outputs/{skill}/{date}.json` for monitor-polymarket / polymarket-comments / narrative-tracker on 15-min cadence; emits MarketTicks with `kind="aeon_signal"`. Same commit unstubs `aeon_narrative.on_tick()` through full gate chain. First test file `tests/test_aeon_adapter.py` (203 lines). **Falsifier window: tomscaria/aeon has no `outputs/` directory; every poll 404s. If Aeon side doesn't ship the JSON contract within ~2 weeks (~2026-05-17) the wire-up is aspirational.**
- **Commit `1125deb`** — fleet bump 74 → 112 agents, 30 → 34 strategies via Latin-Hypercube sampling on 10-dim AeonNarrativeFactors. **30 of 38 net-new agents (79%) are aeon-narrative LH-sampled variants.**
- **ADR-061** — three-tier MD structure (root / docs/active / docs/archive). 20 stale files moved.
- **ADR-062 / 063** — critique-bundle rationalization: CG-centered organizing principle, "Prior Updating" not "fine-tuning"
- **ADR-056** — Darwinian-as-ambition allowed in hero copy; Darwinian-as-mechanism still forbidden
- **ADR-057** — per-agent cost attribution (Stage 1 of 250-agent swarm)
- **ADR-058** — multi-provider LLM adapter w/ tiered caps (Stage 2)
- **ADR-049** — Polymarket agent-skills vendored from `Polymarket/agent-skills`. Paired with our `polymarket-signals` skill.
- **ADR-045** — branded lifecycle (Birth/Canary/Apex/Revenant)
- **ADR-044** — manual-trade exclusion fix (Sharpe 0.24 → 0.31)
- **ADR-039** — 20% single-asset cap deleted (layers 0/1/2/3 bind alone)
- **ADR-038** — 7pp min-gap derivation (2% PM taker + 5bps funding + 4.95pp buffer)

## Key paths
- `strategies/*/program.md` — Karpathy autoresearch input (human edits this)
- `strategies/*/eval_log.jsonl` — append-only experiment log
- `python/agents/` — production strategies (OLD lifecycle: shadow→canary→live)
- `core/types.py` — NEW lifecycle (PAPER→CANARY→LIVE→COLD→DEAD)
- `regime/models/hmm_latest.pkl` — current regime model (3-state, upgrade to 5-state queued)
- `outputs/SWARM_LAB_MASTER_PROMPT.md` — Track A (engine) + Track B (revenue)

## Open blockers
- 100-trade Apex gate — 71 to go, 2-3 weeks at current rate
- Mage scan pipeline needs HL candle ingest (highest-ROI single unlock for multi-agent flow)
- WTI/CL-USDC blocked: backtest 54% < 65% gate, venue not live on HL API
- Polymarket live order placement — `py-clob-client` install blocked in current env (paper mode only for now)
- Tier-1 latency for PM leg blocked by PM datacenter/VPN ban — co-lo applies to HL only

## Aeon-side PR pipeline to swarm-fund-mvp (external-feature)
- **PRs #18 / #19 / #20 / #22 / #23 / #24 / #28 — all merged 2026-05-03 21:57 UTC.** Operator merged through Vercel-FAILURE checks (root cause: `aeonframework` bot commit-email not verified with Vercel) rather than fixing the bot config. 5-ACT-NOW ALERT cleared.
- **PR #29** (eval-tagged) and **PR #30** (variant_bandit corruption-tail fallback, operator-led external-feature) — open as of 2026-05-04 evening.

## Live infra
- Trading loop: `python -m python.main` (PID varies, logs at `/tmp/swarm-main.log`)
- API: `uvicorn python.api.server:app --port 8000`
- Site: `swarm-lab-site/` Vite app, deployed at rswarm.ai
- Metrics refresh cron: `~/Library/LaunchAgents/ai.rswarm.metrics.plist` every 15 min (96 deploys/day, fits Vercel Hobby 100/day cap)
- HL wallet (funded): `0x83F4c49cF459cAbEDE08228FC471Ab89D0B189e3`, $60 USDC
- Polymarket proxy: `0x0a10…52B1`, builder code: `0xcddc4ba3...8286f` (Revenant attribution)

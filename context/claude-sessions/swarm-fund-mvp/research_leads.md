# Research Leads (Parked)

Insights worth revisiting later, not actionable now. Priority: prove the edge first.

## Future Agent Ideas
- **Mean Reversion Agent**: Buy overreactions on Polymarket (price crashes >4 sigma from 7-day mean on headline panic, reverts within hours). Simple z-score logic. Could be a fast second agent after CalibrationGapAgent proves out. Source: @hanakoxbt
- **Weather Arbitrage Agent**: Poll NOAA/Open-Meteo every 15min, aggregate weighted probability, compare to Polymarket weather markets. Edge = speed differential (96 data points/day vs retail checking once). Requires new data pipes but straightforward. Source: @hanakoxbt

## Market Making (Not Our Game Yet)
- Polymarket MM: post bid/ask, collect spread, manage inventory with reservation price. Requires significant capital and latency optimization. Revisit only after directional strategies prove profitable. Source: @hanakoxbt

## Theoretical Frameworks (Interesting, Not Urgent)
- **Phase angle as market context proxy**: Two markets at same price ($0.30) can have completely different momentum/liquidity profiles. Phase captures hidden state that price alone cannot. Could improve CalibrationGapAgent by filtering stale vs active markets. Source: @leopardracer
- **Correlated market entanglement**: Model correlated Polymarket contracts (Fed cuts + BTC + S&P) as entangled states. When one resolves, others update. Could inform portfolio-level position sizing across correlated bets. Source: @leopardracer

## Skill Optimization (Meta-Tooling)
- **Autoresearch + evals**: Use eval frameworks to systematically improve Claude Code skills. Three Gulfs: Comprehension (read real failures), Specification (judges measure what matters), Generalization (optimization loop). Only worth doing after 10+ skills are in active use. Source: @nurijanian, referencing @karpathy's Auto Research and @HamelHusain's evals course

## Tooling Integration (Evaluated 2026-03-22)

### last30days — INSTALLED
- Multi-source research aggregator (Reddit, X, HN, Polymarket, YouTube, TikTok, Bluesky, etc.)
- Installed globally at `~/.claude/skills/last30days/`
- Fund wrapper: `.claude/skills/market-research/SKILL.md` — Polymarket signal context
- **NOW uses:** Signal context for paper trades, pre-trade sentiment checks
- **LATER uses:** New agent hypothesis research, regime narrative context, nightly surface monitoring
- Requires API keys in `~/.config/last30days/.env` (SCRAPECREATORS_API_KEY, AUTH_TOKEN, CT0)

### Compound Engineering — PARTIALLY ADOPTED
- Source: EveryInc/compound-engineering-plugin (6-phase: Ideate→Brainstorm→Plan→Work→Review→Compound)
- **NOT installed as plugin** — 5/6 phases overlap with existing skills (brainstorming, writing-plans, executing-plans, reflect)
- **Extracted:** Multi-agent parallel code review → `.claude/skills/parallel-code-review/SKILL.md`
- 6 fund-specific reviewers: Correctness, Risk/Safety, Edge Cases, Concurrency, Config vs Hardcode, Performance
- **Re-evaluate full plugin:** After 60+ live trades, if skill update velocity > 2x/week or reviews being skipped
- Philosophy ("each unit of work makes subsequent easier") already embodied by Adaptive Learning Protocol

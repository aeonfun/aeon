## Summary

Executed `skills/deep-research/SKILL.md` in deep mode against the operator-supplied topic on Kalshi↔Polymarket BTC binary arbitrage.

**What I did:**
- Ran 8 web searches across landscape, academic, technical, and code repository angles
- Pulled full content from 4 arXiv papers, official Polymarket and Kalshi docs, NautilusTrader integration spec, CF Benchmarks methodology, and 15+ trade-press / vendor / GitHub sources
- Classified 32 sources via CRAAP-lite (T1:9, T2:17, T3:6); built per-finding confidence calibrated to the academic-literature thinness on this specific topic
- Wrote a 5,000-word structured report with 7 findings, 23 inline-cited data points, contradictions section, falsifiable claims, and 8 open questions — all calibrated to hermes-arb backtest needs

**Key takeaways for `swarm-fund-mvp`:**
- ADR-038's 7pp min-edge gate likely understates settlement-basis noise by 50-100bp; recommend bumping to ~7.5-8pp
- Polymarket's ~1s order signing latency forces architecture (resting limits on PM, aggressive takes on Kalshi)
- The dominant residual edge AND noise term is settlement-basis between Polymarket Chainlink Data Streams (sub-second) and Kalshi CFB RTI (60s trimmed mean across 8 exchanges)
- `memory/topics/polymarket.md` is referenced in MEMORY.md but missing on disk — creating it is a recommended follow-up

**Files created/modified:**
- `articles/deep-research-2026-04-25.md` (full report)
- `memory/logs/2026-04-25.md` (appended log entry)
- `.outputs/deep-research.md` (notification body)
- `.pending-notify/1777127800.md` (queued notification — direct `./notify` blocked by sandbox "Unhandled node type: string", same pattern as earlier polymarket-comments and narrative-tracker runs today)

**Follow-up actions for the operator:**
1. Wire a 1s-resolution Kalshi BRTI vs Polymarket Chainlink basis recorder into hermes-arb's data pipeline (highest leverage)
2. Adjust hermes-arb min-edge gate per ADR-038 update
3. Create `memory/topics/polymarket.md` (consolidating settlement source, signing latency, CLOB region, datacenter ban)
4. The cross-venue Kalshi↔PM BTC measurement gap in peer-reviewed literature is a publishable Stanford-tier paper opportunity

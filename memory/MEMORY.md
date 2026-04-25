# Long-term Memory
*Last consolidated: 2026-04-25*

## Operator
Thomas Scaria (`tomscaria` on GitHub, `t@rswarm.ai`). See `soul/SOUL.md` for full identity.

## Mission
This Aeon instance exists to accelerate **swarm-fund-mvp** toward grant funding and the Apex lifecycle gate. Every output should serve one of three goals:
1. **Near-term income** — advisory, grant applications (AWS, Anthropic, dYdX, Uniswap, Polymarket Builders, Harmonic)
2. **Stanford PhD prep** for Dec 2026 application
3. **Live P&L proof** for the LP raise — get more agents from Birth → Canary → Apex

## Active project
**`tomscaria/swarm-fund-mvp`** — Swarm Lab research apparatus.
- Live agent: **CalibrationGap (Revenant)** — Polymarket binary calibration, canary stage, 29 closed / 76% win / +$415 P&L / Sharpe 0.31. Target: 100-trade Apex gate (~2-3 weeks).
- Hermes family in development: `hermes-arb` (Kalshi↔PM 5-min BTC), `hermes-cascade`, `hermes-oracle`, `hermes-funding`, `hermes-fan`. 30–60 variants per template via Latin Hypercube.
- Stack: Python + Paperclip + FastAPI + QuestDB + RedPanda + PostgreSQL + Redis + Temporal. lmnr tracing on every strategy.
- Execution venues: Hyperliquid (perps), Polymarket (direct CTF). Kalshi added recently.

## Topic files
See `memory/topics/` for detail:
- `swarm-fund.md` — full project state, architecture, recent ADRs
- `polymarket.md` — markets watched, builder code, datacenter-ban gotcha
- `grants.md` — open applications, status, deadlines
- `phd.md` — Stanford prep focus areas, paper backlog
- `voice.md` — phrases to never use in public output

## Forbidden phrases (external content)
- "RenTech," "Simons," "Medallion" — never. Use "live-ingest as moat" instead.
- "Darwinian as mechanism" — never. "Darwinian as ambition" is OK.
- "cross-venue alpha" — say "convergence trade" instead.
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji.

## Current canary metrics (Revenant)
| Stat | Value |
|------|-------|
| Closed trades | 29 |
| Win rate | 76% |
| Net P&L | +$415 |
| Sharpe | 0.31 |
| Apex gate | 100 closed trades, Sharpe > 0.5 |
| ETA | 2-3 weeks at current rate |

Update this table whenever `monitor-polymarket` or `evening-recap` reports new closed trades.

## Tracked Tokens
| Token | CoinGecko ID | Alert Threshold |
|-------|--------------|-----------------|
| BTC   | bitcoin      | 10%             |
| ETH   | ethereum     | 10%             |
| SOL   | solana       | 10%             |

BTC is load-bearing for `hermes-arb` (Kalshi↔PM 5-min BTC). ETH/SOL serve as liquid macro proxies for regime context.

## Skills Built
| Skill | Date | Notes |
|-------|------|-------|

## Recent Articles
| Date | Title | Topic |
|------|-------|-------|

## Recent Digests
| Date | Type | Key Topics |
|------|------|------------|
| 2026-04-25 | prediction markets | perps launch (PM Apr 21 / Kalshi Apr 27), first US insider-trading prosecution, Brazil ban |

## Lessons Learned
- Digest format: Markdown with clickable links, under 4000 chars
- Always save files AND commit before logging
- When swarm-fund-mvp metrics conflict with what's in this file, trust the live `metrics.json` at https://rswarm.ai/metrics.json
- Polymarket bans datacenter/VPN IPs — co-lo strategy applies to HL leg only

## Next Priorities
- Pre-Apex push: `monitor-polymarket` and `polymarket-comments` are the highest-leverage daily skills
- `weekly-shiplog` Mondays → forward to grant committees
- `paper-pick` daily → build PhD reading list
- `external-feature` should PR enhancements to `tomscaria/swarm-fund-mvp` proactively

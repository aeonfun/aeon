# Long-term Memory
*Last consolidated: 2026-04-25 (reflect)*

## Operator
Thomas Scaria (`tomscaria` on GitHub, `t@rswarm.ai`). See `soul/SOUL.md` for full identity.

## Mission
This Aeon instance exists to accelerate **swarm-fund-mvp** toward grant funding and the Apex lifecycle gate. Every output should serve one of three goals:
1. **Near-term income** — advisory, grant applications (AWS, Anthropic, dYdX, Uniswap, Polymarket Builders, Harmonic)
2. **Stanford PhD prep** for Dec 2026 application
3. **Live P&L proof** for the LP raise — get more agents from Birth → Canary → Apex

## Active project
**`tomscaria/swarm-fund-mvp`** — Swarm Lab research apparatus.
- Live agent: **CalibrationGap (Revenant)** — Polymarket binary calibration, canary stage, 29 closed / 76% win / +$415 P&L / Sharpe 0.31. Target: 100-trade Apex gate (~2-3 weeks, 71 to go).
- Hermes family in development: `hermes-arb` (Kalshi↔PM 5-min BTC), `hermes-cascade`, `hermes-oracle`, `hermes-funding`, `hermes-fan`. 30–60 variants per template via Latin Hypercube.
- Stack: Python + Paperclip + FastAPI + QuestDB + RedPanda + PostgreSQL + Redis + Temporal. lmnr tracing on every strategy.
- Execution venues: Hyperliquid (perps), Polymarket (direct CTF), Kalshi.

## Topic files
- `memory/topics/swarm-fund.md` — full project state, architecture, recent ADRs
- `memory/topics/polymarket.md` — settlement-basis, builder code, datacenter ban, LOOP-violation paper, decay numbers, comments-side handles
- `memory/topics/aeon-ops.md` — sandbox limits, notify hook-block bug, prefetch script gaps, config-gap operator action list
- `memory/topics/grants.md` — open applications, status, deadlines
- `memory/topics/market-context.md` — most recent market snapshot (last refreshed each market-context-refresh run)
- `memory/topics/milestones.md` — star-milestone tracking (aaronjmars/aeon at 200 stars baseline)

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

Update this table whenever `monitor-polymarket` or `evening-recap` reports new closed trades. When live `metrics.json` at https://rswarm.ai/metrics.json conflicts, **trust live**.

## Tracked Tokens
| Token | CoinGecko ID | Alert Threshold |
|-------|--------------|-----------------|
| BTC   | bitcoin      | 10%             |
| ETH   | ethereum     | 10%             |
| SOL   | solana       | 10%             |

BTC is load-bearing for `hermes-arb` (Kalshi↔PM 5-min BTC). ETH/SOL serve as liquid macro proxies for regime context.

## Recent Articles (last 7 days)
| Date | Title | Topic |
|------|-------|-------|
| 2026-04-27 | Polymarket's Top 20 Is 70% Bots. The Conduct Rules Are Catching Up. | bot-dominance + insider-trading conduct rules |
| 2026-04-27 | Aeon's Last Two Feature PRs Both Came From Its Own Brainstorm Output | repo-article on aaronjmars/aeon meta-skill self-prioritization |
| 2026-04-25 | Settlement-Basis Risk: Why the Same BTC Binary Resolves Differently on Polymarket and Kalshi | technical-explainer |
| 2026-04-25 | Deep Research: Kalshi↔Polymarket BTC Binary Arbitrage | hermes-arb backtest |
| 2026-04-25 | Aeon Stopped Shipping Single-Instance Features Four Days Ago | repo-article on aaronjmars/aeon fleet pivot |
| 2026-04-25 | Autonomous Agents Got an Open Stack in April 2026 | DeepSeek V4 + agent-wallet stack |
| 2026-04-25 | Research Brief — Prediction-Market Calibration | calibration-slope structural-bias thesis |
| 2026-04-25 | Code Health Report — aaronjmars/aeon | test-coverage gap on dashboard/a2a/mcp |
| 2026-04-25 | Repo Actions — aaronjmars/aeon | top pick: dependabot.yml |
| 2026-04-25 | Changelog — Week of 2026-04-25 | 15 user-facing entries on aaronjmars/aeon |
| 2026-04-25 | Vuln Scanner — 2026-04-25 (ERROR) | ISS-001 filed |

## Recent Digests
| Date | Type | Key Topics |
|------|------|------------|
| 2026-04-27 | prediction markets | Kalshi Timeless perps live, DOJ five-felony charges on named Sgt. Van Dyke, CFTC 15-year staffing low, co-rolled self-trading bans |
| 2026-04-25 | prediction markets | perps launch (PM Apr 21 / Kalshi Apr 27 slipped), first US insider-trading prosecution, Brazil ban |
| 2026-04-25 | security-digest | 3 patch-today (TeamCity / PaperCut / Samsung MagicINFO), CVE-2026-40068 affects @anthropic-ai/claude-code (pin ≥2.1.84) |
| 2026-04-25 | narrative-tracker | GameFi/Ronin (rising), AI agents (rising), Polymarket attention markets, meme-launchpad casino rotation (BSC sub-tape) |

## Lessons Learned
- Digest format: Markdown with clickable links, under 4000 chars
- Always save files AND commit before logging
- When swarm-fund-mvp metrics conflict with what's in this file, trust the live `metrics.json` at https://rswarm.ai/metrics.json
- Polymarket bans datacenter/VPN IPs — co-lo strategy applies to HL leg only
- `./notify` multi-line `$(cat …)` form hits "Unhandled node type: string" hook-block today; flatten to single-line, or queue `.pending-notify/` (delivery via workflow pickup, not the absent `scripts/postprocess-notify.sh`)
- Bash env-var expansion blocked for API keys (XAI/NEYNAR); prefetch scripts (`scripts/prefetch-xai.sh` template) or `node -e` are the workarounds
- See `memory/topics/aeon-ops.md` for the full sandbox-limitation matrix and the operator config-gap action list

## Repo state (aaronjmars/aeon)
- 244 stars / 36 forks (2026-04-27). +7 stars in 2 days. 250-star milestone within ~2 days.
- Velocity narrative: fleet-pivot thesis held — PR #144 (contributor-reward, 2026-04-26) is a fifth fleet primitive and extends the pivot from observation to compensation. New thesis layer: PRs #142 and #144 both close the project's own repo-actions self-brainstorm (idea #1 and #2 in rank order); next falsifier is whether PR #145 closes idea #3 (system) or something off-queue (taste).

## Next Priorities
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` are the highest-leverage daily skills. CalibrationGap edge thesis depends on PM fees / handle persistence (currently +76% w/w, supportive).
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding; wire Kalshi-BRTI vs PM-Chainlink basis recorder.
- **Operator config sweep** (see `memory/topics/aeon-ops.md`): populate `memory/on-chain-watches.yml`; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add NEYNAR_API_KEY secret; land `scripts/prefetch-vuln-scanner.sh` (ISS-001) and `scripts/prefetch-reddit.sh` (ISS-002).
- **External-feature** continues PR'ing enhancements to `tomscaria/swarm-fund-mvp` (PR #18 open today: `fix(bankr_bridge): validate --max arg`).
- **`weekly-shiplog` Mondays** → forward to grant committees.
- **`paper-pick` daily** → builds PhD reading list. Strongest recent: arXiv:2512.25070 (Hardt/Geiping calibration RL), arXiv:2601.01706 (Gebele LOOP violations).

# Long-term Memory
*Last consolidated: 2026-04-27 (reflect)*

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
- `memory/topics/aeon-ops.md` — sandbox limits, notify hook-block bug, prefetch script gaps, chain-runner DEGRADED bug, eval-spec drift, config-gap operator action list
- `memory/topics/grants.md` — open applications, status, deadlines
- `memory/topics/market-context.md` — most recent market snapshot (last refresh 2026-04-25 — overdue, next market-context-refresh slot pending chain-runner fix)
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

Update this table whenever `monitor-polymarket` or `evening-recap` reports new closed trades. When live `metrics.json` at https://rswarm.ai/metrics.json conflicts, **trust live**. Note: monitor-polymarket dispatch missed today's slot (chain-runner bug) — verify metrics live next sweep.

## Tracked Tokens
| Token | CoinGecko ID | Alert Threshold |
|-------|--------------|-----------------|
| BTC   | bitcoin      | 10%             |
| ETH   | ethereum     | 10%             |
| SOL   | solana       | 10%             |

BTC is load-bearing for `hermes-arb` (Kalshi↔PM 5-min BTC). ETH/SOL serve as liquid macro proxies for regime context. 2-day baseline (2026-04-25 → 2026-04-27): BTC $77.6k → $79.1k (+1.98%), ETH $2,316 → $2,389 (+3.15%), SOL $86.45 → $87.66 (+1.40%) — slow risk-on, no thresholds tripped.

## Recent Articles (last 7 days)
| Date | Title | Topic |
|------|-------|-------|
| 2026-04-27 | Kalshi and Polymarket Filed Crypto Perps the Same Day. The CFTC Invited Them. | Kalshi/PM crypto perp launch — direct hermes-arb impact |
| 2026-04-27 | Polymarket's Top 20 Is 70% Bots. The Conduct Rules Are Catching Up. | bot-dominance + insider-trading conduct rules |
| 2026-04-27 | Aeon's Last Two Feature PRs Both Came From Its Own Brainstorm Output | repo-article on aaronjmars/aeon meta-skill self-prioritization |
| 2026-04-26 | Skill Evals — 2026-04-26 | BOOTSTRAP: 14/97 coverage, 9 NEW_FAIL (mostly spec drift, not real regressions) |
| 2026-04-25 | Settlement-Basis Risk: Why the Same BTC Binary Resolves Differently on Polymarket and Kalshi | technical-explainer |
| 2026-04-25 | Deep Research: Kalshi↔Polymarket BTC Binary Arbitrage | hermes-arb backtest |
| 2026-04-25 | Research Brief — Prediction-Market Calibration | calibration-slope structural-bias thesis |
| 2026-04-25 | Aeon Stopped Shipping Single-Instance Features Four Days Ago | repo-article on aaronjmars/aeon fleet pivot |
| 2026-04-25 | Autonomous Agents Got an Open Stack in April 2026 | DeepSeek V4 + agent-wallet stack |
| 2026-04-25 | Code Health Report — aaronjmars/aeon | test-coverage gap on dashboard/a2a/mcp |
| 2026-04-25 | Repo Actions / Changelog / Vuln Scanner — aaronjmars/aeon | bootstrap batch (vuln scan errored → ISS-001) |

## Recent Digests
| Date | Type | Key Topics |
|------|------|------------|
| 2026-04-27 | prediction markets (PM-ops re-run, 14:27 UTC) | Polymarket V2 cutover at 11 UTC Tue Apr 28 (orderbook wiped, USDC.e→pUSD, builder codes on-chain — flatten resting orders before 07 UTC); Polymarket chain-migration off Polygon, POLY L2 lead candidate (Stevens Apr 25; PM = 50-70% Polygon fees); FanDuel enters prediction markets (Bloomberg Apr 27); Brazil block of 29 platforms now in force (glance) |
| 2026-04-27 | narrative-tracker | Kalshi crypto perps LIVE (Apr 26) → FRONT-RUN PM-Chainlink vs Kalshi-BRTI BTC settlement basis; US Strategic BTC Reserve framework; Solana Alpenglow validator-approved; Aave/DeFi governance critique; GameFi/Ronin demoted, HYPER dead |
| 2026-04-27 | prediction markets (earlier run) | Kalshi Timeless perps live, DOJ five-felony charges on named Sgt. Van Dyke, CFTC 15-year staffing low, co-rolled self-trading bans |
| 2026-04-26 | paper-pick | arXiv:2604.17295 LLaTiSA (HF Daily ↑80) — difficulty-stratified TSR, applicable to CalibrationGap eval design |
| 2026-04-26 | hn-digest (via daily-routine) | Erdős+ChatGPT proof, EU age-control trojan, DeepSeek V4 Day 0, iPhone silent install |
| 2026-04-26 | token-movers | APE reverse flop: yesterday +39% BREAKOUT → today -17% CAPITULATION (FADE thesis from 04-25 played out) |
| 2026-04-25 | prediction markets | perps launch (PM Apr 21 / Kalshi Apr 27 slipped), first US insider-trading prosecution, Brazil ban |
| 2026-04-25 | security-digest | 3 patch-today (TeamCity / PaperCut / Samsung MagicINFO), CVE-2026-40068 affects @anthropic-ai/claude-code (pin ≥2.1.84) |
| 2026-04-25 | narrative-tracker | GameFi/Ronin (rising), AI agents (rising), Polymarket attention markets, meme-launchpad casino rotation (BSC sub-tape) |

## Open issues
- 12 open in `memory/issues/INDEX.md`. ISS-001 / ISS-002 / ISS-012 are sandbox-limitation (vuln-scanner, vibecoding-digest, reddit-digest) — all close on a `scripts/prefetch-reddit.sh` + `scripts/prefetch-vuln-scanner.sh` land. ISS-003..011 are skill-evals BOOTSTRAP findings; most are eval-spec drift (`hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket`), not real skill regressions.
- 🔴 **chain-runner.yml DEGRADED** (2026-04-26 heartbeat): `dispatch_skill()` in `.github/workflows/chain-runner.yml` exits 1 silently for `morning-brief` and `evening-rollup` chains, even when underlying skills succeed. No `Dispatching: …` lines emitted, dispatch never reaches `gh workflow run`. Today's morning-brief slot (08:00 UTC) and yesterday's evening-rollup wrapper both failed. Add an echo per dispatched skill before the next failure.

## Lessons Learned
- Digest format: Markdown with clickable links, under 4000 chars
- Always save files AND commit before logging
- When swarm-fund-mvp metrics conflict with what's in this file, trust the live `metrics.json` at https://rswarm.ai/metrics.json
- Polymarket bans datacenter/VPN IPs — co-lo strategy applies to HL leg only
- `./notify` multi-line `$(cat …)` form continues to hit "Unhandled node type: string" hook-block (3 days running). Flatten to single line, or queue `.pending-notify/{ts}.md`. **Note:** `scripts/postprocess-notify.sh` is *not* in the tree — `.pending-notify/` delivery depends on workflow-side pickup (verify in `.github/workflows/aeon.yml`)
- Bash env-var expansion blocked for API keys (XAI/NEYNAR); prefetch scripts (`scripts/prefetch-xai.sh` template) or `node -e` are the workarounds
- `skill-evals` evals.json keys must match `aeon.yml` skill names exactly — `hn-digest` ≠ `hacker-news-digest`, `polymarket` ≠ `monitor-polymarket`. Fixing keys clears NEW_FAIL without code changes (ISS-007, ISS-009)
- See `memory/topics/aeon-ops.md` for the full sandbox-limitation matrix, chain-runner bug detail, and the operator config-gap action list

## Repo state (aaronjmars/aeon)
- 244 stars / 36 forks (2026-04-27). +7 stars in 2 days. 250-star milestone within ~2 days.
- Velocity narrative: fleet-pivot thesis held — PR #144 (contributor-reward, 2026-04-26) is a fifth fleet primitive and extends the pivot from observation to compensation. New thesis layer: PRs #142 and #144 both close the project's own repo-actions self-brainstorm (idea #1 and #2 in rank order); next falsifier is whether PR #145 closes idea #3 (system) or something off-queue (taste).
## Repo state (aaronjmars/aeon, as of 2026-04-25 — refresh due)
- 237 stars / 36 forks. +8 stars 24h SURGE on the bootstrap day; v7=53, v30=120. Next milestone (250) within 2-3 days at that rate — needs a fresh count.
- Velocity narrative: PRs #139–#142 in the prior 4 days all targeted the fork-fleet, not single-instance work — **fleet-operations pivot**. Falsification trigger: next feature PR after #142 reverting to single-instance work weakens the thesis.

## Next Priorities
- **🔴 Fix chain-runner.yml `dispatch_skill()`** — top priority. Morning-brief and evening-rollup chains are silently failing; today's `paper-pick`, `hacker-news-digest`, `monitor-polymarket`, `monitor-kalshi`, `github-monitor`, `narrative-tracker` all missed their 08:00 UTC slot. Add an echo per dispatched skill so the next failure traces.
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` are the highest-leverage daily skills. CalibrationGap edge thesis depends on PM fees / handle persistence (was +76% w/w on 04-25, supportive). Resume tracking once chain-runner fix lands.
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding; wire Kalshi-BRTI vs PM-Chainlink basis recorder.
- **Operator config sweep** (see `memory/topics/aeon-ops.md`): populate `memory/on-chain-watches.yml`; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add NEYNAR_API_KEY secret; land `scripts/prefetch-vuln-scanner.sh` (ISS-001), `scripts/prefetch-reddit.sh` (ISS-002 + ISS-012), and verify `scripts/postprocess-notify.sh` exists or wire workflow-side pickup.
- **Skill-evals key fixes** (lowest-effort, highest-signal): patch evals.json `hn-digest` → `hacker-news-digest` (ISS-007), `polymarket` → `monitor-polymarket` (ISS-009). Closes 2 of the 9 NEW_FAILs without code changes.
- **External-feature** continues PR'ing enhancements to `tomscaria/swarm-fund-mvp` (PR #18 open 04-25: `fix(bankr_bridge): validate --max arg`).
- **`weekly-shiplog` Mondays** → forward to grant committees.
- **`paper-pick` daily** → builds PhD reading list. Strongest recent: arXiv:2604.17295 (LLaTiSA TSR), arXiv:2512.25070 (Hardt/Geiping calibration RL), arXiv:2601.01706 (Gebele LOOP violations).

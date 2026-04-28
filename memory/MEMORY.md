# Long-term Memory
*Last consolidated: 2026-04-27 PM (reflect #2)*

## Operator
Thomas Scaria (`tomscaria` on GitHub, `t@rswarm.ai`). See `soul/SOUL.md` for full identity.

## Mission
This Aeon instance exists to accelerate **swarm-fund-mvp** toward grant funding and the Apex lifecycle gate. Every output should serve one of three goals:
1. **Near-term income** — advisory + grants (AWS, Anthropic, dYdX, Uniswap, Polymarket Builders, Harmonic)
2. **Stanford PhD prep** — Dec 2026 application
3. **Live P&L proof** for the LP raise — push more agents Birth → Canary → Apex

## Active project
**`tomscaria/swarm-fund-mvp`** — Swarm Lab research apparatus.
- Live agent: **CalibrationGap (Revenant)** — Polymarket binary calibration, canary stage, 29 closed / 76% win / +$415 P&L / Sharpe 0.31. Target: 100-trade Apex gate (~2-3 weeks, 71 to go). Trust live `metrics.json` at https://rswarm.ai/metrics.json over this file.
- Hermes family: `hermes-arb` (Kalshi↔PM 5-min BTC) is now the Day-0 priority — Kalshi crypto perps live 2026-04-27 NYC opens the falsifier window. `hermes-cascade`, `hermes-oracle`, `hermes-funding`, `hermes-fan` in spec/scaffold.
- Stack: Python + Paperclip + FastAPI + QuestDB + RedPanda + PostgreSQL + Redis + Temporal. lmnr tracing on every strategy.

## Topic files
- `memory/topics/swarm-fund.md` — full project state, architecture, recent ADRs
- `memory/topics/polymarket.md` — V2 cutover ops alert, settlement-basis, builder code, datacenter ban, LOOP-violation paper, decay numbers, comments-side handles
- `memory/topics/aeon-ops.md` — sandbox limits, notify hook-block bug (4-day recurring), prefetch script gaps, chain-runner DEGRADED bug, eval-spec drift, ISS-013 mass-failure, config-gap operator action list
- `memory/topics/grants.md` — open applications, status, deadlines
- `memory/topics/market-context.md` — most recent snapshot (2026-04-27 PM)
- `memory/topics/milestones.md` — aaronjmars/aeon star count (244 now, 250 next)

## Forbidden phrases (external content)
- "RenTech," "Simons," "Medallion" — never. Use "live-ingest as moat" instead.
- "Darwinian as mechanism" — never. "Darwinian as ambition" is OK.
- "cross-venue alpha" — say "convergence trade" instead.
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji.

## 🔴 OPS ALERTS
- **2026-04-28 11 UTC: Polymarket V2 cutover wipes ALL existing limit orders.** Operator must flatten Revenant resting-quote book before 07 UTC tomorrow, or accept the wipe. USDC.e → pUSD, builder codes go on-chain, ~1h offline. See `memory/topics/polymarket.md`.
- **chain-runner.yml `dispatch_skill()` still DEGRADED.** Now confirmed across morning-brief, evening-rollup, AND weekly-grant-update (Mon Apr 27 09:00). Top fix.
- **ISS-013 mass-failure** — 53 skills CRITICAL after 2026-04-26 23:53–58Z storm; counters decaying naturally. Operator should pull GHA logs.

## Kalshi signals
- **2026-04-28:** KXBTC-26MAY0117 BTC distribution modal ~$77k for May 1; yesterday spot $79,142 with flow into $79-82k, today peak vol at $77.5-78k (+167% vol). Distribution shifted ~$2k down. KXFED-27APR T4.00 at 57% (2-3 cuts priced by Apr 2027). Watchlist still empty — add KXBTC-26MAY0117 and KXETH-26MAY0117.

## Tracked Tokens
| Token | CoinGecko ID | Alert Threshold |
|-------|--------------|-----------------|
| BTC | bitcoin | 10% |
| ETH | ethereum | 10% |
| SOL | solana | 10% |

## Current canary metrics (Revenant)
| Stat | Value |
|------|-------|
| Closed trades | 29 |
| Win rate | 76% |
| Net P&L | +$415 |
| Sharpe | 0.31 |
| Apex gate | 100 closed trades, Sharpe > 0.5 |

## Recent Articles (last 7 days, terse)
| Date | Title |
|------|-------|
| 2026-04-28 | Polymarket Rebuilt Its Exchange Stack This Morning. The Order-Book Wipe Is the Smallest Change. |
| 2026-04-28 | Aeon's Last Seven PRs Are All About the Forks. Zero Touched the Skill Executor. |
| 2026-04-27 | Kalshi and Polymarket Filed Crypto Perps the Same Day. The CFTC Invited Them. |
| 2026-04-27 | Polymarket's Top 20 Is 70% Bots. The Conduct Rules Are Catching Up. |
| 2026-04-27 | Aeon's Last Two Feature PRs Both Came From Its Own Brainstorm Output |
| 2026-04-27 | One Calibration Slope Hides Four (Le 2026 four-component decomposition) |
| 2026-04-27 | Research Brief — Kalshi/Polymarket Onshore Crypto Perpetuals |
| 2026-04-27 | Research Brief — US Prediction-Market Insider-Trading Enforcement |
| 2026-04-27 | Code Health Report — aaronjmars/aeon (shell-injection finding ISS-015) |
| 2026-04-27 | Cost Report — $118 / 19 runs / projected $506/mo |
| 2026-04-27 | Push Recap — PRs #142, #144, #145 (skill-analytics + contributor-reward + SHOWCASE) |
| 2026-04-27 | Repo Actions — typescript-check.yml top pick |
| 2026-04-27 | Skill Leaderboard / Fork Contributor Leaderboard / Fork Skill Digest |
| 2026-04-27 | Vuln Scan / Security Scan (workflow-security-audit-2026-04-27.patch + ISS-014/015) |
| 2026-04-27 | Changelog — Week of 2026-04-27 (PRs #142/144/145 highlights) |
| 2026-04-26 | Skill Evals — BOOTSTRAP, 14/97 coverage, 9 NEW_FAIL |
| 2026-04-25 | Settlement-Basis Risk + Deep Research + Calibration Brief + repo-actions/changelog/vuln-scan |

## Recent Digests (terse)
| Date | Type | Key Topics |
|------|------|------------|
| 2026-04-28 | digest (PM) | Polymarket CLOB v2 LIVE (pUSD + builder codes + $1M LP) · Kalshi $3.91B w/w (2:1 over PM) · 3-issuer SEC queue for prediction-ETFs |
| 2026-04-27 PM | digest (PM) | V2 cutover Tue 11 UTC + Polygon-deprecation tension + FanDuel entering + Brazil block in force |
| 2026-04-27 PM | narrative-tracker (refinement) | Kalshi launch=Apr 27 (not 26); HL/Aster split (HL 44% vs Aster 70%→15%); Alpenglow timing-corrected to Q4 2026 |
| 2026-04-27 PM | polymarket-comments | UMA-dispute concentration risk (Iran ↔ Hezbollah identical playbook); Tamil Nadu DMK 80% mispricing flag (May 4); 9 new tracked handles |
| 2026-04-27 PM | deal-flow | Anthropic $5B Amazon, Polymarket vs Kalshi $15B/$22B (~30% PM discount), FanDuel entering |
| 2026-04-27 PM | security-digest | Kentico / MS Defender / Cisco SD-WAN trio (PATCH TODAY); Aeon-stack pin to ≥2.1.84 still unverified |
| 2026-04-27 PM | unlock-monitor | EIGEN $6.56M @0.63x daily vol May 1 (top leverage); FTX preferred-equity record date Apr 30 |
| 2026-04-27 AM | digest (PM) | Kalshi Timeless live, Sgt Van Dyke five-felony charges, CFTC 15-yr staffing low, self-trading bans |
| 2026-04-27 AM | narrative-tracker | Kalshi-BRTI vs PM-Chainlink basis FRONT-RUN; US Strategic BTC Reserve framework; April hack month |
| 2026-04-28 | paper-pick | arXiv:2509.22638 Luo et al. *Verbal-Feedback Without Scalar Rewards* (HF ↑70, FCP for FinCon-axis verbal-RL) |
| 2026-04-26 | paper-pick | arXiv:2604.17295 LLaTiSA (HF Daily ↑80, difficulty-stratified TSR) |
| 2026-04-25 | (multiple) | perps launch + DOJ insider case + Brazil ban + APE +39% pre-capitulation |

## Open issues (15 total)
- 13 open in `memory/issues/INDEX.md`. ISS-001 / ISS-002 / ISS-012 / ISS-014 — sandbox-limitation prefetch class. ISS-003..011 — skill-evals BOOTSTRAP findings (8/9 are spec drift). ISS-013 — fleet-wide mass-failure 2026-04-26 storm. ISS-015 — workflows/messages.yml script-injection (PR #4 awaiting workflow-scoped token).
- chain-runner.yml `dispatch_skill()` still DEGRADED (now hits 3+ chains).

## Recent papers (PhD-prep reading list)
- arXiv:2511.03628 *LiveTradeBench* (Yu/Li/You, UIUC NCSA, Nov 2025) — 50-day live eval of 21 LLMs on US stocks + Polymarket; "LMArena ≠ trading outcomes."
- arXiv:2601.13545 *TruthTensor* (Shahabi/Graham/Isah, Jan 2026) — multi-axis eval (accuracy/calibration/drift/risk) on 500+ live PM markets; truthtensor.com open-source.
- arXiv:2604.22748 *Agentic World Modeling* (Chu et al., Apr 2026) — L1/L2/L3 taxonomy maps onto Birth → Canary → Apex.
- arXiv:2604.17295 *LLaTiSA* (Ding et al., Apr 2026) — difficulty-stratified TSR.
- arXiv:2602.19520 *Le 2026 four-component decomposition* — 87.3% variance explained by horizon + domain×horizon + domain×size + domain intercept.
- arXiv:2601.01706 *Gebele LOOP violations* — durable 2-4% LOOP gaps across 100k events / 10 venues.
- arXiv:2509.22638 *Luo et al. Verbal-Feedback Without Scalar Rewards* (Sea AI Lab, Sep 2025, ↑70) — feedback-conditional policy reframes RLHF as conditional generation; skips scalar-reward compression. Picked 2026-04-28 PhD slot.
- arXiv:2512.25070 *Hardt/Geiping calibration RL*, 2604.22436 *AgentSearchBench*, 2602.04837 *Group-Evolving Agents*, 2602.16928 *Discovering Multiagent Learning Algorithms with LLMs* — next reads.

## Lessons Learned
- Trust live `metrics.json` at https://rswarm.ai/metrics.json when conflicting with this file.
- Polymarket bans datacenter/VPN IPs — co-lo strategy applies to HL leg only.
- `./notify` multi-line `$(cat …)` continues to hit "Unhandled node type: string" hook-block (4 days running). Use single-line form, `node -e "execFileSync(...)"`, or `.pending-notify/{ts}.md` queue. **`scripts/postprocess-notify.sh` is not in tree** — pickup depends on workflow-side wiring.
- Bash env-var expansion blocked for API keys (XAI/NEYNAR); prefetch scripts or `node -e` are workarounds.
- `skill-evals` evals.json keys must match `aeon.yml` skill names exactly — `hn-digest` ≠ `hacker-news-digest`, `polymarket` ≠ `monitor-polymarket`. Patching keys clears NEW_FAIL without code (ISS-007, ISS-009).
- See `memory/topics/aeon-ops.md` for full sandbox-limitation matrix, chain-runner bug detail, and operator config-gap action list.

## Next Priorities
- **🔴 Flatten Revenant resting-quote book before 2026-04-28 07 UTC** (V2 cutover wipes orderbook at 11 UTC). Confirm via help.polymarket.com primary doc.
- **🔴 Fix chain-runner.yml `dispatch_skill()`** — now 3+ chains affected (morning-brief, evening-rollup, weekly-grant-update). Add an echo per dispatched skill before each `gh workflow run`.
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` are the highest-leverage daily skills. Resume daily once chain-runner fix lands.
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding.
- **Operator config sweep** (see `memory/topics/aeon-ops.md`): populate `memory/on-chain-watches.yml`; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add `NEYNAR_API_KEY` secret + `X_HANDLE` env; land `scripts/prefetch-vuln-scanner.sh` (ISS-001), `scripts/prefetch-reddit.sh` (ISS-002 + ISS-012), `reply-maker)` case in `scripts/prefetch-xai.sh` (ISS-014); verify `scripts/postprocess-notify.sh` exists or wire workflow-side pickup; merge or close PR `tomscaria/aeon#1` (~44h stalled).
- **Skill-evals key fixes** (lowest-effort, highest-signal): patch evals.json `hn-digest` → `hacker-news-digest` (ISS-007), `polymarket` → `monitor-polymarket` (ISS-009).
- **External-feature** continues PR'ing to `tomscaria/swarm-fund-mvp` (PRs #18, #19, #20 — bankr_bridge --max validator, ssrn_harvest rowcount fix, markdown image-strip regex).
- **Stalin-tier review:** apply `articles/workflow-security-audit-2026-04-27.patch` with workflow-scoped token to land ISS-015 fix (PR #4).
- **`weekly-shiplog` Mondays** → forward to grant committees. (Today's slot ran successfully under the chain consume step despite wrapper failure.)
- **`paper-pick` daily** → builds PhD reading list (see Recent papers above).

## Completed Goals
- **Wire Kalshi-BRTI vs PM-Chainlink basis recorder** for hermes-arb — completed 2026-04-27 (Kalshi crypto perps live; recorder launched per 2026-04-28 hermes-arb log).

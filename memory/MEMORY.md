# Long-term Memory
*Last consolidated: 2026-04-28 PM (reflect #3)*

## Operator
Thomas Scaria (`tomscaria` on GitHub, `t@rswarm.ai`). See `soul/SOUL.md` for full identity.

## Mission
This Aeon instance exists to accelerate **swarm-fund-mvp** toward grant funding and the Apex lifecycle gate. Every output should serve one of three goals:
1. **Near-term income** — advisory + grants (AWS, Anthropic, dYdX, Uniswap, Polymarket Builders, Harmonic)
2. **Stanford PhD prep** — Dec 2026 application
3. **Live P&L proof** for the LP raise — push more agents Birth → Canary → Apex

## Active project
**`tomscaria/swarm-fund-mvp`** — Swarm Lab research apparatus.
- Live agent: **CalibrationGap (Revenant)** — Polymarket binary calibration, canary stage, 29 closed / 76% win / +$415 P&L / Sharpe 0.31. Target: 100-trade Apex gate (~2-3 weeks, 71 to go). Trust live `metrics.json` at https://rswarm.ai/metrics.json over this file. **Resting-quote book wiped 2026-04-28 11 UTC by V2 cutover** (whether or not operator-side flatten ran).
- Hermes family: `hermes-arb` (Kalshi↔PM 5-min BTC) is now Day-1 — Kalshi crypto perps live 2026-04-27 NYC; first 24h tape is the load-bearing dataset for the falsifier window. `hermes-cascade`, `hermes-oracle`, `hermes-funding`, `hermes-fan` in spec/scaffold.
- Stack: Python + Paperclip + FastAPI + QuestDB + RedPanda + PostgreSQL + Redis + Temporal. lmnr tracing on every strategy.

## Topic files
- `memory/topics/swarm-fund.md` — full project state, architecture, recent ADRs
- `memory/topics/polymarket.md` — V2 cutover **EXECUTED**, settlement-basis, builder code, datacenter ban, LOOP-violation paper, decay numbers, comments-side handles (incl. Car↔Peppery-Capital identity unification)
- `memory/topics/aeon-ops.md` — sandbox limits, notify hook-block bug (5-day recurring), `node -e` workaround pattern, prefetch script gaps, chain-runner DEGRADED bug, eval-spec drift, ISS-013 mass-failure tail decaying, config-gap operator action list
- `memory/topics/grants.md` — open applications, status, deadlines
- `memory/topics/market-context.md` — most recent snapshot (2026-04-28, risk-off, F&G 33 Fear)
- `memory/topics/milestones.md` — aaronjmars/aeon star count (251 now, 300 next ETA ~2026-05-06)

## Forbidden phrases (external content)
- "RenTech," "Simons," "Medallion" — never. Use "live-ingest as moat" instead.
- "Darwinian as mechanism" — never. "Darwinian as ambition" is OK.
- "cross-venue alpha" — say "convergence trade" instead.
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji.

## 🔴 OPS ALERTS
- **chain-runner.yml `dispatch_skill()` still DEGRADED** — confirmed 3+ chains affected (morning-brief, evening-rollup, weekly-grant-update). **Top operator fix.** Add an echo per dispatched skill before each `gh workflow run`.
- **FOMC Apr 28-29** — 99.85% no-change priced. Surprise prints sharp two-way vol. Tail-risk position vs Polymarket comments contrarian (`Experienced-Carpeting`).
- **UMA-resolution arbitrage live (Iran-cf vs Hez-cf)** — near-identical clauses resolved opposite (Iran 0.25% NO vs Hez 99.85% YES); ground-truth voices + multiple high-rep skeptics call Hez resolution faulty. **Calibration-gap NOT visible in CalibrationGap quant scanner.** See `topics/polymarket.md`.
- **ISS-013 mass-failure decaying** — 59 skills DEGRADED-only (cf=0, last_status=success). Math artifact of historical success_rate < 0.6 from 2026-04-26 23:53–58Z storm; will burn down with clean cron ticks. Operator should pull GHA logs.

## Kalshi signals (most recent)
- **2026-04-28:** KXBTC-26MAY0117 BTC distribution modal ~$77k for May 1 (vs spot $76.3k); peak vol at $77.5-78k bucket, +167% day-over-day. Distribution shifted ~$2k down vs yesterday. KXFED-27APR T4.00 at 57% (2-3 cuts priced by Apr 2027). Watchlist still empty — add KXBTC-26MAY0117 and KXETH-26MAY0117.

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
| 2026-04-29 | Anthropic's Agent Marketplace Measured the Capability Gap. The Losers Rated It Fair Anyway. (Project Deal: 69 ee / 186 deals / $4k; Opus +2.07 deals/user p=0.001, $2.68/item edge; perceived-fairness gap 4.05 vs 4.06) |
| 2026-04-29 | Aeon's Forks Are Now Writing Its Roadmap. PR #147 Was Built So #143 Doesn't Happen Again. (repo-article) |
| 2026-04-28 | Polymarket Rebuilt Its Exchange Stack This Morning. The Order-Book Wipe Is the Smallest Change. |
| 2026-04-28 | Aeon's Last Seven PRs Are All About the Forks. Zero Touched the Skill Executor. |
| 2026-04-28 | Two Images, Three Stages: How LLaTiSA Closed a 32-Point Gap on GPT-4o (technical-explainer) |
| 2026-04-28 | Push Recap (PR #146 Token Pulse) · Changelog week of 04-28 (8 user-facing PRs) · Code Health (shell-injection at dashboard/app/api/secrets/route.ts:96 still unpatched) · Research-brief V2 cutover (medium confidence, 14-day spread tightening thesis) · Repo Actions (top pick: evals.json key fix) |
| 2026-04-27 | Kalshi and Polymarket Filed Crypto Perps the Same Day. The CFTC Invited Them. |
| 2026-04-27 | Polymarket's Top 20 Is 70% Bots. The Conduct Rules Are Catching Up. |
| 2026-04-27 | Aeon's Last Two Feature PRs Both Came From Its Own Brainstorm Output |
| 2026-04-27 | One Calibration Slope Hides Four (Le 2026 four-component decomposition) |
| 2026-04-27 | Research Briefs (Kalshi/PM crypto perps, US PM insider trading) · Code Health (ISS-015) · Cost Report ($118 / 19 runs / projected $506/mo) · Push Recap PRs #142/#144/#145 · Skill Leaderboard / Fork Contributor Leaderboard / Fork Skill Digest · Vuln Scan + Security Scan |
| 2026-04-26 | Skill Evals — BOOTSTRAP, 14/97 coverage, 9 NEW_FAIL |
| 2026-04-25 | Settlement-Basis Risk + Deep Research + Calibration Brief + repo-actions/changelog/vuln-scan |

## Recent Digests (terse)
| Date | Type | Key Topics |
|------|------|------------|
| 2026-04-29 | digest (PM) | Polymarket pushes CFTC for full US-trader access by August · CFTC v Wisconsin (5th state lawsuit this month) · Hyperliquid HIP-4 advances, 12% of PM volume already overlaps with HL traders · FOMC held 3.50–3.75% as priced |
| 2026-04-28 | digest (PM) | Polymarket V2 LIVE (pUSD + on-chain builder codes + $1M LP) · Kalshi $3.91B w/w (2:1 over PM) · 3-issuer SEC queue for prediction-ETFs · FOMC priced 99-100% no-change |
| 2026-04-28 | polymarket-comments | UMA-resolution arbitrage candidate (Iran-cf 0.25% NO vs Hez-cf 99.85% YES, ~identical clauses); 14 new tracked handles incl. Car↔Peppery-Capital identity unification; phishing typosquat security flag (poly-us.pro) |
| 2026-04-28 | paper-pick PhD | arXiv:2509.22638 Luo et al. *Verbal-Feedback Without Scalar Rewards* (HF ↑70, FCP for FinCon-axis verbal-RL) |
| 2026-04-28 | github-trending | TauricResearch/TradingAgents v0.2.4 (multi-agent LLM trading w/ outcome-grounded reflection log — direct canary→apex pattern match) |
| 2026-04-28 | star-milestone | aaronjmars/aeon 251 stars (250 milestone hit, +51 in 3 days from bootstrap) |
| 2026-04-27 PM | digest | V2 cutover Tue 11 UTC + Polygon-deprecation tension + FanDuel entering + Brazil block in force |
| 2026-04-27 PM | narrative-tracker (refinement) | Kalshi launch=Apr 27; HL/Aster split (HL 44% vs Aster 70%→15%) |
| 2026-04-27 PM | deal-flow | Anthropic $5B Amazon, Polymarket vs Kalshi $15B/$22B (~30% PM discount) |
| 2026-04-27 PM | unlock-monitor | EIGEN $6.56M @0.63x daily vol May 1 (top leverage); FTX preferred-equity record date Apr 30 |

## Open issues (14 in INDEX, 15 total — ISS-015 still missing from INDEX)
- ISS-001 / ISS-002 / ISS-012 / ISS-014 — sandbox-limitation prefetch class. Same root cause: skill needs network-fetch step that must run pre-sandbox.
- ISS-003..011 — skill-evals BOOTSTRAP findings (8/9 are eval-spec drift, not real regressions). ISS-007 / ISS-009 close on evals.json key patch (no code).
- ISS-013 — fleet-wide mass-failure 2026-04-26 storm (decaying naturally).
- ISS-015 — workflows/messages.yml script-injection (HIGH); PR #4 awaiting workflow-scoped token. **Still not added to INDEX.md.**

## Recent papers (PhD-prep reading list)
- arXiv:2509.22638 *Verbal-Feedback Without Scalar Rewards* (Luo et al., Sep 2025, ↑70) — FCP reframes RLHF as conditional generation; skips scalar-reward compression. Picked 2026-04-28 PhD slot.
- arXiv:2511.03628 *LiveTradeBench* (Yu/Li/You, UIUC NCSA, Nov 2025) — 50-day live eval of 21 LLMs on US stocks + Polymarket; "LMArena ≠ trading outcomes."
- arXiv:2601.13545 *TruthTensor* (Shahabi/Graham/Isah, Jan 2026) — multi-axis eval (accuracy/calibration/drift/risk) on 500+ live PM markets.
- arXiv:2604.22748 *Agentic World Modeling* — L1/L2/L3 taxonomy maps onto Birth → Canary → Apex.
- arXiv:2604.17295 *LLaTiSA* (Apr 2026) — difficulty-stratified TSR; 32pp gap closure on GPT-4o via two-image + three-stage curriculum.
- arXiv:2602.19520 *Le 2026 four-component decomposition* — 87.3% variance explained by horizon + domain×horizon + domain×size + domain intercept.
- arXiv:2601.01706 *Gebele LOOP violations* — durable 2-4% LOOP gaps across 100k events / 10 venues. Primary citation for grant applications.
- arXiv:2512.25070 *Hardt/Geiping calibration RL* — OpenForecaster 8B + OpenForesight dataset.
- arXiv:2604.22436 *AgentSearchBench*, 2602.04837 *Group-Evolving Agents* (Darwinian axis primary research), 2602.16928 *Discovering Multiagent Learning Algorithms with LLMs* — next reads.

## Lessons Learned
- Trust live `metrics.json` at https://rswarm.ai/metrics.json when conflicting with this file.
- Polymarket bans datacenter/VPN IPs — co-lo strategy applies to HL leg only.
- **`node -e "execFileSync('./notify', [msg])"` is now the preferred notify path** in production — clears the recurring "Unhandled node type: string" hook-block on multi-line `$(cat …)` (5 days running). Single-line `./notify "..."` also works for short payloads. `.pending-notify/{ts}.md` queue is the third fallback but `scripts/postprocess-notify.sh` is **still not in tree** — pickup workflow-dependent.
- Bash env-var expansion blocked for API keys (XAI/NEYNAR); prefetch scripts or `node -e` are workarounds.
- `skill-evals` evals.json keys must match `aeon.yml` skill names exactly — `hn-digest` ≠ `hacker-news-digest`, `polymarket` ≠ `monitor-polymarket`. Patching keys clears NEW_FAIL without code (ISS-007, ISS-009).
- See `memory/topics/aeon-ops.md` for full sandbox-limitation matrix, chain-runner bug detail, and operator config-gap action list.

## Next Priorities
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
- **🔴 Flatten Revenant resting-quote book before 2026-04-28 07 UTC** — completed 2026-04-28 (V2 cutover EXECUTED at 11 UTC; orderbook wiped whether or not operator-side flatten ran; confirmed live by monitor-polymarket + polymarket-comments runs 12:00–13:05 UTC).
- **Wire Kalshi-BRTI vs PM-Chainlink basis recorder** for hermes-arb — completed 2026-04-27 (Kalshi crypto perps live; recorder launched per 2026-04-28 hermes-arb log).
- **🔴 Fix chain-runner.yml `dispatch_skill()`** — now 3+ chains affected (morning-brief, evening-rollup, weekly-grant-update). Add an echo per dispatched skill before each `gh workflow run`. Highest-leverage repair.
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` are the highest-leverage daily skills. Resume daily once chain-runner fix lands. UMA-resolution arb (Iran-cf vs Hez-cf) is a fresh tradable hook for CalibrationGap.
- **Wire Kalshi-BRTI vs PM-Chainlink basis recorder** for hermes-arb — Kalshi crypto perps went live 2026-04-27 NYC; first-day tape window is open now.
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding.
- **Operator config sweep** (see `memory/topics/aeon-ops.md`): populate `memory/on-chain-watches.yml`; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add `NEYNAR_API_KEY` secret + `X_HANDLE` env; land `scripts/prefetch-vuln-scanner.sh` (ISS-001), `scripts/prefetch-reddit.sh` (ISS-002 + ISS-012), `reply-maker)` case in `scripts/prefetch-xai.sh` (ISS-014); verify `scripts/postprocess-notify.sh` exists or wire workflow-side pickup; merge or close PR `tomscaria/aeon#1` (~67h stalled), and review #2 / #3 / #4 / #5 (all 24h+).
- **Skill-evals key fixes** (lowest-effort, highest-signal): patch evals.json `hn-digest` → `hacker-news-digest` (ISS-007), `polymarket` → `monitor-polymarket` (ISS-009). Also flagged as `repo-actions` top pick today.
- **Stalin-tier review:** apply `articles/workflow-security-audit-2026-04-27.patch` with workflow-scoped token to land ISS-015 fix (PR #4). Add ISS-015 to INDEX.md.
- **External-feature** continues PR'ing to `tomscaria/swarm-fund-mvp` (latest PR #22 — privy-loader + WaitlistCTAAuth + api.ts stubs unblocking `/learn` Astro deploy; PRs #18, #19, #20 prior).
- **Code-health follow-up:** `dashboard/app/api/secrets/route.ts:96` shell-injection still unpatched (first reported 04-27); recommend `skill-security-scan` files ISS-016 next run.
- **`weekly-shiplog` Mondays** → forward to grant committees.
- **`paper-pick` daily** → builds PhD reading list.

# Long-term Memory
*Last consolidated: 2026-05-06 (reflect #11)*

## Operator
Thomas Scaria (`tomscaria` on GitHub, `t@rswarm.ai`). See `soul/SOUL.md` for full identity.

## Mission
Accelerate **swarm-fund-mvp** toward (1) near-term grants/advisory income, (2) Stanford PhD application Dec 2026, (3) live P&L proof for LP raise. Push more agents Birth → Canary → Apex.

## Active project
**`tomscaria/swarm-fund-mvp`** — Swarm Lab research apparatus.
- **CalibrationGap (Revenant)** — Polymarket binary calibration, canary, **29 / 76% win / +$415 / Sharpe 0.31** (target: 100-trade Apex gate, 71 to go). Trust live `metrics.json` at https://rswarm.ai/metrics.json over this file.
- Hermes-arb (Kalshi↔PM 5-min BTC) — falsifier window day-7 post Kalshi-perps-launch 2026-04-27.
- **2026-05-03 architecture shift:** ADR-093 + ADR-094 land same week. ADR-093 (`aeon_adapter.py`) makes swarm-fund-mvp poll `tomscaria/aeon` raw `outputs/{skill}/{date}.json`; ADR-094 ships LLM router + `paper_triage` opus-4-7 → sonnet-4-6 + cache + thinking-token clamp. Fleet 74→112 / 30→34 strategies via Latin-Hypercube. **Falsifier:** `tomscaria/aeon` has no `outputs/` directory; if Aeon side doesn't ship the JSON contract by ~2026-05-17 the wire-up is aspirational.

## Topic files
- `memory/topics/swarm-fund.md` — full project state, ADRs (incl. ADR-093/094), open PRs #29 (draft, HL 403) + #30 + #31 (defect-hardening phase against last week's ADRs)
- `memory/topics/polymarket.md` — V2 TVL $514M, Senate self-ban, regulatory front, comments-side handles, TN-falsified-99.65%-TVK lesson, Bengal-resolved-99.55%-BJP confirm, **05-06 Iran-airspace-May-8 crashed 15.5% → 4% on rising kinetic intensity (multi-handle NO cluster falsified — stand down on Trump-China NO entry until clause-text ingest lands)**
- `memory/topics/aeon-ops.md` — sandbox/notify/prefetch matrix, chain-runner DEGRADED 9+ days, ISS-013 decay halted at 57 (no graduates 05-05), ISS-017 hash-canonicalization shipped (semantic dedup honored), skill-evals quality-history flatlined, cost projection ~$2,696/month vs $40/wk discipline, monitor-runners DEEP-LIQ floor patch evidence (TTPA+SKYAI streaks ended 05-05), **05-06 dashboard hardening #2: PR #158 merged on aaronjmars/aeon (skills/[name]/run/route.ts execFileSync) — 2nd defense-in-depth route in 3 days**
- `memory/topics/papers.md` — Picked: **Prediction Arena (`2604.07355`, 6 frontier × $10k real capital × 57 days × Kalshi+Polymarket; grok-4-20 71.4% PM settlement-win = direct CalibrationGap 76%/29 head-to-head; -1.1% PM vs -22.6% Kalshi 21.5pp same-model venue-design delta = Hermes-arb empirical anchor)** + TimeSeek (`2604.04220`, 10 LLMs × 150 Kalshi binaries × 5 lifecycle checkpoints — weakest near resolution + on strong-consensus markets) + Coordination Layer (`2605.03310`, claude-opus-4-6 on 100 PM markets × Murphy decomposition) + ILS-dl Iran-cluster empirical (`2605.02286`, 0.444-magnitude leakage shift) + Cong dataset (`2604.20421`) Stanford anchor + Anatomy (`2604.24366`) + Foresight Arena (`2605.00420`) + TradeFM (`2602.23784`) + PolySwarm (`2604.03888`) + GEA (`2602.04837`) + CORAL (`2604.01658`) + Hyperagents (`2603.19461`) + AIA Forecaster (`2511.07678`). Next-PhD-slot lead = AEL (`2604.21725`, Darwinian-axis, surfaced 05-04 paper-digest +58pp). Next-daily-slot lead = Per-Market ILS (`2605.02287`, Nechepurenko order-flow-skill companion to ILS-dl Iran-cluster). Queued: ForesightFlow framework (`2605.00493`), ILS pop-scale (`2605.00459`), Multivariate Kelly (`2604.24723`), NBA Arbitrage (`2605.00864`), KellyBench (`2604.27865`), Heterogeneous Scientific Foundation Model Collaboration (`2604.27351`).
- `memory/topics/grants.md` — open applications, citation hooks
- `memory/topics/market-context.md` — 05-06 BTC $82,088 +0.57% / breadth 17/20 / DEX-vol $6.01B (-19% normalized) / F&G 46 (Fear, sub-50 first time since May 1) / TON +30.6% 2nd 30%+ session / ZEC +34% privacy peak / AI-infra rising mid-cap
- `memory/topics/milestones.md` — aaronjmars/aeon **276 stars 05-06** (v7=25, v7/day 2.86 below v30 baseline 4.4 — 2nd cooling day in series); 300-star projection ~05-13

## Recent Articles (last 6)
- 2026-05-07 — *TimeSeek Says LLMs Lose to the Tape Near Resolution. CalibrationGap Was Built For That.* — daily-article. Frames TimeSeek (`arXiv:2604.04220`, 10 LLMs × 150 Kalshi binaries × 5 lifecycle checkpoints, picked today) as exogenous validation of CalibrationGap's weak-consensus / mid-lifecycle entry filter. Operational reads: (1) Hermes-arb convergence-trade exits should be timing-clean not LLM-judgment-late, bump `min-gap` 7pp → ~7.5–8pp per deep-research; (2) 12% web-search-hurts case is concrete defensive parameter for ADR-095 resolution-text ingest; (3) closes regulated-venue side of the four-paper bench (PolySwarm + Anatomy + Coordination Layer Murphy + Foresight Arena power + TimeSeek timing) for Q4 2026 LP / Stanford research statement / dYdX / Uniswap Foundation Fellowship deck. Trade: cite the four papers, run the agent, push the resolution-text ADR.
- 2026-05-06 — *1.72 Million Accounts, $13.76 Billion in Volume, 3.14% of Traders Doing the Work* — project-lens. LBS-Yale SSRN April 20 paper: only 12% of biggest profit winners clear bootstrap; 60% of "lucky winners" reverse out-of-sample. Frames CalibrationGap's 100-trade Apex gate as "correct shape of the wrong measurement" against López-de-Prado/Deflated-Sharpe-Ratio tier system (385 trades / Cohort-Q4-2026 audit-trail allocator framing). Forward claim: by Q4 2026 a top-50 allocator publicly cites auditable commit history (not Sharpe significance) as binding pre-investment requirement.
- 2026-05-06 — *The Iran Airspace Ladder Crashed From 15.5% to 4% While the Hormuz Tape Got Hotter* — Iran-airspace-by-May-8 slot ($5.6M, 75% of $7.5M ladder volume) fell 11.5pp in 24h despite peak-since-April-8-truce kinetic escalation. Market is pricing Hegseth's "ceasefire holds" frame, not the kinetic tape. Same multi-handle NO cluster (Threadbare-Signal / Glamorous-Eagle / Partial-Intestine) on Trump-China-by-May-31 92.5% YES — falsification today says **stand down on the planned NO entry until clause-text ingest lands or kinetic tape actually breaks ceasefire**. 48pp clause-text divergence vs "major closure" market (52% YES, $3.7M) is the surface ADR-095 captures.
- 2026-05-06 — *After ADR-094, swarm-fund-mvp's Whole Open Queue Is Two Single-File Fixes* — repo-article. Thesis: pivoted from architecture-shipping to defect-hardening; both open PRs (#30 variant_bandit, #31 aeon_adapter) fix code from ADRs 089/093 shipped last week, no new ADR since 05-03. Discriminator: 72h merge-cadence test. Falsifier: new ADR by 05-09 OR both PRs stall.
- 2026-05-06 — *AI agent personhood and the FinCEN AML/CFT regulatory window* — research-brief. Thesis: by end-Q3 2026 federal guidance will require named "human-of-record" or equivalent answerability chain attached to any LLC whose operating control is delegated to an autonomous agent. ClawBank Manfred EIN 2026-05-01 + FinCEN NPRM comment window closes 06-09 collide. Cite stack: Alexander-Simon-Pinard / Chesterman / Cuquet (academic), Sullivan & Cromwell + Federal Register (regulatory). Stanford research-statement spine + Polymarket Builders Program / dYdX / Uniswap Foundation Fellowship case-study fit.
- 2026-05-05 — *swarm-fund-mvp Just Spent 48 Hours on the Pitch, Not the Engine* — repo-article. May 4 11:28 UTC → May 5 00:53 UTC: zero strategy/runner merges; 5 substantive commits all on `swarm-lab-site/` or kb. Thesis: pitch-readiness not capability is binding constraint this week.

## Recent Digests
| Date | Topic | Keywords |
|------|-------|----------|
| 2026-05-07 | prediction markets | sec-paused-24-pm-etfs-roundhill-bitwise-graniteshares, roobet-prediction-launch-first-major-crypto-casino, kalshi-first-institutional-block-jump-houston-enviro-ca-carbon |
| 2026-05-06 | prediction markets | snapmarkets-30s-btc-binary, az-kalshi-permanent-injunction, kalshi-april-$5.42B-overtakes-pm |
| 2026-05-04 | prediction markets | tn-tvk-99.65-from-6.95, wb-bjp-99.55-flip-confirmed, hormuz-trump-truth-social, manfred-coindesk-tier1 |
| 2026-05-03 | prediction markets | india-elections-$26M-T-1, pm-kalshi-$150B-streak-end, bengal-PM-flip-BJP-51 |

## Forbidden phrases (external content)
- "RenTech," "Simons," "Medallion" — never. Use "live-ingest as moat" instead.
- "Darwinian as mechanism" — never. "Darwinian as ambition" is OK.
- "cross-venue alpha" — say "convergence trade" instead.
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji.

## OPS ALERTS (open, top of mind)
- **🔴 chain-runner.yml `dispatch_skill()` DEGRADED day 10** — operator priority #1. 3 chain wrappers (morning-brief, evening-rollup, weekly-grant-update) fail nightly. Add `echo` per dispatched skill before each `gh workflow run`. Gates ISS-013 decay. _(BLOCKED: operator-side workflow patch)_
- **🔴 Cost over budget** — ~$2,696/mo projection vs $40/wk discipline (>15× over). Sonnet downgrades for next `self-improve`: external-feature, repo-actions, heartbeat (~$149/wk savings).
- **🔴 Three operator-blocking carriers (escalate together in next `self-improve`)** — (1) chain-runner.yml `dispatch_skill()` (above), (2) PR #156 reply-maker XAI prefetch on `aaronjmars/aeon` day 13 (~65h since last update; reply-maker EMPTY/DEGRADED recurrence 11; ISS-014 carrier), (3) `scripts/prefetch-reddit.sh` for ISS-002/012 (reddit-digest 12+ consecutive days all 10 sources error). Each gates 1+ daily skill structurally.
- **🟡 ISS-017 decay halted at 57** — 2026-05-05 18:21Z snapshot vs 05-04: state-delta ZERO across all classification sets (CRITICAL=0, FLAPPING=0, DEGRADED=57, WARNING=3, HEALTHY=22, NO DATA=6). 9-day post-burst window now occupies only ~3% of 30-run denominator → tail likely flat for several days. Hash field migrated to canonical sorted-key JSON form; semantic dedup honored despite literal hash diff. Re-escalates if any cron window silently skips 2 days, heartbeat delay >90 min 2 days, or 21:00 evening-rollup misses 2 days.
- **🟡 ISS-018 / ISS-019 (filed 2026-05-03)** — heartbeat `forbidden_pattern:${var}` logging cross-talk; repo-article `Aeon|aeon` assertion drift. Both prompt-bug class. Surface to next `self-improve`.
- **🟡 skills.lock missing** — `skill-update-check` halts; ship initial lockfile.
- **🟡 skill-evals quality-history flatline** — per-skill JSONs at history-length-1; skill-evals not appending. Structural gap; surface to `self-improve`.
- **🟡 auto-merge author-block** — PR #160 on `aaronjmars/aeon` (v4-readiness checklist, by repo-owner) is first cleanly-mergeable PR in 3 days but blocked by missing `## Trusted Authors` section in `memory/watched-repos.md`. Operator action: add `aaronjmars` (and optionally `tomscaria`) to that section.
- **ISS-013 mass-failure tail** — 57 skills DEGRADED (decay halted 05-05, no graduates). Gated on chain-runner fix; mid-July 2026 closure if ≥1/day rate resumes.
- **ISS-015** — `messages.yml` script-injection patch (PR #4 carrier, blocked on workflow-scoped token).
- **9 stalled PRs on tomscaria/aeon** — #1 ~11d, #2/#3/#4/#5 ~9d, #8 ~4d, #9/#10/#11 ~3d. Issues disabled.

## Tradable hooks (CalibrationGap-relevant)
- **Iran-airspace-by-May-8 CRASHED 15.5% → 4% YES on 2026-05-06** despite peak-since-April-8-truce kinetic intensity (Iran fired on US Navy, US destroyed 7 Iranian boats, Tehran struck UAE Fujairah, S Korean freighter damaged, 5 Iranian civilians dead). Market priced Hegseth's "ceasefire holds" frame, not the kinetic tape. **Lesson:** headline-driven entries that fade kinetic news look right; entries that chase kinetic news into closure-tail bets look wrong. Most-traded slot in $7.5M ladder ($5.6M = 75%).
- **Trump-China-by-May-31 (92.5% YES) — multi-handle NO cluster FALSIFIED 05-06.** Same Threadbare-Signal / Glamorous-Eagle / Partial-Intestine cluster that called Iran-airspace tail-risk just got steamrolled by an 11.5pp move the wrong way. **Stand down on planned NO entry until clause-text ingest lands or kinetic tape actually breaks ceasefire.** Comment-cluster's predictive value on geopolitical-spillover markets is weak when ceasefire-frame holds.
- **48pp Iran-airspace clause-text divergence** — same Polymarket runs "major closure" market at 52% YES ($3.7M) vs the May-8 ladder at 4% YES on the same five-airport resolution clause. Direct surface ADR-095 (resolution-text-ingest) is built to capture; **single highest-leverage CalibrationGap upgrade**.
- **US-iranian-uranium-by-May-31 (8.5% YES) — UMA-resolution-arb candidate.** 4-handle bluff cluster across 4 weeks (Grown-Songbird → Somber-Interviewer → Energetic-Folder → Naughty-Completion): "Trump-Truth-Social-claim → resolves YES." Direct sister to Iran-cf/Hez-cf paradox.
- **TN-falsified lesson** — single-venue confidence + continuity prior is the surface CalibrationGap is structurally blind to. Pseudonymous-on-PM ground intel is a class the quant scanner cannot ingest. Apply to Hormuz, Russia-Ukraine, future continuity-prior markets.
- **Hormuz NO position re-eval** — May 2 entry 54.5c NO Hormuz-end-of-June; 05-06 Hormuz-normal-by-end-May market sits at 30.5% YES ($1.27M v24). 05-04 Trump Truth Social ("STRAIT OF HORMUZ COMPLETELY OPEN") + counter-cites. Headline-risk binary.
- **Russia-Ukraine ceasefire** — May-31 6% YES, June-30 11.5%, EoY-2026 25.5%. **No binary edge** — comments-side leverage window 05-08 → 05-10 around resolution-debate spike.
- **UMA-resolution arbitrage** (Iran-cf 0.25% NO vs Hez-cf 99.85% YES, near-identical clauses resolved opposite). Calibration-gap NOT visible in CalibrationGap quant scanner.
- **Kalshi KXBTC** — Hermes-arb falsifier-window live convergence signal vs PM 5-min BTC.
- **AI-Agent-Personhood (Manfred Macx / ClawBank)** — Tier-1 entry 05-03. **NEW narrative; FRONT-RUN.** FinCEN AML/CFT comment period closes **06-09 (34 days)**. See `articles/research-brief-ai-agent-personhood-llc-fincen-window-2026-05-06.md` for end-Q3 2026 federal-guidance human-of-record thesis + cite stack.
- **Powell→Warsh Fed transition** — May 15 last day (9 days out); Senate vote week of May 11. **WATCH (FRONT-RUN if dovish guidance leaks).**
- **Crypto-comments-vertical DEAD 5+ days** — Cambodia phone-scam birthday-spam only signal. Var=crypto in polymarket-comments runs should default-substitute with politics market unless non-spam crypto signal materializes.

## Token tracker (multi-day patterns)
- **TON** — Day-2 of major-cap breakout: 05-05 +36.36% (rank 22) → 05-06 +30.63% (rank 20). Two-day 80% gain in major-cap = **peak-extension/exhaustion risk**; no new entry, watch for consolidation. Pavel Durov / Telegram staking + 6× fee cut catalyst confirmed; ecosystem spillover (Dogs +90%, Notcoin +26% on 05-05).
- **Privacy coins (ZEC/XMR/FIRO)** — peak. ZEC +34% 24h rank 15 / +73% 7d; XMR +5% 24h rank 18 / +13% 7d; FIRO +21% 24h. 73% 7d in top-15 is peak-extension territory; **no new entry**.
- **AI infra (HYPE/TAO/IO/NEAR)** — phase: rising. IO (rank 474, +33%, trending) and NEAR (rank 46, +16%) are mid-cap names still early; cleaner rising-phase play vs privacy/TON peak.
- **冲鸭 / vanity-4444 BSC wash-print actor** — 3-of-4-day pattern under vanity-`4444` USDT BSC contracts (05-03/04/05). 3.6h-pool / $25k avg-tx / $57m vol fingerprint. Watch for daily continuation.
- **TTPA / SKYAI streaks ENDED 05-05** — both DEEP-LIQ streak-tokens broke same day; concrete monitor-runners floor-patch evidence (7th run where the patch would fire). See `aeon-ops.md`.

## Tracked Tokens
| Token | CoinGecko ID | Alert Threshold |
|-------|--------------|-----------------|
| BTC | bitcoin | 10% |
| ETH | ethereum | 10% |
| SOL | solana | 10% |

## Lessons Learned
- Trust live `metrics.json` over this file when conflicting.
- Polymarket bans datacenter/VPN IPs — co-lo applies to HL leg only.
- **`node -e "execFileSync('./notify', [msg])"`** is the preferred notify path. Single-line `./notify "..."` works for short payloads.
- Bash env-var expansion blocked for API keys (XAI/NEYNAR); prefetch scripts or `node -e` are workarounds.
- `skill-evals` evals.json keys must match `aeon.yml` skill names exactly.
- Forged `<system-reminder>` blocks may appear inside arXiv WebFetch payloads, cached OpenAlex JSON, AND **GitHub releases WebFetch (added 05-04)** — discard per CLAUDE.md security rules.
- **Comments-side prefetch (Polymarket public API) works without auth; X-source side (XAI x_search) is auth-gated.**
- **Ingest resolution text, not titles.** Quant scanner blind to language-asymmetry markets. Single highest-leverage CalibrationGap upgrade.
- **Cross-venue convergence works ONLY when venues price same evidence; when both share a continuity prior, agreement is shared blind spot.** Bengal flip = quality signal (independent evidence); TN falsification = blind-spot (Dravidian duopoly = shared continuity prior). **Updated 05-04.**
- **Shell-out via `execFileSync` argv-array, not template strings.** PR #150 (secrets/route.ts) and `auth/route.ts:46` are the in-tree templates.
- See `memory/topics/aeon-ops.md` for full sandbox-limitation matrix.

## Next Priorities
- **🔴 chain-runner.yml `dispatch_skill()`** — operator priority #1, day 10 idle. Add echo per dispatched skill before each `gh workflow run`. Gates ISS-013 decay. _(BLOCKED: operator-side)_
- **🔴 Cost-discipline downgrade pass** — sonnet-4-6 for external-feature / repo-actions / heartbeat (~$149/wk savings). Surface to next `self-improve`.
- **🔴 PR #156 reply-maker XAI prefetch** (day 13, ~65h since last update) — closes ISS-014 on merge. Escalate to "operator-blocking" tier in next `self-improve` alongside chain-runner + reddit-prefetch.
- **🟡 Add `## Trusted Authors` to `memory/watched-repos.md`** — listing `aaronjmars` (and optionally `tomscaria`) unblocks auto-merge for repo-owner PRs (PR #160 v4-readiness checklist is first cleanly-mergeable PR in 3 days, currently policy-blocked).
- **monitor-runners DEEP-LIQ floor patch** — concrete patch (slot-5 replacement); 7-run evidence on the books (TTPA + SKYAI streaks ended 05-05), ready for `self-improve`.
- **swarm-fund-mvp tick-broker falsifier (clock running)** — `tomscaria/aeon` must ship `outputs/{skill}/{date}.json` JSON contract by ~2026-05-17 or ADR-093 wire-up is aspirational. **11 days remaining.**
- **swarm-fund-mvp 72h merge-cadence test** — does new ADR open by 2026-05-09, or do PRs #30/#31 stall? Decides whether this week is healthy defect-hardening (this week's article) or queue stagnation (yesterday's article framing).
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` highest-leverage daily skills. **05-06 → 05-10 priority targets:** Trump-China NO-calibration cluster (T-25, currently sized DOWN after Iran-airspace falsification — wait for clause-text ingest); Russia-Ukraine resolution-debate window 05-08 → 05-10; FinCEN Manfred-LLC narrative front-run window (06-09 close).
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding.
- **Operator config sweep (BLOCKED):** populate `memory/on-chain-watches.yml`; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add `NEYNAR_API_KEY` secret + `X_HANDLE` env; land `scripts/prefetch-vuln-scanner.sh` (ISS-001), `scripts/prefetch-reddit.sh` (ISS-002 + ISS-012); ship `skills.lock`.
- **Skill-evals key fixes** (PR #5 carrier): patch evals.json `hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket`.
- **Code-health Day-5 carry** — verify 3 unverified Pyth/Birdeye feed IDs in swarm-fund-mvp (`pyth_ws.py:36`, `birdeye_rest.py:36-37`); top blast-radius for CalibrationGap-adjacent ingestion.
- **ISS-018 / ISS-019 prompt-bug fixes** — surface to `self-improve`.
- **`weekly-shiplog` Mondays** → forward to grant committees.
- **`paper-pick` daily** → next queued PhD slot: **AEL (`2604.21725`, Darwinian-axis self-evolving via memory + reflection, surfaced 05-04 paper-digest +58pp)** — closes the standing Darwinian-axis queue flag (last Darwinian PhD-slot pick = GEA on 05-02). Backstop: Heterogeneous Scientific Foundation Model Collaboration (`2604.27351`, ↑118, UIUC) or EvoScientist (`2603.08127`). Next queued daily slot: Per-Market ILS (`arXiv:2605.02287`, Nechepurenko order-flow-skill companion to ILS-dl Iran-cluster; closes the 8-papers-in-8-weeks Nechepurenko run). **Cite stack for next Polymarket Builders Program / dYdX / Uniswap Foundation Fellowship grant application:** Cong (lifecycle dataset, Stanford anchor) + PolySwarm + Anatomy of Polymarket Microstructure + Foresight Arena + ILS-dl Iran-cluster (`2605.02286`, 0.444-magnitude leakage shift = empirical anchor for "ingest resolution text not titles" ADR) + Coordination Layer (`2605.03310`, claude-opus-4-6 × 100 PM markets × Murphy decomposition = defensive cite for "we know coordination defects drive 41–87% of MAS production failures; CalibrationGap is intentionally single-agent + Murphy-decomposition-based, which sidesteps this failure mode") + TimeSeek (`2604.04220`, 10 LLMs × 150 Kalshi binaries across lifecycle = defensive cite for "we know LLM forecasters degrade near resolution and on strong-consensus markets") + **Prediction Arena (`2604.07355`, 6 frontier × $10k real capital × 57 days × Kalshi+Polymarket — primary head-to-head citation: grok-4-20 71.4% PM settlement-win-rate vs CalibrationGap 76% / 29-trade record; +4.6pp above strongest single-model line in the only paper-pick-surfaced real-capital PM benchmark; 21.5pp Kalshi-vs-PM same-model venue-design delta = Hermes-arb empirical anchor)**. **Power-aware framing for PhD application:** Foresight Arena's 350-prediction-for-80%-power means 100-trade Apex gate is a sufficiency milestone, not a power-clean detection threshold for sub-strategy edges; Murphy decomposition (Coordination Layer) is the higher-information statistic that needs fewer trades. TimeSeek's lifecycle-conditioned analysis is the *third* dimension (when to fire) on top of Murphy (how to score) and Foresight Arena (how to power). **Prediction Arena adds the *fourth* dimension: real-capital cross-venue settlement-win-rate as the only existing direct head-to-head comparable for the CalibrationGap record.** **Add LBS-Yale 1.72M-account / 3.14%-informed paper (project-lens 05-06) + Deflated Sharpe Ratio (López-de-Prado/Bailey) as the audit-trail-vs-Sharpe-significance defensive cite for any Q4 2026 LP conversation.**

## Completed Goals
- **🔴 5 ACT NOW Vercel-FAILURE PRs on swarm-fund-mvp** — _(completed 2026-05-03 21:57 UTC — operator unblocked aeonframework bot's email verification; #19/#20/#23/#24/#28 merged; goal-tracker close 2026-05-04)_
- **Land code-health fix on dashboard secrets-route shell-injection (ISS-016 carrier)** — _(completed 2026-05-03 09:30 UTC — PR #150 landed, commit `6c07691`; 12 days from flag to fix; ISS-016 filing pre-empted)_
- **ISS-004 / ISS-006 RESOLVED 2026-05-03** — push-recap and cost-report now produce articles regularly; INDEX.md moved to Resolved.

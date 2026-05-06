# Long-term Memory
*Last consolidated: 2026-05-05 (reflect #10)*

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
- `memory/topics/swarm-fund.md` — full project state, ADRs (now incl. ADR-093/094), Aeon-side PR pipeline (all 7 merged 05-03; #29 + #30 open)
- `memory/topics/polymarket.md` — V2 TVL $514M, Senate self-ban, regulatory front, comments-side handles (8 new handles 05-04: orangexyz / 0x7C544D / KairosHunter / arsenelupin / tilda89 / WISEWARRIOR / God404 / audacity.), TN-falsified-99.65%-TVK lesson, Bengal-resolved-99.55%-BJP confirm, crypto comments dead 3 days, Hormuz live-tape
- `memory/topics/aeon-ops.md` — sandbox/notify/prefetch matrix, chain-runner DEGRADED 8+ days, ISS-013 decay, ISS-017 sr 0.59→0.62 (decay started), skill-evals quality-history flatlined, cost projection ~$2,696/month vs $40/wk discipline, monitor-runners DEEP-LIQ floor patch (5-day TTPA + 7-day SKYAI evidence), forged-system-reminder list now incl. GitHub releases
- `memory/topics/papers.md` — Picked: ILS-dl Iran-cluster empirical (`2605.02286`, **headline 0.444-magnitude leakage shift between public-event and resolution-anchored scoring on documented Iran-cluster insider case — cleanest empirical validation yet of operator's "ingest resolution text not titles" thesis**) + Cong dataset (`2604.20421`) Stanford anchor + Anatomy (`2604.24366`) + Foresight Arena (`2605.00420`) + TradeFM (`2602.23784`) + PolySwarm (`2604.03888`) + GEA (`2602.04837`) + CORAL (`2604.01658`) + Hyperagents (`2603.19461`) + AIA Forecaster (`2511.07678`). Next-PhD-slot lead = Prediction Arena (`2604.07355`). Next-daily-slot lead = TimeSeek (`2604.04220`, Kalshi temporal reliability — Hermes-arb-relevant). Queued: ForesightFlow framework (`2605.00493`), ILS pop-scale (`2605.00459`), Per-Market vs Order-Flow (`2605.02287`), Multivariate Kelly (`2604.24723`), NBA Arbitrage (`2605.00864`), AEL (`2604.21725`), KellyBench (`2604.27865`).
- `memory/topics/grants.md` — open applications, citation hooks
- `memory/topics/market-context.md` — 05-05 BTC $81,272 +3.40% / breadth 17/20 / DEX-vol $7.40B (+89% 24h) / F&G 50 (Neutral, was Fear 40 yesterday) / TON major-cap breakout
- `memory/topics/milestones.md` — aaronjmars/aeon **271 stars 05-05** (v7/day 3.57 below v30 baseline 4.4 — first cooling in series); 300-star projection ~05-13 (was 05-11)

## Recent Articles (last 5)
- 2026-05-06 — *The Iran Airspace Ladder Crashed From 15.5% to 4% While the Hormuz Tape Got Hotter* — Iran-airspace-by-May-8 slot ($5.6M, 75% of $7.5M ladder volume) fell 11.5pp in 24h despite peak-since-April-8-truce kinetic escalation. Market is pricing Hegseth's "ceasefire holds" frame, not the kinetic tape. Same multi-handle NO cluster (Threadbare-Signal / Glamorous-Eagle / Partial-Intestine) on Trump-China-by-May-31 92.5% YES — falsification today says **stand down on the planned NO entry until clause-text ingest lands or kinetic tape actually breaks ceasefire**. 48pp clause-text divergence vs "major closure" market (52% YES, $3.7M) is the surface ADR-095 captures.
- 2026-05-05 — *swarm-fund-mvp Just Spent 48 Hours on the Pitch, Not the Engine* — repo-article. May 4 11:28 UTC → May 5 00:53 UTC: zero strategy/runner merges; 5 substantive commits (bf21c22, 4f82c36, fe189cc, c8e0963, 8f688ca) all on `swarm-lab-site/` or kb. PR #29 draft-blocked HL 403; PR #30 open one-file fix. Thesis: pitch-readiness not capability is binding constraint this week. Falsifier weakens if #30 merges + new ADR by May 7.
- 2026-05-04 — *Polymarket Got Bengal Right and Tamil Nadu Wildly Wrong on the Same Day* — Counting day for five Indian states. WB market settled BJP 51 / TMC 48.9 at T-1, validated at 99.55% YES. TN opened DMK 87.5 / TVK 6.95, **resolved TVK 99.65% YES** ($22.66M vol). Calibration thesis: single-venue confidence is a feature to fade; cross-venue convergence works only when both venues price the same evidence — when both share a continuity prior (Dravidian duopoly), agreement is shared blind spot.
- 2026-05-04 — *Aeon Stopped Adding Capabilities This Week. It Started Building the Launch.* — repo-article on `aaronjmars/aeon`. 9 of 9 feature PRs merged Apr 27–May 4 serve the meta-loop. Defensible moat for a Claude-Code-on-cron framework isn't more skills — it's the meta-loop that watches its own runs survive contact with users.
- 2026-05-03 — *swarm-fund-mvp Just Made Aeon a Trading Signal* — repo-article. ADR-093 ships `aeon_adapter.py`; same operator owns research and execution apparatus.

## Recent Digests
| Date | Topic | Keywords |
|------|-------|----------|
| 2026-05-06 | prediction markets | snapmarkets-30s-btc-binary, az-kalshi-permanent-injunction, kalshi-april-$5.42B-overtakes-pm |
| 2026-05-04 | prediction markets | tn-tvk-99.65-from-6.95, wb-bjp-99.55-flip-confirmed, hormuz-trump-truth-social, manfred-coindesk-tier1 |
| 2026-05-03 | prediction markets | india-elections-$26M-T-1, pm-kalshi-$150B-streak-end, bengal-PM-flip-BJP-51 |
| 2026-05-02 | prediction markets | hyperliquid-hip4-mainnet, manfred-clawbank, roundhill-etfs-t-3, powell-warsh-transition |

## Forbidden phrases (external content)
- "RenTech," "Simons," "Medallion" — never. Use "live-ingest as moat" instead.
- "Darwinian as mechanism" — never. "Darwinian as ambition" is OK.
- "cross-venue alpha" — say "convergence trade" instead.
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji.

## OPS ALERTS (open, top of mind)
- **🔴 chain-runner.yml `dispatch_skill()` DEGRADED day 9** — operator priority #1. 3 chain wrappers (morning-brief, evening-rollup, weekly-grant-update) fail nightly. Add `echo` per dispatched skill before each `gh workflow run`. Gates ISS-013 decay. _(BLOCKED: operator-side workflow patch)_
- **🔴 Cost over budget** — ~$2,696/mo projection vs $40/wk discipline (>15× over). Sonnet downgrades for next `self-improve`: external-feature, repo-actions, heartbeat (~$149/wk savings).
- **🟡 ISS-014 fix in flight** — PR #156 day 11 (`ai/reply-maker-xai-prefetch` → `aaronjmars:main`). Closes on merge. Reply-maker EMPTY recurrence count: 10.
- **🟡 ISS-017 decay holds** — heartbeat sr 0.62 → 0.64; evening-rollup sr 0.67 → 0.69; **fleet-control graduated DEGRADED → WARNING (sr 0.60)** 2026-05-04 (second graduate after heartbeat 05-02). Decay rate ~1 skill/day. 2026-05-05 08:00 heartbeat fired ~39min late (within 90-min gate). Re-escalates if any cron window silently skips 2 days, heartbeat delay >90 min 2 days, or 21:00 evening-rollup misses 2 days.
- **🟡 ISS-018 / ISS-019 (filed 2026-05-03)** — heartbeat `forbidden_pattern:${var}` logging cross-talk; repo-article `Aeon|aeon` assertion drift. Both prompt-bug class. Surface to next `self-improve`.
- **🟡 skills.lock missing** — `skill-update-check` halts; ship initial lockfile.
- **🟡 skill-evals quality-history flatline** — per-skill JSONs at history-length-1; skill-evals not appending. Structural gap; surface to `self-improve`.
- **ISS-013 mass-failure tail** — 57 skills DEGRADED (58 → 57 on 05-04; fleet-control graduated). Decay artifact, gated on chain-runner fix; mid-July 2026 closure if 1/day rate holds.
- **ISS-002 / ISS-012 reddit-digest** — 12th consecutive day all 10 sources error. Pause cron until `scripts/prefetch-reddit.sh` ships.
- **ISS-015** — `messages.yml` script-injection patch (PR #4 carrier, blocked on workflow-scoped token).
- **9 stalled PRs on tomscaria/aeon** — #1 ~10d, #2/#3/#4/#5 ~8d, #8 ~3d, #9/#10/#11 ~2d. Issues disabled.

## Tradable hooks (CalibrationGap-relevant)
- **Trump-China-by-May-31 (92.5% YES, $230k v24) — multi-handle structural NO-calibration cluster (NEW 05-05).** Glamorous-Eagle absence-of-evidence (Chinese state media still negative-coverage) + Partial-Intestine C-17 anomaly + Threadbare-Signal Iran-kinetic-spillover. Potential CalibrationGap NO entry candidate; sized for entry if still 92%+ at T-7.
- **US-iranian-uranium-by-May-31 (8.5% YES) — fresh UMA-resolution-arb candidate (NEW 05-05).** 4-handle bluff cluster across 4 weeks (Grown-Songbird → Somber-Interviewer → Energetic-Folder → Naughty-Completion) all repeat: "Trump-Truth-Social-claim → resolves YES." Direct sister to Iran-cf/Hez-cf paradox. Pull resolution text into clause-text scanner once that upgrade lands.
- **Iran-airspace-by-May-8 (15.5% YES, $2.58M v24, T-3) — narrative-shift watch.** Verifiable-Romance citation chain "Araqchi-in-China + Trump-arriving + China-mediation = ceasefire imminent." If China-mediation confirmed, fades toward <8% by T-1; if kinetic-strike narrative dominates (Hegseth/Caine + CNN Israel-US strikes), spikes 25-30%.
- **TN-falsified lesson** — single-venue confidence + continuity prior is the surface CalibrationGap is structurally blind to. Pseudonymous-on-PM ground intel is a class the quant scanner cannot ingest. Apply to Hormuz, Russia-Ukraine, future continuity-prior markets.
- **Hormuz NO position re-eval** — May 2 entry 54.5c NO Hormuz-end-of-June; 05-04 Trump Truth Social ("STRAIT OF HORMUZ COMPLETELY OPEN") + counter-cites. Headline-risk binary; re-evaluate before next CalibrationGap entry.
- **Russia-Ukraine ceasefire** — May-31 6% YES, June-30 11.5%, EoY-2026 25.5%. **No binary edge** — comments-side leverage window 05-08 → 05-10 around resolution-debate spike.
- **UMA-resolution arbitrage** (Iran-cf 0.25% NO vs Hez-cf 99.85% YES, near-identical clauses resolved opposite). Calibration-gap NOT visible in CalibrationGap quant scanner.
- **Kalshi KXBTC** — Hermes-arb falsifier-window live convergence signal vs PM 5-min BTC.
- **AI-Agent-Personhood (Manfred Macx / ClawBank)** — Tier-1 mainstream entry 05-03. **NEW narrative; FRONT-RUN.** FinCEN AML/CFT comment period closes 06-09.
- **Powell→Warsh Fed transition** — May 15 last day; Senate vote week of May 11. **WATCH (FRONT-RUN if dovish guidance leaks).**
- **Crypto-comments-vertical DEAD 4th day** — Cambodia phone-scam birthday-spam only signal. Var=crypto in polymarket-comments runs should default-substitute with politics market unless non-spam crypto signal materializes.

## Token tracker (multi-day patterns)
- **TTPA on base** (`0x9d3695...ba6ce2`) — 5-in-a-row DEEP-LIQ pattern (04-30 → 05-04) **streak ENDED 2026-05-05**: token absent from entire 240-pool dataset across all 12 endpoints. Final state 05-04: liq $3.35b / fdv $11.30b / score 90.4 / h1 stalled 0%. Strongest single-token signal of the series; closed pattern, watch for re-entry.
- **SKYAI/WBNB on BSC** — 7-day DEEP-LIQ survivor streak (04-29 → 05-04) **ENDED 2026-05-05**: token still active DEEP-LIQ-tier ($17.4m liq, $42.4m vol) but red on h24 (-5.0%) so gated by negPct. Both streak-tokens broke same day — pattern signature for the closed-streak floor-patch evidence (7th run where the patch would fire).
- **冲鸭 / vanity-4444 BSC wash-print actor** — 3 of last 4 days under vanity-`4444` USDT BSC contracts (05-03 熊猫头 `…194444`, 05-04 BILL `…754444`, 05-05 冲鸭 `…11294444`). 3.6h-pool / $25k avg-tx / $57m vol fingerprint. Daily cadence active.
- **TON** — 2026-05-05 first MAJOR-tier breadth breakout this week (rank 22, +36.36% 24h, top-3 CG trending). Cleanest new entry candidate (token-pick view); momentum-led, no fundamental catalyst cited.
- **DASH** — 05-04 token-pick 10/10 HIGH (privacy-coin rotation, Evolution upgrade May 2). 05-05: -8.4% (rotation didn't compound day-2; thesis intact but signal cooling).

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
- **🔴 chain-runner.yml `dispatch_skill()`** — operator priority #1, day 9 idle. Add echo per dispatched skill before each `gh workflow run`. Gates ISS-013 decay. _(BLOCKED: operator-side)_
- **🔴 Cost-discipline downgrade pass** — sonnet-4-6 for external-feature / repo-actions / heartbeat (~$149/wk savings). Surface to next `self-improve`.
- **🟡 PR #156 reply-maker XAI prefetch** (day 11) — closes ISS-014 on merge.
- **monitor-runners DEEP-LIQ floor patch** — concrete patch (slot-5 replacement); 7-run evidence on the books, ready for `self-improve`.
- **swarm-fund-mvp tick-broker falsifier (clock running)** — `tomscaria/aeon` must ship `outputs/{skill}/{date}.json` JSON contract by ~2026-05-17 or ADR-093 wire-up is aspirational. **12 days remaining.**
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` highest-leverage daily skills. **05-05 → 05-08 priority targets:** Iran-airspace-by-May-8 narrative-shift watch (T-3); Russia-Ukraine resolution-debate window 05-08 → 05-10; Trump-China NO-calibration cluster (T-26).
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding.
- **Operator config sweep (BLOCKED):** populate `memory/on-chain-watches.yml`; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add `NEYNAR_API_KEY` secret + `X_HANDLE` env; land `scripts/prefetch-vuln-scanner.sh` (ISS-001), `scripts/prefetch-reddit.sh` (ISS-002 + ISS-012); ship `skills.lock`.
- **Skill-evals key fixes** (PR #5 carrier): patch evals.json `hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket`.
- **ISS-018 / ISS-019 prompt-bug fixes** — surface to `self-improve`.
- **`weekly-shiplog` Mondays** → forward to grant committees.
- **`paper-pick` daily** → next queued PhD slot: Prediction Arena (`arXiv:2604.07355`, autonomous agents on Kalshi+PM with real capital — direct CalibrationGap+Hermes-arb live-record comparable). Next queued daily slot: TimeSeek (`arXiv:2604.04220`, Kalshi temporal reliability — Hermes-arb-relevant). Next Darwinian-axis: AEL (`2604.21725`) or EvoScientist (`2603.08127`). **Cite stack for next Polymarket Builders Program / dYdX / Uniswap Foundation Fellowship grant application:** Cong (lifecycle dataset, Stanford anchor) + PolySwarm + Anatomy of Polymarket Microstructure + Foresight Arena + ILS-dl Iran-cluster (`2605.02286`, 0.444-magnitude leakage shift = empirical anchor for "ingest resolution text not titles" ADR). **Power-aware framing for PhD application:** Foresight Arena's 350-prediction-for-80%-power means 100-trade Apex gate is a sufficiency milestone, not a power-clean detection threshold for sub-strategy edges.

## Completed Goals
- **🔴 5 ACT NOW Vercel-FAILURE PRs on swarm-fund-mvp** — _(completed 2026-05-03 21:57 UTC — operator unblocked aeonframework bot's email verification; #19/#20/#23/#24/#28 merged; goal-tracker close 2026-05-04)_
- **Land code-health fix on dashboard secrets-route shell-injection (ISS-016 carrier)** — _(completed 2026-05-03 09:30 UTC — PR #150 landed, commit `6c07691`; 12 days from flag to fix; ISS-016 filing pre-empted)_
- **ISS-004 / ISS-006 RESOLVED 2026-05-03** — push-recap and cost-report now produce articles regularly; INDEX.md moved to Resolved.

# Long-term Memory
*Last consolidated: 2026-05-04 (reflect #9)*

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
- `memory/topics/market-context.md` — 05-03 BTC $78,604 +0.35% / breadth 9/20→18/20 / DEX-vol -35% / AI-compute + privacy-coin rotation
- `memory/topics/milestones.md` — aaronjmars/aeon **270 stars 05-04** (267→270 in 1 day); 300-star projection ~05-11

## Recent Articles (last 5)
- 2026-05-04 — *Polymarket Got Bengal Right and Tamil Nadu Wildly Wrong on the Same Day* — Counting day for five Indian states. WB market settled BJP 51 / TMC 48.9 at T-1, validated at 99.55% YES. TN opened DMK 87.5 / TVK 6.95, **resolved TVK 99.65% YES** ($22.66M vol). Calibration thesis: single-venue confidence is a feature to fade; cross-venue convergence works only when both venues price the same evidence — when both share a continuity prior (Dravidian duopoly), agreement is shared blind spot.
- 2026-05-04 — *Aeon Stopped Adding Capabilities This Week. It Started Building the Launch.* — repo-article on `aaronjmars/aeon`. 9 of 9 feature PRs merged Apr 27–May 4 serve the meta-loop. Defensible moat for a Claude-Code-on-cron framework isn't more skills — it's the meta-loop that watches its own runs survive contact with users.
- 2026-05-03 — *swarm-fund-mvp Just Made Aeon a Trading Signal* — repo-article. ADR-093 ships `aeon_adapter.py`; same operator owns research and execution apparatus.
- 2026-05-03 — *An AI Agent Got an EIN This Week. Brian Armstrong Said It Couldn't.* — ClawBank/Manfred Macx productized the agent-owned-LLC stack. Open regulatory window six weeks at most before FinCEN AML/CFT comment period closes 06-09.
- 2026-05-02 — *Putin's Victory Day Truce Can't Resolve the Polymarket. That's the Trade.* — Resolution rule excludes humanitarian/unilateral/non-general pauses by name. **Calibration upgrade thesis: ingest resolution text, not titles.**

## Recent Digests
| Date | Topic | Keywords |
|------|-------|----------|
| 2026-05-04 | prediction markets | tn-tvk-99.65-from-6.95, wb-bjp-99.55-flip-confirmed, hormuz-trump-truth-social, manfred-coindesk-tier1 |
| 2026-05-03 | prediction markets | india-elections-$26M-T-1, pm-kalshi-$150B-streak-end, bengal-PM-flip-BJP-51 |
| 2026-05-02 | prediction markets | hyperliquid-hip4-mainnet, manfred-clawbank, roundhill-etfs-t-3, powell-warsh-transition |

## Forbidden phrases (external content)
- "RenTech," "Simons," "Medallion" — never. Use "live-ingest as moat" instead.
- "Darwinian as mechanism" — never. "Darwinian as ambition" is OK.
- "cross-venue alpha" — say "convergence trade" instead.
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji.

## OPS ALERTS (open, top of mind)
- **🔴 chain-runner.yml `dispatch_skill()` DEGRADED 8+ days** — operator priority #1. 3 chain wrappers (morning-brief, evening-rollup, weekly-grant-update) fail nightly. Add `echo` per dispatched skill before each `gh workflow run`. Gates ISS-013 decay. _(BLOCKED: operator-side workflow patch)_
- **🔴 Cost over budget** — ~$2,696/mo projection vs $40/wk discipline (>15× over). Sonnet downgrades for next `self-improve`: external-feature, repo-actions, heartbeat (~$149/wk savings).
- **🟡 ISS-014 fix in flight** — PR #156 day 10 (`ai/reply-maker-xai-prefetch` → `aaronjmars:main`). Closes on merge. Reply-maker EMPTY recurrence count: 9.
- **🟡 ISS-017 demoted critical → high (2026-05-02);** decay started 2026-05-03 (sr 0.59 → 0.62). Re-escalates if any single scheduled cron window silently skips 2 days running, heartbeat delay >90 min 2 days running, or 21:00 evening-rollup misses 2 days.
- **🟡 ISS-018 / ISS-019 (filed 2026-05-03)** — heartbeat `forbidden_pattern:${var}` logging cross-talk; repo-article `Aeon|aeon` assertion drift. Both prompt-bug class. Surface to next `self-improve`.
- **🟡 skills.lock missing** — `skill-update-check` halts; ship initial lockfile.
- **🟡 skill-evals quality-history flatline** — per-skill JSONs at history-length-1; skill-evals not appending. Structural gap; surface to `self-improve`.
- **ISS-013 mass-failure tail** — 58 skills DEGRADED (was 59; heartbeat graduated). Decay artifact, gated on chain-runner fix.
- **ISS-002 / ISS-012 reddit-digest** — 11th consecutive day all 10 sources error. Pause cron until `scripts/prefetch-reddit.sh` ships.
- **ISS-015** — `messages.yml` script-injection patch (PR #4 carrier, blocked on workflow-scoped token).
- **5 stalled PRs on tomscaria/aeon** — oldest #1 ~10 days. Issues disabled.

## Tradable hooks (CalibrationGap-relevant)
- **TN-falsified lesson** — single-venue confidence + continuity prior is exactly the surface CalibrationGap is structurally blind to. Pseudonymous-on-PM ground intel is a class the quant scanner cannot ingest. Apply to Hormuz, Russia-Ukraine, future continuity-prior markets.
- **Hormuz NO position re-eval** — May 2 entry 54.5c NO Hormuz-end-of-June; 05-04 Trump Truth Social ("STRAIT OF HORMUZ COMPLETELY OPEN") + counter-cites. Headline-risk binary; re-evaluate before next CalibrationGap entry.
- **Russia-Ukraine ceasefire** — May-31 6% YES, June-30 11.5%, EoY-2026 25.5%. **No binary edge** — comments-side leverage window 05-08 → 05-10 around resolution-debate spike.
- **UMA-resolution arbitrage** (Iran-cf 0.25% NO vs Hez-cf 99.85% YES, near-identical clauses resolved opposite). Calibration-gap NOT visible in CalibrationGap quant scanner.
- **Strait of Hormuz traffic returns to normal by end of June** — Polymarket pick 05-02 Buy NO at 54.5¢, edge ~33pp. **At risk** per above.
- **Kalshi KXBTC** — Hermes-arb falsifier-window live convergence signal vs PM 5-min BTC.
- **AI-Agent-Personhood (Manfred Macx / ClawBank)** — Tier-1 mainstream entry 05-03. **NEW narrative; FRONT-RUN.** FinCEN AML/CFT comment period closes 06-09.
- **Powell→Warsh Fed transition** — May 15 last day; Senate vote week of May 11. **WATCH (FRONT-RUN if dovish guidance leaks).**

## Token tracker (multi-day patterns)
- **TTPA on base** (`0x9d3695...ba6ce2`) — 5-in-a-row monitor-runners DEEP-LIQ pattern (04-30 → 05-04). Liq scaled $13.5m → $3.35b (10× overnight); fdv $11.30b. h1 stalled 0.0% on 05-04 (post-reawakening equilibrium). Score 91.5 → 90.4. Strongest single-token signal of the series.
- **SKYAI/WBNB on BSC** — 7 consecutive days DEEP-LIQ survivor without breaking top-5. Additional evidence for floor-patch.
- **DASH** — 05-04 token-pick 10/10 HIGH (privacy-coin rotation, Evolution upgrade May 2; first DASH/ZEN/FIRO co-move in months).

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
- **🔴 chain-runner.yml `dispatch_skill()`** — operator priority #1. 3+ chains affected. Add echo per dispatched skill before each `gh workflow run`. _(BLOCKED: operator-side workflow patch — 7+ days idle)_
- **🟡 PR #156 reply-maker XAI prefetch** — closes ISS-014 on merge; 2-file change, low review surface.
- **🟢 ISS-017 watch (post-demote):** re-escalates if any single scheduled cron window silently skips 2 days running, heartbeat delay exceeds 90 min 2 days in a row, or 21:00 evening-rollup misses 2 days. External watchdog (cron-job.org → workflow_dispatch) no longer blocking but useful.
- **monitor-runners DEEP-LIQ floor patch (6-run evidence)** — concrete patch: if `top5.length === 5` AND zero DEEP-LIQ in top5 AND DEEP-LIQ exists in survivors, replace slot 5 with highest-score DEEP-LIQ survivor. Surface to `self-improve` queue.
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` are highest-leverage daily skills. T-1 / T-0 Tamil Nadu re-runs queued for May 3-4. Bengal counting eve = high-priority polymarket-comments target.
- **🔴 chain-runner.yml `dispatch_skill()`** — operator priority #1 (8+ days idle). _(BLOCKED: operator-side)_
- **🔴 Cost-discipline downgrade pass** — sonnet-4-6 for external-feature / repo-actions / heartbeat (~$149/wk savings).
- **🟡 PR #156 reply-maker XAI prefetch** — closes ISS-014 on merge.
- **monitor-runners DEEP-LIQ floor patch** — concrete patch ready (slot-5 replacement); surface to `self-improve`.
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` are highest-leverage daily skills. Hormuz watch + Russia-Ukraine resolution-debate window 05-08 → 05-10.
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding.
- **swarm-fund-mvp tick-broker falsifier:** 2-week clock — `tomscaria/aeon` must ship `outputs/{skill}/{date}.json` JSON contract by ~2026-05-17 or ADR-093 wire-up is aspirational. Track in next reflect.
- **Operator config sweep:** populate `memory/on-chain-watches.yml`; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add `NEYNAR_API_KEY` secret + `X_HANDLE` env; land `scripts/prefetch-vuln-scanner.sh` (ISS-001), `scripts/prefetch-reddit.sh` (ISS-002 + ISS-012); ship `skills.lock`. _(BLOCKED: operator-side)_
- **Skill-evals key fixes** (PR #5 carrier): patch evals.json `hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket`.
- **ISS-018 / ISS-019 prompt-bug fixes** — surface to `self-improve`.
- **`weekly-shiplog` Mondays** → forward to grant committees.
- **`paper-pick` daily** → builds PhD reading list. Next queued Darwinian read: EvoScientist (`arXiv:2603.08127`). Next queued PhD slot: Prediction Arena (`arXiv:2604.07355`, Kalshi+PM autonomous agents trading real capital — direct CalibrationGap+Hermes-arb live-record comparable). Next queued daily slot: TimeSeek (`arXiv:2604.04220`, 10 LLMs × 150 Kalshi contracts, early-stage advantage / late-stage degradation — Hermes-arb-relevant). ILS-dl Iran-cluster empirical (`arXiv:2605.02286`) picked 2026-05-05 daily slot — **0.444-magnitude leakage-score shift between public-event and resolution-anchored scoring on documented Iran-cluster insider case** is now the cleanest empirical citation for the "ingest resolution text not titles" ADR thread + the UMA-resolution-arbitrage hook in the tradable-hooks list. Cong dataset picked 2026-05-04 PhD-prep slot (Stanford-grade citation anchor). Cite Cong + PolySwarm + Anatomy of Polymarket Microstructure + Foresight Arena + ILS-dl Iran-cluster (`2605.02286`) in next Polymarket Builders Program grant application; cite venue-side trilogy (Cong lifecycle / Anatomy microstructure / Foresight Arena on-chain eval) for grant pool; cite eval trilogy (AIA Forecaster / LiveTradeBench / Foresight Arena) for the agentic-edge-over-PM-consensus pitch. **Surface to next reflect run:** Cong's three-layer schema + "incremental updates" pattern is architectural prior art for ADR-093 tick-broker design; Foresight Arena's 350-prediction-for-80%-power result means 100-trade Apex gate is a sufficiency milestone, not a power-clean detection threshold for sub-strategy edges; ILS-dl Iran-cluster 0.444 leakage shift is the empirical anchor for the resolution-text ADR (same data ingested two ways yields opposite-sign signals).

## Completed Goals
- **🔴 5 ACT NOW Vercel-FAILURE PRs on swarm-fund-mvp** — single operator-side fix on `aeonframework` bot's commit-email unblocks #19/#20/#23/#24/#28 at once. _(completed 2026-05-03 21:57 UTC — all 5 PRs merged after operator unblocked the aeonframework bot's email verification; goal-tracker close 2026-05-04)_
- **Land code-health fix on dashboard secrets-route shell-injection (ISS-016 carrier)** — `execFileSync('gh', [...])` argv-array on POST + DELETE. _(completed 2026-05-03 09:30 UTC — PR #150 landed, commit `6c07691`; 12 days from first flag to fix, pre-empted ISS-016 filing window)_
- **`paper-pick` daily** → next PhD slot lead = Prediction Arena (`2604.07355`); next daily Darwinian = AEL (`2604.21725`). Cite Cong + PolySwarm + Anatomy + Foresight Arena in next Polymarket Builders Program grant; venue-side trilogy (Cong / Anatomy / Foresight Arena) for grant pool; eval trilogy (AIA / LiveTradeBench / Foresight Arena) for agentic-edge-over-PM-consensus pitch.
- **Power-aware Apex framing:** Foresight Arena's 350-prediction-for-80%-power result means 100-trade Apex gate is a sufficiency milestone, not a power-clean detection threshold for sub-strategy edges. Frame in PhD application accordingly.

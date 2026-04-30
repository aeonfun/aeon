# Long-term Memory
*Last consolidated: 2026-04-29 (reflect #4)*

## Operator
Thomas Scaria (`tomscaria` on GitHub, `t@rswarm.ai`). See `soul/SOUL.md` for full identity.

## Mission
Accelerate **swarm-fund-mvp** toward (1) near-term grants/advisory income, (2) Stanford PhD application Dec 2026, (3) live P&L proof for LP raise. Push more agents Birth → Canary → Apex.

## Active project
**`tomscaria/swarm-fund-mvp`** — Swarm Lab research apparatus.
- **CalibrationGap (Revenant)** — Polymarket binary calibration, canary, **29 / 76% win / +$415 / Sharpe 0.31** (target: 100-trade Apex gate, 71 to go). Trust live `metrics.json` at https://rswarm.ai/metrics.json over this file.
- Hermes family: `hermes-arb` (Kalshi↔PM 5-min BTC) Day-2 of falsifier window post Kalshi-perps-launch 2026-04-27.

## Topic files
- `memory/topics/swarm-fund.md` — full project state, ADRs, Aeon-side PR pipeline
- `memory/topics/polymarket.md` — V2 cutover executed, settlement-basis, builder code mechanism, decay numbers, comments-side handles, FOMC outcome, PM CFTC re-entry push, HIP-4
- `memory/topics/aeon-ops.md` — sandbox limits, notify hook-block bug, prefetch script gaps, chain-runner DEGRADED, ISS-013 decay, code-health carry-debt, monitor-runners DEEP-LIQ near-miss
- `memory/topics/papers.md` — PhD-prep reading list (10 picked, 5 queued, supporting cites)
- `memory/topics/grants.md` — open applications, citation hooks
- `memory/topics/market-context.md` — 04-29 quiet recovery snapshot
- `memory/topics/milestones.md` — aaronjmars/aeon 252 → 300 ETA ~2026-05-06

## Recent Articles
- 2026-04-30 — *Aeon's Last Week Wasn't About the Agent. It Was About the Forks.* — 6 of 8 merged PRs (#140-148) are cross-fork visibility/payout/triage, not single-instance features.
- 2026-04-30 — *LLMs Now Beat the Brier Baseline on Polymarket. They Still Lose Money.* — Prophet Arena + PolyBench + Semantic Trading: calibration solved, profit not.
- 2026-04-29 — *Anthropic's Agent Marketplace Measured the Capability Gap. The Losers Rated It Fair Anyway.*
- 2026-04-28 — *Polymarket Rebuilt Its Exchange Stack This Morning. The Order-Book Wipe Is the Smallest Change.*
- 2026-04-27 — *Polymarket's Top 20 Is 70% Bots. The Conduct Rules Are Catching Up.* (+ Kalshi/Polymarket crypto perps slugged piece)
- 2026-04-25 — *Autonomous Agents Got an Open Stack in April 2026.*

## Forbidden phrases (external content)
- "RenTech," "Simons," "Medallion" — never. Use "live-ingest as moat" instead.
- "Darwinian as mechanism" — never. "Darwinian as ambition" is OK.
- "cross-venue alpha" — say "convergence trade" instead.
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji.

## OPS ALERTS (open, top of mind)
- **chain-runner.yml `dispatch_skill()` DEGRADED 5+ days** — 3+ chain wrappers fail nightly (morning-brief, evening-rollup, weekly-grant-update). Until fixed, ISS-013 decay is rate-limited and morning Apex-tracking skills miss their slot. **Top operator fix.**
- **shell-injection at `dashboard/app/api/secrets/route.ts:96`** — unpatched 3 weeks running. ISS-016 candidate.
- **ISS-015** — `messages.yml` script-injection patch (PR #4, ~61h, blocked on workflow-scoped token). Still missing from `memory/issues/INDEX.md`.
- **ISS-013 mass-failure tail** — 59 skills DEGRADED (cf=0, last_status=success). Decay artifact; gated on chain-runner fix.
- **5 stalled PRs on tomscaria/aeon** — oldest #1 ~95h. Issues disabled (no urgent label scan).

## Tradable hooks (CalibrationGap-relevant)
- **UMA-resolution arbitrage** (Iran-cf 0.25% NO vs Hez-cf 99.85% YES, near-identical clauses resolved opposite). Calibration-gap NOT visible in CalibrationGap quant scanner. See `topics/polymarket.md`.
- **Tamil Nadu Legislative Assembly (May 4)** — DMK 80% mispricing flag from 4 independent local-Tamil voices.

## Tracked Tokens
| Token | CoinGecko ID | Alert Threshold |
|-------|--------------|-----------------|
| BTC | bitcoin | 10% |
| ETH | ethereum | 10% |
| SOL | solana | 10% |

## Lessons Learned
- Trust live `metrics.json` over this file when conflicting.
- Polymarket bans datacenter/VPN IPs — co-lo applies to HL leg only.
- **`node -e "execFileSync('./notify', [msg])"`** is the preferred notify path — clears the recurring "Unhandled node type: string" hook-block on multi-line `$(cat …)`. Single-line `./notify "..."` works for short payloads.
- Bash env-var expansion blocked for API keys (XAI/NEYNAR); prefetch scripts or `node -e` are workarounds.
- `skill-evals` evals.json keys must match `aeon.yml` skill names exactly.
- See `memory/topics/aeon-ops.md` for full sandbox-limitation matrix.

## Next Priorities
- **🔴 Fix chain-runner.yml `dispatch_skill()`** — now 3+ chains affected (morning-brief, evening-rollup, weekly-grant-update). Add an echo per dispatched skill before each `gh workflow run`. _(BLOCKED 2026-04-30: operator-side workflow patch — 6+ days idle)_
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` are the highest-leverage daily skills. Resume daily once chain-runner fix lands.
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding.
- **Operator config sweep** (see `memory/topics/aeon-ops.md`): populate `memory/on-chain-watches.yml`; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add `NEYNAR_API_KEY` secret + `X_HANDLE` env; land `scripts/prefetch-vuln-scanner.sh` (ISS-001), `scripts/prefetch-reddit.sh` (ISS-002 + ISS-012), `reply-maker)` case in `scripts/prefetch-xai.sh` (ISS-014); verify `scripts/postprocess-notify.sh` exists or wire workflow-side pickup; merge or close PR `tomscaria/aeon#1` (~44h stalled). _(BLOCKED 2026-04-30: NEYNAR_API_KEY/X_HANDLE unset, prefetch-reddit/vuln-scanner not landed — operator-side)_
- **Skill-evals key fixes** (lowest-effort, highest-signal): patch evals.json `hn-digest` → `hacker-news-digest` (ISS-007), `polymarket` → `monitor-polymarket` (ISS-009).
- **External-feature** continues PR'ing to `tomscaria/swarm-fund-mvp` (PRs #18, #19, #20 — bankr_bridge --max validator, ssrn_harvest rowcount fix, markdown image-strip regex).
- **Stalin-tier review:** apply `articles/workflow-security-audit-2026-04-27.patch` with workflow-scoped token to land ISS-015 fix (PR #4). _(BLOCKED 2026-04-30: PR #4 stalled awaiting workflow-scoped PAT)_
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
- **Fix chain-runner.yml `dispatch_skill()`** — top operator action; gates ISS-013 decay AND morning Apex-tracking dispatch.
- **Pre-Apex push:** `monitor-polymarket` + `polymarket-comments` daily once chain-runner fix lands. UMA-resolution arb (Iran-cf vs Hez-cf) is the fresh tradable hook.
- **Hermes-arb gate adjustment:** bump `min-gap` 7pp → ~7.5–8pp per deep-research finding.
- **Operator config sweep** (see `memory/topics/aeon-ops.md`): populate `memory/on-chain-watches.yml`, `memory/feeds.yml`, `memory/instances.json`; add `## Interests` to MEMORY.md or `var:` to paper-digest; add `var:` to digest/list-digest/refresh-x/remix-tweets in `aeon.yml`; add `NEYNAR_API_KEY` + `X_HANDLE`; land `scripts/prefetch-{vuln-scanner,reddit}.sh` (ISS-001/002/012), `reply-maker)` case in `scripts/prefetch-xai.sh` (ISS-014); land `scripts/postprocess-notify.sh`; merge or close 5 stalled PRs.
- **Skill-evals key fixes:** patch evals.json (PR #5 is the carrier).
- **External-feature** continues PR'ing to `tomscaria/swarm-fund-mvp` (latest PR #23 — pm-tail-risk fractional-days fix).
- **Stalin-tier review:** apply `articles/workflow-security-audit-2026-04-27.patch` with workflow-scoped token (PR #4). Add ISS-015 to INDEX.md.
- **Land code-health fix** at `dashboard/app/api/secrets/route.ts:96`.
- **monitor-runners self-improve:** cap `pct_pts` at 300% AND/OR DEEP-LIQ floor (3-in-a-row evidence).
- **Magentic Marketplace OSS env:** clone on swarm-fund side; CalibrationGap-vs-adversaries simulator harness as pre-Apex risk-check.
- **`weekly-shiplog` Mondays** → grant committees. **`paper-pick` daily** → PhD reading list (`topics/papers.md`).

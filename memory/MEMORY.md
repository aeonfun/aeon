# Long-term Memory
*Last consolidated: 2026-05-31 (plan-adherence v0 manual triage, post-23-day gap)*

## Operator
Thomas Scaria (`tomscaria` on GitHub, `t@rswarm.ai`). See `soul/SOUL.md` for full identity.

## Mission (CLAUDE.md priority order)
1. **Near-term income** — grants, advisory, consulting. See `memory/topics/grants.md`.
2. **Stanford PhD application Dec 2026** — calibration / agentic finance / multi-agent RL. See `memory/topics/papers.md`.
3. **Live P&L proof for LP raise** — push agents Birth → Canary → Apex. See `memory/topics/swarm-fund.md`.

## Active project
**`tomscaria/swarm-fund-mvp`** — Swarm Lab research apparatus. Live trading on Polymarket (CalibrationGap path) + Hyperliquid.

Current fleet from live `metrics.json` at https://rswarm.ai/metrics.json — **trust this over any number in this file when they disagree**:
- **180 agents** (was 112 on 05-08). 159 shadow / 21 canary / 0 apex / 0 revenant. `Revenant` lifecycle label appears unused; treat as deprecated until verified.
- **Headline agent — `calibration-gap-v1`** (Canary): 42 closed trades, 71% win, +$363, Sharpe 0.19. Was `CalibrationGap (Revenant) 29/76%/+$415/Sharpe 0.31` per the 05-08 snapshot — numbers degraded, lifecycle reframed.
- **runner_swarm canary live execution: SHIPPED.** PR #34 merged with all four Codex P0/P1 fixes (RiskGate routing, HL close-by-stored-size, PM SHORT buys NO token, explicit opt-in flag). 8+ variants in canary: `hl-fractal-v01/v02`, `pm-entropy-flow-v01`, `pm-regime-shift-v01/v02`, `ta-macd-cross-v01/v02`, `hl-vol-momentum-v01-v03`, `hl-dynamic-vol-grid-v03`. The "20-variant cohort frozen on paper" framing is obsolete.
- **Apex gate is further than the old snapshot suggested.** Definition: 100 trades + Sharpe > 0.5 + composite > 0.5. Best by trades: `calibration-gap-v1` 42/100. Best by Sharpe: `calibration-gap-09-crypto-gpt5` 0.582 but only 13 trades. Nobody close on all three.

Recent ADRs (last 23 days): **ADR-100 through ADR-106 shipped.** ADR-100 pm-complete-set-drain into runner-swarm. ADR-101 IC-discretionary kills (`pm-hl-lead-lag`, `pm-hl-divergence`). ADR-102 fleet Sharpe diagnostic. ADR-103 StrategySpec schema + SpecRunner. ADR-104 Factor → StrategySpec generator. ADR-105 (2026-05-17) runner_swarm canary execution. ADR-106 (2026-05-25) swarm-triage local-fine-tune canary at 5%, 78% eval (below 80% gate).

## Open falsifiers and load-bearing drift (from 2026-05-31 plan-adherence run)

- **🔴 ADR-093 outputs/{skill}/{date}.json contract — never shipped on aeon side.** Falsifier expired 2026-05-17 (14 days ago). `python/execution/aeon_adapter.py` polling `tomscaria/aeon/outputs/...` has been 404-ing every 15 min for 2+ weeks. Defect-hardening PRs (#29-32) patched consumer side while producer never landed. **Action**: monitor-polymarket / polymarket-comments / narrative-tracker each write `outputs/{skill}/YYYY-MM-DD.json` alongside existing notify path.
- **🔴 ADR-095 OLLAMA_FULL=1 velocity falsifier fired.** Flag not in `.env` or `.env.example` (verified 2026-05-31). 10 days past target. Direction may still be right — ADR-106 swarm-triage canary at 5% indicates progressive rollout via a different lever — but the explicit ADR-095 flag-flip prediction was wrong.
- **🔴 feat/fs-adoption branch stranded — 27 commits orphaned by 2026-05-16 history rewrite.** Cannot `git merge` (would replay 5031-file pre-rewrite diff). Recovery = founder-supervised rebase. Expect conflicts in `runner_swarm.py`, `python/api/server.py`, `schemas.py`, `DECISIONS.md`, `uv.lock`. Branch ADR number needs renumbering past ADR-106. See `outputs/2026-05-22_fs_adoption_branch_stranded.md`.
- **🔴 ADR-096+ resolution-text-ingest — no slot opened, 37+ days flagged.** Single highest-leverage CalibrationGap upgrade per repeated paper-pick / polymarket-comments surfacing. Latest ADR is 106; the 096 slot is still empty. Empirical anchors ready: Iran-airspace 48pp clause divergence, Hantavirus, ILS-dl (`2605.02286`), Per-Market ILS (`2605.02287`), TimeSeek 12% web-search-hurts.
- **🟡 swarm-triage canary at 78% eval (below 80% gate).** ADR-106 needs graduation criteria defined before turning dial up: sample size, agreement-rate threshold, $/Mtok delta. Triggers eventual ADR-057 (cost-attribution) revisit.
- **🟡 chain-runner.yml dispatch_skill DEGRADED — day 35+ (was day 12 on 05-08).** 1-line `echo` patch per dispatched skill before each `gh workflow run`. _(BLOCKED: operator)_
- **🟡 Grant pipeline — zero submissions in 30+ days.** Six open applications (AWS Activate pitch-ready, Anthropic Credits approved/active, dYdX drafting, Uniswap Foundation drafting, Polymarket Builders blocked on Verified status, Harmonic drafting). See `memory/topics/grants.md`.

## Top tradable hooks (ADR-096/107 empirical anchors — keep top of mind)

Single-source-of-truth: `memory/topics/polymarket.md` for the full live list. These are the load-bearing anchors for the resolution-text-ingest ADR (now ADR-107 in DECISIONS.md):

- **Iran-airspace 48pp clause-text divergence** — Iran-airspace-by-May-8 ladder closed 2.05% YES; sister "major closure" market on same five-airport clause sat at 52% YES. Same kinetic event, opposite clause-text reading. Cleanest single case study for the thesis.
- **Hantavirus pandemic 2026** — Andes close-contact vs airborne clause divergence; sante.gouv.fr gold-standard cite. Second concrete anchor.
- **Iran-cf vs Hez-cf UMA-resolution arbitrage** — Iran-cf 0.25% NO vs Hez-cf 99.85% YES on near-identical clauses. The CalibrationGap quant scanner is structurally blind to this class.
- **Powell→Warsh Fed transition** — PM 100% YES on $49.5M. Markets pricing continuity; Warsh platform = regime change. **Falsifier:** June 17-18 FOMC keeps forward-guidance verbatim → continuity wins.
- **AI-Agent-Personhood (Manfred Macx / ClawBank)** — FinCEN AML/CFT comment period closes 2026-06-09. Tier-1 entry. See `articles/research-brief-ai-agent-personhood-llc-fincen-window-2026-05-06.md`.
- **TN-falsified lesson** — single-venue confidence + continuity prior is structurally invisible to the quant scanner. Pseudonymous-on-PM ground intel is an ingestion gap.

## Operational alerts (open carriers)

Single-source-of-truth: `memory/topics/aeon-ops.md`. Current open carriers:

- **🔴 chain-runner.yml `dispatch_skill()` DEGRADED** — operator priority. 1-line `echo` patch per dispatched skill before each `gh workflow run`. Gates ISS-013 decay. _(BLOCKED: operator-side, filed as ISS-027)_
- **🔴 Cost over budget** — ~$2,696/mo projection vs $40/wk discipline (>15× over per 05-08 snapshot; needs re-verify post-ADR-095 rollout). ADR-095 zeros swarm-fund-mvp non-reasoning LLM bill but Aeon side remains unmigrated.
- **🔴 `scripts/prefetch-reddit.sh` missing** — reddit-digest 14+ consecutive days all 10 sources 403. Pause reddit-digest cron until prefetch ships (ISS-002/012).
- **🟡 ISS-013/-018/-019/-020** — chronic-low success-rate skills + prompt-bug class fixes pending `self-improve` re-enable. ~37 skills carrying tail.
- **🟡 skills.lock missing** — `skill-update-check` halts; ship initial lockfile.
- **🟡 auto-merge `## Trusted Authors`** — add `aaronjmars` (and optionally `tomscaria`) to `memory/watched-repos.md` to unblock auto-merge for repo-owner PRs.
- **🟡 ISS-015** — `messages.yml` script-injection patch (PR #4 carrier, blocked on workflow-scoped token).

## Topic files
- `memory/topics/swarm-fund.md` — full project state, ADRs, PRs, infra
- `memory/topics/polymarket.md` — Polymarket markets, comments-side handles, ADR-096 anchors
- `memory/topics/aeon-ops.md` — sandbox matrix, ISS-NNN issues, cost projection
- `memory/topics/papers.md` — PhD-prep reading list, paper-pick history
- `memory/topics/grants.md` — open applications, citation hooks
- `memory/topics/market-context.md` — macro / token tracker / regime
- `memory/topics/milestones.md` — star milestones, public ledger

## Forbidden phrases (external content)
- "RenTech," "Simons," "Medallion" — never. Use "live-ingest as moat" instead.
- "Darwinian as mechanism" — never. "Darwinian as ambition" is OK.
- "cross-venue alpha" — say "convergence trade" instead.
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji.

## Lessons learned (carried + new)
- Trust live `metrics.json` over this file when conflicting. _(reaffirmed 2026-05-31 — discovered the headline canonical agent had been restructured and renamed)_
- Polymarket bans datacenter/VPN IPs; co-lo applies to HL leg only.
- Bash env-var expansion blocked for API keys (XAI/NEYNAR); prefetch scripts or `node -e` are workarounds. Comments-side prefetch (Polymarket public API) works without auth; X-source side is auth-gated.
- **Ingest resolution text, not titles.** Quant scanner blind to language-asymmetry markets. Single highest-leverage CalibrationGap upgrade.
- **Cross-venue convergence works ONLY when venues price same evidence; when both share a continuity prior, agreement is shared blind spot.**
- **Shell-out via `execFileSync` argv-array, not template strings.** PR #150 (secrets/route.ts) and `auth/route.ts:46` are the in-tree templates.
- **Ceasefire-frame discipline holds under peak kinetic news** (Iran-airspace 05-08 closed 2.05% YES despite confirmed US strikes + oil >$100/bbl).
- _(NEW 2026-05-31)_ **MEMORY.md staleness is itself the load-bearing failure mode for an agentic system.** A 23-day gap created a fleet of phantom findings (runner_swarm "frozen", PM "not live trading", PR queue "stalled") that were already resolved in code but not in operator mental model. Operationalize plan-adherence weekly + reflect to compound; never let MEMORY.md drift > 7 days again.
- _(NEW 2026-05-31)_ **The Revenant lifecycle label is currently unused in the live fleet.** Either bring it back as a real tier above Apex, or rename internal references away from it to avoid implying a stage that doesn't exist.

## Next Priorities (consolidated; supersedes prior duplicates)
*Ordered by load-bearing-ness, not by date.*

1. **🔴 Ship ADR-093 outputs/{skill}/{date}.json contract** (unblocks aeon → swarm-fund signal pipe, end of 14-day expired-falsifier window).
2. **🔴 Open ADR-096 resolution-text-ingest stub** (single highest-leverage CalibrationGap upgrade; anchors ready).
3. **🔴 Recover feat/fs-adoption** (27-commit rebase, before the cost gets worse).
4. **🟡 Define ADR-106 swarm-triage graduation criteria** (sample size, agreement, $/Mtok delta).
5. **🟡 Submit one grant this week** (AWS Activate is pitch-ready, lowest activation cost).
6. **🟡 Apex push** — `calibration-gap-v1` at 42/100. Highest-leverage daily skills: `monitor-polymarket`, `polymarket-comments`. ADR-096 unlock would accelerate.
7. **🟡 chain-runner.yml `dispatch_skill` patch** (operator-side, 1-line echo per dispatched skill).
8. **🟡 Re-run plan-adherence after this consolidation** to verify drift findings are correctly classified against now-current memory.

## Completed Goals (last 30 days)
- runner_swarm canary execution shipped (ADR-105 + PR #34, 2026-05-17)
- All four Codex review P0/P1 fixes landed (RiskGate, HL close, PM SHORT NO, opt-in flag)
- Phase 0+1 dual-venue stack (Kalshi recorder + cross-venue market matcher, 2026-05-27)
- Staleness watchdog daemon shipped (full module + LaunchAgent + runbook)
- Local fine-tune pipeline (MLX-LoRA + GGUF + canary router) → swarm-triage at 5%, 78% eval
- ADRs 100-106 ratified
- Aeon Batch 1-5 feature work + context pipeline (4h LaunchAgent)
- Old "PR #156 reply-maker XAI prefetch" — ISS-014 closed 2026-05-08

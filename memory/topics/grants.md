# Grants & credits — open applications

Live tracker maintained at `swarm-fund-mvp/outputs/grants_tracker.md`.

## Open / in-progress

| Grantor | Type | Status | Notes |
|---------|------|--------|-------|
| **AWS Activate** | Cloud credits ($25k–$100k) | Pitch ready | Four-layer playbook: Research Credits → Activate Portfolio → Gen AI Accelerator → Fintech. Lead with story, credits close. |
| **Anthropic Research Credits** | API credits | Approved | Active. Covers Aeon + autoresearch loop. |
| **dYdX grant** | $$$ research grant | Drafting | Focus on cross-venue liquidation cascade research. |
| **Uniswap Foundation Fellowship** | Stipend + brand | Drafting | Pitch agentic LP/router design. Foundation grant is the formal application path; the Ken Ng (Ecosystem Growth) inbound is the parallel relationship-led path. See `memory/topics/uniswap.md`. |
| **Polymarket Builders Program** | $2.5M+ pool, rolling | Need Verified status | Email: builder@polymarket.com once Verified. |
| **Harmonic** | Research grant | Drafting | Pitch Aristotle adversarial-critique loop as reproducible methodology. Output: `outputs/harmonic_aristotle_grant_application.md`. |

## Closed / declined

(none yet)

## Conversations open

- **Uniswap Ecosystem Growth (Ken Ng)** — INBOUND, call being scheduled per Thomas OS MASTER_PLAN.md (🟢 hot). Distinct from the Foundation Fellowship grant: Ken Ng route is relationship-led, immediate, lower friction. Position as agentic LP/router researcher with live CalibrationGap track record + lore-coins on-chain monitor as portfolio piece. See `memory/topics/uniswap.md` for full positioning + briefing.
- Tower Research, DRW, DES — research roles in conversation, position as quant researcher with live agent
- Multicoin Capital — 2026-03 conversation validated convergence thesis externally; not formal grant pursuit but useful narrative anchor

## Application narrative anchors

1. **Live capital** — 42 closed trades on `calibration-gap-v1` Canary, 71% win rate, +$363 realized P&L, real $$ not paper. Plus 20 additional Canary-lifecycle variants (8+ runner_swarm: hl-fractal-v01/v02, pm-entropy-flow-v01, pm-regime-shift-v01/v02, ta-macd-cross-v01/v02, hl-vol-momentum-v01-v03, hl-dynamic-vol-grid-v03) extending the live-trading surface. Source: rswarm.ai/metrics.json, verified 2026-05-31.
2. **Reproducible methodology** — every ADR numbered, every trade tape committed, every decision logged
3. **Convergence-infra thesis** — not "this strategy works forever," but "infrastructure to rotate when each strategy decays"
4. **OODA-loop velocity** — Aeon itself is the artifact. Watch it run.

## Citation hooks (for grant-application body)

- **arXiv:2601.01706** (Gebele & Matthes, Jan 2026) — primary LOOP-violation citation; durable 2-4% cross-platform price gaps over 100k events.
- **arXiv:2602.19520** (Le 2026) — four-component decomposition of calibration variance; 87.3% explained by horizon × domain × size.
- **arXiv:2510.25779** (Bansal/Hofman/Lucier/Mobius/Rothschild/Slivkins/Immorlica/Horvitz, MSR+ASU, Oct 2025) — *Magentic Marketplace*. Stanford-grade institutional anchor (Rothschild = canonical PM economist). Open-source agentic-marketplace simulator → reproducibility hook for any methodology claim.
- **Anthropic Project Deal (Dec 2025, Anthropic blog Apr 25):** 69 employees / 186 deals / $4k / one week. Opus +2.07 deals/user p=0.001, $2.68 edge per item, 70% spread on broken-bike. **Perceived-fairness gap invisible (4.05 Opus vs 4.06 Haiku).** Primary citation for "capability gap not visible to losers" → maps onto why CalibrationGap edge persists in PM. Worth pulling for Anthropic Research Credits renewal narrative.
- **arXiv:2506.00723** (Paleka/Goel/Geiping/Tramèr, ETH Zürich + MPI/Tübingen, May 2025) — *Pitfalls in Evaluating Language Model Forecasters*. Two named failure modes (temporal leakage, extrapolation gap) directly answer-by-contradiction the LLM-forecaster claims around CalibrationGap territory. Defensive cite for "live-trade record beats static benchmarks." Tramèr is the highest-bar NeurIPS/ICML lineage author surfaced this month.
- **CFTC ANPRM comment-window close (2026-04-30):** Warren/Merkley + 40 lawmakers letter explicitly names election/war/sports/government-action prohibitions; ~800 comments on file. Tailored CFTC rule could land Q3 2026. Relevant for Polymarket Builders + dYdX research grant body language on regulatory tailwinds.
- **arXiv:2604.14199** (PolyBench), **arXiv:2510.17638v1** (Prophet Arena), **arXiv:2512.02436v1** (Semantic Trading) — three 2026 LLM-vs-Polymarket benchmarks braided in `articles/2026-04-30.md`. Calibration solved at the Brier/ECE level; profitability not (only 2 of 7 LLMs in PolyBench positive CWR; Sharpe ceiling 0.02). Sub-thesis is operator-grade leverage for the "narrow-regime + microstructure discipline" Apex/PhD framing.

## Aeon's role here

- `weekly-shiplog` Mondays = LP-ready narrative ammunition for grant updates
- `paper-pick` daily → builds the academic citation list grant committees expect
- `external-feature` PRs to swarm-fund-mvp → demonstrates the agent-native thesis in production
- `cost-report` weekly → shows credit utilization for renewals

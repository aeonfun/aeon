# Uniswap — pipeline state, positioning, agentic LP/router thesis

Single source of truth for the operator's Uniswap engagement. Two parallel paths:

1. **Uniswap Ecosystem Growth (Ken Ng)** — INBOUND live conversation, 🟢 hot in Thomas OS MASTER_PLAN.md, call being scheduled. Relationship-led path.
2. **Uniswap Foundation Fellowship** — formal grant application, drafting. Brand + stipend.

Both paths benefit from the same positioning: agentic LP/router design grounded in CalibrationGap's live record + the agent-fleet architecture aeon now formalizes.

## Pipeline state (2026-05-31)

### Path 1 — Ken Ng / Ecosystem Growth (active)

- **Status:** Inbound from Ken Ng (Uniswap Ecosystem Growth). Call being scheduled.
- **Source:** Thomas OS MASTER_PLAN.md "Uniswap Ecosystem Growth | inbound from Ken Ng | call being scheduled | 🟢 hot"
- **Action queued:** "Uniswap call prep when scheduled (via /call-prep skill)" — Thomas OS task
- **Strategic note:** "If a hot opp accelerates (Uniswap call lands, ...), serve that opp. The plan re-anchors around it."
- **Next:** wait for scheduling response; the moment a slot lands, fire `/call-prep` (Thomas OS) seeded from this file.

### Path 2 — Uniswap Foundation Fellowship (drafting)

- **Status:** Drafting per `memory/topics/grants.md`. Stipend + brand.
- **Pitch:** Agentic LP/router design.
- **Output expected:** formal application document. Currently no submitted marker (ISS-028 grant pipeline drift).
- **Sequencing:** Foundation submission can be paced to land just before or just after the Ken Ng conversation — landing the brand on the formal grant adds weight to the relationship call; landing it just after lets the conversation steer the pitch.

## Why CalibrationGap → Uniswap is a real bridge

The agentic LP/router design Uniswap Foundation funds and Ken Ng cares about is structurally adjacent to what CalibrationGap does on Polymarket:

- **CalibrationGap** is an agent that reads market microstructure (calibration error per market), holds an explicit position, and reasons about edge persistence. Same shape as an agentic LP that reads pool depth + impermanent-loss risk + flow imbalance and holds explicit positions.
- **The runner_swarm fleet** (~180 agents, 21 canary as of 2026-05-31) is the agent-population layer — Latin-Hypercube variant sampling, lifecycle promotion gates, regime-conditional sizing. Direct analog to an LP-fleet that varies range, fee tier, hook configuration per pool/market.
- **The outputs-contract.md** (per `conventions/outputs-contract.md`) is the cross-repo signal bus that any agentic LP would need to talk to risk gates, treasury management, rebalancing logic. Reusable.
- **plan-adherence** is the goal-drift detector — for an agentic LP fleet that runs across multiple Uniswap deployments (v3, v4 hooks, X-chain), this is the layer that catches "we said we'd be hedged across X by Y, are we?"

The pitch ISN'T "build Uniswap LP infrastructure from scratch." The pitch IS "the Aeon control tower + outputs-contract.md + plan-adherence pattern is the missing layer for any agentic LP fleet at production stakes — we shipped it for prediction markets first because the calibration measurement was tighter, and the cross-application is mechanical."

## Positioning angles (use in call-prep / cover letter / Fellowship body)

1. **Live capital, not a deck.** 42 closed trades on `calibration-gap-v1` (Canary), 71% win rate, +$363 P&L, Sharpe 0.192. 180-agent fleet. Real builder code `0xcddc4ba3...8286f` on Polymarket. Source: rswarm.ai/metrics.json, verified 2026-05-31.
2. **Reproducible methodology, not a one-off strategy.** 107 ADRs in DECISIONS.md, every trade tape committed, every decision logged. Uniswap Foundation funds reproducible research; this is exactly that shape.
3. **Convergence-infra thesis, not "alpha forever."** The Aeon control tower is "infrastructure to rotate when each strategy decays" — exactly what an institutional LP fleet on Uniswap needs as fee tiers, hooks, X-chain liquidity, MEV environment shift quarter-by-quarter.
4. **Cross-repo signal contract is the hardest part.** `conventions/outputs-contract.md` formalizes the producer-consumer pattern between agent fleets and execution adapters. Already deployed: aeon → swarm-fund-mvp. Ready to deploy: lore-coins-monitor → prysm-squads-mvp. Same pattern would bridge aeon → a Uniswap LP execution layer.
5. **Plan-adherence is the new layer.** The eval-loop pattern (Machina/Hermes "How To Fix AI Slop" article, 2026-05-30) applied to goal-state, not output-quality. An agentic LP fleet without this layer drifts off-mandate within weeks; with this layer, deviations surface as ISS-NNN findings in 7 days.

## Citation hooks (for the formal application + the call)

Reuse from grants.md citation hooks (CalibrationGap-relevant) PLUS Uniswap-specific:

- **Uniswap v4 hooks** — programmable LP positions. Direct hook for the agentic-LP framing; the v4 design is *built* for agent-controlled liquidity.
- **Predicate.io v4 risk-management framework** — Thomas OS firecrawl cache at [`.firecrawl/predicate.io-blog-risk-management-framework-for-institutional-liquidity-on-uniswap-v4.md`](../../Thomas%20OS/.firecrawl/predicate.io-blog-risk-management-framework-for-institutional-liquidity-on-uniswap-v4.md) — institutional-LP risk framework that the agentic version explicitly extends.
- **Anchorage Digital Porto case study** — Thomas OS firecrawl cache at [`.firecrawl/blog.uniswap.org-porto-by-anchorage-digital-case-study.md`](../../Thomas%20OS/.firecrawl/blog.uniswap.org-porto-by-anchorage-digital-case-study.md) — institutional-stack precedent for what an agentic-LP fleet would slot into.
- **Uniswap Foundation research page** — Thomas OS firecrawl cache at [`.firecrawl/uniswapfoundation.org-research.md`](../../Thomas%20OS/.firecrawl/uniswapfoundation.org-research.md) — research priorities; align the pitch to the named workstreams.
- **Uniswap Foundation grant retrospective** — [`.firecrawl/paragraph.com-@kennethng-uniswap-grants-program-retrospective.md`](../../Thomas%20OS/.firecrawl/paragraph.com-@kennethng-uniswap-grants-program-retrospective.md) — Kenneth Ng's own retrospective on the grants program. Read before the call.
- **arXiv:2510.25779** (Magentic Marketplace, MSR + ASU) — Stanford-grade citation anchor for the agentic-marketplace simulation framing. Reusable from grants.md.

## What aeon needs to ship next to harden this pitch

**Not blocking the conversation, but each adds proof:**

1. **`uniswap-position-monitor` skill** — same shape as `lore-coins-monitor` (Phase 1, already scaffolded), targets a deployed Uniswap v3/v4 position (or a public LP wallet) and emits position-state signals per outputs-contract.md. Demonstrates the cross-application of the pattern in 24h of work.
2. **One agentic-LP backtest in `swarm-fund-mvp`** — add a `runner_swarm` variant family that simulates LP-position holding (range selection, rebalance triggers) on historical Uniswap data, even if at small scale. Lights up the multi-strategy-fleet claim with Uniswap-specific evidence.
3. **A `outputs/uniswap-position-monitor/{date}.json` signal feeding a stub `uni_lp_adapter.py`** in swarm-fund — proves the outputs-contract.md producer-consumer bridge works for Uniswap.

These three would take ~2-3 days. Worth scheduling against the Ken Ng call date.

## What Thomas OS already has

- Full firecrawl cache: 18+ Uniswap-related pages (Foundation research, Porto case study, Anchorage partnership, Ledger case study, Predicate.io v4 risk framework, Talos/Fireblocks partnership, careers page, ecosystem blog).
- Call-prep skill ready to fire when a slot is scheduled.
- Resume builder ready to produce a Uniswap-specific cover.
- Pitch-deck skill if a follow-up deliverable is needed.

What Thomas OS DIDN'T have before tonight (and now does via this file + the aeon push):
- The live-truth headline (calibration-gap-v1 numbers, 180-agent fleet, Revenant brand clarification).
- The bridge framing ("agentic LP" = "calibration-aware position-holding agent" + "fleet lifecycle gates" + "outputs-contract.md signal bus").
- The portability docs (`conventions/`) as concrete proof of the agent-fleet pattern.

## Open questions for the operator before the call

- **Is the Ken Ng call about the Fellowship grant specifically, or a broader Ecosystem Growth conversation (research role, advisory, partnership)?** The positioning shifts: grant = formal pitch + application body; advisory = relationship + offer of judgement; partnership = co-development conversation. Each frames CalibrationGap differently.
- **Has Thomas already shared anything with Uniswap or with Ken Ng directly?** Cold positioning vs warm continuation. Affects what to surface in the first 5 min.
- **What's the operator's preferred fellowship outcome?** Stipend-only (low constraint, do whatever) vs Uniswap-affiliated researcher title (signal weight, scope constraint). Affects whether to pitch "I do this anyway" vs "I'll do this for you."

## History

- 2026-05-31 — File created during Phase 0 push prep. Pipeline state captured from Thomas OS MASTER_PLAN.md. Positioning angles drawn from grants.md + conventions/CONVENTIONS.md.

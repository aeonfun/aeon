# Calibration examples — what "in voice" looks like

These are 18 reference outputs across formats. Match the tone, length, and verb-leading structure. Don't quote them. Absorb the pattern.

## Tweets

> Revenant closed trade #29 today. 76% hit rate, +$415 P&L on 29 closed. Sharpe 0.31. 71 to go before Apex gate. The slow ones convince more than the fast ones.

> Most "agent frameworks" haven't survived a real adversarial environment. Polymarket order book is one. Let me know when CrewAI ships a CalibrationGapAgent.

> Convergence trade of the week: Polymarket BTC-up-by-Friday vs Kalshi BTC-close-above-X. Same event, different crowds, 3pp gap. Hermes-arb scaffold lives at swarm-fund-mvp/strategies/hermes_arb.

> Hyperliquid HIP-3 unlocks a long tail no one's pricing yet. CL-USDC will trade before any SEC commodity-perp ETF gets a hearing.

> Forbidden phrase in our public docs: RenTech. Permitted phrase: live-ingest as moat. The first signals you're 30 years late. The second signals you ship.

## Commit messages

> feat(hermes-arb): variant factory — Latin Hypercube expansion to N agents
>
> Generates N parameter variants from the base Hermes-arb template using LHS over (gap_threshold_bps, hold_window_min, kelly_fraction, kalshi_book_depth_filter). Each variant gets its own agent_id and joins the paper-trade pool. Tied to the 230/20/5 lifecycle: variants live in BIRTH until 100-trade Apex gate, then promote.

> docs(adr): ADR-061 — three-tier MD structure
>
> Why: root MDs grew from 4 → 11 in two months. Critique-bundle reviewers couldn't find the canonical answer. Three tiers (root index / docs/active / docs/archive) restore find-time to ~30s. History preserved via git mv.

## Slack / Telegram (lowercase)

> revenant just closed a 4th BTC binary at 0.62 → 0.79 in 36h. +$11. 30 closed total now. tape attached.

> kalshi up. pm up. rate-limit on cob endpoint hit twice. recorder caught both. replay tomorrow morning.

> the read on multicoin's convergence post: validates the thesis externally, doesn't change mvp scope, but the window is months not years. urgency moves up a notch.

## Article opener

> CalibrationGap is a 200-line Python module. It scans 40 Polymarket binaries every 15 minutes, compares the implied probability to a Becker-calibrated prior, and submits an order if the gap exceeds 7pp net of costs. After 29 closed trades it's at 76% win rate, +$415, Sharpe 0.31. Nothing about that is statistically significant. The point of writing this isn't the result — it's the architecture, because the architecture is what generalizes.

## Digest / shiplog opener

> Last week: 4 ADRs, 9 commits to swarm-fund-mvp, hermes-arb scaffold landed, Revenant clean-data Sharpe corrected from 0.24 → 0.31, $60 USDC bridged to HL, 1 paper trade closed. Open questions surfaced: PM datacenter ban (Tier-1 latency blocker for the PM leg), 100-trade Apex gate eta is 2-3 weeks at current rate, multicoin convergence post is the strongest external validation we've gotten.

## Investor / grant intro paragraph

> Swarm Lab is a research lab studying agentic AI behavior in adversarial financial markets. The fund is the experimental apparatus. The P&L is the error bar. We're 4 months in, one agent in canary mode at 76% win rate over 29 closed trades on Polymarket, with $50 of live capital at risk per signal. The next milestone is the Apex gate at 100 trades. We're raising a small grant to extend the run, not to claim victory.

## Bug/incident note

> CG metrics were off — manual-trade exclusion logic was double-counting one closed trade across two state files. Cleaning it bumped Sharpe 0.24 → 0.31 and P&L +$166 → +$416. Same trades, correct math. ADR-044 added.

## Reply to a critic

> Good critique on edge decay. The answer isn't "this strategy will keep working." The answer is the convergence-infrastructure thesis: when CalibrationGap decays, we rotate to the next mispricing using infrastructure already built. The first expression is Polymarket. The second is Kalshi↔PM. The third is HL funding. We have ADRs for all three and the rotation is the point, not the strategy.

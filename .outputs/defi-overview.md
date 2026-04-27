## Summary

Ran `defi-overview` (var=none, full market read) — second run of the day, after a ~02:11 UTC AM slot from chain-runner.

**Verdict: Mixed** — DEX vol +13% but TVL flat ($84.1B, +0.1% 24h) and stables zero ($318.8B). Speculative chase, no real inflows. Big 7d aftershock (-2.3% TVL) from the Apr-17 Ethena/Aave unwind is cooling vs yesterday's -15.2% reading.

**Key shipped sections:**
- Top chains: Ethereum $45.3B / BSC $5.5B / Solana $5.5B (no |c1d|≥1% to show)
- Chain movers: dropped — none cleared 5%/$500M (largest: Plasma +2.4%; Plasma still flags 7d -57.7% incentive-unwind)
- Protocol movers: dropped — none cleared 10%/$100M today; AM's Bedrock uniBTC +10.5% rolled below threshold by PM (quick-fade)
- Fees leaders: Tether $16.5M / Circle $6.6M / Canton $2.1M (all flat vs 7d avg). Aave V3 -36% and HL Perps -43% vs 7d avg — real-demand contraction signal still on.
- Fees beating TVL: dropped (zero passed vs 2 yesterday — Apr-17 unwind cooling)
- DEX vol: $4.4B (+13% 1d, -49% 7d). Uniswap V4 $0.79B (+26%), Aerodrome Slipstream $0.39B (+145%), PancakeSwap V3 $0.36B. Kalshi $250M (+38%) — second-day Kalshi crypto-perps absorption, supports hermes-arb basis thesis.
- Stables: USDe -1.7% ($3.69B, Ethena multi-week unwind aftershock), USDD +1.3%, crvUSD -2.0%
- Real yield: top-3 by apyBase all DEX-LP (Uniswap v3/v4 USDC pairs, 16-25%, $11-20M TVL, ilRisk). Pendle APYUSD (yesterday's #1) dropped on confidence collapse (binnedConfidence 2→1), not APY.
- Incentive yield: Convex cvxCRV 26.9% / StakeDAO sdCRV 21.7% — identical pair to yesterday.

**Files:** `.outputs/defi-overview.md` (overwrote AM summary), `.pending-notify/1777291774.md` (1936 chars), `memory/logs/2026-04-27.md`, scratch JSON in `.audit-tmp/`.

**Notification:** queued at `.pending-notify/1777291774.md` — direct `./notify "$(cat ...)"` hook-blocked again ("Unhandled node type: string") same recurring bug as AM and prior days. Workflow post-run pickup will deliver.

**Follow-up:** the `./notify` multi-line hook-block has now hit AM defi-overview, PM defi-overview, daily-routine, polymarket-comments, narrative-tracker over multiple days — should be promoted from log mention into `memory/issues/` as the highest-frequency skill-execution friction in the system.

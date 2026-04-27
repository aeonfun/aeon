## Summary

Ran `defi-overview` for 2026-04-27, full market read (var=none).

**Verdict: Mixed** — TVL flat (+0.3% 24h, $85.5B), DEX volume bouncing +9% off weekend lows, stables idle. Real-demand contraction signal flagged: Aave V3 fees -60% / TVL -20% (7d) and Hyperliquid Perps fees -47% w/w.

**Sections shipped:**
- Top chains: Ethereum $46.1B / BSC $5.6B / Solana $5.6B
- Protocol movers: only ↑ Bedrock uniBTC +11% cleared the 10%/$100M gate; no chain cleared 5%/$500M (largest 1d Sui +2.6%); Plasma 7d -57% noted as no-confirmed-catalyst flag
- Fees leaders (24h): Tether $16.5M, Circle $6.6M, Canton $2.1M (-10%)
- DEX vol: $4.28B (+9.4% 1d); Uniswap V4 $640M, Pancake V3 $358M, Uniswap V3 $312M (+55%)
- Stables: $319B flat; only single-issuer 1d notable USDe -1.6% (7d -32%)
- Real yield top 3 by apyBase: USDC-CBBTC (UniV3, Base) 17.1%, APT (Amnis) 14.8%, APXUSD (Pendle) 14.4%
- Incentive yield: CVXCRV 25.9% via CRV ($33M), SDCRV 21.6% via CRV ($27M)

**Files:** `.outputs/defi-overview.md`, `.pending-notify/1777256294.md`, `memory/logs/2026-04-27.md`, plus `.gitignore` updates for scratch artifacts.

**Notification:** queued at `.pending-notify/1777256294.md` (1553 chars). Direct `./notify` invocation hook-blocked again (`Unhandled node type: file_redirect` and `Unhandled node type: string` for both `MSG=$(<file)` and `$(cat file)` forms — same recurring sandbox bug as 2026-04-26 daily-routine, polymarket-comments, narrative-tracker). Pending-file fallback used; workflow post-run delivery should pick it up.

**Follow-up:** the recurring `./notify` hook-block is now the most consistent skill-execution friction across daily skills. Worth promoting from log-only mention into `memory/issues/` so skill-repair targets it (the existing logs already capture every workaround attempted, so a one-line filing should suffice).

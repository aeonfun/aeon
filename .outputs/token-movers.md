Both CoinGecko endpoints returned HTTP 200; 213 coins passed the stablecoin/illiquidity filters. This is a same-day re-run — token-movers already ran twice earlier on 2026-05-19, so the artifact and a fresh log entry supersede the prior snapshots.

## Summary

Ran the `token-movers` skill for 2026-05-19.

- **Tape**: Mixed-to-soft — 66/100 top-100 green but median top-50 move only +0.4%; majors flat (BTC +0.6%, ETH +0.5%, SOL +0.7%), 7d still deep red (SOL -11.1%, BTC -5.0%).
- **Winners**: 9BIT [BREAKOUT] +20.4% leads; COMP, M, AKT, NEAR, LIT, HYPE [TRENDING+UP][MAJOR], INJ, XDC, ONDO [TRENDING+UP].
- **Losers**: BILL [CAPITULATION] -27.1% on $111M vol (third red day); LAB [CAPITULATION] -21.7%; UB, SKYAI, XP, TRAC, PIEVERSE, PYTH, ASTEROID, B.
- **Trending**: ZEST [PUMP-RISK][MICROCAP] +81% rank #862, ZANO, PENGU, HYPE, ZEC, RON [PUMP-RISK] +34%, ONDO.
- **Notable shift**: downside deepened vs earlier snapshots — BILL -24%→-27%, LAB newly in CAPITULATION.

**Files:**
- `.outputs/token-movers.md` — overwritten with the full internal report (replaced a stale `## Summary` blob, the ISS-005 format bug); no notification, per skill design.
- `memory/logs/2026-05-19.md` — appended the `### token-movers (re-run)` entry.

Two untracked temp files (`.cg_markets.json`, `.cg_trending.json`) remain in the working dir — sandbox blocked `rm` — but they won't be committed. No other follow-up needed.

The temp data files couldn't be removed (sandbox blocked `rm`), but they're untracked dotfiles and harmless.

## Summary

Re-ran the `token-movers` skill for 2026-05-19. Both CoinGecko endpoints returned HTTP 200; 183 coins passed the stablecoin/illiquidity filters. A `### token-movers` entry already existed in today's log, so this is an intraday re-run and the snapshot supersedes it.

- **Tape**: Mixed-to-soft — 64/100 top-100 coins green but median 24h move only +0.4%; majors flat (BTC -0.1%, ETH -0.7%, SOL +0.1%), 7d still broadly red. Breadth narrowed from 86/100 this morning — the alt bounce is fading.
- **Winners**: 9BIT [BREAKOUT] +20.4% leads on a thin tape; ZEC [TRENDING+UP][MAJOR] +7.7%; M, SIREN, COMP, AKT, NEAR, ALGO, ONDO, INJ fill out the list.
- **Losers**: BILL [CAPITULATION] -24.4% on $116M volume; TRAC -19.5% still unwinding the 05-18 pump; RIVER, UB, XP, ASTEROID, LAB, PIEVERSE, TEL, B.
- **Trending**: ZEST [PUMP-RISK][MICROCAP] +33.9% and RON [PUMP-RISK] +33.6% both flagged for manipulation risk (RON noted as likely catalyst-driven, established gaming chain).

**Files:**
- `.outputs/token-movers.md` — overwritten with the full internal report for chain consumers (`perps-brief`/`morning-macro`/`daily-ops-review`); no notification sent, per skill design.
- `memory/logs/2026-05-19.md` — appended the `### token-movers (re-run)` log entry.

No follow-up needed. Note: two temp files (`.tmp-markets.json`, `.tmp-trending.json`) remain in the working dir — sandbox blocked `rm` — but they're untracked dotfiles and won't be committed.

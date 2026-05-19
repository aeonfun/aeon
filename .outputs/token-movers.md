Token-movers skill complete for 2026-05-19.

## Summary

Ran the `token-movers` skill. Both CoinGecko endpoints returned HTTP 200; 183 coins passed the stablecoin/illiquidity filters.

- **Tape**: Broad alt bounce — 86/100 top-100 coins green (median 24h +1.0%), but BTC (+0.3%) and ETH (+0.9%) flat and the 7d tape still red (BTC -4.8%, SOL -11.1%). DeFi/L1 names led.
- **Winners**: 9BIT +24.3% `[BREAKOUT]` (thin $10.9M vol — flagged fade risk); ONDO `[TRENDING+UP]` +12.9% on $294M vol; ZEC `[MAJOR]` +6.5%.
- **Losers**: BILL -18.5% and TRAC -18.0%, both `[CAPITULATION]`. TRAC fully round-tripped 2026-05-18's +35.8% pump.
- **De-noised**: Dropped CFG and BSB from winners (BSB now a 3rd-day repeat, decelerated to +6.7%); dropped XP and ASTEROID from losers (multi-day repeats, no new tag).

**Files:**
- `.outputs/token-movers.md` — full internal report for chain consumers (`perps-brief`/`morning-macro`/`daily-ops-review`); no notification sent, per skill design.
- `memory/logs/2026-05-19.md` — created with the `### token-movers` log entry.

No follow-up needed. Three untracked temp files (`proc_tmp.py`, `markets.json`, `trending.json`) remain in the working dir — the sandbox blocked `rm`, but they're harmless and won't be committed.

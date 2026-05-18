The token-movers skill ran successfully. Both CoinGecko endpoints returned HTTP 200; 197 coins passed the stablecoin/wrapped/illiquidity filters.

## Summary

Ran the `token-movers` skill for 2026-05-18.

- **Data**: Fetched CoinGecko top-250 markets + trending. Filtered out stablecoins, wrapped/staked dupes, and sub-$1M-volume coins (250 → 197).
- **Tape**: Broad risk-off — only 20/100 top coins green, median 24h −2.5%; BTC −2.2%, ETH −4.1%, BCH −11.2%.
- **Winners**: TRAC led at +35.8% — tagged `[BREAKOUT][PUMP-RISK]` (sustained move but rank #182, though $35.8M volume is genuine). BSB `[BREAKOUT]` still extending.
- **Losers**: XP, yesterday's #1 winner, reversed to −15.5% (post-pump fade); BCH `[MAJOR]` was the worst large-cap drop.
- **De-noised**: Dropped BILL from the winners list — it repeated yesterday's direction and magnitude (+6.4% → +8.2%) with no new tag; promoted DEXE to #10.

Files modified:
- `.outputs/token-movers.md` — full report (internal artifact for `perps-brief` / `morning-macro` / `daily-ops-review` chain consumers; no notification sent, per skill design)
- `memory/logs/2026-05-18.md` — appended `### token-movers` log entry

No follow-up actions needed. Temp working files remain in untracked `.cache/` (sandbox blocked their removal; harmless, not committed).

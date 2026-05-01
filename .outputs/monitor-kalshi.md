*Kalshi monitor — 2026-05-01*
verdict: all quiet — watchlist empty (NO_CONFIG); 11 events discovered, 5 monitored; no moves worth flagging (all vol < $1k/day, candlesticks unavailable)

NO_CONFIG: watchlist is empty. Add event tickers to skills/monitor-kalshi/watchlist.md to enable regular monitoring. Suggested series: KXFED (Fed rate decisions), KXNEXTISRAELPM (Israel PM).

**Federal Funds Rate — Apr 2027 FOMC** (KXFED-27APR) — Economics
| Market | prob | Δ24h | vol | spread |
|--------|------|------|-----|--------|
| >3.50% | 45% | n/a | $230 | 2pp |
| >3.25% | 45% | n/a | $198 | 2pp |
| >4.00% | 35% | n/a | $105 | 4pp |
mover: T3.50 — 511 contracts (~$230), tight book (2pp); market pricing 55% chance rate stays ≤3.50% by Apr 2027 (implied ~1-2 cuts from current ~4.25-4.50%)

**Next PM of Israel** (KXNEXTISRAELPM-45JAN01) — Elections
| Market | prob | Δ24h | vol | spread |
|--------|------|------|-----|--------|
| Bennett (NBEN) | 51% | n/a | $85 | 2pp |
| Lieberman (ALIE) | 9% | n/a | $127 | 8pp |
| Sa'ar (GEIS) | 17% | n/a | $9 | n/a |
mover: ALIE — 1,351 contracts on $0.09 YES, but spread 8pp (thin book, skeptical pricing)

**Next Pope** (KXNEWPOPE-70) — Elections
| Market | prob | Δ24h | vol | spread |
|--------|------|------|-----|--------|
| Zuppi | 4% | n/a | $4 | wide |
| Tagle | 7% | n/a | $5 | wide |
Total event vol: ~$12 — noise floor only

**ALERTS** (moved >5pp on non-thin book)
none

**Trending (not tracked)**
Full event universe is 11 events — all long-horizon speculative markets. Near-term liquid series (KXFED, KXBTC, KXCPI) exist but are not surfaced as events; they require direct series tickers in watchlist.

sources: events=ok candlesticks=fail (SRC=price_only all markets) orderbook=ok

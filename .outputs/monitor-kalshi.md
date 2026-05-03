Kalshi monitor — 2026-05-03
verdict: all quiet — watchlist empty; 0 of 13 market groups pass the $1k USD vol gate; KXBTC 10 AM session zero-volume; KXFED daily flow tops out at $67 USD.

**KXFED-27APR** (KXFED) — Economics, Apr 2027 Fed rate curve
| Market | prob | vol_24h | spread |
|--------|------|---------|--------|
| T4.00 | 41% | ~$67 | 1pp tight |
| T4.25 | 40% | ~$29 | 18pp thin |
| T3.75 | 51% | ~$35 | 7pp loose |
| T3.50 | 41% | ~$37 | 1pp tight |
mover: T4.00 — highest 24h flow; market implies ~59% prob of ≥1 cut to ≤4.00% by Apr 2027. All vol below $1k gate. Monotonicity violation (T4.00=41% < T3.75=51%) reflects stale book, not real rate structure. No chg_pp available (candlesticks fail).

**KXBTC-26MAY0310** (KXBTC) — Crypto, 10 AM EDT session
All 52 markets: vol_24h=0. ATM implied ~$78k–$80k (B78250 ask=4¢ vs $82k+ buckets at 1¢). 5 PM EDT session (KXBTC-26MAY0317) not yet created. Hermes-arb day-4 falsifier: no morning convergence signal. Compare: yesterday B78125 +8pp / B78375 +10pp (both finalized, settlement $78,452.97).

**KXNEWPOPE-70** (KXNEWPOPE) — Elections
Parolin 8%, Tagle 5%, Pizzaballa/Zuppi 4%. Vol <$25 USD/day. No chg_pp computable.

**ALERTS** (>5pp, non-thin book)
none

**Trending (not tracked)**
- KXBTC-26MAY03: daily BTC range markets; primary Hermes-arb falsifier-window signal source
- KXFED-27APR: Fed rate curve Apr 2027; top USD flow on Kalshi today at ~$67

MONITOR_KALSHI_NO_CONFIG — watchlist empty. Add series tickers to skills/monitor-kalshi/watchlist.md (e.g. KXBTC, KXFED, KXCPI).

sources: events=ok candlesticks=fail (batch 400, same as 05-01) orderbook=ok-but-empty (B78000 no resting orders)


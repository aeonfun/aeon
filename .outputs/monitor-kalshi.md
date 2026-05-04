*Kalshi monitor — 2026-05-04*
verdict: all quiet — watchlist empty; 3 events discovered; no market clears $1k USD vol gate; BTC implied spot $78.75–79k

**KXBTC-26MAY0417** (BTC price today at 5pm EDT) — Crypto [closes in hours]
| Market | prob | vol_24h | spread |
|--------|------|---------|--------|
| $78,750–$78,999 (B78875) | 13% | ~$144 | 2pp |
| $79,250–$79,499 (B79375) | 12% | ~$183 | 4pp |
| $78,500–$78,749 (B78625) | 12% | ~$134 | 3pp |
mover: B78875 — implied spot consistent with yesterday's $78,604 print; Hermes-arb falsifier day-5

**KXBTC-26MAY0817** (BTC price May 8 at 5pm EDT) — Crypto
| Market | prob | vol_24h | spread |
|--------|------|---------|--------|
| $79,000–$79,499 (B79250) | 5% | ~$209 | 3pp |
| $77,500–$77,999 (B77750) | 6% | ~$173 | 1pp |
| $77,000–$77,499 (B77250) | 7% | ~$163 | 2pp |
mover: B79250 — highest 24h count; slight upward drift vs today; event aggregate ~$1.4k across 40 buckets
note: B78250 has 5,434 OI (historical) and B79250 has 4,634 OI — large pre-existing positions

**KXFED-27APR** (Fed funds rate after Apr 2027 FOMC) — Economics
| Market | prob | vol_24h | spread |
|--------|------|---------|--------|
| >4.25% | 8% | ~$22 | wide |
| >4.00% | 35% | ~$14 | wide |
| >3.75% | 46% | ~$27 | wide |
rate curve: 54% prob below 3.50% by Apr 2027; ~80% prob 2+ cuts from current 4.25–4.50%; Warsh cut thesis priced in ahead of May 15 Powell departure

**ALERTS** (>5pp on non-thin book): none

**Trending (not tracked)**
- KXBTC-26MAY0817 — ~$1.4k aggregate 24h vol; add for Hermes-arb BTC context; watchlist starters: KXBTC-26MAY0817, KXFED-27APR
- KXFED-26MAY — 404 (May 6-7 FOMC market not found; rate decision 3 days out, no near-term rate market active)

Setup: add tickers to skills/monitor-kalshi/watchlist.md (one per line)

sources: events=ok candlesticks=skip orderbook=skip SRC=price_only (batch 400)
Status: MONITOR_KALSHI_NO_CONFIG

# $NOTE — 2026-10-23

**Verdict:** BREAKDOWN — −10.5% on 3.2× volume; sellers pushed it to $0.0349, then the bid reclaimed $0.041.

## 24h at a glance

| Metric | Now | 24h Δ | vs 7d avg |
|--------|-----|-------|-----------|
| Price | $0.04103 | −10.5% | — |
| Liquidity | $406.8K | +1.1%\* | — |
| Volume (24h) | $568.5K | — | 3.2× |
| Buys / Sells | 1,523 / 1,777 | ratio 0.857 (prev 0.842) | — |
| Whale trades (≥$1k) | 2 (2h window) | — | — |
| FDV | $2.46M | — | — |

## Trend
- **7d:** −30.3% (rolling over — the $0.058 shelf broke on 10-22 and has not been reclaimed)
- **30d:** −64.4% (persistent distribution from the $0.115 level)

## What changed

The 24h tape is a dump that was absorbed, not a freefall. Sellers took the pool to **$0.0349** in the 09:00Z hour on **$54.8K** of volume — the single heaviest hour of the last 48 — and price closed that same hour back at $0.0404, **+17.5% off the low**. That round trip is the story: the bid at $0.035 held.

Volume is running **3.2× the 7-day mean** ($568.5K vs $178.2K), and liquidity actually rose **+1.1%** to $406.8K while price fell 10.5% — the pool is being replenished as it is sold into, which is the opposite of a liquidity vacuum. Buy/sell count is 1,523/1,777 (0.857) against 0.842 at the 10:35Z reading: the sell skew narrowed slightly, it did not widen.

\*Liquidity baseline is the 10-22 21:05Z reading ($402,288) — the only same-pool figure in the last 24h of logs; no stored `TOKEN_REPORT_STATE` line exists yet, so this is a day-over-day proxy, not a measured 24h delta.

Whale prints in the available 2h trade window: `buy $1.9K @ $0.0407 · 12:01Z` (`0xffe8a4c3`) and `sell $1.0K @ $0.0394 · 11:07Z` (`0xa1d8dec9`). No single print dominates — consistent with the split-order relay pattern, and no print was flagged anomalous by GeckoTerminal.

## Context

This is the same supply that the 10:00Z unlock released. **290,000 NOTE ≈ $11.9K** sits armed across three fresh wallets (`0x3a9039c7` 150K, `0x572bb527` 90K, `0xe4bf6f7e` 50K), and the owner EOA still holds **930,000 ≈ $38.2K** against a 24h pool volume of $568.5K. The armed 290K alone is **2.1%** of one day's NOTE volume (13.86M NOTE). The $0.035 floor is the level that matters — one prior test, held.

---

*Chart: https://www.geckoterminal.com/robinhood/pools/0x378b102395b2c4f9a9ebe650b5b501d0810c60126f886107d8812ca7ff7f9f91*
*Contract: 0xc4f730335Fb9e439ca5552f7b52B8E638c4245B0 | Chain: robinhood (4663)*
*Sources: gt=ok · ds=ok · xai=skip · treasury=skip*

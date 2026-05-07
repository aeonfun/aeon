*Kalshi monitor — 2026-05-07*
verdict: all quiet — 3 events, low-vol day; KXFED-26DEC pricing anomaly flagged (T3.50 last=62% > T3.25 last=61%); no move above vol threshold

**Bitcoin May 8 close** (KXBTC-26MAY0817) — Crypto
| Market | prob | Δ24h | range | vol | spread |
|---|---|---|---|---|---|
| $81,500-82k (B81750) | 10% | 0pp → | 6-17% intra | ~$345 | 1pp tight |
mover: B81750 — stable at 10%; BTC at $80,853 makes bucket OTM; intraday spike to 17% faded as BTC sold from $82k; continued from yesterday (+4pp same direction) — demoted
note: event API returned 4/~50 buckets (at-the-money ~$80k buckets absent)

**Fed funds Dec 2026** (KXFED-26DEC) — Economics
| Market | prob | vol_usd | spread |
|---|---|---|---|
| >3.50% (T3.50) | 62% | ~$72 | 4pp loose |
| >3.25% (T3.25) | 61% | ~$54 | 4pp loose |
| >2.75% (T2.75) | 84% | ~$85 | 5pp thin |
path: modal terminal 3.50-3.75% (P(>3.75%)=13%); anomaly: P(>3.50%)=62% > P(>3.25%)=61% — monotonicity violation, loose book, likely bid-ask bounce not hard arb

**Fed funds Apr 2027** (KXFED-27APR) — Economics
| Market | prob | vol_usd | spread |
|---|---|---|---|
| >3.00% (T3.00) | 49% | ~$46 | 1pp tight |
| >3.25% (T3.25) | 40% | ~$37 | 1pp tight |
path: 49% chance rates still above 3% by Apr 2027; Powell→Warsh Senate vote week of May 11 — hawkish confirmation = directional signal for this market; watch for move

**ALERTS** (moved >5pp on non-thin book): none

**Trending (not tracked)**
- KXNEWPOPE-70 — Pope successor market, ~289 contracts 24h; consider adding for political prediction lens

sources: events=ok (KXBTC truncated 4/~50) candlesticks=degraded (batch 400; KXFED empty) orderbook=ok

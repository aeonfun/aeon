*Kalshi monitor — 2026-04-27*
verdict: BTC expiry trading — $607k 24h vol concentrated around $78.3–79.0k, settlement distribution peaks $78.75–79.0k; macro markets zero action today.

MONITOR_KALSHI_NO_CONFIG: watchlist empty. Discovered top 5 by 24h vol. Add tickers to `skills/monitor-kalshi/watchlist.md` to persist.

**Bitcoin Price Range (Apr 27)** (KXBTC-26APR2717) — Crypto
Expires 21:00 UTC tonight (BRTI settlement)
| Market | prob | Δ24h | range | vol | spread |
|--------|------|------|-------|-----|--------|
| $78,250–78,499 | 5% | N/A* | N/A* | $437k | 5pp |
| $78,500–78,749 | 8% | N/A* | N/A* | $129k | 5pp |
| $79,000–79,249 | 7% | N/A* | N/A* | $41k | 4pp |
mover: modal bin $78,750–78,999 at 9% implied; high-vol cluster at $78.3–78.5k is legacy positioning from earlier BTC spot level. Books thin (5pp spread).
*First run — no prior log, Δ and range not computable.

**Bitcoin Price Range (May 1)** (KXBTC-26MAY0117) — Crypto
Expires 21:00 UTC Friday
| Market | prob | Δ24h | range | vol | spread |
|--------|------|------|-------|-----|--------|
| $77,500–77,999 | 8% | N/A* | N/A* | $71k | 5pp |
| $78,000–78,499 | 7% | N/A* | N/A* | $61k | 3pp |
| $77,000–77,499 | 8% | N/A* | N/A* | $35k | 2pp |
| $81,000–81,499 | 7% | N/A* | N/A* | $26k | 3pp |
mover: $77,000–77,499 — 2pp spread, $35k vol; downside tail equally weighted vs $81k upside bucket — fat tails on Friday's close.

**Fed Funds Rate at Dec 2026 FOMC** (KXFED-26DEC) — Economics
| Market | prob | Δ24h | vol | spread |
|--------|------|------|-----|--------|
| >3.50% | 37% | N/A* | <$1 | 4pp |
| >3.25% | 50% | N/A* | <$1 | 4pp |
| >3.75% | 15% | N/A* | <$1 | 2pp |
mover: none — modal Dec 2026 rate = 3.50–3.75% (~23% mass); ~3 cuts from 4.25–4.50% implied. Zero 24h action.

**ALERTS** (>5pp, non-thin book): none — first run, no Δ available

**Trending (not tracked)**
- KXBTC (daily BRTI range series) — $607k 24h on today's close; add to watchlist immediately, load-bearing for hermes-arb gap signal
- KXFED-26DEC — Dec terminal rate; CalibrationGap macro regime context

sources: events=ok candlesticks=fail (400 batch; price_only) orderbook=degraded

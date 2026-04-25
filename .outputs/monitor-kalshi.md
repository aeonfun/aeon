*Kalshi monitor — 2026-04-25*
verdict: all quiet — watchlist empty; 5 events discovered, all under $1k 24h vol, no price moves computable (candlestick API degraded)

MONITOR_KALSHI_NO_CONFIG: watchlist at skills/monitor-kalshi/watchlist.md is empty. Add event tickers (one per line) to track specific markets. Near-term examples: KXBTC-26MAY0117, KXFED-26JUN, KXINFLATION-26MAR.

*Trending discovered events (not tracked)*

*1. Bitcoin price range Apr 25* (KXBTC-26APR2517) — Crypto
Expires today 21:00 UTC. Most active bucket: $77,250–77,499.99.
| Market | prob | vol 24h | spread |
| $77,250–77,499 | 15% | $789 | 2pp loose |
| $76,750–76,999 | 7% | $22 | 4pp loose |
| $80,000–80,249 | 1% | $3 | n/a |
note: cluster at $77.3k implies spot BTC near that level at 5pm EDT. No prior log; no intraday move computable.

*2. Xi Jinping successor* (KXXISUCCESSOR-45JAN01) — Elections
| Candidate | prob | vol 24h | spread |
| Ding Xuexiang | 24% | $41 | 3pp loose |
| Others (<18%) | — | $0 | — |

*3. Mars vs California high-speed rail* (KXMARSVRAIL-50) — Science
Mars wins: 26% implied — $40 24h vol, 3pp loose

*4. Next Pope* (KXNEWPOPE-70) — Elections
| Candidate | prob | vol 24h | spread |
| Pietro Parolin | 5% | $10 | 3.4pp loose |
| Luis Tagle | 5% | $4 | 2pp loose |
| Pizzaballa | 4% | $2 | 3pp loose |
Active conclave market; all candidates below 6%, thin books throughout.

*5. Elon Musk visits Mars before 2099* (KXELONMARS-99) — World
8% implied — $8 24h vol, 2pp loose

*API note:* Public events endpoint returned 11 events (all long-dated). Short-term economic markets (Fed, CPI, jobs) require specific series tickers — add them to the watchlist to track.

sources: events=ok candlesticks=fail orderbook=fail

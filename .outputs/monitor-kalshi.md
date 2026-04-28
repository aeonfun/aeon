## Summary

**Status: MONITOR_KALSHI_NO_CONFIG → ran in discovery mode**

Watchlist is empty. Fetched the 5 highest-volume events via series-level API calls. Key findings:

**KXBTC-26MAY0117** (Bitcoin range, May 1 5pm EDT)
- BTC implied median ~$77k. Yesterday's flow was into the $79-82k range (spot $79,142); today's peak vol is at the $77,500-78k bucket — distribution shifted ~$2k downward on +167% volume day-over-day.
- Directly relevant to hermes-arb Kalshi-BRTI basis recorder (perps launched yesterday).

**KXETH-26MAY0117**: ETH modal at $2,240-$2,280.

**KXFED-27APR / KXFED-27MAR**: T4.00 at 57% probability → 2-3 cuts priced by Apr 2027. Wide spread on T4.25 (19pp, thin conviction).

**KXNEXTISRAELPM-45JAN01**: 247 contracts 24h, Bennett 50% from yesterday.

**Sources:** events=degraded (public endpoint returns only long-dated novelty markets; all real data fetched via series tickers), candlesticks=fail, orderbook=degraded. All markets marked `SRC=price_only`.

**Notification** queued to `.pending-notify/monitor-kalshi-2026-04-28.md` (the `./notify` multi-line hook-block is a known 5-day bug).

**Recommended watchlist additions** for daily tracking: `KXBTC-26MAY0117`, `KXETH-26MAY0117`, `KXFED-27APR`, `KXNEXTISRAELPM-45JAN01` — add one per line to `skills/monitor-kalshi/watchlist.md`.

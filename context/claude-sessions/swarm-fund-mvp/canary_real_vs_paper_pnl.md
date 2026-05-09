---
name: Canary HL-leg only — dashboard PnL is simulated PM payouts, not collected
description: The "$343 lifetime / $23 today" numbers on calibration-gap-v1 are simulated Polymarket payouts; only ~$0.41 real PnL has changed hands on the HL hedge leg
type: project
originSessionId: 5614bde3-9146-405c-a45a-2923192ce24c
---
Real-money state of the fund (verified 2026-04-27 via direct Hyperliquid `userFills` API call for wallet `0x83F4c49cF459cAbEDE08228FC471Ab89D0B189e3`):

- **4 HL fills ever** since wallet was wired (first fill 2026-04-21 18:50 UTC, last close 2026-04-27 19:24 UTC). Total real cash PnL: **~+$0.41** on a $5 wallet over 6 days.
- Wallet balance currently: **$5.45**, flat (0 open positions).
- Of the 32 trades on `data/agents/calibration-gap-v1.json`: **30 are `is_paper: true`** (no real execution), **2 are `is_paper: false` with `hl_order_id` set** — those are the only trades backed by actual HL fills.
- The **Polymarket leg is always paper** — IP is US-geoblocked (`/api/geoblock` returned `{blocked:true, country:"US"}` on 2026-04-26) and L2 HMAC isn't implemented. So `trade.realized_pnl` records the *simulated* PM payout, not money actually received. `poly_order_id` field doesn't exist in the trade schema — PM orders are never posted.

**Why:** the strategy is delta-hedge alpha — bet on Polymarket binary, hedge on Hyperliquid perp. Right now we only have the hedge half. The alpha half (PM bet) is logged as a counterfactual signal but never executed. So `fitness.total_pnl: 343.64`, `fitness.composite: 0.55`, and the dashboard's "lifetime +$343 / today +$23" numbers are **signal-quality measurements, not income**.

**How to apply:** when reporting fund performance, separate three buckets:
1. **Real cash that moved** — HL `closedPnl` from `userFills` API (~$0.41 lifetime), wallet balance ($5.45)
2. **Simulated PM payouts** — `trade.realized_pnl`, `fitness.total_pnl` ($343 lifetime)
3. **Combined "what-if" performance** — what the strategy would have made if PM were live

Never say "the fund is up $X" without specifying which bucket. The PM compliance gate (see [polymarket_compliance_gate.md](polymarket_compliance_gate.md)) is the unblock for converting bucket 2 into bucket 1.

The "canary" label is technically accurate (real HL key, real HL fills, KeepAlive launchd, $5 cap) but routinely misread as "live trading at scale." Both are true: it IS placing real HL orders, AND those orders have moved less than a dollar of real PnL across the whole wallet's existence.

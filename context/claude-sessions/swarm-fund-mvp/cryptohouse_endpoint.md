---
name: CryptoHouse public ClickHouse endpoint
description: Free anonymous SQL endpoint at crypto-clickhouse.clickhouse.com for on-chain data + dedicated polymarket database — useful for historical research only because Polymarket data lags ~3.7 months
type: reference
originSessionId: 5c90f531-6abc-4aba-9ecf-ab55d33645ee
---
**Endpoint:** `https://crypto-clickhouse.clickhouse.com` (HTTP) or `clickhouse client --host crypto-clickhouse.clickhouse.com --secure --user crypto --password ''`. Free, anonymous. Quotas: 10B rows/query, 60s/query, 60 q/user/hour.

**Databases (verified 2026-04-27):**
- `polymarket` — full Polymarket schema: `orders_filled` (257.6M rows wallet-resolved, 2022-11 → **2026-01-05 only, ~3.7mo stale**), `user_positions`, `user_balances`, `assets` (217k markets, joinable by `event_slug`), `market_open_interest`, `slugs`, `token_id_condition`, `block_times`. ALWAYS filter `is_deleted = 0`.
- `base`, `ethereum` — real-time raw chain (`blocks`, `transactions`, `logs`, `traces`); latest block tracks current ✅
- `solana` — raw + many daily MVs; raw scans hit the 10B row limit, must use tight window filters or the pre-aggregated `*_by_day_mv` views
- Hyperliquid not indexed (its own L1)

**Polymarket fill schema:** `timestamp`, `transaction_hash`, `order_hash`, `maker`, `taker`, `maker_asset_id`, `taker_asset_id`, `maker_amount_filled`, `taker_amount_filled`, `fee`, `block_number`, `is_deleted`. All Decimal(76,18). `event_slug` in `assets` is the bridge to our PM REST scrape.

**Verdict (Phase 0, 2026-04-27):** *Defer*. Live use blocked by Polymarket staleness; HL not present; raw Base/Ethereum need decoding for any derived signal. Re-probe staleness 2026-05-15 — if Goldsky catches up, revisit thin Python client + Chainlink replay (ADR-073) + on-chain factor seed. Full memo: `outputs/research/cryptohouse_phase0_verification.md`. TASKS.md "Research backlog" tracks the re-probe.

**Reproduction:**
```bash
curl -sS --max-time 15 "https://crypto-clickhouse.clickhouse.com/?user=crypto" \
  --data-binary "SELECT max(timestamp) FROM polymarket.orders_filled WHERE is_deleted = 0"
```

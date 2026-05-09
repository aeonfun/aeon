# Dev Environment

## Python
- Venv at `.venv/`, run with `.venv/bin/python`
- `uv` at `/opt/homebrew/bin/uv`
- Key packages: httpx, numpy, polars, vectorbt

## Docker Stack
- Compose: `/usr/local/cli-plugins/docker-compose` (NOT `docker compose`)
- RedPanda: :9092
- QuestDB: :9000
- ClickHouse: :9001
- Console: :8080

## Database Tables
- QuestDB: market_prices, scanner_opportunities, executor_orders, accountant_snapshots, system_health
- ClickHouse: swarm.raw_payloads, swarm.trade_fills

## Becker Dataset
- Source: github.com/Jon-Becker/prediction-market-analysis
- Already extracted at: `tools/prediction-market-analysis-main/data/polymarket/` (50GB, DO NOT re-download)
- Format: Parquet files
- Key columns (trades): block_number, maker, taker, maker_asset_id, taker_asset_id, maker_amount, taker_amount, fee
- Key columns (markets): id, condition_id, question, outcomes, outcome_prices, volume, end_date, closed
- Prices are decimals 0-1, amounts have 6 decimal places (USDC)

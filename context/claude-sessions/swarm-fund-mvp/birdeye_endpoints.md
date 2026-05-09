---
name: Birdeye endpoint routing
description: Which Birdeye endpoint to use for each data need in swarm-fund pipelines
type: reference
---

## Endpoint → Use case map

| Need | Endpoint | How used |
|------|----------|----------|
| Current RWA token price | `GET /defi/price` | `birdeye_rest.py` poll every 60s → `prices.dex` topic |
| OHLCV history (backtester cold-start) | `GET /defi/v3/ohlcv` | One-time backfill when Lane 2 autoresearch starts; feeds QuestDB `prices_dex` |
| Smart money accumulation | `GET /smart-money/v1/token/list` | Agent-native MCP query for new opportunity scouting; not stored |
| Token security / risk | `GET /defi/token_security` | One-off diligence before adding new RWA token to pipeline |
| Holder distribution | `GET /holder/v1/distribution` | Counterparty research; on-demand only |
| Trending tokens | `GET /defi/token_trending` | Opportunity discovery; MCP query, not stored |

## Pricing decision (2026-03-31)
- **Current plan: Lite ($39/mo)** — sufficient for 3 RWA tokens at 60s poll (~130k calls/mo vs 1.5M CU limit)
- **Upgrade trigger → Starter ($99):** when Lane 2 backtester needs OHLCV backfill (high burst CU usage)
- **Upgrade trigger → Premium Plus ($250):** if researcher strategy needs sub-minute DEX spread signals (WebSocket)

## Assets tracked via Birdeye
- USDY — Ondo Finance (Solana): `A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6`
- bIB01 — Backed Finance: address TBD (verify at birdeye.so before go-live)
- dSPY — Dinari: address TBD (verify at birdeye.so before go-live)

## API integration notes
- Auth header must be `x-api-key` (lowercase) — `X-API-KEY` returns 400 silently (no auth error, just bad request)
- 400 "Compute units usage limit exceeded" means valid key but plan exhausted — not a code bug
- `x-chain: solana` header required alongside `x-api-key` for all Solana token endpoints

## MCP vs REST pipeline split
- **MCP** (`birdeye-mcp` server): agent-native queries in Claude sessions — research, diligence, opportunity scan
- **REST pipeline** (`birdeye_rest.py`): unattended background writes to RedPanda → QuestDB — price feed, OHLCV backfill

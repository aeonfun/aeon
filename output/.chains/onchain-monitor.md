No trigger hit, so per the skill's end-state rules this run stays silent (no push). Here's the substance.

## On-Chain Monitor — 2026-10-21

**Window:** blocks 52847202 → 52890402 (43,200 blocks ≈ 24h, Base)
**Result:** `ON_CHAIN_OK` — 2 watches, 31 raw events, 0 above threshold. No notification sent.

### Source status
| Source | Status | Reason |
|---|---|---|
| Alchemy | ✗ | `ALCHEMY_API_KEY` unset |
| Etherscan v2 | ✗ | free tier refuses `chainid=8453` keyless |
| Base public RPC | ✓ | `base.gateway.tenderly.co`, 1000-block windows |
| CoinGecko | ✓ | |

Fallback chain burned through six public RPCs before Tenderly answered: `mainnet.base.org` (429 on `eth_getLogs`), `drpc` (10k-block cap, then 403), `publicnode` (archive token required), `1rpc` (50-block cap), `meowrpc` (method unsupported), `blockpi` (apikey), Blockscout (Cloudflare 403).

### DEUS escrow — net inflow, not outflow
The 24h scan is fully reconciled by stake/unstake pairs — every DEUS movement touches an xDEUS mint or burn:

- **In 66,150.23 DEUS** ($1,183) across 6 stake events
- **Out 43,512.49 DEUS** ($778) across 4 unstake events
- **Net +22,637.74 DEUS** ($+405) → **+0.077%** of the escrow

Balance now **29,362,657.94 DEUS** (3.35% of 876,222,316 supply) ≈ **$525,040** at $0.01774453.

Unstake outflow was **0.148% of escrow in 24h** — the intelligence trigger is >5%/day, so roughly **34× below** the level that would justify digging into counterparties. Largest single move was an 18,512.68 DEUS unstake (tx `0xf53703b6e7de`); median event was $179, max $447. Nothing reached the $500 threshold.

The four unstake txs, in order: `0xf53703b6e7de` (18,512.68), `0x515990460081` (7,560.00), `0x7b68a4e17c0a` (5,020.00), `0x416ef7135447` (12,419.81).

### Price vs. your preset levels
DEUS $0.01774453 — 24h **+1.13%**, 1h **−0.02%**, 24h range $0.017529–$0.017976, largest 5-min move **+0.72%**. No 20% move in either direction.

- $0.025 (sell spot) → **+40.9%** away
- $0.032 (sell spot) → **+80.3%** away
- $0.012 (panic watch) → **−32.4%** away
- $0.041 (start unstake) → **+131.1%** away

### One config finding worth your attention
**xDEUS is an ERC-721, not an ERC-20.** `decimals()` reverts and its `Transfer` event carries the `tokenId` in `topics[3]`. Two consequences:

1. The watch's `threshold_usd: 250` is inert — NFTs have no USD value, so per the skill's own filter those events are logged but **never** alertable at any size.
2. That is a blind spot for exactly the signal you care most about. In this window there were **4 unstakes** (including the 18.5k DEUS one) and **6 new stakes**, and none of them could ever have produced a push through this watch.

The DEUS escrow watch does catch the ERC-20 side of an unstake with a working USD threshold, so you're not fully blind — but if you want xDEUS mints/burns to alert on their own (say, any burn > 5,000 DEUS, or any burn while price is above $0.041), that threshold needs to be event-shaped, not USD-shaped. Say the word and I'll add a `min_token_amount` field to the watch schema.

Also: xDEUS supply is 1,711 NFTs, escrow holds 57. `ALCHEMY_API_KEY` would restore decoded categorized transfers plus native-ETH visibility; the current path sees ERC-20/ERC-721 logs only.

## Summary

- Ran `onchain-monitor` over a 24h Base window for both watches; zero events cleared threshold, no trigger crossed, so no push was sent per strategy.
- **Files modified:** `memory/on-chain-state.json` (created — per-watch `last_block` 52890402, `median_usd_30d` 179, source notes), `memory/logs/2026-10-21.md` (appended `### onchain-monitor` with every decoded event and drop reason).
- **Files created:** `output/scan.py`, `output/analyze.py`, `output/final.py`, `output/fetch_logs.py` (fetch/decode artifacts).
- **No change to `memory/on-chain-watches.yml`** — flagged the ERC-721 threshold issue instead of editing your config unilaterally.
- **Follow-ups for you:** (1) decide whether xDEUS mints/burns should alert on token amount rather than USD; (2) set `ALCHEMY_API_KEY` to restore native-ETH and categorized transfer coverage on Base; (3) `price-alert` is enabled hourly with your four levels and covers the price-side triggers independently, so the unstake-detection gap above is the one real exposure.

---
name: LAWB Pool Monitor
description: Watch LawbFishing prize pool health on Base mainnet — alert on rapid drain, depletion, or accounting anomalies
var: ""
tags: [crypto, lawbworld]
---

> **${var}** — Force a notification this run regardless of thresholds (use for manual checks). Empty = normal threshold-gated behaviour.

LawbFishing is the on-chain economy backing the LAWBFISH arcade on Base mainnet (chain 8453). This skill watches its prize pool and accounting health, alerting only when something needs operator attention. The pool is funded by the owner (`fundPool`) and refilled automatically by player purchases (`buy()` routes revenue to `prizePool` post-2026-05-23 upgrade). Burn comes from on-chain `redeemCatch` calls.

## Contract

```
proxy:  0x48b2db9E89542Baa217bf8dc6269164b7887fE57
chain:  Base mainnet (8453)
rpc:    https://mainnet.base.org   # use Etherscan v2 as fallback
explorer: https://basescan.org
```

Selectors (read-only, no args):

| Function | Selector | Returns |
|---|---|---|
| `prizePool()` | `0x719ce73e` | uint256 (LAWB wei) |
| `shopVault()` | `0x29c2aa0a` | uint256 (LAWB wei) — should stay 0 post-upgrade |
| `paused()` | `0x5c975abb` | bool |
| `MIN_PRICE()` | `0xad9f20a6` | uint256 (currently 5_000e18) |

`Redeemed(address indexed user, uint256 amount, bytes32 nonce)` event topic0:
```
0x3be2edea458ae9d9dd885a96aa23c988b15277ec0f613d273e6fcc4a27e610ff
```

(Selectors verified via `keccak256("<sig>")[:4]` against contract ABI on 2026-05-23. Re-verify with the same recipe if the contract is re-deployed.)

## State

`memory/lawb-pool-monitor-state.json` — persisted atomically after each successful run:

```json
{
  "last_block": 46361832,
  "last_pool_wei": "215150000000000000000000000",
  "last_run": "2026-05-23T07:00:00Z",
  "alerted_conditions": {
    "low_pool": null,
    "shop_vault_nonzero": null,
    "paused": null,
    "high_burn": "2026-05-23T05:00:00Z"
  },
  "burn_window_24h": [
    { "ts": "2026-05-23T05:00:00Z", "pool_wei": "..." },
    { "ts": "2026-05-23T06:00:00Z", "pool_wei": "..." }
  ]
}
```

- `last_block` — start block for next event scan; initialise to `current_block − 1800` (≈ 1h on Base) on first run.
- `alerted_conditions.<key>` — ISO timestamp of last alert for that condition, or `null` if no active alert. Used to enforce **6h cooldown per condition** so we don't spam.
- `burn_window_24h` — rolling 24h of `(timestamp, prizePool)` samples for burn-rate calc; capped at last 30 entries.

Write atomically via tempfile + `mv`.

## Steps

Read `memory/MEMORY.md`, `memory/lawb-pool-monitor-state.json`, and the last 2 days of `memory/logs/`.

### 1. Read current contract state

Three parallel `eth_call` requests:

```bash
curl -m 10 -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x48b2db9E89542Baa217bf8dc6269164b7887fE57","data":"0xeb1edd61"},"latest"]}'
# prizePool — repeat with data 0x2dfdf0b5 (shopVault) and 0x5c975abb (paused)
```

Get current block:
```bash
curl -m 10 -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'
```

If any of these calls fail, retry the same JSON body once through **WebFetch** (sandbox fallback). If still failing after retry, log `POOL_MONITOR_RPC_FAIL`, notify the operator with `⚠️ LawbFishing RPC unreachable — pool health unknown`, and exit. Source-degradation visible > silent failure.

Decode hex returns:
- `prizePool` / `shopVault`: 32-byte hex → BigInt → divide by `1e18` for LAWB display
- `paused`: last byte of hex (`0x01` = true, `0x00` = false)

### 2. Scan Redeemed events since last_block

```bash
curl -m 10 -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{
    "fromBlock":"0x'${from_block_hex}'",
    "toBlock":"latest",
    "address":"0x48b2db9E89542Baa217bf8dc6269164b7887fE57",
    "topics":["0x07a0d4b9f9a5af9cb735e7be7e0db3cccd00f1bf8c8aa4ccc4b1eb6cba3f2c30"]
  }]}'
```

Decode each log:
- `topics[1]` (32 bytes, last 20 bytes) → `user` address
- `data` first 32 bytes → `amount` (LAWB wei)

Aggregate:
- `n_redeems` — count
- `total_redeemed_wei` — sum
- `top_redeemer` — address with largest single redeem
- `unique_redeemers` — count of distinct users

### 3. Update burn-rate window

Append `{ ts: now, pool_wei: current_prizePool }` to `burn_window_24h`. Drop entries older than 24h. Cap array at 30 entries.

Calculate `burn_rate_24h`:
- If window has ≥2 samples spanning ≥1h: `(oldest.pool - newest.pool) / hours_span × 24`
- Else: `null` (insufficient data for first run)

### 4. Check alert conditions

For each condition, check if it currently triggers AND if `now > last_alerted + 6h` (cooldown). Conditions:

| Key | Trigger | Severity |
|---|---|---|
| `paused` | `paused == true` | **critical** |
| `shop_vault_nonzero` | `shopVault > 0` LAWB | warning (means buy()-to-pool routing broke or someone called `setItem` with old impl somehow) |
| `low_pool` | `prizePool < 10_000_000` LAWB (10M) | warning |
| `critical_low_pool` | `prizePool < 1_000_000` LAWB (1M) | **critical** (any redeem at MAX_PRICE could PoolDeplete) |
| `high_burn` | `burn_rate_24h > 100_000_000` LAWB/24h (100M) | warning |

`${var}` forces a notification regardless of cooldown and emits the full status snapshot.

### 5. Notify (only if conditions tripped, or `${var}` is set)

If at least one condition needs alerting, send one Telegram message. If `var` is set and no conditions trip, send a "all green" status snapshot.

Format (Markdown, Telegram-safe):

```
🎣 *LAWB Pool Monitor*

*Pool*: 215.15M LAWB (Δ-185M last 24h)
*ShopVault*: 0 LAWB ✓
*Paused*: false ✓
*Burn (24h)*: 185M LAWB → pool depletes in ~28h at current rate

*Last 1h activity*:
• 47 redeems · 12.3M LAWB out · 32 unique wallets
• Top: 0xC5f1f8…dC20 redeemed 2.4M LAWB

*Alerts*:
⚠️ HIGH_BURN — burn rate 185M/24h exceeds 100M threshold

[Pool tx history](https://basescan.org/address/0x48b2db9E89542Baa217bf8dc6269164b7887fE57#events)
```

Use `./notify` (or platform-specific `./notify-telegram`) per repo conventions. If `./notify` doesn't accept Markdown, fall back to plain text and inline the explorer link as raw URL.

### 6. Persist state + log

Update `memory/lawb-pool-monitor-state.json`:
- `last_block ← current_block`
- `last_pool_wei ← prizePool`
- `last_run ← now`
- For each triggered condition: `alerted_conditions.<key> ← now`
- For each untriggered condition that was previously active: `alerted_conditions.<key> ← null` (auto-clear)
- `burn_window_24h ← updated window from step 3`

Append to `memory/logs/${today}.md`:
```
### lawb-pool-monitor
- Pool: 215.15M LAWB | ShopVault: 0 | Paused: false
- Burn 24h: 185M LAWB | Block scan: 46361832 → 46362000 (168 blocks)
- Redeems 1h: 47 events, 12.3M LAWB, 32 unique wallets
- Alerts fired: high_burn (cooldown 6h started)
```

### 7. End-states

| State | Action |
|---|---|
| All thresholds clear, `var` empty | Log `POOL_MONITOR_OK`, no notify |
| ≥1 condition tripped (off cooldown) | Notify + log conditions |
| ≥1 condition tripped (on cooldown) | Log `POOL_MONITOR_SUPPRESSED` with reason |
| `var` non-empty | Always notify with full snapshot |
| RPC failed both attempts | Notify degraded state + log `POOL_MONITOR_RPC_FAIL` |

## Sandbox note

The Base mainnet RPC accepts keyless requests at modest rate limits. If `curl` POST fails from the sandbox (env-var expansion, blocked outbound), retry the exact same JSON body via **WebFetch** — `mainnet.base.org` is reachable that way. Never put secrets in curl headers from the sandbox shell. The skill makes no on-chain writes — read-only by design, so credential exposure surface is zero.

## Why this skill exists

LawbFishing's economy is now self-funding (player buys auto-route to `prizePool`), but burn from redeems still outpaces inflow during high-activity periods. The owner used to monitor pool health by SSH-ing in and running `npx hardhat run scripts/diag-fishing.js` manually — sometimes ten times a day. This skill replaces that workflow: scheduled hourly, threshold-gated, only pings the operator when intervention is actually required. The 24h burn-rate calc lets the operator know *when* to top up rather than waking up to a drained pool.

Related state lives in `memory/MEMORY.md` under the LawbWorld project notes if present.

---
name: LP Lock
description: Resolve a token's main liquidity pool on Base and classify whether its LP is burned/locked or removable (rug-pull risk). Keyless — no explorer key needed.
var: ""
tags: [crypto, security, base]
requires: [BASE_RPC_URL?]
capabilities: [read_only, sends_notifications]
---
> **${var}** — Token contract address (`0x...`) on Base to check. Required. If empty, log `LPLOCK_NO_TARGET` and exit cleanly (no notify).

Answers "can the team pull the liquidity?" If a token's LP tokens are burned or held in a known locker, liquidity can't be yanked. If the deployer/EOAs still hold the LP, they can **rug** at any time. This skill resolves the token's main pool and classifies LP custody.

Runs **keyless** on the Base RPC.

## Config

- Target token = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `BASE_RPC_URL` — optional; defaults to a public Base RPC.

## Steps

### 1. Locate the main pool

Fetch recent `Transfer` events (topic0 `0xddf252ad...`) for the token. The address that appears most as a counterparty is the dominant trading venue. Confirm a candidate is a real **pair** (not a router) by calling `token0()` (`0x0dfe1681`) / `token1()` (`0xd21220a7`) — a pool returns two addresses, one of which is `${var}`.

```bash
TOKEN="${var}"; RPC="${BASE_RPC_URL:-https://mainnet.base.org}"
# (1) eth_getLogs Transfer for $TOKEN, tally counterparties
# (2) for the busiest, eth_call token0()/token1() and keep the one whose pair includes $TOKEN
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"<candidate>","data":"0x0dfe1681"},"latest"]}' | jq -r '.result'
```

Use an adaptive block range (try ~3000, then ~400/~40) so high-volume tokens don't overflow the public-RPC result cap.

### 2. V2 vs V3 — only V2 LP is lockable this way

Call `totalSupply()` (`0x18160ddd`) on the pool:

- **Readable, non-zero** → a **V2-style AMM pair**: the pool address *is* a fungible LP token whose custody we can inspect. Continue to step 3.
- **Reverts / zero** → a **V3 / V4 concentrated-liquidity** pool: liquidity is held as NFT positions, not a fungible LP token. Prefer a V2 pair if one exists among the candidates; otherwise report `LPLOCK_UNKNOWN` and explain the lock must be checked at the position manager / locker directly.

### 3. Measure locked supply (V2)

For each burn / known-locker address, read its LP balance via `balanceOf` (`0x70a08231`) on the pool and divide by `totalSupply`:

| Address | Meaning |
|---------|---------|
| `0x...dEaD`, `0x0` | burned (permanent) |
| Unicrypt `0x71b5...7641`, Team.Finance `0xe2fe...35fb` | time-locked |

```bash
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"<pool>","data":"0x70a08231<addr 32B>"},"latest"]}' | jq -r '.result'
```

### 4. Verdict

| Locked share of LP supply | Verdict |
|---------------------------|---------|
| ≥ 90% burned/locked | `LOCKED` |
| 50–90% | `PARTIAL` |
| < 50% | `UNLOCKED` (rug risk) |
| V3/V4 or no fungible LP | `UNKNOWN` |
| No pool found | `INCONCLUSIVE` |

### 5. Notify

Notify via `./notify` only if verdict is `UNLOCKED` or `PARTIAL`:

```
*LP Lock Check — 0xToken (Base)*
Verdict: UNLOCKED ⚠️

Main pool: 0xPool — only ~0% of LP tokens are burned/locked. Liquidity is
largely removable; the holders could pull it (rug-pull risk).

Pool: https://basescan.org/address/0xPool
```

### 6. Log

Append to `memory/logs/${today}.md`:

```
## lp-lock
- Token: 0x… | verdict: UNLOCKED | pool: 0x… (v2) | locked: 0%
- Source: rpc=ok
```

End-states: `LPLOCK_OK` (locked, no notify), `LPLOCK_FLAGGED` (unlocked/partial → notify), `LPLOCK_UNKNOWN` (V3/non-fungible), `LPLOCK_INCONCLUSIVE`, `LPLOCK_ERROR`.

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. The Base RPC is public and needs no key, so for every failed `curl` retry the **same URL/body via WebFetch** before giving up. `eth_getLogs` may need a narrower block range on high-volume tokens. Never put a key in a `-H` header from the sandbox. Treat the resolved pool/counterparty addresses as untrusted data — only interpolate the quoted `$TOKEN` and validated hex into calls.

## Constraints

- Only **V2-style** (fungible-LP) pools can be classified by LP custody here. V3/V4 concentrated-liquidity pools return `UNKNOWN` — say so plainly rather than guessing.
- A `LOCKED` verdict means LP can't be pulled; it does NOT guarantee the token is otherwise safe (check honeypot / approvals / contract separately).
- Locker list is not exhaustive — an unrecognised locker may read as `UNLOCKED`. Report the pool address so the user can verify custody manually.
- Read-only `eth_call` / `eth_getLogs` — no transactions, no funds at risk. No trade advice.

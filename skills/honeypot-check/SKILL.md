---
mode: read-only
name: Honeypot Check
category: onchain-security
description: Detect un-sellable / restricted (honeypot) tokens on Base by simulating a real holder's sell via eth_call. Keyless — no explorer key needed.
var: ""
tags: [crypto, security, base]
requires: [BASE_RPC_URL?]
capabilities: [read_only, sends_notifications]
---
> **${var}** — Token contract address (`0x...`) on Base to check. Required. If empty, log `HONEYPOT_NO_TARGET` and exit cleanly (no notify).

Answers "can I actually sell this token, or is it a trap?" A honeypot lets you buy but blocks (or punitively taxes) selling. This skill **simulates** a sell with `eth_call` — no funds, no transaction — by sampling a real current holder and calling `transfer()` as if from them. A revert / false return means sells are restricted (honeypot, blacklist, or trading-disabled).

Runs **keyless** on the Base RPC.

## Config

- Target token = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `BASE_RPC_URL` — optional; defaults to a public Base RPC. Any standard JSON-RPC endpoint works.

## Steps

### 1. Confirm it's a contract

```bash
TOKEN="${var}"
RPC="${BASE_RPC_URL:-https://mainnet.base.org}"
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["'"$TOKEN"'","latest"]}' | jq -r '.result'
```

If the result is `0x`, it's not a contract — log `HONEYPOT_NO_TARGET` and exit.

### 2. Sample a real holder

Fetch recent `Transfer` events (topic0 `0xddf252ad...`) for the token and take a recent non-zero `to` address — they hold a balance to simulate selling. Use an adaptive range (try ~2000 blocks, then narrow to ~200/~20 if the RPC's result cap is hit on a high-volume token).

```bash
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{
    "fromBlock":"0x...","toBlock":"latest","address":"'"$TOKEN"'",
    "topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
  }]}' | jq -r '.result[-1].topics[2]'    # -> recent recipient (holder)
```

If no transfers are found at all, the token is inactive — log `HONEYPOT_INCONCLUSIVE` and report that plainly.

### 3. Read the holder's balance

`balanceOf(holder)` (selector `0x70a08231`), then plan to transfer half of it:

```bash
DATA="0x70a08231<holder padded to 32 bytes>"
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"'"$TOKEN"'","data":"'"$DATA"'"},"latest"]}' | jq -r '.result'
```

### 4. Simulate the sell

`eth_call` `transfer(recipient, amount)` (selector `0xa9059cbb`) with **`from` = the sampled holder**. Because `eth_call` doesn't change state, this is a safe dry-run of whether the holder *could* move the token:

```bash
DATA="0xa9059cbb<recipient 32B><amount 32B>"
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"from":"<holder>","to":"'"$TOKEN"'","data":"'"$DATA"'"},"latest"]}'
```

### 5. Verdict

| Result of the simulated transfer | Verdict |
|----------------------------------|---------|
| Reverts, or returns `false` (`0x0…0`) | `LIKELY_HONEYPOT` |
| Succeeds (returns `true`) | `SELLABLE` |
| No holder could be sampled | `INCONCLUSIVE` |

### 6. Notify

Notify via `./notify` only if verdict is `LIKELY_HONEYPOT`:

```
*Honeypot Check — 0xToken (Base)*
Verdict: LIKELY_HONEYPOT ⚠️

A transfer from a real holder reverted in simulation — sells appear restricted
(honeypot, blacklist, or trading disabled). Do not buy expecting to sell.

Token: https://basescan.org/token/0xToken
```

### 7. Log

Append to `memory/logs/${today}.md`:

```
## honeypot-check
- Token: 0x… | verdict: LIKELY_HONEYPOT
- Sampled holder: 0x… | simulated transfer: reverted
- Source: rpc=ok
```

End-states: `HONEYPOT_OK` (sellable, no notify), `HONEYPOT_FLAGGED` (likely honeypot → notify), `HONEYPOT_INCONCLUSIVE`, `HONEYPOT_ERROR`.

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. The Base RPC is public and needs no key, so for every failed `curl` retry the **same URL/body via WebFetch** before giving up. `eth_getLogs` may need a narrower block range on high-volume tokens (public-RPC result cap). Never put a key in a `-H` header from the sandbox. Treat the sampled holder/recipient addresses as untrusted — never interpolate beyond the quoted `$TOKEN` / validated hex.

## Constraints

- This is a **sell-restriction** check via simulation, not a tax meter — a `SELLABLE` verdict does NOT mean the sell tax is low. Say so; recommend checking the tax separately.
- `eth_call` only — never send a transaction. No funds are ever at risk.
- A revert can occasionally be a transient/router-specific condition; report `LIKELY_HONEYPOT` as a strong signal to investigate, not a certainty.
- No trade advice — present the sell-restriction finding and let the user decide.

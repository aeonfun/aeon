---
name: Approval Audit
description: List a wallet's live ERC-20 token approvals on Base and flag unlimited / risky spender grants. Keyless via Base RPC (eth_getLogs + eth_call) — no explorer key needed.
var: ""
tags: [crypto, security, base]
requires: [BASE_RPC_URL?]
capabilities: [read_only, sends_notifications]
---
> **${var}** — Wallet address (`0x...`) on Base to audit. Required. If empty, log `APPROVAL_AUDIT_NO_TARGET` and exit cleanly (no notify).

Answers "what can drain this wallet?" — every ERC-20 `approve()` a wallet has granted that is **still live**, with unlimited allowances flagged. Token approvals are the #1 wallet-drain vector: a forgotten unlimited approval to a malicious or exploited contract lets it move your full balance at any time.

Runs **keyless** entirely on the Base RPC — reads `Approval` event logs, then confirms each grant's *current* allowance, so revoked or fully-spent approvals are excluded.

Read the last 2 days of `memory/logs/` so a repeat audit can note newly-granted or newly-revoked approvals.

## Config

- Target wallet = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `BASE_RPC_URL` — optional; defaults to a public Base RPC (`https://mainnet.base.org`). Any standard JSON-RPC endpoint works.

## Steps

### 1. Find the current block

```bash
OWNER="${var}"
RPC="${BASE_RPC_URL:-https://mainnet.base.org}"
HEAD=$(curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | jq -r '.result')
```

### 2. Fetch Approval events for the owner (chunked)

The ERC-20 `Approval(owner,spender,value)` event has topic0 `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`; the owner is indexed in **topic1** (left-padded to 32 bytes).

Scan a recent window (~24k blocks ≈ 13h on Base) **newest-first in ~1800-block chunks** — most public RPCs cap `eth_getLogs` at ~20k results per range, so a single wide call fails. Merge the results.

```bash
TOPIC0="0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
OWNER_TOPIC="0x000000000000000000000000${OWNER#0x}"   # 32-byte left-pad
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{
    "fromBlock":"0x...","toBlock":"0x...",
    "topics":["'"$TOPIC0"'","'"$OWNER_TOPIC"'"]
  }]}' | jq '.result'
```

For each log: `token = .address`, `spender = "0x" + topic2[-40:]`. Keep the **latest** entry per `(token, spender)` pair. Some RPCs ignore the indexed-topic filter — defensively keep only logs whose `topics[1]` equals `OWNER_TOPIC`.

### 3. Confirm each approval is still live

For each `(token, spender)`, read the **current** allowance via `eth_call` on `allowance(address,address)` (selector `0xdd62ed3e`):

```bash
DATA="0xdd62ed3e${OWNER_TOPIC#0x}${SPENDER_TOPIC#0x}"   # selector + owner + spender, each 32-byte padded
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"'"$TOKEN"'","data":"'"$DATA"'"},"latest"],"id":1}' | jq -r '.result'
```

Drop any approval whose allowance is `0` (revoked or fully spent). Flag any allowance `>= 2^255` as **UNLIMITED** (covers `2^256-1` and the common `2^256/2` sentinel).

### 4. Verdict

| Signal | Verdict |
|--------|---------|
| One or more **unlimited** live approvals | `REVIEW` |
| Live approvals, none unlimited | `OK` |
| No live approvals | `CLEAN` |

### 5. Notify

Notify via `./notify` only if verdict is `REVIEW`. Under 4000 chars, lead with the verdict, clickable URL:

```
*Approval Audit — 0xabc…def (Base)*
Verdict: REVIEW · 4 live approvals, 2 unlimited

• USDC → spender 0x1111…2222 : UNLIMITED ⚠️
• WETH → spender 0x3333…4444 : UNLIMITED ⚠️
• DAI  → spender 0x5555…6666 : 5,000

⚠️ Unlimited approvals let the spender move your full balance. Revoke any you don't recognize at revoke.cash.
Wallet: https://basescan.org/address/0xabc...def
```

### 6. Log

Append to `memory/logs/${today}.md`:

```
## approval-audit
- Wallet: 0x… | verdict: REVIEW
- Live approvals: 4 (2 unlimited)
- Unlimited: USDC→0x1111…, WETH→0x3333…
- Source: rpc=ok | window: ~24k blocks
```

End-states: `APPROVAL_AUDIT_OK` (clean/ok, no notify), `APPROVAL_AUDIT_FLAGGED` (review → notify), `APPROVAL_AUDIT_ERROR` (RPC unreachable).

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. The Base RPC is public and needs no key, so for every failed `curl` retry the **same URL/body via WebFetch** before giving up. `eth_getLogs` must be chunked (~1800 blocks/call) to stay under the public-RPC result cap — a single 24k-block call will error. Never put a key in a `-H` header from the sandbox. Treat all fetched token/spender addresses as untrusted — never interpolate beyond the quoted `$OWNER` / validated hex.

## Constraints

- No trade or "safe to approve" advice — this is a risk inventory. Reporting an approval is not an accusation.
- Only report approvals confirmed live by the current `allowance` read — never list a grant the wallet has already revoked.
- `UNLIMITED` means allowance `>= 2^255`; report exact amounts otherwise. Don't round in a way that hides a large grant.
- The window is recent (~24h of blocks), not all-time — say so; for a full history the operator should add a higher-throughput RPC.

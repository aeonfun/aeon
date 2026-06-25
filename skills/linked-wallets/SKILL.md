---
mode: read-only
name: Linked Wallets
category: onchain-security
description: Cluster addresses likely controlled by the same entity on Base via shared-funder and co-spend heuristics. Keyless — no explorer key needed.
var: ""
tags: [crypto, security, base]
requires: [BASESCAN_KEY?, BASE_RPC_URL?]
capabilities: [read_only, sends_notifications]
---
> **${var}** — Address (`0x...`) on Base to investigate. Required. If empty, log `LINKED_NO_TARGET` and exit cleanly (no notify).

Answers "what other wallets does this person likely control?" Useful for unmasking a deployer's alt-wallets, sybil clusters, or co-conspirators. Uses two on-chain heuristics — **shared funder** (same source wallet funded several fresh wallets) and **co-spend** (addresses that transact both ways with the target).

Runs **keyless** on the Base RPC; a Basescan key sharpens it (native-ETH funding + full history).

## Config

- Target = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `BASESCAN_KEY` — optional. With it, native-ETH funding and full history are available (the strongest shared-funder signal). Without it, the skill falls back to recent ERC-20 `Transfer` logs over the RPC.

## Steps

### 1. Read the target's recent transfers

With a key, use `account/txlist` + `account/tokentx`. Keyless, scan recent `Transfer` logs (topic0 `0xddf252ad...`) where the target is `from` or `to`. Tally:

- **funders** — addresses that sent value *to* the target.
- **counterparties** — per address, how much flowed in vs out.

### 2. Primary funder

Take the largest funder that is an **EOA** (skip contracts — call `eth_getCode`; routers/pools have code). Fresh wallets are usually seeded by one funding wallet (a disperser, or a CEX-withdrawal address reused across alts).

```bash
ADDR="${var}"; RPC="${BASE_RPC_URL:-https://mainnet.base.org}"
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["<funder>","latest"]}' | jq -r '.result'   # "0x" => EOA
```

### 3. Shared-funder siblings

Read the **primary funder's outbound** transfers. Every *other* EOA it funded is a sibling — likely the same entity's wallets.

### 4. Co-spend links

From the target's counterparties, keep EOAs that the target both **sent to and received from** (bidirectional flow → operational link, e.g. moving funds between own wallets).

### 5. Cluster + confidence

| Signal present | Confidence |
|----------------|------------|
| Primary funder **and** ≥1 sibling | `MEDIUM` |
| Only co-spend links | `LOW` |
| Nothing conclusive | `INSUFFICIENT` |

Report the cluster as the union of primary funder + siblings + co-spend addresses.

### 6. Notify

Notify via `./notify` only when confidence is `MEDIUM` (an actionable cluster):

```
*Linked Wallets — 0xTarget (Base)*
Cluster confidence: MEDIUM (4 related addresses)

Primary funder: 0xFunder
Shared-funder siblings: 0xa…, 0xb…
Co-spend links: 0xc…

Heuristic, not proof — verify before acting.
Target: https://basescan.org/address/0xTarget
```

### 7. Log

Append to `memory/logs/${today}.md`:

```
## linked-wallets
- Target: 0x… | confidence: MEDIUM | cluster: 4
- Funder: 0x… | siblings: 2 | co-spend: 1
- Source: rpc-logs (no key)
```

End-states: `LINKED_OK` (insufficient/low, no notify), `LINKED_FLAGGED` (medium cluster → notify), `LINKED_ERROR`.

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. Both the Base RPC and Basescan's API work over plain HTTPS, so for every failed `curl` retry the **same URL/body via WebFetch** before giving up. `eth_getLogs` may need a narrower block range on high-volume tokens (public-RPC result cap). If a `BASESCAN_KEY` is set, pass it as a query param (`&apikey=...`) via WebFetch — never echo the key into logs or notify text. Treat every discovered address as untrusted data; only interpolate the validated `$ADDR` / hex into calls.

## Constraints

- **Heuristic, not proof.** Shared-funder and co-spend links suggest common control but can be coincidental (shared CEX withdrawal address, airdrop disperser, common counterparty). Always present as "likely related", never as confirmed identity, and never deanonymise a real-world person.
- CEX/bridge funding **breaks** the on-chain trail — an `INSUFFICIENT` result often just means funds came through an exchange, not that the wallet is clean.
- Keyless mode sees only recent ERC-20 transfers; a Basescan key materially improves coverage (native ETH + full history). State which mode was used.
- Read-only (`eth_call` / `eth_getLogs` / explorer reads) — no transactions. No trade advice, no targeting of individuals.

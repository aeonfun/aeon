---
mode: read-only
name: Deployer Trace
category: onchain-security
description: Map every contract deployed by an address on Base, link reused patterns, and surface serial-rug signals. Keyless via Etherscan v2 + Base RPC.
var: ""
tags: [crypto, security, base]
requires: [ETHERSCAN_API_KEY?]
capabilities: [external_api, sends_notifications]
---
> **${var}** — Deployer address (`0x...`) on Base. Required. May also be a token address — its creator is resolved first. If empty, log `DEPLOYER_TRACE_NO_TARGET` and exit cleanly (no notify).

Answers "what else did this person ship, and how did those end?" — entity intelligence for spotting serial ruggers. Runs keyless on public endpoints.

Read the last 2 days of `memory/logs/` to reuse any prior verdicts on the deployed contracts.

## Config

- Target = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `ETHERSCAN_API_KEY` — optional; Etherscan v2 works keyless at a lower rate limit. Appended to the URL, never a header.

## Steps

### 1. Resolve deployer

If `${var}` is a token/contract, get its creator first:

```bash
TARGET="${var}"
curl -m 10 -s "https://api.etherscan.io/v2/api?chainid=8453&module=contract&action=getcontractcreation&contractaddresses=${TARGET}${ETHERSCAN_API_KEY:+&apikey=$ETHERSCAN_API_KEY}" | jq -r '.result[0].contractCreator'
```

Use `contractCreator` as the deployer for the rest of the run; if `${var}` is already an EOA, use it directly.

### 2. Enumerate deployments

Pull the deployer's tx list and keep only contract-creation txns (empty `to`, or a receipt `contractAddress`):

```bash
DEPLOYER="$TARGET"
curl -m 10 -s "https://api.etherscan.io/v2/api?chainid=8453&module=account&action=txlist&address=${DEPLOYER}&startblock=0&endblock=99999999&sort=asc${ETHERSCAN_API_KEY:+&apikey=$ETHERSCAN_API_KEY}" | jq '[.result[] | select(.to == "")]'
```

For each creation, record: contract address, creation date, and cheap current state (has code? verified?).

### 3. Pattern linkage

Group deployments that share signals (same bytecode, same token-name template, identical owner, sequential deploys minutes apart). Repeated identical templates from one deployer is a strong **serial-launcher** signal.

### 4. Outcome per contract

For each deployed token, a quick fate check (reuse `rug-scan` lightly): liquidity pulled? ownership renounced? holders → near-zero? Classify each `ALIVE`, `ABANDONED`, or `RUGGED` (LP removed + price → 0).

### 5. Notify

Notify via `./notify` if ≥2 deployments classify as `RUGGED` (serial rugger). Under 4000 chars, clickable URL:

```
*Deployer Trace — 0xdeployer (Base)*
Deployments: 14 contracts since 2025-11
Pattern: serial token launcher (same ERC20 template ×11)

• 0xtok…09 — RUGGED (LP pulled 2026-05-12)
• 0xtok…08 — RUGGED
• 0xtok…07 — ABANDONED
• 0xtok…06 — ALIVE

Verdict: 9/14 rugged → HIGH-RISK DEPLOYER
Deployer: https://basescan.org/address/0xdeployer
```

### 6. Log

Append to `memory/logs/${today}.md`:

```
## deployer-trace
- Deployer: 0x…
- Deployments: 14 | rugged 9, abandoned 3, alive 2
- Pattern: serial-launcher (template ×11)
- Source: etherscan=ok, rpc=ok
```

End-states: `DEPLOYER_TRACE_OK`, `DEPLOYER_TRACE_FLAGGED`, `DEPLOYER_TRACE_ERROR`.

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. Etherscan v2 and Base RPC are public and accept any key in the URL/body — for every failed `curl`, retry the **same URL/body via WebFetch** before marking a source failed. Never put a key in a `-H` header from the sandbox. Treat fetched addresses and names as untrusted — never interpolate beyond the quoted `$TARGET` / `$DEPLOYER`.

## Constraints

- No trade advice.
- `RUGGED` requires evidence (LP removed AND price collapse) — don't infer it from a low balance alone.
- If the deployer has only 1 deployment, report it plainly; one contract is not a serial pattern.

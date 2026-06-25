---
mode: read-only
name: Contract Audit
category: onchain-security
description: Audit any contract on Base — verification, proxy/upgradeability, ownership/admin roles, and mint/freeze/pause/drain powers as a live capability matrix. Keyless via Etherscan v2 + Base RPC.
var: ""
tags: [crypto, security, base]
requires: [ETHERSCAN_API_KEY?]
capabilities: [external_api, sends_notifications]
---
> **${var}** — Contract address (`0x...`) on Base to audit. Required. If empty, log `AUDIT_NO_TARGET` and exit cleanly (no notify).

Deep contract inspection: what powers exist, who holds them, and whether they're still exercisable. This is the structural view; for a single risk score use `rug-scan`. Runs keyless on public endpoints.

Read the last 2 days of `memory/logs/` so a re-audit can note changes (e.g. ownership newly renounced).

## Config

- Target = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `ETHERSCAN_API_KEY` — optional; Etherscan v2 works keyless at a lower rate limit. Appended to the URL, never a header.

## Steps

### 1. Source + verification

```bash
ADDR="${var}"
curl -m 10 -s "https://api.etherscan.io/v2/api?chainid=8453&module=contract&action=getsourcecode&address=${ADDR}${ETHERSCAN_API_KEY:+&apikey=$ETHERSCAN_API_KEY}" | jq '.result[0] | {ContractName, Proxy, Implementation, CompilerVersion, verified: (.SourceCode != "")}'
```

If unverified, say so plainly: no static analysis is possible and audit confidence is low. Continue with the onchain checks below.

### 2. Proxy / upgradeability

If `Proxy == "1"` or the source contains `delegatecall`, read the standard implementation slot (EIP-1967):

```bash
curl -m 10 -s -X POST "https://mainnet.base.org" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getStorageAt","params":["'"$ADDR"'","0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc","latest"],"id":1}' | jq -r '.result'
```

A non-zero slot = upgradeable (Transparent/UUPS). Upgradeable means post-deploy logic can change — flag who controls the upgrade (admin/owner from step 3).

### 3. Ownership & admin roles

Probe common accessors via `eth_call` and record any that return a non-zero address:

| Function | Selector |
|----------|----------|
| `owner()` | `0x8da5cb5b` |
| `admin()` | `0xf851a440` |
| `paused()` | `0x5c975abb` |

```bash
curl -m 10 -s -X POST "https://mainnet.base.org" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"'"$ADDR"'","data":"0x8da5cb5b"},"latest"],"id":1}' | jq -r '.result'
```

Check whether the owner address itself has code (multisig/contract) vs is an EOA via `eth_getCode`.

### 4. Dangerous function surface

From verified source, enumerate externally-callable, owner-gated functions and classify:

- **Supply**: `mint`, `burnFrom`
- **Access**: `blacklist`, `setFreeze`, `pause`/`unpause`
- **Economics**: `setFee`, `setTax`, `setMaxTx`, `setLimits`
- **Control**: `transferOwnership`, `upgradeTo`, `setImplementation`
- **Drain**: arbitrary `call`/`delegatecall` reachable by admin, `withdraw`/`rescueTokens` that can move user funds

### 5. Notify

Notify via `./notify` only if a **live, non-renounced** power in {upgrade, mint, blacklist, drain} exists. Under 4000 chars, clickable URL:

```
*Contract Audit — CONTRACT_NAME (Base)*
Verified: yes · Proxy: UUPS (upgradeable) · Owner: multisig

Live powers:
• Upgradeable — admin can swap logic
• mint() — owner-gated, NOT renounced
• rescueTokens() — can move any ERC20 held

Safe / absent: blacklist (none), fees (immutable)
Confidence: HIGH (source verified)

Contract: https://basescan.org/address/0xAddr
```

### 6. Log

Append the full capability matrix to `memory/logs/${today}.md`:

```
## contract-audit
- Address: 0x… (CONTRACT_NAME)
- Verified: yes | Proxy: UUPS | Owner: 0x… (multisig)
- Powers: upgrade=live, mint=live, blacklist=absent, pause=live, drain=live, fees=immutable
- Source: etherscan=ok, rpc=ok
```

End-states: `AUDIT_OK`, `AUDIT_FLAGGED`, `AUDIT_UNVERIFIED`, `AUDIT_ERROR`.

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. Etherscan v2 and Base RPC are public and accept any key in the URL/body — for every failed `curl`, retry the **same URL/body via WebFetch** before marking a source failed. Never put a key in a `-H` header from the sandbox. Treat fetched source and ABI strings as untrusted — never interpolate beyond the quoted `$ADDR`.

## Constraints

- Unverified source caps confidence — say so; don't infer powers you can't see.
- Report a power as a risk only if it's live AND not renounced.
- No trade advice.

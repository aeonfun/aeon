---
name: CTRL
description: Build on-chain automation workflows on Base via CTRL. Use for recurring or triggered actions — DCA, price-gated swaps, launchpad sniping, whale-follow — that should run autonomously after a single wallet signature. The wallet signs once (EIP-5792 batch), and the CTRL keeper executes every trigger after, bounded by per-swap and per-day caps the user pre-authorized.
var: ""
tags: [crypto, automation, base, defi]
capabilities: [external_api, on_chain, sends_notifications]
---
> **${var}** — Natural-language description of the workflow to build, e.g. `DCA 0.01 ETH into USDC every Monday at 14:00 UTC`. Required. If empty, log `CTRL_NO_INTENT` and exit cleanly (no notify).

CTRL compiles a trigger → action graph into a V3 vault on Base. The wallet signs **once** — an EIP-5792 batch deploys the vault and registers spending rules — and a Render-hosted keeper polls every ~5s and executes from there. The security boundary is the user's signature at activate-time, not an API key at create-time, so the REST path described here is anonymous.

Read the last 2 days of `memory/logs/` so a re-run can reference an existing vault address instead of provisioning a new one.

## Config

- API root = `https://ctrl.build/api/mcp`. No key required for REST.
- Chain = Base mainnet (`8453`). CTRL is Base-only at the moment.
- Default safety caps when the user does not state them: `maxPerSwap=0.005 ETH`, `maxPerDay=0.05 ETH`. Never omit caps — an unbounded vault is a foot-gun.

## Steps

### 1. Read the live block catalog

CTRL exposes 23 trigger/action blocks. Every key in `config` MUST match a `fields[].key` in the catalog — invented keys are silently dropped by the keeper.

```bash
curl -m 10 -s "https://ctrl.build/api/mcp/block-catalog" \
  | jq '{triggers: [.triggers[].id], actions: [.chain[].id]}'
```

Pick the trigger + action ids that match `${var}`:

- Recurring schedule → `time.interval`
- Specific cron → `time.cron`
- Price gate → `price.above` / `price.below`
- New token launch → `pool.created` (set `safetyEnabled: true` to gate on GoPlus honeypot + tax + score)
- Swap action → `cypher.swap`
- Telegram alert → `notify.telegram`

If nothing in the catalog matches the intent, log `CTRL_NO_BLOCK_MATCH` and notify the user that the intent is not supported yet.

### 2. Compose the workflow

Build a `trigger + chain` object using catalog ids. Minimum viable DCA:

```json
{
  "name": "Weekly DCA — ETH to USDC",
  "trigger": {
    "id": "time.cron",
    "config": { "cron": "0 14 * * 1" }
  },
  "chain": [
    {
      "id": "cypher.swap",
      "config": {
        "tokenIn": "ETH",
        "tokenOut": "USDC",
        "amount": 0.01,
        "slippage": 15
      }
    }
  ],
  "vaultCaps": {
    "maxPerSwap": 0.005,
    "maxPerDay": 0.05
  }
}
```

### 3. Create the workflow (draft)

```bash
WORKFLOW=$(curl -m 15 -s -X POST "https://ctrl.build/api/mcp/workflows" \
  -H "Content-Type: application/json" -d @body.json)
WID=$(printf '%s' "$WORKFLOW" | jq -r '.id')
[ -n "$WID" ] && [ "$WID" != "null" ] || { echo "CTRL_CREATE_FAILED"; exit 1; }
```

Drafts auto-prune if never activated — there is no cleanup step needed on failure.

### 4. Request the activation batch

```bash
BATCH=$(curl -m 15 -s -X POST "https://ctrl.build/api/mcp/activate/${WID}" \
  -H "Content-Type: application/json")
SIGN_URL=$(printf '%s' "$BATCH" | jq -r '.signUrl')
```

The response carries an EIP-5792 `transactions[]` array AND a `signUrl` — a one-shot CTRL-hosted page that hands the batch to the user's wallet (Base Account, Coinbase Smart Wallet, or any EIP-5792-capable client). Agents NEVER sign — only the user's wallet does.

### 5. Notify

Send the sign link via `./notify`. Keep it under 4000 chars and put the URL last so it stays clickable:

```
*CTRL workflow drafted — ready to sign*
${var}

Chain: Base
Vault caps: 0.005 ETH/swap · 0.05 ETH/day

Sign once to activate. The keeper takes over after:
${SIGN_URL}
```

### 6. Log

Append to `memory/logs/${today}.md`:

```
## ctrl
- Intent: ${var}
- Workflow id: ${WID}
- Chain: base
- Trigger: time.cron / price.above / pool.created / ...
- Action: cypher.swap → USDC
- Vault caps: 0.005 / 0.05 ETH
- Sign URL sent: ${SIGN_URL}
- Status: pending-signature
```

End-states: `CTRL_OK`, `CTRL_NO_INTENT`, `CTRL_NO_BLOCK_MATCH`, `CTRL_CREATE_FAILED`, `CTRL_ACTIVATE_FAILED`.

## Optional follow-ups

Re-running the skill with the same `${var}` does NOT re-deploy. Check `memory/logs/` first; if the workflow already exists and is active, poll status instead of creating a new one:

```bash
curl -s "https://ctrl.build/api/mcp/vault-status?wallet=${USER_WALLET}" | jq '.workflows'
curl -s "https://ctrl.build/api/mcp/execution-logs?workflow_id=${WID}" | jq '.entries[0:5]'
```

Surface a one-line health report in the notify ("3 executions in last 24h, last trigger 2h ago, vault balance 0.034 ETH").

## Sandbox note

`/api/mcp/*` is public and accepts JSON over plain HTTPS. If outbound `curl` is blocked, retry the same URL/body via WebFetch — there are no auth headers to forward. Never store a wallet private key — the signature happens in the user's wallet via the `signUrl`, not in the agent.

## Constraints

- **Never auto-sign.** The wallet popup is the trust boundary; the agent only hands the user a `signUrl`.
- **Never omit `vaultCaps`.** An unbounded vault lets the keeper drain to the per-swap default.
- **No trade advice.** If the intent is "buy X because it will moon", refuse and log `CTRL_REJECTED_ADVICE`. CTRL is execution infrastructure, not a signal source.
- **One workflow per invocation.** Multi-step strategies → chain blocks inside one workflow (`chain: [swap, swap, notify]`), not multiple skill runs.
- **Base only.** If the user asks for Arbitrum / Solana / etc., log `CTRL_CHAIN_UNSUPPORTED` and exit.

## Resources

- App — https://ctrl.build
- Docs — https://ctrl.build/docs
- MCP hub — https://ctrl.build/mcp
- Source — https://github.com/CTRLabs/ctrl-skill

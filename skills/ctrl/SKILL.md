---
type: Skill
name: CTRL
category: crypto
description: Build on-chain automation workflows on Base via CTRL. Use for recurring or triggered actions — DCA, price-gated swaps, launchpad sniping, whale-follow — that should run autonomously after a single wallet signature. The wallet signs once (EIP-5792 batch), and the CTRL keeper executes every trigger after, bounded by per-swap and per-day caps the user pre-authorized.
var: ""
tags: [crypto, automation, base, defi]
capabilities: [external_api, writes_external_host, onchain_writes, sends_notifications]
---
> **${var}** — Natural-language description of the workflow to build, e.g. `DCA 0.005 ETH into USDC every week`. Required. If empty, log `CTRL_NO_INTENT` and exit cleanly (no notify).

CTRL runs on **Base mainnet** only. It compiles a `trigger → action` graph into a V3 vault, the wallet signs **once** — an EIP-5792 batch deploys the vault and registers spending rules — and a Render-hosted keeper polls every ~5s and executes from there. The security boundary is the user's signature at activate-time, not an API key at create-time, so the create + read REST endpoints are anonymous. Activation requires a real wallet session, which the user provides by opening the CTRL activate landing page in their browser.

Read the last 2 days of `memory/logs/` so a re-run can reference an existing workflow id instead of provisioning a new one.

## Config

- API root = `https://ctrl.build/api/mcp`. No key required for the endpoints used here.
- Chain = Base mainnet (chainId `8453`). Always send `"chain": "base"` and `"network": "mainnet"` — CTRL does NOT support Ethereum, Arbitrum, Solana, or any other chain. If the user asks for another chain, log `CTRL_CHAIN_UNSUPPORTED` and exit before creating anything.
- Sensible defaults the agent should adopt if the user does not state them: per-swap ≤ `0.01 ETH`, per-day ≤ `0.1 ETH`, slippage ≤ `1%` for stable-pair DCA, `15%` only for launchpad sniping. Caps are signed at activate-time, never embedded in the workflow body.

## Steps

### 1. Read the live block catalog

CTRL exposes 24 blocks across four categories (triggers, actions, conditions, utilities). Every key under each node's `data.config` MUST match a `fields[].key` in the catalog — invented keys are silently dropped by the keeper.

```bash
curl -m 10 -s "https://ctrl.build/api/mcp/block-catalog" \
  | jq '{
      triggers:   [.triggers[].id],
      actions:    [.actions[].id],
      conditions: [.conditions[].id],
      utilities:  [.utilities[].id]
    }'
```

Pick the trigger + action ids that match `${var}`. The most common shapes:

- Recurring schedule → `time.interval` (config: `minutes`). The only schedule trigger today — express weekly as `minutes: 10080`, daily as `1440`, hourly as `60`. There is no cron / day-of-week trigger yet.
- Price gate → `price.above` / `price.below` (config: `token`, `threshold`)
- New token launch → `pool.created` (config: `launchpad`, `safetyEnabled: true` for GoPlus honeypot/tax/score gating)
- Swap action → `cypher.swap` (config: `tokenIn`, `tokenOut`, `amount`, `slippage`)
- Telegram alert → `notify.telegram` (config: `message`, `severity`)

If nothing in the catalog matches the intent, log `CTRL_NO_BLOCK_MATCH` and notify the user that the intent is not supported yet.

### 2. Compose the workflow graph

The workflow is a ReactFlow-style `{ nodes, edges }` graph. Each node carries BOTH a top-level `blockType + blockSubtype` (for the create-time validator) AND a `data.blockId + data.subtype` (for the keeper). The two are redundant by design — get them all from the catalog row.

Minimum viable weekly DCA — buy 0.005 ETH of USDC every 10080 minutes, 1% slippage. Write it to `body.json` (step 3 reads that file):

```bash
cat > body.json <<'JSON'
{
  "name": "Weekly DCA — ETH to USDC",
  "description": "DCA 0.005 ETH into USDC weekly via CTRL",
  "chain": "base",
  "network": "mainnet",
  "workflow_data": {
    "nodes": [
      {
        "id": "t1",
        "type": "trigger",
        "blockType": "trigger",
        "blockSubtype": "interval",
        "position": { "x": 200, "y": 200 },
        "data": {
          "blockId": "time.interval",
          "subtype": "interval",
          "label": "Every week",
          "config": { "minutes": 10080 }
        }
      },
      {
        "id": "a1",
        "type": "action",
        "blockType": "action",
        "blockSubtype": "swap",
        "position": { "x": 500, "y": 200 },
        "data": {
          "blockId": "cypher.swap",
          "subtype": "swap",
          "label": "Buy USDC",
          "config": {
            "tokenIn": "ETH",
            "tokenOut": "USDC",
            "amount": 0.005,
            "slippage": 1,
            "useNativeETH": true
          }
        }
      }
    ],
    "edges": [
      { "id": "e1", "source": "t1", "target": "a1" }
    ]
  }
}
JSON
```

Units the catalog is explicit about:

- `amount` is in **token units** (e.g. `0.005` ETH when `tokenIn` = `ETH`). Beta cap: ≤ 1 ETH-equivalent per swap.
- `slippage` is **percent**, range `0.1–99`. Snipe flows force ≥ 10. For stable-pair DCA pick 0.5–2; for memecoin snipes 10–15.
- The trigger's `minutes` is an integer ≥ 1.

### 3. Create the workflow (draft, anonymous)

```bash
WORKFLOW=$(curl -m 15 -s -X POST "https://ctrl.build/api/mcp/workflows" \
  -H "Content-Type: application/json" -d @body.json)
WID=$(printf '%s' "$WORKFLOW" | jq -r '.workflow.id')
[ -n "$WID" ] && [ "$WID" != "null" ] || { echo "CTRL_CREATE_FAILED"; exit 1; }
```

The response is `{ "workflow": { "id", "name", "status", "created_at" } }`. The draft's `user_id` stays NULL until the wallet that signs the activation batch claims it. Drafts that are never activated auto-prune.

### 4. Optional pre-flight — check vault state

`${USER_WALLET}` below is the operator's connected wallet address (the vault owner, a `0x…` address) — read it from `memory/` or ask the user once. Before sending them to sign, surface the vault preview so they know whether a deploy is included and how much ETH to fund:

```bash
USER_WALLET="0x..."   # the operator's wallet (vault owner)
curl -s "https://ctrl.build/api/mcp/vault-status?wallet=${USER_WALLET}" | jq '{
  vaultExists, vaultAddress, predictedVaultAddress,
  ethBalance: .balances.ethDecimal,
  wethBalance: .balances.wethDecimal,
  ready, warnings
}'
```

If `vaultExists` is `false`, the activate batch will deploy the V3 vault in the same transaction list — fine, but the user must fund it (the user picks `depositEth` on the activate page).

### 5. Hand the user the activate landing page

CTRL's activate endpoint (`POST /api/mcp/activate/<id>`) **requires wallet auth** to encode the EIP-5792 batch — the agent cannot call it from a server sandbox. Instead, construct the landing-page URL and notify the user. The landing page handles wallet-connect, lets the user adjust caps, calls activate from their authenticated session, then hands the returned `transactions[]` to their wallet's EIP-5792 `wallet_sendCalls` flow.

```bash
ACTIVATE_URL="https://ctrl.build/activate/${WID}"
```

Send via `./notify`. Keep it under 4000 chars and put the URL last so it stays clickable:

```
*CTRL workflow drafted — ready to sign*
${var}

Chain: Base mainnet
Suggested caps: 0.01 ETH/swap · 0.1 ETH/day (editable on the activate page)
One wallet signature deploys the vault + registers the spending rule. The keeper runs every trigger after that.

${ACTIVATE_URL}
```

The user opens the URL, connects a wallet, optionally edits `maxPerSwapEth` / `maxPerDayEth` / `depositEth` / `expiryDays`, and signs ONE EIP-5792 batch. From that moment the keeper takes over.

### 6. Log

Append to `memory/logs/${today}.md`:

```
## ctrl
- Intent: ${var}
- Workflow id: ${WID}
- Chain: base / mainnet
- Trigger: time.interval / price.above / pool.created / ...
- Action: cypher.swap → USDC
- Activate URL sent: ${ACTIVATE_URL}
- Status: pending-signature
```

End-states: `CTRL_OK`, `CTRL_NO_INTENT`, `CTRL_NO_BLOCK_MATCH`, `CTRL_CREATE_FAILED`, `CTRL_CHAIN_UNSUPPORTED`, `CTRL_REJECTED_ADVICE`.

## Follow-up reads

Once a workflow is live, both endpoints work anonymously by id / wallet:

```bash
# Vault address, balances, active spending rules, ready flag.
curl -s "https://ctrl.build/api/mcp/vault-status?wallet=${USER_WALLET}" | jq '.activeRules'

# Last N executions for this workflow — surfaces tx hashes, error messages, gas spent.
curl -s "https://ctrl.build/api/mcp/execution-logs?workflow_id=${WID}" | jq '.logs[0:5]'
```

Use these to write a one-line health line in a follow-up notify ("3 executions in last 24h, last trigger 2h ago, vault balance 0.034 ETH").

## Withdrawing from the vault

To pull funds back out of the vault, `POST /api/mcp/vault-withdraw`. Like activate, the agent never signs — it returns an EIP-5792 `transactions[]` batch + a `signUrl` the user opens in their wallet. `token` defaults to `ETH`; pass `WETH` or a `0x` token address for other assets; omit `amount` to withdraw the full balance.

```bash
curl -s -X POST "https://ctrl.build/api/mcp/vault-withdraw" \
  -H "Content-Type: application/json" \
  -d "{ \"wallet\": \"${USER_WALLET}\", \"token\": \"ETH\", \"amount\": \"0.05\" }" \
  | jq '{ vaultAddress, amount, signUrl }'
```

Notify the user with the returned `signUrl` — they sign one transaction and the funds land back in their wallet.

## Surfaces

This skill uses CTRL's **anonymous REST API** (`/api/mcp/*`, no key) — the canonical surface for wallet-native agents, since the wallet signature at activate-time is the trust boundary. CTRL also runs a key-gated JSON-RPC MCP server at the same base for desktop clients (Cursor, Claude Desktop) where tool execution needs an `sk_ctrl_` key; both drive identical workflows. For an aeon skill, stick with REST.

## Sandbox note

`/api/mcp/block-catalog`, `/api/mcp/workflows` (POST), `/api/mcp/vault-status`, and `/api/mcp/execution-logs` are public over HTTPS with no auth headers. `/api/mcp/activate/<id>` is NOT public — never try to call it from the agent; it requires a wallet-authenticated session and is what the landing page invokes for the user.

## Constraints

- **Never auto-sign.** The wallet popup on the activate landing page is the trust boundary; the agent only hands the user the URL.
- **Never embed caps in the workflow body.** `vaultCaps` is not a workflow field — caps are set when the user signs activate (`maxPerSwapEth`, `maxPerDayEth`, decimal strings).
- **Match slippage to the use case.** Catalog default is 15 (= 15%) which is correct for sniping and disastrous for stable-pair DCA. For DCA / ETH↔USDC use 0.5–2. For memecoin snipes 10–15.
- **No trade advice.** If the intent is "buy X because it will moon", refuse and log `CTRL_REJECTED_ADVICE`. CTRL is execution infrastructure, not a signal source.
- **One workflow per invocation.** Multi-step strategies → chain blocks inside one workflow (`trigger → swap → notify`), not multiple skill runs.
- **Base only.** Always set `chain: "base"`, `network: "mainnet"`. Any other chain → log `CTRL_CHAIN_UNSUPPORTED` and exit. Note: the create endpoint will accept other chain strings (it does not validate), so the agent itself is the gate.

## Resources

- App — https://ctrl.build
- Docs — https://ctrl.build/docs
- MCP hub — https://ctrl.build/mcp
- Source — https://github.com/CTRLabs/ctrl-skill

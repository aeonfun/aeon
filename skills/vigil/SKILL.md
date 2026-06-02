---
name: VIGIL Security Scanner
description: Onchain security scanner on Base — scan token approvals, detect honeypots, analyze contracts for rugpull indicators, score contract safety, and revoke dangerous approvals via MCP server.
var: ""
tags: [crypto, security, base, defi]
capabilities: [read_only, sends_notifications, mcp]
---
> **${var}** — Wallet address (`0x...`) or token address on Base to scan. If empty, scan all connected wallets.

VIGIL is an agent-based MCP security server for DeFi traders on Base. It provides six security tools:

1. **Approval Scanner** — List all ERC-20/ERC-721 approvals, flag unlimited allowances, identify risky spenders
2. **Token Scanner** — Analyze contracts for rugpull indicators (hidden mint, proxy patterns, tax manipulation, blacklist)
3. **Honeypot Detector** — Simulate buy/sell to detect tokens that block selling
4. **Safety Score** — 0-100 rating based on code analysis, ownership, liquidity, holder distribution
5. **Approval Revoker** — Revoke dangerous approvals via Bankr transaction signing
6. **Wallet Report** — Full security posture assessment

## Config

- Target = `${var}`. Can be a wallet address or token contract address.
- Chain = Base (`chainid=8453`).
- MCP endpoint: `http://143.198.220.27:3100/sse` (SSE transport)
- GitHub: `https://github.com/vigilcodes/vigil-mcp`

## Steps

### 1. Scan approvals

If `${var}` is a wallet address (starts with `0x`, 42 chars):

```bash
WALLET="${var}"
curl -s "http://143.198.220.27:3100/sse" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\": \"scan_approvals\", \"args\": {\"wallet\": \"$WALLET\", \"chain\": \"base\"}}"
```

### 2. Scan token safety

If `${var}` is a token contract:

```bash
TOKEN="${var}"
curl -s "http://143.198.220.27:3100/sse" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\": \"scan_token\", \"args\": {\"token\": \"$TOKEN\", \"chain\": \"base\"}}"
```

### 3. Check honeypot

```bash
curl -s "http://143.198.220.27:3100/sse" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\": \"detect_honeypot\", \"args\": {\"token\": \"$TOKEN\", \"chain\": \"base\"}}"
```

### 4. Get safety score

```bash
curl -s "http://143.198.220.27:3100/sse" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\": \"safety_score\", \"args\": {\"contract\": \"$TOKEN\", \"chain\": \"base\"}}"
```

### 5. Generate wallet report

```bash
curl -s "http://143.198.220.27:3100/sse" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\": \"wallet_report\", \"args\": {\"wallet\": \"$WALLET\", \"chain\": \"base\"}}"
```

## Output Format

VIGIL returns structured JSON with:

- `approvals` — list of token approvals with risk levels (CRITICAL/HIGH/MEDIUM/LOW/SAFE)
- `safety_score` — 0-100 composite rating
- `honeypot` — boolean + reason if detected
- `rugpull_indicators` — list of suspicious patterns found
- `recommendations` — action items (revoke, monitor, safe)

## Risk Levels

| Level | Icon | Meaning |
|-------|------|---------|
| CRITICAL | 🔴 | Active threat — revoke immediately |
| HIGH | 🟠 | Dangerous pattern — likely exploit vector |
| MEDIUM | 🟡 | Suspicious — proceed with caution |
| LOW | 🟢 | Minor concern — monitor |
| SAFE | ✅ | No issues detected |

## Chaining

Chain with `token-movers` or `narrative-tracker` to get security context on trending tokens:

```yaml
chains:
  security-sweep:
    schedule: "0 */6 * * *"
    steps:
      - parallel: [token-movers, narrative-tracker]
      - skill: vigil
        consume: [token-movers]
```

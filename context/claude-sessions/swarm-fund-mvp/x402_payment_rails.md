---
name: x402 payment rails — Base mainnet, live and settling
description: First paid agent x402 transaction confirmed 2026-04-25 via bankr_bridge using @x402/fetch v2; bridge is the canonical Python→x402 path for hermes-cascade / bankr-social-momentum
type: project
originSessionId: 3ca7274e-999b-461c-b163-3e469018f0a8
---
**Live, settling, verified.** First Python-controlled agent x402 micropayment landed on Base mainnet 2026-04-25.

**Receipt of record:**
- TX: agoragentic text-summarizer (`/v1/text-summarizer`), 0.10 USDC, decision hash `0x140953dc...3879c464`, receipt `rcpt_1764b016-9b62-427b-95a3-ada697b3dbff`.
- Funded TX: `0xc9eb24601eac3abeb8f61ca90ff40931d89161081305921a0e9601f8334ea0f0` (50 USDC from `0xac4e96d3...0fc1`).
- Wallet: `0x97E246193a7fB9A1EAb6e017edEAb85ec761ca06` (configured via `BANKR_X402_WALLET` + `BANKR_X402_PRIVATE_KEY` in `.env`).
- Post-tx balance: 49.9005 USDC, 0 ETH (gas-less via EIP-3009 transferWithAuthorization).

**The bridge** — `bankr_bridge/bridge.mjs`:
- Uses `@x402/fetch` v2 + `@x402/evm` v2 + `viem`. Do NOT use `x402-fetch` v1 — its schema is incompatible with the live x402 edge.
- Two commands: `balance` (USDC + ETH on Base) and `fetch <url> [--max=USDC] [--method=] [--body=]`.
- Selector signature is `(x402Version, requirements[]) → requirement` — not just `(requirements[])`. The v1 signature errors with "requirements is not iterable" against v2 endpoints.
- Network strings are CAIP-2 (`eip155:8453`), not legacy short names (`base`).
- All payment metadata (status, receipt, decision_hash, payer, settled amount) returned as JSON to stdout for Python consumption.

**How the Python adapter uses it.** `python/execution/bankr_adapter.py` (parallel session's stub) subprocess-calls the bridge for any x402-protected URL. Typical wiring per agent:
```python
result = subprocess.run(
    ["node", "bankr_bridge/bridge.mjs", "fetch", url,
     "--max=0.10", "--method=POST", f"--body={json.dumps(body)}"],
    capture_output=True, text=True, env={...os.environ, "BANKR_X402_PRIVATE_KEY": pk},
)
data = json.loads(result.stdout)
```

**Cost envelope.** $0.10 USDC × ~10 calls/agent/day × 250 agents ≈ $7,500/mo at saturation, but realistic budget is ~$300–500/mo because most agents call free public APIs. Per-agent spend is logged in `eval_log.jsonl` via the `payer_wallet`/`receipt_id` fields returned by the bridge.

**Available x402 endpoints (live verified):**
- `https://x402.agoragentic.com/v1/text-summarizer` (POST, $0.10) — verified
- `https://x402.agoragentic.com/v1/web-scraper` (POST) — listed, not yet tested
- `https://x402.agoragentic.com/v1/whisper-transcription` (POST) — listed, not yet tested
- More at `https://x402.agoragentic.com/services/index.json` and `https://www.x402.org/ecosystem` (250+ ecosystem partners)

**Why this matters for the swarm.** Two families in `docs/plans/2026-04-25_canary-acceleration.md` (`Bankr-Avantis-Macro`, `Bankr-Social-Momentum`) were blocked on x402 rails. Now unblocked — they can pay-per-call for premium signal data without infra changes beyond the bridge subprocess.

**Don't forget.** Bridge runs on Mac side (Path A); same wiring will survive the EC2 migration (Path B) without changes — Node + viem + @x402/fetch all work identically on Linux. No co-lo concerns for x402 since the wallet does the signing locally and the facilitator settlement happens at Coinbase CDP regardless of caller location.

**Related:**
- `polymarket_datacenter_ban.md` — PM datacenter-IP issue does NOT apply to x402 (different rails)
- `feedback_latency_gated_on_edge.md` — x402 is plumbing, not edge; no Tier-1 latency claim from this
- `~/.claude/projects/-Users-scaria-swarm-fund-mvp/memory/MEMORY.md` — index entry below

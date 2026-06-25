---
mode: read-only
name: BEAMR Route
category: crypto
description: Route a prompt through a BEAMR x402 gateway and report the answer + onchain receipt
var: ""
tags: [crypto, dev]
requires: [BEAMR_GATEWAY_URL, BEAMR_PAYER_KEY]
---
> **${var}** — The prompt to send through BEAMR (e.g. `"Summarize the latest x402 spec changes"`). **Required.** If empty, abort cleanly with a notify.

Today is ${today}. Send `${var}` to a BEAMR inference gateway, pay for that single call over x402 (USDC on Base), and report the answer alongside the onchain settlement receipt.

BEAMR is an OpenAI-compatible **inference router**: it classifies the request, routes it to the cheapest capable provider, runs the completion, and settles the exact cost per call in USDC on Base via the x402 `exact` scheme. This skill is the buyer side — it pays a fraction of a cent and gets back both the model output and the settlement tx hash, so a run produces a verifiable onchain artifact, not just text.

Read `memory/MEMORY.md` for context before starting.

## Steps

1. **Guard the input.** If `${var}` is empty, do not proceed:
   ```bash
   if [ -z "$SKILL_VAR" ]; then ./notify "beamr-route skipped: no prompt — pass var=\"your question\""; exit 0; fi
   ```
   (`SKILL_VAR` carries `${var}` through the environment so embedded `$`/quotes in the prompt aren't mangled by the shell.)

2. **Skip gracefully if unconfigured.** This skill needs a BEAMR deployment and a funded payer wallet. If either secret is not set, skip rather than fail:
   ```bash
   if [ -z "$BEAMR_GATEWAY_URL" ] || [ -z "$BEAMR_PAYER_KEY" ]; then
     ./notify "beamr-route skipped: set BEAMR_GATEWAY_URL and BEAMR_PAYER_KEY (a low-balance USDC-on-Base wallet) to enable"; exit 0
   fi
   ```

3. **Ensure the x402 client is available.** The payment client depends on `x402-fetch` (which pulls `viem`). Install on demand if missing:
   ```bash
   node -e "require.resolve('x402-fetch')" 2>/dev/null || npm install --no-save x402-fetch >/dev/null 2>&1
   ```

4. **Pay and infer.** Run the client with the prompt. It handles the full `402 → sign X-PAYMENT → retry → receipt` handshake and prints one JSON line. The per-call spend is capped by `BEAMR_MAX_PAY_USDC` (default `0.05`) — an offer above the cap throws rather than overpaying.
   ```bash
   RESULT=$(node skills/beamr-route/scripts/beamr-pay.mjs "$SKILL_VAR")
   echo "$RESULT"
   ```

5. **Handle the result.** Parse the JSON.
   - If `.ok` is `false`, notify the error and stop: `./notify "beamr-route failed: <error>"`.
   - If `.ok` is `true`, extract `.answer`, `.model`, `.usage`, and `.settlement` (`.txHash`, `.network`, `.payer`). When a settlement is present, build a block-explorer link: `https://basescan.org/tx/<txHash>` for `base`, or `https://sepolia.basescan.org/tx/<txHash>` for `base-sepolia`. A `null` settlement means the answer came free (cache hit or paywall off) — say so.

6. **Notify.** Send a concise message: the question, the answer, then a one-line footer with the model BEAMR chose, token usage, and the settlement link (or "free — served from cache"). Keep the answer readable; don't dump raw JSON.
   ```bash
   ./notify -f .pending-notify-temp/beamr-route-${today}.md
   ```

7. **Log.** Append a one-line entry to today's `memory/logs/${today}.md`: the prompt, the chosen model, the cost, and the tx hash — so repeat questions and spend are auditable over time.

## Notes

- **Use a dedicated, low-balance wallet** for `BEAMR_PAYER_KEY` and keep `BEAMR_MAX_PAY_USDC` small — like every skill secret, it is exposed to the run environment.
- `BEAMR_NETWORK` (default `base-sepolia`) must match the gateway's network; set it to `base` for mainnet.
- `BEAMR_MODEL` defaults to `auto`, letting BEAMR's router pick the model. Set a specific id to pin one.
- BEAMR's paywall meters the non-streaming path only, so the client always sends `stream:false`.

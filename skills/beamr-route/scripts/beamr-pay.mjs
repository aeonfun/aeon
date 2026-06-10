#!/usr/bin/env node
/**
 * beamr-pay — send one prompt to a BEAMR gateway and pay for it over x402.
 *
 * BEAMR is an OpenAI-compatible inference router: it classifies the request,
 * routes it to the cheapest capable provider, and (with its seller paywall on)
 * charges the caller per call in USDC on Base via the x402 `exact` scheme.
 * This script does the buyer side — `wrapFetchWithPayment` catches BEAMR's 402
 * offer, signs an `X-PAYMENT` header within BEAMR_MAX_PAY_USDC, and retries —
 * then prints a single JSON object the skill can parse.
 *
 * The paywall meters the non-streaming path only, so this sends stream:false.
 *
 * Output (stdout): one line of JSON —
 *   { "ok": true, "answer": "...", "model": "...", "usage": {...},
 *     "settlement": { "txHash": "0x..", "network": "base", "payer": "0x.." } | null }
 * On failure: { "ok": false, "error": "..." } and a non-zero exit.
 *
 * Env:
 *   BEAMR_GATEWAY_URL   (required) base URL of the BEAMR deployment
 *   BEAMR_PAYER_KEY     (required) 0x-hex key of a funded wallet (USDC on Base)
 *   BEAMR_NETWORK       base | base-sepolia (default base-sepolia)
 *   BEAMR_MODEL         model id or "auto" (default auto)
 *   BEAMR_MAX_PAY_USDC  per-call ceiling in USDC (default 0.05)
 */

import { createSigner, wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";

const out = (obj, code = 0) => {
  process.stdout.write(JSON.stringify(obj) + "\n");
  process.exit(code);
};

async function main() {
  const baseUrl = process.env.BEAMR_GATEWAY_URL;
  const key = process.env.BEAMR_PAYER_KEY;
  if (!baseUrl) out({ ok: false, error: "BEAMR_GATEWAY_URL not set" }, 2);
  if (!key) out({ ok: false, error: "BEAMR_PAYER_KEY not set" }, 2);

  const network = process.env.BEAMR_NETWORK || "base-sepolia";
  const model = process.env.BEAMR_MODEL || "auto";
  const maxUsd = Number(process.env.BEAMR_MAX_PAY_USDC || "0.05");

  const prompt = process.argv.slice(2).join(" ").trim();
  if (!prompt) out({ ok: false, error: "no prompt argument" }, 2);

  // USDC is 6-decimal; the cap is a hard ceiling — an offer above it throws.
  const maxAtomic = BigInt(Math.round(maxUsd * 1e6));
  const signer = await createSigner(network, key);
  const fetchWithPay = wrapFetchWithPayment(fetch, signer, maxAtomic);

  const url = new URL("/api/v1/chat/completions", baseUrl).toString();
  const res = await fetchWithPay(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const text = await res.text();
  if (!res.ok) out({ ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` }, 1);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    out({ ok: false, error: `non-JSON response: ${text.slice(0, 200)}` }, 1);
  }

  const receiptHeader = res.headers.get("x-payment-response");
  const receipt = receiptHeader ? decodeXPaymentResponse(receiptHeader) : null;

  out({
    ok: true,
    answer: body?.choices?.[0]?.message?.content ?? "",
    model: body?.model ?? model,
    usage: body?.usage ?? null,
    trace: res.headers.get("x-beamr-trace") || null,
    settlement: receipt
      ? { txHash: receipt.transaction, network: receipt.network, payer: receipt.payer }
      : null,
  });
}

main().catch((e) => out({ ok: false, error: e?.message ?? String(e) }, 1));

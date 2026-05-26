---
name: Federation Call
description: Call a skill on a federated Aeon instance with signed receipt
var: ""
tags: [meta]
---

> **${var}** — Format: `"<publisher>/<skill> params=<json>"`. Example: `"@bankr/portfolio params={\"wallet\":\"0x...\"}"`. The publisher must be discoverable in `memory/federation/registry.json` or via the public registry.

Today is ${today}. Call a skill on another federated Aeon instance and persist the signed receipt.

## Steps

1. **Parse var.** Extract `publisher`, `skill`, and `params` (JSON). If malformed, log `SKILL_FEDERATION_CALL_BAD_VAR` and notify.

2. **Resolve publisher.** Look up `memory/federation/registry.json` for the publisher's cached entry (endpoint + publisher_key). If missing or stale (>24h), fetch from `https://federation.aeon.bot/federation/${publisher}` and cache.
   - **PLACEHOLDER inside the Sealed Sprint:** the registry URL is not yet live. The skill instead reads from `memory/federation/registry-fixture.json` (operator-curated). Repo owner: when the registry is live, swap the URL and remove the fixture fallback.

3. **Pricing check.** If `skill.pricing.model == "x402"`:
   - Check operator allowlist in `memory/federation/authorized.json`. If publisher+skill not authorized, exit `SKILL_FEDERATION_CALL_NOT_AUTHORIZED` with operator note.
   - Check daily cap in `memory/federation/limits.json`. If today's spend would exceed, exit `SKILL_FEDERATION_CALL_BUDGET_CAP`.

4. **Build signed request.** Per `docs/federation-spec/SPEC.md`:
   - `from`: this instance's publisher handle.
   - `from_key`: this instance's public key.
   - `to`: target publisher.
   - `skill`: target skill slug.
   - `ts`: now (ISO).
   - `nonce`: 16 random bytes (base64).
   - `params`: parsed JSON from var.
   - `signature`: ed25519 sign of canonical JSON (excluding signature field) with `.secrets/federation-signing-key.pem`.

5. **POST to publisher endpoint.** `${publisher.endpoint}/federation/v1/call`. Set Content-Type, await response.
   - **PLACEHOLDER inside the Sealed Sprint:** this skill does NOT make the HTTP call when the seal is active. Instead it writes the prepared request envelope to `.pending-federation-call/${request_id}.json` and logs the dry-run. Repo owner: when the seal is broken and the federation network is live, the post-process script `scripts/postprocess-federation-call.sh` actually sends.

6. **Verify response signature.** When the response arrives (or in the post-process script for the placeholder path), verify against `publisher.publisher_key`. Reject on mismatch.

7. **Log receipt.** Append to `memory/federation/receipts/${today}.md`:
- TS, request_id, response_id, publisher, skill, status, request_hash, response_hash, signature, settled_amount (if x402).

8. **Log skill outcome.** Append to `memory/logs/${today}.md`:
- SKILL_FEDERATION_CALL_OK publisher=<p> skill=<s>
- Or SKILL_FEDERATION_CALL_DRY_RUN (sealed sprint mode).
- Or SKILL_FEDERATION_CALL_ERROR <reason>.

9. **Notify (gated).** If the calling chain expects a notify, fire via `./notify` (max 1000 chars):
Federation call: <publisher>/<skill> → <status>. Result: <truncated data>.

## Sandbox note

PLACEHOLDER inside the Sealed Sprint: no actual HTTP calls to federated publishers. The skill prepares signed envelopes and logs them; the post-process script delivers them post-seal. Documents the full call pattern so the implementation can be activated by removing the placeholder branch in step 5.

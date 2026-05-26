# Aeon Federation Protocol — federation/1

> **Status:** Draft. Scaffolded in the Sealed Sprint (Session 03, 2026-05-26). Author + co-maintainer review pending before publication.

A cross-instance call protocol for Aeon. Lets Aeon instances discover, invoke, verify, and (optionally) settle with each other.

---

## Overview

Federation extends Aeon from a single-instance framework into a network of cooperating instances. Each instance is identified by a publisher key (ed25519). Each call between instances is cryptographically signed end-to-end. Calls can optionally settle through HTTP-native micropayments (x402); free skills don't engage that path.

The protocol is **versioned**: this is `federation/1`. Future revisions ship as `federation/2`, `/3`, etc. — version negotiation happens in the well-known manifest.

## The well-known manifest

Each participating instance publishes `well-known/aeon-federation.json` at its endpoint root. Schema:

```json
{
  "schema": "aeon-federation/1",
  "publisher": "@bankr",
  "publisher_key": "ed25519:base64...",
  "endpoint": "https://aeon.bankr.bot/a2a",
  "operator": "aaronjmars",
  "version": "2026-05-26",
  "skills": [
    {
      "name": "bankr-portfolio",
      "slug": "bankr-portfolio",
      "description": "Returns the portfolio for a wallet on Base",
      "input_schema": { "wallet": "string (0x[a-f0-9]{40})" },
      "output_schema": { "tokens": "array", "total_usdc": "number" },
      "pricing": {
        "model": "free",
        "amount_usdc": null,
        "endpoint": null
      },
      "sla": { "p95_latency_ms": 800, "uptime_pct": 99.5 },
      "tags": ["crypto", "wallet"]
    }
  ],
  "extensions": [],
  "withdrawn": false
}
```

Fields:

- `schema` — always `aeon-federation/1` for this version.
- `publisher` — human-readable handle, `@`-prefixed. Unique within the federation registry.
- `publisher_key` — the ed25519 public key that signs every payload from this publisher.
- `endpoint` — base URL of the publisher's A2A gateway.
- `operator` — GitHub handle of the human who owns this instance. Auditable.
- `version` — date-stamped manifest version. Bump when the published skill set changes.
- `skills[]` — array of federation-published skills (a subset of the instance's full catalog).
  - `pricing.model` — one of `free`, `x402`, `subscription`.
  - `pricing.amount_usdc` — for `x402`, the per-call price.
  - `pricing.endpoint` — for `x402`, the payment endpoint (HTTP 402 challenge target).
- `extensions[]` — array of extension identifiers (`federation/1.1.x402`, etc.). Discoverable but optional.
- `withdrawn` — when `true`, the publisher has retired; consumers should stop calling.

## Signed request envelope

Every cross-instance call uses this envelope:

```json
{
  "schema": "aeon-federation-request/1",
  "id": "req-<ulid>",
  "from": "@aeon-prime",
  "from_key": "ed25519:base64...",
  "to": "@bankr",
  "skill": "bankr-portfolio",
  "ts": "2026-05-26T15:00:00Z",
  "nonce": "<random 16 bytes base64>",
  "params": { "wallet": "0xabc..." },
  "x402_proof": null,
  "signature": "ed25519:base64..."
}
```

The signature covers everything except itself, computed over the canonicalized JSON. Replay protection: receivers reject requests with `ts > now + 60s`, `ts < now - 300s`, or a previously-seen `nonce` within a 1h window.

## Signed response envelope

```json
{
  "schema": "aeon-federation-response/1",
  "id": "res-<ulid>",
  "in_reply_to": "req-<ulid>",
  "from": "@bankr",
  "from_key": "ed25519:base64...",
  "ts": "2026-05-26T15:00:02Z",
  "status": "ok | error | denied | partial",
  "data": { "tokens": [...], "total_usdc": 1234.56 },
  "error": null,
  "audit_ref": "evt-<ulid>",
  "signature": "ed25519:base64..."
}
```

The caller verifies the signature against the publisher's `publisher_key` from the registry.

## Error taxonomy

```
unknown_skill          — the to.skill is not in the publisher's manifest
invalid_signature      — request signature doesn't verify against from_key
replay                 — ts out of window OR nonce seen recently
not_allowed            — caller not on publisher's allowlist (for non-public skills)
payment_required       — x402 challenge; response includes the payment endpoint
payment_invalid        — x402_proof did not verify
rate_limited           — caller exceeded per-skill quota
withdrawn              — publisher has withdrawn from the federation
internal_error         — skill execution failed; data may include details
```

## Version negotiation

The well-known manifest's `schema` field is the version. A caller built for `federation/1` rejects manifests with newer major versions (`federation/2`, etc.) unless it explicitly supports them. Extensions (`federation/1.x.*`) are optional — callers ignore extensions they don't understand.

`federation/1` is permanent — once published, no breaking changes. Additive changes (new optional fields) require an `extensions[]` entry.

## Registry

Discovery is delegated to a separate Registry — see `docs/federation-spec/REGISTRY.md` (to be written). Registries serve a public catalog of participating publishers. Anyone can run a Registry; consumers can configure which Registry to trust. Reference Registry hosted at `federation.aeon.bot` (planned; PLACEHOLDER inside the Sealed Sprint).

## Trust model

- The Registry is a discovery layer, not a trust root. Compromised Registry can serve incorrect endpoint URLs but cannot forge signatures.
- The signature chain is the trust root: signed requests + signed responses + ed25519 public keys.
- Operators maintain their own `memory/federation/authorized.json` allowlist for which publishers they trust (especially for paid calls).
- Reputation accrues at the publisher level, not the Registry level.

See `docs/federation-spec/SECURITY.md` for the full threat model.

## What's NOT in federation/1

- Multi-hop calls (A → B → C). Out of scope; each instance owns its skill outputs.
- Streaming responses. Single-request/single-response only. Streaming is a federation/1.streaming extension proposal.
- Mutual TLS / mTLS. Signatures are the auth; TLS at the transport is the network's job.
- Subscriptions / push. The `subscription` pricing model is a placeholder; push delivery isn't specified in v1.

## Related

- `docs/federation-spec/SECURITY.md` — threat model (to be written).
- `docs/federation-spec/REGISTRY.md` — registry spec (to be written).
- `docs/contributor-dossier/03-subsystems/federation.md` — system-level overview.
- `well-known/aeon-federation.json` — reference manifest.
- `docs/contributor-dossier/09-EXPANSION-OPTIONS.md` § Option #3.

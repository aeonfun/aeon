# Federation Security — Threat Model

> Companion to [`SPEC.md`](SPEC.md). Scaffolded in the Sealed Sprint (Session 03). Reviewed by us + author before publication.

---

## Trust assumptions

The federation has **no central trust authority**. Every property in the system reduces to one of three primitives:

1. **The publisher's ed25519 private key** — held by the operator, used to sign manifests and responses.
2. **The caller's ed25519 private key** — held by the operator, used to sign requests.
3. **The Registry** — discovery only. *Not* trusted for content correctness.

If a publisher's private key is compromised, an attacker can publish arbitrary signed payloads as that publisher. Mitigations: keep keys in `.secrets/` (gitignored), rotate via the federation-publish bootstrap, allow allowlist revocation per publisher.

If a caller's private key is compromised, an attacker can issue arbitrary calls. Mitigations: same as publisher; in addition, x402 amounts are gated by the caller's `limits.json` daily cap.

## Threats and mitigations

| Threat | Mitigation |
|---|---|
| **Signature forgery** | ed25519, full payload coverage including the `from_key` field. |
| **Replay attacks** | `ts` window (60s future, 5m past) + `nonce` deduplication for 1h. |
| **MitM** | TLS at transport (HTTPS). Signatures are end-to-end; TLS terminating proxies cannot tamper without breaking the signature. |
| **Registry tampering** | Registry serves endpoint + key; consumer verifies signatures using the cached key. Tampered URLs surface as "no signature match" or "publisher disappeared" — both noisy. |
| **Sybil publishers in registry** | Manual seed list initially; later rate-limit + cluster-detection by behavior. ECOSYSTEM.md listing remains separate (curated). |
| **Hostile publisher serves poisoned outputs** | Per-call signature verification + reputation scoring + operator allowlist. Operator can revoke trust per-publisher or per-skill. |
| **DoS via paid-call flood** | Daily USDC cap in `memory/federation/limits.json`. x402 challenge is per-call. |
| **DoS via free-call flood** | Per-publisher rate limit at the caller's `federation-call` skill; per-caller rate limit at the publisher's A2A gateway. |
| **Sensitive data exfiltration** | Federation calls cross trust boundaries. Publishers MUST treat call params as untrusted (same rule as RSS/tweets). Publishers SHOULD scrub PII before responding. |
| **Withdrawal not respected** | Caller-side: refresh registry hourly; reject calls to publishers with `withdrawn: true` in the cached manifest. Publishers cannot prevent their data from being cached forever — withdrawal is a *signal*, not an *erasure*. |
| **Compromised operator account on GitHub** | Operator's local `gh` auth is the local-control boundary. Federation does not add new risk here — `gh` compromise was already total. |
| **x402 settlement disputes** | Receipts are signed end-to-end; both sides have cryptographic proof of what was requested and returned. Settlement uses the x402 chain's own dispute mechanism. |

## What federation does NOT protect against

- **Bad publisher logic.** A federation call to a publisher whose skill returns garbage is still a successful call. Reputation handles this over time; in the short term, the operator allowlist is the trust boundary.
- **Code supply chain in the Aeon repo.** `skill-security-scan` + `trusted-sources.txt` handle that — not federation's problem.
- **Compromised local machine.** If the operator's dev machine is compromised, the private key leaks; federation becomes a vector for attacker-as-this-instance calls. Federation's protection is bounded by local security.
- **Operator misjudgment of trust.** If the operator authorizes a hostile publisher, the publisher can issue arbitrary signed responses. The operator's `federation-trust` skill is the audit + revocation tool.

## Audit trail

Every federation call produces:

- Signed request envelope (stored in caller's `.pending-federation-call/${request_id}.json` and `memory/federation/receipts/${today}.md`).
- Signed response envelope (stored in caller's receipts log).
- Both publisher's and caller's keys are recorded in the receipt.

Receipts are append-only and committed to the caller's repo. The publisher's side is symmetric — they log every incoming call in their own `memory/federation/incoming/${today}.md`.

This trail is the basis for post-incident analysis: if a publisher served bad data, the receipt proves what was returned + when + by which key.

## Open security questions

These need explicit decisions before federation goes live:

- Rotation policy for publisher keys (cadence, signal mechanism).
- Whether `federation-call` should refuse to call a publisher whose `version` (in manifest) is older than N days.
- Whether x402 receipts should be mirrored to an on-chain attestation (EAS, Verax) for non-repudiation.
- Whether the Registry should sign its own responses (defense-in-depth against DNS-rebinding-style attacks on the registry URL).
- Reputation primitive design — pure follow-graph, or weighted by call success rate, or third-party rater.

Each captured in [`../contributor-dossier/08-OPEN-QUESTIONS.md`](../contributor-dossier/08-OPEN-QUESTIONS.md) at sprint close.

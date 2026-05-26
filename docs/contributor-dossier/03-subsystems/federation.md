# Subsystem: Federation

Cross-instance protocol for Aeon. Lets instances discover, call, verify, and (optionally) settle with each other. The substrate for the Agora (Session 09) and a positioning shift from "framework" to "protocol."

> **Status:** Scaffolded inside the Sealed Sprint (Session 03). Spec is in place; three per-instance skills shipped; reference well-known manifest committed (with placeholder identity). Registry Worker + signed-call execution path are PLACEHOLDERS — the seal explicitly forbids the HTTP calls; the post-process pattern is documented for repo-owner activation.

---

## At a glance

| Property | Value |
|---|---|
| Implemented | Session 03 scaffold (Sealed Sprint, 2026-05-26) |
| Spec | [`docs/federation-spec/SPEC.md`](../../federation-spec/SPEC.md) |
| Reference manifest | [`well-known/aeon-federation.json`](../../../well-known/aeon-federation.json) |
| Per-instance skills | [`federation-publish`](../../../skills/federation-publish/SKILL.md), [`federation-call`](../../../skills/federation-call/SKILL.md), [`federation-trust`](../../../skills/federation-trust/SKILL.md) |
| Signing | ed25519 (key in `.secrets/federation-signing-key.pem`, gitignored) |
| Discovery | Public registry at `federation.aeon.bot` (PLACEHOLDER — not yet live) |
| Settlement | Optional x402 micropayments; free tier always works |
| Trust root | The publisher_key signature chain. Registry is discovery only, not trust. |

## The flow

```
            Publisher instance                       Caller instance
            ─────────────────                        ───────────────
  1. federation-publish skill creates                
     well-known/aeon-federation.json                 
     (signed, published at endpoint root)            
                  │                                  
                  ▼                                  
            Registry crawler (federation.aeon.bot)   
            polls every N minutes,                   
            caches publisher_key + endpoint          
                                              ◀─────  2. Caller fetches registry
                                                        memory/federation/registry.json
                                                          │
                                                          ▼
                                              ◀─────  3. federation-call skill:
                                                        - resolves target publisher
                                                        - checks operator allowlist
                                                        - signs request envelope
                                                        - POSTs to publisher endpoint
            ┌─────────────────                          (or, inside the seal: writes
            │  A2A gateway                              .pending-federation-call/*.json
            │  receives signed                          for post-process delivery)
            │  request,                                       │
            │  verifies signature,                            ▼
            │  invokes local skill,                    ┌──────────┐
            │  signs response,                         │ scripts/ │
            │  returns it                              │postprocess│
            │                                          │ -fed-    │
            ▼                                          │ call.sh  │
            ───────────────────────────────────────────┴──────────┘
                  signed response envelope
                                                          │
                                                          ▼
                                                    4. Caller verifies
                                                       publisher signature,
                                                       logs receipt to
                                                       memory/federation/
                                                       receipts/${today}.md
```

## What's shipped vs PLACEHOLDER

| Component | Status | Notes |
|---|---|---|
| Protocol spec | ✅ shipped | `federation/1`, signed envelopes, error taxonomy, version negotiation |
| `well-known/aeon-federation.json` reference | ✅ shipped | Empty `skills[]`, `withdrawn: true`, placeholder identity |
| `federation-publish` skill | ✅ shipped | Bootstraps identity, builds manifest, signs |
| `federation-call` skill | ⚠ scaffolded | Builds + signs envelope; HTTP delivery deferred to post-process script (placeholder) |
| `federation-trust` skill | ✅ shipped | Pure local mutation — works as-is |
| `scripts/postprocess-federation-call.sh` | ❌ PLACEHOLDER | Repo owner writes this when the federation network is live |
| Registry Worker (`aeon-federation-registry` repo) | ❌ PLACEHOLDER | Separate repo + Cloudflare account needed; documented in spec |
| x402 client | ❌ PLACEHOLDER | Wait for x402 production; document path in `docs/federation-spec/X402.md` post-seal |
| MCP / A2A registration of `federation-call` as a callable tool | ⚠ scaffolded | Skill works locally; broader exposure deferred |

## Activating post-seal

When the operator and author decide to bring federation live:

1. **Stand up the registry.** Either deploy `aeon-federation-registry` Worker, or use a curated `memory/federation/registry.json` fixture.
2. **Bootstrap identity.** `./aeon-cli federation-publish init` (the skill prose tells the operator). Generates ed25519 keypair; private goes to `.secrets/` (gitignored), public goes into `well-known/aeon-federation.json`.
3. **Set the operator handle.** Edit `well-known/aeon-federation.json` — replace `PLACEHOLDER-github-handle` and the `endpoint` URL.
4. **Mark skills as federated.** In `aeon.yml`, add `federation_publish: true` to skills that should be published. Re-run `federation-publish` to refresh the manifest.
5. **Write the post-process script.** `scripts/postprocess-federation-call.sh` reads `.pending-federation-call/*.json`, sends each, verifies the response signature, writes the result. Pattern matches `scripts/postprocess-devto.sh`.
6. **Authorize peers.** `./aeon-cli federation-trust "+@bankr"` (or whichever publishers).
7. **Flip `withdrawn: false`.** This is the public commitment.

## Security model

See [`../05-SECURITY.md`](../05-SECURITY.md) (and the planned `docs/federation-spec/SECURITY.md`). Key properties:

- **Signature chain is the trust root.** Compromised Registry can serve wrong URLs but cannot forge call payloads.
- **Replay protection** via nonce + timestamp window (60s future tolerance, 5m past tolerance).
- **Operator opt-in per peer.** `memory/federation/authorized.json` is the allowlist; no auto-trust.
- **Withdrawal is honored.** A publisher setting `withdrawn: true` stops being callable; callers should respect this within one registry refresh.
- **No central kill switch.** The Registry can go down; instances can mirror it; signatures still verify offline.

## Why this matters

Federation is the foundation for:

- **Option #9 — The Agora.** Agents publishing posts to each other → public glass-box timeline. Builds on federation publisher_key + signed envelopes.
- **Cross-instance skill ecosystems.** Bankr publishes `portfolio`, Reg Terminal publishes `regulatory-risk`, x402Books publishes `treasury-snapshot` — any instance can call any of them.
- **Aeon-as-protocol positioning.** The framework becomes a protocol that lives beyond any single repo or maintainer.

## Related docs

- [`fleet.md`](fleet.md) — fleet observation that federation extends to active calling.
- [`a2a-server.md`](a2a-server.md) — the existing A2A surface that federation reuses for transport.
- [`../05-SECURITY.md`](../05-SECURITY.md) — supply chain + signing model.
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #3 — original PoC sketch.
- [`../_session-prompts/session-03-federation.md`](../_session-prompts/session-03-federation.md) — full session prompt.
- [`../_sprint-log/2026-05-26-full-menu.md`](../_sprint-log/2026-05-26-full-menu.md).

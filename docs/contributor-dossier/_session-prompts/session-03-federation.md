# Session 03 — Federation / Aeon-as-Protocol

> **Goal:** Turn the ~50 ecosystem instances into a federated network: cross-instance skill calls, signed receipts, optional x402 micropayments, public discovery. Aeon becomes a *protocol*, not just a framework.
>
> **Effort:** 6–12 weeks across 5 phases.
> **Risk:** High — protocol design has a long tail; once published, hard to change.
> **Author gate:** Yes — this is a strategic positioning decision. Confirm before Phase 1.
> **Reference:** [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #3.

---

## The prompt to paste

```
You are implementing the Aeon Federation Protocol. Read these dossier docs
first:
  - docs/contributor-dossier/01-ARCHITECTURE.md
  - docs/contributor-dossier/03-subsystems/a2a-server.md
  - docs/contributor-dossier/03-subsystems/fleet.md
  - docs/contributor-dossier/03-subsystems/integrations.md
  - docs/contributor-dossier/05-SECURITY.md
  - docs/contributor-dossier/09-EXPANSION-OPTIONS.md (Option #3 section)

Your task: design and ship a federation layer that lets Aeon instances
discover, call, settle with, and verify each other.

Architecture:
  - Per-instance: well-known/aeon-federation.json — signed manifest declaring
    publisher_key, endpoint, published skills, optional pricing.
  - Discovery: aeon-federation-registry (new repo) — Cloudflare Worker that
    crawls participating instances, serves a public registry at
    aeon.bot/federation. Pure read; no trust on its part.
  - Call mechanism: federation-call skill (new). Resolves publisher, signs
    request, calls A2A endpoint, verifies response signature.
  - Settlement: optional x402 micropayments. Free skills don't engage it.
  - Trust: ed25519 signatures end-to-end. Operator key in OPERATOR_SIG_KEY
    secret. Receipts logged to memory/federation/receipts/.

Constraints:
  - Federation is OPT-IN per skill via the publishing instance.
  - All calls cross-signed; the registry doesn't see request content.
  - x402 is optional; free tier always works.
  - Versioned protocol: federation/1 today; extension via /2 if needed.
  - No central kill switch. If aeon.bot/federation goes down, instances
    can mirror the registry.

Out of scope:
  - The agora UI (option #9; depends on this).
  - Cross-instance memory sync (separate concern).
  - On-chain settlement beyond x402.
  - Changing existing skill behavior.

Operate in feature branches: expansion/federation-*. Architectural decisions
should be discussed via PR comments before implementation.
```

---

## Punchlist

### Phase 1 — Spec + reference manifest (week 1–2)

- [ ] Write `docs/federation-spec/SPEC.md` — formal description of the federation/1 protocol.
  - well-known manifest schema (publisher, publisher_key, endpoint, skills[], pricing, sla).
  - Signed-request envelope (with replay protection via nonce + ts).
  - Signed-response envelope.
  - Error taxonomy.
  - Version negotiation.
- [ ] Write `docs/federation-spec/SECURITY.md` — threat model.
- [ ] Schema validation tooling (`./scripts/validate-federation-manifest`).
- [ ] Reference manifest for `aaronjmars/aeon` at `well-known/aeon-federation.json` (initially with zero published skills — just the publisher record).
- **Acceptance:** Spec is reviewed by author + us; reference manifest validates.

### Phase 2 — Discovery registry (week 3–4)

- [ ] New repo `aeon-federation-registry` (or `aeon-federation-worker`).
- [ ] Cloudflare Worker scheduled to crawl participating instances every 15 min.
- [ ] Sources: hard-coded seed list (initially `aaronjmars/aeon` + ecosystem partners willing to register). Manual addition via PR.
- [ ] D1 schema: `publishers(handle, publisher_key, endpoint, last_seen, withdrawn)`, `skills(publisher, slug, description, pricing, sla)`.
- [ ] Endpoints:
  - `GET /federation` — full registry, cached with ETag.
  - `GET /federation/<publisher>` — one publisher.
  - `GET /federation/skills?q=<query>` — search.
- [ ] Source open-sourced under MIT; deployment instructions for operator-hosted mirrors.
- **Acceptance:** Registry deployed at e.g. `federation.aeon.bot`; crawls and serves 3+ publishers.

### Phase 3 — Per-instance skills (week 5–6)

- [ ] `skills/federation-call/SKILL.md` — wraps the call flow (resolve → sign → call → verify → log).
- [ ] `skills/federation-publish/SKILL.md` — operator runs this to update their own well-known manifest with currently-published skills (reads from a new field `federation_publish: true` in aeon.yml entries).
- [ ] `skills/federation-trust/SKILL.md` — manage `memory/federation/authorized.json` (publisher allowlist for paid calls).
- [ ] Per-publisher key management: operator generates `OPERATOR_SIG_KEY` (ed25519), stored as repo secret. Public key derived and written to well-known manifest.
- [ ] Receipt format + storage (`memory/federation/receipts/${today}.md`).
- **Acceptance:** Operator can publish a skill, another operator can call it, both have signed receipts.

### Phase 4 — x402 integration (week 7–8)

- [ ] `skills/x402-client/SKILL.md` — wraps the HTTP-native payment loop (parse 402 response, send payment via x402 protocol, retry).
- [ ] `federation-call` checks `pricing.model == "x402"`, calls `x402-client` for the payment leg.
- [ ] Daily budget cap in `memory/federation/limits.json` (operator-set USDC per day).
- [ ] Receipts include settled amount + tx reference.
- [ ] Test integration with 1 ecosystem partner publishing a paid skill.
- **Acceptance:** End-to-end paid call works with daily-cap enforcement.

### Phase 5 — Publisher SDK + docs + reference integrations (week 9–12)

- [ ] Publisher SDK (TypeScript) — `npm install @aeon/federation-sdk`. Wraps signing, response verification, x402 plumbing for non-Aeon publishers who want to participate.
- [ ] Reference integration: 2 ecosystem partners publishing real skills (negotiate with Bankr + Reg Terminal team).
- [ ] Discovery search UI on `federation.aeon.bot` (search across federation).
- [ ] Operator runbook: how to publish, how to trust a publisher, how to debug a failed call.
- [ ] Update `docs/contributor-dossier/03-subsystems/integrations.md` with federation section.
- [ ] New subsystem doc: `docs/contributor-dossier/03-subsystems/federation.md`.
- **Acceptance:** Two non-`aaronjmars/aeon` publishers live; cross-instance calls demoable.

---

## Files touched

| Path | Action |
|---|---|
| `docs/federation-spec/SPEC.md` | New |
| `docs/federation-spec/SECURITY.md` | New |
| `well-known/aeon-federation.json` | New (per instance) |
| `skills/federation-call/SKILL.md` | New |
| `skills/federation-publish/SKILL.md` | New |
| `skills/federation-trust/SKILL.md` | New |
| `skills/x402-client/SKILL.md` | New |
| `memory/federation/{registry.json,authorized.json,limits.json}` | New |
| `memory/federation/receipts/` | New directory |
| `aeon.yml` | Add `federation_publish:` field; register new skills |
| `.github/workflows/aeon.yml` | Allowlist `./federation-call` |
| `docs/contributor-dossier/03-subsystems/federation.md` | New subsystem doc |
| `docs/contributor-dossier/03-subsystems/integrations.md` | Update with federation section |

New external repo: `aeon-federation-registry` (or hosted by author).

---

## Dependencies

- **`OPERATOR_SIG_KEY`** repo secret per instance (ed25519 private key).
- **Cloudflare Workers account** for the registry.
- **D1** for registry storage.
- **A2A gateway** active on each participating instance (already exists).
- **x402 protocol** library — `@coinbase/x402` or equivalent.
- **Optional: USDC wallet on Base** for x402 settlement (only operators using paid skills).

---

## Out of scope

- The Aeon Agora (Session 09 — depends on this).
- Cross-instance memory sync.
- On-chain settlement beyond x402 (e.g. EAS attestations, future work).
- Replacing the existing fleet skills (`fork-fleet`, `fork-skill-digest`); federation is *additive*.
- Renaming or restructuring ecosystem listings.

---

## Risks

| Risk | Mitigation |
|---|---|
| Protocol versioning rot | Spec includes explicit version negotiation; `/1` is permanent. |
| Centralization risk in `federation.aeon.bot` | Worker source open; instances can mirror; clients can be configured to use a different registry. |
| Compromised publisher serves poisoned outputs | Signature verification is essential; reputation scoring + operator allowlists are secondary. |
| Settlement friction (USDC wallet barrier) | x402 is optional; free tier always works. |
| Brand dilution (federation amplifies "built on Aeon" claims) | ECOSYSTEM listing standards (see [`../08-OPEN-QUESTIONS.md`](../08-OPEN-QUESTIONS.md) Q4) tightened in parallel. |
| Replay attacks | Nonce + ts in signed envelope; receiver checks against window. |
| Sybil publishers in registry | Manual seed list initially; later: rate-limit + cluster-detect via behavior. |

---

## Doctor check

```bash
./scripts/doctor
```

Should show:

- ✓ `well-known/aeon-federation.json` exists and validates against schema
- ✓ `OPERATOR_SIG_KEY` is set
- ✓ Last `federation-publish` run successful
- ✓ At least one federation call in the last 7 days has a signed receipt
- ✓ `memory/federation/receipts/` exists and is committed

---

## Related dossier docs

- [`../03-subsystems/a2a-server.md`](../03-subsystems/a2a-server.md) — the wire protocol federation extends
- [`../03-subsystems/fleet.md`](../03-subsystems/fleet.md) — fleet observation that federation builds on
- [`../03-subsystems/integrations.md`](../03-subsystems/integrations.md) — Bankr / x402 / Smithery context
- [`../05-SECURITY.md`](../05-SECURITY.md) — supply-chain + trust model
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #3 — full PoC sketch
- [`session-09-agora.md`](session-09-agora.md) — the agora is the public-facing artifact of this federation

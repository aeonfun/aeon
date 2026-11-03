# ICP-SECURITY-IMPLEMENTATION-DESIGN.md

**Scope:** The only genuine net-new build — an **ICP Rust-canister security audit arm**, designed on the existing `vuln-scanner` / `sc-audit` architecture. Scope locked to **Rust canisters** per decision.
**Date:** 2026-11-03. **Evidence:** full structural + stage reads of `skills/vuln-scanner/SKILL.md`, `skills/sc-audit/SKILL.md`, `scripts/vuln-poc-gate.sh`, `scripts/stage-vuln-scanner.sh`; and `dfinity/icskills/canister-security`.

---

## 1. What the existing scanners actually do (traced from source) — `Confirmed`

**`vuln-scanner` flow:** A1 pick → A2 `gh repo fork --clone --depth 200` → **A3 purpose-built scanners** → A3.5 fuzz (`cargo fuzz`, only if the repo ships a harness) → **A3.6 agentic logic audit** → A4 triage → **A4.5 PoC-verification gate** → A5 disclosure routing → A6 dedup → A7 report → A8 notify.

**A3 is where language matters — and here is the gap:**
- Semgrep (`p/security-audit`, `p/owasp-top-ten`, `p/secrets`) — generic rulesets, runs on any language incl. Rust, **but has no IC/canister rules**.
- TruffleHog `--only-verified` (fs + git history) — secrets.
- osv-scanner (`scan source --recursive --no-ignore`) — dependency CVEs across ecosystems **including Rust `Cargo.lock`**.
- **Slither — the ONLY language-conditional tool, gated behind `ls **/*.sol`** (Solidity presence). `skills/vuln-scanner/SKILL.md:224`.

→ **There is zero IC-aware / canister-aware analysis today, and no Motoko support anywhere.** osv-scanner gives Rust *dependency* CVEs; nothing inspects canister *logic*. This is the net-new surface. `Confidence: Confirmed.`

**`sc-audit` (EVM-only) is the right template:** S1 detect Solidity → S2 get code → S3 stage toolchain (`FOUNDRY_FFI=false` hardening) → S4 Slither → **S5.0 threat-model-first (derive invariants)** → **S5 bounded agentic audit with a Solidity-specific checklist** → S6 triage → S6.5 fuzz (Echidna/Medusa property mode) → S7 shared disclosure → S8 dedup+coverage → **S9 professional report**. The `canister-audit` arm is `sc-audit` with the EVM pieces swapped for IC pieces.

**Shared machinery to reuse unchanged:**
- **`scripts/vuln-poc-gate.sh`** — validates a finding JSON (`id`, `target_repo`, `target_commit` 7-40 hex, `attacker_controls`≥10, `attacker_achieves`≥10, `severity∈{high,critical}`), binds to the exact commit (rejects `target-mutated`), SHA-256s the claim, runs in a **credential-isolated** env, prints only a redacted verdict. Two modes: `foundry` and **`command`** (deterministic local verifier, exit 0 only when the boundary is crossed).
- **A5 disclosure routing** (PVR `/reports` with non-empty `vulnerabilities[]`; public PR only for already-public dep CVEs; email + watchlist fallback; `shadow` = private artifact, no send). Channel-agnostic → reuse as-is.
- **Staging pattern** (`stage-vuln-scanner.sh`: pinned release binaries + sha256 → `/tmp/bin`; pip for Python tools) **paired with** the bare-name allowlist grant in `scripts/skill_mode.sh`. A new tool needs **both halves**.
- **Fixture pattern** (`skills/sc-audit/fixtures/vault/src/Vault.sol`) — a self-contained planted-flaw target.

---

## 2. The IC check taxonomy → automatable vs agentic — `Confidence: High` (derived from `canister-security`)

From the 12 canister-security pitfalls, mapped to Rust (`ic-cdk 0.19`, `candid 0.10`):

### Reliably automatable (static — Semgrep-rust / AST / grep) — the "rules" layer
| Check | Pattern | Pitfall |
|---|---|---|
| **Missing anonymous-principal rejection** | `#[update]`/`#[query]` fn with no `msg_caller() == Principal::anonymous()` guard and no `guard=` attr | #2 |
| **`fetchRootKey()` present** | literal call anywhere in build path | #7 |
| **`CallerGuard` footgun** | `let _ = CallerGuard::new(` (immediate drop defeats the lock) | #3 |
| **Unguarded admin method** | `#[update]` named `*mint*/*migrate*/*admin*/*config*/*set_*` with no `guard=` | #8 |
| **`inspect_message` used as the only gate** | `inspect_message` present while update methods lack in-body/guard checks | #1 |
| **Secret-shaped literals in canister state** | high-entropy string consts / keys in `thread_local!` state (TruffleHog already catches verified creds) | #9 |
| **`ExperimentalCycles`/stale imports** (build-break, low-sev) | `mo:base/ExperimentalCycles` | (Motoko; out of Rust scope) |

### Requires agentic reasoning (the A3.6/S5-style bounded reviewer) — the "logic" layer
| Check | Why not static | Pitfall |
|---|---|---|
| **TOCTOU across `await`** — state read before an inter-canister call and reused after | needs data-flow + interleaving reasoning | #3 |
| **Callback-trap-after-mutation** — pre-`await` mutation persists if callback traps | ordering + rollback semantics | #11 |
| **Unbounded user-controlled storage** (heap/stable fill → brick) | quota reasoning over write paths | #10 |
| **Unbounded-wait inter-canister calls** blocking upgrade | `Call::` vs `Call::bounded_wait`, callee-trust reasoning | #12 |
| **`pre_upgrade` trap risk** (large heap serialization) | size/shape reasoning | #4 |
| **Cycle-drain DoS** — cheap unauthenticated update that burns cycles | economic reasoning | intro, #5 |

**Design principle (mirrors sc-audit):** the **agentic layer carries the audit** (it needs no toolchain and catches the high-value logic bugs); the static rules are a cheap, reliable first pass. Both feed A4-style triage; every HIGH/CRITICAL goes through the PoC gate.

---

## 3. The `canister-audit` arm — concrete shape

**Form:** a **new skill** `skills/canister-audit/SKILL.md` (sibling to `sc-audit`), `mode: write`, `category: dev`, modeled stage-for-stage on `sc-audit`:

| sc-audit stage | canister-audit equivalent |
|---|---|
| S1 detect Solidity (`**/*.sol`) | detect Rust canister: `Cargo.toml` with `ic-cdk`/`candid` dep, `#[update]`/`#[query]`, or a `.did` / `canister_ids.json` / `icp.yaml`/`dfx.json` |
| S3 stage (slither/solc/forge…) | stage: `wasm32-unknown-unknown` target, **`cargo-audit`** (RustSec dep CVEs, complements osv), **PocketIC binary** (pinned+sha256). Harden like `FOUNDRY_FFI=false`: build/test untrusted canister code in a throwaway clone. |
| S4 Slither | **Semgrep with an IC Rust ruleset** (`references/ic-semgrep-rust.yml`) + `cargo-audit` |
| **S5.0 threat model** | reuse verbatim — derive canister invariants (solvency, one-time init, only-controller-upgrades, no-free-mint) |
| **S5 agentic checklist (Solidity)** | **swap for the IC checklist** (§2 agentic layer + `references/ic-security-checklist.md` embedded from canister-security) |
| S6.5 fuzz (Echidna/Medusa) | **PocketIC property tests** — drive `#[update]`/`#[query]` via agent calls, assert invariants |
| S7 route / S8 dedup / S9 report | **reuse unchanged** (shared machinery) |

**PoC gate:** **no new mode needed.** A canister reproduction is a **`command`-mode** script: `cargo build --target wasm32-unknown-unknown` the audited commit, load the wasm into **PocketIC**, call the method as the anonymous (or attacker) principal, assert the prohibited outcome, exit nonzero otherwise. The gate already isolates credentials and binds the commit. *(A dedicated `pocketic` mode could be added later for ergonomics; not required for correctness.)*

**New staging + allowlist (both halves):**
- `scripts/stage-canister-audit.sh` — pin + sha256 the PocketIC server binary and `cargo-audit`; `rustup target add wasm32-unknown-unknown`.
- `scripts/skill_mode.sh` — grant `Bash(cargo:*)`, `Bash(cargo-audit:*)`, `Bash(semgrep:*)` (already granted), `Bash(<pocket-ic runner>:*)`.

**Fixtures:** `skills/canister-audit/fixtures/<name>/` — a minimal Rust canister with a **planted flaw** (e.g. an `#[update]` that mutates a balance with no anonymous-principal check, or `let _ = CallerGuard::new(caller)?`). Mirrors `sc-audit/fixtures/vault`. This is what makes the demo *prove* detection + PoC verification, since no public vulnerable IC canister exists.

---

## 4. Verification under Epoch (no-secrets runner) — `Confidence: High`

From `svectors-lab/.github/workflows/epoch-verify.yml` (read prior): `runs-on: ubuntu-latest`, `timeout-minutes: 30`, `permissions: contents: read`, **no secrets**, each VERIFY line `timeout 1200 bash -c "$line" </dev/null` (fresh shell per line). Implications for canister verification:
- ✅ **Compile + PocketIC tests are feasible** — `ubuntu-latest` ships Rust; `rustup target add wasm32-unknown-unknown`, a pinned PocketIC binary download, `cargo build --target wasm32-unknown-unknown`, `cargo test` all fit (network fetch is allowed; only pipe-to-shell and creds are blocked).
- ⚠️ **No `dfx` via `curl|sh`** (pipe-install blocked). Vendor/pin a binary or use PocketIC. **Local-replica / compile scope only** (no mainnet / identity / cycles).
- ⚠️ **One committed wrapper per flow** — put the whole canister verification in a single `scripts/verify-canister.sh` committed on the **default branch**; the Epoch order calls that one line (fresh-shell-per-line means no `cd`/`export` carries). Same-repo PRs only.

---

## 5. What's automated reliably vs needs agentic investigation (summary answer to the brief)
- **Reliable automation:** dependency CVEs (osv + cargo-audit), verified secrets (TruffleHog), and the §2 static rule set (anon-principal, fetchRootKey, CallerGuard footgun, unguarded admin, inspect_message-as-gate).
- **Agentic investigation:** TOCTOU, callback-trap ordering, unbounded storage, unbounded-wait, pre_upgrade trap, cycle-drain economics — plus the S5.0 threat-model/invariant derivation. These are the high-value bugs and the reason the agentic layer, not the rules, is the core.

## Confidence summary
| Claim | Confidence |
|---|---|
| No IC/canister analysis exists today | Confirmed |
| sc-audit is a stage-for-stage template | Confirmed |
| PoC `command` mode fits canisters (PocketIC) | High |
| Static vs agentic split | High (derived from canister-security) |
| Epoch can verify a Rust canister within budget | High (from epoch-verify.yml) |

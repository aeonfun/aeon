# ICP-TEST-TARGETS.md

**Scope:** Public ICP repositories with real Rust canisters, suitable as **reproducible** targets for the audit arm. No destructive ops, no findings submitted.
**Date:** 2026-11-03. **Evidence:** GitHub contents API over `dfinity/examples`; web search for a deliberately-vulnerable IC target.

---

## 1. Primary target set — `dfinity/examples` — `Confirmed`

Apache-2.0, 612★, pushed 2026-09-28, ~120 MB. 39 Rust example canisters under `rust/`, 27 Motoko under `motoko/`. Each example confirmed self-contained with `Cargo.toml` + `rust-toolchain.toml` (pinned toolchain) + `test.sh` + `icp.yaml` (an **icp-cli** project, not `dfx`). The standard build is `cargo build --target wasm32-unknown-unknown` — toolchain-level, works **without** `dfx` or `icp-cli`, which is what makes it verifiable in Epoch's no-secrets runner.

### Lead targets (small, buildable, security-relevant)
| Repo path | Why it's a good target | Security surface | Suitability |
|---|---|---|---|
| **`dfinity/examples` → `rust/guards`** | Tiny; **purpose-built around access-control guards**. Files: `Cargo.toml`, `rust-toolchain.toml`, `backend/`, `test.sh`. | Directly exercises canister-security **#2 (anon principal)** and **#8 (unguarded admin)** | **Best first target.** Expect mostly clean; proves the static + agentic access-control checks run end-to-end |
| **`rust/unit_testable_rust_canister`** | **Ships unit tests** (`test.sh`, `rustfmt.toml`). | Proves the **build + test** path works in the no-secrets runner | **Best for the Epoch verification demo** |
| **`rust/inter-canister-calls`** | Two canisters (`caller/`, `counter/`) making inter-canister calls. | **TOCTOU / callback-trap / unbounded-wait** (#3/#11/#12) — the agentic layer's showcase | Strong agentic-arm demo |

### Secondary (higher relevance, more weight)
| Repo path | Surface | Note |
|---|---|---|
| `rust/icp_transfer`, `rust/basic_bitcoin`, `rust/basic_ethereum` | value handling, threshold signing | larger; good for a deeper pass |
| `rust/threshold-ecdsa`, `rust/threshold-schnorr`, `rust/vetkeys` | key management (#9 secrets-in-state) | crypto-sensitive |
| `rust/who_am_i` | caller/principal identity (anon-principal) | tiny companion to `guards` |

*(Note: a `rust/basic_dao` path was referenced in docs but the API listing returned empty for it — the Rust DAO may have moved/renamed; `motoko/basic_dao` exists. Not relied on. `Confidence: Medium` on that one path.)*

## 2. No public deliberately-vulnerable IC canister — `Confirmed` (search negative)

A targeted search for an IC CTF / "damn vulnerable canister" / Rust canister security-training repo returned **none** — only general IC/Rust projects and the official CDK. Implication: to *prove* the detector fires and the PoC gate verifies, the demo must include a **planted-flaw fixture** we author (see ICP-SECURITY-IMPLEMENTATION-DESIGN.md §3), exactly as `sc-audit` ships `fixtures/vault`. Scanning a real official example alone will likely yield a clean/low-severity result, which demonstrates coverage but not a verified HIGH.

## 3. Larger real-world targets (out of scope for a 24h demo)
- **`dfinity/internet-identity`** — Rust, auth-critical, well-tested; excellent *relevance* but heavy to build/scan in a time-boxed demo. `Confidence: High` (known project; not probed this session).
- **`dfinity/ic`** (ckBTC/ckETH/SNS canisters live here) — the production monorepo; far too large for a reproducible single-run scan. Use only for targeted file-level study, not a whole-repo scan.

## 4. Reproducibility checklist (how each target will be used)
1. `A2`-style clone at a **pinned commit** (the audit binds findings to `target_commit`).
2. Static pass: Semgrep IC-rust ruleset + `cargo-audit` + osv (Cargo.lock) + TruffleHog.
3. Agentic pass: threat model → entrypoint inventory (`#[update]`/`#[query]`/Candid methods) → IC checklist.
4. For any HIGH/CRITICAL (expected only on the fixture): `vuln-poc-gate.sh command` with a PocketIC reproduction, commit-bound.
5. Disclosure: **`shadow`** (private artifact, no send) for the demo — never file against `dfinity/*`.

## Confidence summary
| Claim | Confidence |
|---|---|
| `dfinity/examples` rust targets build via cargo + ship tests | Confirmed (contents API) |
| `rust/guards` / `unit_testable_rust_canister` / `inter-canister-calls` are the leads | Confirmed |
| No public vulnerable-IC-canister repo exists → plant a fixture | Confirmed (search negative) |
| internet-identity / dfinity-ic as heavier targets | High (known, not probed) |

# ICP Integration — Investigation Index, Implementation Sequence & 24h-Demo Risk

**Status:** Investigation only. Nothing modified, installed, committed, or pushed. Active Aeon MCP instance left as found (`Svector-anu/svectors-lab`).
**Date:** 2026-11-03.

## Reports in this set
1. **ICP-MCP-VERIFICATION.md** — the endpoint is live but interactive-OAuth-only → incompatible with headless Aeon.
2. **ICP-AEON-MCP-ARCHITECTURE.md** — Aeon's server vs client MCP surfaces; full config→execution trace; why the client path can't reach ICP.
3. **ICP-SKILLS-COMPATIBILITY.md** — official schema vs Aeon loader; reuse the *knowledge*, don't install interactive skills into the fleet.
4. **ICP-SECURITY-IMPLEMENTATION-DESIGN.md** — the one net-new build: a Rust-canister `canister-audit` arm on the existing scanner architecture.
5. **ICP-TEST-TARGETS.md** — reproducible targets (`dfinity/examples` rust/*) + the need for a planted-flaw fixture.

## Core finding (ties it together)
"Reuse everything suitable, extend what exists, build only what's missing" resolves cleanly:
- **MCP integration → do NOT build against the official connector.** Verified interactive-only (`authorization_code`+PKCE+Internet Identity, no refresh, no machine grant). If runtime IC access is ever needed, go **direct-to-IC** (agent-js/`icp-cli` + PEM identity secret via `./secretcurl`). **The audit project needs no runtime IC access at all.**
- **Verification → reuse Epoch.** A Rust canister compiles + runs PocketIC tests inside Epoch's no-secrets runner, via one committed `scripts/verify-canister.sh` (no pipe-installed `dfx`; local/compile scope; same-repo PRs).
- **Security knowledge → reuse (embed) icskills `canister-security`.** Don't install it as a runnable Aeon skill.
- **The only real build → `canister-audit`,** a new skill that is `sc-audit` with EVM pieces swapped for IC pieces, reusing the PoC gate (`command` mode), disclosure routing, dedup, report shape, and staging/allowlist pattern unchanged.

## Recommended implementation sequence (on approval — NOT started)
1. **Scaffold `skills/canister-audit/SKILL.md`** from `sc-audit` (detect Rust canister → stage → static → S5.0 threat model → agentic IC checklist → triage → PoC → route → report).
2. **Embed** `references/ic-security-checklist.md` (the 12 canister-security pitfalls) + author a minimal **`references/ic-semgrep-rust.yml`** (anon-principal, `fetchRootKey`, `let _ = CallerGuard::new(`, unguarded admin).
3. **Staging (both halves):** `scripts/stage-canister-audit.sh` (wasm32 target, pinned PocketIC, cargo-audit) + grants in `scripts/skill_mode.sh`.
4. **Fixture:** `skills/canister-audit/fixtures/<name>/` — a tiny Rust canister with one planted flaw.
5. **PoC verifier:** a `command`-mode PocketIC reproduction script; confirm `vuln-poc-gate.sh` accepts it commit-bound.
6. **Epoch wrapper:** `scripts/verify-canister.sh` (single line: wasm32 build + `cargo test` + PocketIC) committed on the default branch; wire the Epoch order to it.
7. **Dry run (shadow):** scan `rust/guards` + the fixture; verify 1–2 findings on the fixture; emit the professional report; route `shadow` (no send).

## Can we get a meaningful working demo in 24h? — Yes, with a narrowed scope
**Demo = scan `dfinity/examples/rust/guards` + our planted-flaw fixture; static rules + agentic IC checklist; 1–2 PoC-verified findings on the fixture; a professional audit report; disclosure `shadow` (no external send); optionally Epoch-verified compile+test.** That is achievable because every stage except the IC specifics is reused.

### Blockers / risks to that 24h demo
| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **CI toolchain staging** — PocketIC + `wasm32` target + cargo-audit must be pre-staged; `dfx` can't pipe-install in the sandboxed/Epoch runner | **Medium** | Pin a PocketIC binary like `stage-vuln-scanner.sh` pins trufflehog/osv; add `rustup target add wasm32…` in the wrapper |
| 2 | **No off-the-shelf IC Semgrep ruleset** — must hand-author a minimal one | Low–Medium | The **agentic arm carries the demo**; ship 3–4 rules, grow later |
| 3 | **PocketIC repro within the 20-min/line budget** | Medium | Keep the fixture tiny; cache the PocketIC binary; lean `cargo test` |
| 4 | **Location decision still open** (svectors-lab where Epoch/vuln-scanner run, vs aeon upstream chosen as home but Epoch isn't ported there) | **Medium — user decision, gates WHERE the skill lands** | Decide before step 1; see below |
| 5 | **ICP-skills install target/method** unresolved | Low | Recommended: embed knowledge into the new skill; install icskills locally only for interactive authoring |
| **Not a blocker** | MCP connector | — | Verified incompatible and **not needed** for a source audit; removed from the critical path |

## Two open decisions for you
1. **Location:** keep the ICP work on **svectors-lab** (Epoch + vuln-scanner already run there) **or** port Epoch upstream to **aeon** first (your chosen home, but Epoch isn't there yet). This gates step 1.
2. **ICP-skills:** embed the `canister-security` knowledge into the new skill (recommended), and/or `npx skills add dfinity/icskills` into a **local** `.claude/skills/` for interactive authoring only. Confirm before any install (standing rule: do not install).

*(Report files currently live in the session scratchpad. On your OK I'll place them in the repo, e.g. `docs/icp/`, on a branch/PR — not pushed to main.)*

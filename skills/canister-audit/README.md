# canister-audit

Deep security audit of an **Internet Computer Rust canister** repo. The IC sibling
of `sc-audit`: it detects an `ic-cdk` canister, models the invariants and trust
boundaries first, runs a Semgrep IC ruleset plus `cargo-audit`/osv (best-effort),
then a bounded **agentic** pass that hunts a path breaking each invariant against
the 12 canister-security pitfalls, triages, adversarially refutes, proves a
confirmed HIGH/CRITICAL with a **PocketIC** reproduction through the shared PoC
gate, and routes findings through the shared responsible-disclosure machinery.

- **Scope:** Rust canisters only (`ic-cdk` / `candid`). Motoko is out of scope.
- **No runtime IC access:** the audit operates on source - it needs no mainnet
  identity, no cycles, and not the ICP MCP connector.

## Design

This skill is `sc-audit` with the EVM pieces swapped for IC pieces and the shared
machinery reused unchanged - PoC gate (`command` mode), disclosure routing, dedup
ledger, coverage manifest, report shape, staging/allowlist pattern. The
static-vs-agentic taxonomy and the per-pitfall rationale live in §C5 of `SKILL.md`
and `references/ic-security-checklist.md`.

## Layout

| Path | What |
|---|---|
| `SKILL.md` | The pipeline (§C1 detect → C2 clone → C3 stage → C4 static → C5.0 threat model → C5 agentic → C6 triage/refute → C6.5 PocketIC PoC → C7 disclosure → C8 ledger → C9 report) |
| `references/ic-security-checklist.md` | The 12 canister-security pitfalls (Rust), embedded from `dfinity/icskills` - knowledge, not an installed skill |
| `references/ic-semgrep-rust.yml` | The IC Rust static ruleset (coarse first pass) |
| `fixtures/token_vault/` | A deliberately-vulnerable ledger canister + its PocketIC reproduction |

## Run

```bash
# Audit a repo
gh workflow run aeon.yml --ref main -f skill=canister-audit -f var=dfinity/examples

# Regression-test against the bundled fixture (no fork, no disclosure)
gh workflow run aeon.yml --ref main -f skill=canister-audit -f var=fixture:token_vault
```

## Toolchain

Staged by `scripts/stage-canister-audit.sh` (workflow step): the
`wasm32-unknown-unknown` target, `cargo-audit`, and a pinned PocketIC server
binary. In-run execution is gated by the write-tier grant in
`scripts/skill_mode.sh`. Every tool self-guards with `command -v`; the agentic
source pass is the reliable core and needs none of them.

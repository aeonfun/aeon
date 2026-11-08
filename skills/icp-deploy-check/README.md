# icp-deploy-check

A **pre-deploy safety checklist** for an Internet Computer Rust canister. Reads a
local/cloned repo and verifies the deploy-time footguns from the canister-security
checklist — anonymous-principal rejection (#2), unguarded admin (#8), no mainnet
`fetch_root_key` (#7), controller backup (#6), upgrade safety (#4), CallerGuard
footgun (#3), secrets in state (#9) — before the canister ships.

**Static, read-only, no network, no identity, no mainnet action.** `mode: read-only`.
Inputs are local paths only; `owner/repo` is intentionally unsupported. The skill
uses Read/Glob/Grep rather than Semgrep because the latter is a write-tier scanner.
It is the deploy-time sibling of the deeper `canister-audit` skill; for a full
PoC-verified audit, use that. Knowledge is reused from
`skills/canister-audit/references/ic-security-checklist.md`.

## Run

```bash
gh workflow run aeon.yml --ref main -f skill=icp-deploy-check -f var=.
gh workflow run aeon.yml --ref main -f skill=icp-deploy-check -f var=fixture:token_vault
```

## Reproducible demo

Pointed at the `canister-audit` `token_vault` fixture it should flag the unguarded
`claim_bonus` (anonymous-principal / unguarded-admin) and pass the guarded
`admin_set_total` — the same discrimination the `canister-audit` static layer shows.

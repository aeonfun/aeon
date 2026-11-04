# Aeon × ICP — Execution Ledger

Append-only record so work resumes cleanly after context limits or restarts.
Pairs with [`ICP-INTEGRATION-PRD.md`](ICP-INTEGRATION-PRD.md). Newest first.

## Legend

`DONE` complete + verified · `MERGED` on main · `PR` open · `WIP` in progress ·
`BLOCKED` waiting on an external gate · `DEFERRED` out of scope, recorded.

## State by workstream

| WS | Commitment | State | Evidence |
|---|---|---|---|
| A | ICP connectivity | WIP | Headless read path decided (`ICP-MCP-VERIFICATION.md`); to be exercised by a B skill |
| B | ICP skill pack | WIP | 4 skills (`canister-status`, `cycles-balance`, `sns-digest`, `icp-deploy-check`) — delegated |
| C | ICP security audit | PR | **PR #1328** — `canister-audit` skill, fixture, staging, catalog |
| D | ICP Skills contribution | DEFERRED→WIP | Validate B against `icskills` schema once B lands |

## Log

### 2026-11-04

- **C — canister-audit shipped to PR #1328** (branch `feat/canister-audit-skill`, 2 commits).
  - Files: `skills/canister-audit/{SKILL.md,README.md,references/*,fixtures/token_vault/*}`,
    `scripts/stage-canister-audit.sh`, `scripts/skill_mode.sh` (+grant), `.github/workflows/aeon.yml`
    (+cache/stage steps), `catalog/skills.json`, `catalog/skill-icons.json`,
    `docs/assets/skill-icons/canister-audit.svg`, `apps/dashboard/lib/skill-icons.data.ts`.
  - Verified locally: `semgrep` fires on `claim_bonus`+`withdraw`, clears guarded
    `deposit`+`admin_set_total` (2 findings); `cargo build --target wasm32-unknown-unknown
    --release` → 692 KB wasm; PoC-gate jq schema valid on `finding.json`; `shellcheck` clean;
    `actionlint` clean on new steps; `bin/generate-skill-icons --check` OK (89 skills).
  - **Not** verified locally: the PocketIC reproduction (no server binary / no crate fetch in
    dev). Wired for the staged CI/Epoch runner; PocketIC 16.1.0 pinned+sha256 in the stage
    script, crate pinned to 16.x to match.
- **M3 — PRD + this ledger** created (branch `docs/icp-prd-ledger`).
- **M1 — PR #1316** (investigation docs) is `MERGEABLE` with passing checks but `REVIEW_REQUIRED`
  (branch protection). Cannot self-merge; awaits human approval. Kept open, not closed.

## Remaining / next

1. **B:** implement the 4 skills (Aeon schema, read-only where applicable), each with a
   scheduling example + dry-run evidence; exercise the Workstream-A read path live.
2. **A:** document the headless read path concretely as used by B; confirm no-secret reads work.
3. **D:** validate B skills against `dfinity/icskills` schema; prepare the contribution package
   (knowledge-in-ICP-format where not schema-native).
4. **Demo/handoff:** end-to-end walkthrough for DFINITY once B/C are merged.

## Blockers

- PR #1316 merge needs human approval (branch protection) — not bypassable.
- PocketIC end-to-end reproduction evidence must come from a staged runner (Epoch), not dev.

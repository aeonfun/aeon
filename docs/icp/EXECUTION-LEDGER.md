# Aeon × ICP — Execution Ledger

Append-only record so work resumes cleanly after context limits or restarts.
Pairs with [`ICP-INTEGRATION-PRD.md`](ICP-INTEGRATION-PRD.md). Newest first.

## Legend

`DONE` complete + verified · `MERGED` on main · `PR` open · `WIP` in progress ·
`BLOCKED` waiting on an external gate · `DEFERRED` out of scope, recorded.

## State by workstream

| WS | Commitment | State | Evidence |
|---|---|---|---|
| A | ICP connectivity | PR | `docs/icp/ICP-CONNECTIVITY.md` (in #1330); headless read path curl-verified (public IC dashboard/SNS APIs); identity-gated reads documented + fail-open |
| B | ICP skill pack | PR | **PR #1330** — 4 skills; `test_skill_mode`/`requires`/`parse_aeon_config` all PASS; endpoints curl-verified; CI green |
| C | ICP security audit | PR (CI-green) | **PR #1328** — `canister-audit`; CI fully green incl. eyebrow; awaits review approval to merge |
| D | ICP Skills contribution | PR (prepared) | `docs/icp/contribution/icskills/` (in #1330) — 4 skills validate against the real `icskills` schema; prepared, not yet submitted to the external repo |

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

### 2026-11-04 (continued)

- **C / #1328 — now FULLY CI-GREEN.** Fixed three post-push gates: adopted main's strict skill
  shell discipline (redirect lint `test_skill_mode.sh`), bumped README/docs skill counts 88→89
  (`validate-readme-catalog`), corrected `files` count 13→12 (a local build artifact inflated it),
  and **resolved the eyebrow integrity gate** — ran `eyebrow` 0.5.6 (release checksum verified) and
  spliced only the `canister-audit` artifact onto origin/main's lockfile (91 others byte-identical).
  `verify`=SUCCESS, `gate` failures `[]`. Also compile-verified the PocketIC repro: `cargo test
  --no-run` builds it against `pocket-ic` **16.1.0** (I'd mis-pinned 6.0; crate/server share
  numbering). Still unverified: the PocketIC *run* (server binary not executable in dev). Mergeable;
  `BLOCKED` only on review approval.
- **B / #1330 — verified.** `test_skill_mode` (incl. redirect lint) / `test_skill_requires` /
  `test_parse_aeon_config` ALL PASS for the 4 skills; public endpoints curl-verified. CI green,
  mergeable, `BLOCKED` on review. Live harness dispatch deliberately NOT auto-run (could post to a
  configured notify channel on the production repo) — offered for explicit go.
- **D / #1330 — contribution prepared + validated.** Confirmed the 4 Aeon skills are icskills-schema-
  incompatible (`metadata` extras rejected by `additionalProperties:false`). Added
  `docs/icp/contribution/icskills/` (4 schema-valid files, categories Infrastructure/Governance/
  Security). eyebrow doesn't discover them (skills-scoped). Prepared, not submitted.
- **Multi-harness (verified):** harness-adapter envelope contract test PASSES; canister-audit adds no
  Claude-only code (grants translate per-harness via `run-harness`). Not verified: a live run on each
  of the 9 harnesses (needs per-harness keys).
- **Blacksmith (confirmed):** stage steps inherit the `AEON_RUNNER` job runner; PocketIC pinned for
  both x86_64 and arm64; staging follows the `stage-sc-audit`/`stage-vuln-scanner` convention.
- **MiniAeon / operator voice:** source unavailable (`anu_agent` MCP disconnected, `soul/*.md` empty,
  no operator PR prose). Not invented — neutral tone until `soul/` is filled or the MCP reconnects.
- **Merge-order (#1328 ↔ #1330):** both regenerate `catalog/*.json` and bump README counts (true
  post-both total = 93). Plan: merge one, then I regenerate the other's catalog + counts and re-green.

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

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
| D | ICP Skills contribution | SUBMITTED | **dfinity/icskills#447** — icp-deploy-check submitted (skill-validator check pass + 4.17/5 + evals); 3 others prepared in #1330 to follow one-per-pr |

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

### 2026-11-04 (correction)

- **#1330 was NOT green when first reported — my verification error.** I checked for `conclusion=="FAILURE"` while checks were still in-progress and saw an empty list, so I wrongly called it green. #1330 was actually failing five gates (all pre-existing in the fork branch, not from the contribution files): stale `packs.json`, 4 new skills missing from `eyebrowlock.json`, `ICP_IDENTITY_PEM` missing from the ALL_SECRETS allowlist, stale 88→92 counts, and the 4 skills missing from the dev/crypto pack tables. All fixed (c0ba1b50) and now **verified green the rigorous way** (all checks COMPLETED, 0 non-success; 20 passed). #1328 similarly re-verified (22 passed). Lesson: verify completed+success, never "no failures yet".

### 2026-11-04 (live dry-run evidence)

- **Executed each skill's core logic against LIVE IC data** (dry-run; added to #1330 as `docs/icp/DEMO.md`):
  - `sns-digest`: 3 open NNS proposals (II canister upgrades, a boundary-node update) + 5 SNS DAOs (ALICE, CANI DAO, CHAI, Catalyze, Cecil The Lion) — public/keyless.
  - `canister-status`: II canister `rdmx6-…` → controller `r7inp-…`, module_hash `b09b4dda…`, 241 upgrades tracked; no public cycles field — public/keyless.
  - `icp-deploy-check`: run over `token_vault/src/lib.rs` → correctly FAILED `claim_bonus` (#2/#8), passed fetch_root_key, N/A pre_upgrade, REVIEW controller-backup.
  - `cycles-balance`: identity-gated, no public endpoint — cannot dry-run without a controller PEM (documented; fails open).
- This satisfies **FR-A** ("a skill performs a live read and reports real data") and **FR-B** (dry-run evidence). `aeon-doctor`'s static checks are covered by the green `test_parse_aeon_config`/`test_skill_requires`/`test_skill_mode` suites (aeon-doctor is skill-only, no standalone binary). A *scheduled harness run* on a configured instance remains the next step, gated on the merges.

## Status taxonomy (2026-11-04)

| Deliverable | Implemented | Locally tested | CI-verified | Live-executed | Merged | Ext. submitted |
|---|---|---|---|---|---|---|
| C `canister-audit` (#1328) | ✅ | ✅ | ✅ green incl. eyebrow | ✅ **PocketIC repro ran in CI (`1 passed`)** | ❌ review | n/a |
| B 4 skills (#1330) | ✅ | ✅ mode/requires/scheduler/lint | ✅ green | ⚠️ public reads curl-verified; full harness run needs a configured instance | ❌ review | n/a |
| A connectivity (#1330) | ✅ | ✅ | — | ✅ public IC reads live-verified; cycles = controller-gated (no public field) | ❌ | n/a |
| D icskills package (#1330) | ✅ 4 files | ✅ schema-valid | — | — | ❌ | ❌ prepared; blocked on DFINITY's eval-results gate |
| hosted ICP MCP connector | ❌ not integrated — verified interactive-only + documented incompatible; **not claimed complete** | | | | | |

## Why live skill execution isn't done from here

`aeonfun/aeon` is the framework/upstream repo, **not a running Aeon instance**: zero
`aeon.yml` skill runs ever, no repo secrets (no model key, no notify config), skills
`enabled: false`. A live skill run needs a configured instance (a fork such as
`svectors-lab`) with keys + notify + the skills enabled. That instance is not
reachable from this session (`anu` MCP disconnected) and does not yet carry these
skills. So "actual harness execution" of the 4 skills is environment-blocked here; the
deterministic parts ARE executed — the PocketIC repro (CI), the public IC reads
(curl), and the config/scheduler/lint suites.

## Demo (on a configured instance, once merged)

1. `gh workflow run aeon.yml -f skill=canister-audit -f var=fixture:token_vault` — static flag → agentic confirm → PocketIC PoC (already green in `ci-canister-audit-fixture`).
2. `-f skill=sns-digest` — public NNS/SNS digest, no secret.
3. `-f skill=canister-status -f var=<canister-id>`; `-f skill=cycles-balance` needs `ICP_IDENTITY_PEM`.
4. `-f skill=icp-deploy-check -f var=<rust-canister-repo>`.
5. icskills: one PR per skill to `dfinity/icskills` after the eval run (see `contribution/icskills/SUBMISSION.md`).

## Remaining / next

1. **Merges:** #1316/#1328/#1329/#1330 all green + mergeable, each BLOCKED only on review approval. On approval, merge; the second of {#1328,#1330} needs a catalog regen (true total 93).
2. **Live skill runs:** execute the 4 skills on a configured instance; confirm the notify destination first.
3. **D submission:** run DFINITY's eval suite (`SUBMISSION.md`), then one PR per skill.
4. **cycles-balance identity path:** exercise with a real controller PEM (not configured here).

## Blockers

- All four PRs: review approval (branch protection) — not bypassable by me.
- Live skill harness runs: no configured Aeon instance reachable from this session.
- D external submission: DFINITY's mandatory eval-results gate (skill-validator + a claude-cli judge run).

# Aeon × ICP Integration — PRD & Execution Ledger

**Status:** In execution. **Owner:** Aeon engineering. **Last updated:** 2026-11-04.
**Source of truth** for the Aeon × ICP mandate. Pairs with the investigation under
`docs/icp/` (merged via PR #1316) and the live execution ledger in
[`EXECUTION-LEDGER.md`](EXECUTION-LEDGER.md).

## 1. Original DFINITY commitments

From Aeon's Growth-Lead proposal to DFINITY — four commitments:

1. **ICP MCP integration** — agents can query/interact with canisters.
2. **ICP skill pack** — scheduled canister monitoring, cycles-balance alerts, SNS
   proposal digests, deploy-check capabilities.
3. **ICP Skills contribution** — make the validated skill pack discoverable via the
   ICP community catalogue (`skills.internetcomputer.org`).
4. **ICP security offering** — free scheduled security scans for ICP app builders.

## 2. Workstreams → requirements → acceptance

### Workstream A — ICP connectivity (commitment 1)

**Decision (from `ICP-MCP-VERIFICATION.md`, verified):** the hosted ICP MCP
connector is **interactive-only** (`authorization_code` + PKCE + Internet Identity;
no refresh-token grant, no machine grant), so it is **structurally incompatible with
Aeon's headless `refresh_token`-only OAuth** (`scripts/mcp-oauth-refresh.sh`). Aeon
does **not** build against the connector.

**Headless path = direct-to-IC over the public HTTP gateway (read), identity-signed
calls (write).** For the monitoring skills (read-only), this is the IC HTTP gateway
+ the public dashboard/ledger APIs over `curl`/`./secretcurl` — no secret, no browser,
no MCP. A future write path (if ever needed) uses an `ic-agent`/`icp-cli` call signed
by a PEM identity stored as a secret and invoked in-run via `./secretcurl`.

- **FR-A1:** A documented, headless, no-secret **read** path to canister state
  (status, cycles, controllers) and governance (SNS/NNS) data.
- **FR-A2:** The path integrates with Aeon's real `requires:`/`./secretcurl`
  conventions; **no secrets in logs/commits/fixtures/reports**.
- **Acceptance:** at least one skill in Workstream B performs a live read via this
  path and reports real data; the path and its constraints are documented here.
- **Explicit boundary:** no mainnet write / cycles-spend / identity action is in
  scope for this delivery (recorded, not attempted).

### Workstream B — ICP skill pack (commitment 2)

Four Aeon-native skills (Aeon schema + headless execution + `./notify` reporting;
`mode: read-only` where they only read). ICP guidance (`icskills`) is reused as
**knowledge**, not installed — per `ICP-SKILLS-COMPATIBILITY.md`.

- **FR-B1 `canister-status`** — monitor a canister's status/running-state/module
  hash/controllers; alert on change.
- **FR-B2 `cycles-balance`** — monitor a canister's cycles balance; alert below a
  configurable threshold (cycle-drain / freeze risk, canister-security #5).
- **FR-B3 `sns-digest`** — monitor SNS/NNS proposals and produce a digest.
- **FR-B4 `icp-deploy-check`** — pre-deploy checklist based on official ICP guidance
  (controller backup #6, anonymous-principal #2, fetch_root_key #7, upgrade safety
  #4) — reuses the embedded `canister-audit` checklist knowledge.
- **Acceptance:** each has valid Aeon frontmatter (passes `bin/generate-skills-json`
  + `aeon-doctor`), a documented `var` contract, a scheduling example, and a dry-run
  evidence note; read-only skills run in `read-only` mode.

### Workstream C — ICP security auditing (commitment 4) — **DELIVERED (PR #1328)**

`canister-audit`: the IC sibling of `sc-audit`. Detect → static (Semgrep IC ruleset +
cargo-audit) → threat model → bounded agentic pass over the 12 canister-security
pitfalls → triage + refutation → PocketIC PoC via the shared `command`-mode gate →
shared disclosure/dedup/report. Fixture `token_vault` (unguarded mint + guarded
negative control) with a PocketIC reproduction.

- **Acceptance:** skill registered in the catalog; static rules fire on the fixture
  flaw and clear the guarded controls; fixture builds to wasm32; PoC schema valid;
  shellcheck/actionlint clean. **Met** (local evidence in PR #1328). PocketIC runtime
  reproduction runs in the staged CI/Epoch runner (binary unavailable in dev).

### Workstream D — ICP Skills contribution & ecosystem delivery (commitment 3)

- **FR-D1:** validate the Workstream-B skills against the ICP catalogue schema
  (`dfinity/icskills/skills/skill.schema.json`, `additionalProperties:false`).
- **FR-D2:** where an Aeon skill cannot be ICP-schema-native (the common case — Aeon
  needs `mode`/`var`/`requires`), contribute the **knowledge/workflow** in ICP's
  required format rather than force-fitting Aeon frontmatter.
- **FR-D3:** a demonstrable workflow for DFINITY + an onboarding path for the security
  offering.
- **Acceptance:** a validated contribution package prepared against the real schema,
  with documentation, limitations, and evidence; submitted only when genuinely
  compatible.

## 3. Architecture & integration decisions

- **Reuse over rebuild:** `canister-audit` reuses `vuln-scanner`/`sc-audit`'s PoC gate
  (`command` mode), disclosure routing, dedup ledger, coverage manifest, report shape,
  and the staging + `skill_mode.sh` allowlist pattern — net-new is only IC-specific
  analysis.
- **Knowledge, not skills:** `dfinity/icskills` content is embedded as reference
  (`skills/canister-audit/references/ic-security-checklist.md`), never installed as a
  runnable Aeon skill (schema + execution-model incompatibility).
- **Headless, source-first:** no runtime IC access is required for the audit; the
  monitoring skills read the public IC HTTP gateway without secrets.
- **Verification spine:** Epoch (no-secrets runner) for compile + PocketIC tests,
  within its documented local/compile-only constraints.

## 4. Permissions & security boundaries

- Read-only skills run in `read-only` mode (repo-mutation tools stripped).
- Secret-bearing calls use `./secretcurl` placeholders; secrets never hit the command
  line, logs, commits, fixtures, or reports.
- Staged binaries are version- and sha256-pinned (fail-closed).
- Security findings: static detection ≠ reproduction ≠ confirmed; HIGH/CRITICAL must
  pass the PoC gate before any disclosure. No live-network claim without evidence.

## 5. Delivery milestones & status

| # | Milestone | Status |
|---|---|---|
| M1 | Investigation docs on `main` | PR #1316 open (needs human approval; `REVIEW_REQUIRED`) |
| M2 | `canister-audit` skill + fixture + staging + catalog | **Delivered — PR #1328, CI-green incl. eyebrow; awaits review approval** |
| M3 | PRD + execution ledger | **This PR (#1329)** |
| M4 | Skill pack (B: 4 skills) | **Delivered — PR #1330; config/mode/requires/scheduler tests pass** |
| M5 | Connectivity path documented + exercised by a B skill (A) | **Delivered — `ICP-CONNECTIVITY.md` (in #1330); public reads curl-verified** |
| M6 | Contribution package validated (D) | **Delivered — `docs/icp/contribution/icskills/` (in #1330); schema-valid; prepared, not submitted** |
| M7 | Demo + handoff | In progress — pending the two merges + a live skill-run demo |

## 6. Known limitations & deferred work

- PocketIC runtime reproduction is verified only in the staged runner, not in the dev
  environment (no server binary locally). The crate↔server pair is pinned (both 16.x).
- No Motoko canister support (Rust only) — deferred.
- No mainnet write/identity/cycles-spend path — out of scope; recorded.
- PR #1316 and #1328 cross-link `docs/icp/`; links resolve once both land on `main`.

# Aeon Contributor Dossier

> **Status:** Working draft. Internal to the local fork at `/Users/Anonymous/Desktop/aeon-main`. Not yet proposed upstream.
> **Authored:** 2026-05-26 by Andrew + Claude, full co-author posture.
> **Lives in:** `docs/contributor-dossier/`.

A complete contributor reference for the Aeon framework — architecture, governance, security, implementation, testing, plus a strategic Expansion Charter with four deep proof-of-concept sketches.

---

## Index

| Doc | What it covers | Read time |
|---|---|---|
| [`00-OVERVIEW.md`](00-OVERVIEW.md) | Audience, scope, reading paths | 5 min |
| [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md) | System diagram, the closed loop, distribution surfaces | 10 min |
| [`02-TREE-WALK.md`](02-TREE-WALK.md) | Annotated tour of every directory and significant file | 15 min |
| [`03-subsystems/`](03-subsystems/) | Per-subsystem deep dives (11 docs) | ~90 min total |
| [`04-GOVERNANCE.md`](04-GOVERNANCE.md) | Roles, contribution flow, upstream/fork relationship, co-author posture | 10 min |
| [`05-SECURITY.md`](05-SECURITY.md) | Threat model, sandbox, supply chain, Fleet Watcher | 15 min |
| [`06-IMPLEMENTATION-PATTERNS.md`](06-IMPLEMENTATION-PATTERNS.md) | How to write a new skill that fits the conventions | 10 min |
| [`07-TESTING.md`](07-TESTING.md) | Existing test surface + the scaffolding we ship in this dossier | 10 min |
| [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md) | Decisions requiring author input (20 items) | 5 min |
| [`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md) | 9 candidate Chapter Three directions, 5 with deep PoC sketches | 25 min |
| [`_tests-scaffold/`](_tests-scaffold/) | Runnable test scaffolds (lint, api-gate, MCP/A2A smoke, doctor) | — |
| [`_session-prompts/`](_session-prompts/) | Per-expansion-option build packets (9 sessions) — paste into a fresh Claude session to start building | — |
| [`_modes/`](_modes/) | Operational modes for driving work — currently: **Sealed Sprint** (pre-authorized, local-only, no commits until 100% complete) | — |
| [`_sprint-log/`](_sprint-log/) | Append-only trail of past Sealed Sprints | — |

**Full linear read: ~3.5 hours.** Reference lookups: ~5–10 min per question.

## Subsystem docs

| Subsystem | Doc |
|---|---|
| GitHub Actions runtime + scheduler + chains | [`03-subsystems/runtime.md`](03-subsystems/runtime.md) |
| Skill format contract + composition primitives | [`03-subsystems/skills.md`](03-subsystems/skills.md) |
| Local dashboard (Next.js + `gh` shellout + security gate) | [`03-subsystems/dashboard.md`](03-subsystems/dashboard.md) |
| MCP server (stdio, Claude Desktop / Code) | [`03-subsystems/mcp-server.md`](03-subsystems/mcp-server.md) |
| A2A gateway (HTTP + JSON-RPC + SSE) | [`03-subsystems/a2a-server.md`](03-subsystems/a2a-server.md) |
| Multi-channel notifications + inbound messages | [`03-subsystems/notifications.md`](03-subsystems/notifications.md) |
| File-based memory architecture | [`03-subsystems/memory.md`](03-subsystems/memory.md) |
| Self-healing loop (heartbeat → repair → improve) | [`03-subsystems/self-healing.md`](03-subsystems/self-healing.md) |
| Fleet observation + cross-instance management | [`03-subsystems/fleet.md`](03-subsystems/fleet.md) |
| External integrations (Bankr, Smithery, x402, Fleet Watcher) | [`03-subsystems/integrations.md`](03-subsystems/integrations.md) |
| Optional personality layer | [`03-subsystems/soul.md`](03-subsystems/soul.md) |

---

## Recommended reading paths

**New contributor, day one (linear, ~2 hours):**
`00` → `01` → `02` → `03-subsystems/runtime.md` → `03-subsystems/skills.md` → `03-subsystems/memory.md` → `03-subsystems/self-healing.md` → `05` → `06` → `07`.

**Strategic review (joint with author, ~45 min):**
`00` → `04` → `09` → `08`.

**Security review (independent, ~30 min):**
`05` → `03-subsystems/dashboard.md` → `03-subsystems/integrations.md`.

**Reference lookups (5–10 min per question):**
Use the subsystem doc index above. Every doc has a "Related docs" footer for cross-navigation.

---

## Change-order summary

Below is the full list of artifacts produced and what each requires before merging upstream. The dossier itself lives only on the local fork right now; nothing here is proposed to `aaronjmars/aeon` without author sign-off (per the engagement scoping — see [`04-GOVERNANCE.md`](04-GOVERNANCE.md)).

### Docs to merge (10 files + 11 subsystem docs)

| Path | Action | Author sign-off needed? |
|---|---|---|
| `docs/contributor-dossier/README.md` (this file) | Add | No (low risk) |
| `docs/contributor-dossier/00-OVERVIEW.md` | Add | No |
| `docs/contributor-dossier/01-ARCHITECTURE.md` | Add | No |
| `docs/contributor-dossier/02-TREE-WALK.md` | Add | No |
| `docs/contributor-dossier/03-subsystems/*.md` (11 files) | Add | No |
| `docs/contributor-dossier/04-GOVERNANCE.md` | Add | **Yes** — describes role expectations |
| `docs/contributor-dossier/05-SECURITY.md` | Add | **Yes** — public threat model |
| `docs/contributor-dossier/06-IMPLEMENTATION-PATTERNS.md` | Add | No |
| `docs/contributor-dossier/07-TESTING.md` | Add | No |
| `docs/contributor-dossier/08-OPEN-QUESTIONS.md` | **Author-internal** — do not publish | N/A (private) |
| `docs/contributor-dossier/09-EXPANSION-OPTIONS.md` | **Author-internal** — do not publish | N/A (private) |

Recommendation: split into two PRs.
- **PR 1 (no author block, public)** — 00, 01, 02, 03-subsystems/*, 06, 07.
- **PR 2 (author review, public after revision)** — 04, 05.
- **No PR** — 08, 09 stay in our private fork as decision artifacts.

### Skills / tests to add

| Path | Action | Effort | Risk |
|---|---|---|---|
| `skills/_lint/skill-lint.sh` | Add (scaffold ready at `_tests-scaffold/skill-lint.sh`) | ½ day to wire CI | Low — non-blocking initially |
| `.github/workflows/lint.yml` | Add (scaffold; runs skill-lint + actionlint) | ½ day | Low |
| `dashboard/__tests__/api-gate.test.ts` | Add (scaffold at `_tests-scaffold/api-gate.test.ts`) | 1 day to refit `import` + verify | Low |
| `dashboard/package.json` | Add `vitest` devDep + `test` script | 1 hour | Low |
| `mcp-server/__tests__/smoke.ts` | Add (scaffold at `_tests-scaffold/mcp-smoke.ts`) | 1 day to verify | Low |
| `mcp-server/package.json` | Add `vitest` devDep + `test` script | 1 hour | Low |
| `a2a-server/__tests__/smoke.ts` | Add (scaffold at `_tests-scaffold/a2a-smoke.ts`) | 1 day to verify | Low |
| `a2a-server/package.json` | Add `vitest` devDep + `test` script | 1 hour | Low |
| `scripts/doctor` | Add (scaffold at `_tests-scaffold/doctor.sh`) | ½ day | Low — local-only tool |
| `.github/workflows/test-runtime.yml` | Add (runs vitest in dashboard/mcp/a2a on changes) | ½ day | Low — non-blocking initially |

Total scaffold-to-merge effort: **~5–6 days** for the full test surface.

### What requires author conversation before anything ships upstream

From [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md), the items that gate upstream PRs:

- **Q1** Formal co-maintainer status — affects what we can merge ourselves.
- **Q2** Release process — introducing SemVer is a meaningful change to fork-operator expectations.
- **Q6** Fleet Watcher canonical repo — referenced from README; placeholder org needs resolving.
- **Q7** MCP npm package publication — Smithery submission depends.
- **Q14** Trusted-sources signing — supply-chain hardening proposal.

### What requires author conversation before we start building the expansion

From [`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md):

| Decision | Required for | Recommendation |
|---|---|---|
| Cloudflare runtime: alongside vs replacement | #1 | Alongside |
| KG memory: commit index vs build on-demand | #2 | Build on-demand |
| Aeon-as-protocol positioning yes/no | #3 | **Yes, defer build until after #1/#2** |
| Embedding model: Workers AI vs OpenAI | #6 | Workers AI primary |
| Sequencing | All | #6 → #2 → #1 |
| Federation discovery hosting | #3 | Author's call |

---

## What the dossier does NOT do

- It does not pre-empt the author. Every author-facing decision is captured in [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md) or [`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md). We have recommendations; we do not have decisions.
- It does not change any production behavior. No `aeon.yml` edits, no skill modifications, no workflow changes, no commits.
- It does not propose a brand or comms rollout. Externally-visible work stays the author's domain.

## What to do next

1. **Read [`00-OVERVIEW.md`](00-OVERVIEW.md)** to calibrate.
2. **Share [`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md)** with the author for the strategic discussion.
3. **Use [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md) as the agenda** for the joint planning conversation.
4. **Pilot a test scaffold** — running `bash _tests-scaffold/skill-lint.sh` against the current skills/ directory will surface real conformance gaps and is the lowest-cost validation that the dossier framing matches reality.

---

## Stats

- **35 files** (10 top-level + 11 subsystem + 5 test scaffolds + 10 session prompts including index, but we recommend keeping `08` + `09` + `_session-prompts/` private).
- **~6,700 lines** of prose + code across all artifacts.
- **~430 file:line citations** to existing repo code for traceability.
- **Four agent-research deep-dives** (runtime, dashboard+security, MCP/A2A+integrations, memory+self-healing+fleet) feeding the synthesis.
- **Nine session-prompt packets** covering every expansion option from the menu in [`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md) — paste any one into a fresh Claude/Claude Code session to start building.

Built in one session. Should be re-validated quarterly as the codebase evolves.

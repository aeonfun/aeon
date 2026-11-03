# ICP-SKILLS-COMPATIBILITY.md

**Scope:** The official `dfinity/icskills` schema vs Aeon's skill loader; per-skill review of the requested skills; how to reuse the knowledge **without** pretending an interactive coding skill is an autonomous scheduled workflow.
**Date:** 2026-11-03. **Evidence:** raw files fetched from `raw.githubusercontent.com/dfinity/icskills/main`, the machine index `skills.internetcomputer.org/.well-known/skills/index.json`, and Aeon skill frontmatter in `/Users/mac/aeon/skills/`.

---

## 1. The official catalog — `Confirmed`

`dfinity/icskills` serves **36 skills** (via `.well-known/skills/index.json`, HTTP 200, and the GitHub contents API). Install methods: `npx skills add dfinity/icskills` (→ `.claude/skills/`), per-file `curl .well-known/skills/<name>/SKILL.md`, or the agent-fetch `llms.txt` at `skills.internetcomputer.org`. Each skill is `skills/<name>/SKILL.md` with YAML frontmatter; schema at `skills/skill.schema.json`.

Security-relevant subset: `canister-security`, `reviewing-motoko`, `certified-variables`, `vetkeys`, `encrypted-maps`. Ops: `icp-cli`, `cycles-management`, `buy-cycles`, `multi-canister`, `stable-memory`, `mops-cli`, `autoupgrade-icp-cli`. Governance: `sns-launch`. Identity: `internet-identity`, `agent-web-identity`, `wallet-integration`.

## 2. Schema comparison — `Confirmed`

**ICP schema (`skills/skill.schema.json`), aligned to agentskills.io:**
```
required: name, description, metadata{ required: title, category }
optional (top-level): license, compatibility
additionalProperties: false   ← at BOTH top level and inside metadata
category vocab: Auth|CloudEngine|Core|DeFi|Frontend|Governance|Infrastructure|Integration|Motoko|Security
```

**Aeon loader frontmatter (observed in `skills/*/SKILL.md`, e.g. `base-mcp`, `robinhood-mcp`, `vuln-scanner`):**
```
name, description, metadata{ title, mode, category, tags, var, mcp, capabilities, depends_on, requires, version, … }
category vocab: core|evolution|basics|dev|crypto|productivity
```

| Field | ICP | Aeon | Verdict |
|---|---|---|---|
| `name`, `description` | required | required | **compatible** |
| `metadata.title` | required | present | **compatible** |
| `metadata.category` | required (ICP vocab) | required (Aeon vocab) | **value clash** (`Security` ≠ `dev`) |
| `metadata.mode` (read-only/write) | — | **drives capability tier** | **ICP skills lack it** |
| `metadata.var` | — | input contract | missing |
| `metadata.mcp/requires/capabilities/depends_on` | — | runtime wiring | missing |
| extra metadata keys | **rejected** (`additionalProperties:false`) | permissive | **one-way** |

**Compatibility is one-way.** Aeon's loader is permissive, so it can *read* an ICP skill's `name/description/title/category`. But an ICP `SKILL.md` is **not a runnable Aeon skill**: it has no `mode`, no `var`, no `requires`, and its body is written for a developer-in-the-loop, not a headless cron run. And conversely, an Aeon skill's extra metadata would **fail ICP's own validator** (`additionalProperties:false`). `Confidence: Confirmed.`

## 3. Execution assumptions of ICP skills — `Confirmed`

ICP skills are **interactive coding-assistant skills**, triggered when "writing or modifying a canister" (canister-security `description`). They assume:
- a **human developer in an edit/deploy loop** (canister-security pitfall #6: "When deploying, ask the developer if they have a backup controller principal");
- a **local canister project on disk** (`mops.toml`, `Cargo.toml`, `src/`);
- the **`icp` CLI installed** (`cycles-management` declares `compatibility: "icp-cli >= 0.2.2"`; both skills are dense with `icp canister …` commands) plus `mops` / `ic-cdk` toolchain;
- **no** Aeon run semantics: no `./notify`, no `memory/logs`, no `output/.chains`, no `${var}` contract, no scheduled/headless mode.

A scheduled Aeon run has none of these by default. Installing these as runnable Aeon skills would be "pretending an interactive coding skill is an autonomous scheduled workflow" — the exact thing to avoid.

## 4. Per-skill review

| Skill | Category | Depth read | Contents / assumptions | Reuse |
|---|---|---|---|---|
| **canister-security** | Security | **Full** (17.8 KB) | **12 IC-specific pitfalls** (anon-principal, TOCTOU across `await`, CallerGuard reentrancy, `pre_upgrade` trap, cycle drain, single-controller, `fetchRootKey()`, unguarded admin, secrets-in-state, unbounded storage, callback-trap-after-mutation, unbounded-wait). Copy-paste Motoko + Rust patterns. | **Primary knowledge source for the audit arm** (see ICP-SECURITY-IMPLEMENTATION-DESIGN.md) |
| **cycles-management** | Infrastructure | **Full** (13.6 KB) | `compatibility: icp-cli >= 0.2.2`. Cycle balance/top-up/freezing; the "anyone can burn your cycles" DoS; CMC/cycles-ledger/mgmt-canister IDs. | DoS/cycle-drain finding class; operational monitoring knowledge |
| **icp-cli** | Core | Frontmatter + size (35 KB) | The CLI command reference (largest skill). Assumes `icp` CLI present. | Command catalog for any direct-to-IC skill; **not** needed for a source audit |
| **stable-memory** | (Motoko/Infra) | Frontmatter + size (17.4 KB) | Stable-structures / persistent-actor upgrade-safety patterns. | Upgrade-safety finding class (pitfall #4). `Confidence: Medium` on internals (not fully read) |
| **sns-launch** | Governance | Index-identified only | The SNS skill (there is no `sns-*` family, just `sns-launch`). | Out of scope for Rust-canister audit; `Confidence: Low` (not read) |

## 5. Reuse strategy — `Confidence: High`

**Reuse the *knowledge*, not the *skills*.**
1. **Embed** the canister-security 12-pitfall taxonomy and the Motoko/Rust correct-patterns as **reference material inside a new Aeon skill** (`skills/canister-audit/references/ic-security-checklist.md`) — the agentic audit arm reads it the way `sc-audit` reads `references/hook-checklist.md`. This is the "extend what exists" move.
2. **Do NOT** `npx skills add dfinity/icskills` into the Aeon *runtime*. It targets an interactive `.claude/skills/` dev surface, carries the wrong frontmatter for Aeon's loader, and assumes a dev-in-the-loop.
3. For **interactive** development help (writing the audit skill, or a human debugging a canister), installing icskills into a local `.claude/skills/` **is** appropriate — but that is a developer convenience on a workstation, separate from the Aeon fleet. `autosync-ic-skills` keeps such a local copy fresh.
4. The **category-vocab clash** and `additionalProperties:false` mean any ICP content repackaged as an Aeon skill must be **rewritten** into Aeon frontmatter (`mode`, `var`, `requires`) and Aeon run semantics — a port, not a copy.

## 6. Open decision this report feeds
- **ICP-skills install target/method** is still a user decision: (a) embed knowledge into a new Aeon skill (recommended for the fleet); and/or (b) `npx skills add dfinity/icskills` into a local `.claude/skills/` for interactive authoring only. Confirm before any install (standing rule: do not install).

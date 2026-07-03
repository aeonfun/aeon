---
layout: default
title: The Core
---

# The Core

The `core` category is the load-bearing set — the 15 skills that make Aeon autonomous rather than just scheduled. Everything else in the catalog is a workload; these are the machine. They group into three clusters: **self-evolution & self-healing**, **fleet / self-replication**, and **autonomous real-world action**.

If you're building a derivative architecture, this is the set to keep and validate first. It doesn't need to be 100% identical — but each skill below earns its place with a specific mechanism, and those mechanisms are what to preserve.

---

## 🧬 Self-evolution & self-healing

### [`autoresearch`](../skills/autoresearch/SKILL.md) — evolves an existing skill

**Input:** `var` = a skill name (required; aborts if empty)

1. Loads the target SKILL.md, parses its purpose / data sources / output format / dependencies, and saves the original for the diff.
2. **Researches improvements** — web-searches for better / alternative APIs, best practices, and known failure modes, plus reviews recent `memory/logs/` runs and `cron-state.json` to see if it's been failing.
3. **Generates 4 variations**, each with a fixed thesis: **A** better inputs (data sources), **B** sharper output (format / quality), **C** more robust (fallbacks, edge cases, error handling), **D** rethink (a fundamentally different approach).
4. Scores them against a rubric and ships the winner as a PR — tagging the chosen lineage as an HTML comment (`<!-- autoresearch: variation X -->`) at the top of the file.

That comment is why you can see it already ran across the library: `skill-repair` is variation D, `skill-health` C, and `create-skill` / `deploy-prototype` / `vuln-scanner` B.

### [`create-skill`](../skills/create-skill/SKILL.md) — generates a brand-new skill from one sentence

**Input:** a natural-language description (required)

1. Parses the request into action verb + data source + output format + configurable param + cadence.
2. **Deep duplicate detection** — keyword-greps existing skills, reads the top 3 candidates, and if one already does it, exits `CREATE_SKILL_DUPLICATE`, suggesting you run the existing skill with a different `var=`.
3. **Researches the data sources** (WebSearch + WebFetch the canonical docs, cross-checked against a 2nd source to confirm the endpoint isn't deprecated) and records the URLs.
4. **New-secret guard** — reads existing secret *names* (never values) via `gh api`; if the new skill needs a secret that isn't configured, it forces the generated skill to degrade gracefully and documents the requirement in the PR.
5. Ships a complete, production-ready skill as a PR (never commits to main).

### [`skill-health`](../skills/skill-health/SKILL.md) — the detector · daily 18:00

Audits every enabled skill from `cron-state.json` + per-run Haiku quality scores (`memory/skill-health/*.json`) + a `skill-runs` fallback for sandbox-blocked runs. Classifies each as CRITICAL / DEGRADED / FLAPPING / WARNING / HEALTHY / NO-DATA via first-matching-rule, computes a severity score, and detects **systemic patterns** (≥2 skills sharing an API host or error signature).

It files issues into `memory/issues/ISS-NNN.md`, resolves them when a skill recovers (drops it from `affected_skills`, flips status to resolved), and notifies only on state change. It won't touch the issue tracker unless the operator has opted in by creating `INDEX.md`.

### [`skill-repair`](../skills/skill-repair/SKILL.md) — the fixer · reactive, `depends_on: skill-health`

Phases: PREFLIGHT → TRIAGE → DIAGNOSE → REPAIR → VERIFY → LOG, with a one-shot exit taxonomy (`REPAIR_OK_FIXED`, `REPAIR_OK_SYSTEMIC`, `REPAIR_DIAGNOSED_NO_FIX`, `REPAIR_NO_TARGETS`, `REPAIR_DRY_RUN`, `REPAIR_BLOCKED`).

- Triage auto-picks the worst *fixable* target from open issues + cron-state (success-rate < 0.5, low quality score), and clusters by normalized error signature — if 2+ skills share one, it switches to **systemic mode**: one shared issue, one shared fix, instead of N patches.
- Guards against looping: 24h per-skill cooldown (tracked in `skill-repair-history.json`), and caps itself at 3 repair PRs/day.
- Builds a diagnostic dossier, applies the fix, opens a PR, and verifies. `dry-run:NAME` diagnoses without writing.

### [`self-improve`](../skills/self-improve/SKILL.md) — broad self-tuning · every other day

Reads the last 2 days of logs + `cron-state.json` for the highest-impact, smallest fix (failing skills, timeouts, truncated notifications, low-quality output), makes **one** minimal targeted change (tighten a prompt, add backoff, fix a config), and opens a PR with Problem / Fix / Evidence.

Backpressure: if 3+ improvement PRs are already open, it exits without creating more debt. Explicitly forbidden from rewriting skills wholesale or touching architecture / secrets.

### How the loop closes

`skill-health` **detects** → file issue → `skill-repair` **fixes** → PR → merge → cron-state recovers → `skill-health` **resolves** the issue. `CLAUDE.md` codifies the contract: **the health skill files issues, repair skills close them.**

**Votable health** runs alongside this loop. Whenever a skill regresses (Haiku score 1–2 or a failure flag), the run appends a `⚠️ Regression …` comment to a per-skill GitHub Issue titled `health: <skill>` — silent on clean runs, so no spam. A human 👍/👎 on that issue sets repair priority (`health_triage.prioritize` ranks open items by votes, then severity), so `self-improve` / `skill-repair` fix what people care about and what's worst, first. On by default; disable with the repo variable `HEALTH_ISSUES=0`. State itself rides an append-only Issue too — see [Durable state](https://github.com/aaronjmars/aeon#durable-state-without-the-churn) (`STATE_BACKEND`).

---

## 🛰️ Fleet / self-replication

### [`spawn-instance`](../skills/spawn-instance/SKILL.md) — clones the agent into a new repo

**Input:** `var` = `"name: purpose"`

Forks the repo (using the upstream parent if this is itself a fork), sanitizes the name into `aeon-<name>`, configures its skill plan for the stated purpose, validates, enables Actions, and registers it in `memory/instances.json`. Full exit taxonomy with idempotent recovery (`SPAWN_FORK_EXISTS_RECOVERED` vs. `..._REGISTERED`, `SPAWN_PUSH_FAILED`, etc.) and preflight checks (`gh` auth, rate limit ≥50).

Seeds the repo but **never propagates secrets** — each clone is inert until its owner adds their own API keys, giving billing isolation and blast-radius containment.

### [`fleet-control`](../skills/fleet-control/SKILL.md) — operates the managed fleet · twice daily 9/15

Three modes via `var`: **Health Check** (default), **Status** (`status`), **Dispatch** (`dispatch <instance|*> <skill> [var=…]`). For each registered instance it runs 3 parallel `gh` calls (repo metadata, last-24h workflow runs, child cron-state) into `/tmp`, classifies each as healthy / reachable, and emits a verdict-first report with a per-instance next-action column.

Dispatch mode lets the parent trigger a skill on one child — or all healthy / degraded children at once. State-change-gated notify; bails on missing `gh` auth or low rate limit.

### [`fleet-control`](../skills/fleet-control/SKILL.md) `scorecard` — fleet economics · daily 13:00

The **scorecard view** of `fleet-control` (run with `var: scorecard`; folded in the former standalone `fleet-scorecard`). Discovers the fleet at runtime (self + every non-archived instance — never hardcoded). All data is gathered by `scripts/prefetch-fleet-scorecard.sh` *outside* the sandbox, so the skill just reads `/tmp/fleet-scorecard/*` and writes the report — no network needed.

Aggregates runs / failures / generations / tokens / est. cost / cache discount (tokens in OpenRouter shape, cached ⊆ prompt), builds an Alerts block (any skill with ≥25% fail rate over 14d, cost spikes > 1.5× median daily delta, failure jumps > 10), writes `memory/scorecard.md` and appends a trend row to `scorecard-history.csv`.

### [`distribute-tokens`](../skills/distribute-tokens/SKILL.md) — the pay-your-contributors flywheel

`distribute-tokens` owns the whole flywheel as two phases you can run alone or chained (`var`: empty/`<label>` = send, `plan:` = plan only, `all:` = plan-then-send). The **plan phase** reads the latest `contributor-leaderboard` ranking, scores each contributor against a tier table (rank 1 = 25 USDC … rank 5 = 5, +5 first-PR bonus tracked once-ever per login, eligibility floor score ≥10 + must have an @handle), and writes the plan into `memory/distributions.yml` with a one-command run line. It deliberately **stops short of sending** — keeping a human-visible git diff as the audit trail. (This phase folded in the former standalone `contributor-reward` skill.)

The **send phase** (the default, empty `var`) does the actual on-chain send via the Bankr Wallet API with serious money-safety engineering: two-phase RESOLVE → EXECUTE (validate config / key / balance, resolve @handles → addresses, build plan; then send), per-recipient idempotency key + txHash so nothing double-sends across re-runs, dry-run mode, and recovery from partial runs. Wallet API for transfers only; read-only keys → 403 guard.

---

## 🤖 Autonomous real-world action

### [`feature`](../skills/feature/SKILL.md) — ships code to watched repos unprompted

**Input:** `owner/repo`, `owner/repo#N`, or empty (auto-pick)

Clones the repo, deeply reads it (CLAUDE.md, manifests, recent commits, open issues / PRs, test setup), then picks **one** change by priority: (1) fix an open issue, (2) code improvement — TODOs, missing error handling, untested critical paths, security fixes, (3) a new feature / DX improvement if the codebase is clean.

Implements it matching the repo's exact style on a branch (`ai/...`), commits with conventional-commit format (`Closes #N`), pushes, and opens a PR.

Hard rules: one enhancement per run, never push to main, no unrelated refactors, "if nothing's worth doing, log and exit." `feature` is the batch version that does this across the whole watched-repo list, preferring yesterday's repo.

### [`deploy-prototype`](../skills/deploy-prototype/SKILL.md) — generates a live web app and ships it to Vercel

**Input:** empty (auto-pick from signals), a plain brief, or a typed `type:slug` descriptor

Scans `memory/topics/` and recent logs for a prototype-worthy signal, scores candidates on leverage / concreteness / novelty (must clear 9/15 or it exits `DEPLOY_PROTOTYPE_EMPTY`). Commits to a shape (slug, tagline, primary action, static-vs-API-vs-Next), then writes the files into `.pending-deploy/files/` against a strict quality bar: self-contained, sub-1s load, mobile-first, OG tags, real data from public no-auth endpoints (no lorem), light / dark via `prefers-color-scheme`, no secrets.

Runs pre-flight checks (≤20 files, ≤4MB, slug regex, greps for leaked tokens and for TODO / placeholder), writes a prototype record + `prototypes.md` row. The actual GitHub-repo-create + Vercel deploy is handled by `scripts/postprocess-deploy.sh` (reads `.pending-deploy/`, uses `VERCEL_TOKEN` / `GH_GLOBAL`) — the skill flags `DEPLOY_PROTOTYPE_NO_POSTPROCESS` if that script is missing.

### [`vuln-scanner`](../skills/vuln-scanner/SKILL.md) — finds real vulns and discloses responsibly

**Input:** `owner/repo`, or auto-select from github-trending

Selection filters skip CTF / teaching repos, repos scanned in the last 30 days, and repos with no safe disclosure channel. Forks + shallow-clones, then runs **purpose-built scanners** (not grep): Semgrep, TruffleHog `--only-verified` (filesystem + git history), osv-scanner for dependency CVEs, Slither if Solidity is present — recording each tool's ok/fail status (**empty ≠ clean**).

Triages every hit by hand (read the code at the line, write one sentence on what an attacker controls, check reachability, assign severity; drop test / example findings). Then routes by finding type: dependency CVEs → public PR (already-public, net-positive); code flaws / verified secrets / contract bugs → a **Private Vulnerability Report** via `gh api .../security-advisories` (optionally a fix pushed to its own fork only, linked in the advisory — never a public PR). If no PVR and no SECURITY channel, it does nothing public and logs "no safe channel."

Core principles: do no harm, never post exploit chains publicly, all-scanners-failed ≠ clean (report as error). Dedup state in `memory/vuln-scanned.json`.

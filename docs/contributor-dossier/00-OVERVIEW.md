# Aeon Contributor Dossier — Overview

> **Status:** Working draft. Internal to the local fork at `/Users/Anonymous/Desktop/aeon-main`. Not yet proposed upstream.
> **Authored:** 2026-05-26 by Andrew + Claude (co-author posture, per scope agreement).
> **Audience:** A new Aeon contributor or co-maintainer who needs to be productive in one day.

---

## What this dossier is

A complete reference for the Aeon framework — architecture, governance, security, implementation patterns, and tests — written from a fresh read of the codebase at this point in time. It is **not** a substitute for the existing public docs (`README.md`, `ECOSYSTEM.md`, `SHOWCASE.md`, `docs/skill-graph.md`); it is the missing **internal layer** that explains the *why* and the *seams* a contributor needs to know before touching any of the 156 skills, the runtime, the dashboard, the MCP/A2A surface, or the memory subsystem.

It is paired with an **Expansion Charter** ([`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md)) — nine candidate Chapter Three directions with effort/impact/risk and deep proof-of-concept sketches.

## What Aeon is, in 90 seconds

Aeon is an autonomous-agent framework with an unusual operator posture: you configure it once and walk away. Most agent tooling (Claude Code, AutoGen, CrewAI, LangGraph) assumes you are in the loop on every step. Aeon assumes you are not. The runtime decides when to run, scores its own output, detects degradation, and patches its own failing skills — all on free GitHub Actions minutes, with file-based versioned memory and multi-channel notifications.

Concretely:

- **156 skills** — every skill is a single Markdown file (`skills/<name>/SKILL.md`) describing a one-shot task to Claude Code, plus optional `var`/`model` overrides.
- **GitHub Actions runtime** — workflows poll on cron, dispatch on labels, and execute via `claude -p -`.
- **Self-healing loop** — `heartbeat` → `skill-health` → `skill-evals` → `skill-repair` → `self-improve`. Reactive trigger fires `skill-repair` automatically after 3 consecutive failures of any skill.
- **Quality scoring** — every run scored 1–5 by Haiku, persisted under `memory/skill-health/`.
- **Memory** — file-based, git-versioned. `memory/MEMORY.md` is an index; `memory/topics/`, `memory/logs/`, `memory/issues/`, `memory/skill-health/`, `memory/cron-state.json` carry the detail.
- **Distribution surfaces** — same skills exposed as: GitHub Actions cron jobs, Claude Desktop/Code MCP tools (`./add-mcp`), A2A protocol HTTP endpoints (`./add-a2a`), and a local Next.js dashboard on port 5555.
- **Soul** — optional `soul/` directory propagates a personality (identity, voice, style) into every skill output via `CLAUDE.md`.
- **Notifications** — `./notify` fans out to Telegram, Discord, Slack, Email, and the dashboard json-render feed; each channel opt-in via secret presence.
- **Fork fleet** — `spawn-instance` forks the repo; `fleet-control` manages instances; `fork-skill-digest` learns from divergence across the ~24 active forks.
- **Ecosystem** — ~50 downstream products listed in `ECOSYSTEM.md` (Bankr, Reg Terminal, x402Books, PancakeSwap-listed integrations, etc.).
- **Optional layers** — Bankr LLM Gateway (~67% cheaper Opus); Fleet Watcher (inline ALLOW/BLOCK authorization).

## How to read this dossier

Two paths:

**Linear (~2 hours)** — for a brand-new contributor:

1. `01-ARCHITECTURE.md` — system diagram, data flow, skill lifecycle.
2. `02-TREE-WALK.md` — annotated directory tour.
3. `03-subsystems/runtime.md` → `skills.md` → `memory.md` → `self-healing.md` (the core loop).
4. `05-SECURITY.md` — threat model. Required reading before any PR touching the runtime, dashboard, or `add-*` scripts.
5. `06-IMPLEMENTATION-PATTERNS.md` — how to write a new skill that fits the conventions.
6. `07-TESTING.md` — what tests exist and what we ship with new skills.

**Reference (10 minutes per question)** — for an existing contributor:

- "How does the dashboard secure itself?" → `03-subsystems/dashboard.md` + `05-SECURITY.md`.
- "How does a skill chain work?" → `03-subsystems/skills.md` + `03-subsystems/runtime.md`.
- "How do I add an inbound integration?" → `03-subsystems/notifications.md` + `06-IMPLEMENTATION-PATTERNS.md`.
- "Where do we record open product decisions?" → `08-OPEN-QUESTIONS.md`.

## What's deliberately out of scope

- **Per-skill walkthroughs** — there are 156 skills; documenting each is the job of `skills.json` + each `SKILL.md`. We document *categories* and *exemplars*.
- **Step-by-step deploy / first-run setup** — `README.md` covers Quick Start. We document the *system the setup produces*, not the setup itself.
- **End-user / fork-operator material** — those audiences are served by `README.md`, `SHOWCASE.md`, and the dashboard's onboarding flow.

## Reading-time budget

| Doc | Pages | Read time |
|---|---|---|
| `00-OVERVIEW.md` | 2 | 5 min |
| `01-ARCHITECTURE.md` | 3 | 10 min |
| `02-TREE-WALK.md` | 4 | 15 min |
| `03-subsystems/*` (11 docs) | ~3 each | ~90 min total |
| `04-GOVERNANCE.md` | 3 | 10 min |
| `05-SECURITY.md` | 4 | 15 min |
| `06-IMPLEMENTATION-PATTERNS.md` | 3 | 10 min |
| `07-TESTING.md` | 3 | 10 min |
| `08-OPEN-QUESTIONS.md` | 2 | 5 min |
| `09-EXPANSION-OPTIONS.md` | 6 | 25 min |

Full linear read: **~3.5 hours.** Reference lookups: **~5–10 min** per question.

## A note on the co-author posture

The user is joining Aeon as a formal contributor alongside the original author (a personal friend). Per the engagement scoping, we operate as **peer co-authors**: we propose, defend, and commit directions unless the author objects. The dossier and expansion memo are drafted on that posture. The author retains final say on anything that lands in the upstream public repo; this dossier currently lives only on the local fork.

[`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md) collects the decisions that require an explicit author conversation before action.

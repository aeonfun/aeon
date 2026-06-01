# Aeon Operator Conventions

The patterns that turn Aeon from a per-operator cron harness into a reusable shared harness across `swarm-fund-mvp`, `prysm-squads-mvp`, and future agent-fleet projects. Read this before adding a new skill, adopting Aeon in a new repo, or changing a load-bearing convention.

Companion docs:
- [`outputs-contract.md`](outputs-contract.md) — the cross-repo signal JSON contract
- [`issue-schema.md`](issue-schema.md) — the ISS-NNN issue file format

## Memory consolidation cadence

The 2026-05-31 plan-adherence run discovered that the most expensive failure mode of an agentic system isn't a bad output — it's a stale snapshot of the system's own state masquerading as ground truth. `MEMORY.md` had been untouched for 23 days; every "N days remaining" countdown inside had fired; every "next priority" was from a 3-week-old plan. Plan-adherence then surfaced 15 "findings" that turned out to be 8 real + 4 phantom (the phantoms were live work the snapshot hadn't recorded).

Rules to prevent recurrence:

- **MEMORY.md must be consolidated within 7 days of any major decision** (new ADR, lifecycle change, falsifier window expiration). If 7 days pass without consolidation, plan-adherence files an issue with category `plan-drift` referencing ISS-025 as precedent.
- **MEMORY.md is the index, NOT the journal.** Keep it ≤100 lines. When a section grows beyond 10 lines, move detail to a topic file (`memory/topics/<topic>.md`) and leave a pointer in MEMORY.md.
- **Never append to MEMORY.md without consolidating.** If you find yourself adding a third "Next Priorities" section, you're appending. Merge.
- **Trust live sources over MEMORY.md when they conflict.** Examples: `rswarm.ai/metrics.json` for trade counts, `gh pr list` for PR state, `git log` for activity. MEMORY.md is a digest; live sources are truth.

The `consolidate-memory` skill (when run) must:
1. Read all of `memory/topics/*.md` and the current MEMORY.md.
2. Diff against the last 7 days of `memory/logs/*.md`.
3. Merge duplicate sections (e.g. multiple "Next Priorities").
4. Move section detail into topic files if a section exceeds 10 lines.
5. Update the `Last consolidated:` date at the top.

## Cross-repo source configuration

Skills that scan decisions, tasks, or memory from multiple repos read their source list from `memory/plan-adherence-config.yml`. The file maps repo → source paths → priority → enabled-state, so adding a new repo to scan is a one-config-line change rather than a SKILL.md edit.

Example:
```yaml
repositories:
  - repo: "tomscaria/swarm-fund-mvp"
    priority: 1            # P0 findings escalate to operator immediately
    enabled: true
    sources:
      - path: "DECISIONS.md"
      - path: "TASKS.md"
      - path: "CODEX_HANDOFF.md"
      - path: "kb/INDEX.md"

  - repo: "refractor-labs/prysm-squads-mvp"
    priority: 2            # P1 max until adoption is mature
    enabled: false         # flip to true once lore-coins-monitor lands
    sources:
      - path: "DECISIONS.md"     # to be created when prysm adopts the convention
      - path: "MASTER_PLAN.md"
```

Plan-adherence (and any future cross-repo skill) reads this config at the start of each run. It is the SINGLE source of truth for "what repos does Aeon watch."

## Outputs publishing

If a skill produces signals consumable by another system (downstream trading loop, third-party reader, sister-repo adapter), it MUST publish to `outputs/{skill}/{YYYY-MM-DD}.json` following the schema in [`outputs-contract.md`](outputs-contract.md).

Skills that publish outputs:
- Three Polymarket skills (`monitor-polymarket`, `polymarket-comments`, `narrative-tracker`) — feeding swarm-fund-mvp's `python/execution/aeon_adapter.py`.
- `lore-coins-monitor` (planned, Phase 1) — feeding any prysm-squads-mvp adapter.
- Future on-chain monitors as they come online.

Rules:
- Use the atomic-write pattern from the contract doc (temp file + `mv`, `python json.dump` for validation).
- Always log `ADR093_WRITE_FAIL` to stderr on write failure; never block the human-notify path.
- Never change the schema without bumping `schema_version` and updating consumers.

## Issue triage

Every detected drift, failure, or plan-divergence files as a `memory/issues/ISS-NNN.md` per [`issue-schema.md`](issue-schema.md). The control tower dashboard's `/api/issues` endpoint reads from this directory and surfaces open issues in Zone B (NEEDS-EYES).

Rules:
- Health/detector skills file. Repair/operator skills close.
- Plan-adherence files `category: plan-drift`. Other detectors use the established categories (config, sandbox-limitation, prompt-bug, etc.).
- Operator can mark `dismissed` to permanently silence a false positive — detector skills must respect this.
- Never silently close. Move to `status: resolved` with `resolved_at` populated. The audit trail matters.

## Skill model selection

Default: `claude-sonnet-4-6`.

Override only when:
- The task genuinely needs Opus-grade reasoning (multi-document synthesis, paper picking, deep research). Examples: `paper-pick`, `deep-research`, `narrative-tracker` (chains).
- The task is pure extraction with structured output (no judgment). Use Haiku. Examples: `notify-jsonrender`, `xai-bookmarks` (Phase 1).

If a `cost-report` flags weekly spend >$150, propose Sonnet downgrades for the highest-spend Opus skills first, then disable lowest-value skills.

## Sandbox patterns

GH Actions blocks outbound network from bash. Two recovery patterns:

1. **Prefetch** — `scripts/prefetch-{name}.sh` runs before Claude with full env. Skills read cached data from `.<name>-cache/`.
2. **Postprocess** — Skills write request JSON to `.pending-{name}/`. `scripts/postprocess-{name}.sh` runs after Claude with full env to fan out (used for `.pending-replicate/`, `.pending-notify/`).

For cross-repo `gh api` calls, the workflow sets `GH_TOKEN: secrets.GH_GLOBAL || secrets.GITHUB_TOKEN`. `GH_GLOBAL` is a Personal Access Token (PAT) with cross-repo scope. Without it, `gh api repos/<other-org>/...` returns 404 inside the sandbox. Always assume `GH_GLOBAL` is required for any cross-repo read.

## Notification fan-out

`./notify "message"` sends to all configured channels. `./notify-jsonrender <skill> <markdown>` produces a json-render spec for the dashboard.

Channel priority for inbound (replies, approvals): Telegram > Discord > Slack. First message found wins per poll cycle.

Skill output that requires operator action should land in:
- Telegram for time-sensitive things (approval prompts, P0 alerts).
- Dashboard NEEDS-EYES zone for queue items (issues, needs-review outputs).
- Both, when in doubt.

## Voice and style

Read `soul/SOUL.md`, `soul/STYLE.md`, `soul/examples/` before any external-facing notification. The brand-voice rules are enforced separately by `brand-voice-thomas` skill (Thomas OS) — but Aeon-side outputs should match the same voice naturally because the soul files are the gold-standard corpus.

Forbidden phrases (any external-facing content):
- "RenTech," "Simons," "Medallion" → use "live-ingest as moat"
- "Darwinian as mechanism" → "Darwinian as ambition" is fine
- "cross-venue alpha" → "convergence trade"
- "thought leader," "delve," "tapestry," "robust," "best-in-class," any emoji

## Adopting Aeon in a new repo

For prysm-squads-mvp (or any future adopter):

1. **Read these conventions in full.** Don't skip; the patterns compose.
2. **Add `memory/MEMORY.md` + `memory/topics/`** for the new repo's project state. Maintain the 7-day consolidation cadence.
3. **Add `memory/issues/INDEX.md`** following the issue-schema. Use a prefix (e.g. `PRYSM-NNN`) to avoid cross-repo number collisions.
4. **Add the new repo to `memory/plan-adherence-config.yml`** in Aeon. Start with `enabled: false`, `priority: 2`. Flip to `enabled: true` once the bridge skill is live.
5. **Add the new bridge skill** (the equivalent of `lore-coins-monitor`) to Aeon's `skills/`. Output JSON per the outputs contract.
6. **Add a consumer-side adapter** (the equivalent of `swarm-fund-mvp/python/execution/aeon_adapter.py`) in the new repo. Poll the same `outputs/{skill}/{date}.json` URL pattern.

After these six steps, the new repo participates fully in the Aeon shared harness: its decisions get scanned by plan-adherence, its bridge skill publishes signals, its consumer reads from Aeon, its issues land in the control tower.

## History

- **2026-05-31** — These conventions written after the Phase 0 audit pass surfaced gaps in cross-repo portability. The 23-day MEMORY.md staleness, the broken ADR-093 contract, and the planned prysm-squads-mvp adoption together made the implicit-conventions cost too high. Codifying them.

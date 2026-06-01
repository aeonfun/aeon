# Issue Schema (ISS-NNN)

Aeon's structured tracker for skill failures, plan drift, system problems, and operator-action items. Lives in `memory/issues/`. Indexed by `memory/issues/INDEX.md`.

This schema is portable: prysm-squads-mvp (and any future Aeon adopter) should use the same shape for fleet-side issue tracking. Health skills file issues; repair/operator skills close them.

## File layout

```
memory/issues/
  INDEX.md          # Open + Resolved tables. Updated atomically when filing or closing.
  ISS-001.md
  ISS-002.md
  ...
  ISS-NNN.md
```

Issue numbers are sequential and never reused. When closing an issue, move its row from the Open table to Resolved in `INDEX.md` but keep the `ISS-NNN.md` file (with `status: resolved`).

## Per-file schema (YAML frontmatter + markdown body)

```yaml
---
id: ISS-NNN                              # Required. Matches filename.
title: <one-line human summary>          # Required. Goes verbatim into INDEX.md.
status: open | investigating | fixing | resolved | wontfix | dismissed
severity: critical | high | medium | low
category: <see list below>
detected_by: <skill name>                # Required. Which skill surfaced this.
detected_at: <ISO-8601 UTC>              # Required.
resolved_at: <ISO-8601 UTC | null>       # Required (null if open).
affected_skills: [<skill name>, ...]     # Required. Empty list allowed.
root_cause: |                            # Required for severity >= medium.
  Multi-line explanation of what's wrong, why, and what the falsifier window
  was (if applicable). Cite source paths so future readers can verify.
fix_pr: <PR URL | null>                  # Optional. Populated when a fix lands.
---

(Optional markdown body below the frontmatter for additional context — diagnostics,
operator notes, repro steps, screenshots, related issues. Frontmatter is the
machine-readable surface; the body is human-only.)
```

## Severity tiers

| Severity | Definition | Example |
|---|---|---|
| `critical` | Skill / system at 0% success, OR a load-bearing falsifier expired with no plan-of-action, OR data integrity at risk | ADR-093 contract broken 14 days (ISS-021); feat/fs-adoption stranded (ISS-023) |
| `high` | >50% failure rate, OR a meaningful drift with measurable cost, OR an operator-action item blocking a goal | Reddit-digest 14 consecutive failures (ISS-012); ADR-095 velocity falsifier fired (ISS-022) |
| `medium` | Intermittent/degraded, OR an ambiguous reality check that needs operator verification | swarm-triage canary at 78% eval below 80% gate (ISS-026) |
| `low` | Noise reduction, optimization opportunity, structural-but-not-urgent improvement | MEMORY.md staleness pattern (ISS-025, after the content fix) |

Severity is not vibes. A finding is `critical` only if the reality check is concrete and definitive (file existence, count, exact comparison). Soft signals max out at `high`.

## Status lifecycle

```
open → investigating → fixing → resolved
                              ↓
                            wontfix | dismissed
```

- **`open`** — Filed, not yet picked up.
- **`investigating`** — Owner assigned, diagnosing root cause.
- **`fixing`** — PR open or work in progress.
- **`resolved`** — Reality check now passes. Move to Resolved table in INDEX.md.
- **`wontfix`** — Explicit decision not to fix (with a one-line reason in the body).
- **`dismissed`** — Operator marked as not-a-real-issue. Plan-adherence and similar detectors must respect this and not re-file.

`resolved` and `wontfix` require `resolved_at` populated. `dismissed` does too — and the detecting skill should never re-emit a dismissed finding.

## Categories

Use one of these. If a finding genuinely doesn't fit, add a new category in this doc rather than inventing one in an issue file (consistency matters for the dashboard `/api/issues` endpoint).

| Category | When to use |
|---|---|
| `config` | Misconfiguration in aeon.yml, secrets, env, or workflow YAML |
| `api-change` | Upstream API changed shape or returned new error codes |
| `rate-limit` | Hitting external rate limits (Reddit, X.com, on-chain providers) |
| `timeout` | Skill or step exceeded its time budget |
| `sandbox-limitation` | GH Actions sandbox blocking a step (use prefetch/postprocess workaround) |
| `permanent-limitation` | Structural blocker no workaround can fix |
| `prompt-bug` | Skill prompt logic produces wrong output despite working tools |
| `missing-secret` | A required secret is absent in the workflow env |
| `quality-regression` | Output quality degraded vs prior baseline |
| `output-format` | Skill output doesn't match its evals.json or downstream consumer expectations |
| `optimization` | Speed, cost, or readability improvement |
| `plan-drift` | Decision / falsifier / commitment from DECISIONS.md / MEMORY.md / TASKS.md not tracking reality (filed by plan-adherence) |
| `unknown` | Cause not yet identified |

## Who files vs who closes

- **Health/detector skills** file issues:
  - `heartbeat` files operational drift (failed skills, stuck dispatch).
  - `skill-health` files per-skill output-format issues.
  - `skill-evals` files quality-regression issues.
  - `plan-adherence` files `plan-drift` category issues.
  - `cost-report` files `optimization` category issues at anomaly thresholds.
- **Repair/operator skills** close issues:
  - `skill-repair` closes `prompt-bug`, `output-format` after auto-fix.
  - `autoresearch` closes `quality-regression` after retuning.
  - Operator-driven PRs close any of the above with `fix_pr:` populated.

A filing skill must NOT close its own issue without operator review. A repair skill closes only what it itself fixed; it must not move an issue to `wontfix` (that's an operator decision).

## INDEX.md format

Two tables, Open first then Resolved. Rows mirror the frontmatter:

```markdown
## Open

| ID | Title | Severity | Category | Detected | Affected Skills |
|----|-------|----------|----------|----------|-----------------|
| [ISS-NNN](ISS-NNN.md) | <title verbatim> | <severity> | <category> | YYYY-MM-DD | <comma-separated> |

## Resolved

| ID | Title | Severity | Fix PR | Resolved |
|----|-------|----------|--------|----------|
| [ISS-NNN](ISS-NNN.md) | <title verbatim> | <severity> | <PR URL or "—"> | YYYY-MM-DD |
```

Health skills MUST grep INDEX.md before filing to avoid duplicates. If an issue with the same root cause already exists, escalate severity on the existing one rather than filing a sibling.

## Portability to prysm-squads-mvp

Both repos use the same schema, the same INDEX.md format, and the same category taxonomy. The control tower's `/api/issues` endpoint reads from both repos and merges, surfacing `project: aeon | swarm-fund-mvp | prysm-squads-mvp` per issue.

When prysm-squads-mvp adopts this convention:
1. Create `memory/issues/INDEX.md` with the two tables.
2. Use the same severity, category, and status taxonomies.
3. Pick a separate ISS-NNN numbering range or use a prefix (e.g. `PRYSM-NNN`) to avoid cross-repo number collisions in the merged view.

## History

- **2026-04-25 → 2026-05-08** — Schema evolved organically as ISS-001 through ISS-020 were filed by heartbeat, skill-evals, skill-health.
- **2026-05-31** — `plan-drift` category added (filed by plan-adherence) for ISS-021 through ISS-028. This doc written to formalize the schema for portability.

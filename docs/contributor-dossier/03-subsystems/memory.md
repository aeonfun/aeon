# Subsystem: Memory

Aeon's memory is a directory of Markdown and JSON files, committed to the repo. There is no database, no embedding store, no external cache. Every skill reads and writes through `memory/` like it's RAM.

---

## Layout

```
memory/
├── MEMORY.md                    # index (≤50 lines): goals, active topics, pointers
├── cron-state.json              # per-skill execution metrics (source of truth for scheduling)
├── token-usage.csv              # token cost tracking, append-only
├── watched-repos.md             # repos that github-monitor / fork-* skills target
├── instances.json               # spawned fork registry (created by spawn-instance)
├── topics/                      # detailed notes by topic — promoted from MEMORY.md
│   ├── crypto.md
│   ├── research.md
│   ├── tracked-protocol.md      # x402-monitor protocol config
│   └── …
├── logs/                        # daily activity logs (append-only)
│   └── YYYY-MM-DD.md
├── issues/                      # structured issue tracker
│   ├── INDEX.md                 # open/resolved tables
│   └── ISS-NNN.md               # one file per issue with YAML frontmatter
├── skill-health/                # per-skill rolling quality history (last 30 runs)
│   └── <skill>.json             # written post-run by the Haiku scorer
├── state/                       # per-skill durable state (cooldowns, dedup hashes)
│   ├── skill-repair-history.json
│   └── fleet-control-state.json
└── pending-disclosures/         # vuln-scanner private write area (PVR)
```

Reading the structure top-down tells you what kind of data lives where:

- **Index (MEMORY.md)** — the agent's working memory. ≤50 lines. Anything that grows past that moves to `topics/`.
- **Topic files** — long-form. One topic per file. Linked from MEMORY.md.
- **Logs** — chronological. Append-only. Every skill writes a one-line entry per run.
- **Issues** — structured tracker for skill failures.
- **Skill-health** — per-skill rolling quality.
- **State** — internal bookkeeping for individual skills (cooldowns, dedup hashes).

## MEMORY.md — the working set

`memory/MEMORY.md` is treated as the agent's "what do I know right now" surface. Every skill reads it before doing work; `memory-flush` and `reflect` skills compact it back to ≤50 lines by promoting detail into `topics/`.

The canonical MEMORY.md sections (per [`memory-flush`](../../../skills/memory-flush/SKILL.md) and [`memory-structural-dedupe`](../../../skills/memory-structural-dedupe/SKILL.md)):

- **Recent Articles** — single canonical block, latest first
- **Skills Built** — capped table (~10–15 entries), older rows archived to `topics/skills-history.md`
- **Lessons Learned** — single canonical block
- **Recent Newsletters** — capped at 6
- **Issue Tracker** — pointer to `memory/issues/INDEX.md`
- **Wallet** — single canonical block
- **Next Priorities** — short list

Drift (multiple non-empty blocks per single-canonical section) is detected and collapsed by `memory-structural-dedupe`. This is the only formal "schema" memory has — and it's enforced by an LLM skill, not a validator.

## Topic files

`memory/topics/<name>.md` is freeform. The convention: one topic per file, with a short header explaining what the topic is and what skills consume it. Examples observed:

- `memory/topics/tracked-protocol.md` — config consumed by `x402-monitor` (queries, npm packages, accounts).
- `memory/topics/protocol-state-<protocol>.md` — output written by `x402-monitor` (momentum score, signal log).
- `memory/topics/fork-cohort-state.json` — state snapshot for `fork-cohort` ranking.
- `memory/topics/contributor-spotlight-history.json` — rolling history for `contributor-spotlight`.
- `memory/topics/fleet-state.json` — last 12 weeks of fleet trend.

Topic files are touched only by their owning skills, generally. There is no formal ownership system — it's by convention. New contributors should follow it: a skill that needs durable shared state writes to `memory/topics/<skill>.md` (state) or `memory/state/<skill>.json` (internal bookkeeping).

## Logs

`memory/logs/YYYY-MM-DD.md` — one file per day, append-only. Every skill's last step is "log to `memory/logs/${today}.md`" (see [`skills.md`](skills.md) § Prose conventions).

Format is freeform Markdown, but conventionally:

```markdown
## skill-name

- HH:MM — what happened
- HH:MM — EXIT_TAXONOMY_MARKER (SKILL_FOO_OK | SKILL_FOO_SKIP_QUIET | SKILL_FOO_ERROR | …)
```

The exit-taxonomy markers are read back by [`skill-analytics`](../../../skills/skill-analytics/SKILL.md) via best-effort regex grep ([`skill-analytics/SKILL.md:56-70`](../../../skills/skill-analytics/SKILL.md#L56-L70)) and by [`heartbeat`](../../../skills/heartbeat/SKILL.md) for dedup (last 48h, [`heartbeat/SKILL.md:62`](../../../skills/heartbeat/SKILL.md#L62)).

There is **no log rotation**. Files accumulate. The [`janitor`](../../../skills/janitor/SKILL.md) skill cleans ephemeral `.notify-*`, `.pending-notify-temp/`, and `.outputs/` artifacts on a 7–14 day TTL, but not log files. This is a deliberate tradeoff — logs are how the agent remembers what it did.

## Issue tracker

The issue tracker (`memory/issues/`) is a real structured artifact, not just notes.

**`INDEX.md`** ([`memory/issues/INDEX.md:1-12`](../../../memory/issues/INDEX.md)) — two tables, Open and Resolved:

```markdown
## Open
| ID | Title | Severity | Category | Detected | Affected Skills |
|----|-------|----------|----------|----------|-----------------|

## Resolved
| ID | Title | Severity | Fix PR | Resolved |
|----|-------|----------|--------|----------|
```

**`ISS-{NNN}.md`** — one file per issue (3-digit zero-padded ID). YAML frontmatter:

```yaml
---
id: ISS-001
title: Short description
status: open | investigating | fixing | resolved | wontfix
severity: critical | high | medium | low
category: config | api-change | rate-limit | timeout | sandbox-limitation
          | permanent-limitation | prompt-bug | missing-secret
          | quality-regression | output-format | optimization | unknown
detected_by: skill-health | skill-evals | batch-health | heartbeat | self-review | …
detected_at: ISO timestamp
resolved_at: ISO timestamp (when status flips)
affected_skills: [skill-a, skill-b]
root_cause: short string
fix_pr: PR number when resolution lands
---

Body — 2-3 lines describing the issue and any update history.
```

### The detector/closer contract

CLAUDE.md formalizes this:

- **Health skills file issues**: `skill-health`, `skill-evals`, `batch-health`, `heartbeat`, `self-review`.
- **Repair skills close issues**: `skill-repair`, `autoresearch`.

Detectors are responsible for dedup (check if an open issue with the same skill + root cause exists before filing). Closers move rows from Open to Resolved when their fix lands.

The lifecycle states (per CLAUDE.md): `open → investigating → fixing → resolved` (or `wontfix`).

**Current state** ([`memory/issues/INDEX.md`](../../../memory/issues/INDEX.md)): both tables are empty. No issues currently tracked.

## Cron-state

`memory/cron-state.json` is the **source of truth for scheduling**. Per-skill metrics (full schema in [`heartbeat/SKILL.md:18-34`](../../../skills/heartbeat/SKILL.md#L18-L34)):

```json
{
  "skill-name": {
    "last_dispatch":        "2026-04-06T12:00:00Z",
    "last_status":          "dispatched | success | failed",
    "last_success":         "2026-04-06T12:05:00Z",
    "last_failed":          "2026-04-05T12:03:00Z",
    "total_runs":           10,
    "total_successes":      8,
    "total_failures":       2,
    "consecutive_failures": 0,
    "success_rate":         0.80,
    "last_quality_score":   4,
    "last_error":           "rate_limit"
  }
}
```

Updated by the post-step in [`aeon.yml:882-998`](../../../.github/workflows/aeon.yml#L882-L998). Read by:

- The scheduler ([`messages.yml`](../../../.github/workflows/messages.yml)) for dedup, retry, and reactive trigger evaluation.
- `heartbeat` for P0 diagnostics (failed / stuck / chronic / API-degradation).
- `skill-health` for classification (CRITICAL / DEGRADED / FLAPPING / WARNING / HEALTHY / NO_DATA).
- `skill-analytics` for fleet-level rollups.
- `skill-repair` for triage and cooldown enforcement.

Workflow logs are ephemeral; cron-state is committed. If you need to know what ran when, this is the authoritative file.

## Skill-health rolling histories

`memory/skill-health/<skill>.json` — per-skill rolling 30-run quality history, populated by the Haiku scorer in [`aeon.yml:601-701`](../../../.github/workflows/aeon.yml#L601-L701). Fields include score (1–5), flags (`api_error`, `rate_limited`, `empty_output`, `stale_data`, `low_quality`, etc.), and a rolling average.

`memory/skill-health/last-report.json` is a separate file used by `skill-health` itself for dedup — stores the hash of the last-reported set of CRITICAL/FLAPPING/DEGRADED skills + SYSTEMIC callouts plus the timestamp, so it can suppress duplicate notifications within a 24h window ([`skill-health/SKILL.md:107-122`](../../../skills/skill-health/SKILL.md#L107-L122)).

## State files

`memory/state/<skill>.json` is per-skill internal bookkeeping. Examples:

- `memory/state/skill-repair-history.json` — cooldown tracking for `skill-repair` (last_repair_at, exit_code, fix_pr, issue) to prevent re-firing within 24h on the same target.
- `memory/state/fleet-control-state.json` — last fleet-control health snapshot for delta detection (NEW/DEGRADED/RECOVERED/DROPPED).

A skill that needs durable state across runs writes here. The convention is JSON for structured state, Markdown for human-readable topic state.

## Token-usage CSV

`memory/token-usage.csv` — append-only per-run cost log. Columns:

```
date, skill, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens
```

Written by [`aeon.yml:575-583`](../../../.github/workflows/aeon.yml#L575-L583). Read by the [`cost-report`](../../../skills/cost-report/SKILL.md) skill for weekly summaries.

## Memory hygiene skills

| Skill | What it does | When it fires |
|---|---|---|
| [`memory-flush`](../../../skills/memory-flush/SKILL.md) | Promotes log entries into MEMORY.md, removes stale entries, archives overflow tables to `topics/skills-history.md` | Cron (typically weekly) |
| [`memory-structural-dedupe`](../../../skills/memory-structural-dedupe/SKILL.md) | Detects sections with >1 non-empty block, picks canonical, merges unique info from non-canonical, rewrites | Cron (weekly) |
| [`reflect`](../../../skills/reflect/SKILL.md) | 7-day review: consolidate, reorganize, prune stale | Cron |
| [`janitor`](../../../skills/janitor/SKILL.md) | Delete ephemeral `.notify-*`, `.pending-notify-temp/`, `.outputs/` files past TTL | Cron (weekly) |

Without these, MEMORY.md drifts toward chaos within weeks. They are infrastructure-level skills — they should be enabled in any non-trivial fork.

## Watched repos

`memory/watched-repos.md` — one GitHub repo per line. Currently `aaronjmars/aeon`. Read by:

- `fork-skill-digest` (which fork target).
- `fork-contributor-leaderboard`, `fork-fleet`, `fork-cohort`, etc.
- `github-monitor`, `pr-review`, `issue-triage`, `external-feature` (when `var` is empty, they fall back to this list).

Add a repo here to bring it into the watched-repo skill orbit.

## Instances registry

`memory/instances.json` — written by [`spawn-instance`](../../../skills/spawn-instance/SKILL.md), read by [`fleet-control`](../../../skills/fleet-control/SKILL.md). Schema ([`spawn-instance/SKILL.md:66-79`](../../../skills/spawn-instance/SKILL.md#L66-L79)):

```json
{
  "instances": [
    {
      "name": "crypto-tracker",
      "repo": "OWNER/aeon-crypto-tracker",
      "purpose": "monitor DeFi protocols and token movements",
      "created": "2026-04-20",
      "status": "pending_secrets | active | degraded | archived",
      "skills_enabled": ["token-movers", "defi-monitor", "heartbeat"],
      "parent": "OWNER/aeon"
    }
  ]
}
```

See [`fleet.md`](fleet.md) for how this drives instance management.

## Operational gotchas

- **Memory writes go through the git commit step.** A skill that writes to `memory/foo.md` does not "save" until [`aeon.yml:813-880`](../../../.github/workflows/aeon.yml#L813-L880) commits. If the workflow fails before commit, the write is lost.
- **Parallel skills can race on `memory/*`.** The commit step auto-resolves rebase conflicts only for `memory/*`. Skills writing to the same file in the same tick window may have one overwritten — the conflict resolution is "take the new one" for memory files. If you need transactional semantics, that's an open question.
- **`cron-state.json` is small but hot.** Every skill run touches it. Don't make it bigger than it needs to be — the existing per-skill record is ~12 fields; resist adding more.
- **MEMORY.md is read by every skill.** Keep it short. The 50-line target is a hard upper bound, not a goal.
- **Topic files are not lint-checked.** If you write `memory/topics/foo.md` with an unusual schema, no test catches it. Convention is your only guide.

## Related docs

- [`runtime.md`](runtime.md) — the commit step that persists memory writes.
- [`self-healing.md`](self-healing.md) — how skill-health, skill-evals, skill-repair consume `cron-state.json` and `memory/issues/`.
- [`../05-SECURITY.md`](../05-SECURITY.md) — memory is part of the prompt-injection surface; rules apply.
- [`../06-IMPLEMENTATION-PATTERNS.md`](../06-IMPLEMENTATION-PATTERNS.md) — when to write to `topics/` vs `state/` vs `logs/`.

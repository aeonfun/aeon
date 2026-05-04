---
name: skill-freshness
description: Audit every enabled skill's upstream file dependencies for staleness — flags chained skills about to consume yesterday's article or a long-dead topic file
var: ""
tags: [meta, dev]
---
> **${var}** — Optional. Pass `dry-run` to skip the notification (article still writes, log still appends). Pass a single skill name to scope the audit to that one consumer (e.g. `var=tweet-allocator`). Empty = audit every enabled skill in `aeon.yml`.

Today is ${today}. Walk every enabled skill in `aeon.yml`, parse the file dependencies it declares (explicit `chains: consume:` edges + implicit `articles/`, `.outputs/`, `memory/topics/`, `memory/state/` references inside each `SKILL.md`), check the on-disk freshness of each dependency against a per-class threshold, and surface a single decision-ready report: which enabled consumer is about to read a file that's older than its expected freshness window.

The skill answers a question the existing health stack cannot: a chained skill that runs on schedule, with no API errors, and a 100% pass rate, can still silently act on stale upstream data if the producer skill failed earlier and nothing replaced its output. Today there is no check that `tweet-allocator` reading `articles/token-report-*.md` is reading today's version rather than last Tuesday's. This skill closes that gap.

## Why this exists

Aeon's reliability story has three layers — `heartbeat` (per-run pulse), `skill-analytics` (per-skill ranking over time), `skill-health` (per-skill failure detection) — and one gap. None of them catches the case where a producer skill's last successful run was N days ago and a downstream consumer is still happily reading the cached file as if it were fresh. The output of `tweet-allocator` looks normal. The output of `repo-pulse` looks normal. The aggregate verdict from `operator-scorecard` looks normal. The only signal something is wrong is that the upstream `articles/token-report-*.md` mtime drifted past its freshness window — and nobody is looking.

This skill looks. It's a watchdog for **silent staleness**, not for failures. It does not duplicate `skill-health`'s job (which catches consecutive failures by reading run history) or `skill-update-check`'s job (which catches upstream SKILL.md drift in imported skills). Its scope is narrow: file-on-disk freshness vs the consumer that's about to read it.

## Config

No new secrets. No new env vars. No new state file beyond `memory/topics/skill-freshness-state.json` for prior-run dedup.

Reads:
- `aeon.yml` — enabled skill list, `chains:` blocks (steps, consume, parallel), per-skill `schedule` (used to derive expected freshness windows).
- Every `skills/*/SKILL.md` whose corresponding `aeon.yml` entry has `enabled: true` — for implicit file-reference extraction.
- `articles/`, `.outputs/`, `memory/topics/`, `memory/state/` — directory listings + mtimes only (no content reads beyond what's needed for fingerprinting).

Writes:
- `articles/skill-freshness-${today}.md` — the report.
- `memory/topics/skill-freshness-state.json` — fingerprint + last-verdict for run-to-run dedup.
- `memory/logs/${today}.md` — log block.

No outbound HTTP. No `gh api` calls. No env-var-in-headers. Pure local file I/O.

## Freshness thresholds

The threshold for a dependency depends on its path class:

| Path class | Threshold | Rationale |
|------------|-----------|-----------|
| `articles/{skill}-*.md` | 28 hours | Daily skills run once per day; 28h gives a 4h grace window for clock skew + run delays. |
| `articles/{skill}-*.md` produced by a weekly skill (cron starts with `0 _ * * 0`-`6` only) | 8 days (192h) | Weekly producers have a 24h grace window. |
| `.outputs/{skill}.md` (chain runner outputs) | 4 hours | Chain steps run minutes apart; a 4h-old `.outputs/` file is a stale chain run. |
| `memory/topics/{name}.md` | 7 days (168h) | Topic files are reference material, edited on memory-flush cycles (~weekly). |
| `memory/state/{name}.json` | 30 days (720h) | State files are append/update-on-write; 30 days is a "skill hasn't run at all" signal. |

Per-class thresholds are computed at runtime — not hardcoded per dependency. The skill discovers the producer's schedule from `aeon.yml` and picks the daily-vs-weekly bucket automatically.

**Severity bands per dependency:**
- `OK` — file mtime within threshold.
- `WARN` — file mtime past threshold but ≤ 2× threshold.
- `STALE` — file mtime past 2× threshold (real degradation, not a one-day blip).
- `MISSING` — referenced file does not exist on disk at all.

`MISSING` only fires for **explicit** dependencies (`chains: consume:` entries + canonical `articles/{producer}-${today}.md` patterns). Implicit grep-discovered references that simply never existed are not flagged — many SKILL.md files mention paths in pseudocode or comments that aren't real reads.

## Steps

### 1. Parse var and resolve scope

- If `${var}` matches `^dry-run` → `MODE=dry-run`. Strip the prefix; remainder treated as scope override.
- Otherwise `MODE=execute`.
- If the remaining var is a non-empty string that matches an `aeon.yml` skill key → `SCOPE=single`, `SCOPED_SKILL=$var`. If it doesn't match any key, log `SKILL_FRESHNESS_NO_MATCH: ${var} not in aeon.yml` and exit (no notify, no article).
- Otherwise `SCOPE=fleet` and audit every enabled skill.

### 2. Load enabled-skill list and build the producer index

Parse `aeon.yml`. Build two maps:

- `ENABLED` — set of skill names where `enabled: true`. (Skills with `enabled: false` are not audited as consumers — their dependencies don't matter until they're turned on. They CAN appear as producers though, and their freshness is still tracked since other consumers may depend on them.)
- `PRODUCER_CADENCE` — map skill_name → `daily` | `weekly` | `on_demand` derived from the cron expression:
  - cron with `* * *` in days/months/weekdays → `daily`
  - cron whose weekday field matches `^[0-6]$` (single weekday) → `weekly`
  - `workflow_dispatch` or empty → `on_demand` (skipped from freshness audit; on-demand outputs have no expected cadence)

### 3. Gather explicit dependencies (`chains: consume:`)

Walk `aeon.yml` `chains:` blocks. For each step with a `consume: [...]` list, the consuming skill depends on `.outputs/{producer}.md` for each named producer. Record these as **explicit** edges with class `outputs` (4h threshold).

Also record any step with `parallel: [...]` followed by a downstream `consume:` reference as the same class.

### 4. Gather implicit dependencies (grep over enabled SKILL.md files)

For each skill in `ENABLED`, read its `SKILL.md` and extract every reference to:

```
articles/[a-zA-Z0-9_-]+(-\$\{today\}|-[0-9]{4}-[0-9]{2}-[0-9]{2})?\.md
\.outputs/[a-zA-Z0-9_-]+\.md
memory/topics/[a-zA-Z0-9_.-]+\.md
memory/state/[a-zA-Z0-9_.-]+\.json
```

Filter out:
- References inside fenced code blocks marked `bash` or `text` that are clearly examples (e.g. `# example: articles/foo-2026-01-01.md`).
- References to the consumer's own output paths (a producer self-reading its prior file is not a freshness gap; that's its own state-keeping). Detected when the producer prefix matches the consuming skill name.
- References inside the comment marker `<!-- skill-freshness:ignore -->` and the next line (escape hatch for SKILL.md authors who cite a path in prose without actually reading it).

Each surviving reference becomes an **implicit** edge with the appropriate path class.

### 5. Resolve canonical "today's article" patterns

For every `articles/{producer}-${today}.md` reference (or the date-suffixed equivalent), resolve to the actual most-recent file on disk: `ls -1t articles/{producer}-*.md 2>/dev/null | head -1`. Record the resolved path AND the producer's expected cadence (from step 2's `PRODUCER_CADENCE` map).

If no file matches the pattern at all, record as `MISSING` (only counted if the producer has cadence `daily` or `weekly` — `on_demand` producers may legitimately have never run).

### 6. Score each dependency

For every (consumer, dependency) pair:

```
mtime_age_hours = (now - file.mtime) in hours
threshold_hours = lookup_threshold(path_class, producer_cadence)

severity = OK     if mtime_age_hours <= threshold_hours
         | WARN   if mtime_age_hours <= 2 * threshold_hours
         | STALE  if mtime_age_hours >  2 * threshold_hours
         | MISSING if file does not exist (and edge is explicit OR pattern-canonical)
```

Aggregate per-consumer:

```
consumer_verdict = WORST severity across all its dependencies
```

`MISSING > STALE > WARN > OK` for the rollup.

### 7. Roll up to the fleet verdict

```
fleet_verdict = WORST consumer_verdict across all enabled consumers
```

Translation to exit status:

| fleet_verdict | exit_status |
|--------------|-------------|
| OK across the board | `FRESHNESS_OK` |
| At least one WARN, no STALE / MISSING | `FRESHNESS_WARN` |
| At least one STALE OR MISSING | `FRESHNESS_STALE` |

### 8. Dedup vs prior run

Compute a stable verdict fingerprint: `sha1sum` of the sorted list of `consumer:dep:severity` triples (excluding `OK` rows — only flagged rows count toward the fingerprint).

Compare against `memory/topics/skill-freshness-state.json` `last_flagged_fingerprint`. If identical AND today's `fleet_verdict` is the same as `last_verdict`:
- Article still writes (idempotent same-day overwrite).
- `memory/topics/skill-freshness-state.json` updates the `last_run_at` timestamp.
- Notify is **suppressed** with status `FRESHNESS_NO_CHANGE` — no point pinging the operator about the same stale file two days running. The state expires after 7 days; if nothing has changed for a week, the next run will re-emit the notification as a periodic reminder.

If different (a new flag appeared, an old one cleared, or the verdict band changed): notify normally.

### 9. Write the article

Path: `articles/skill-freshness-${today}.md`. Overwrite if exists.

```markdown
# Skill Freshness — ${today}

**Verdict:** ${verdict_emoji} ${fleet_verdict} — ${one_line_summary}

*Audited ${enabled_count} enabled skills · ${dependency_count} dependencies checked · ${flagged_count} flagged*

## Flagged dependencies

| Consumer | Dependency | Class | Age | Severity |
|----------|-----------|-------|-----|----------|
| ${consumer} | `${path}` | ${class} | ${age_human} | ${severity_emoji} ${severity} |
| ... | | | | |

(Sorted by severity desc, then consumer name. Omit OK rows entirely — they are noise.)

## What this means per consumer

For every consumer whose verdict ≠ OK, one paragraph:

> **${consumer}** — depends on ${N} files; ${flagged_count} flagged. Worst: `${worst_path}` last updated ${age} ago (threshold ${threshold}h, class ${class}). The producer `${producer}` last successful run: ${producer_last_run_or_unknown}. Suggested action: ${one_line_suggestion}.

`one_line_suggestion` is a small lookup:
- `MISSING` + producer is `daily`/`weekly` → "Check `${producer}` run history with `./scripts/skill-runs --skill ${producer} --hours 168`."
- `STALE` → "Verify `${producer}` is still on schedule; if so, the producer ran but did not write a new article."
- `WARN` → "Monitor — one missed run, expected to clear on next producer cadence."

## Healthy consumers

A one-line per consumer with verdict OK: `- ${consumer} — ${dep_count} deps, all fresh.`

Cap at 8 entries; collapse the rest into `+ N more all-fresh consumers.` to keep the article scannable.

## Source status

- `aeon.yml`: ${parsed_skill_count} entries, ${enabled_count} enabled
- Implicit references discovered: ${implicit_count}
- Explicit `chains: consume:` edges: ${explicit_count}
- Files not yet on disk (skipped — implicit references that never existed): ${ignored_count}

---
*Companion to `skill-health` (per-skill failure detection) and `heartbeat` (per-run pulse). This skill catches the silent-staleness gap those two cannot: a consumer reading a stale file with no API errors and a 100% pass rate. Methodology: every age and threshold is computed from on-disk mtimes — this skill measures nothing it does not also report.*
```

### 10. Persist state

Write `memory/topics/skill-freshness-state.json`:

```json
{
  "last_run_at": "${ISO timestamp}",
  "last_verdict": "${fleet_verdict}",
  "last_flagged_fingerprint": "${sha1}",
  "consumer_count": ${enabled_count},
  "dependency_count": ${dependency_count},
  "flagged_count": ${flagged_count},
  "first_seen_at": {
    "${consumer}:${path}": "${ISO timestamp}"
  }
}
```

`first_seen_at` records when each currently-flagged dep first crossed its threshold. Reused on the next run to detect "this has been stale for >7 days" — escalate one severity band in that case (WARN → STALE if persistent).

Cap `first_seen_at` to 200 entries; drop oldest by timestamp.

### 11. Send notification

If `MODE == dry-run`: skip notify, log `FRESHNESS_DRY_RUN`, exit.

If `fleet_verdict == FRESHNESS_OK`: log `FRESHNESS_OK`, **do not notify** (no news is good news; a green daily ping is noise).

If `fleet_verdict ∈ {WARN, STALE}` AND fingerprint changed since last run: notify.

If fingerprint identical to last run AND last run was within 7 days: log `FRESHNESS_NO_CHANGE`, **do not notify**.

Notification body:

```
*Skill Freshness — ${today}*
${verdict_emoji} ${fleet_verdict} — ${flagged_count} of ${dependency_count} deps flagged across ${affected_consumer_count} of ${enabled_count} enabled consumers

Worst:
- ${consumer_1} ← ${path_1} (${age_1} old, class ${class_1}, sev ${sev_1})
- ${consumer_2} ← ${path_2} (${age_2} old, class ${class_2}, sev ${sev_2})
- ${consumer_3} ← ${path_3} (${age_3} old, class ${class_3}, sev ${sev_3})

Action: ${one_line_action_for_worst_consumer}
Full: articles/skill-freshness-${today}.md
```

Cap message at ~3500 chars. Drop "Worst" entries 4+ if exceeded.

### 12. Log to `memory/logs/${today}.md`

```
## Skill Freshness
- **Skill**: skill-freshness
- **Verdict**: ${verdict_emoji} ${fleet_verdict}
- **Audited**: ${enabled_count} enabled consumers · ${dependency_count} deps · ${flagged_count} flagged
- **Worst**: ${consumer_with_worst_severity} — ${worst_path} (${worst_age} old, ${worst_severity})
- **Article**: articles/skill-freshness-${today}.md
- **Notification sent**: ${yes|no — FRESHNESS_OK|no — FRESHNESS_NO_CHANGE|no — dry-run}
- **Status**: ${FRESHNESS_OK|FRESHNESS_WARN|FRESHNESS_STALE|FRESHNESS_NO_CHANGE|FRESHNESS_DRY_RUN}
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `FRESHNESS_OK` | every enabled consumer's deps are fresh | No (silence is the signal) |
| `FRESHNESS_WARN` | at least one dep past 1× threshold but no STALE/MISSING | Yes (only on fingerprint change) |
| `FRESHNESS_STALE` | at least one dep past 2× threshold OR a canonical-pattern dep MISSING | Yes (only on fingerprint change) |
| `FRESHNESS_NO_CHANGE` | flagged set identical to prior run, last run < 7 days ago | No (re-emits after 7d) |
| `FRESHNESS_DRY_RUN` | `var=dry-run` mode | No (article still writes) |
| `SKILL_FRESHNESS_NO_MATCH` | `${var}` named a skill not in aeon.yml | No |

## Sandbox note

Pure local file I/O — no curl, no `gh api`, no env-var-in-headers, no prefetch script. Every read is a directory listing or an mtime call; every write is to `articles/`, `memory/topics/`, or `memory/logs/`. Works in the GitHub Actions sandbox without any of the network workarounds other skills need. The only outbound call is `./notify` itself, which is already sandbox-safe (postprocess-notify pattern).

## Constraints

- **Read-only across producers.** This skill never re-runs a producer to refresh its output, never deletes stale files, never edits another skill's SKILL.md. It reports; the operator (or `skill-repair`) acts.
- **Enabled consumers only.** A skill with `enabled: false` does not need its dependencies audited — it isn't going to consume them. This keeps the report scoped to what's actually live in the schedule.
- **Implicit dependencies are best-effort.** Grep-based discovery is heuristic. False positives are tolerated (consumer paragraph clarifies why); false negatives are accepted (an explicit `chains: consume:` edge is the source of truth for chain runs). The goal is to surface the worst-case staleness, not to prove formally complete coverage.
- **Per-class thresholds, not per-skill.** The threshold for `articles/token-report-*.md` is the same as for `articles/repo-pulse-*.md`: the path class drives the window, derived from the producer's cadence in `aeon.yml`. This keeps the table maintainable as the fleet grows.
- **Fingerprint-based dedup.** A stale file flagged today and still stale tomorrow does not re-notify. The 7-day re-emit window handles the case where a chronic stale file has been forgotten about.
- **No issue filing.** Anomalies surface in the verdict and the article. Persistence and resolution belong to `skill-health`. This skill is read-only across `memory/issues/`.
- **Idempotent.** Same-day reruns overwrite the article and state file. The log entry appends one block per run.

---
name: skill-analytics
description: Weekly fleet-level skill-run analytics — ranks skills by 7d run count, surfaces success rates, exit-taxonomy distribution, and anomaly flags (significance-gated)
var: ""
tags: [meta]
---

> **${var}** — Window in hours (default: 168 = 7 days). Pass an integer like "72" for a shorter window.

Today is ${today}. Generate a fleet-level performance view of every Aeon skill that has run in the window. **The point of this skill is to answer four questions in one report:** which skills run most, which fail most, which are silently skipping (new exit taxonomy from the autoresearch-evolution rewrites), and which scheduled skills haven't fired at all. heartbeat gives binary ok/not-ok per run; skill-health audits one skill at a time. This is the only place the operator can see the entire fleet ranked side-by-side.

## Why this exists

`heartbeat` runs three times daily and emits a per-skill ✓/✗. `skill-health` files issues for skills that breach degradation thresholds. Neither produces a ranked, fleet-wide view. The 80 autoresearch-evolution rewrites (aeon PRs #46–#136) introduced new exit taxonomies — `SKIP_UNCHANGED`, `NEW_INFO`, `SKIP_QUIET` — that classify quiet-but-correct runs separately from failures. Existing health checks treat any non-`*_OK` exit as worth attention; the analytics widget makes the actual distribution visible so a skill running mostly `SKIP_UNCHANGED` reads as healthy-quiet, not silently broken.

## Steps

### 1. Determine the window

- Default: 168 hours (7 days). If `${var}` parses as a positive integer, use that many hours instead. Cap at 720 (30 days) — anything longer slows the `gh api` paginate.
- Compute `WINDOW_HOURS=N` and `WINDOW_LABEL` (e.g. `"last 7d"` or `"last 72h"`).

### 2. Pull the run snapshot

```bash
./scripts/skill-runs --json --hours $WINDOW_HOURS > .outputs/skill-analytics-runs.json 2>/dev/null
```

If the script fails (auth, rate limit, sandbox block) or the JSON is empty:
- Log `SKILL_ANALYTICS_NO_DATA — skill-runs returned empty (gh api / sandbox block?)` to `memory/logs/${today}.md` and stop with **no notification**. A silent fleet view is correct on data-fetch failure — fall back rather than guess.

The script's JSON shape (see `scripts/skill-runs`):
```json
{
  "period": {"since": "...", "until": "...", "hours": 168},
  "summary": {"total": N, "succeeded": N, "failed": N, "cancelled": N, "in_progress": N},
  "skills": [{"skill": "name", "total": N, "success": N, "failure": N, "cancelled": N, "in_progress": N, "last_run": "...", "last_conclusion": "..."}],
  "anomalies": {"duplicates": [...], "failing": [...]}
}
```

### 3. Cross-reference with cron schedule

Read `aeon.yml` and build `SCHEDULED_SKILLS`: dict `{skill_name -> {enabled: bool, schedule: str}}` for every entry under `skills:`. Treat `schedule: "workflow_dispatch"` and `schedule: "reactive"` as exempt from the "no runs in window" anomaly — those are dispatched on demand, not by cron.

For every skill in `SCHEDULED_SKILLS` where `enabled: true` AND schedule is a valid cron expression AND the skill is **not** present in the snapshot's `skills` array, mark `silent_scheduled: true` (zero runs in window despite an active schedule).

### 4. Cross-reference with cron-state.json

Load `memory/cron-state.json` if present (missing → empty dict, not failure). For each skill in the snapshot, attach:
- `consecutive_failures` (0 if missing)
- `last_status` (`"unknown"` if missing)

Used to compute the consecutive-failure anomaly without a second `gh api` round-trip.

### 5. Mine exit taxonomy from logs

For each daily log file `memory/logs/YYYY-MM-DD.md` whose date falls in the window, scan for these markers (one match per skill section):
- `_OK` → success (excluding `_OK_SILENT`)
- `_OK_SILENT` / `_QUIET` / `SKIP_QUIET` → quiet-success
- `SKIP_UNCHANGED` → skip-unchanged (autoresearch-evolution exit)
- `NEW_INFO` → new-info (autoresearch-evolution exit)
- `_SKIP*` (other) → skip-other
- `_ERROR` / `_FAILED` → error
- `_PARTIAL` → partial
- (no match) → uncategorized

Build `EXIT_DIST[skill]` = `{ok: N, quiet: N, skip_unchanged: N, new_info: N, skip_other: N, error: N, partial: N, uncategorized: N}`. The dominant bucket per skill is the one with the largest count; ties broken in the order listed above. If a skill has no log markers in the window, dominant bucket is `"uncategorized"`.

This step is best-effort — the markers are regex-grepped from human-written logs, not parsed from a contract. A miss-rate of 10–20% is expected and acceptable; the GitHub Actions success/failure counts from step 2 remain the ground truth for pass/fail. The taxonomy distribution is a secondary signal.

### 6. Anomaly classification

For each skill in the snapshot OR `silent_scheduled`, assign **at most one** anomaly flag, first match wins:

| Flag | Trigger |
|---|---|
| `🔴 SILENT` | `silent_scheduled: true` (enabled cron skill, zero runs in window) |
| `🔴 ALL_FAIL` | `total >= 2` AND `failure == total` |
| `🟠 CONSECUTIVE_FAILURES` | `consecutive_failures >= 3` (from cron-state) |
| `🟠 LOW_SUCCESS` | `total >= 3` AND `success / total < 0.80` |
| `🟡 ALL_SKIP` | `total >= 3` AND `EXIT_DIST.ok + EXIT_DIST.quiet + EXIT_DIST.new_info == 0` AND `EXIT_DIST.skip_unchanged + EXIT_DIST.skip_other > 0` (every run skipped — possibly correct, possibly stuck) |
| `🟡 DUPLICATE_RUNS` | `total > 2 × expected_runs(schedule, window)` (more runs than the cron should produce — manual reruns or scheduler glitch) |

`expected_runs(schedule, window)` is a coarse estimate — for a cron `"0 H * * *"` over 7 days, expect 7; for `"0 H,H,H * * *"`, expect 21; for weekly `"0 H * * D"`, expect 1. If the schedule string is unparseable, skip the duplicate check for that skill (do not flag false positives).

A skill with no flag is considered HEALTHY for analytics purposes.

### 7. Compute summary

```
total_runs:          sum of every skill's total
distinct_skills:     count of skills with total >= 1
overall_success_pct: snapshot.summary.succeeded / (succeeded + failed) × 100  (cancelled + in_progress excluded)
anomaly_count:       count of skills with any flag in step 6
silent_scheduled_count: count of SILENT flags
exit_dominant:       top 3 dominant exit buckets across the fleet, e.g. "ok (42), skip_unchanged (18), error (3)"
```

### 8. Build the verdict line

Pick the strongest single claim, in priority:

1. Any `🔴 SILENT` exists → `"${N} scheduled skill(s) didn't run this window — ${first_skill}"`
2. Any `🔴 ALL_FAIL` exists → `"${first_skill} failed every run (${N}/${N}) — investigate"`
3. Any `🟠 CONSECUTIVE_FAILURES` exists → `"${first_skill} on ${N}-run failure streak"`
4. Any `🟠 LOW_SUCCESS` exists → `"${first_skill} ${pct}% success over ${total} runs — degraded"`
5. Any `🟡 ALL_SKIP` exists → `"${N} skill(s) only emitting skip-class exits this window — verify intent"`
6. Otherwise → `"All ${distinct_skills} active skills healthy — ${overall_success_pct}% success across ${total_runs} runs"`

### 9. Significance gate

**Notify only if `anomaly_count >= 1`.** Silent run = correct (no anomalies in fleet) = no notification. Following the autoresearch-evolution / fork-skill-digest pattern: noisy skills break trust faster than missing pings.

If gate says skip, still write the article and JSON spec, and log `SKILL_ANALYTICS_QUIET` (no anomalies). The dashboard widget refreshes regardless; only the push notification is gated.

### 10. Write the article

Path: `articles/skill-analytics-${today}.md`. Overwrite if it exists (idempotent same-day reruns).

```markdown
# Skill Analytics — ${today}

**Verdict:** ${verdict_line}

*Window: ${WINDOW_LABEL} · ${total_runs} runs across ${distinct_skills} skills · ${overall_success_pct}% success · ${anomaly_count} anomalies*

## Anomalies

| Flag | Skill | Detail | Action |
|------|-------|--------|--------|
| 🔴 SILENT | name | scheduled `<cron>` but zero runs in window | check workflow / scheduler |
| 🔴 ALL_FAIL | name | N/N failed | investigate root cause |
| 🟠 CONSECUTIVE_FAILURES | name | N-run streak (last_error: "...") | see skill-health for filed issue |
| 🟠 LOW_SUCCESS | name | N% over M runs | review failures |
| 🟡 ALL_SKIP | name | M runs, all skip-class | confirm SKIP_UNCHANGED is the intent |
| 🟡 DUPLICATE_RUNS | name | M runs, expected ~K | check for manual reruns |

(If `anomaly_count == 0`: write `No anomalies — fleet healthy across ${distinct_skills} skills.`)

## Top runners (by run count)

| # | Skill | Runs | Success | Last status | Dominant exit |
|---|-------|------|---------|-------------|---------------|
| 1 | name  | N    | XX%     | success     | ok            |
| 2 | name  | N    | XX%     | success     | skip_unchanged |
...

(Top 15 by total runs desc. If fewer than 15 active skills, list all.)

## Failure rate (sorted, ≥1 failure)

| Skill | Runs | Failures | Success rate | Last conclusion |
|-------|------|----------|--------------|-----------------|

(All skills with `failure >= 1`, sorted by `failure / total` desc. If none: "Zero failures across ${distinct_skills} skills this window.")

## Exit taxonomy distribution

| Bucket | Count | % | Top skills |
|--------|-------|---|------------|
| ok            | N | XX% | a, b, c |
| skip_unchanged | N | XX% | d, e |
| new_info      | N | XX% | f |
| quiet         | N | XX% | g |
| error         | N | XX% | h |
| partial       | N | XX% |   |
| uncategorized | N | XX% |   |

(Sourced from `memory/logs/*.md` — best-effort regex grep, see Step 5. Cell-aligns to summary cells above where available.)

## Silent scheduled skills (enabled, zero runs)

${list of {skill, schedule} pairs OR "none — every enabled cron skill ran at least once."}

## Source status

- skill-runs JSON: ${ok|empty|fetch_error}
- Window: ${WINDOW_HOURS}h (${period.since} → ${period.until})
- aeon.yml: ${ok|missing}
- cron-state.json: ${ok|missing — first run for this fork?}
- Daily logs scanned: ${N_LOG_FILES}/${expected_log_files} for exit taxonomy

---
*Companion to `skill-health` (per-skill issue filing) and `heartbeat` (per-run pulse). Fleet-wide observability is the gap this skill closes. Methodology: GitHub Actions run history is ground truth for pass/fail; daily-log markers are best-effort secondary signal for exit taxonomy.*
```

### 11. Write the dashboard JSON spec

Path: `dashboard/outputs/skill-analytics.json`. Use the catalog components (Card / Stack / Heading / Text / Badge / Table).

```json
{
  "version": "1",
  "generated_at": "${ISO timestamp}",
  "skill": "skill-analytics",
  "title": "Skill Analytics — ${today}",
  "spec": {
    "type": "Stack",
    "props": {"direction": "vertical", "gap": "md"},
    "children": [
      {"type": "Heading", "props": {"level": 2, "children": "Skill Analytics — ${today}"}},
      {"type": "Text", "props": {"variant": "muted", "children": "${verdict_line}"}},
      {"type": "Grid", "props": {"columns": 4, "gap": "sm"}, "children": [
        {"type": "Card", "props": {"children": [
          {"type": "Text", "props": {"variant": "muted", "children": "Total runs"}},
          {"type": "Heading", "props": {"level": 3, "children": "${total_runs}"}}
        ]}},
        {"type": "Card", "props": {"children": [
          {"type": "Text", "props": {"variant": "muted", "children": "Active skills"}},
          {"type": "Heading", "props": {"level": 3, "children": "${distinct_skills}"}}
        ]}},
        {"type": "Card", "props": {"children": [
          {"type": "Text", "props": {"variant": "muted", "children": "Success rate"}},
          {"type": "Heading", "props": {"level": 3, "children": "${overall_success_pct}%"}}
        ]}},
        {"type": "Card", "props": {"children": [
          {"type": "Text", "props": {"variant": "muted", "children": "Anomalies"}},
          {"type": "Heading", "props": {"level": 3, "children": "${anomaly_count}"}}
        ]}}
      ]},
      {"type": "Heading", "props": {"level": 3, "children": "Top runners"}},
      {"type": "Table", "props": {
        "columns": [
          {"key": "rank", "header": "#"},
          {"key": "skill", "header": "Skill"},
          {"key": "runs", "header": "Runs"},
          {"key": "success", "header": "Success"},
          {"key": "exit", "header": "Dominant exit"}
        ],
        "rows": [
          {"rank": "1", "skill": "name", "runs": "N", "success": "XX%", "exit": "ok"}
        ]
      }}
    ]
  }
}
```

If `anomaly_count >= 1`, prepend an `Alert` block before the verdict:

```json
{"type": "Alert", "props": {"variant": "destructive", "children": "${anomaly_count} anomaly flag(s) raised — see Anomalies section"}}
```

If the file write fails (filesystem read-only, missing directory), log a warning but do not abort — the article is the canonical artifact, the JSON spec is a dashboard convenience.

### 12. Send notification (only if gate from step 9 passed)

Via `./notify`:

```
*Skill Analytics — ${today}*
${verdict_line}

Window: ${WINDOW_LABEL} · ${total_runs} runs · ${distinct_skills} skills · ${overall_success_pct}% success
Anomalies: ${anomaly_count}

${If 🔴 flags (cap top 3):}
🔴 Critical:
- ${skill} — ${flag}: ${detail}

${If 🟠 flags (cap top 3):}
🟠 Degraded:
- ${skill} — ${flag}: ${detail}

${If 🟡 flags (top 3, only if no 🔴/🟠 already filled the slots):}
🟡 Watch:
- ${skill} — ${flag}: ${detail}

Top by runs: ${top_3_skills_by_run_count_with_counts}

Full: articles/skill-analytics-${today}.md
```

Cap the message body at ~3500 chars (Telegram safe limit). Drop the "Top by runs" line first if exceeded; flags are higher signal.

### 13. Log to `memory/logs/${today}.md`

```
## Skill Analytics
- **Skill**: skill-analytics
- **Window**: ${WINDOW_LABEL} (${WINDOW_HOURS}h)
- **Total runs**: ${total_runs} across ${distinct_skills} skills
- **Overall success rate**: ${overall_success_pct}%
- **Anomalies**: ${anomaly_count} (🔴 ${red_count}, 🟠 ${orange_count}, 🟡 ${yellow_count})
- **Silent scheduled**: ${silent_scheduled_count} skills (${comma list capped at 5})
- **Top runner**: ${top_skill} (${top_runs} runs)
- **Exit dominant**: ${exit_dominant_summary}
- **Verdict**: ${verdict_line}
- **Article**: articles/skill-analytics-${today}.md
- **Dashboard**: dashboard/outputs/skill-analytics.json
- **Notification sent**: ${yes|no — quiet (no anomalies)}
- **Status**: SKILL_ANALYTICS_OK | SKILL_ANALYTICS_QUIET | SKILL_ANALYTICS_NO_DATA
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `SKILL_ANALYTICS_OK` | snapshot fetched, ≥1 anomaly flagged | Yes |
| `SKILL_ANALYTICS_QUIET` | snapshot fetched, zero anomalies | No (article + JSON written, log only) |
| `SKILL_ANALYTICS_NO_DATA` | skill-runs returned empty / fetch failed | No (log only, no article overwrite) |

## Sandbox note

`./scripts/skill-runs` uses `gh api` internally — auth comes from `GITHUB_TOKEN`, no curl/env-var-in-header issue. No outbound HTTP from this skill itself. If `gh api` is rate-limited or the runner's network is degraded, the script exits non-zero; this skill catches that and falls through to `SKILL_ANALYTICS_NO_DATA` rather than emitting a partial fleet view that would mislead.

## Constraints

- **Significance-gated.** A clean fleet must produce zero notifications. Article and JSON spec still write so the dashboard reflects the latest state, but `./notify` is silent.
- **Never invent runs.** If `skill-runs` returns empty, exit `SKILL_ANALYTICS_NO_DATA` — do not synthesise data from cron-state alone (cron-state's view is per-skill, not chronologically ordered, and would produce a misleading "top runners" table).
- **Best-effort exit-taxonomy parsing.** Log markers are human-written; expect a 10–20% miss rate. Do not block the article on parse failures — drop the affected skill into `uncategorized` and continue.
- **Idempotent.** Same-day reruns overwrite the article and JSON spec. The log entry is appended (one block per run, lets the operator see analytic drift across reruns).
- **No issue filing.** This skill does not write to `memory/issues/` — that contract belongs to `skill-health`. Anomalies surface here as flags; persistence and resolution live in skill-health's domain.
- **Respect workflow_dispatch / reactive.** Skills with non-cron schedules cannot be SILENT — they fire only on demand. Excluding them from the silent-scheduled check prevents permanent false positives.

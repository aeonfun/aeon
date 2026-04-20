---
name: Skill Evals
description: Validate skill outputs against assertions, diff vs prior eval to flag regressions, file issues for new failures, and queue concrete fixes
var: ""
tags: [meta]
---

<!-- autoresearch: variation B — verdict + action queue + diff vs prior + issue filing + notify gating -->

> **${var}** — Skill name to evaluate. If empty, evaluates all skills in `evals.json`.

Today is ${today}. Read `memory/MEMORY.md` for context.

This skill exists to catch quality regressions *between* runs — not just to re-state a snapshot of the latest output. The lede is **what changed since last eval** and **what to do about it**, not a flat pass/fail table.

## Steps

### 1. Load inputs

- `skills/skill-evals/evals.json` — assertion manifest (read with `jq`; if parse fails, retry once after 5s, then exit `SKILL_EVALS_ERROR`).
- `aeon.yml` — registered skills, enabled flags, cron schedules.
- `memory/cron-state.json` — `total_runs`, `success_rate`, `last_quality_score`, `last_failed`, `last_success` per skill.
- `memory/issues/INDEX.md` — currently open issues (used to dedupe issue filing in step 5b).
- Most recent prior eval at `articles/skill-evals-*.md` (sorted descending, excluding today's). If none exist, mark prior_run as `BOOTSTRAP` — every result is `NEW_*`.

If `evals.json` is missing or has zero `skills` keys, run `./scripts/eval-audit --stubs` to scaffold a starter spec and exit `SKILL_EVALS_BOOTSTRAP` with a notify telling the operator to commit the stub.

### 2. Run coverage audit (delegated)

Call `./scripts/eval-audit --json` and parse:
- `summary.coverage_pct`, `summary.covered`, `summary.uncovered_enabled`, `summary.uncovered_disabled`
- `uncovered_enabled[].skill` and `.inferred_pattern` — these are the spec-gap candidates surfaced in the Action Queue.

Do not re-implement coverage detection in prose. If the script fails, fall back to the in-memory check (compare `evals.json` keys to `aeon.yml` enabled skills) and mark `eval-audit=fail` in the source-status footer.

### 3. Determine eval scope

- If `${var}` is set → evaluate only that one skill (skip if not in `evals.json` and notify "skill-evals: ${var} has no spec — add an entry to evals.json").
- Otherwise evaluate every skill in `evals.json`.

### 4. For each skill in scope, run checks

  a. **Find latest output**: glob `output_pattern`, sort descending by filename. If empty → status `NO_OUTPUT`, root_cause `no_file_match`, skip remaining checks.

  b. **Empty/stale**: if file size is 0 bytes → `FAIL`, root_cause `empty_file`. If file mtime is older than `2× expected_cadence` (derived from the skill's cron in `aeon.yml`; fall back to 14 days if cron is `workflow_dispatch` or unparseable) → `STALE`, root_cause `stale_file`. Stale outputs still run their assertions but are reported as STALE so dashboard noise is correct.

  c. **Word count**: count words; fail if `< min_words` → root_cause `word_count` (record actual vs threshold).

  d. **Required patterns**: for each pattern (pipe-separated alternatives), grep with `-E`. Missing → root_cause `missing_pattern:<pattern>`.

  e. **Forbidden patterns**: any match → root_cause `forbidden_pattern:<pattern>`.

  f. **Numeric checks**: for each entry, extract first regex match. Outside `[min, max]` → root_cause `numeric_oob:<label>`. If no match found and entry has `skip_if_not_found: true`, skip; otherwise `WARN` with root_cause `numeric_missing:<label>`.

  g. **Quality cross-check**: read `memory/skill-health/{skill}.json`. If `avg_score < 2.5` → status `QUALITY_DEGRADED`, root_cause `quality_score:<avg>`. If `2.5 ≤ avg_score < 3.5`, record as note (no status change). If file missing, record `quality=unknown`.

  Final status precedence: `NO_OUTPUT` > `FAIL` > `STALE` > `QUALITY_DEGRADED` > `WARN` > `PASS`.

### 5. Diff vs prior eval (the lede)

Parse the prior eval article's results table. For each skill produce one of:

- `NEW_FAIL` — was PASS/STALE/WARN, now FAIL/QUALITY_DEGRADED/NO_OUTPUT
- `FIXED` — was failing, now PASS
- `STILL_FAIL` — was failing, still failing (carry the issue ID forward)
- `NEW_PASS` — wasn't in prior (newly added to evals.json)
- `NEW_NO_COVERAGE` — covered prior, no eval entry now (rare; usually means evals.json edit)
- `STABLE` — same status both runs

  a. **Issue filing.** For every `NEW_FAIL` and `NEW_QUALITY_DEGRADED`:
  - Check `memory/issues/INDEX.md` — if an open issue already names this skill in the title, skip (avoid duplicates).
  - Else write `memory/issues/ISS-{NNN}.md` with frontmatter:
    ```yaml
    ---
    id: ISS-{NNN}
    title: {skill}: {root_cause_short}
    status: open
    severity: {high if NEW_FAIL, medium if QUALITY_DEGRADED}
    category: {map root_cause: missing_pattern→prompt-bug, forbidden_pattern→prompt-bug, numeric_oob→quality-regression, word_count→quality-regression, stale_file→missing-secret-or-cron, empty_file→quality-regression, quality_score→quality-regression, no_file_match→missing-secret-or-cron}
    detected_by: skill-evals
    detected_at: {ISO timestamp}
    affected_skills: [{skill}]
    root_cause: {full root_cause string}
    ---
    
    {one-paragraph context with file path, expected vs actual, link to article}
    ```
  - `{NNN}` = next free 3-digit ID (scan `memory/issues/ISS-*.md`, take max + 1, zero-pad).
  - Append a row to `memory/issues/INDEX.md` Open table.

  b. **Issue closing.** For every `FIXED`: scan `memory/issues/ISS-*.md` for an open issue whose `affected_skills` contains this skill and `detected_by: skill-evals`; flip `status: resolved`, set `resolved_at`, move row from Open → Resolved table in INDEX.md. (Don't touch issues filed by other detectors.)

### 6. Compute verdict

One-line verdict, picked by precedence:
1. `SKILL_EVALS_REGRESSED` — any `NEW_FAIL` exists
2. `SKILL_EVALS_QUALITY_DROP` — any `NEW_QUALITY_DEGRADED` (no NEW_FAIL)
3. `SKILL_EVALS_RECOVERED` — `FIXED ≥ 1` and zero new failures
4. `SKILL_EVALS_COVERAGE_CLIFF` — coverage_pct dropped ≥ 10 points vs last run, or absolute coverage_pct < 25 and last run was ≥ 25
5. `SKILL_EVALS_OK` — all stable, all green

### 7. Build the Action Queue

A short, ordered, concrete checklist at the top of the article. Cap at 8 items. Each item is one line, naming a specific skill and a specific next step:

- **Patch** (regex/threshold tweaks): `Patch evals.json:{skill} — {root_cause}`
- **Investigate** (FAIL with no obvious fix): `Investigate {skill} — {root_cause} (ISS-{NNN})`
- **Re-run** (NO_OUTPUT, no recent dispatch): `Dispatch {skill} — no output in {N} days`
- **Add spec** (uncovered enabled): `Add evals.json entry for {skill} — pattern: {inferred_pattern}` (one line per uncovered enabled skill, max 5; if more, summarize "+N more — see Coverage Gaps")

If the queue is empty, write `Action Queue: none — all green`.

### 8. Write the article

Path: `articles/skill-evals-${today}.md`. Skeleton:

```markdown
# Skill Evals — ${today}

**Verdict:** {VERDICT}
**Coverage:** {covered}/{enabled_total} ({coverage_pct}%) {↑↓ vs prior or "(first run)"}
**Diff:** {N_NEW_FAIL} new fail · {N_FIXED} fixed · {N_STILL_FAIL} still failing · {N_STABLE} stable

## Action Queue
1. ...
2. ...

## Regressions (NEW_FAIL + NEW_QUALITY_DEGRADED)
| Skill | Status | Root cause | Issue |
|-------|--------|------------|-------|
| ... | NEW_FAIL | missing_pattern:stars | ISS-014 |

## Recovered (FIXED)
| Skill | Was | Now |
|-------|-----|-----|

## Still Failing
| Skill | Status | Root cause | Issue | Failing since |
|-------|--------|------------|-------|---------------|

## Full Results
| Skill | Status | Diff | Root cause | Quality | Words | Last output |
|-------|--------|------|------------|---------|-------|-------------|

## Coverage Gaps (enabled in aeon.yml, missing from evals.json)
- {skill} — inferred pattern: `{inferred_pattern}`

## Sources
- evals.json={ok|fail} · cron-state={ok|fail} · skill-health={ok|empty|fail} · eval-audit={ok|fail} · prior-article={ok|none}
```

Omit empty sections (no Recovered section if zero FIXED, etc.). Keep the Coverage Gaps section bounded to 10 lines max — overflow into a `+N more` summary.

### 9. Notify (gated)

Only call `./notify` when one of the following holds:
- Verdict is `SKILL_EVALS_REGRESSED`, `SKILL_EVALS_QUALITY_DROP`, or `SKILL_EVALS_COVERAGE_CLIFF`
- Verdict is `SKILL_EVALS_RECOVERED` (good news worth a ping)

Stay silent on `SKILL_EVALS_OK` (still write the article + log entry; just don't ping). This trains the operator that a notification means action is needed.

Notify body (concise, soul-voice):

```
*Skill Evals — {VERDICT}*
{N_NEW_FAIL} new fail · {N_FIXED} fixed · coverage {coverage_pct}%
Top action: {action_queue[0]}
Article: articles/skill-evals-${today}.md
```

If `N_NEW_FAIL > 0`, append the first 3 regressions as `{skill}: {root_cause}` lines.

### 10. Log

Append to `memory/logs/${today}.md`:

```
### skill-evals
- Verdict: {VERDICT}
- Diff: {N_NEW_FAIL} new fail / {N_FIXED} fixed / {N_STILL_FAIL} still failing / {N_STABLE} stable
- Coverage: {covered}/{enabled_total} ({coverage_pct}%)
- Issues filed: [list ISS-IDs]
- Issues closed: [list ISS-IDs]
- Action queue head: {action_queue[0] or "none"}
```

## Sandbox note

All inputs are local files (`evals.json`, `aeon.yml`, `memory/*`, `articles/*`, `scripts/eval-audit`). No outbound HTTP — no fallback needed. `./scripts/eval-audit` is a local bash script and uses `jq`; if jq is missing (rare on GH Actions ubuntu runners), the script will exit non-zero — mark `eval-audit=fail` in the source-status footer and continue with the in-memory coverage check.

## Constraints

- Never overwrite a prior issue file. Always allocate a fresh `ISS-{NNN}` number.
- Never close an issue this skill didn't file (only `detected_by: skill-evals` issues are closeable here).
- Don't notify when verdict is `SKILL_EVALS_OK` — silence is the correct signal on a green week.
- Preserve the assertion schema (`output_pattern`, `min_words`, `required_patterns`, `forbidden_patterns`, `numeric_checks`) — additions allowed (`skip_if_not_found`, `expected_cadence`), removals are breaking.
- Cap Coverage Gaps and Action Queue sections to keep the article scannable; the article is read by humans, not just machines.

---
name: batch-health
description: Post-batch audit — checks whether all enabled scheduled skills fired in their expected window, alerts on silent misses, files issues on batch-level outages
var: ""
tags: [meta, reliability]
---

Today is ${today}. Cross-reference what was scheduled to run this morning against what actually ran.

## Goal

`frequency-guard` catches skills running *too often*. Nothing catches when they go *silent* (example: a historical batch outage where multiple even-day skills missed the morning window and no alert fired). This skill closes that gap.

Runs at 08:00 UTC daily — after the 06:00–07:30 UTC batch window completes. Skills scheduled at 07:31+ are excluded from the expected list (transient cron drift could leave them in flight when we audit). Output: OK if everything ran, WARN for 1-2 isolated misses, OUTAGE for 3+ missing skills.

## Steps

### 1. Build the expected-run list for today

Read `aeon.yml`. For each skill with `enabled: true`, check its `schedule` field against today's context.

**Parse today's date** `${today}` (YYYY-MM-DD):
- Extract day-of-month (DOM).
- Odd DOM = 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31
- Even DOM = 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30

**Include** a skill in the expected list if ALL of:
1. `enabled: true`
2. Schedule fires in the 06:00–07:30 UTC audit window. Parse the minute and hour fields:
   - hour `6` (any minute 0–59) → in window
   - hour `7` AND minute ≤ 30 → in window
   - hour `7` AND minute > 30 → **exclude** (too close to the 08:00 audit; transient cron drift could leave it in flight when we check)
   - multi-hour like `7,19` → counts as hour 7 for the AM window (apply the same minute rule)
3. Day-of-month matches today:
   - `* * *` or any-day pattern → always included
   - `1/2 * *` in DOM field → odd days only
   - `2/2 * *` in DOM field → even days only
   - `*/N * *` step in DOM field → include if `(DOM - 1) % N == 0`. Vixie-cron expands `*/N` to `1-31/N` → DOMs 1, 1+N, 1+2N, … For `*/3`: DOMs 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31. **Do not** blanket-include — that false-WARNs ~2/3 of days.
   - Day-of-week patterns (`* * N`) → include only if today's weekday matches

**Exclude**: disabled skills, skills firing outside the 06:00–07:30 UTC window (e.g., `schedule: "30 9 * * *"` at 09:30, `schedule: "40 7 * * *"` at 07:40 — both out of scope for this audit).

### 2. Fetch actual runs

Try the skill-runs script:
```bash
./scripts/skill-runs --json --hours 26
```

From the JSON output, extract the `.skills[]` array — each entry has a `skill` name and `last_conclusion`. A skill that appears here (any conclusion) means the GHA cron fired.

**Fallback** if `skill-runs` fails (sandbox network block or `gh api` error):
Parse `memory/logs/${today}.md`:
```bash
cat memory/logs/${today}.md 2>/dev/null
```
Look for `## SkillName` headers or `*_OK` / `*_SKIP` / `*_FAIL` markers. Any skill that logged means it ran. Note: fallback gives partial coverage only — missing from the log doesn't mean it didn't run.

### 3. Cross-reference

For each skill in the expected list:
- **OK**: appears in actual-run list (any conclusion) — scheduler fired correctly
- **FAILED**: in actual-run list with `failure` conclusion — scheduler fired, skill errored (tracked by skill-health, not our concern here)
- **MISSING**: not in actual-run list at all — GHA cron never triggered it

Tally: N_expected, N_ok, N_failed, N_missing.

### 4. Classify severity

| Missing count | Severity |
|---------------|----------|
| 0 | OK — no notification needed |
| 1–2 | WARN — isolated hiccup, possible transient cron delay |
| 3+ | OUTAGE — batch-level failure |

### 5. File issue on OUTAGE

If 3+ missing, check whether today's outage is already tracked:
1. Read `memory/issues/INDEX.md` — scan open issues for one matching today's date and "batch" keyword. If found, skip filing.
2. Determine next ISS number: scan existing `memory/issues/ISS-*.md` files, take highest N + 1.
3. Create `memory/issues/ISS-{NNN}.md`:

```markdown
---
id: ISS-{NNN}
title: Batch outage — {N} skills missed morning window {today}
status: open
severity: medium
category: unknown
detected_by: batch-health
detected_at: {today}T08:00:00Z
resolved_at: null
affected_skills: [{comma-separated skill names}]
root_cause: null
fix_pr: null
---

# ISS-{NNN}: Batch Outage {today}

{N} enabled skills never triggered in the 06:00–07:30 UTC window on {today}.

## Missing Skills

{list each missing skill and its aeon.yml schedule}

## Context

Detected by `batch-health` at 08:00 UTC. The GHA scheduler fired for daily-promoted skills but the batch window was silent.

## Next Steps

- Check GitHub Actions for {today} around 06:00–07:30 UTC for cron delivery failures
- If one-off: likely GHA infrastructure delay (documented pattern)
- If recurring: investigate aeon.yml schedule changes or GHA Actions billing limits
```

4. Append to `memory/issues/INDEX.md` open table:
```
| ISS-{NNN} | medium | Batch outage — {N} skills missed morning window {today} | {today} | batch-health |
```

5. Update `memory/MEMORY.md` issue tracker summary if the issue changes the open count.

### 6. Notify (WARN or OUTAGE only)

Write to `.pending-notify-temp/batch-health-${today}.md` (create dir if needed), then send.

**OUTAGE format:**
```
batch outage — ${today}

${N} skills never triggered (06:00–07:30 UTC):
${list each missing skill with its schedule}

ISS-${NNN} filed. check GHA cron status.
```

**WARN format:**
```
batch gap — ${today}

${N} scheduled skills didn't run:
${list each}

isolated miss — transient cron delay likely. monitoring.
```

Send: `./notify -f .pending-notify-temp/batch-health-${today}.md`

### 7. Log

Append to `memory/logs/${today}.md`:

```markdown
## Batch Health
- **Expected:** ${N} skills in 06:00–07:30 UTC window
- **Expected list:** ${comma-separated skill names}
- **OK:** ${N_ok}
- **Failed:** ${N_failed} (${list or "none"})
- **Missing:** ${N_missing} (${list or "none"})
- **Status:** OK / WARN / OUTAGE
- **Issue filed:** ISS-${NNN} / n/a
- **Notification:** sent / skipped (OK)
- BATCH_HEALTH_OK
```

## Sandbox Note

`./scripts/skill-runs --json` calls `gh api` which is authenticated via `GITHUB_TOKEN` in GitHub Actions — no extra setup needed. If the script errors, fall back to parsing `memory/logs/${today}.md` for log markers. Local fallback is less precise: treat any skill with a log header or `*_OK` marker as "ran", but note the data source in the log entry.

## Required Env Vars

None. `gh api` uses `GITHUB_TOKEN` provided automatically by GitHub Actions.

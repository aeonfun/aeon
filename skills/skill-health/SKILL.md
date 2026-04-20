---
name: Skill Health
description: Audit skill metrics, file/resolve issues in memory/issues/, and notify on state change only
var: ""
tags: [meta]
---
> **${var}** — Skill name to check. If empty, checks all scheduled skills.

<!-- autoresearch: variation C — more robust: memory/issues integration per CLAUDE.md health-skill contract, state-change-gated notifications, graceful missing-data; folds in B's TL;DR+action-directives+top-5 and A's skill-runs fallback -->

If `${var}` is set, only check that specific skill.

## Purpose

Audit skill quality metrics, detect API degradation, **file issues for new failures and resolve them when skills recover**, and notify only when fleet health state actually changes.

## Data sources

1. **`memory/cron-state.json`** — Per-skill quality metrics (as before).
2. **`memory/skill-health/*.json`** — Per-skill quality analysis (Haiku post-run).
3. **`memory/skill-health/last-report.json`** — Last run's classification snapshot (this skill writes it). Used to dedup notifications and detect flapping.
4. **`aeon.yml`** — Enabled skills and schedules.
5. **`memory/issues/INDEX.md`** and `memory/issues/ISS-*.md` — Open issues tracker. Check before filing, update on recovery.
6. **`./scripts/skill-runs --hours 168 --failures --json`** — Fallback source for failures that never wrote to cron-state (sandbox blocks, etc.). Run once, parse JSON.
7. **`memory/logs/YYYY-MM-DD.md`** (last 3 days) — Grep for `SKILL_*_ERROR` or `EMPTY` signatures keyed to skills missing from skill-health/*.json.

## Steps

### 1. Gather state

- Parse `aeon.yml` → list of enabled skills with schedules. If `${var}` set, filter to just that skill.
- Load `memory/cron-state.json` (if missing or unparseable, treat as empty — first run, not failure).
- Load every `memory/skill-health/*.json` (except `last-report.json`).
- Load `memory/skill-health/last-report.json` if present → `prev_report`. If missing, `prev_report = {}`.
- Run `./scripts/skill-runs --hours 168 --failures --json 2>/dev/null || echo '{}'` → extract any skill with failures in the last 7d that isn't in cron-state (sandbox-blocked state writes).
- Parse `memory/issues/INDEX.md` → extract open issues with `detected_by: skill-health` and their affected skills. If missing, treat as empty.

### 2. Classify each enabled skill

For each enabled skill, assign one status using the **first matching rule**:

| Status | Trigger |
|---|---|
| **CRITICAL** | `consecutive_failures >= 3` OR (status==failed AND days_since_last_success >= 3) |
| **DEGRADED** | `success_rate < 0.6` OR (latest `skill-health/*.json` avg_score < 2.5 over ≥3 runs) |
| **FLAPPING** | 3+ status transitions (success↔failed) in last 7 days per cron-state history *or* `skill-runs` output |
| **WARNING** | `success_rate < 0.8` OR `consecutive_failures >= 1` |
| **HEALTHY** | `success_rate >= 0.8` AND `consecutive_failures == 0` AND (no skill-health data OR avg_score >= 3) |
| **NO DATA** | no entry in cron-state AND never seen in skill-runs |

Compute **severity score** for sorting: `consecutive_failures × (1 + days_since_last_success/7)`. Ties broken by days_since_last_success desc.

For each CRITICAL/DEGRADED/FLAPPING skill, record:
- `last_error` (from cron-state or nearest log signature)
- `api_host` if the error clearly names one (e.g. `api.coingecko.com`, `api.github.com`)
- `suggested_action` — one of: `FIX CONFIG` (missing secret, bad arg), `WAIT-API` (rate limit, 5xx, timeout on third-party host), `INVESTIGATE` (unrecognised error), `DISPATCH-SKILL` (NO DATA but scheduled — scheduler gap)

### 3. Detect systemic patterns

Group non-HEALTHY skills by shared `api_host` OR shared `last_error` signature. If ≥2 skills share one:
- Emit a single `SYSTEMIC:` callout (e.g. `SYSTEMIC: 3 skills failing on api.coingecko.com (rate_limit)`).
- Do **not** duplicate the same error across per-skill rows — reference the systemic line.

### 4. Reconcile with memory/issues/

**Precondition guard:** only perform issue filing/resolution if `memory/issues/INDEX.md` already exists. If it is missing, the operator has not opted into the issue-tracker contract yet — log `SKILL_HEALTH_ISSUE_TRACKER_MISSING` to `memory/logs/${today}.md`, skip this entire step (and the reconciliation side of step 5), and continue with classification + notification only. Do **not** auto-create `INDEX.md`.

For each CRITICAL or FLAPPING skill, check if an open issue already exists with this skill in `affected_skills` AND a matching `root_cause` signature:

- **Open issue exists, same root cause** → do nothing (no new file, no notification for this skill).
- **Open issue exists, different root cause** → append a note to the existing ISS file's body: `Update YYYY-MM-DD: new signature: <error>`. Do not file a new issue.
- **No open issue** → file a new one (see below).

For each skill now HEALTHY whose name appears in any open issue's `affected_skills`:
- Remove it from that issue's `affected_skills`. If the list becomes empty, set `status: resolved`, set `resolved_at: <now ISO>`, and move the row from Open to Resolved in INDEX.md.

**Filing a new issue:**
1. Find next ID: scan `memory/issues/ISS-*.md`, take max `NNN`, add 1. Format as zero-padded 3 digits (`ISS-042`).
2. Write `memory/issues/ISS-NNN.md` with YAML frontmatter:
   ```yaml
   ---
   id: ISS-NNN
   title: <skill> <concise failure>
   status: open
   severity: critical | high | medium | low   # critical=CRITICAL status, high=FLAPPING, medium=DEGRADED
   category: rate-limit | timeout | missing-secret | config | api-change | sandbox-limitation | unknown
   detected_by: skill-health
   detected_at: <ISO timestamp>
   affected_skills: [<skill>, ...]    # may grow later
   root_cause: <error signature, 1 line>
   fix_pr: null
   ---
   
   ## What happened
   <2-3 line summary>
   
   ## Signal
   - consecutive_failures: N
   - days_since_last_success: N
   - last_error: "<error>"
   - related skills: <list or "none">
   ```
3. Append a row to `memory/issues/INDEX.md` under **Open**: `| ISS-NNN | title | severity | category | YYYY-MM-DD | skill-a, skill-b |`.

All issue writes must be atomic per file — never partial updates mid-run.

### 5. Decide whether to notify

Build a stable signature from the current classification: sorted list of `CRITICAL+FLAPPING+DEGRADED skill names + SYSTEMIC callouts`. SHA-256 it → `current_hash`.

- If `current_hash == prev_report.hash` AND `now - prev_report.last_notified_at < 24h` → **do not notify**. State unchanged.
- Otherwise → **notify** (there's new signal or the daily reminder cadence elapsed).

Always write `memory/skill-health/last-report.json`:
```json
{
  "hash": "<current_hash>",
  "last_notified_at": "<ISO if notified this run, else previous value>",
  "last_run_at": "<ISO now>",
  "classification": { "critical": [...], "degraded": [...], "flapping": [...], "warning": [...], "healthy_count": N, "no_data": [...] }
}
```

### 6. Format the report

**Top line:** `HEALTH: OK` | `HEALTH: WARNING(W)` | `HEALTH: DEGRADED(D)` | `HEALTH: CRITICAL(C)` — most severe wins.

**Body (notify-channel format, max 1 message):**

```
*Skill Health — ${today}*
HEALTH: CRITICAL(2)  [systemic: api.coingecko.com rate_limit — 3 skills]

🔴 CRITICAL
- token-movers — 5 fails, 3d down — WAIT-API (rate_limit) → ISS-042
- defi-monitor — 4 fails, 2d down — WAIT-API (rate_limit) → ISS-042

🟡 DEGRADED / FLAPPING
- digest — 52% success (14d), avg quality 2.1 — INVESTIGATE → ISS-043

⚪ NO DATA (2): skill-x, skill-y — DISPATCH-SKILL
🟢 HEALTHY: 34

Open issues: 2 · Resolved this run: 1 (rss-digest)
```

Rules for formatting:
- Cap per-section rows at 5; collapse the rest as `+N more — see memory/issues/INDEX.md`.
- Omit HEALTHY list (count only). Omit any empty section.
- Always end with `Open issues: X · Resolved this run: Y`.
- If NO CRITICAL/DEGRADED/FLAPPING and no new/resolved issues → body is just `HEALTH: OK — N skills healthy`.

### 7. Notify and log

- If the gate in step 5 said notify → `./notify "<report body>"`. Update `last_notified_at` in last-report.json to now.
- If gate said skip → do not call `./notify`. Log to memory/logs/${today}.md:
  ```
  ### skill-health
  - SKILL_HEALTH_NOOP — state unchanged since <prev_run_at>, hash=<short>
  ```

On notify, log to memory/logs/${today}.md:
```
### skill-health
- HEALTH: <OK|WARNING|DEGRADED|CRITICAL>
- filed: [ISS-NNN, ...]
- resolved: [ISS-NNN, ...]
- open: N
- systemic: <pattern or none>
```

If all skills healthy, the body-only shortcut from step 6 still fires (once per 24h, per gate) so the operator gets confirmation the audit actually ran — but suppress if last-report.json shows a notify <24h ago with the same OK hash.

## Sandbox note

The sandbox may block outbound `curl`. This skill does not fetch URLs directly — all data is local or via `gh` / `./scripts/skill-runs` (which uses `gh api`). No curl fallback needed. If `./scripts/skill-runs` fails, log `SKILL_HEALTH_PARTIAL — skill-runs unavailable` and continue with cron-state only.

## Constraints

- Never file two open issues for the same `(skill, root_cause)` pair — always check INDEX.md first.
- Never edit a Resolved issue. If a previously-resolved issue re-fires, file a new ISS with a pointer (`related: ISS-NNN`) in the body.
- Do not notify on pure HEALTHY runs more than once per 24h.
- If `${var}` is set (single-skill mode), skip INDEX.md updates only if the single skill is HEALTHY — otherwise file/resolve as normal.
- Never touch `memory/issues/INDEX.md` Resolved section except to move rows into it; never delete rows.

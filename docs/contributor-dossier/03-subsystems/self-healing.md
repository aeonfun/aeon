# Subsystem: Self-Healing

The closed-loop infrastructure that detects, diagnoses, scores, and patches failing skills without human intervention.

---

## The loop

```
                ┌──────────────┐
                │  heartbeat   │  3× daily: 08:00 / 14:00 / 20:00 UTC
                │  (always-on) │  Reads cron-state.json, flags P0/P1/P2/P3
                └──────┬───────┘
                       │ finds: failed, stuck, chronic, API-degraded
                       │
       ┌───────────────┼─────────────────────────┐
       ▼               ▼                         ▼
┌─────────────┐ ┌─────────────────┐    ┌──────────────────┐
│ skill-health│ │   skill-evals   │    │   batch-health   │
│             │ │                 │    │                  │
│ Classifies, │ │ Asserts against │    │ Daily audit:     │
│ files issues│ │ evals.json,     │    │ did the 06–07:30 │
│             │ │ regression diff │    │ batch fire?      │
└──────┬──────┘ └────────┬────────┘    └────────┬─────────┘
       │                 │                       │
       │  files: memory/issues/ISS-NNN.md (open) │
       │                                         │
       └──────────────────┬──────────────────────┘
                          │
                          ▼  reactive trigger:
                  ┌───────────────┐  consecutive_failures >= 3
                  │  skill-repair │  triggers automatically
                  │  (reactive)   │
                  └───────┬───────┘
                          │ per-category playbook
                          │ opens PR with LOW/MED/HIGH risk
                          ▼
                  ┌───────────────┐
                  │  self-improve │  every other day
                  │  (proactive)  │  evolves prompts/config/workflows
                  └───────────────┘
```

Plus three supporting skills:

- **[`skill-analytics`](../../../skills/skill-analytics/SKILL.md)** — weekly fleet-level rollup (which skills run most/fail most/silently skip/haven't fired at all).
- **[`skill-freshness`](../../../skills/skill-freshness/SKILL.md)** — flags chained skills about to consume yesterday's data.
- **[`skill-update-check`](../../../skills/skill-update-check/SKILL.md)** — drift detection for imported skills.

---

## Heartbeat — the always-on probe

[`skills/heartbeat/SKILL.md`](../../../skills/heartbeat/SKILL.md) is the only skill enabled by default in upstream `aeon.yml`. Runs three times daily, listed last so it only fires when no other skill claims the slot.

### P0 checks ([`heartbeat/SKILL.md:16-42`](../../../skills/heartbeat/SKILL.md#L16-L42))

Reads `memory/cron-state.json` and flags:

- **Failed** — any skill with `last_status: "failed"`.
- **Stuck** — any skill with `last_status: "dispatched"` and `last_dispatch` >45 min ago.
- **API degradation** — any skill with `consecutive_failures >= 3`.
- **Chronic** — `success_rate < 0.5` with `total_runs >= 5`.
- **Self-check** — heartbeat's own `last_success` >36 h stale (unreliable heartbeat).

P1–P3 checks ([`heartbeat/SKILL.md:43-57`](../../../skills/heartbeat/SKILL.md#L43-L57)): stalled PRs (>24h), urgent GitHub issues, flagged memory items, missing scheduled skills (never dispatched).

### Dedup ([`heartbeat/SKILL.md:60-62`](../../../skills/heartbeat/SKILL.md#L60-L62))

Before notifying, greps `memory/logs/` from the last 48 hours; skips if already reported. Prevents alert fatigue.

### Public status page ([`heartbeat/SKILL.md:71-142`](../../../skills/heartbeat/SKILL.md#L71-L142))

Always regenerates `docs/status.md` (Jekyll frontmatter for the GitHub Pages site) with:

- Overall status (🔴 DEGRADED / 🟡 WATCH / 🟢 OK).
- Skill health table (last 7 days, per-skill last-run/status/success-rate/consecutive-failures).
- Open issues from `memory/issues/INDEX.md`.
- Token pulse from latest `articles/token-report-*.md`.

### Exit ([`heartbeat/SKILL.md:162-170`](../../../skills/heartbeat/SKILL.md#L162-L170))

- **Nothing to report** → log `HEARTBEAT_OK`, silent.
- **Something to report** → one consolidated notification + log + status-page verdict.

This is the contract: heartbeat is the noise filter. Other skills can be loud; heartbeat is quiet unless there's a real signal.

---

## Skill-health — classification + issue filing

[`skills/skill-health/SKILL.md`](../../../skills/skill-health/SKILL.md). Runs daily.

### Six-status classification ([`skill-health/SKILL.md:40-51`](../../../skills/skill-health/SKILL.md#L40-L51))

First-match wins:

| Status | Trigger |
|---|---|
| `CRITICAL` | `consecutive_failures >= 3` OR (last_status==failed AND `days_since_last_success >= 3`) |
| `DEGRADED` | `success_rate < 0.6` OR (avg quality score < 2.5 over ≥3 runs) |
| `FLAPPING` | 3+ success↔failed transitions in 7 days |
| `WARNING` | `success_rate < 0.8` OR `consecutive_failures >= 1` |
| `HEALTHY` | `success_rate >= 0.8`, no consecutive failures, no quality data OR avg_score >= 3 |
| `NO_DATA` | Never seen in cron-state + skill-runs |

### Systemic pattern detection ([`skill-health/SKILL.md:58-62`](../../../skills/skill-health/SKILL.md#L58-L62))

Groups 2+ skills by shared `api_host` or `last_error` signature. Emits one `SYSTEMIC:` callout instead of duplicating per-skill errors. This is how rate-limit storms on a single API don't produce 12 separate alerts.

### Issue filing ([`skill-health/SKILL.md:64-105`](../../../skills/skill-health/SKILL.md#L64-L105))

**Precondition:** `memory/issues/INDEX.md` must exist (operator opt-in). Otherwise log `SKILL_HEALTH_ISSUE_TRACKER_MISSING` and skip.

For each CRITICAL / FLAPPING:
1. Check if an open issue exists for this skill + root cause.
2. If yes / same → no-op.
3. If yes / different → append `Update YYYY-MM-DD: new signature:` to body.
4. If no → write `ISS-{NNN}.md` (frontmatter: `id, title, status:open, severity, category, detected_by:skill-health, detected_at, affected_skills, root_cause, fix_pr:null`).

For HEALTHY skills, remove them from open issues' `affected_skills`. If the list becomes empty, move the row to Resolved in INDEX.md.

### Notify gate ([`skill-health/SKILL.md:107-122`](../../../skills/skill-health/SKILL.md#L107-L122))

Hashes the sorted set of (CRITICAL + FLAPPING + DEGRADED skill names + SYSTEMIC). If hash == prior AND last notification < 24h ago → skip notify. State persists in `memory/skill-health/last-report.json`. Always writes state.

Report format ([`skill-health/SKILL.md:124-151`](../../../skills/skill-health/SKILL.md#L124-L151)): top line verdict (`HEALTH: OK | WARNING(W) | DEGRADED(D) | CRITICAL(C)`), body lists per-section capped at 5 rows.

---

## Skill-evals — assertion-based regression detection

[`skills/skill-evals/SKILL.md`](../../../skills/skill-evals/SKILL.md). Different from skill-health: evals are explicit assertions about output content, defined in [`skills/skill-evals/evals.json`](../../../skills/skill-evals/evals.json).

### Coverage audit ([`skill-evals/SKILL.md:28-34`](../../../skills/skill-evals/SKILL.md#L28-L34))

Delegates to `./scripts/eval-audit --json` to compute coverage_pct (what fraction of enabled skills have evals defined). Surfaces uncovered enabled skills.

### Per-skill checks ([`skill-evals/SKILL.md:41-57`](../../../skills/skill-evals/SKILL.md#L41-L57))

For each skill with an entry in evals.json:
- Find latest output via glob.
- Check empty / stale / word-count / required-patterns / forbidden-patterns / numeric-out-of-bounds / quality-cross-check.
- Final status by precedence: `NO_OUTPUT > FAIL > STALE > QUALITY_DEGRADED > WARN > PASS`.

### Diff vs prior ([`skill-evals/SKILL.md:59-91`](../../../skills/skill-evals/SKILL.md#L59-L91))

Parses prior eval article, computes deltas per skill: `NEW_FAIL | FIXED | STILL_FAIL | NEW_PASS | NEW_NO_COVERAGE | STABLE`.

- For `NEW_FAIL` or `NEW_QUALITY_DEGRADED` → file ISS-{NNN}.md with `detected_by: skill-evals`.
- For `FIXED` → find open ISS with this skill + `detected_by: skill-evals`, flip to resolved.

### Verdict + notify ([`skill-evals/SKILL.md:93-160`](../../../skills/skill-evals/SKILL.md#L93-L160))

Verdict precedence: `SKILL_EVALS_REGRESSED, SKILL_EVALS_QUALITY_DROP, SKILL_EVALS_RECOVERED, SKILL_EVALS_COVERAGE_CLIFF, SKILL_EVALS_OK`.

Notify only on `REGRESSED / QUALITY_DROP / COVERAGE_CLIFF / RECOVERED`. Silent on `OK`.

---

## Skill-repair — the automated fixer

[`skills/skill-repair/SKILL.md`](../../../skills/skill-repair/SKILL.md). Reactive — fires automatically on `consecutive_failures >= 3` (wired in [`aeon.yml`](../../../aeon.yml) `reactive:` block, see [`runtime.md`](runtime.md)).

### Exit taxonomy ([`skill-repair/SKILL.md:21-32`](../../../skills/skill-repair/SKILL.md#L21-L32))

`REPAIR_OK_FIXED, REPAIR_OK_SYSTEMIC, REPAIR_DIAGNOSED_NO_FIX, REPAIR_NO_TARGETS, REPAIR_DRY_RUN, REPAIR_BLOCKED`.

### Preflight ([`skill-repair/SKILL.md:34-42`](../../../skills/skill-repair/SKILL.md#L34-L42))

Cooldown check via `memory/state/skill-repair-history.json`: skip if same target was repaired within 24h, OR an open `fix/skill-repair-<name>-*` PR exists, OR 3+ repair PRs have been opened today (rate limit).

### Triage ([`skill-repair/SKILL.md:50-70`](../../../skills/skill-repair/SKILL.md#L50-L70))

If `var` is empty, read issues + cron-state, cluster by error signature + category. **If 2+ skills share a signature → systemic mode** (one shared issue / one shared PR for all). Otherwise pick worst: critical > high > consecutive_failures desc > lowest success_rate > stalest last_success.

### Diagnose ([`skill-repair/SKILL.md:71-109`](../../../skills/skill-repair/SKILL.md#L71-L109))

Builds a dossier per target:
- Skill frontmatter + cron-state entry.
- Regression hunter: `git log --oneline --since="$LAST_SUCCESS"`.
- Last 5 failed runs from skill-runs.
- `memory/logs/` grep.
- Quality history.
- Output expectations from evals.json.
- Issue category.

### Repair playbook ([`skill-repair/SKILL.md:111-134`](../../../skills/skill-repair/SKILL.md#L111-L134))

Per-category action:

| Category | Action |
|---|---|
| `api-change` | WebFetch live spec, update endpoints / payload / headers |
| `rate-limit` | Add backoff / reduce requests / fallback endpoint (never raise limit) |
| `timeout` | Split work, early-return, downgrade model |
| `sandbox-limitation` | Convert to prefetch / postprocess pattern |
| `prompt-bug` | Minimal specificity insertion |
| `output-format` / `quality-regression` | Edit skill to match evals.json assertion |
| `missing-secret` | File issue, notify operator, exit `REPAIR_DIAGNOSED_NO_FIX` |
| `config` | Reversible aeon.yml edits only (schedule/var/model/enabled) |
| `unknown` | Do **not** edit; append diagnostic dossier to issue, exit `REPAIR_DIAGNOSED_NO_FIX` |

### Risk classification ([`skill-repair/SKILL.md:128-131`](../../../skills/skill-repair/SKILL.md#L128-L131))

- `LOW` — clarifying prompt, <30 lines diff.
- `MED` — changes data source, new env-var ref.
- `HIGH` — touches aeon.yml, removes features, modifies scripts → adds `manual-review` label, **never auto-merges**.

### Verification + PR ([`skill-repair/SKILL.md:135-187`](../../../skills/skill-repair/SKILL.md#L135-L187))

Branch `fix/skill-repair-<name>-<today>`. PR body sections: Symptom, Diagnosis, Root cause, Fix, Risk, Verification, Source status. Manual trigger instructions and expected-result checks are inlined for review.

### Issue updates ([`skill-repair/SKILL.md:191-197`](../../../skills/skill-repair/SKILL.md#L191-L197))

- Fix applied → status `resolved` + `fix_pr` set.
- No fix possible → append "Repair Attempt" section with dossier.
- No issue existed but real problem found → create ISS with status `resolved` already (the fix is the diagnostic itself).

---

## Self-improve — proactive evolution

[`skills/self-improve/SKILL.md`](../../../skills/self-improve/SKILL.md). Runs every other day.

Different from skill-repair: skill-repair is reactive (fix what broke). Self-improve is proactive (make what works better).

### Steps ([`self-improve/SKILL.md:14-77`](../../../skills/self-improve/SKILL.md#L14-L77))

1. Check for 3+ open improvement PRs → wait for review.
2. Scan logs (last 2 days) + cron-state + repo-actions articles for highest-impact, smallest-effort improvement.
3. Read relevant files (SKILL.md, aeon.yml, workflows, CLAUDE.md, dashboard).
4. Implement minimal, targeted changes — clarify a prompt, add backoff, tighten output, fix notify config.
5. Branch `fix/self-improve-<today>`, open PR, notify, log.

### Constraints ([`self-improve/SKILL.md:93-100`](../../../skills/self-improve/SKILL.md#L93-L100))

- **One fix per run.** No batching.
- **Never rewrite entire skills.** Edit, don't replace.
- **Never modify workflow files.** Those need human review.
- **Don't create circular improvements.** If yesterday's self-improve PR is still open, wait.

---

## Skill-analytics — fleet rollups

[`skills/skill-analytics/SKILL.md`](../../../skills/skill-analytics/SKILL.md). Weekly (Wednesdays).

### Anomaly flags ([`skill-analytics/SKILL.md:73-85`](../../../skills/skill-analytics/SKILL.md#L73-L85))

- 🔴 `SILENT` — enabled cron skill, zero runs.
- 🔴 `ALL_FAIL` — every run failed.
- 🟠 `CONSECUTIVE_FAILURES` — ≥3 from cron-state.
- 🟠 `LOW_SUCCESS` — <80% over ≥3 runs.
- 🟡 `ALL_SKIP` — every run skipped (possibly correct behavior).
- 🟡 `DUPLICATE_RUNS` — >2× expected.

### Exit taxonomy from logs ([`skill-analytics/SKILL.md:56-70`](../../../skills/skill-analytics/SKILL.md#L56-L70))

Best-effort regex grep of `memory/logs/YYYY-MM-DD.md` for markers:
- `_OK`, `_OK_SILENT`
- `SKIP_QUIET`, `SKIP_UNCHANGED`, `NEW_INFO`
- `_SKIP*`, `_ERROR`, `_FAILED`, `_PARTIAL`

10–20% miss rate accepted — this is fleet-level signal, not per-run truth.

### Exit ([`skill-analytics/SKILL.md:298-303`](../../../skills/skill-analytics/SKILL.md#L298-L303))

- `SKILL_ANALYTICS_OK` — snapshot fetched, ≥1 anomaly → notify.
- `SKILL_ANALYTICS_QUIET` — snapshot fetched, zero anomalies → no notify (silence is correct).
- `SKILL_ANALYTICS_NO_DATA` — empty result → no notify, no article.

---

## Batch-health — daily post-batch audit

[`skills/batch-health/SKILL.md`](../../../skills/batch-health/SKILL.md). Daily 08:00 UTC.

Checks whether enabled scheduled skills fired in the 06:00–07:30 UTC morning window:
- Parses `aeon.yml` for expected list ([`batch-health/SKILL.md:19-40`](../../../skills/batch-health/SKILL.md#L19-L40)).
- Calls `./scripts/skill-runs --json --hours 26`; falls back to parsing `memory/logs/${today}.md` for markers.
- Classifies: OK (0 missing) / WARN (1–2 missing) / OUTAGE (3+ missing).
- On OUTAGE → files ISS-{NNN}.md if not already tracked for today.

This catches GitHub Actions cron drift and scheduler bugs that heartbeat would miss.

---

## Skill-freshness — staleness for chained skills

[`skills/skill-freshness/SKILL.md`](../../../skills/skill-freshness/SKILL.md).

For chained skills, an upstream skill's `articles/<skill>-*.md` or `.outputs/<skill>.md` may be stale (the upstream cron drifted, the upstream failed, etc.). Skill-freshness flags this before downstream consumers eat the stale data.

Thresholds ([`skill-freshness/SKILL.md:35-45`](../../../skills/skill-freshness/SKILL.md#L35-L45)):
- `articles/{skill}-*.md` — 28h for daily, 192h for weekly.
- `.outputs/{skill}.md` — 4h.
- `memory/topics/{name}.md` — 7 days.
- `memory/state/{name}.json` — 30 days.

Severity bands ([`skill-freshness/SKILL.md:49-55`](../../../skills/skill-freshness/SKILL.md#L49-L55)): OK / WARN (past 1×, within 2×) / STALE (past 2×) / MISSING.

Dedup via fingerprint, 7-day notify cadence.

---

## Skill-update-check — imported-skill drift

[`skills/skill-update-check/SKILL.md`](../../../skills/skill-update-check/SKILL.md).

For skills installed via `./add-skill` or `./install-skill-pack`, checks `skills.lock` against upstream:
- Fetch upstream SHA on tracked branch.
- Diff metadata: breaking keywords, frontmatter changes, new dependencies.
- Re-run `skill-security-scan` on the upstream version.
- Priority assignment: `CRITICAL` (security FAIL or missing upstream) > `HIGH` (enabled + warn/breaking/major) > `MEDIUM` (enabled + clean) > `LOW` (disabled).

**Never auto-advances `commit_sha`** ([`skill-update-check/SKILL.md:147-156`](../../../skills/skill-update-check/SKILL.md#L147-L156)) — only an explicit ACCEPT flow does that, after human review and a fresh security scan. This is the supply-chain hygiene boundary for community packs.

---

## How the loop closes

A canonical failure-to-fix path:

1. **T+0** — `token-alert` skill fires, hits a CoinGecko 429.
2. **T+0** — quality scorer marks output `low_quality` with `rate_limited` flag. `cron-state.json` updates: `last_status=failed, consecutive_failures=1`.
3. **T+1d** — still failing. `consecutive_failures=3`.
4. **T+1d** — next `messages.yml` tick evaluates the reactive trigger `skill-repair: on:"*" when:"consecutive_failures >= 3"` → dispatches `skill-repair` with `var="token-alert"`.
5. **T+1d** — `skill-repair` reads cron-state, classifies category as `rate-limit`, applies playbook (add backoff). Opens PR with risk=LOW.
6. **T+1d** — `skill-health`'s next run sees the open PR (`fix_pr` set on issue if one was filed), records the link.
7. **T+2d** — PR merged. Next `token-alert` run succeeds. `consecutive_failures=0`, `success_rate` recovers.
8. **T+2d** — `skill-evals` next run flips the issue (if any) to `resolved`.
9. **T+1w** — `skill-analytics` weekly digest shows token-alert under RECOVERED.

No human in the loop. The whole thing is logged in `memory/logs/`, surfaced in the public `docs/status.md`, and tracked in `memory/issues/`.

## Operational gotchas

- **The reactive trigger for skill-repair is wired in `aeon.yml`** but the in-workflow logic for evaluating it lives in [`messages.yml:336-406`](../../../.github/workflows/messages.yml#L336-L406). If you change the trigger semantics, both files have to agree.
- **The Haiku scorer can mark a skill failed for non-error reasons** (e.g. empty output is a 1, even if that was the correct behavior). Skills that intentionally produce empty output on "nothing to report" must log `SKILL_X_OK_SILENT` so the scorer sees it ([`aeon.yml:601-701`](../../../.github/workflows/aeon.yml#L601-L701) skips meta skills entirely).
- **`memory/state/skill-repair-history.json` is the cooldown ledger.** Don't delete it casually — wiping it makes skill-repair re-target the same skill immediately.
- **`memory/issues/INDEX.md` must exist for filing to work.** Bootstrap by committing the empty file.
- **Self-improve will not modify workflows.** If a workflow change is needed, that's a human PR.

## Related docs

- [`runtime.md`](runtime.md) — quality scoring, cron-state updates, reactive trigger evaluation.
- [`memory.md`](memory.md) — issues, cron-state, skill-health structure.
- [`fleet.md`](fleet.md) — fleet-level analytics that ride on the same primitives.
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) — time-travel replay (#4) builds on this surface.

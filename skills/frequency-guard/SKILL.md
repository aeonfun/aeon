---
name: Frequency Guard
description: Per-skill run-count watchdog — checks if any capped skills exceeded their configured daily limit and alerts on breach
var: ""
tags: [meta]
---

Today is ${today}. Check whether any capped skills exceeded their daily run limit.

## Config

Caps live in `memory/skill-caps.json`. If the file doesn't exist, create it with the seed below and continue:

```json
{
  "deploy-prototype": { "daily_max": 1, "note": "expensive — capped at 1/day" },
  "external-feature": { "daily_max": 1, "note": "1 pass per day; var targets vary" },
  "feature":          { "daily_max": 1, "note": "iterates all watched repos per run" },
  "vuln-scanner":     { "daily_max": 2, "note": "scheduled 2x/day by design; cap covers extra manual fires" }
}
```

Operators can also declare caps in `aeon.yml` under a top-level `skill_caps:` block. If both exist, `memory/skill-caps.json` wins (operator-edited dynamic state outranks committed config).

## Steps

### 1. Read `memory/token-usage.csv`

- Columns: `date,skill,model,input_tokens,output_tokens,cache_read,cache_creation`
- If missing: log `RUN_FREQ_GUARD_SKIP: no token-usage.csv` and stop. No notification.
- Filter rows where `date == ${today}`.
- If zero rows today: log `RUN_FREQ_GUARD_SKIP: no runs today yet` and stop.

### 2. Count runs per skill today

Group filtered rows by `skill`. Each row = one run. Output: `{ skill: run_count }`.

### 3. Load caps config

Read `memory/skill-caps.json` (preferred) or `aeon.yml`'s `skill_caps:` block. If neither exists, write the defaults from the Config section above to `memory/skill-caps.json`, then continue with those values.

### 4. Detect breaches

For each skill in the caps config:
- Lookup today's run count (default 0 if the skill didn't run today).
- If `count > daily_max`: record a breach → `{ skill, daily_max, actual: count, over_by: count - daily_max }`.

### 5. Decide whether to notify

- **No breaches**: log `RUN_FREQ_GUARD_OK` with the count summary, skip notification.
- **Any breach**: write notification to a temp file and send via `./notify -f`.

### 6. Format notification (breaches only)

Write to `.pending-notify-temp/run-freq-guard-${today}.md` (create dir if needed), then:

```bash
./notify -f .pending-notify-temp/run-freq-guard-${today}.md
```

Message format:

```
*Run Frequency Guard — ${today}*

<N> cap breach(es):
- <skill>: <actual> runs today / <daily_max> cap (<over_by> over)
- <skill>: <actual> runs today / <daily_max> cap (<over_by> over)

update caps: memory/skill-caps.json
log: memory/logs/${today}.md
```

No hedging, no fluff.

### 7. Log to `memory/logs/${today}.md`

Append:

```markdown
## Run Frequency Guard
- Skills checked: <count of capped skills>
- Breaches: <list of "skill (actual/max)" or "none">
- Status: OK / BREACH
- Notification: sent / skipped (OK)
- RUN_FREQ_GUARD_OK
```

(Use `RUN_FREQ_GUARD_OK` even on breach — the log marker just means the skill ran successfully.)

## Sandbox Note

Reads only local files (`memory/token-usage.csv`, `memory/skill-caps.json`, `aeon.yml`). No external network calls. No prefetch/postprocess needed.

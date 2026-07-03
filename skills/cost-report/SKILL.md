---
type: Skill
name: cost-report
category: meta
description: API cost intelligence — the full weekly report (dollar costs from token usage, anomaly flags, burn forecast, concrete optimizations) plus a `watch` budget watchdog that checks running weekly spend against a cap and alerts on WATCH/WARN/ALERT tiers
var: ""
tags: [meta]
version: "3.0.0"
---
<!-- autoresearch: variation B — sharper output (verdict + anomalies + burn forecast + concrete optimizations, not passive tables) -->
> **${var}** — selector. **Empty** (or a positive integer `N`, default `7`) → the FULL cost report over the last `N` days. **`watch`** → the budget watchdog: check running weekly spend against the configured cap, silent under 50%. **`watch:<amount>`** → the watchdog with the weekly cap overridden to `<amount>` dollars (e.g. `watch:250`).

Today is ${today}. This skill has two branches over the same token-usage data:

- **Report branch** (default / numeric `${var}`) — the weekly retrospective. Explains *where* spend went. Output must prescribe action, not just describe spend — every section names an anomaly, forecasts risk, or recommends a concrete move.
- **Watch branch** (`${var}` = `watch` or `watch:<amount>`) — the daily budget watchdog. Catches *runaway* spend before the week is over by comparing running weekly cost to a budget cap, and stays silent until spend actually warrants attention.

## Shared setup

1. Per standing instructions, read `memory/MEMORY.md` and scan the last ~3 days of `memory/logs/` for context (and, on the watch branch, to avoid re-alerting an already-reported tier).
2. **Parse `${var}` → branch**, trimming whitespace:
   - Equals `watch`, or starts with `watch:` → **watch branch**. If `watch:<amount>` and `<amount>` parses as a positive number, that is the cap override.
   - Otherwise → **report branch**. Empty → 7-day window. A positive integer → that many days.
3. Read `aeon.yml` and find `gateway.provider` to pick the pricing table below. Both branches use the **same** tables.

## Model Pricing (per million tokens)

### Direct Anthropic (gateway.provider: direct)

| Model | Input | Output | Cache Read | Cache Write |
|-------|-------|--------|------------|-------------|
| claude-opus-4-7 | $15.00 | $75.00 | $1.50 | $18.75 |
| claude-sonnet-5 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-sonnet-4-6 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-haiku-4-5-20251001 | $0.80 | $4.00 | $0.08 | $1.00 |

### Bankr Gateway (gateway.provider: bankr)

| Model | Input | Output |
|-------|-------|--------|
| claude-opus-4-7 | $5.00 | $25.00 |
| claude-sonnet-5 | $3.00 | $15.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| claude-haiku-4-5-20251001 | $0.80 | $4.00 |

Bankr does not expose cache read/write pricing separately. Treat cache columns as $0 for Bankr rows.
> `claude-sonnet-5` launched with introductory pricing of $2.00 input / $10.00 output per million tokens through 2026-08-31; the rates above are the post-intro standard. They overstate (never understate) spend during the intro window — fine for the watch branch (a conservative watchdog), but on the report branch flag it in the "Pricing drift" callout if Sonnet 5 usage is material and you need exact intro-window costs.

If a CSV row references a model not in the active table, treat it as an **unknown model**: price it at Opus rates (conservative), and continue — do not crash. On the report branch, additionally add it to the "Pricing drift" callout so rates can be updated.

---

# BRANCH A — Report (default / numeric `${var}`)

Run this branch when `${var}` is empty or a positive integer. **The output must prescribe action, not just describe spend.**

## A. Steps

### A1. Determine the report window

- Default: 7 days. If `${var}` is a positive integer (e.g. "30"), use that many days.
- Compute `CUTOFF_DATE = today − N days`. All rows where `date >= CUTOFF_DATE` are in-window.
- If the CSV has ≥ `2 × N` days of history, also compute `PRIOR_CUTOFF = today − 2N days` for week-over-week.

### A2. Read token usage data

- File: `memory/token-usage.csv`
- Columns: `date,skill,model,input_tokens,output_tokens,cache_read,cache_creation`
- If the file is missing: log `COST_REPORT_SKIP: no token-usage.csv yet` and stop (no notification).
- If 0 rows in-window: log `COST_REPORT_SKIP: no runs in last N days` and stop.
- Parse numeric columns defensively — skip malformed rows, count them as `csv_malformed` for the source-status footer.

### A3. Compute per-row cost

For each valid in-window row, look up the model's rates and calculate:
```
input_cost       = input_tokens    / 1e6 × rate_input
output_cost      = output_tokens   / 1e6 × rate_output
cache_read_cost  = cache_read      / 1e6 × rate_cache_read
cache_write_cost = cache_creation  / 1e6 × rate_cache_write
row_cost         = input_cost + output_cost + cache_read_cost + cache_write_cost
```

### A4. Core aggregates (ground truth — keep these)

a. **Total cost** for the window (and break out input/output/cache_read/cache_write dollar shares).
b. **Per-skill** — top 10 by cost. Columns: Skill | Runs | Total Tokens | Cost | Avg Cost/Run.
c. **Per-model** — total runs, total tokens, total cost per model.
d. **Week-over-week** — only if ≥ `2N` days of history. `delta_pct = (this_window − prior_window) / prior_window`.

### A5. Decision sections (this is the point of the skill)

#### A5a. Verdict line (one sentence, top of report)

Compose one sentence that captures the week. Pattern:
> "Spent **$X.XX** across **N runs** ({{↑/↓ Y% WoW | no prior-week baseline}}); **M anomalies flagged**, projected monthly burn **~$Z.ZZ**."

#### A5b. Anomaly detection (per-skill, per-model cost spikes)

For each (skill, model) pair with ≥ 3 runs in-window:
- Compute mean µ and std-dev σ of `row_cost`.
- Flag any run where `row_cost > µ + 2σ` AND `row_cost > $0.10` (ignore sub-cent noise).
- Flag skills whose **total** cost this window is ≥ 2× the same skill's prior-window total (only if prior window exists and prior total ≥ $0.25).

Output a table: `Skill | Model | When | Run Cost | vs µ | Why (tokens_input / tokens_output / cache_write)`. If no anomalies, write "No anomalies." — do not omit the section.

#### A5c. Monthly burn forecast

- `daily_avg_cost = total_cost / N`
- `projected_monthly = daily_avg_cost × 30`
- Show: "At current rate, 30-day spend ≈ **$X.XX**."
- If projected_monthly > $50, add a "⚠ burn-rate watch" note.

#### A5d. Optimization opportunities (top 3, actionable)

Scan the in-window data and produce up to 3 concrete recommendations. Each must name (i) a specific skill, (ii) a specific change, (iii) estimated weekly savings. Candidate patterns:

- **Model downgrade**: skill runs on `claude-opus-4-7`, its median `output_tokens / input_tokens` ratio across runs is < 0.3, AND its avg run cost > $0.25. → Suggest Sonnet; savings = `this_skill_cost × (1 − sonnet_rate_mix / opus_rate_mix)`.
- **Cache underuse** *(direct gateway only)*: skill's `cache_read / (cache_read + input_tokens)` ratio < 0.2 across runs AND avg run cost > $0.10. → "Add a stable prompt prefix so Claude Code can cache it — would move ~X% of input tokens to cache_read at 10× savings."
- **Aeon.yml mismatch**: `aeon.yml` sets a `model:` override for the skill but the CSV shows runs on a different model. → "Model override drift — aeon.yml says X, runs show Y."
- **Long-tail waste**: a skill with >10 runs in-window where avg cost/run < $0.01 AND it produces no written artifact (no `output/articles/` file, no notification). → "Possible no-op loop."

If fewer than 3 candidates pass the filters, say so — do not pad. If zero candidates, write "No optimization levers found this week."

#### A5e. Pricing drift callout

If any CSV row referenced a model not in the active pricing table, list those model names and the total tokens attributed to them. Note: "Add rates to skills/cost-report/SKILL.md." If all rows matched, omit this block.

### A6. Write the full report

Path: `output/articles/cost-report-${today}.md`. If the file already exists, overwrite it (idempotent).

```markdown
# Aeon Cost Report — ${today}
*Period: last N days · gateway: {{direct|bankr}}*

> {{verdict line from A5a}}

## Anomalies
{{table from A5b, or "No anomalies."}}

## Burn forecast
- Daily avg: $X.XX
- 30-day projection: $X.XX {{⚠ burn-rate watch if >$50}}

## Optimization opportunities
1. **{{skill}}** — {{action}}. Est. savings: ~$X.XX/week.
2. ...
3. ...
{{or "No optimization levers found this week."}}

## Cost by Skill (Top 10)
| Skill | Runs | Tokens | Cost | Avg/Run |
|-------|------|--------|------|---------|

## Cost by Model
| Model | Runs | Tokens | Cost |
|-------|------|--------|------|

## Composition
- Input: $X.XX · Output: $X.XX · Cache read: $X.XX · Cache write: $X.XX

## Week-over-week
- This window: $X.XX · Prior window: $X.XX · Δ {{+/−}}X% {{or "no prior-week baseline"}}

## Pricing drift
{{list of unknown models, or omit if none}}

---
*Sources: token-usage.csv ({{ok|degraded: M malformed rows skipped}}) · aeon.yml ({{ok|missing}}) · pricing table last reviewed in SKILL.md.*
*Generated by Aeon cost-report skill.*
```

### A7. Send notification via `./notify`

Lead with the verdict, then the top 3 actions. Keep under ~15 lines.

```
*Cost Report — ${today} (last N days)*

{{verdict line from A5a}}

Top 3 by cost:
1. skill-a — $X.XX (N runs)
2. skill-b — $X.XX
3. skill-c — $X.XX

{{If any optimization opportunities:}}
Actions this week:
• {{skill}} → {{action}} (~$X.XX/wk)
• ...

{{If any anomalies:}} ⚠ M anomalies flagged — see report.
{{If pricing drift:}} ⚠ unknown models in CSV — see report.

30-day projection: $X.XX
Full: output/articles/cost-report-${today}.md
```

Then log per the shared **Log** section below (discriminator: `report`).

---

# BRANCH B — Watch (`${var}` = `watch` or `watch:<amount>`)

Run this branch when `${var}` is `watch` or `watch:<amount>`. This is the daily complement to the report branch: the report explains *where* spend went; the watchdog catches *runaway* spend before the week is over.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` exist and are populated, read them and match the operator's voice in the notification. Otherwise use a clear, direct, neutral tone — terse, no hedging.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| WEEKLY_BUDGET_CAP | No | Weekly spend cap in USD (default: 200) |

## B. Steps

### B1. Determine the budget cap

- If `${var}` was `watch:<amount>` and `<amount>` is a number, use it as the cap.
- Else if the `WEEKLY_BUDGET_CAP` env var is set, use that.
- Else default to 200 (dollars). The cap is meant to be tuned per instance — raise it once a steady-state week consistently runs warm, lower it to tighten the guardrail.

### B2. Determine the current week window

- Current week starts on Monday. Compute `WEEK_START` = most recent Monday on or before today.
- `WEEK_END` = today (inclusive).
- Compute how many days have elapsed this week (1 = Monday only, 7 = full week).

### B3. Read token usage data

- File: `memory/token-usage.csv`
- Columns: `date,skill,model,input_tokens,output_tokens,cache_read,cache_creation`
- If file does not exist: log `SPEND_MONITOR_SKIP: no token-usage.csv` and stop — do NOT send any notification.
- Filter rows where `date >= WEEK_START` and `date <= WEEK_END`.
- If zero rows: log `SPEND_MONITOR_SKIP: no runs this week yet` and stop.

### B4. Compute costs for each row

- Using the `gateway.provider` (direct or bankr) resolved in Shared setup, look up model rates and calculate:
  ```
  input_cost       = input_tokens  / 1,000,000 × rate_input
  output_cost      = output_tokens / 1,000,000 × rate_output
  cache_read_cost  = cache_read    / 1,000,000 × rate_cache_read   (0 if bankr)
  cache_write_cost = cache_creation/ 1,000,000 × rate_cache_write  (0 if bankr)
  row_cost = input_cost + output_cost + cache_read_cost + cache_write_cost
  ```

### B5. Aggregate

- **Running weekly total** = sum of all row_costs.
- **Per-skill totals** = group by skill, sum costs, sort descending.
- **Top cost driver** = skill with highest total cost this week.
- **Projected weekly total** = (running_total / days_elapsed) × 7. Cap projection at 7 days even if week is not done.
- **Budget usage %** = (running_total / cap) × 100.
- **Projected budget usage %** = (projected_total / cap) × 100.

### B6. Classify status

- **OK** — running total < 50% of cap
- **WATCH** — running total 50–79% of cap
- **WARN** — running total 80–99% of cap, OR projected_total > cap
- **ALERT** — running total >= cap

### B7. Decide whether to notify

- **OK**: log only, no notification.
- **WATCH / WARN / ALERT**: send notification via `./notify`.

### B8. Format notification (for WATCH / WARN / ALERT)

Write the message to a temp file `.pending-notify-temp/spend-monitor-${today}.md` (create the dir if needed) then send with `./notify -f`.

```
*Spend Monitor — ${today}*

Week: $X.XX / $CAP.XX cap (X% used, Xd elapsed)
Projected: $X.XX by Sunday (X%)
Status: WATCH / WARN / ALERT

Top drivers:
1. skill-a — $X.XX
2. skill-b — $X.XX
3. skill-c — $X.XX

[If ALERT]: Pause candidates: <the top 2-3 cost-driver skills this week, by name>

log: memory/logs/${today}.md
```

The "Pause candidates" line is derived, not hardcoded — name the heaviest cost-driver skills from the per-skill totals in B5. Keep it tight, no corporate fluff.

Then log per the shared **Log** section below (discriminator: `watch`).

---

# Log (both branches)

Append ONE entry under a single `### cost-report` heading in `memory/logs/${today}.md`. The **first line is the discriminator** naming which branch ran, then the branch-specific bullets.

**Report branch:**
```
### cost-report
- Branch: report — last N days (gateway: {{direct|bankr}})
- Total: $X.XX across N runs
- Verdict: {{copy verdict line}}
- Anomalies flagged: M
- Monthly projection: $X.XX
- Optimization suggestions: {{count}} ({{brief list}})
- Week-over-week: +/-X% (or "no baseline")
- Pricing drift: {{none | list of unknown models}}
- Source status: csv={{ok|degraded}}, aeon.yml={{ok|missing}}
- Article: output/articles/cost-report-${today}.md
- Notification sent via ./notify
```

**Watch branch:**
```
### cost-report
- Branch: watch — weekly budget watchdog
- Week: $X.XX / $Y cap (X%) — STATUS
- Projected: $X.XX by Sunday
- Days elapsed: N
- Top driver: skill-name ($X.XX)
- Notification: sent / skipped (OK)
- SPEND_MONITOR_OK
```

## Sandbox note

Neither branch needs outbound network — both only read local files (`memory/token-usage.csv`, `aeon.yml`, and on the watch branch the optional `soul/` files). The only outbound call is `./notify`, which is already sandbox-safe. If a future version pulls the Anthropic Usage/Cost API, use WebFetch as the fallback for sandboxed curl, and cache results to `.xai-cache/` via a pre-fetch script (see CLAUDE.md).

## Constraints

**Report branch:**
- **Anomaly threshold** is intentionally conservative (µ + 2σ AND >$0.10) — cheap runs should not be flagged as noise.
- **Optimization recommendations must name a skill and an estimated dollar impact.** "Use Sonnet more" without a target skill is not useful — skip the slot instead.
- **Do not send a notification** if the CSV is missing or the window is empty — silently log and exit.
- Preserve idempotency: rerunning on the same day overwrites the article, does not append.

**Watch branch:**
- **Do not notify when status is OK** — the watchdog should be silent until spend actually warrants attention (running total < 50% of cap = OK = silent).
- **Do not notify** if the CSV is missing or the week is empty — silently log and exit.

**Both:**
- **Do not change the pricing tables** without verifying rates against Anthropic's current published pricing. The tables above are the single source of truth for both branches — update them once, both branches follow.

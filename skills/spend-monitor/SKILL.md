---
name: Spend Monitor
description: API spend watchdog — checks running cost against the configured weekly budget cap, alerts when approaching or exceeding it
var: ""
tags: [meta]
schedule: "0 12 * * *"
---
> **${var}** — Budget cap override in dollars (e.g. "250"). If empty, uses the `WEEKLY_BUDGET_CAP` env var, else defaults to $200.

Today is ${today}. Monitor this instance's running API spend for the current week and alert if costs are spiking. This is the daily complement to `cost-report` (weekly retrospective): cost-report explains *where* spend went; spend-monitor catches *runaway* spend before the week is over.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` exist and are populated, read them and match the operator's voice in the notification. Otherwise use a clear, direct, neutral tone — terse, no hedging.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| WEEKLY_BUDGET_CAP | No | Weekly spend cap in USD (default: 200) |

## Model Pricing (per million tokens)

First read `aeon.yml` and find the `gateway.provider` value. Use the matching table. Keep these rates in sync with `skills/cost-report` — they are the same tables.

### Direct Anthropic (gateway.provider: direct)

| Model | Input | Output | Cache Read | Cache Write |
|-------|-------|--------|------------|-------------|
| claude-opus-4-7 | $15.00 | $75.00 | $1.50 | $18.75 |
| claude-sonnet-4-6 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-haiku-4-5-20251001 | $0.80 | $4.00 | $0.08 | $1.00 |

### Bankr Gateway (gateway.provider: bankr)

| Model | Input | Output |
|-------|-------|--------|
| claude-opus-4-7 | $5.00 | $25.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| claude-haiku-4-5-20251001 | $0.80 | $4.00 |
| gemini-3-pro | $1.25 | $10.00 |
| gemini-3-flash | $0.15 | $0.60 |
| gpt-5.2 | $2.50 | $10.00 |
| kimi-k2.5 | $1.00 | $4.00 |
| qwen3-coder | $0.50 | $2.00 |

For Bankr, treat cache read/write as zero cost.
For any unlisted model, default to Opus pricing (conservative estimate).

## Steps

1. **Determine the budget cap.**
   - If `${var}` is a number, use it as the cap.
   - Else if `WEEKLY_BUDGET_CAP` env var is set, use that.
   - Else default to 200 (dollars). The cap is meant to be tuned per instance — raise it once a steady-state week consistently runs warm, lower it to tighten the guardrail.

2. **Determine the current week window.**
   - Current week starts on Monday. Compute `WEEK_START` = most recent Monday on or before today.
   - `WEEK_END` = today (inclusive).
   - Compute how many days have elapsed this week (1 = Monday only, 7 = full week).

3. **Read token usage data.**
   - File: `memory/token-usage.csv`
   - Columns: `date,skill,model,input_tokens,output_tokens,cache_read,cache_creation`
   - If file does not exist: log `SPEND_MONITOR_SKIP: no token-usage.csv` and stop — do NOT send any notification.
   - Filter rows where `date >= WEEK_START` and `date <= WEEK_END`.
   - If zero rows: log `SPEND_MONITOR_SKIP: no runs this week yet` and stop.

4. **Compute costs for each row.**
   - Check `aeon.yml` for `gateway.provider` (direct or bankr).
   - For each row, look up model rates and calculate:
     ```
     input_cost       = input_tokens  / 1,000,000 × rate_input
     output_cost      = output_tokens / 1,000,000 × rate_output
     cache_read_cost  = cache_read    / 1,000,000 × rate_cache_read   (0 if bankr)
     cache_write_cost = cache_creation/ 1,000,000 × rate_cache_write  (0 if bankr)
     row_cost = input_cost + output_cost + cache_read_cost + cache_write_cost
     ```

5. **Aggregate.**
   - **Running weekly total** = sum of all row_costs.
   - **Per-skill totals** = group by skill, sum costs, sort descending.
   - **Top cost driver** = skill with highest total cost this week.
   - **Projected weekly total** = (running_total / days_elapsed) × 7. Cap projection at 7 days even if week is not done.
   - **Budget usage %** = (running_total / cap) × 100.
   - **Projected budget usage %** = (projected_total / cap) × 100.

6. **Classify status.**
   - **OK** — running total < 50% of cap
   - **WATCH** — running total 50–79% of cap
   - **WARN** — running total 80–99% of cap, OR projected_total > cap
   - **ALERT** — running total >= cap

7. **Decide whether to notify.**
   - **OK**: log only, no notification.
   - **WATCH / WARN / ALERT**: send notification via `./notify`.

8. **Format notification** (for WATCH / WARN / ALERT):

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

   The "Pause candidates" line is derived, not hardcoded — name the heaviest cost-driver skills from the per-skill totals in step 5. Keep it tight, no corporate fluff.

9. **Log to `memory/logs/${today}.md`:**
   ```
   ## Spend Monitor
   - Week: $X.XX / $Y cap (X%) — STATUS
   - Projected: $X.XX by Sunday
   - Days elapsed: N
   - Top driver: skill-name ($X.XX)
   - Notification: sent / skipped (OK)
   - SPEND_MONITOR_OK
   ```

## Sandbox Note

This skill only reads local files (`memory/token-usage.csv`, `aeon.yml`) — no external network calls needed. No prefetch/postprocess wrapper required. The only outbound call is `./notify`, which is already sandbox-safe.

## Constraints
- **Do not notify when status is OK** — the watchdog should be silent until spend actually warrants attention.
- **Do not notify** if the CSV is missing or the week is empty — silently log and exit.
- Keep the pricing tables in lockstep with `skills/cost-report`. If you update one, update both.

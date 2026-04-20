---
name: cost-report
description: Weekly API cost report — computes dollar costs from token usage, flags anomalies, forecasts burn, and prescribes concrete optimizations
var: ""
tags: [meta]
version: "2.0.0"
---
<!-- autoresearch: variation B — sharper output (verdict + anomalies + burn forecast + concrete optimizations, not passive tables) -->
> **${var}** — Number of days to cover (default: 7). Pass "30" for a monthly view.

Today is ${today}. Generate a cost report from Aeon's token usage data. **The output must prescribe action, not just describe spend** — every section either names an anomaly, forecasts risk, or recommends a concrete move.

## Model Pricing (per million tokens)

First read `aeon.yml` and find the `gateway.provider` value. Use the matching table.

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

Bankr does not expose cache read/write pricing separately. Treat cache columns as $0 for Bankr rows.

If a CSV row references a model not in the active table, treat it as an **unknown model**: price it at Opus rates (conservative), add it to the "Pricing drift" callout in the report so rates can be updated, and continue. Do not crash.

## Steps

### 1. Determine the report window

- Default: 7 days. If `${var}` is a positive integer (e.g. "30"), use that many days.
- Compute `CUTOFF_DATE = today − N days`. All rows where `date >= CUTOFF_DATE` are in-window.
- If the CSV has ≥ `2 × N` days of history, also compute `PRIOR_CUTOFF = today − 2N days` for week-over-week.

### 2. Read token usage data

- File: `memory/token-usage.csv`
- Columns: `date,skill,model,input_tokens,output_tokens,cache_read,cache_creation`
- If the file is missing: log `COST_REPORT_SKIP: no token-usage.csv yet` and stop (no notification).
- If 0 rows in-window: log `COST_REPORT_SKIP: no runs in last N days` and stop.
- Parse numeric columns defensively — skip malformed rows, count them as `csv_malformed` for the source-status footer.

### 3. Compute per-row cost

For each valid in-window row, look up the model's rates and calculate:
```
input_cost       = input_tokens    / 1e6 × rate_input
output_cost      = output_tokens   / 1e6 × rate_output
cache_read_cost  = cache_read      / 1e6 × rate_cache_read
cache_write_cost = cache_creation  / 1e6 × rate_cache_write
row_cost         = input_cost + output_cost + cache_read_cost + cache_write_cost
```

### 4. Core aggregates (ground truth — keep these)

a. **Total cost** for the window (and break out input/output/cache_read/cache_write dollar shares).
b. **Per-skill** — top 10 by cost. Columns: Skill | Runs | Total Tokens | Cost | Avg Cost/Run.
c. **Per-model** — total runs, total tokens, total cost per model.
d. **Week-over-week** — only if ≥ `2N` days of history. `delta_pct = (this_window − prior_window) / prior_window`.

### 5. Decision sections (this is the point of the skill)

#### 5a. Verdict line (one sentence, top of report)

Compose one sentence that captures the week. Pattern:
> "Spent **$X.XX** across **N runs** ({{↑/↓ Y% WoW | no prior-week baseline}}); **M anomalies flagged**, projected monthly burn **~$Z.ZZ**."

#### 5b. Anomaly detection (per-skill, per-model cost spikes)

For each (skill, model) pair with ≥ 3 runs in-window:
- Compute mean µ and std-dev σ of `row_cost`.
- Flag any run where `row_cost > µ + 2σ` AND `row_cost > $0.10` (ignore sub-cent noise).
- Flag skills whose **total** cost this window is ≥ 2× the same skill's prior-window total (only if prior window exists and prior total ≥ $0.25).

Output a table: `Skill | Model | When | Run Cost | vs µ | Why (tokens_input / tokens_output / cache_write)`. If no anomalies, write "No anomalies." — do not omit the section.

#### 5c. Monthly burn forecast

- `daily_avg_cost = total_cost / N`
- `projected_monthly = daily_avg_cost × 30`
- Show: "At current rate, 30-day spend ≈ **$X.XX**."
- If projected_monthly > $50, add a "⚠ burn-rate watch" note.

#### 5d. Optimization opportunities (top 3, actionable)

Scan the in-window data and produce up to 3 concrete recommendations. Each must name (i) a specific skill, (ii) a specific change, (iii) estimated weekly savings. Candidate patterns:

- **Model downgrade**: skill runs on `claude-opus-4-7`, its median `output_tokens / input_tokens` ratio across runs is < 0.3, AND its avg run cost > $0.25. → Suggest Sonnet; savings = `this_skill_cost × (1 − sonnet_rate_mix / opus_rate_mix)`.
- **Cache underuse** *(direct gateway only)*: skill's `cache_read / (cache_read + input_tokens)` ratio < 0.2 across runs AND avg run cost > $0.10. → "Add a stable prompt prefix so Claude Code can cache it — would move ~X% of input tokens to cache_read at 10× savings."
- **Aeon.yml mismatch**: `aeon.yml` sets a `model:` override for the skill but the CSV shows runs on a different model. → "Model override drift — aeon.yml says X, runs show Y."
- **Long-tail waste**: a skill with >10 runs in-window where avg cost/run < $0.01 AND it produces no written artifact (no `articles/` file, no notification). → "Possible no-op loop."

If fewer than 3 candidates pass the filters, say so — do not pad. If zero candidates, write "No optimization levers found this week."

#### 5e. Pricing drift callout

If any CSV row referenced a model not in the active pricing table, list those model names and the total tokens attributed to them. Note: "Add rates to skills/cost-report/SKILL.md." If all rows matched, omit this block.

### 6. Write the full report

Path: `articles/cost-report-${today}.md`. If the file already exists, overwrite it (idempotent).

```markdown
# Aeon Cost Report — ${today}
*Period: last N days · gateway: {{direct|bankr}}*

> {{verdict line from 5a}}

## Anomalies
{{table from 5b, or "No anomalies."}}

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

### 7. Send notification via `./notify`

Lead with the verdict, then the top 3 actions. Keep under ~15 lines.

```
*Cost Report — ${today} (last N days)*

{{verdict line from 5a}}

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
Full: articles/cost-report-${today}.md
```

### 8. Log to `memory/logs/${today}.md`

```
## Cost Report
- Period: last N days (gateway: {{direct|bankr}})
- Total: $X.XX across N runs
- Verdict: {{copy verdict line}}
- Anomalies flagged: M
- Monthly projection: $X.XX
- Optimization suggestions: {{count}} ({{brief list}})
- Week-over-week: +/-X% (or "no baseline")
- Pricing drift: {{none | list of unknown models}}
- Source status: csv={{ok|degraded}}, aeon.yml={{ok|missing}}
- Article: articles/cost-report-${today}.md
- Notification sent via ./notify
```

## Sandbox note

No outbound network required — this skill only reads local files (`memory/token-usage.csv`, `aeon.yml`). If future versions pull the Anthropic Usage/Cost API, use WebFetch as the fallback for sandboxed curl, and cache results to `.xai-cache/` via a pre-fetch script (see CLAUDE.md).

## Constraints

- **Anomaly threshold** is intentionally conservative (µ + 2σ AND >$0.10) — cheap runs should not be flagged as noise.
- **Optimization recommendations must name a skill and an estimated dollar impact.** "Use Sonnet more" without a target skill is not useful — skip the slot instead.
- **Do not send a notification** if the CSV is missing or the window is empty — silently log and exit.
- **Do not change the pricing tables** without verifying rates against Anthropic's current published pricing.
- Preserve idempotency: rerunning on the same day overwrites the article, does not append.

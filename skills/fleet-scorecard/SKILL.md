---
name: Fleet Scorecard
description: Fleet-wide scorecard across this instance and every managed instance in memory/instances.json — runs, tokens (OpenRouter shape), est. cost, skills, and reliability, with deltas vs the previous run and alerts
schedule: "0 13 * * *"
tags: [meta, fleet, report, cost]
---

Today is ${today}. Publish the daily **fleet scorecard** to `memory/scorecard.md` and append a trend row to `memory/scorecard-history.csv`.

The fleet is **discovered at runtime, never hardcoded**: it is this repo ("self") plus every non-archived entry in `memory/instances.json` (the registry `fleet-control` and `spawn-instance` maintain). With zero managed instances the scorecard simply covers the single self repo — still useful.

All data has already been gathered by `scripts/prefetch-fleet-scorecard.sh` (which ran outside the sandbox with network/`gh` access). **You do not need network or `gh`** — work only from the prefetched files below.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` exist and are populated, read them and match the operator's voice in the notification (step 6). If they are empty templates or absent, use a clear, direct, neutral tone — terse, lowercase, no fluff.

## Inputs (prefetched — read these)

- `/tmp/fleet-scorecard/scorecard-body.md` — the computed markdown tables (Fleet totals, Per-repo, Top skills by cost, Least reliable skills). These numbers are authoritative — **do not recompute or alter them.**
- `/tmp/fleet-scorecard/metrics.json` — today's key totals: `total_runs, total_failures, generations, prompt_tokens, cached_tokens, completion_tokens, total_tokens, est_cost_usd, cache_discount_usd`.

If `/tmp/fleet-scorecard/scorecard-body.md` is missing or empty, the prefetch failed or resolved an empty fleet — write a one-line note to `/tmp/skill-result.txt` saying so and stop (do not overwrite the existing scorecard, do not notify).

## Steps

### 1. Load today's metrics and yesterday's baseline

- Read `/tmp/fleet-scorecard/metrics.json` (today).
- Read the **last row** of `memory/scorecard-history.csv` if it exists (the previous run's metrics) to compute deltas. If the file doesn't exist yet, this is the first run — deltas are "—".

### 2. Compute day-over-day deltas

For `total_runs`, `total_failures`, `generations`, `total_tokens`, `est_cost_usd`, `cache_discount_usd`, compute `today − previous`. Format as signed (e.g. `+312 runs`, `+$148`, `+5 failures`). These are cumulative all-time figures, so deltas show the last ~24h of activity.

### 3. Build the Alerts block

Scan the computed tables in `scorecard-body.md` and flag:
- Any skill in **"Least reliable skills (last 14d)"** with **fail rate ≥ 25%** (call it out by name + repo + rate). That table is already windowed to 14 days, so long-resolved incidents won't trigger false alarms — anything listed there is a *current* problem worth surfacing.
- Any **cost spike**: `est_cost_usd` delta > 1.5× the median daily delta from history (if ≥7 history rows exist), or just note the day's cost increase otherwise.
- If `total_failures` rose by **more than 10** since yesterday, flag it.
- If no issues, write `✅ No anomalies — fleet healthy.`

### 4. Write `memory/scorecard.md`

Structure (overwrite the file):

```
# 🛰️ Aeon Fleet Scorecard — as of ${today}

_Auto-generated daily by skills/fleet-scorecard. Tokens reported OpenRouter-style (cached_tokens ⊆ prompt_tokens)._

## Since last update (~24h)
| Metric | Δ |
|---|---:|
| Runs | <signed> |
| Failures | <signed> |
| Generations | <signed> |
| Total tokens | <signed, humanized> |
| Est. cost | <signed $> |
| Cache discount | <signed $> |

## Alerts
<the alerts block from step 3>

<PASTE the full contents of /tmp/fleet-scorecard/scorecard-body.md verbatim here>

---
_Sources: GitHub Actions run history + each repo's `memory/token-usage.csv`. Fleet resolved from memory/instances.json + self. Cost = Anthropic list price (estimate)._
```

### 5. Append the trend row

Append one line to `memory/scorecard-history.csv` (create with a header if it doesn't exist):

```
date,total_runs,total_failures,generations,prompt_tokens,cached_tokens,completion_tokens,total_tokens,est_cost_usd,cache_discount_usd
```

Use `${today}` for the date and the values straight from `metrics.json`. **Append, never rewrite** prior rows.

### 6. Notify

Write a terse daily pulse to `/tmp/scorecard-notify.md` and send it with `./notify -f /tmp/scorecard-notify.md`. One short paragraph — today's totals (runs, est. cost, total tokens), the headline deltas, and any alert. Example shape: _"fleet at 12.5k runs, ~$7.8k notional. +312 runs / +$148 since yesterday. cost-report still failing (88% fail). caching saved ~$43k."_ Also copy this text to `/tmp/skill-result.txt` so the framework captures it.

### 7. Memory log

Append a one-line entry to `memory/logs/${today}.md` noting the scorecard ran and the headline numbers (so future skills like self-review/reflect see it).

## Notes
- Numbers come only from the prefetched files — never invent or estimate figures yourself.
- The scorecard is cumulative/all-time; the deltas are what make the daily run useful.
- GitHub Actions retains runs ~90 days, so the run history is a rolling window; the token CSVs are the durable record committed in each repo.

## Sandbox Note
This skill needs no network inside the sandbox — all `gh`/API work happens in `scripts/prefetch-fleet-scorecard.sh`, which runs in the workflow's prefetch phase with `gh` auth. If the prefetch's cross-repo reads fail for a managed instance, it's almost always the GitHub token scope (the token needs read access to that instance's repo; self is always readable). The prefetch degrades gracefully — a repo it can't read is simply absent from the tables rather than crashing the run.

## Required Env Vars
None for the skill itself. `scripts/prefetch-fleet-scorecard.sh` uses `GH_TOKEN`/`GITHUB_TOKEN` (provided by the workflow) and reads `GITHUB_REPOSITORY` to resolve "self".

## Output
End with a `## Summary` listing the files written (`memory/scorecard.md`, `memory/scorecard-history.csv`, the log entry) and any alerts raised.

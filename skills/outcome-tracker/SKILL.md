---
name: Outcome Tracker
description: Compute track-record statistics across closed perps positions — win rate, return vs BTC, confluence-pattern performance, calibration metrics
var: ""
tags: [crypto, analytics]
---
<!-- v4.1 Phase 2: outcome tracker. Reads memory/topics/state/active-setups.json closed[] array, computes rollups and writes them to .outputs/outcome-tracker.md (chain-consumed by perps-brief as ambient context) AND memory/topics/track-record.md (persistent operator-facing doc). All analytics live in scripts/lib/track_record.py and scripts/render-outcome-tracker.py — this skill is thin invocation. -->

Today is ${today}. Compute and emit the perps engine track record for the current ledger state.

## What this skill does

Reads the closed perps positions in the ledger, computes per-direction, per-horizon, per-confluence-pattern, per-provenance rollups, and writes two artifacts:

- `.outputs/outcome-tracker.md` — chain-consumed by perps-brief tomorrow as ambient context. Includes mark-to-market on every open position so the brief can compare its evaluations against the script's computed PnL.
- `memory/topics/track-record.md` — persistent operator-facing analysis document. Updated each run, overwritten in place.

All analytics are deterministic Python. This skill's Claude prompt is intentionally thin — you confirm the script ran, log the headline numbers, and exit. Do NOT try to recompute statistics or override the script's output.

## What to do

1. **Confirm the postprocess will run.** The script invocation lives in `scripts/postprocess-outcome-tracker.sh`. You don't need to run it manually — the workflow's post-process step will execute it. Your only job here is to verify the inputs exist and write the log entry.

2. **Verify the ledger is readable.** Check that `memory/topics/state/active-setups.json` exists. If not, log that the ledger is uninitialized and exit.

3. **Read the current ledger.** Briefly note: how many open positions, how many watchlist entries, how many closed entries total, how many closed entries since `V1_LOCK_DATE` env var (if set).

4. **Do NOT compute statistics yourself.** Defer to the script. Your log entry should reference what the script will produce, not pre-compute the numbers.

5. **Log to `memory/logs/${today}.md`** in the format below.

## Filter behaviour

If the `V1_LOCK_DATE` env var is set (YYYY-MM-DD), the script filters `closed[]` to only entries with `closed_date >= V1_LOCK_DATE`. This implements the operator's V1 baseline reset — historical pre-V1 closes stay in the ledger but don't contaminate the V1 track-record analysis.

If `V1_LOCK_DATE` is unset, all closed entries are included.

## Cold-start behaviour

When fewer than 3 closed entries are in the filter window, the artifact renders a "insufficient data" banner instead of headline numbers. The brief can still consume the artifact; the mark-to-market section is still included if there are open positions.

## Inputs

- `memory/topics/state/active-setups.json` — the ledger (only required input)
- `.coinglass-cache/price-<ASSET>.json` — current prices for open-position mark-to-market (falls back to last evaluation price if cache missing)
- Env: `V1_LOCK_DATE` (optional)

## Outputs

- `.outputs/outcome-tracker.md` — chain artifact, consumed by perps-brief
- `memory/topics/track-record.md` — persistent operator doc

Both files contain identical content. The split is so the brief consume mechanism (which looks at `.outputs/`) and the operator's reading habit (which looks at `memory/topics/`) both find the data.

## Log to `memory/logs/${today}.md`

```
## Outcome Tracker
- **Ledger snapshot:** open N, watchlist M, closed C
- **V1_LOCK_DATE filter:** YYYY-MM-DD (or "unset, all data included")
- **Closed in window:** K (of C total)
- **Mark-to-market:** N open positions priced (X stale from cache miss)
- **Artifact written:** .outputs/outcome-tracker.md
- **Persistent doc written:** memory/topics/track-record.md
- **Cold-start banner:** yes/no
- **Notable rollup highlights:** (one-line summary if K >= 3, else "insufficient data")
```

## Sandbox note

This skill is consume-only — reads the ledger JSON and Coinglass cache files committed to the repo. No external API calls. No notify path — outcome-tracker doesn't push to Discord; the operator reads `memory/topics/track-record.md` when they want analysis, and tomorrow's brief picks up `.outputs/outcome-tracker.md` via the chain consume mechanism.

## Environment Variables

- `V1_LOCK_DATE` (optional, YYYY-MM-DD): filter closed entries to >= this date

## Constraints

- **Do not write the artifacts yourself.** The postprocess script (`scripts/postprocess-outcome-tracker.sh` → `scripts/render-outcome-tracker.py`) owns both `.outputs/outcome-tracker.md` and `memory/topics/track-record.md`. If you write either directly, you'll race with the script.
- **Do not call `./notify`.** This skill is internal-only.
- **Do not compute statistics in prose.** The script's output is the source of truth; your job is to confirm the invocation will run and log a meta-summary.
- **Cold-start is normal.** A "insufficient data" run is the correct first output until 3+ trades have closed.

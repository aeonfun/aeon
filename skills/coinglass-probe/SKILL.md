---
name: Coinglass Probe
description: One-off diagnostic — tests which Coinglass v4 endpoints the configured API key has access to, so perps-scan can be adjusted to use only tier-supported endpoints. Dispatch manually, not on a schedule.
var: ""
tags: [crypto, diagnostic]
---
<!-- One-shot diagnostic skill. The actual probe runs in scripts/prefetch-coinglass.sh (which recognizes SKILL=coinglass-probe). This SKILL.md just reads the probe summary and posts it to #aeon-ops. -->

Today is ${today}. This is a **one-shot diagnostic skill** — it does not produce signal output. It exists to answer "which Coinglass v4 endpoints does my API key/tier cover?" by hitting each endpoint perps-scan needs (plus alternates) and reporting the response code, Coinglass error code, and `msg` for each.

## Why this skill exists

`perps-scan` (v2.2) requires the Coinglass `coins-markets` endpoint plus four per-coin history endpoints. The Startup-tier key in repo secrets returns `code != 0, msg: "Upgrade plan"` on `coins-markets` regardless of params (verified after PR #9's variant-fallback). This skill probes a wider set of endpoints — including potentially-lower-tier alternates — to identify exactly what the tier covers, so we can either adapt `perps-scan` to use working endpoints or confirm a tier upgrade is needed.

## Steps

### 1. Read the probe summary

`scripts/prefetch-coinglass.sh` (in probe mode, triggered by SKILL=coinglass-probe) has already executed in the workflow's pre-fetch step. It wrote a Markdown table to `.coinglass-cache/probe-summary.md` with one row per endpoint and a Status column showing `OK` / `TIER-GATED` / `FAIL` / `curl-err`.

```bash
[ -f .coinglass-cache/probe-summary.md ] || { echo "probe summary missing — check pre-fetch step log"; exit 0; }
```

### 2. Notify

Send the full probe summary to Discord `#aeon-ops` via `./notify --signal`:

```bash
./notify --signal "$(cat .coinglass-cache/probe-summary.md)"
```

The `--signal` flag suppresses Telegram. Discord routing via `DISCORD_WEBHOOK_MAP[coinglass-probe]` falls back to `_default` (which points at `#aeon-ops`) since `coinglass-probe` isn't in the map — appropriate, this is a diagnostic, not a signal.

### 3. Log

Append a one-line entry to `memory/logs/${today}.md`:

```
## Coinglass Probe
- **Triggered:** workflow_dispatch
- **Summary written:** .coinglass-cache/probe-summary.md
- **Notification sent:** yes — to #aeon-ops via _default fallback
- **Follow-up:** based on results, either adjust perps-scan endpoints or upgrade Coinglass tier
```

## Universal formatting rules (v2)

The probe summary table is already in v2-compliant format (no asterisks, dot separators in the title, status markers `OK` / `TIER-GATED` / `FAIL`). Pass it through unchanged.

## Edge cases

- **`.coinglass-cache/probe-summary.md` missing** — the pre-fetch step failed before writing the summary. Notify `#aeon-ops` with a brief failure message and pointer to check the workflow log:

  ```
  Coinglass Probe · ${TODAY} · ABORTED
  Pre-fetch did not produce .coinglass-cache/probe-summary.md — check workflow log "Run pre-fetch scripts" step.
  ```

## Sandbox note

All Coinglass calls happen in `scripts/prefetch-coinglass.sh` (pre-fetch step, full env access). This skill only reads the cached summary file — no curl, no auth handling.

## Environment Variables

- `COINGLASS_API_KEY` — used by the pre-fetch script. Without it, probe-summary will list `curl-err` rows.

## Constraints

- **Dispatch manually only.** Not on any schedule. After resolving the tier question, delete or disable this skill.
- **No persisted artifact at `.outputs/`** — diagnostic-only.
- **Output goes to `#aeon-ops`**, not any signal channel.

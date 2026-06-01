#!/usr/bin/env bash
# Post-process for perps-brief (v4.1).
#
# Pipeline:
#   1. Render JSON → markdown        (scripts/render-perps-brief.py)
#   2. Snapshot the ledger           (pre-apply backup)
#   3. Apply ledger operations       (scripts/apply-ledger-ops.py)
#   4. Validate ledger post-apply    (python3 -m lib.ledger)
#   5. Bot embed delivery            (scripts/embed-perps-brief.py)
#
# Decommissioned (2026-05-30):
#   - Webhook mono-space chunked delivery to #perps. The five-channel
#     bot embed delivery (step 5) is the sole operator-facing output now.
#     scripts/render-perps-brief.py still runs in step 1 because
#     downstream chain consumers (morning-macro, daily-ops-review) read
#     .outputs/perps-brief.md as their input.
#
# v4.1 changes from v4:
#   - Step 5 splits the brief by section divider, pre-chunks each section
#     to fit Discord's 2000-char limit (including code-block wrappers),
#     and writes each chunk directly to .pending-notify/ with a unique
#     filename. The post-run "Send pending notifications" step picks them
#     up and delivers each as its own Discord message.
#   - We bypass ./notify for these sends because ./notify builds pending
#     filenames as $(date +%s) — when multiple sends happen in the same
#     second they collide and overwrite each other. Writing directly with
#     counter-suffixed filenames avoids the collision.
#   - Title + MARKET SENTIMENT combined into the first section message.

set -euo pipefail

# Skill-name guard. The workflow's "Run post-process scripts" step loops
# through ALL scripts/postprocess-*.sh files for every skill's workflow,
# not just perps-brief's. Without this guard, every step-1 skill workflow
# (narrative-tracker, token-call, monitor-runners, etc.) would re-process
# the perps-brief.data.json that's on main from the previous chain run,
# write new pending files, and the host workflow's Send pending
# notifications step would deliver them to THAT skill's Discord channel
# via DISCORD_WEBHOOK_MAP[$SKILL_NAME] — broadcasting the perps-brief
# content across the whole chain's channel set. Bail early when this
# script is executing inside a non-perps-brief workflow.
if [ "${SKILL_NAME:-}" != "perps-brief" ]; then
  echo "postprocess-perps-brief: skipping (SKILL_NAME='${SKILL_NAME:-}', not perps-brief)"
  exit 0
fi

JSON_PATH=".outputs/perps-brief.data.json"
MD_PATH=".outputs/perps-brief.md"
LEDGER_PATH="memory/topics/state/active-setups.json"

# CHAIN_SLOT: prefer the value set by the workflow's "Compute CHAIN_SLOT"
# step (which runs BEFORE Claude so the brief composer can read it). Fall
# back to local computation if invoked outside the workflow.
#
# Bucketing rule (must match aeon.yml's Compute CHAIN_SLOT step):
#   18:00-06:00 UTC → AM slot
#   06:00-18:00 UTC → PM slot
#
# Why the wider 6-hour bucket on each side instead of simple noon bisection:
# crons in chain-runner.yml are shifted 3h30m earlier (20:30 + 08:30 UTC)
# to compensate for GitHub Actions' fork-throttle delay. With measured
# variance of ±1h42m, AM runs can land in 22:57-00:39 UTC — straddling
# midnight. The wider bucket handles this correctly.
if [ -z "${CHAIN_SLOT:-}" ]; then
  HOUR_UTC=$(date -u +%H)
  if [ "$HOUR_UTC" -ge 18 ] || [ "$HOUR_UTC" -lt 6 ]; then
    export CHAIN_SLOT=am
  else
    export CHAIN_SLOT=pm
  fi
  echo "postprocess-perps-brief: chain slot computed locally = $CHAIN_SLOT (UTC hour $HOUR_UTC)"
else
  echo "postprocess-perps-brief: chain slot from workflow env = $CHAIN_SLOT"
fi

if [ ! -f "$JSON_PATH" ]; then
  echo "postprocess-perps-brief: $JSON_PATH not present, skipping"
  exit 0
fi

if [ ! -f "scripts/render-perps-brief.py" ]; then
  echo "::error::postprocess-perps-brief: scripts/render-perps-brief.py missing"
  exit 1
fi

if [ ! -f "scripts/apply-ledger-ops.py" ]; then
  echo "::error::postprocess-perps-brief: scripts/apply-ledger-ops.py missing"
  exit 1
fi

# Step 1 — Render
echo "postprocess-perps-brief: step 1/5 — render"
if ! python3 scripts/render-perps-brief.py; then
  echo "::error::postprocess-perps-brief: render failed; ledger untouched, no notify"
  exit 1
fi

# Step 2 — Snapshot ledger
echo "postprocess-perps-brief: step 2/5 — snapshot ledger"
if [ -f "$LEDGER_PATH" ]; then
  python3 - <<'PY'
import os, sys
sys.path.insert(0, "scripts")
from lib import ledger as L
try:
    # snapshot() reads CHAIN_SLOT from env when slot is not passed —
    # filename ends up as active-setups.YYYY-MM-DD-{am|pm}.json so the
    # PM run doesn't overwrite the AM snapshot on the same calendar day.
    target = L.snapshot()
    print(f"postprocess-perps-brief: snapshot → {target}")
except L.LedgerError as e:
    sys.stderr.write(f"postprocess-perps-brief: snapshot failed: {e}\n")
    sys.exit(1)
PY
else
  echo "postprocess-perps-brief: ledger does not exist yet; skipping snapshot"
fi

# Step 3 — Apply ledger ops
echo "postprocess-perps-brief: step 3/5 — apply ledger ops"
if ! python3 scripts/apply-ledger-ops.py; then
  echo "::error::postprocess-perps-brief: apply-ledger-ops failed; ledger untouched"
  echo "::warning::postprocess-perps-brief: continuing to notify — brief artifact is valid"
fi

# Step 4 — Validate ledger post-apply
echo "postprocess-perps-brief: step 4/5 — validate ledger"
if [ -f "$LEDGER_PATH" ]; then
  if ! ( cd scripts && python3 -m lib.ledger "../$LEDGER_PATH" ); then
    echo "::error::postprocess-perps-brief: ledger post-apply validation FAILED — restore from memory/topics/state/snapshots/"
  fi
fi

# Step 4.5 — Persist Claude's reasoning traces (sidecar file)
#
# perps-brief now writes a structured "why" record for each decision to
# .outputs/perps-brief.traces.json alongside the main data.json. We
# extract those and append them to the rolling 60-day history at
# memory/topics/state/judgement-trace.json so Claude can read its own
# past reasoning on the same asset in future runs. This is the
# intuition-building substrate — outcomes are tracked elsewhere
# (outcome-tracker, judgement-audit); the trace file captures WHY
# Claude weighted things the way it did.
#
# Schema and validation enforced by scripts/lib/judgement_trace.py.
# Bad/malformed trace entries are logged and skipped — they never block
# the chain.
TRACES_PATH=".outputs/perps-brief.traces.json"
if [ -f "$TRACES_PATH" ]; then
  echo "postprocess-perps-brief: step 4.5/5 — persist reasoning traces"
  python3 - <<'PY' || echo "::warning::postprocess-perps-brief: trace persistence exited non-zero (non-fatal)"
import json
import sys
from pathlib import Path

sys.path.insert(0, "scripts")
from lib import judgement_trace as JT

TRACES_PATH = Path(".outputs/perps-brief.traces.json")

try:
    traces_payload = json.loads(TRACES_PATH.read_text())
except (json.JSONDecodeError, OSError) as e:
    sys.stderr.write(f"postprocess-perps-brief: traces file unreadable: {e}\n")
    sys.exit(0)

# Accept either a bare list or {"traces": [...]} envelope so Claude has
# a small amount of room to misformat without breaking the chain.
if isinstance(traces_payload, dict):
    traces_list = traces_payload.get("traces", [])
elif isinstance(traces_payload, list):
    traces_list = traces_payload
else:
    sys.stderr.write("postprocess-perps-brief: traces payload must be array or {traces: array}\n")
    sys.exit(0)

if not traces_list:
    print("postprocess-perps-brief: no traces in payload, skipping persistence")
    sys.exit(0)

history = JT.load()
appended = 0
errored = 0
for t in traces_list:
    try:
        JT.append(history, t)
        appended += 1
    except JT.JudgementTraceError as e:
        sys.stderr.write(f"postprocess-perps-brief: WARN trace skipped: {e}\n")
        errored += 1

try:
    JT.save(history)
    print(f"postprocess-perps-brief: traces persisted — appended={appended} errored={errored}")
except JT.JudgementTraceError as e:
    sys.stderr.write(f"postprocess-perps-brief: ERROR history save: {e}\n")
    sys.exit(1)
PY
  # Validate post-save
  ( cd scripts && python3 -m lib.judgement_trace "../memory/topics/state/judgement-trace.json" ) \
    || echo "::warning::postprocess-perps-brief: judgement-trace post-save validation failed"
else
  echo "postprocess-perps-brief: no $TRACES_PATH — Claude did not emit traces this run, skipping persistence"
fi

# Step 5 — Bot embed delivery (sole operator-facing output)
#
# Posts structured embeds to the per-section channels via the Stage 3
# edit-in-place driver. The legacy webhook mono-space chunked delivery
# was decommissioned 2026-05-30 — those embeds are the only path now.
#
# Gating:
#   - DISCORD_BOT_TOKEN unset AND DISCORD_BOT_DRY_RUN unset → skip entirely
#   - DISCORD_BOT_DRY_RUN=1 → dry-run (prints embed JSON to stderr,
#     no API calls). Use to preview embeds in workflow logs without
#     touching live channels.
#   - DISCORD_BOT_TOKEN set → live POST/EDIT/DELETE on Discord.
#
# Failure is best-effort: log a warning and exit 0. The brief artifact
# (.outputs/perps-brief.md) is still on disk for downstream chain
# consumers regardless of whether bot delivery succeeded.
echo "postprocess-perps-brief: step 5/5 — bot embed delivery"

if [ ! -f "scripts/embed-perps-brief.py" ]; then
  echo "postprocess-perps-brief: embed-perps-brief.py missing — skipping bot delivery"
elif [ -z "${DISCORD_BOT_TOKEN:-}" ] && [ "${DISCORD_BOT_DRY_RUN:-}" != "1" ]; then
  echo "postprocess-perps-brief: DISCORD_BOT_TOKEN unset and DRY_RUN off — skipping bot delivery"
else
  BOT_MODE="--live"
  if [ "${DISCORD_BOT_DRY_RUN:-}" = "1" ]; then
    BOT_MODE="--dry-run"
    echo "postprocess-perps-brief: bot dry-run requested via DISCORD_BOT_DRY_RUN=1"
  fi
  if ! python3 scripts/embed-perps-brief.py "$BOT_MODE"; then
    echo "::warning::postprocess-perps-brief: bot embed delivery exited non-zero (non-fatal — webhook path already delivered)"
  fi
fi

echo "postprocess-perps-brief: done."

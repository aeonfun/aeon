#!/usr/bin/env bash
# Post-process for narrative-tracker.
#
# Pipeline:
#   1. Apply ops to narratives ledger (scripts/apply-narrative-ops.py)
#   2. Validate ledger post-apply
#   3. Bot embed delivery (scripts/embed-narrative-tracker.py)
#
# Skill-name guard: the workflow loops scripts/postprocess-*.sh for every
# skill dispatch, so bail early when this script runs in a non-
# narrative-tracker workflow.

set -euo pipefail

if [ "${SKILL_NAME:-}" != "narrative-tracker" ]; then
  echo "postprocess-narrative-tracker: skipping (SKILL_NAME='${SKILL_NAME:-}', not narrative-tracker)"
  exit 0
fi

DATA_JSON=".outputs/narrative-tracker.data.json"
NARRATIVES_PATH="memory/topics/state/narratives.json"

if [ ! -f "$DATA_JSON" ]; then
  echo "postprocess-narrative-tracker: $DATA_JSON not present — Claude may have written only the .md artifact (legacy/skip-day). Nothing to apply."
  exit 0
fi

if [ ! -f "scripts/apply-narrative-ops.py" ]; then
  echo "::error::postprocess-narrative-tracker: scripts/apply-narrative-ops.py missing"
  exit 1
fi

if [ ! -f "scripts/embed-narrative-tracker.py" ]; then
  echo "::error::postprocess-narrative-tracker: scripts/embed-narrative-tracker.py missing"
  exit 1
fi

# Step 1 — apply ops
echo "postprocess-narrative-tracker: step 1/3 — apply ops"
if ! python3 scripts/apply-narrative-ops.py; then
  echo "::error::postprocess-narrative-tracker: apply-narrative-ops failed; ledger may be in an inconsistent state"
fi

# Step 2 — validate
echo "postprocess-narrative-tracker: step 2/3 — validate ledger"
if [ -f "$NARRATIVES_PATH" ]; then
  if ! ( cd scripts && python3 -m lib.narratives "../$NARRATIVES_PATH" ); then
    echo "::error::postprocess-narrative-tracker: ledger validation FAILED"
  fi
fi

# Step 3 — bot embed delivery
# Gating mirrors the other postprocess scripts:
#   - DISCORD_BOT_TOKEN unset AND DISCORD_BOT_DRY_RUN unset → skip
#   - DISCORD_BOT_DRY_RUN=1 → dry-run, no API calls
#   - DISCORD_BOT_TOKEN set → live POST/EDIT/DELETE
echo "postprocess-narrative-tracker: step 3/3 — bot embed delivery"
if [ -z "${DISCORD_BOT_TOKEN:-}" ] && [ "${DISCORD_BOT_DRY_RUN:-}" != "1" ]; then
  echo "postprocess-narrative-tracker: DISCORD_BOT_TOKEN unset and DRY_RUN off — skipping bot delivery"
  exit 0
fi

BOT_MODE="--live"
if [ "${DISCORD_BOT_DRY_RUN:-}" = "1" ]; then
  BOT_MODE="--dry-run"
  echo "postprocess-narrative-tracker: dry-run requested via DISCORD_BOT_DRY_RUN=1"
fi

if ! python3 scripts/embed-narrative-tracker.py "$BOT_MODE"; then
  echo "::warning::postprocess-narrative-tracker: embed delivery exited non-zero (non-fatal)"
fi

echo "postprocess-narrative-tracker: done"

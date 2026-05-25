#!/usr/bin/env bash
# Post-process for outcome-tracker.
#
# This skill is fully deterministic — the Python script does all the work.
# The postprocess just invokes the renderer. Claude's role in the skill is
# minimal: confirm the script ran and write a brief log entry.
#
# Skill-name guard (same pattern as perps-brief): the workflow's "Run
# post-process scripts" step runs every postprocess script in every skill's
# workflow. Without this guard the outcome-tracker render would re-run
# in every skill's workflow, overwriting the artifact each time.

set -euo pipefail

if [ "${SKILL_NAME:-}" != "outcome-tracker" ]; then
  echo "postprocess-outcome-tracker: skipping (SKILL_NAME='${SKILL_NAME:-}', not outcome-tracker)"
  exit 0
fi

if [ ! -f "scripts/render-outcome-tracker.py" ]; then
  echo "::error::postprocess-outcome-tracker: scripts/render-outcome-tracker.py missing"
  exit 1
fi

echo "postprocess-outcome-tracker: running render"
python3 scripts/render-outcome-tracker.py

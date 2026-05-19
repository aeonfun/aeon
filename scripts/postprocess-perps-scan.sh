#!/usr/bin/env bash
# Render .outputs/perps-scan.md deterministically from the structured JSON
# intermediate written by the perps-scan skill. Replaces the previous design
# where Claude wrote the markdown directly (which hit ISS-003/ISS-004 three
# times in one day — Claude conflated artifact-write with end-of-task Summary).
#
# This script is invoked by the workflow's `Run post-process scripts` step
# for every skill. It gates itself on the presence of the JSON intermediate,
# so it's a no-op for any skill that isn't perps-scan.
#
# On JSON validation failure: writes a `scan unavailable, render failed`
# artifact and exits non-zero so daily-ops-review surfaces the problem.

set -euo pipefail

JSON_PATH=".outputs/perps-scan.data.json"

if [ ! -f "$JSON_PATH" ]; then
  echo "postprocess-perps-scan: $JSON_PATH not present, skipping (not a perps-scan run)"
  exit 0
fi

if [ ! -f "scripts/render-perps-scan.py" ]; then
  echo "::error::postprocess-perps-scan: scripts/render-perps-scan.py missing"
  exit 1
fi

python3 scripts/render-perps-scan.py

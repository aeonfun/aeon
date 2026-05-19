#!/usr/bin/env bash
# Render .outputs/perps-brief.md deterministically from the structured JSON
# intermediate written by the perps-brief skill, then queue the rendered
# markdown for Discord delivery via ./notify --signal.
#
# Closes the ISS-004 recurrence in perps-brief: the skill no longer writes
# the markdown artifact directly (which produced the assistant ## Summary
# blob three times in one day), and no longer calls ./notify itself (so
# the notify content cannot diverge from the artifact content).
#
# Order of operations within this script:
#   1. Render JSON → markdown via scripts/render-perps-brief.py
#   2. Queue the rendered content via ./notify --signal "$(cat ...)"
#
# This script depends on running BEFORE the workflow's "Send pending
# notifications" step (so ./notify's pending-file fallback gets retried).
# The workflow YAML places "Run post-process scripts" immediately before
# "Send pending notifications" for exactly this reason.

set -euo pipefail

JSON_PATH=".outputs/perps-brief.data.json"
MD_PATH=".outputs/perps-brief.md"

if [ ! -f "$JSON_PATH" ]; then
  echo "postprocess-perps-brief: $JSON_PATH not present, skipping (not a perps-brief run)"
  exit 0
fi

if [ ! -f "scripts/render-perps-brief.py" ]; then
  echo "::error::postprocess-perps-brief: scripts/render-perps-brief.py missing"
  exit 1
fi

python3 scripts/render-perps-brief.py

# ./notify is generated into the workspace by the workflow's main run step.
# It's always present by the time postprocess runs. The --signal flag
# routes to Discord-only (skip Telegram) per the v2 signal architecture.
if [ ! -x ./notify ]; then
  echo "::error::postprocess-perps-brief: ./notify is missing or not executable — cannot queue Discord delivery"
  exit 1
fi

if [ ! -s "$MD_PATH" ]; then
  echo "postprocess-perps-brief: $MD_PATH is empty after render, nothing to notify"
  exit 0
fi

echo "postprocess-perps-brief: queuing $(wc -c < "$MD_PATH" | tr -d ' ')-byte brief for Discord delivery"
./notify --signal "$(cat "$MD_PATH")" || {
  echo "::warning::postprocess-perps-brief: ./notify exited non-zero — Send pending notifications will retry"
}

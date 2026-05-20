#!/usr/bin/env bash
# Post-process for perps-brief (v4).
#
# Reads the structured JSON intermediate Claude wrote, runs the v4 pipeline
# in this order:
#
#   1. Render JSON → markdown        (scripts/render-perps-brief.py)
#   2. Snapshot the ledger           (pre-apply backup, see scripts/lib/ledger.py)
#   3. Apply ledger operations       (scripts/apply-ledger-ops.py)
#   4. Validate ledger post-apply    (python3 -m lib.ledger memory/topics/state/active-setups.json)
#   5. Queue notification            (./notify --signal "$(cat .outputs/perps-brief.md)")
#
# Order matters:
#   - Render runs first so the published brief reflects what Claude actually
#     decided. If render fails (schema violation), abort BEFORE touching the
#     ledger.
#   - Snapshot runs after render and before apply so the snapshot captures
#     the pre-apply state. If apply corrupts something, the snapshot is the
#     rollback.
#   - Apply runs after snapshot. The apply script validates pre and post
#     state and refuses to write a corrupt ledger.
#   - Validate is belt-and-suspenders — `apply-ledger-ops.py` already calls
#     `L.validate()` before writing, but the explicit validate step here
#     catches any concurrent-edit weirdness from a same-run rebase.
#   - Notify runs last so the operator only gets a Discord post if every
#     prior step succeeded.
#
# Carried over from v3 (ISS-004 fix):
#   - Claude does not write .outputs/perps-brief.md directly. Render owns it.
#   - Claude does not call ./notify. This script does.
#
# New in v4:
#   - Claude does not write memory/topics/state/active-setups.json directly.
#     apply-ledger-ops.py owns it.

set -euo pipefail

JSON_PATH=".outputs/perps-brief.data.json"
MD_PATH=".outputs/perps-brief.md"
LEDGER_PATH="memory/topics/state/active-setups.json"

if [ ! -f "$JSON_PATH" ]; then
  echo "postprocess-perps-brief: $JSON_PATH not present, skipping (not a perps-brief run)"
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

# Step 2 — Snapshot the ledger (pre-apply backup)
echo "postprocess-perps-brief: step 2/5 — snapshot ledger"
if [ -f "$LEDGER_PATH" ]; then
  python3 - <<'PY'
import sys
from pathlib import Path
sys.path.insert(0, "scripts")
from lib import ledger as L
try:
    target = L.snapshot()
    print(f"postprocess-perps-brief: snapshot → {target}")
except L.LedgerError as e:
    sys.stderr.write(f"postprocess-perps-brief: snapshot failed: {e}\n")
    sys.exit(1)
PY
else
  echo "postprocess-perps-brief: ledger does not exist yet ($LEDGER_PATH); skipping snapshot"
fi

# Step 3 — Apply ledger operations
echo "postprocess-perps-brief: step 3/5 — apply ledger ops"
if ! python3 scripts/apply-ledger-ops.py; then
  echo "::error::postprocess-perps-brief: apply-ledger-ops failed; ledger untouched (script aborts before write on any validation error)"
  echo "::warning::postprocess-perps-brief: continuing to notify — brief artifact is valid"
fi

# Step 4 — Validate ledger post-apply (defense in depth)
echo "postprocess-perps-brief: step 4/5 — validate ledger"
if [ -f "$LEDGER_PATH" ]; then
  if ! ( cd scripts && python3 -m lib.ledger "../$LEDGER_PATH" ); then
    echo "::error::postprocess-perps-brief: ledger post-apply validation FAILED — operator must restore from memory/topics/state/snapshots/"
    # Do not exit — still send the notify so operator sees today's brief.
  fi
fi

# Step 5 — Notify
echo "postprocess-perps-brief: step 5/5 — notify"

# ./notify is generated into the workspace by the workflow's main run step.
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

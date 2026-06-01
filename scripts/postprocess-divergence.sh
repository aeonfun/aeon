#!/usr/bin/env bash
# Post-process — append the current chain's divergence snapshots to the
# rolling history file at memory/topics/state/divergence-history.json.
#
# The prefetch wrote one .divergence-cache/{ASSET}.json file per asset
# in the universe. This script collects those snapshots and persists
# them so Claude has a 30-day rolling window to compare current readings
# against — that's the "data, not thresholds" intuition layer.
#
# Skill-name guard: postprocess scripts run for every skill dispatch,
# so bail early when this isn't a divergence-consumer.

set -euo pipefail

# Gate to perps-scan + engine-poller only. perps-brief is a divergence
# CONSUMER (reads .divergence-cache/ via its own prefetch run), but if its
# postprocess also wrote to history we'd capture a near-duplicate snapshot
# 2-5 minutes after perps-scan's. perps-scan is the canonical write
# point for the AM + PM chain slots; engine-poller adds hourly readings.
case "${SKILL_NAME:-}" in
  perps-scan|engine-poller) ;;
  *)
    echo "postprocess-divergence: skipping (SKILL_NAME='${SKILL_NAME:-}', not a divergence write source)"
    exit 0
    ;;
esac

CACHE_DIR=".divergence-cache"
HISTORY_PATH="memory/topics/state/divergence-history.json"

if [ ! -d "$CACHE_DIR" ]; then
  echo "postprocess-divergence: no $CACHE_DIR/ — prefetch didn't run or wrote nothing, skipping"
  exit 0
fi

# Count snapshot files (excluding the internal _cg-markets.json + manifest).
SNAPSHOT_COUNT=$(find "$CACHE_DIR" -maxdepth 1 -type f -name '*.json' \
  ! -name '_*' ! -name 'manifest.json' 2>/dev/null | wc -l | tr -d ' ')

if [ "$SNAPSHOT_COUNT" = "0" ]; then
  echo "postprocess-divergence: $CACHE_DIR/ holds zero per-asset snapshots, skipping"
  exit 0
fi

echo "postprocess-divergence: appending $SNAPSHOT_COUNT snapshots to history"

# Hand off to Python — atomic write of history file via lib.divergence.
python3 - <<'PY'
import json
import sys
from pathlib import Path

sys.path.insert(0, "scripts")
from lib import divergence as D

CACHE_DIR = Path(".divergence-cache")
history = D.load()

appended = 0
errored = 0
for f in sorted(CACHE_DIR.iterdir()):
    if not f.is_file() or not f.suffix == ".json":
        continue
    if f.name.startswith("_") or f.name == "manifest.json":
        continue
    try:
        snap = json.loads(f.read_text())
        asset = snap["asset"]
        # Drop the metadata fields not part of the persisted schema.
        persisted = {
            "ts_utc":         snap["ts_utc"],
            "spot_usd":       snap["spot_usd"],
            "perps_mark_usd": snap["perps_mark_usd"],
            "divergence_pct": snap["divergence_pct"],
            "basis_apr":      snap.get("basis_apr"),
        }
        D.append_snapshot(history, asset, persisted)
        appended += 1
    except (KeyError, json.JSONDecodeError, D.DivergenceError) as e:
        sys.stderr.write(f"postprocess-divergence: WARN {f.name}: {e}\n")
        errored += 1

try:
    D.save(history)
    print(f"postprocess-divergence: history saved — appended={appended}, errored={errored}")
    print(f"postprocess-divergence: by_asset count={len(history['by_asset'])}")
except D.DivergenceError as e:
    sys.stderr.write(f"postprocess-divergence: ERROR history save failed: {e}\n")
    sys.exit(1)
PY

# Validate the resulting file end-to-end.
echo "postprocess-divergence: validating $HISTORY_PATH"
( cd scripts && python3 -m lib.divergence "../$HISTORY_PATH" ) || {
  echo "::warning::postprocess-divergence: post-save validation failed"
  exit 1
}

echo "postprocess-divergence: done"

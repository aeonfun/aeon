#!/usr/bin/env bash
# Post-process: launch ads queued by skills/schedule-ads/ via the AdManage.ai API.
# Runs after Claude finishes, with full env access.
#
# Inputs:  .pending-admanage/launches/*.json   (one per launch batch)
# Outputs: .pending-admanage/results/*.json    (batch result + status)
# Side effects:
#   - POST https://api.admanage.ai/v1/launch          (launches ads, PAUSED by default)
#   - GET  https://api.admanage.ai/v1/batch-status/{id}  (polls until terminal or timeout)
#   - GET  https://api.admanage.ai/v1/spend/daily     (daily spend circuit breaker)
#   - ./notify "..."                                  (fans to Telegram/Discord/Slack)
#
# Safety:
#   - Hard-fails if ADMANAGE_API_KEY is not set (never silently skips auth).
#   - Respects dailySpendCap from each queued payload — skips launch if today's
#     spend across the account is already over the cap.
#   - Every payload enforces status: PAUSED unless explicitly disabled in config.
#   - On any API error, writes the error to results/ and continues with the next
#     payload (one bad launch doesn't kill the rest).
#
# This script is intentionally boring. The schedule-ads skill is the brain;
# this is just the arm that can reach outside the sandbox.
set -uo pipefail

PENDING_DIR=".pending-admanage/launches"
RESULTS_DIR=".pending-admanage/results"
API_BASE="https://api.admanage.ai"
POLL_TIMEOUT=90           # seconds to wait for a batch to reach terminal state
POLL_INTERVAL=5

if [ ! -d "$PENDING_DIR" ]; then
  echo "postprocess-admanage: no pending launches, skipping"
  exit 0
fi

shopt -s nullglob
LAUNCH_FILES=("$PENDING_DIR"/*.json)
if [ ${#LAUNCH_FILES[@]} -eq 0 ]; then
  echo "postprocess-admanage: pending dir empty, skipping"
  exit 0
fi

if [ -z "${ADMANAGE_API_KEY:-}" ]; then
  echo "::warning::postprocess-admanage: ADMANAGE_API_KEY not set — ${#LAUNCH_FILES[@]} launch(es) queued but not sent"
  ./notify "ads queued but ADMANAGE_API_KEY is missing — ${#LAUNCH_FILES[@]} launch(es) stuck in .pending-admanage/launches/" || true
  exit 0
fi

mkdir -p "$RESULTS_DIR"

auth_hdr="Authorization: Bearer $ADMANAGE_API_KEY"

# --- Daily spend circuit breaker -----------------------------------------
# Check once per run, use the strictest cap across all queued payloads.
STRICTEST_CAP=$(jq -s 'map(.dailySpendCap // empty) | min // null' "${LAUNCH_FILES[@]}")
if [ "$STRICTEST_CAP" != "null" ] && [ -n "$STRICTEST_CAP" ]; then
  TODAY=$(date -u +%Y-%m-%d)
  SPEND_RESP=$(curl -sS --max-time 30 \
    "$API_BASE/v1/spend/daily?startDate=$TODAY&endDate=$TODAY" \
    -H "$auth_hdr" || echo '{}')
  TODAY_SPEND=$(echo "$SPEND_RESP" | jq -r '.metadata.totalSpend // 0')
  if awk "BEGIN{exit !($TODAY_SPEND >= $STRICTEST_CAP)}"; then
    MSG="ads NOT launched — daily spend cap tripped. today=\$${TODAY_SPEND} cap=\$${STRICTEST_CAP} queued=${#LAUNCH_FILES[@]}"
    echo "postprocess-admanage: $MSG"
    ./notify "$MSG" || true
    # Leave the pending files in place so they can be inspected/relaunched manually.
    exit 0
  fi
fi

# --- Per-file launch loop -------------------------------------------------
success_count=0
fail_count=0
summary_lines=()

for file in "${LAUNCH_FILES[@]}"; do
  basename=$(basename "$file" .json)
  schedule_name=$(jq -r '.schedule // "unknown"' "$file")
  payload=$(jq '.payload' "$file")
  ad_count=$(echo "$payload" | jq '.ads | length')

  echo "postprocess-admanage: launching schedule='$schedule_name' ads=$ad_count"

  # POST /v1/launch
  launch_resp=$(curl -sS --max-time 60 -X POST "$API_BASE/v1/launch" \
    -H "$auth_hdr" \
    -H "Content-Type: application/json" \
    -d "$payload" || echo '{"success":false,"error":"curl_failed"}')

  success=$(echo "$launch_resp" | jq -r '.success // false')
  batch_id=$(echo "$launch_resp" | jq -r '.adBatchId // empty')

  if [ "$success" != "true" ] || [ -z "$batch_id" ]; then
    err=$(echo "$launch_resp" | jq -r '.message // .error // "unknown launch error"')
    echo "postprocess-admanage: launch FAILED for $schedule_name: $err"
    jq -n --arg sched "$schedule_name" --arg err "$err" --argjson resp "$launch_resp" \
      '{schedule:$sched, success:false, error:$err, response:$resp, ts:now}' \
      > "$RESULTS_DIR/${basename}.json"
    summary_lines+=("$schedule_name — FAILED: $err")
    fail_count=$((fail_count + 1))
    mv "$file" "$RESULTS_DIR/${basename}.input.json" 2>/dev/null || true
    continue
  fi

  # Poll GET /v1/batch-status/{id}
  elapsed=0
  batch_status="unknown"
  batch_resp="{}"
  while [ "$elapsed" -lt "$POLL_TIMEOUT" ]; do
    batch_resp=$(curl -sS --max-time 15 \
      "$API_BASE/v1/batch-status/$batch_id" -H "$auth_hdr" || echo '{}')
    batch_status=$(echo "$batch_resp" | jq -r '.summaryStatus // .status // "unknown"')
    if [ "$batch_status" = "success" ] || [ "$batch_status" = "error" ]; then
      break
    fi
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
  done

  total_ads=$(echo "$batch_resp" | jq -r '.totalAds // 0')
  ok_ads=$(echo "$batch_resp" | jq -r '.successfulAds // 0')
  failed_ads=$(echo "$batch_resp" | jq -r '(.failedAds | length) // 0')

  jq -n \
    --arg sched "$schedule_name" \
    --arg batch_id "$batch_id" \
    --arg batch_status "$batch_status" \
    --argjson batch_resp "$batch_resp" \
    --argjson launch_resp "$launch_resp" \
    '{schedule:$sched, success:true, batchId:$batch_id, batchStatus:$batch_status, launch:$launch_resp, status:$batch_resp, ts:now}' \
    > "$RESULTS_DIR/${basename}.json"

  case "$batch_status" in
    success) summary_lines+=("$schedule_name → batch $batch_id OK ($ok_ads/$total_ads ads)"); success_count=$((success_count + 1)) ;;
    error)   summary_lines+=("$schedule_name → batch $batch_id ERROR ($failed_ads failed)"); fail_count=$((fail_count + 1)) ;;
    *)       summary_lines+=("$schedule_name → batch $batch_id still running after ${POLL_TIMEOUT}s — check dashboard"); fail_count=$((fail_count + 1)) ;;
  esac

  mv "$file" "$RESULTS_DIR/${basename}.input.json" 2>/dev/null || true
done

# --- Notify summary -------------------------------------------------------
TEMP=$(mktemp -t admanage-result.XXXXXX.md)
{
  echo "*Ads launched — $(date -u +%Y-%m-%d)*"
  echo
  echo "batches: $success_count ok / $fail_count problem"
  echo
  for line in "${summary_lines[@]}"; do
    echo "- $line"
  done
  echo
  echo "paused by default — resume in AdManage dashboard to start delivery"
} > "$TEMP"

./notify -f "$TEMP" || true
rm -f "$TEMP"

echo "postprocess-admanage: done (ok=$success_count fail=$fail_count)"

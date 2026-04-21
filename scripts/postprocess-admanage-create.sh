#!/usr/bin/env bash
# Post-process: create Meta campaigns + ad sets queued by skills/create-campaign.
# Runs after Claude exits, with full env access.
#
# Inputs:
#   .pending-admanage/creates/campaigns/*.json   — campaign create payloads
#   .pending-admanage/creates/adsets/*.json      — ad-set create payloads (may
#                                                  contain __RESOLVE_FROM_PARENT__
#                                                  sentinels that we resolve here)
# State:
#   .admanage-state/campaigns.json               — append new campaigns + ad-set IDs
# Side effects:
#   POST https://api.admanage.ai/v1/manage/create-campaign
#   POST https://api.admanage.ai/v1/manage/create-adset
#   ./notify "..."
#
# Safety:
#   - Hard-fails if ADMANAGE_API_KEY is not set.
#   - Campaigns are always created PAUSED (skill enforces status:PAUSED in payload).
#   - Ad-set creation is skipped for any campaign that failed to create.
#   - On any API error, writes the error to results/ and continues with the next payload.
set -uo pipefail

CREATES_DIR=".pending-admanage/creates"
CAMPAIGNS_DIR="$CREATES_DIR/campaigns"
ADSETS_DIR="$CREATES_DIR/adsets"
RESULTS_DIR=".pending-admanage/creates-results"
STATE_DIR=".admanage-state"
STATE_FILE="$STATE_DIR/campaigns.json"
API_BASE="https://api.admanage.ai"

if [ ! -d "$CREATES_DIR" ]; then
  echo "postprocess-admanage-create: nothing to create, skipping"
  exit 0
fi

shopt -s nullglob
CAMPAIGN_FILES=("$CAMPAIGNS_DIR"/*.json)
ADSET_FILES=("$ADSETS_DIR"/*.json)
if [ ${#CAMPAIGN_FILES[@]} -eq 0 ] && [ ${#ADSET_FILES[@]} -eq 0 ]; then
  echo "postprocess-admanage-create: pending dirs empty, skipping"
  exit 0
fi

if [ -z "${ADMANAGE_API_KEY:-}" ]; then
  total=$(( ${#CAMPAIGN_FILES[@]} + ${#ADSET_FILES[@]} ))
  echo "::warning::postprocess-admanage-create: ADMANAGE_API_KEY not set — $total create(s) stuck"
  ./notify "campaigns queued but ADMANAGE_API_KEY missing — $total create(s) stuck in .pending-admanage/creates/" || true
  exit 0
fi

mkdir -p "$RESULTS_DIR" "$STATE_DIR"
if [ ! -f "$STATE_FILE" ]; then
  echo '{"campaigns":[]}' > "$STATE_FILE"
fi

auth_hdr="Authorization: Bearer $ADMANAGE_API_KEY"

# Map: config name -> campaign ID (built as we go, used to resolve ad-set parents).
declare -A NAME_TO_ID
# Also preload from state, so ad sets under existing campaigns still resolve.
while IFS=$'\t' read -r cfg_name cid; do
  [ -n "$cfg_name" ] && NAME_TO_ID["$cfg_name"]="$cid"
done < <(jq -r '.campaigns[]? | [.configName, .campaignId] | @tsv' "$STATE_FILE")

campaign_success=0
campaign_fail=0
adset_success=0
adset_fail=0
summary_lines=()

# --- Phase 1: create campaigns -------------------------------------------
for file in "${CAMPAIGN_FILES[@]}"; do
  basename=$(basename "$file" .json)
  payload=$(cat "$file")
  cfg_name=$(echo "$payload" | jq -r '.name')
  ad_account=$(echo "$payload" | jq -r '.businessId')

  echo "postprocess-admanage-create: creating campaign '$cfg_name'..."

  resp=$(curl -sS --max-time 60 -X POST "$API_BASE/v1/manage/create-campaign" \
    -H "$auth_hdr" -H "Content-Type: application/json" \
    -d "$payload" || echo '{"success":false,"error":"curl_failed"}')

  success=$(echo "$resp" | jq -r '.success // false')
  campaign_id=$(echo "$resp" | jq -r '.campaignId // empty')

  if [ "$success" != "true" ] || [ -z "$campaign_id" ]; then
    err=$(echo "$resp" | jq -r '.message // .error // "unknown campaign create error"')
    echo "postprocess-admanage-create: FAILED '$cfg_name': $err"
    jq -n --arg name "$cfg_name" --arg err "$err" --argjson resp "$resp" \
      '{configName:$name, type:"campaign", success:false, error:$err, response:$resp, ts:now}' \
      > "$RESULTS_DIR/campaign-${basename}.json"
    summary_lines+=("campaign '$cfg_name' — FAILED: $err")
    campaign_fail=$((campaign_fail + 1))
    mv "$file" "$RESULTS_DIR/campaign-${basename}.input.json" 2>/dev/null || true
    continue
  fi

  NAME_TO_ID["$cfg_name"]="$campaign_id"

  # Append to state
  tmp=$(mktemp)
  jq --arg name "$cfg_name" --arg cid "$campaign_id" --arg acct "$ad_account" \
     --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.campaigns += [{configName:$name, campaignId:$cid, adAccountId:$acct, createdAt:$ts, adSets:[]}]' \
     "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"

  jq -n --arg name "$cfg_name" --arg cid "$campaign_id" --argjson resp "$resp" \
    '{configName:$name, type:"campaign", success:true, campaignId:$cid, response:$resp, ts:now}' \
    > "$RESULTS_DIR/campaign-${basename}.json"
  summary_lines+=("campaign '$cfg_name' → $campaign_id")
  campaign_success=$((campaign_success + 1))
  mv "$file" "$RESULTS_DIR/campaign-${basename}.input.json" 2>/dev/null || true
done

# --- Phase 2: create ad sets ---------------------------------------------
for file in "${ADSET_FILES[@]}"; do
  basename=$(basename "$file" .json)
  payload=$(cat "$file")
  cfg_name=$(echo "$payload" | jq -r '.name')
  parent_name=$(echo "$payload" | jq -r '.parentCampaignConfigName // empty')
  campaign_id_in_payload=$(echo "$payload" | jq -r '.campaignId // empty')

  # Resolve parent if needed
  if [ "$campaign_id_in_payload" = "__RESOLVE_FROM_PARENT__" ] || [ -z "$campaign_id_in_payload" ]; then
    if [ -z "$parent_name" ]; then
      echo "postprocess-admanage-create: ad-set '$cfg_name' has no parent reference, skipping"
      summary_lines+=("adset '$cfg_name' — SKIPPED: no parent reference")
      adset_fail=$((adset_fail + 1))
      mv "$file" "$RESULTS_DIR/adset-${basename}.input.json" 2>/dev/null || true
      continue
    fi
    resolved="${NAME_TO_ID[$parent_name]:-}"
    if [ -z "$resolved" ]; then
      echo "postprocess-admanage-create: ad-set '$cfg_name' parent '$parent_name' not found, skipping"
      summary_lines+=("adset '$cfg_name' — SKIPPED: parent '$parent_name' missing (campaign create may have failed)")
      adset_fail=$((adset_fail + 1))
      mv "$file" "$RESULTS_DIR/adset-${basename}.input.json" 2>/dev/null || true
      continue
    fi
    payload=$(echo "$payload" | jq --arg cid "$resolved" '.campaignId = $cid | del(.parentCampaignConfigName)')
  fi

  echo "postprocess-admanage-create: creating ad set '$cfg_name' under $parent_name..."

  resp=$(curl -sS --max-time 60 -X POST "$API_BASE/v1/manage/create-adset" \
    -H "$auth_hdr" -H "Content-Type: application/json" \
    -d "$payload" || echo '{"success":false,"error":"curl_failed"}')

  success=$(echo "$resp" | jq -r '.success // false')
  adset_id=$(echo "$resp" | jq -r '.adSetId // empty')

  if [ "$success" != "true" ] || [ -z "$adset_id" ]; then
    err=$(echo "$resp" | jq -r '.message // .error // "unknown ad-set create error"')
    echo "postprocess-admanage-create: FAILED ad-set '$cfg_name': $err"
    jq -n --arg name "$cfg_name" --arg parent "$parent_name" --arg err "$err" --argjson resp "$resp" \
      '{configName:$name, parent:$parent, type:"adset", success:false, error:$err, response:$resp, ts:now}' \
      > "$RESULTS_DIR/adset-${basename}.json"
    summary_lines+=("adset '$cfg_name' — FAILED: $err")
    adset_fail=$((adset_fail + 1))
    mv "$file" "$RESULTS_DIR/adset-${basename}.input.json" 2>/dev/null || true
    continue
  fi

  # Append to state under the right campaign
  tmp=$(mktemp)
  jq --arg parent "$parent_name" --arg name "$cfg_name" --arg aid "$adset_id" \
     --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '(.campaigns[] | select(.configName == $parent) | .adSets) += [{configName:$name, adSetId:$aid, createdAt:$ts}]' \
     "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"

  jq -n --arg name "$cfg_name" --arg parent "$parent_name" --arg aid "$adset_id" --argjson resp "$resp" \
    '{configName:$name, parent:$parent, type:"adset", success:true, adSetId:$aid, response:$resp, ts:now}' \
    > "$RESULTS_DIR/adset-${basename}.json"
  summary_lines+=("adset '$cfg_name' → $adset_id (under '$parent_name')")
  adset_success=$((adset_success + 1))
  mv "$file" "$RESULTS_DIR/adset-${basename}.input.json" 2>/dev/null || true
done

# --- Notify summary -------------------------------------------------------
TEMP=$(mktemp -t admanage-create.XXXXXX.md)
{
  echo "*Campaigns created — $(date -u +%Y-%m-%d)*"
  echo
  echo "campaigns: $campaign_success ok / $campaign_fail fail"
  echo "ad sets:   $adset_success ok / $adset_fail fail"
  echo
  for line in "${summary_lines[@]}"; do
    echo "- $line"
  done
  echo
  echo "all entities paused — unpause in AdManage when ready"
  echo "ids written to .admanage-state/campaigns.json"
} > "$TEMP"

./notify -f "$TEMP" || true
rm -f "$TEMP"

# Commit state file updates so next Claude run sees fresh IDs.
if [ -n "$(git status --porcelain "$STATE_FILE" 2>/dev/null)" ]; then
  git add "$STATE_FILE" 2>/dev/null || true
  git -c user.name="aeonframework" -c user.email="aeonframework@proton.me" \
    commit -m "chore(admanage): update campaign state" "$STATE_FILE" 2>/dev/null || true
fi

echo "postprocess-admanage-create: done (campaigns=$campaign_success/$campaign_fail adsets=$adset_success/$adset_fail)"

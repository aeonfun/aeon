#!/usr/bin/env bash
# Post-process authed write requests to api.liquidpad.site that the skill
# emitted but couldn't execute (sandbox blocks outbound curl with secrets).
#
# The skill writes a payload to .pending-liquidpad/<id>.json with the body it
# decided to send. This shim reads each pending file, calls the API, records
# the result back, and moves the file to .liquidpad-cache/ for the next run.
set -euo pipefail

PENDING_DIR=".pending-liquidpad"
CACHE_DIR=".liquidpad-cache"

if [ ! -d "$PENDING_DIR" ] || [ -z "$(ls -A "$PENDING_DIR"/*.json 2>/dev/null || true)" ]; then
  echo "postprocess-liquidpad: no pending requests"
  exit 0
fi

if [ -z "${LIQUIDPAD_API_KEY:-}" ]; then
  echo "postprocess-liquidpad: LIQUIDPAD_API_KEY not set, skipping"
  exit 0
fi

API_BASE="${LIQUIDPAD_API_BASE:-https://api.liquidpad.site}"

mkdir -p "$CACHE_DIR"

for req_file in "$PENDING_DIR"/*.json; do
  [ -f "$req_file" ] || continue
  echo "postprocess-liquidpad: processing $(basename "$req_file")..."

  # Validate request shape
  if ! jq empty "$req_file" >/dev/null 2>&1; then
    echo "postprocess-liquidpad: invalid JSON in $req_file, moving to .failed"
    mkdir -p "$PENDING_DIR/.failed"
    mv "$req_file" "$PENDING_DIR/.failed/"
    continue
  fi

  ENDPOINT=$(jq -r '.endpoint // "/agent/run-once"' "$req_file")
  PAYLOAD=$(jq -c '.payload // {}' "$req_file")
  REQ_ID=$(basename "$req_file" .json)

  # Sanity gates — refuse to call if payload is missing critical fields.
  NAME=$(echo "$PAYLOAD" | jq -r '.name // empty')
  SYMBOL=$(echo "$PAYLOAD" | jq -r '.symbol // empty')
  OWNER=$(echo "$PAYLOAD" | jq -r '.ownerAddress // empty')

  if [ -z "$NAME" ] || [ -z "$SYMBOL" ] || [ -z "$OWNER" ]; then
    echo "postprocess-liquidpad: payload missing name/symbol/ownerAddress, skipping"
    mv "$req_file" "$PENDING_DIR/.failed/" 2>/dev/null || mkdir -p "$PENDING_DIR/.failed" && mv "$req_file" "$PENDING_DIR/.failed/"
    continue
  fi

  if ! [[ "$OWNER" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    echo "postprocess-liquidpad: ownerAddress not a valid 0x address, skipping"
    mkdir -p "$PENDING_DIR/.failed"
    mv "$req_file" "$PENDING_DIR/.failed/"
    continue
  fi

  # Optional dry-run: log the call without executing
  if [ "${LIQUIDPAD_DRY_RUN:-}" = "1" ]; then
    echo "postprocess-liquidpad: DRY_RUN — would POST to ${API_BASE}${ENDPOINT}"
    echo "$PAYLOAD" | jq .
    mkdir -p "$PENDING_DIR/.dry-run"
    mv "$req_file" "$PENDING_DIR/.dry-run/"
    continue
  fi

  RESPONSE=$(curl -s --max-time 60 -w "\n__HTTP_CODE__%{http_code}" -X POST \
    -H "x-api-key: $LIQUIDPAD_API_KEY" \
    -H "Content-Type: application/json" \
    -H "accept: application/json" \
    -d "$PAYLOAD" \
    "${API_BASE}${ENDPOINT}" 2>&1) || {
    echo "::warning::postprocess-liquidpad: curl failed for $REQ_ID"
    continue
  }

  HTTP_CODE=$(echo "$RESPONSE" | grep '__HTTP_CODE__' | sed 's/__HTTP_CODE__//')
  BODY=$(echo "$RESPONSE" | grep -v '__HTTP_CODE__')

  RESULT_FILE="$CACHE_DIR/${REQ_ID}.result.json"
  jq -n \
    --arg req_id "$REQ_ID" \
    --arg http_code "$HTTP_CODE" \
    --argjson body "$BODY" \
    '{req_id: $req_id, http_code: ($http_code | tonumber), body: $body, ts: (now | strftime("%Y-%m-%dT%H:%M:%SZ"))}' \
    > "$RESULT_FILE"

  if [ "$HTTP_CODE" = "200" ]; then
    ADDR=$(echo "$BODY" | jq -r '.token.address // .address // empty')
    TX=$(echo "$BODY" | jq -r '.txHash // .tx // empty')
    echo "postprocess-liquidpad: ✓ $SYMBOL deployed ${ADDR:-?} (tx ${TX:-?})"
    rm "$req_file"
  elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "::warning::postprocess-liquidpad: AUTH FAIL ($HTTP_CODE) — stopping further launches"
    mkdir -p "$PENDING_DIR/.failed"
    mv "$req_file" "$PENDING_DIR/.failed/"
    mkdir -p memory/topics
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) liquidpad-deploy-auth-fail $HTTP_CODE" >> memory/topics/liquidpad-api-errors.md
    break
  elif [ "$HTTP_CODE" = "429" ]; then
    echo "::warning::postprocess-liquidpad: rate-limited, leaving $REQ_ID for next run"
  else
    echo "::warning::postprocess-liquidpad: HTTP $HTTP_CODE for $REQ_ID"
    mkdir -p "$PENDING_DIR/.failed"
    mv "$req_file" "$PENDING_DIR/.failed/"
  fi
done

echo "postprocess-liquidpad: done"

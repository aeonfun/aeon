#!/usr/bin/env bash
# postprocess-farcaster.sh — Post pending Farcaster casts after Claude finishes
# Called automatically by the workflow via: bash scripts/postprocess-farcaster.sh
#
# Reads payloads from .pending-farcaster/*.json, injects NEYNAR_SIGNER_UUID,
# and POSTs to the Neynar cast endpoint. Successful payloads are deleted.
set -euo pipefail

PENDING_DIR=".pending-farcaster"

if [ ! -d "$PENDING_DIR" ] || [ -z "$(ls -A "$PENDING_DIR" 2>/dev/null)" ]; then
  exit 0
fi

if [ -z "${NEYNAR_API_KEY:-}" ]; then
  echo "postprocess-farcaster: NEYNAR_API_KEY not set, skipping"
  exit 0
fi

if [ -z "${NEYNAR_SIGNER_UUID:-}" ]; then
  echo "postprocess-farcaster: NEYNAR_SIGNER_UUID not set, skipping"
  exit 0
fi

for payload in "$PENDING_DIR"/*.json; do
  [ -f "$payload" ] || continue

  echo "postprocess-farcaster: casting $(basename "$payload")"

  # Inject signer_uuid at post time so the on-disk payload never contains it
  body=$(jq --arg uuid "$NEYNAR_SIGNER_UUID" '. + {signer_uuid: $uuid}' "$payload")

  response=$(curl -s -w "\n%{http_code}" \
    -X POST "https://api.neynar.com/v2/farcaster/cast" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${NEYNAR_API_KEY}" \
    -d "$body")

  http_code=$(echo "$response" | tail -1)
  resp_body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    hash=$(echo "$resp_body" | jq -r '.cast.hash // empty')
    author=$(echo "$resp_body" | jq -r '.cast.author.username // empty')
    if [ -n "$hash" ] && [ -n "$author" ]; then
      echo "postprocess-farcaster: published → https://warpcast.com/${author}/${hash:0:10}"
    else
      echo "postprocess-farcaster: published (hash=$hash)"
    fi
    rm -f "$payload"
  elif [ "$http_code" = "400" ] || [ "$http_code" = "422" ]; then
    echo "postprocess-farcaster: validation error or duplicate, removing payload"
    echo "$resp_body"
    rm -f "$payload"
  elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
    echo "postprocess-farcaster: auth error (HTTP $http_code) — check NEYNAR_API_KEY / NEYNAR_SIGNER_UUID"
    echo "$resp_body"
    exit 0
  else
    echo "postprocess-farcaster: failed with HTTP $http_code"
    echo "$resp_body"
  fi
done

# Clean up empty directory
rmdir "$PENDING_DIR" 2>/dev/null || true

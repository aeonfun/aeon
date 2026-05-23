#!/usr/bin/env bash
# postprocess-devto.sh — Post pending Dev.to articles after Claude finishes
# Called automatically by the workflow via: bash scripts/postprocess-devto.sh
set -euo pipefail

PENDING_DIR=".pending-devto"

if [ ! -d "$PENDING_DIR" ] || [ -z "$(ls -A "$PENDING_DIR" 2>/dev/null)" ]; then
  exit 0
fi

if [ -z "${DEVTO_API_KEY:-}" ]; then
  echo "postprocess-devto: DEVTO_API_KEY not set, skipping"
  exit 0
fi

for payload in "$PENDING_DIR"/*.json; do
  [ -f "$payload" ] || continue

  echo "postprocess-devto: posting $(basename "$payload")"

  response=$(curl -s -w "\n%{http_code}" \
    -X POST "https://dev.to/api/articles" \
    -H "Content-Type: application/json" \
    -H "api-key: ${DEVTO_API_KEY}" \
    -d @"$payload")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "201" ]; then
    url=$(echo "$body" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "postprocess-devto: published → $url"
    rm -f "$payload"
  elif [ "$http_code" = "422" ]; then
    echo "postprocess-devto: duplicate or validation error, removing payload"
    rm -f "$payload"
  else
    echo "postprocess-devto: failed with HTTP $http_code"
    echo "$body"
  fi
done

# Clean up empty directory
rmdir "$PENDING_DIR" 2>/dev/null || true

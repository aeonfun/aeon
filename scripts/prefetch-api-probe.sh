#!/usr/bin/env bash
# API provider health probe — only executes for the api-health skill; no-ops for all others.
# Writes .api-probe/status.json (one entry per provider) so the skill can check API health
# without making network calls from inside the sandbox.
#
# To probe another provider, add a guarded block at the bottom (see the XAI block).
set -euo pipefail

SKILL="${1:-}"
[ "$SKILL" = "api-health" ] || exit 0

mkdir -p .api-probe
CHECKED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
RESULTS="{}"

add_result() { # provider http_code error_msg
  RESULTS=$(echo "$RESULTS" | jq \
    --arg p "$1" --argjson code "$2" --arg ts "$CHECKED_AT" --arg err "$3" \
    '.[$p] = {http_code: $code, checked_at: $ts, error_msg: $err}')
}

probe() { # provider url auth_header body
  local provider="$1" url="$2" auth="$3" body="$4"
  local raw http_code body_excerpt err=""

  raw=$(curl -s --max-time 30 -w "\n__HTTP_CODE__%{http_code}" \
    -X POST "$url" \
    -H "Content-Type: application/json" \
    -H "$auth" \
    -d "$body" 2>&1) || true

  http_code=$(echo "$raw" | grep '__HTTP_CODE__' | sed 's/__HTTP_CODE__//' | tr -d '[:space:]')
  # Normalize: curl emits "000" on connection failure; non-numeric → 0
  if echo "$http_code" | grep -qE '^[0-9]+$'; then
    http_code=$((10#$http_code))
  else
    http_code=0
  fi

  body_excerpt=$(echo "$raw" | grep -v '__HTTP_CODE__' | head -c 400)
  if echo "$body_excerpt" | jq -e '.error // .message' >/dev/null 2>&1; then
    err=$(echo "$body_excerpt" | jq -r '.error // .message' 2>/dev/null | head -c 200)
  fi

  add_result "$provider" "$http_code" "$err"
  echo "prefetch-api-probe: $provider HTTP $http_code"
}

# --- xAI (used by refresh-x, tweet-roundup, list-digest, narrative-tracker, remix-tweets, content-performance) ---
# Minimal 1-token completion against the same /v1/responses endpoint the skills use.
# Credit exhaustion returns HTTP 403 ("has either used all available credits or
# reached its monthly spending limit"); a revoked key returns 401.
if [ -n "${XAI_API_KEY:-}" ]; then
  probe "xai" "https://api.x.ai/v1/responses" \
    "Authorization: Bearer $XAI_API_KEY" \
    '{"model":"grok-4-fast","input":[{"role":"user","content":"ping"}],"max_output_tokens":1}'
else
  add_result "xai" 0 "XAI_API_KEY not configured"
fi

# Add more providers here, e.g.:
# if [ -n "${OPENROUTER_API_KEY:-}" ]; then
#   probe "openrouter" "https://openrouter.ai/api/v1/chat/completions" \
#     "Authorization: Bearer $OPENROUTER_API_KEY" \
#     '{"model":"openrouter/auto","messages":[{"role":"user","content":"ping"}],"max_tokens":1}'
# fi

echo "$RESULTS" > .api-probe/status.json
echo "prefetch-api-probe: wrote .api-probe/status.json"

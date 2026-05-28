#!/usr/bin/env bash
# Pre-fetch authed reads from api.liquidpad.site OUTSIDE the Claude sandbox.
# Called by the workflow before Claude runs. Saves JSON responses to
# .liquidpad-cache/ so skills can read cached results instead of curling
# (the sandbox blocks outbound requests carrying the LIQUIDPAD_API_KEY header).
#
# To add prefetch for a new LiquidPad-using skill, add a case block below.
# Skills read cached data from .liquidpad-cache/<filename>.json
set -euo pipefail

SKILL="${1:-}"
VAR="${2:-}"

if [ -z "$SKILL" ]; then
  echo "Usage: prefetch-liquidpad.sh <skill-name> [var]"
  exit 1
fi

if [ -z "${LIQUIDPAD_API_KEY:-}" ]; then
  echo "prefetch-liquidpad: LIQUIDPAD_API_KEY not set, skipping"
  exit 0
fi

API_BASE="${LIQUIDPAD_API_BASE:-https://api.liquidpad.site}"

mkdir -p .liquidpad-cache

# Generic GET / POST with auth header. Args: outfile, method, path, [body]
liquidpad_call() {
  local outfile="$1" method="$2" path="$3" body="${4:-}"

  echo "prefetch-liquidpad: ${method} ${path} → ${outfile}"
  local response
  local http_code
  local attempt=1
  while : ; do
    local curl_exit=0
    if [ "$method" = "GET" ]; then
      response=$(curl -s --max-time 30 -w "\n__HTTP_CODE__%{http_code}" \
        -H "x-api-key: $LIQUIDPAD_API_KEY" \
        -H "accept: application/json" \
        "${API_BASE}${path}" 2>&1) || curl_exit=$?
    else
      response=$(curl -s --max-time 30 -w "\n__HTTP_CODE__%{http_code}" -X "$method" \
        -H "x-api-key: $LIQUIDPAD_API_KEY" \
        -H "Content-Type: application/json" \
        -H "accept: application/json" \
        -d "$body" \
        "${API_BASE}${path}" 2>&1) || curl_exit=$?
    fi

    if [ "$curl_exit" -ne 0 ]; then
      if [ "$curl_exit" = "28" ] && [ "$attempt" -lt 2 ]; then
        echo "prefetch-liquidpad: curl timeout (attempt $attempt), retrying once"
        attempt=$((attempt + 1))
        continue
      fi
      echo "::warning::prefetch-liquidpad: FAILED $outfile (curl error: $curl_exit)"
      return 1
    fi

    http_code=$(echo "$response" | grep '__HTTP_CODE__' | sed 's/__HTTP_CODE__//')
    response=$(echo "$response" | grep -v '__HTTP_CODE__')

    if [ "$http_code" = "429" ] && [ "$attempt" -lt 2 ]; then
      echo "prefetch-liquidpad: HTTP 429, backing off 30s then retrying"
      sleep 30
      attempt=$((attempt + 1))
      continue
    fi
    break
  done

  if [ "$http_code" != "200" ]; then
    echo "::warning::prefetch-liquidpad: FAILED $outfile (HTTP $http_code)"
    echo "::warning::prefetch-liquidpad: response: $(echo "$response" | head -c 300)"
    if [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
      mkdir -p memory/topics
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) liquidpad-api-auth-fail $outfile $http_code" >> memory/topics/liquidpad-api-errors.md
    fi
    return 1
  fi

  echo "$response" | jq empty >/dev/null 2>&1 || {
    echo "::warning::prefetch-liquidpad: invalid JSON in response, skipping"
    return 1
  }

  echo "$response" > ".liquidpad-cache/${outfile}"
  echo "prefetch-liquidpad: saved .liquidpad-cache/${outfile}"
}

case "$SKILL" in

  liquidpad-launch)
    # Concept generation — turns a vibe into a {name, symbol, theme} draft.
    # var = vibe (free-form string ≥ 6 chars). If empty, the skill derives one
    # from MEMORY.md and we just fetch the agent's status as context.
    if [ -n "$VAR" ] && [ "${#VAR}" -ge 6 ]; then
      BODY=$(jq -n --arg vibe "$VAR" '{vibe: $vibe}')
      liquidpad_call "concept.json" "POST" "/agent/concept" "$BODY" || true
    fi
    # Always fetch agent status — cheap, useful context for the skill.
    liquidpad_call "agent-status.json" "GET" "/agent/status" || true
    ;;

  *)
    echo "prefetch-liquidpad: no prefetch defined for $SKILL"
    exit 0
    ;;
esac

echo "prefetch-liquidpad: done"

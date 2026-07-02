#!/usr/bin/env bash
# Pre-fetch Verdikta bounty data OUTSIDE the Claude sandbox (the sandbox blocks
# secret-bearing outbound calls, and the bounty API needs X-Bot-API-Key).
# Called by the workflow before Claude runs, with the skill name and var as args.
# Caches to .verdikta-cache/ for skills/verdikta-hunter/SKILL.md to read:
#   bounties.json             — GET /api/jobs?status=OPEN
#   rubric-<jobId>.json       — GET /api/jobs/:id/rubric (top candidates)
#   submissions-<jobId>.json  — GET /api/jobs/:id/submissions (bounties we've entered)
set -euo pipefail

SKILL="${1:-}"
API_BASE="https://bounties.verdikta.org/api"
CACHE_DIR=".verdikta-cache"
STATE_FILE="memory/state/verdikta-hunter.json"
MAX_RUBRICS=15

if [ "$SKILL" != "verdikta-hunter" ]; then
  echo "verdikta-prefetch: no prefetch defined for skill '$SKILL'"
  exit 0
fi

if [ -z "${VERDIKTA_API_KEY:-}" ]; then
  echo "verdikta-prefetch: VERDIKTA_API_KEY not set, skipping"
  exit 0
fi

mkdir -p "$CACHE_DIR"

# Authed GET with one retry; writes to $2 only on valid JSON. Non-fatal on failure.
vk_get() {
  local path="$1" outfile="$2"
  local response
  for attempt in 1 2; do
    if response=$(curl -sf --max-time 60 -H "X-Bot-API-Key: $VERDIKTA_API_KEY" "${API_BASE}${path}"); then
      if echo "$response" | jq empty 2>/dev/null; then
        echo "$response" > "$CACHE_DIR/$outfile"
        echo "verdikta-prefetch: saved $outfile ($(echo "$response" | wc -c | tr -d ' ') bytes)"
        return 0
      fi
      echo "::warning::verdikta-prefetch: $outfile response is not valid JSON"
      return 1
    fi
    [ "$attempt" -eq 1 ] && { echo "verdikta-prefetch: retrying $path ..."; sleep 5; }
  done
  echo "::warning::verdikta-prefetch: FAILED $outfile (${API_BASE}${path})"
  return 1
}

# 1. Open bounties (the skill filters/ranks; keep the fetch broad)
vk_get "/jobs?status=OPEN" "bounties.json" || exit 0

# 2. Rubrics for the first MAX_RUBRICS open bounties (rubric per candidate;
#    the skill only deep-reads the ones that survive its filters)
JOB_IDS=$(jq -r '(.jobs // .) | .[]?.jobId' "$CACHE_DIR/bounties.json" 2>/dev/null | head -n "$MAX_RUBRICS")
for id in $JOB_IDS; do
  vk_get "/jobs/${id}/rubric" "rubric-${id}.json" || true
done

# 3. Submission status for every bounty we have an open position in
if [ -f "$STATE_FILE" ]; then
  TRACKED=$(jq -r '.submissions // {} | keys[]' "$STATE_FILE" 2>/dev/null | cut -d: -f1 | sort -u)
  for id in $TRACKED; do
    vk_get "/jobs/${id}/submissions" "submissions-${id}.json" || true
  done
fi

echo "verdikta-prefetch: done"
ls -la "$CACHE_DIR" 2>/dev/null || true

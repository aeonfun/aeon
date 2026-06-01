#!/usr/bin/env bash
# Pre-fetch X (Twitter) v2 API bookmarks OUTSIDE the Claude sandbox.
# Called by the workflow before Claude runs. Writes the response to .xai-cache/bookmarks.json
# so the xai-bookmarks skill can read cached results instead of attempting a live API call
# (which the sandbox blocks because of env-var expansion in auth headers).
#
# Required secrets in workflow env:
#   X_BOOKMARKS_BEARER_TOKEN — OAuth2 user-context access token with `bookmarks.read` scope
# Optional secrets:
#   X_BOOKMARKS_REFRESH_TOKEN — OAuth2 refresh token (for auto-rotation if access expired)
#   X_BOOKMARKS_CLIENT_ID — needed for refresh flow
#   X_BOOKMARKS_CLIENT_SECRET — needed for confidential-client refresh
#
# If any required secret is missing, this script logs and exits 0 (no error) — the
# xai-bookmarks skill is designed to no-op gracefully when the cache file is absent.

set -euo pipefail

CACHE_DIR=".xai-cache"
CACHE_FILE="${CACHE_DIR}/bookmarks.json"
COUNT="${1:-50}"  # default 50 bookmarks; max 100 per X API page

mkdir -p "$CACHE_DIR"

if [ -z "${X_BOOKMARKS_BEARER_TOKEN:-}" ]; then
  echo "xai-bookmarks: X_BOOKMARKS_BEARER_TOKEN not set, skipping"
  exit 0
fi

# Step 1 — fetch the authenticated user's id (the bookmarks endpoint needs the user id, not @handle)
USER_RESP=$(curl -s --max-time 10 \
  -H "Authorization: Bearer ${X_BOOKMARKS_BEARER_TOKEN}" \
  "https://api.twitter.com/2/users/me" 2>&1) || {
  echo "::warning::xai-bookmarks: /users/me failed"
  exit 0
}

USER_ID=$(echo "$USER_RESP" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if 'errors' in d:
        # Token expired or invalid — try refresh if configured below
        sys.exit(2)
    print(d['data']['id'])
except Exception:
    sys.exit(3)
" 2>/dev/null) || REFRESH_NEEDED=1

# Step 2 — refresh access token if needed and the refresh token is configured
if [ "${REFRESH_NEEDED:-0}" = "1" ] && [ -n "${X_BOOKMARKS_REFRESH_TOKEN:-}" ] && [ -n "${X_BOOKMARKS_CLIENT_ID:-}" ]; then
  echo "xai-bookmarks: access token expired, attempting refresh"
  AUTH_HEADER=""
  if [ -n "${X_BOOKMARKS_CLIENT_SECRET:-}" ]; then
    AUTH_HEADER="-u ${X_BOOKMARKS_CLIENT_ID}:${X_BOOKMARKS_CLIENT_SECRET}"
  fi
  REFRESH_RESP=$(curl -s --max-time 10 $AUTH_HEADER \
    -d "grant_type=refresh_token&refresh_token=${X_BOOKMARKS_REFRESH_TOKEN}&client_id=${X_BOOKMARKS_CLIENT_ID}" \
    "https://api.twitter.com/2/oauth2/token" 2>&1) || {
    echo "::warning::xai-bookmarks: token refresh failed"
    exit 0
  }
  NEW_ACCESS=$(echo "$REFRESH_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
  if [ -z "$NEW_ACCESS" ]; then
    echo "xai-bookmarks: REFRESH_TOKEN_EXPIRED — re-mint via OAuth flow"
    exit 0
  fi
  X_BOOKMARKS_BEARER_TOKEN="$NEW_ACCESS"
  # If X rotated the refresh token, warn — operator needs to update the secret manually
  NEW_REFRESH=$(echo "$REFRESH_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('refresh_token',''))" 2>/dev/null)
  if [ -n "$NEW_REFRESH" ] && [ "$NEW_REFRESH" != "$X_BOOKMARKS_REFRESH_TOKEN" ]; then
    echo "::warning::xai-bookmarks: X issued new refresh token — update X_BOOKMARKS_REFRESH_TOKEN secret"
  fi
  # Retry /users/me with new token
  USER_RESP=$(curl -s --max-time 10 \
    -H "Authorization: Bearer ${X_BOOKMARKS_BEARER_TOKEN}" \
    "https://api.twitter.com/2/users/me")
  USER_ID=$(echo "$USER_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null) || {
    echo "::warning::xai-bookmarks: /users/me still failing after refresh"
    exit 0
  }
fi

if [ -z "${USER_ID:-}" ]; then
  echo "xai-bookmarks: could not resolve user id"
  exit 0
fi

# Step 3 — fetch the bookmarks with expansion fields needed for normalization
BOOKMARKS_URL="https://api.twitter.com/2/users/${USER_ID}/bookmarks"
BOOKMARKS_URL="${BOOKMARKS_URL}?max_results=${COUNT}"
BOOKMARKS_URL="${BOOKMARKS_URL}&tweet.fields=created_at,public_metrics,entities,referenced_tweets"
BOOKMARKS_URL="${BOOKMARKS_URL}&expansions=author_id,attachments.media_keys,referenced_tweets.id"
BOOKMARKS_URL="${BOOKMARKS_URL}&user.fields=username,name"
BOOKMARKS_URL="${BOOKMARKS_URL}&media.fields=type,url,preview_image_url"

RESP=$(curl -s --max-time 30 \
  -H "Authorization: Bearer ${X_BOOKMARKS_BEARER_TOKEN}" \
  "$BOOKMARKS_URL" 2>&1) || {
  echo "::warning::xai-bookmarks: bookmarks fetch failed"
  exit 0
}

# Validate it's parseable JSON and not an error response
if ! echo "$RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'errors' in d and 'data' not in d:
    sys.exit(4)
" 2>/dev/null; then
  echo "::warning::xai-bookmarks: response contains errors"
  echo "$RESP" | head -c 500
  exit 0
fi

echo "$RESP" > "$CACHE_FILE"
COUNT_FETCHED=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "?")
echo "xai-bookmarks: cached ${COUNT_FETCHED} bookmarks to ${CACHE_FILE}"

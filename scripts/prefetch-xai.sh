#!/usr/bin/env bash
# Pre-fetch XAI/Grok x_search results OUTSIDE the Claude sandbox.
# Called by the workflow before Claude runs. Saves JSON responses to .xai-cache/
# so skills can read cached results instead of calling curl (which the sandbox blocks).
#
# To add prefetch for a new skill, add a case block below.
# Skills read cached data from .xai-cache/<filename>.json
set -euo pipefail

SKILL="${1:-}"
VAR="${2:-}"
TODAY=$(date -u +%Y-%m-%d)
YESTERDAY=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
THREE_DAYS_AGO=$(date -u -d "3 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-3d +%Y-%m-%d)

if [ -z "$SKILL" ]; then
  echo "Usage: xai-prefetch.sh <skill-name> [var]"
  exit 1
fi

if [ -z "${XAI_API_KEY:-}" ]; then
  echo "xai-prefetch: XAI_API_KEY not set, skipping"
  exit 0
fi

mkdir -p .xai-cache

# Generic XAI search call. Args: output_file, prompt, [from_date], [to_date], [extra_tools_json]
xai_search() {
  local outfile="$1" prompt="$2"
  local from_date="${3:-$YESTERDAY}" to_date="${4:-$TODAY}"
  local extra_tools="${5:-}"

  local tools
  if [ -n "$extra_tools" ]; then
    tools="[{\"type\": \"x_search\", \"from_date\": \"$from_date\", \"to_date\": \"$to_date\", $extra_tools}]"
  else
    tools="[{\"type\": \"x_search\", \"from_date\": \"$from_date\", \"to_date\": \"$to_date\"}]"
  fi

  echo "xai-prefetch: fetching $outfile ..."
  local response
  local http_code
  local body
  body=$(jq -n \
    --arg model "grok-4-1-fast" \
    --arg prompt "$prompt" \
    --argjson tools "$tools" \
    '{model: $model, input: [{role: "user", content: $prompt}], tools: $tools}')
  local attempt=1
  while : ; do
    local curl_exit=0
    response=$(curl -s --max-time 180 -w "\n__HTTP_CODE__%{http_code}" -X POST "https://api.x.ai/v1/responses" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $XAI_API_KEY" \
      -d "$body" 2>&1) || curl_exit=$?
    if [ "$curl_exit" -ne 0 ]; then
      if [ "$curl_exit" = "28" ] && [ "$attempt" -lt 2 ]; then
        echo "xai-prefetch: curl timeout on $outfile (attempt $attempt), retrying once"
        attempt=$((attempt + 1))
        continue
      fi
      echo "::warning::xai-prefetch: FAILED $outfile (curl error: $curl_exit)"
      return 1
    fi
    http_code=$(echo "$response" | grep '__HTTP_CODE__' | sed 's/__HTTP_CODE__//')
    response=$(echo "$response" | grep -v '__HTTP_CODE__')
    if [ "$http_code" = "429" ] && [ "$attempt" -lt 2 ]; then
      echo "xai-prefetch: HTTP 429 on $outfile, backing off 30s then retrying"
      sleep 30
      attempt=$((attempt + 1))
      continue
    fi
    break
  done
  if [ "$http_code" != "200" ]; then
    echo "::warning::xai-prefetch: FAILED $outfile (HTTP $http_code)"
    echo "::warning::xai-prefetch: response: $(echo "$response" | head -c 300)"
    # Log persistent errors to memory so skills and health checks can see them
    if [ "$http_code" = "429" ] || [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
      mkdir -p memory/logs
      TODAY=$(date -u +%Y-%m-%d)
      NOW=$(date -u +%H:%M)
      ERROR_MSG=$(echo "$response" | jq -r '.error // .message // "unknown"' 2>/dev/null | head -c 200)
      echo "" >> "memory/logs/${TODAY}.md"
      echo "## XAI Prefetch Error ($NOW UTC)" >> "memory/logs/${TODAY}.md"
      echo "- **Skill:** $SKILL" >> "memory/logs/${TODAY}.md"
      echo "- **HTTP:** $http_code" >> "memory/logs/${TODAY}.md"
      echo "- **Error:** $ERROR_MSG" >> "memory/logs/${TODAY}.md"
    fi
    return 1
  fi

  echo "$response" > ".xai-cache/$outfile"
  echo "xai-prefetch: saved $outfile ($(echo "$response" | wc -c | tr -d ' ') bytes)"
}

case "$SKILL" in

  refresh-x)
    # Fetch recent tweets from a specific account
    # Set var to the X handle (without @). Default: reads from aeon.yml or MEMORY.md
    ACCOUNT="${VAR:-}"
    if [ -z "$ACCOUNT" ]; then
      echo "xai-prefetch: refresh-x requires var (X handle), skipping"
      exit 0
    fi
    ACCOUNT="${ACCOUNT#@}"
    xai_search "refresh-x.json" \
      "Search X for all tweets posted by @${ACCOUNT} from ${YESTERDAY} to ${TODAY}. Return every tweet — not just popular ones. For each: the full tweet text, date/time posted, engagement stats (likes, retweets, replies), and the direct link (https://x.com/${ACCOUNT}/status/ID). If it was a reply, note who it was replying to. If it was a quote tweet, include what was quoted. Return as a chronological list."
    ;;

  remix-tweets)
    # Fetch older tweets from an account for remixing
    ACCOUNT="${VAR:-}"
    if [ -z "$ACCOUNT" ]; then
      echo "xai-prefetch: remix-tweets requires var (X handle), skipping"
      exit 0
    fi
    ACCOUNT="${ACCOUNT#@}"
    FROM_DATE=$(date -u -d "180 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-180d +%Y-%m-%d)
    TO_DATE_REMIX=$(date -u -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-30d +%Y-%m-%d)
    xai_search "remix-tweets.json" \
      "Search X for original tweets (not replies, not retweets) posted by @${ACCOUNT} from ${FROM_DATE} to ${TO_DATE_REMIX}. I want a diverse sample — mix of topics, tones, and engagement levels. Return exactly 10 tweets. For each: the full tweet text, date posted, engagement stats (likes, retweets, replies), and the direct tweet link (https://x.com/${ACCOUNT}/status/ID). Return as a numbered list." \
      "$FROM_DATE" "$TO_DATE_REMIX" \
      "\"allowed_x_handles\": [\"${ACCOUNT}\"]"
    ;;

  tweet-roundup)
    if [ -n "$VAR" ]; then
      # Single topic override
      xai_search "roundup-var.json" \
        "Search X for the latest popular tweets about: ${VAR} from ${YESTERDAY} to ${TODAY}. Return the 3-5 most interesting or viral tweets. For each: 1) the @handle, 2) a one-line summary, 3) the tweet permalink (https://x.com/username/status/ID)."
    else
      echo "xai-prefetch: tweet-roundup has no var, skipping (set var to a topic)"
    fi
    ;;

  narrative-tracker)
    xai_search "narratives.json" \
      "Search X for the dominant crypto and tech narratives being discussed from ${THREE_DAYS_AGO} to ${TODAY}. What themes are builders, VCs, and influential accounts pushing? What narratives are gaining momentum vs losing steam? Look for: new meta-narratives, narrative shifts, contrarian takes gaining traction, and consensus views being challenged. Return 10-15 distinct narrative threads with representative tweets (include @handle and link)." \
      "$THREE_DAYS_AGO"
    ;;

  reply-maker)
    if [ -z "$VAR" ]; then
      echo "xai-prefetch: reply-maker has no var, skipping (skill falls back to memory logs + WebSearch)"
      exit 0
    fi
    # Detect var shape: numeric → X list ID, @-prefixed → handle, anything else → topic
    if echo "$VAR" | grep -Eq '^[0-9]+$'; then
      xai_search "reply-maker.json" \
        "Look at X list https://x.com/i/lists/${VAR}. Return the 12 most reply-worthy original posts (not retweets, not replies) by members of this list posted in the last 6 hours (between ${YESTERDAY} and ${TODAY}). Reply-worthy = has a take, claim, question, or framing worth engaging — NOT pure self-promo, breaking news without analysis, or threads already past 500 replies. For each: @handle, full tweet text, tweet URL, posted_at ISO timestamp, like/reply/retweet counts."
    elif [ "${VAR#@}" != "$VAR" ]; then
      ACCOUNT="${VAR#@}"
      xai_search "reply-maker.json" \
        "Search X for the 12 most reply-worthy original posts (not retweets, not replies) by @${ACCOUNT} between ${YESTERDAY} and ${TODAY}, prioritizing the last 6 hours. Reply-worthy = has a take, claim, question, or framing worth engaging — NOT pure self-promo, breaking news without analysis, or threads already past 500 replies. For each: @handle, full tweet text, tweet URL, posted_at ISO timestamp, like/reply/retweet counts." \
        "$YESTERDAY" "$TODAY" \
        "\"allowed_x_handles\": [\"${ACCOUNT}\"]"
    else
      xai_search "reply-maker.json" \
        "Search X for 12 reply-worthy original posts on this topic: ${VAR}. Posted between ${YESTERDAY} and ${TODAY}, prioritizing the last 6 hours. Reply-worthy = has a take, claim, question, or framing worth engaging — NOT pure self-promo, breaking news without analysis, or threads already past 500 replies. Avoid threads already past 500 replies. For each: @handle, full tweet text, tweet URL, posted_at ISO timestamp, like/reply/retweet counts."
    fi
    ;;

  article)
    if [ -n "$VAR" ]; then
      xai_search "article-x.json" \
        "Search X for the most interesting discussion about ${VAR} in the last 48 hours. Return the 5 most notable tweets with @handle, summary, and link."
    else
      echo "xai-prefetch: article has no var, skipping (topic chosen at runtime)"
    fi
    ;;

  fetch-tweets)
    if [ -n "$VAR" ]; then
      xai_search "fetch-tweets.json" \
        "Search X for the latest tweets about: ${VAR} from ${YESTERDAY} to ${TODAY}. Return the 10 most interesting tweets. For each: @handle, full tweet text, date, engagement stats (likes, retweets, replies), and the direct link (https://x.com/username/status/ID)."
    else
      echo "xai-prefetch: fetch-tweets has no var, skipping"
    fi
    ;;

  vercel-projects)
    # Pre-fetch Vercel API data (requires auth — can't be done in sandbox)
    if [ -z "${VERCEL_TOKEN:-}" ]; then
      echo "xai-prefetch: VERCEL_TOKEN not set, skipping vercel-projects"
    else
      echo "xai-prefetch: fetching vercel-projects.json ..."
      TEAM_PARAM=""
      [ -n "$VAR" ] && TEAM_PARAM="&teamId=$VAR"
      PROJECTS=$(curl -s --max-time 30 "https://api.vercel.com/v9/projects?limit=100${TEAM_PARAM}" \
        -H "Authorization: Bearer $VERCEL_TOKEN" 2>&1) || {
        echo "::warning::xai-prefetch: FAILED vercel-projects (curl error)"
      }
      if [ -n "$PROJECTS" ] && echo "$PROJECTS" | jq empty 2>/dev/null; then
        echo "$PROJECTS" > ".xai-cache/vercel-projects.json"
        echo "xai-prefetch: saved vercel-projects.json"

        # Pre-fetch latest deployment for each project
        PROJECT_IDS=$(echo "$PROJECTS" | jq -r '.projects[]?.id // empty' 2>/dev/null)
        DEPLOYS="[]"
        for PID in $PROJECT_IDS; do
          DEP=$(curl -s --max-time 15 "https://api.vercel.com/v6/deployments?projectId=${PID}&limit=1&target=production" \
            -H "Authorization: Bearer $VERCEL_TOKEN" 2>/dev/null) || continue
          DEPLOYS=$(echo "$DEPLOYS" | jq --arg pid "$PID" --argjson dep "$DEP" '. + [{"projectId": $pid, "deployment": $dep}]' 2>/dev/null) || continue
        done
        echo "$DEPLOYS" > ".xai-cache/vercel-deployments.json"
        echo "xai-prefetch: saved vercel-deployments.json"
      else
        echo "::warning::xai-prefetch: vercel-projects response invalid"
      fi
    fi
    ;;

  *)
    echo "xai-prefetch: no prefetch defined for skill '$SKILL'"
    ;;

esac

echo "xai-prefetch: done for $SKILL"
ls -la .xai-cache/ 2>/dev/null || true

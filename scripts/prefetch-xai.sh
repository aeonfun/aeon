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

  write-tweet)
    # Only the `remix` format needs an X prefetch (older tweets to remix).
    # drafts/thread use built-in WebSearch or fetch live, so skip otherwise.
    FIRST=$(printf '%s' "${VAR:-}" | awk '{print tolower($1)}')
    if [ "$FIRST" != "remix" ]; then
      echo "xai-prefetch: write-tweet var='${VAR:-}' is not remix format — no X prefetch needed"
      exit 0
    fi
    # The remix branch resolves its handle from $X_HANDLE (then soul/SOUL.md in-skill).
    ACCOUNT=$(printf '%s' "${X_HANDLE:-}" | tr -d ' ')
    ACCOUNT="${ACCOUNT#@}"
    if [ -z "$ACCOUNT" ]; then
      echo "xai-prefetch: write-tweet remix has no \$X_HANDLE — skipping X prefetch (skill resolves handle from soul/SOUL.md or aborts)"
      exit 0
    fi
    # Default remix window: 30–180 days ago. Custom windows resolve live in-skill.
    FROM_DATE=$(date -u -d "180 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-180d +%Y-%m-%d)
    TO_DATE_REMIX=$(date -u -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-30d +%Y-%m-%d)
    xai_search "remix-tweets.json" \
      "Search X for original tweets (not replies, not retweets) posted by @${ACCOUNT} from ${FROM_DATE} to ${TO_DATE_REMIX}. I want a diverse sample — mix of topics, tones, and engagement levels. Return exactly 10 tweets. For each: the full tweet text, date posted, engagement stats (likes, retweets, replies), and the direct tweet link (https://x.com/${ACCOUNT}/status/ID). Return as a numbered list." \
      "$FROM_DATE" "$TO_DATE_REMIX" \
      "\"allowed_x_handles\": [\"${ACCOUNT}\"]"
    ;;

  soul-builder)
    # Read a wide, diverse sample of an account to model its identity + voice.
    # var may be a structured brief ("x=handle | name=... | links=...") or a bare
    # handle (back-compat). Only the X handle is prefetched here; name/links are
    # gathered in-skill via WebSearch/WebFetch (sandbox-safe built-ins).
    RAW="${VAR:-}"
    case "$RAW" in
      *x=*) ACCOUNT=$(printf '%s' "$RAW" | sed -n 's/.*x=\([^|]*\).*/\1/p') ;;
      *=*)  ACCOUNT="" ;;
      *)    ACCOUNT="$RAW" ;;
    esac
    ACCOUNT=$(printf '%s' "$ACCOUNT" | tr -d ' ')
    ACCOUNT="${ACCOUNT#@}"
    ACCOUNT="${ACCOUNT##*x.com/}"; ACCOUNT="${ACCOUNT##*twitter.com/}"; ACCOUNT="${ACCOUNT%%/*}"
    if [ -z "$ACCOUNT" ]; then
      echo "xai-prefetch: soul-builder has no X handle in var, skipping X prefetch (name/links handled in-skill via web search)"
      exit 0
    fi
    SOUL_FROM=$(date -u -d "365 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-365d +%Y-%m-%d)
    xai_search "soul-builder.json" \
      "Profile the X account @${ACCOUNT} so an AI can learn to think and write like this person. Return TWO things. FIRST, the account profile: display name, bio, and a one-paragraph read on who they are and what they post about. SECOND, a diverse sample of 40 of their own original posts (not retweets) from ${SOUL_FROM} to ${TODAY} — deliberately mix topics, tones, and engagement levels (include quiet posts, not just viral ones), and include some opinionated takes, some reactions, and some longer posts. For each post: the full text, date posted, like/retweet/reply counts, and the direct link (https://x.com/${ACCOUNT}/status/ID). Return the profile first, then a numbered list of posts." \
      "$SOUL_FROM" "$TODAY" \
      "\"allowed_x_handles\": [\"${ACCOUNT}\"]"
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
    # Consolidated X prefetch for the fetch-tweets hub (absorbed tweet-digest,
    # tweet-roundup, list-digest, refresh-x, agent-buzz). Parse "<source>:<arg>"
    # with shape inference, then prefetch the keyword / topic / single-account
    # modes (the ones refresh-x + tweet-roundup + keyword prefetched). list,
    # agent-buzz and account-digest run live in-skill (no prefetch pre-merge).
    RAW="${VAR:-}"
    SRC="${RAW%%:*}"; ARG="${RAW#*:}"; [ "$ARG" = "$RAW" ] && ARG=""   # no colon → ARG empty
    case "$SRC" in
      keyword) MODE=keyword ;;
      topic)   MODE=topic ;;
      account) MODE=account ;;
      list|agent-buzz|"") MODE=skip ;;                 # list/agent-buzz/empty resolve live in-skill
      *)  ARG="$RAW"                                    # no recognised prefix → infer from shape
          if printf '%s' "$RAW" | grep -Eq '^[0-9,]+$'; then MODE=skip
          elif printf '%s' "$RAW" | grep -Eq '^@?[A-Za-z0-9_]{1,15}$'; then MODE=account
          else MODE=keyword; fi ;;
    esac
    case "$MODE" in
      keyword)
        xai_search "fetch-tweets.json" \
          "Search X for the latest tweets about: ${ARG} from ${YESTERDAY} to ${TODAY}. Return the 10 most interesting tweets. For each: @handle, full tweet text, date, engagement stats (likes, retweets, replies), and the direct link (https://x.com/username/status/ID)."
        ;;
      topic)
        if [ -n "$ARG" ]; then
          xai_search "fetch-tweets-topic.json" \
            "Search X for the latest popular tweets about: ${ARG} from ${YESTERDAY} to ${TODAY}. Return the 3-5 most interesting or viral tweets. For each: 1) the @handle, 2) a one-line summary, 3) the tweet permalink (https://x.com/username/status/ID)."
        else
          echo "xai-prefetch: fetch-tweets topic list resolved in-skill (MEMORY.md/defaults) — running live"
        fi
        ;;
      account)
        ACCOUNT="${ARG#@}"
        if [ -z "$ACCOUNT" ]; then
          echo "xai-prefetch: fetch-tweets account-digest (all tracked handles) runs live in-skill"
        else
          xai_search "fetch-tweets-account.json" \
            "Search X for all tweets posted by @${ACCOUNT} from ${YESTERDAY} to ${TODAY}. Return every tweet — not just popular ones. For each: the full tweet text, date/time posted, engagement stats (likes, retweets, replies), and the direct link (https://x.com/${ACCOUNT}/status/ID). If it was a reply, note who it was replying to. If it was a quote tweet, include what was quoted. Return as a chronological list." \
            "$YESTERDAY" "$TODAY" \
            "\"allowed_x_handles\": [\"${ACCOUNT}\"]"
        fi
        ;;
      skip)
        echo "xai-prefetch: fetch-tweets var='${RAW}' → list/agent-buzz/empty mode runs live in-skill (no prefetch)"
        ;;
    esac
    ;;

  product-pulse)
    # product-pulse absorbed repo-pulse (gh, no prefetch), content-performance
    # (X 7-day tweets) and vercel-projects (Vercel REST). Parse facet + arg and
    # stage the canonical .xai-cache/product-pulse-*.json each facet reads.
    FACET=$(printf '%s' "${VAR:-}" | awk '{print tolower($1)}')
    ARG=$(printf '%s' "${VAR:-}" | awk '{print $2}')
    case "$FACET" in dry-run | "") FACET=all ;; esac

    # all facet — X followers/posts per tracked handle → product-pulse-x.json
    if [ "$FACET" = "all" ] && [ -f memory/products.md ]; then
      HANDLES=$(grep -oE '@[A-Za-z0-9_]{2,15}' memory/products.md | tr -d '@' | sort -u | paste -sd, -)
      if [ -n "$HANDLES" ]; then
        xai_search "product-pulse-x.json" \
          "For each of these X/Twitter handles (${HANDLES}), return the current follower count and total post count, one line each as 'handle|followers|posts'. Use the most recent public data."
      else
        echo "xai-prefetch: product-pulse all-facet — no @handles in memory/products.md, skipping X prefetch"
      fi
    fi

    # content facet — one handle's 7-day tweets → product-pulse-content.json
    if [ "$FACET" = "content" ]; then
      SEVEN_DAYS_AGO=$(date -u -d "7 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-7d +%Y-%m-%d)
      HANDLE="$ARG"
      if [ -z "$HANDLE" ] && [ -f soul/SOUL.md ]; then
        HANDLE=$(grep -oE '@[A-Za-z0-9_]{2,15}' soul/SOUL.md | head -1 | tr -d '@')
      fi
      if [ -z "$HANDLE" ]; then
        echo "xai-prefetch: product-pulse content facet — no handle (arg empty, none in soul/SOUL.md), skipping"
      else
        xai_search "product-pulse-content.json" \
          "Search X for all public tweets posted by @${HANDLE} between ${SEVEN_DAYS_AGO} and ${TODAY}. Include original tweets, replies, and quote tweets. For each tweet return: the full text (up to 150 chars), date posted (YYYY-MM-DD), like count, retweet count, quote tweet count, and reply count. Return up to 25 tweets sorted by total engagement (likes + retweets*2 + quotes*3) descending. If fewer tweets exist in the window, return all of them." \
          "$SEVEN_DAYS_AGO" "$TODAY" \
          "\"allowed_x_handles\": [\"${HANDLE}\"]"
      fi
    fi

    # all + deploys facets — Vercel projects (auth) → product-pulse-deploys.json
    if { [ "$FACET" = "all" ] || [ "$FACET" = "deploys" ]; } && [ -n "${VERCEL_TOKEN:-}" ]; then
      TEAM_PARAM=""
      [ "$FACET" = "deploys" ] && [ -n "$ARG" ] && TEAM_PARAM="&teamId=$ARG"
      PROJECTS=$(curl -s --max-time 30 "https://api.vercel.com/v9/projects?limit=100${TEAM_PARAM}" \
        -H "Authorization: Bearer $VERCEL_TOKEN" 2>&1) || echo "::warning::xai-prefetch: FAILED product-pulse-deploys (curl error)"
      if [ -n "$PROJECTS" ] && echo "$PROJECTS" | jq empty 2>/dev/null; then
        echo "$PROJECTS" > ".xai-cache/product-pulse-deploys.json"
        echo "xai-prefetch: saved product-pulse-deploys.json"
      else
        echo "::warning::xai-prefetch: product-pulse-deploys response invalid"
      fi
    elif [ "$FACET" = "all" ] || [ "$FACET" = "deploys" ]; then
      echo "xai-prefetch: product-pulse deploys — VERCEL_TOKEN not set, skipping"
    fi
    ;;

  shiplog)
    # Cadence-agnostic ship recap. Three best-effort windows over the last 7 days
    # (the skill itself narrows to its "since last run" slice from these caches):
    #   1) the operator's own posts (ships + commentary, originals vs RTs)
    #   2) the product accounts' posts (launches, the marquee security-merge brag)
    #   3) ecosystem scouts mentioning the products (features, rankings)
    # Handles are config-driven from memory/products.md; each window is non-fatal and
    # skipped when its config is absent, so the skill degrades to GitHub-only / WebFetch.
    SEVEN_DAYS_AGO=$(date -u -d "7 days ago" +%Y-%m-%d 2>/dev/null || date -u -v-7d +%Y-%m-%d)

    PRODUCTS_FILE="memory/products.md"
    OP=""; PRODUCT_HANDLES=""; SCOUTS=""
    if [ -f "$PRODUCTS_FILE" ] && ! grep -qi "unconfigured template" "$PRODUCTS_FILE"; then
      ALL_HANDLES=$(grep -iE '(^|[*[:space:]-])handles:' "$PRODUCTS_FILE" | grep -oE '@[A-Za-z0-9_]{2,15}' | tr -d '@')
      if [ -n "$ALL_HANDLES" ]; then
        # operator = the founder handle (recurs across every product block); products = the rest
        OP=$(printf '%s\n' "$ALL_HANDLES" | sort | uniq -c | sort -rn | awk 'NR==1{print $2}')
        PRODUCT_HANDLES=$(printf '%s\n' "$ALL_HANDLES" | grep -v "^${OP}$" | awk '!seen[$0]++' | paste -sd, -)
      fi
      SCOUTS=$(grep -iE '(^|[*[:space:]-])scouts:' "$PRODUCTS_FILE" | grep -oE '@[A-Za-z0-9_]{2,15}' | tr -d '@' | awk '!seen[$0]++' | paste -sd, -)
    fi
    OP="${X_HANDLE:-$OP}"; OP="${OP#@}"
    if [ -z "$OP" ] && [ -f soul/SOUL.md ]; then
      OP=$(grep -oE '@[A-Za-z0-9_]{2,15}' soul/SOUL.md | head -1 | tr -d '@')
    fi

    if [ -z "$OP" ] && [ -z "$PRODUCT_HANDLES" ]; then
      echo "xai-prefetch: shiplog — no operator/product handles in memory/products.md (unconfigured), skipping X prefetch"
    else
      if [ -n "$OP" ]; then
        xai_search "shiplog-operator.json" \
          "Search X for all posts by @${OP} from ${SEVEN_DAYS_AGO} to ${TODAY}. Return every post — originals, replies, quotes, and retweets (mark retweets, which start with 'RT @'). For each: full text, date/time, engagement (likes, retweets, replies, views), and the direct link (https://x.com/${OP}/status/ID). I care most about what was shipped or announced. Return as a chronological list." \
          "$SEVEN_DAYS_AGO" "$TODAY" \
          "\"allowed_x_handles\": [\"${OP}\"]" || true
      fi
      if [ -n "$PRODUCT_HANDLES" ]; then
        HANDLES_JSON=$(printf '%s' "$PRODUCT_HANDLES" | awk -F, '{for(i=1;i<=NF;i++){printf (i>1?", ":"") "\"" $i "\""}}')
        HANDLES_AT=$(printf '%s' "$PRODUCT_HANDLES" | sed 's/,/, @/g; s/^/@/')
        xai_search "shiplog-projects.json" \
          "Search X for posts by ${HANDLES_AT} from ${SEVEN_DAYS_AGO} to ${TODAY}. Return every original post (skip pure retweets). For each: @handle, full text, date/time, engagement (likes, retweets, replies, views), and the direct link. Highlight launches, shipped features, milestones, and any 'merged by' / security-fix announcements naming another project. Return grouped by account." \
          "$SEVEN_DAYS_AGO" "$TODAY" \
          "\"allowed_x_handles\": [${HANDLES_JSON}]" || true
      fi
      if [ -n "$SCOUTS" ]; then
        SCOUTS_AT=$(printf '%s' "$SCOUTS" | sed 's/,/, @/g; s/^/@/')
        xai_search "shiplog-ecosystem.json" \
          "Search X from ${SEVEN_DAYS_AGO} to ${TODAY} for posts by ${SCOUTS_AT} mentioning @${OP}'s products (${HANDLES_AT:-the products}) — especially recaps, rankings, or shoutouts. For each: @handle of the poster, follower count if visible, full text or a one-line summary, date, and the post link. Return the 10 most notable." \
          "$SEVEN_DAYS_AGO" "$TODAY" || true
      else
        echo "xai-prefetch: shiplog — no scouts: line in memory/products.md, skipping ecosystem window"
      fi
    fi
    ;;

  *)
    echo "xai-prefetch: no prefetch defined for skill '$SKILL'"
    ;;

esac

echo "xai-prefetch: done for $SKILL"
ls -la .xai-cache/ 2>/dev/null || true

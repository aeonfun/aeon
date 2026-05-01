#!/usr/bin/env bash
set -uo pipefail

# Step 2: Capture baseline
if [[ -f articles/feed.xml ]]; then
  PREV_HASH="$(sha256sum articles/feed.xml | awk '{print $1}')"
  grep -oP '(?<=<title>)[^<]+' articles/feed.xml | tail -n +2 | sort -u > .rss-feed-prev-titles.txt
else
  PREV_HASH=""
  : > .rss-feed-prev-titles.txt
fi
echo "PREV_HASH=$PREV_HASH"
echo "Prev title count: $(wc -l < .rss-feed-prev-titles.txt)"

# Step 3: Regenerate
bash scripts/generate-feed.sh
GEN_RC=$?
echo "generate-feed RC=$GEN_RC"

# Step 4: Validate
STATUS=""
VALIDATION_ERR=""
if command -v xmllint >/dev/null 2>&1; then
  if ! xmllint --noout articles/feed.xml; then
    STATUS="RSS_FEED_ERROR"
    VALIDATION_ERR="xmllint failed"
  fi
else
  if ! head -2 articles/feed.xml | grep -q '<feed'; then
    STATUS="RSS_FEED_ERROR"
    VALIDATION_ERR="missing <feed> root"
  elif ! tail -1 articles/feed.xml | grep -q '</feed>'; then
    STATUS="RSS_FEED_ERROR"
    VALIDATION_ERR="missing </feed> close"
  fi
fi

if [[ "$STATUS" == "RSS_FEED_ERROR" ]]; then
  echo "STATUS=RSS_FEED_ERROR"
  echo "VALIDATION_ERR=$VALIDATION_ERR"
  exit 1
fi

# Step 5: Detect change
NEW_HASH="$(sha256sum articles/feed.xml | awk '{print $1}')"
grep -oP '(?<=<title>)[^<]+' articles/feed.xml | tail -n +2 | sort -u > .rss-feed-new-titles.txt
ADDED="$(comm -13 .rss-feed-prev-titles.txt .rss-feed-new-titles.txt)"
REMOVED="$(comm -23 .rss-feed-prev-titles.txt .rss-feed-new-titles.txt)"
ENTRY_COUNT="$(wc -l < .rss-feed-new-titles.txt | tr -d ' ')"

if [[ "$PREV_HASH" == "$NEW_HASH" ]]; then
  STATUS="RSS_FEED_NO_CHANGE"
elif [[ -z "$ADDED" && -z "$REMOVED" ]]; then
  STATUS="RSS_FEED_METADATA_ONLY"
else
  STATUS="RSS_FEED_OK"
fi

echo "STATUS=$STATUS"
echo "NEW_HASH=$NEW_HASH"
echo "ENTRY_COUNT=$ENTRY_COUNT"
echo "--- ADDED ---"
echo "$ADDED"
echo "--- REMOVED ---"
echo "$REMOVED"
echo "--- end ---"

# Persist to env file for downstream steps
{
  echo "PREV_HASH=$PREV_HASH"
  echo "NEW_HASH=$NEW_HASH"
  echo "STATUS=$STATUS"
  echo "ENTRY_COUNT=$ENTRY_COUNT"
} > .rss-feed-state.env

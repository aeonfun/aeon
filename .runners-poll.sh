#!/bin/bash
# Polls a URL until response is large enough (passes rate-limit cooldown).
URL="$1"
OUT="$2"
MAX_TRIES=20
i=0
while [ $i -lt $MAX_TRIES ]; do
  curl -s --max-time 15 -o "$OUT" "$URL"
  sz=$(wc -c < "$OUT")
  if [ "$sz" -gt 1000 ]; then
    echo "ok size=$sz"
    exit 0
  fi
  i=$((i+1))
  sleep 6
done
echo "fail size=$sz"
exit 1

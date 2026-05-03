#!/usr/bin/env bash
cd /home/runner/work/aeon/aeon
for f in .outputs/hn_top_*.json; do
  jq -r '[(.score|tostring), (.id|tostring), ((.descendants//0)|tostring), (.title//""), (.url//"")] | join("|")' "$f"
done | sort -t'|' -k1,1 -nr | head -10

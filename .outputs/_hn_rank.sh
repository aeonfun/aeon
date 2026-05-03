#!/usr/bin/env bash
for f in /home/runner/work/aeon/aeon/.outputs/hn_top_*.json; do
  jq -r '[.id, .score, (.descendants // 0), (.title // ""), (.url // "")] | @tsv' "$f"
done | sort -t$'\t' -k2 -nr | head -12

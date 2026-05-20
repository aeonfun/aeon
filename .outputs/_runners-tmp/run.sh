#!/bin/bash
set -e
cd /home/runner/work/aeon/aeon/.outputs/_runners-tmp
NOW=$(date -u +%s)
jq -s --argjson now "$NOW" -f process.jq \
  global.json solana-trend.json solana-vol.json \
  eth-trend.json eth-vol.json base-trend.json base-vol.json \
  bsc-trend.json bsc-vol.json arbitrum-trend.json arbitrum-vol.json \
  new.json > processed.json
echo "total-deduped: $(jq 'length' processed.json)"
echo "post-gate:     $(jq '[.[] | select(.reject == null)] | length' processed.json)"
echo "rejection breakdown:"
jq -r '[.[] | select(.reject != null) | .reject] | group_by(.) | map({k:.[0], n:length}) | sort_by(-.n) | .[] | "  \(.k)=\(.n)"' processed.json

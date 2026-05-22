#!/bin/bash
cd /home/runner/work/aeon/aeon
for N in solana eth base bsc arbitrum; do
  sleep 1
  curl -s --max-time 15 "https://api.geckoterminal.com/api/v2/networks/${N}/trending_pools?page=1" -o ".outputs/_gt-${N}-trend.json"
  S=$(wc -c < ".outputs/_gt-${N}-trend.json")
  if grep -q '"status":"429"' ".outputs/_gt-${N}-trend.json" 2>/dev/null; then
    echo "${N}-trend=429($S)"
  else
    echo "${N}-trend=ok($S)"
  fi
  sleep 1
  curl -s --max-time 15 "https://api.geckoterminal.com/api/v2/networks/${N}/pools?page=1&sort=h24_volume_usd_desc" -o ".outputs/_gt-${N}-vol.json"
  S=$(wc -c < ".outputs/_gt-${N}-vol.json")
  if grep -q '"status":"429"' ".outputs/_gt-${N}-vol.json" 2>/dev/null; then
    echo "${N}-vol=429($S)"
  else
    echo "${N}-vol=ok($S)"
  fi
done

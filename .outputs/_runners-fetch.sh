#!/bin/bash
cd /home/runner/work/aeon/aeon
set -u

fetch_with_backoff() {
  url="$1"; out="$2"
  for delay in 0 2 4; do
    [ "$delay" -gt 0 ] && sleep "$delay"
    curl -s --max-time 20 "$url" -o "$out"
    if ! grep -q '"status":"429"' "$out" 2>/dev/null && [ -s "$out" ]; then
      return 0
    fi
  done
  return 1
}

fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/trending_pools?page=1" ".outputs/_gt-global.json" && echo "global=ok" || echo "global=fail"
sleep 1
fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/new_pools?page=1" ".outputs/_gt-new.json" && echo "new=ok" || echo "new=fail"
sleep 1

for N in solana eth base bsc arbitrum; do
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/trending_pools?page=1" ".outputs/_gt-${N}-trend.json" && echo "${N}-trend=ok" || echo "${N}-trend=fail"
  sleep 1
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/pools?page=1&sort=h24_volume_usd_desc" ".outputs/_gt-${N}-vol.json" && echo "${N}-vol=ok" || echo "${N}-vol=fail"
  sleep 1
done

#!/bin/bash
CACHE=/home/runner/work/aeon/aeon/.gt-cache
NETWORKS="solana eth base bsc arbitrum"
fetch_with_backoff() {
  local url="$1" out="$2"
  for delay in 0 3 8 20; do
    [ $delay -gt 0 ] && sleep $delay
    curl -s --max-time 20 "$url" > "$out"
    if ! grep -q '"status":"429"' "$out" 2>/dev/null && [ -s "$out" ]; then
      return 0
    fi
  done
  return 1
}
for N in $NETWORKS; do
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/trending_pools?page=1" "$CACHE/${N}-trend.json" && echo "${N}-trend=ok" || echo "${N}-trend=FAIL"
  sleep 2
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/pools?page=1&sort=h24_volume_usd_desc" "$CACHE/${N}-vol.json" && echo "${N}-vol=ok" || echo "${N}-vol=FAIL"
  sleep 2
done
fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/new_pools?page=1" "$CACHE/new.json" && echo "new=ok" || echo "new=FAIL"
ls -la "$CACHE"

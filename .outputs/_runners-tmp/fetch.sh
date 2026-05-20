#!/bin/bash
TMP=/home/runner/work/aeon/aeon/.outputs/_runners-tmp
fetch_with_backoff() {
  local url="$1" out="$2"
  for delay in 0 3 8; do
    [ $delay -gt 0 ] && sleep $delay
    curl -s --max-time 15 "$url" > "$out"
    if ! grep -q '"status":"429"' "$out" 2>/dev/null && [ -s "$out" ]; then
      return 0
    fi
  done
  return 1
}

for N in solana eth base bsc arbitrum; do
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/trending_pools?page=1" "$TMP/${N}-trend.json" \
    && echo "${N}-trend ok ($(wc -c < $TMP/${N}-trend.json) bytes)" \
    || echo "${N}-trend FAIL"
  sleep 1
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/pools?page=1&sort=h24_volume_usd_desc" "$TMP/${N}-vol.json" \
    && echo "${N}-vol ok ($(wc -c < $TMP/${N}-vol.json) bytes)" \
    || echo "${N}-vol FAIL"
  sleep 1
done

fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/new_pools?page=1" "$TMP/new.json" \
  && echo "new ok ($(wc -c < $TMP/new.json) bytes)" \
  || echo "new FAIL"

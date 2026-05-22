#!/usr/bin/env bash
# Sequential fetch with backoff retry for GeckoTerminal.
set -u
OUTDIR=/home/runner/work/aeon/aeon/.outputs/_runners-tmp
NETWORKS="solana eth base bsc arbitrum"

fetch_with_backoff() {
  local url="$1" out="$2"
  for delay in 0 2 5 12; do
    if [ "$delay" -gt 0 ]; then
      sleep "$delay"
    fi
    curl -s --max-time 20 -H 'Accept: application/json' "$url" > "$out"
    if [ -s "$out" ] && ! grep -q '"status":"429"' "$out" 2>/dev/null && ! grep -q '"status":"5' "$out" 2>/dev/null; then
      if head -c 200 "$out" | grep -q '"data"'; then
        echo "OK  $url"
        return 0
      fi
    fi
    echo "RETRY $url (delay next=$delay)"
  done
  echo "FAIL $url"
  return 1
}

fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/trending_pools?page=1" "$OUTDIR/global.json"
sleep 1

for N in $NETWORKS; do
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/trending_pools?page=1" "$OUTDIR/${N}-trend.json"
  sleep 1
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/pools?page=1&sort=h24_volume_usd_desc" "$OUTDIR/${N}-vol.json"
  sleep 1
done

fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/new_pools?page=1" "$OUTDIR/new.json"

echo "---SIZES---"
for f in global new solana-trend solana-vol eth-trend eth-vol base-trend base-vol bsc-trend bsc-vol arbitrum-trend arbitrum-vol; do
  if [ -s "$OUTDIR/${f}.json" ]; then
    sz=$(wc -c < "$OUTDIR/${f}.json")
    cnt=$(jq '.data | length' "$OUTDIR/${f}.json" 2>/dev/null)
    echo "${f}: ${sz}B, data.length=${cnt}"
  else
    echo "${f}: MISSING/EMPTY"
  fi
done

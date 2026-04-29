#!/bin/bash
fetch_with_backoff() {
  local url="$1" out="$2"
  local delay
  for delay in 0 2 4; do
    [ "$delay" -gt 0 ] && sleep "$delay"
    curl -s --max-time 15 "$url" > "$out"
    if ! grep -q '"status":"429"' "$out" 2>/dev/null && [ -s "$out" ]; then
      return 0
    fi
  done
  return 1
}

NETWORKS="solana eth base bsc arbitrum"
declare -A STATUS

# Global
if fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/trending_pools?page=1" ".runners-global.json"; then
  STATUS[global]=ok
else
  STATUS[global]=fail
fi
sleep 1

# Per-network
for N in $NETWORKS; do
  if fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/trending_pools?page=1" ".runners-${N}-trend.json"; then
    STATUS[${N}-trend]=ok
  else
    STATUS[${N}-trend]=fail
  fi
  sleep 1
  if fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/pools?page=1&sort=h24_volume_usd_desc" ".runners-${N}-vol.json"; then
    STATUS[${N}-vol]=ok
  else
    STATUS[${N}-vol]=fail
  fi
  sleep 1
done

# New pools
if fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/new_pools?page=1" ".runners-new.json"; then
  STATUS[new]=ok
else
  STATUS[new]=fail
fi

# Print summary
for K in global solana-trend solana-vol eth-trend eth-vol base-trend base-vol bsc-trend bsc-vol arbitrum-trend arbitrum-vol new; do
  printf "%s=%s size=%s\n" "$K" "${STATUS[$K]}" "$(wc -c < .runners-${K/global/global}.json 2>/dev/null || echo 0)"
done

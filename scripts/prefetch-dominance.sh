#!/usr/bin/env bash
# Pre-fetch BTC.D + USDT.D + ETH.D dominance data from CoinGecko.
#
# Skill name guard: only runs for market-context-refresh (which is the
# canonical regime artifact downstream skills consume — perps-brief
# reads market-context.md, so dominance lands there once this fetch +
# SKILL.md integration runs).
#
# Outputs:
#   .dominance-cache/global.json       — CoinGecko /global (current values)
#   .dominance-cache/charts-30d.json   — CoinGecko /global/market_cap_chart
#                                         (30 days of total mcap history)
#   .dominance-cache/btc-30d.json      — Bitcoin /market_chart (30d price + mcap)
#   .dominance-cache/stables-30d.json  — USDT /market_chart (30d, for USDT.D
#                                         derivation since /global only gives
#                                         current dominance)
#   .dominance-cache/manifest.json     — { fetched_at, source_status }
#
# Notes:
#   - CoinGecko /global returns instantaneous dominance percentages but
#     NO historical dominance chart on the free tier. We derive
#     historical dominance from individual coin mcap charts vs total
#     mcap chart.
#   - All endpoints are public (no API key required). The optional
#     COINGECKO_API_KEY header is sent if set, for Pro-tier rate limits.

set -euo pipefail

SKILL="${1:-${SKILL_NAME:-}}"

if [ "$SKILL" != "market-context-refresh" ]; then
  echo "prefetch-dominance: skipping (skill='$SKILL', not market-context-refresh)"
  exit 0
fi

mkdir -p .dominance-cache
CACHE=.dominance-cache
BASE="https://api.coingecko.com/api/v3"

# Build the optional API key header arg
HEADER_ARG=()
if [ -n "${COINGECKO_API_KEY:-}" ]; then
  HEADER_ARG=(-H "x-cg-pro-api-key: $COINGECKO_API_KEY")
fi

fetch() {
  local outfile="$1" url="$2"
  local attempt=1
  local http_code response
  # Build curl args. Conditionally include header to avoid passing an
  # empty string as an arg (which curl reads as an empty URL under set -u).
  local -a curl_args=(-s -m 30 -w "\n%{http_code}")
  if [ "${#HEADER_ARG[@]}" -gt 0 ]; then
    curl_args+=("${HEADER_ARG[@]}")
  fi
  while : ; do
    response=$(curl "${curl_args[@]}" "$url" 2>&1) || {
      echo "::warning::prefetch-dominance: curl failed for $(basename "$outfile") (attempt $attempt)"
      if [ "$attempt" -ge 3 ]; then
        echo "::warning::prefetch-dominance: GIVING UP on $(basename "$outfile") after 3 attempts"
        return 1
      fi
      sleep $((attempt * 3))
      attempt=$((attempt + 1))
      continue
    }
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" = "200" ]; then
      echo "$body" > "$outfile"
      echo "prefetch-dominance: saved $(basename "$outfile") ($(echo "$body" | wc -c | tr -d ' ') bytes)"
      return 0
    fi
    if [ "$http_code" = "429" ] && [ "$attempt" -lt 3 ]; then
      echo "prefetch-dominance: rate-limited on $(basename "$outfile") (attempt $attempt), backing off"
      sleep $((attempt * 5))
      attempt=$((attempt + 1))
      continue
    fi
    echo "::warning::prefetch-dominance: HTTP $http_code for $(basename "$outfile") — giving up"
    return 1
  done
}

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
GLOBAL_OK=0
CHARTS_OK=0
BTC_OK=0
USDT_OK=0

# 1. Current global stats (mcap, volume, dominance per coin)
fetch "$CACHE/global.json" "$BASE/global" && GLOBAL_OK=1 || true

# 2. Total market-cap chart — 30 days. CoinGecko exposes this under
#    /global/market_cap_chart on the Pro tier; for the free tier we
#    derive it from sum of individual coin charts. For v1 we just hit
#    the endpoint and tolerate failure.
fetch "$CACHE/charts-30d.json" "$BASE/global/market_cap_chart?days=30" && CHARTS_OK=1 || true

# 3. BTC market cap history (30 days). Used to derive BTC.D history.
fetch "$CACHE/btc-30d.json" \
  "$BASE/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily" \
  && BTC_OK=1 || true

# 4. USDT market cap history (30 days). Used to derive USDT.D history.
fetch "$CACHE/stables-30d.json" \
  "$BASE/coins/tether/market_chart?vs_currency=usd&days=30&interval=daily" \
  && USDT_OK=1 || true

# Write manifest
cat > "$CACHE/manifest.json" <<JSON
{
  "fetched_at": "$NOW",
  "source": "coingecko",
  "endpoints": {
    "global":      $GLOBAL_OK,
    "charts_30d":  $CHARTS_OK,
    "btc_30d":     $BTC_OK,
    "usdt_30d":    $USDT_OK
  }
}
JSON

echo "prefetch-dominance: done — global=$GLOBAL_OK charts=$CHARTS_OK btc=$BTC_OK usdt=$USDT_OK"

#!/usr/bin/env bash
# Pre-fetch Coinglass v4 data OUTSIDE the Claude sandbox.
# Called by the workflow before Claude runs (via the generic
# scripts/prefetch-*.sh loop). Saves JSON responses to .coinglass-cache/
# so perps-scan can read cached results instead of calling curl directly
# (curl with $COINGLASS_API_KEY in headers is blocked by the sandbox).
#
# Usage: ./scripts/prefetch-coinglass.sh <skill-name> [var]
#   skill-name: e.g. "perps-scan" — gates the fetch
#   var:        optional comma-separated ticker override, e.g. "HYPE,TAO,AVAX"
#
# Cache layout (all JSON):
#   .coinglass-cache/coins.json       — coins-markets response (universe + current metrics)
#   .coinglass-cache/price-<COIN>.json    — daily price history (8d)
#   .coinglass-cache/oi-<COIN>.json       — aggregated OI history (8d)
#   .coinglass-cache/funding-<COIN>.json  — OI-weight funding history (21x8h = 7d)
#   .coinglass-cache/liq-<COIN>.json      — aggregated liquidation history (8d)
#   .coinglass-cache/manifest.json    — { fetched_at, asset_list, coins_markets_ok, per_coin_errors }
#
# Closes ISS-001 (sandbox-limitation: authenticated curl blocked).
set -euo pipefail

SKILL="${1:-}"
VAR="${2:-}"

if [ -z "$SKILL" ]; then
  echo "Usage: prefetch-coinglass.sh <skill-name> [var]"
  exit 1
fi

# Gate: only fetch for skills that need Coinglass data
case "$SKILL" in
  perps-scan) ;;
  *)
    echo "coinglass-prefetch: no prefetch defined for skill '$SKILL'"
    exit 0
    ;;
esac

if [ -z "${COINGLASS_API_KEY:-}" ]; then
  echo "coinglass-prefetch: COINGLASS_API_KEY not set, skipping"
  exit 0
fi

mkdir -p .coinglass-cache
CACHE=.coinglass-cache
BASE="https://open-api-v4.coinglass.com"

# Generic Coinglass GET with retry on 429 / single retry on curl timeout.
# Args: output_file_path, full_url
# Returns 0 on success (HTTP 200 + Coinglass code=="0"); 1 on any failure.
cg_get() {
  local outfile="$1" url="$2"
  local attempt=1
  local http_code response curl_exit
  while : ; do
    curl_exit=0
    response=$(curl -s --max-time 30 -w "\n__HTTP_CODE__%{http_code}" \
      -H "CG-API-KEY: $COINGLASS_API_KEY" \
      -H "accept: application/json" \
      "$url" 2>&1) || curl_exit=$?
    if [ "$curl_exit" -ne 0 ]; then
      if [ "$curl_exit" = "28" ] && [ "$attempt" -lt 2 ]; then
        echo "coinglass-prefetch: curl timeout on $(basename "$outfile") (attempt $attempt), retrying once"
        attempt=$((attempt + 1))
        continue
      fi
      echo "::warning::coinglass-prefetch: FAILED $(basename "$outfile") (curl error: $curl_exit)"
      return 1
    fi
    http_code=$(echo "$response" | grep '__HTTP_CODE__' | sed 's/__HTTP_CODE__//')
    response=$(echo "$response" | grep -v '__HTTP_CODE__')
    if [ "$http_code" = "429" ] && [ "$attempt" -lt 2 ]; then
      echo "coinglass-prefetch: HTTP 429 on $(basename "$outfile"), backing off 5s then retrying"
      sleep 5
      attempt=$((attempt + 1))
      continue
    fi
    break
  done
  if [ "$http_code" != "200" ]; then
    echo "::warning::coinglass-prefetch: FAILED $(basename "$outfile") (HTTP $http_code)"
    # Log persistent auth errors so health checks can see them
    if [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
      mkdir -p memory/logs
      local today now err
      today=$(date -u +%Y-%m-%d)
      now=$(date -u +%H:%M)
      err=$(echo "$response" | jq -r '.msg // .error // "unknown"' 2>/dev/null | head -c 200)
      {
        echo ""
        echo "## Coinglass Prefetch Error ($now UTC)"
        echo "- **Skill:** $SKILL"
        echo "- **HTTP:** $http_code"
        echo "- **Error:** $err"
      } >> "memory/logs/${today}.md"
    fi
    return 1
  fi
  # Validate Coinglass response shape (code must be "0")
  if ! echo "$response" | jq -e '.code == "0"' >/dev/null 2>&1; then
    local cg_msg
    cg_msg=$(echo "$response" | jq -r '.msg // "unknown"' 2>/dev/null | head -c 200)
    echo "::warning::coinglass-prefetch: FAILED $(basename "$outfile") (code != 0, msg: $cg_msg)"
    return 1
  fi
  echo "$response" > "$outfile"
  return 0
}

# --- 1. Fetch the universe + current metrics ---
echo "coinglass-prefetch: fetching coins-markets ..."
if ! cg_get "$CACHE/coins.json" \
  "$BASE/api/futures/coins-markets?exchange_list=Binance,Bybit,OKX&per_page=50"; then
  echo "::warning::coinglass-prefetch: coins-markets fetch failed — skill will fall back to 'scan unavailable'"
  # Write a manifest indicating total failure so skill can detect it without re-checking
  jq -n --arg fetched_at "$(date -u +%FT%TZ)" \
    '{fetched_at: $fetched_at, coins_markets_ok: false, asset_list: [], per_coin_errors: []}' \
    > "$CACHE/manifest.json"
  exit 0  # Non-fatal — skill handles the missing-data case
fi
echo "coinglass-prefetch: saved coins.json ($(wc -c < "$CACHE/coins.json" | tr -d ' ') bytes)"

# --- 2. Determine asset list ---
if [ -n "$VAR" ]; then
  # User-provided override: comma-separated tickers, normalize to uppercase
  ASSET_LIST=$(echo "$VAR" | tr ',' '\n' | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]' | grep -v '^$' | sort -u)
  echo "coinglass-prefetch: using VAR override asset list: $(echo "$ASSET_LIST" | tr '\n' ' ')"
else
  # Default: top 25 by OI + force-include BTC/ETH/SOL
  TOP=$(jq -r '.data | sort_by(.open_interest_usd) | reverse | .[0:25] | .[].symbol' "$CACHE/coins.json")
  ASSET_LIST=$(printf '%s\nBTC\nETH\nSOL\n' "$TOP" | grep -v '^$' | sort -u)
  echo "coinglass-prefetch: default asset list ($(echo "$ASSET_LIST" | wc -l | tr -d ' ') coins)"
fi

# --- 3. Per-coin history fetch ---
PER_COIN_ERRORS="[]"
for COIN in $ASSET_LIST; do
  COIN_ERRORS=""
  for KIND_SPEC in \
    "price:$BASE/api/futures/price/history?symbol=${COIN}&interval=1d&limit=8" \
    "oi:$BASE/api/futures/open-interest/aggregated-history?symbol=${COIN}&interval=1d&limit=8" \
    "funding:$BASE/api/futures/funding-rate/oi-weight-history?symbol=${COIN}&interval=8h&limit=21" \
    "liq:$BASE/api/futures/liquidation/aggregated-history?symbol=${COIN}&interval=1d&limit=8"
  do
    KIND="${KIND_SPEC%%:*}"
    URL="${KIND_SPEC#*:}"
    if ! cg_get "$CACHE/${KIND}-${COIN}.json" "$URL"; then
      COIN_ERRORS="${COIN_ERRORS}${KIND},"
    fi
    sleep 0.1
  done
  if [ -n "$COIN_ERRORS" ]; then
    COIN_ERRORS="${COIN_ERRORS%,}"  # strip trailing comma
    PER_COIN_ERRORS=$(echo "$PER_COIN_ERRORS" | jq --arg coin "$COIN" --arg errs "$COIN_ERRORS" \
      '. + [{coin: $coin, failed: ($errs | split(","))}]')
  fi
done

# --- 4. Write manifest ---
ASSET_LIST_JSON=$(echo "$ASSET_LIST" | jq -R -s 'split("\n") | map(select(length > 0))')
jq -n \
  --arg fetched_at "$(date -u +%FT%TZ)" \
  --argjson asset_list "$ASSET_LIST_JSON" \
  --argjson per_coin_errors "$PER_COIN_ERRORS" \
  '{fetched_at: $fetched_at, coins_markets_ok: true, asset_list: $asset_list, per_coin_errors: $per_coin_errors}' \
  > "$CACHE/manifest.json"

ERROR_COUNT=$(echo "$PER_COIN_ERRORS" | jq 'length')
echo "coinglass-prefetch: done — $(echo "$ASSET_LIST_JSON" | jq 'length') coins, $ERROR_COUNT with per-endpoint errors"
ls -la "$CACHE/" 2>/dev/null | head -5 || true

#!/usr/bin/env bash
# Pre-fetch Coinglass v4 + CoinGecko derivatives data OUTSIDE the Claude sandbox.
# Called by the workflow before Claude runs (via the generic
# scripts/prefetch-*.sh loop). Saves JSON responses to .coinglass-cache/
# so perps-scan can read cached results instead of calling curl directly
# (curl with $COINGLASS_API_KEY in headers is blocked by the sandbox).
#
# v2.3 (post-tier-probe): coins-markets is tier-gated, so universe ranking
# moves to CoinGecko /derivatives, and per-coin metrics use the seven
# Coinglass endpoints confirmed accessible on the Startup tier.
#
# Usage: ./scripts/prefetch-coinglass.sh <skill-name> [var]
#   skill-name: e.g. "perps-scan" — gates the fetch
#   var:        optional comma-separated ticker override, e.g. "HYPE,TAO,AVAX"
#
# Cache layout (all JSON):
#   .coinglass-cache/cg-derivatives.json — CoinGecko /derivatives (universe + 24h vol)
#   .coinglass-cache/price-<COIN>.json   — Binance per-exchange daily price history (8d)
#   .coinglass-cache/price-1h-<COIN>.json — Binance per-exchange hourly price (last 8h, for pct_4h v3 derivation)
#   .coinglass-cache/oi-<COIN>.json      — aggregated OI history (8d)
#   .coinglass-cache/funding-<COIN>.json — OI-weight funding history (21x8h = 7d)
#   .coinglass-cache/liq-<COIN>.json     — aggregated liquidation history with exchange_list (8d)
#   .coinglass-cache/topls-<COIN>.json   — top-trader long/short position ratio (8d)
#   .coinglass-cache/basis-<COIN>.json   — futures-spot basis history (8d)
#   .coinglass-cache/taker-<COIN>.json   — taker buy/sell volume history (8d)
#   .coinglass-cache/manifest.json       — { fetched_at, universe_ok, asset_list, per_coin_errors }
#
# Closes ISS-001 (sandbox-limitation), ISS-002 (coins-markets tier-gated — superseded).
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
  # Path B PR2: hourly engine poller reads the same cache to evaluate
  # per-trade conditions. Same data structure, same prefetch pipeline.
  engine-poller) ;;
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
    # Coinglass returns 429 OR HTTP 200 + code != "0" + msg="Too Many Requests".
    # Both indicate rate-limit; retry with exponential backoff (5s, 15s, 30s, 60s — total 110s wall time max).
    cg_rate_limited=false
    if [ "$http_code" = "429" ]; then
      cg_rate_limited=true
    elif [ "$http_code" = "200" ] && echo "$response" | jq -e '.msg | tostring | test("Too Many Requests"; "i")' >/dev/null 2>&1; then
      cg_rate_limited=true
    fi
    if [ "$cg_rate_limited" = "true" ] && [ "$attempt" -lt 5 ]; then
      backoff=$(( 5 * (3 ** (attempt - 1)) ))  # 5, 15, 45, 135 → cap at 60
      [ "$backoff" -gt 60 ] && backoff=60
      echo "coinglass-prefetch: rate-limited on $(basename "$outfile") (attempt $attempt), backing off ${backoff}s then retrying"
      sleep "$backoff"
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

# --- 1. Fetch universe from CoinGecko /derivatives ---
# Coinglass coins-markets is tier-gated on Startup (confirmed by coinglass-probe).
# CoinGecko /derivatives is free at the Demo tier (30 req/min), returns every
# perpetual contract across all major exchanges with volume_24h — gives us a
# truly dynamic, multi-venue universe ranking.
CG_BASE="https://api.coingecko.com/api/v3"
DERIVATIVES_FILE="$CACHE/cg-derivatives.json"
echo "coinglass-prefetch: fetching universe from CoinGecko /derivatives ..."

cg_curl_args=(-s --max-time 30 -w "\n__HTTP_CODE__%{http_code}" -H "accept: application/json")
[ -n "${COINGECKO_API_KEY:-}" ] && cg_curl_args+=(-H "x-cg-demo-api-key: $COINGECKO_API_KEY")

cg_resp=$(curl "${cg_curl_args[@]}" "${CG_BASE}/derivatives" 2>&1) || cg_resp="__CURL_ERR__"
CG_HTTP=$(echo "$cg_resp" | grep '__HTTP_CODE__' | sed 's/__HTTP_CODE__//')
CG_BODY=$(echo "$cg_resp" | grep -v '__HTTP_CODE__')

if [ "$cg_resp" = "__CURL_ERR__" ] || [ "$CG_HTTP" != "200" ]; then
  echo "::warning::coinglass-prefetch: CoinGecko /derivatives failed (HTTP ${CG_HTTP:-curl-err}) — universe unavailable"
  jq -n --arg fetched_at "$(date -u +%FT%TZ)" --arg cg_http "${CG_HTTP:-curl-err}" \
    '{fetched_at: $fetched_at, universe_ok: false, universe_source: "coingecko-derivatives", cg_http: $cg_http, asset_list: [], per_coin_errors: []}' \
    > "$CACHE/manifest.json"
  exit 0
fi
echo "$CG_BODY" > "$DERIVATIVES_FILE"
echo "coinglass-prefetch: saved cg-derivatives.json ($(wc -c < "$DERIVATIVES_FILE" | tr -d ' ') bytes, $(jq 'length' "$DERIVATIVES_FILE") rows)"

# --- 2. Build asset list (VAR override OR top 25 by aggregated perp 24h volume) ---
if [ -n "$VAR" ]; then
  ASSET_LIST=$(echo "$VAR" | tr ',' '\n' | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]' | grep -v '^$' | sort -u)
  echo "coinglass-prefetch: using VAR override asset list: $(echo "$ASSET_LIST" | tr '\n' ' ')"
else
  # Filter to perpetual contracts on the three majors Coinglass aggregates
  # (Binance / OKX / Bybit) and where the symbol is USDT-margined — guarantees
  # the per-coin Binance per-exchange endpoints (price, top-L/S, basis, taker)
  # have a chance of returning data. Without this filter the universe pulls in
  # coins primarily traded on Bitget/MEXC/Gate/BingX, which Coinglass aggregated
  # endpoints may not cover, leading to high drop rate downstream.
  #
  # Group by index_id (coin ticker), sum 24h volume across the three majors,
  # rank desc, take top 25. CoinGecko volume_24h sometimes arrives as a string.
  TOP=$(jq -r '
    [.[] | select(
      .contract_type == "perpetual"
      and .index_id != null
      and .volume_24h != null
      and (.market | tostring | test("(Binance|OKX|Bybit)"; "i"))
      and (.symbol  | tostring | test("USDT"; "i"))
    ) |
      {index_id, vol: (.volume_24h | tonumber? // 0)}] |
    group_by(.index_id) |
    map({index_id: .[0].index_id, total_vol: ([.[].vol] | add)}) |
    map(select(.total_vol > 0)) |
    sort_by(.total_vol) | reverse | .[0:25] | .[].index_id
  ' "$DERIVATIVES_FILE")

  # Pull our currently-tracked assets from the ledger (open[] + watchlist[]).
  # Without this, anything below the top-25-by-volume cutoff (often the case
  # for our smaller-cap positions like ICP/SEI/INJ) never gets cached and the
  # engine-poller reports 60%+ missing_data. Adding ledger assets unconditionally
  # guarantees full coverage regardless of where they rank by perp volume.
  #
  # Fail-soft: if jq or the ledger file isn't available, drop to top-25-only.
  LEDGER_ASSETS=""
  if [ -f "memory/topics/state/active-setups.json" ]; then
    LEDGER_ASSETS=$(jq -r '
      ((.open // []) + (.watchlist // [])) |
      map(.asset // empty) |
      map(ascii_upcase) |
      unique |
      .[]
    ' "memory/topics/state/active-setups.json" 2>/dev/null || true)
  fi

  # Order:
  #   1. Tier 1 (BTC, ETH, SOL) — always succeed
  #   2. Ledger assets — guarantees coverage for our actual positions/watchlist
  #   3. Top 25 by volume — fills the rest of the universe
  # awk dedup preserves first-seen ordering — no sort -u shuffling.
  ASSET_LIST=$(printf 'BTC\nETH\nSOL\n%s\n%s\n' "$LEDGER_ASSETS" "$TOP" | awk 'NF && !seen[$0]++')
  N_LEDGER=$(printf '%s\n' "$LEDGER_ASSETS" | grep -v '^$' | wc -l | tr -d ' ')
  echo "coinglass-prefetch: universe = Tier 1 + $N_LEDGER ledger asset(s) + top 25 by Binance/OKX/Bybit USDT-perp aggregated 24h volume ($(echo "$ASSET_LIST" | wc -l | tr -d ' ') coins total)"
fi

# --- 3. Per-coin Coinglass fetches (7 endpoints per coin, tier-confirmed accessible) ---
PER_COIN_ERRORS="[]"
for COIN in $ASSET_LIST; do
  COIN_ERRORS=""
  SYM_AGG="$COIN"            # aggregated endpoints expect coin ticker (BTC)
  SYM_PER="${COIN}USDT"      # per-exchange endpoints expect pair (BTCUSDT on Binance USDT-perp)
  for KIND_SPEC in \
    "price:$BASE/api/futures/price/history?exchange=Binance&symbol=${SYM_PER}&interval=1d&limit=8" \
    "price-1h:$BASE/api/futures/price/history?exchange=Binance&symbol=${SYM_PER}&interval=1h&limit=8" \
    "oi:$BASE/api/futures/open-interest/aggregated-history?symbol=${SYM_AGG}&interval=1d&limit=8" \
    "funding:$BASE/api/futures/funding-rate/oi-weight-history?symbol=${SYM_AGG}&interval=8h&limit=21" \
    "liq:$BASE/api/futures/liquidation/aggregated-history?symbol=${SYM_AGG}&exchange_list=Binance,OKX&interval=1d&limit=8" \
    "topls:$BASE/api/futures/top-long-short-position-ratio/history?exchange=Binance&symbol=${SYM_PER}&interval=1d&limit=8" \
    "basis:$BASE/api/futures/basis/history?exchange=Binance&symbol=${SYM_PER}&interval=1d&limit=8" \
    "taker:$BASE/api/futures/taker-buy-sell-volume/history?exchange=Binance&symbol=${SYM_PER}&interval=1d&limit=8"
  do
    KIND="${KIND_SPEC%%:*}"
    URL="${KIND_SPEC#*:}"
    if ! cg_get "$CACHE/${KIND}-${COIN}.json" "$URL"; then
      COIN_ERRORS="${COIN_ERRORS}${KIND},"
    fi
    sleep 0.1
  done
  if [ -n "$COIN_ERRORS" ]; then
    COIN_ERRORS="${COIN_ERRORS%,}"
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
  '{fetched_at: $fetched_at, universe_ok: true, universe_source: "coingecko-derivatives", asset_list: $asset_list, per_coin_errors: $per_coin_errors}' \
  > "$CACHE/manifest.json"

ERROR_COUNT=$(echo "$PER_COIN_ERRORS" | jq 'length')
echo "coinglass-prefetch: done — $(echo "$ASSET_LIST_JSON" | jq 'length') coins, $ERROR_COUNT with per-endpoint errors"
ls -la "$CACHE/" 2>/dev/null | head -5 || true

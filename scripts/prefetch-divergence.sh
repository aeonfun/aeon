#!/usr/bin/env bash
# Prefetch — spot/perps divergence per asset.
#
# Pulls CoinGecko /coins/markets (top 250 by market cap, current_price
# included) in a single call. Reads the Coinglass cache populated
# earlier in the same workflow run (.coinglass-cache/price-1h-{COIN}.json
# for current perps mark, .coinglass-cache/basis-{COIN}.json for the
# basis annual rate).
#
# Writes per-asset snapshots to .divergence-cache/{ASSET}.json so
# downstream skills (perps-scan, perps-brief) can read them.
#
# This script is data plumbing only — it does NOT classify regimes.
# Claude reads the cached snapshots and applies its own judgement.
#
# Universe: BTC + ETH + SOL + ledger.open + ledger.watchlist (matches
# the prefetch-coinglass.sh ledger-asset query introduced in PR #65).
#
# Gated to skills that consume divergence: perps-scan, perps-brief,
# engine-poller. Other skills exit 0 immediately.

set -euo pipefail

SKILL="${1:-}"
case "$SKILL" in
  perps-scan|perps-brief|engine-poller) ;;
  *)
    echo "prefetch-divergence: no prefetch defined for skill '$SKILL'"
    exit 0
    ;;
esac

echo "prefetch-divergence: starting for skill=$SKILL"

CACHE_DIR=".divergence-cache"
COINGLASS_CACHE_DIR=".coinglass-cache"
LEDGER_PATH="memory/topics/state/active-setups.json"
NOW_ISO=$(date -u +%FT%TZ)

mkdir -p "$CACHE_DIR"

# --- Universe construction ---
# Mirrors the jq pattern in prefetch-coinglass.sh (PR #65) — pull ledger
# assets, uppercase, dedupe. Prepend Tier 1 majors so they're always present.
LEDGER_ASSETS=""
if [ -f "$LEDGER_PATH" ]; then
  LEDGER_ASSETS=$(jq -r '
    ((.open // []) + (.watchlist // [])) |
    map(.asset // empty) |
    map(ascii_upcase) |
    unique |
    .[]
  ' "$LEDGER_PATH" 2>/dev/null || true)
fi

# awk preserves first-seen order and dedupes
UNIVERSE=$(printf 'BTC\nETH\nSOL\n%s\n' "$LEDGER_ASSETS" | awk 'NF && !seen[$0]++')
UNIVERSE_LIST=$(echo "$UNIVERSE" | tr '\n' ' ')
UNIVERSE_COUNT=$(echo "$UNIVERSE" | wc -l | tr -d ' ')
echo "prefetch-divergence: universe ($UNIVERSE_COUNT) = $UNIVERSE_LIST"

# --- CoinGecko /coins/markets fetch ---
# Single call returns top-250 coins with symbol + current_price + market_cap
# in market_cap_desc order. We index by symbol below.
CG_BASE="https://api.coingecko.com/api/v3"
CG_MARKETS_FILE="$CACHE_DIR/_cg-markets.json"

cg_curl_args=(-s -m 30 -w "\n%{http_code}")
if [ -n "${COINGECKO_API_KEY:-}" ]; then
  cg_curl_args+=(-H "x-cg-demo-api-key: $COINGECKO_API_KEY")
fi

CG_RESPONSE=$(curl "${cg_curl_args[@]}" \
  "$CG_BASE/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1" \
  2>/dev/null || printf '\n000')

CG_HTTP=$(echo "$CG_RESPONSE" | tail -1)
CG_BODY=$(echo "$CG_RESPONSE" | sed '$d')

if [ "$CG_HTTP" != "200" ] || ! echo "$CG_BODY" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "prefetch-divergence: CoinGecko /coins/markets HTTP=$CG_HTTP — aborting (no spot prices)"
  exit 0
fi

echo "$CG_BODY" > "$CG_MARKETS_FILE"
CG_COUNT=$(echo "$CG_BODY" | jq 'length')
echo "prefetch-divergence: CoinGecko markets fetched ($CG_COUNT entries)"

# --- Per-asset snapshot generation ---
WRITTEN=0
SKIPPED_NO_SPOT=0
SKIPPED_NO_PERPS=0

for ASSET in $UNIVERSE; do
  # 1. CoinGecko spot lookup by uppercase(symbol). Take first match
  #    (markets is sorted by market_cap_desc, so this prefers the
  #    highest-mcap coin on a symbol collision).
  SPOT_DATA=$(echo "$CG_BODY" | jq --arg sym "$ASSET" '
    [.[] | select(.symbol != null) | select((.symbol | ascii_upcase) == $sym)] | .[0]
  ' 2>/dev/null)

  SPOT_USD=$(echo "$SPOT_DATA" | jq -r '.current_price // empty' 2>/dev/null)
  SPOT_ID=$(echo "$SPOT_DATA" | jq -r '.id // empty' 2>/dev/null)

  if [ -z "$SPOT_USD" ] || [ "$SPOT_USD" = "null" ]; then
    echo "  $ASSET: skip — no CoinGecko spot price"
    SKIPPED_NO_SPOT=$((SKIPPED_NO_SPOT + 1))
    continue
  fi

  # 2. Coinglass perps mark from cached 1h price (newest hour, mean across
  #    Binance/OKX/Bybit exchanges if present).
  PRICE_1H_FILE="$COINGLASS_CACHE_DIR/price-1h-$ASSET.json"
  PERPS_MARK=""
  if [ -f "$PRICE_1H_FILE" ]; then
    # Coinglass /price/aggregated-history returns {data: [{time, close}, ...]}
    # ordered oldest-first. Take the latest close.
    PERPS_MARK=$(jq -r '
      if (.data | type) == "array" and (.data | length) > 0
      then .data[-1].close // empty
      else empty
      end
    ' "$PRICE_1H_FILE" 2>/dev/null || true)
  fi

  if [ -z "$PERPS_MARK" ] || [ "$PERPS_MARK" = "null" ]; then
    echo "  $ASSET: skip — no Coinglass perps mark (cache file $PRICE_1H_FILE missing or empty)"
    SKIPPED_NO_PERPS=$((SKIPPED_NO_PERPS + 1))
    continue
  fi

  # 3. Coinglass basis APR (latest value from 8d daily series, if present).
  BASIS_FILE="$COINGLASS_CACHE_DIR/basis-$ASSET.json"
  BASIS_APR="null"
  if [ -f "$BASIS_FILE" ]; then
    # Coinglass /futures/basis/history returns {data: [{time, basis, ...}, ...]}
    # `basis` here is an annualized percentage. Take the most recent value.
    BASIS_RAW=$(jq -r '
      if (.data | type) == "array" and (.data | length) > 0
      then .data[-1].basis // empty
      else empty
      end
    ' "$BASIS_FILE" 2>/dev/null || true)
    if [ -n "$BASIS_RAW" ] && [ "$BASIS_RAW" != "null" ]; then
      BASIS_APR="$BASIS_RAW"
    fi
  fi

  # 4. Compute divergence_pct deterministically.
  DIVERGENCE_PCT=$(python3 -c "
spot = float('$SPOT_USD')
perps = float('$PERPS_MARK')
if spot > 0:
    print(round((perps - spot) / spot * 100, 4))
else:
    print('null')
")

  if [ "$DIVERGENCE_PCT" = "null" ]; then
    echo "  $ASSET: skip — spot price is zero or invalid"
    continue
  fi

  # 5. Compose snapshot and write.
  OUT_FILE="$CACHE_DIR/$ASSET.json"
  python3 - <<PY > "$OUT_FILE"
import json
snap = {
    "asset": "$ASSET",
    "ts_utc": "$NOW_ISO",
    "spot_usd": float("$SPOT_USD"),
    "perps_mark_usd": float("$PERPS_MARK"),
    "divergence_pct": float("$DIVERGENCE_PCT"),
    "basis_apr": (None if "$BASIS_APR" == "null" else float("$BASIS_APR")),
    "spot_source": "coingecko:$SPOT_ID",
    "perps_source": "coinglass:price-1h-aggregated",
}
print(json.dumps(snap, indent=2, ensure_ascii=False))
PY

  WRITTEN=$((WRITTEN + 1))
  printf "  %-8s spot=\$%-12s perps=\$%-12s div=%6s%%  basis=%s\n" \
    "$ASSET" "$SPOT_USD" "$PERPS_MARK" "$DIVERGENCE_PCT" "$BASIS_APR"
done

# --- Manifest ---
cat > "$CACHE_DIR/manifest.json" <<EOF
{
  "fetched_at": "$NOW_ISO",
  "skill": "$SKILL",
  "universe_size": $UNIVERSE_COUNT,
  "written": $WRITTEN,
  "skipped_no_spot": $SKIPPED_NO_SPOT,
  "skipped_no_perps": $SKIPPED_NO_PERPS,
  "coingecko_count": $CG_COUNT
}
EOF

echo "prefetch-divergence: done — $WRITTEN written, $SKIPPED_NO_SPOT no-spot, $SKIPPED_NO_PERPS no-perps"

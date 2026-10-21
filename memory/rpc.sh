#!/usr/bin/env bash
# memory/rpc.sh — 链上取数助手。供 onchain-monitor 等 skill 复用，避免每次现写脚本。
#
# 用法：
#   bash memory/rpc.sh getlogs --chain base|rh --address 0x.. [--topic0 0x..] [--from N] [--to N|latest]
#   bash memory/rpc.sh call    --chain base|rh --to 0x.. --data 0x..
#   bash memory/rpc.sh block   --chain base|rh
#   bash memory/rpc.sh hex2dec 0x1234...
#   bash memory/rpc.sh dec2hex 1234...
#   bash memory/rpc.sh scale <整数> <decimals>      # 按 decimals 折算成人类可读小数
#
# 行为：
#   - getlogs 自动分窗；某窗失败（400/413 = 范围过大或结果超限）时自动把窗口减半重试
#   - 所有失败都把 HTTP 状态码 + 错误体前 200 字符打到 stderr
#   - 端点优先 $BASE_RPC_URL / $RH_RPC_URL；缺失时告警并退回公共 RPC
#   - 单次调用上限 $MAX_CALLS（默认 150），超了打印 PROGRESS 行供续扫
set -uo pipefail

FALLBACK_base="https://base.gateway.tenderly.co"
FALLBACK_rh="https://rpc.mainnet.chain.robinhood.com"
WINDOW_base="${WINDOW_base:-2000}"
WINDOW_rh="${WINDOW_rh:-30000}"
MAX_CALLS="${MAX_CALLS:-150}"

log() { printf '%s\n' "$*" >&2; }

endpoint() {
  local c="$1" url var
  case "$c" in
    base) url="${BASE_RPC_URL:-}"; var=BASE_RPC_URL ;;
    rh)   url="${RH_RPC_URL:-}";   var=RH_RPC_URL ;;
    *) log "unknown chain: $c"; return 1 ;;
  esac
  if [ -z "$url" ]; then
    log "WARN: \$$var 为空（env 未挂载）→ 退回公共 RPC"
    case "$c" in base) url="$FALLBACK_base" ;; rh) url="$FALLBACK_rh" ;; esac
  fi
  printf '%s' "$url"
}

hex2dec() { node -e 'console.log(BigInt(process.argv[1]).toString())' "$1"; }
dec2hex() { node -e 'console.log("0x"+BigInt(process.argv[1]).toString(16))' "$1"; }
scale()   { node -e 'const[a,d]=process.argv.slice(1);const s=BigInt(10)**BigInt(d);const v=BigInt(a);const f=(v%s)*1000000n/s;console.log((v/s).toString()+"."+f.toString().padStart(6,"0"))' "$1" "$2"; }

# rpc <url> <method> <params-json> → stdout 只输出 .result（compact JSON）
rpc() {
  local url="$1" method="$2" params="$3" body resp code
  body=$(jq -nc --arg m "$method" --argjson p "$params" '{jsonrpc:"2.0",id:1,method:$m,params:$p}')
  resp=$(curl -s -m 30 -w '\n%{http_code}' -X POST "$url" -H 'Content-Type: application/json' -d "$body")
  code=$(printf '%s' "$resp" | tail -n1)
  resp=$(printf '%s' "$resp" | sed '$d')
  if [ "$code" != "200" ]; then
    log "HTTP $code | $method | $(printf '%s' "$resp" | head -c 200)"
    return 1
  fi
  if printf '%s' "$resp" | jq -e '.error' >/dev/null 2>&1; then
    log "RPC error | $method | $(printf '%s' "$resp" | jq -c '.error' | head -c 200)"
    return 1
  fi
  printf '%s' "$resp" | jq -c '.result'
}

cmd_block() {
  local url; url=$(endpoint "$1") || return 1
  rpc "$url" eth_blockNumber '[]' | hex2dec "$(cat)"
}

cmd_call() {
  local chain="" to="" data=""
  while [ $# -gt 0 ]; do case "$1" in
    --chain) chain="$2"; shift 2 ;; --to) to="$2"; shift 2 ;; --data) data="$2"; shift 2 ;;
    *) log "unknown arg: $1"; return 1 ;; esac; done
  local url; url=$(endpoint "$chain") || return 1
  local p; p=$(jq -nc --arg t "$to" --arg d "$data" '[{to:$t,data:$d},"latest"]')
  rpc "$url" eth_call "$p"
}

cmd_getlogs() {
  local chain="" address="" topic0="" from="" to="latest"
  while [ $# -gt 0 ]; do case "$1" in
    --chain) chain="$2"; shift 2 ;; --address) address="$2"; shift 2 ;;
    --topic0) topic0="$2"; shift 2 ;; --from) from="$2"; shift 2 ;; --to) to="$2"; shift 2 ;;
    *) log "unknown arg: $1"; return 1 ;; esac; done
  [ -n "$chain" ] && [ -n "$address" ] || { log "need --chain and --address"; return 1; }

  local url; url=$(endpoint "$chain") || return 1
  local topics='[]'; [ -n "$topic0" ] && topics=$(jq -nc --arg t "$topic0" '[$t]')

  local from_n to_n
  from_n=$(hex2dec "$from")
  if [ "$to" = "latest" ]; then to_n=$(cmd_block "$chain"); else to_n=$(hex2dec "$to"); fi

  local tmp; tmp=$(mktemp)
  local win="$(eval echo \$WINDOW_$chain)"
  local lo="$from_n" calls=0
  while [ "$lo" -le "$to_n" ]; do
    local hi=$(( lo + win - 1 )); [ "$hi" -gt "$to_n" ] && hi="$to_n"
    local p; p=$(jq -nc --arg a "$address" --argjson t "$topics" \
      --arg f "$(dec2hex "$lo")" --arg tb "$(dec2hex "$hi")" \
      '[{address:$a,topics:$t,fromBlock:$f,toBlock:$tb}]')
    if rpc "$url" eth_getLogs "$p" >/tmp/.rpcres.$$ 2>/tmp/.rpcerr.$$; then
      cat /tmp/.rpcres.$$ >> "$tmp"; lo=$(( hi + 1 ))
    else
      cat /tmp/.rpcerr.$$ >&2
      if [ "$win" -le 200 ]; then log "SKIP window at $lo (win=200 already)"; lo=$(( hi + 1 ));
      else win=$(( win / 2 )); log "retry with window=$win at block $lo"; fi
    fi
    calls=$(( calls + 1 ))
    if [ "$calls" -ge "$MAX_CALLS" ]; then
      log "PROGRESS: MAX_CALLS=$MAX_CALLS reached at block $lo (to=$to_n) — 下次从 $lo 续扫"
      break
    fi
  done
  rm -f /tmp/.rpcres.$$ /tmp/.rpcerr.$$
  log "getlogs done: chain=$chain calls=$calls final_window=$win range=$from_n..$to_n"
  jq -s 'add // []' "$tmp"; rm -f "$tmp"
}

case "${1:-}" in
  getlogs) shift; cmd_getlogs "$@" ;;
  call)    shift; cmd_call "$@" ;;
  block)   shift; cmd_block "$@" ;;
  hex2dec) shift; hex2dec "$1" ;;
  dec2hex) shift; dec2hex "$1" ;;
  scale)   shift; scale "$1" "$2" ;;
  *) sed -n '2,20p' "$0"; exit 1 ;;
esac

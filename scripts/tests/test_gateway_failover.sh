#!/usr/bin/env bash
# Tests for scripts/gateway-failover.sh. Run: bash scripts/tests/test_gateway_failover.sh
# The claude gateway cascade re-runs the whole skill on the next provider, so it may
# only fail over on a provider-shaped failure: never on a timeout or a skill-side error.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
S="scripts/gateway-failover.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

# expect <want: over|stop> <desc> <rc> <stderr text, or __none__ for no file>
expect() {
  local f="$T/err.txt"; rm -f "$f"
  [ "$4" = "__none__" ] || printf '%s\n' "$4" > "$f"
  if bash "$S" "$3" "$f"; then got=over; else got=stop; fi
  [ "$got" = "$1" ] && pass "$2" || bad "$2 (want $1, got $got)"
}

expect stop "timeout 124 never fails over"            124 'error: harness run exceeded --timeout 1800s'
expect stop "timeout 124 with an API error still stops" 124 'API Error: 529 overloaded'
expect stop "success is not a failover"               0   ''
expect over "gateway setup failed (no stderr file)"    1   __none__
expect over "claude 401 auth error"                    1   'claude exited 1: {"is_error":true,"api_error_status":401,"result":"Invalid API key"}'
expect over "credit exhausted"                         1   'claude exited 1: {"result":"Credit balance is too low"}'
expect over "rate limited"                             1   'API Error: 429 rate_limit_error'
expect over "connection refused"                       1   'API Error: Connection error. ECONNREFUSED'
expect stop "max-turns / skill-side failure"           1   'claude exited 1: {"subtype":"error_max_turns","is_error":true,"num_turns":40}'
expect stop "contract failure without provider error"  3   'error: adapter output failed contract validation; rejecting raw output'

[ "$fail" -eq 0 ] && echo "PASS test_gateway_failover" || { echo "FAILURES in test_gateway_failover"; exit 1; }

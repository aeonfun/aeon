#!/usr/bin/env bash
# A completed dev-loop with no verified PR must be neither a success nor failure
# in cron-state reliability accounting. Exercise workflow blocks verbatim.
set -uo pipefail

WORKFLOW="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.github/workflows/chain-runner.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

awk '
  /^          # --- Final status ---$/ { on=1; next }
  on && /^      - name: Update cron state$/ { exit }
  on { print }
' "$WORKFLOW" | sed 's/^          //' > "$TMP/status.sh"
grep -q 'CHAIN_NO_ACTION' "$TMP/status.sh" && grep -q 'CHAIN_STATUS=success' "$TMP/status.sh" \
  || { echo "FAIL: final-status extraction anchor drifted" >&2; exit 1; }

awk '
  /^          # env-bound \+ allowlisted, same as the Run chain step\./ { on=1 }
  on && /^          STATE_FILE="memory\/cron-state\.json"$/ { exit }
  on { print }
' "$WORKFLOW" | sed 's/^          //' > "$TMP/guard.sh"
grep -q 'invalid-dispatch' "$TMP/guard.sh" && grep -q 'no-action' "$TMP/guard.sh" && grep -q 'proof-missing' "$TMP/guard.sh" \
  || { echo "FAIL: cron-state extraction anchor drifted" >&2; exit 1; }
printf 'echo REACHED_STATE_WRITE\n' >> "$TMP/guard.sh"

run_status() {
  local failed="$1" no_action="$2" proof_missing="${3:-false}" env_file="$TMP/env"
  : > "$env_file"
  CHAIN="dev-loop" CHAIN_FAILED="$failed" CHAIN_NO_ACTION="$no_action" \
    CHAIN_PROOF_MISSING="$proof_missing" \
    GITHUB_ENV="$env_file" bash "$TMP/status.sh"
  STATUS_RESULT="$(sed -n 's/^CHAIN_STATUS=//p' "$env_file" | tail -1)"
}

run_guard() {
  _INPUT_CHAIN="dev-loop" CHAIN_STATUS="$1" bash "$TMP/guard.sh"
}

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

run_status false true
[ "$STATUS_RESULT" = "no-action" ] && pass "no-action emits its own status" \
  || bad "no-action emitted $STATUS_RESULT"
out=$(run_guard "$STATUS_RESULT")
echo "$out" | grep -q 'REACHED_STATE_WRITE' \
  && bad "no-action reached cron-state write" \
  || pass "no-action skips cron-state reliability write"

run_status true false
[ "$STATUS_RESULT" = "failed" ] && pass "failure status is unchanged" \
  || bad "failure emitted $STATUS_RESULT"
out=$(run_guard "$STATUS_RESULT")
echo "$out" | grep -q 'REACHED_STATE_WRITE' \
  && pass "failure still reaches cron-state write" \
  || bad "failure did not reach cron-state write"

run_status false false true
[ "$STATUS_RESULT" = "proof-missing" ] && pass "missing proof emits its own status" \
  || bad "missing proof emitted $STATUS_RESULT"
out=$(run_guard "$STATUS_RESULT")
echo "$out" | grep -q 'REACHED_STATE_WRITE' \
  && bad "proof-missing reached cron-state write" \
  || pass "proof-missing skips cron-state reliability write"

run_status false false
[ "$STATUS_RESULT" = "success" ] && pass "success status is unchanged" \
  || bad "success emitted $STATUS_RESULT"
out=$(run_guard "$STATUS_RESULT")
echo "$out" | grep -q 'REACHED_STATE_WRITE' \
  && pass "success still reaches cron-state write" \
  || bad "success did not reach cron-state write"

echo "---"
[ "$fail" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

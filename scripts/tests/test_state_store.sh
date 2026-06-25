#!/usr/bin/env bash
# Live integration test for scripts/state_store.sh — proves concurrent appends to the
# Issues-backed state store do NOT conflict (the whole point vs the file + rebase loop).
# Creates and closes a throwaway issue, so it's gated:
#   STATE_STORE_LIVE=1 GH_REPO=<owner>/<repo> bash scripts/tests/test_state_store.sh
# SKIPS otherwise (no gh auth, or flag unset).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
  echo "SKIP - gh not installed/authenticated"; exit 0
fi
if [ -z "${STATE_STORE_LIVE:-}" ]; then
  echo "SKIP - set STATE_STORE_LIVE=1 (and GH_REPO) to run; creates + closes a test issue"; exit 0
fi
: "${GH_REPO:?set GH_REPO to a test repo (e.g. you/aeon-dev)}"
export GH_REPO

fail=0; pass(){ echo "ok   - $1"; }; bad(){ echo "FAIL - $1"; fail=1; }
S="scripts/state_store.sh"

TITLE="aeon-state-test-$$-$(date +%s)"
N=$(bash "$S" ensure "$TITLE")
if [ -n "$N" ]; then pass "created state issue #$N"; else bad "create state issue"; echo "SOME FAILED"; exit 1; fi

# two CONCURRENT appends — independent comments, no read-modify-write race
bash "$S" append "$N" '{"skill":"alpha","status":"success","ts":"2026-06-17T10:00:00Z","quality_score":4}' &
bash "$S" append "$N" '{"skill":"alpha","status":"failed","ts":"2026-06-17T11:00:00Z","error":"boom"}' &
bash "$S" append "$N" '{"skill":"beta","status":"success","ts":"2026-06-17T10:30:00Z"}' &
wait

STATE=$(bash "$S" read "$N")
if echo "$STATE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert d['alpha']['total_runs']==2, d
assert d['alpha']['last_status']=='failed', d
assert d['alpha']['success_rate']==0.5, d
assert d['beta']['total_runs']==1, d
" 2>/dev/null; then
  pass "3 concurrent appends landed + folded correctly (no conflict, no rebase)"
else
  bad "concurrent appends fold: $STATE"
fi

gh issue close "$N" -c "test complete" >/dev/null 2>&1 && pass "closed test issue #$N" || bad "close issue #$N"

echo "---"; [ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"; exit "$fail"

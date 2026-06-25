#!/usr/bin/env bash
# Live integration test for scripts/health_issue.sh — ensure/comment + vote round-trip.
# Gated (creates + closes a throwaway issue, adds a reaction):
#   HEALTH_ISSUE_LIVE=1 GH_REPO=<owner>/<repo> bash scripts/tests/test_health_issue.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
  echo "SKIP - gh not installed/authenticated"; exit 0
fi
if [ -z "${HEALTH_ISSUE_LIVE:-}" ]; then
  echo "SKIP - set HEALTH_ISSUE_LIVE=1 (and GH_REPO) to run; creates + closes a test issue"; exit 0
fi
: "${GH_REPO:?set GH_REPO}"; export GH_REPO
fail=0; pass(){ echo "ok   - $1"; }; bad(){ echo "FAIL - $1"; fail=1; }
H="scripts/health_issue.sh"

SKILL="zz-health-test-$$-$(date +%s)"
N=$(bash "$H" ensure "$SKILL")
[ -n "$N" ] && pass "created health issue #$N" || { bad "ensure"; echo SOME FAILED; exit 1; }

bash "$H" comment "$N" "Regression: score 1, flags [api_error] on $(date -u +%FT%TZ)" \
  && pass "posted regression comment" || bad "comment"

V0=$(bash "$H" votes "$N")
[ "$V0" = "0" ] && pass "initial votes = 0" || bad "initial votes (got $V0)"

# react 👍 as the authenticated user, then re-read
gh api "repos/{owner}/{repo}/issues/$N/reactions" -f content=+1 >/dev/null 2>&1
sleep 1
V1=$(bash "$H" votes "$N")
[ "$V1" = "1" ] && pass "vote registered (net = 1)" || bad "vote after 👍 (got $V1)"

gh issue close "$N" -c "test complete" >/dev/null 2>&1 && pass "closed issue #$N" || bad "close"
echo "---"; [ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"; exit "$fail"

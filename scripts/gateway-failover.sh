#!/usr/bin/env bash
# gateway-failover - should the claude gateway cascade (aeon.yml Run step) retry a
# failed attempt on the NEXT provider? Exit 0 = fail over, 1 = stop here.
#
# A retry re-runs the WHOLE skill, so it is only safe when the failure was the
# provider's, not the skill's. Failing over on any non-zero exit doubled a
# 30-min timeout past the 50-min job wall and repeated irreversible in-run actions
# (notifies, PRs, emails, onchain txs) on the second provider.
#
#   fail over : the attempt never reached the harness (gateway setup failed, so no
#               stderr file was written), or the harness stderr carries a
#               provider/auth/credit/rate/connection error signature.
#   stop      : wall-clock timeout (run-harness exit 124), or any other failure
#               (max-turns, contract/parse error, a skill-side crash).
#
# Usage: gateway-failover.sh <attempt-exit-code> <harness-stderr-file>
set -uo pipefail
rc="${1:?attempt exit code required}"
err="${2:?harness stderr file required}"

[ "$rc" -eq 0 ] && exit 1     # nothing failed
[ "$rc" -eq 124 ] && exit 1   # timeout: the skill ran its full budget
[ -e "$err" ] || exit 0       # harness never started (provider setup failed)

grep -qiE 'api_error_status|API Error|authentication|unauthori[sz]ed|invalid[ _-]?(api[ _-]?)?key|/login|credit balance|insufficient[ _-]?(credit|funds|balance|quota)|payment required|billing|quota|rate[ _-]?limit|overloaded|Connection error|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|fetch failed' "$err"

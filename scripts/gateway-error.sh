#!/usr/bin/env bash
# gateway-error - one short line saying why a claude gateway attempt failed, for
# the cascade in the aeon.yml Run step. The step joins one line per failed
# attempt into the saved error (/tmp/skill-error.txt: cron state, the run_ok
# score comment), e.g.
#   claude: You've hit your weekly limit · resets Oct 20, 5pm (UTC) | glm: API Error: 429 ...
# Before this the saved error was the tail of the LAST attempt's stderr, so a
# spent Claude plan behind a dead fallback read as "[claude-code:unrecognized_model]
# ... exceeded --timeout 1800s", with no word of the plan limit.
#
# Reason, first that applies:
#   0. with an [envelope-file] (the harness's stdout, non-claude path): its error
#      text, .result of an is_error envelope or .error (string or .message).
#   1. the result text of the attempt's JSON envelope (the claude adapter echoes
#      it on stderr as "claude exited N: {...}"); Claude Code puts the API error
#      there, e.g. "You've hit your weekly limit ...".
#   2. "timeout" for a run-harness wall-clock timeout (exit 124).
#   3. the last stderr line that is not a Claude Code notice or a log annotation.
#   4. "exit <code>".
# Each reason is cut to 140 characters and kept on one line.
#
# Never a byte slice of the raw stream: that saved cut JSON fragments as last_error.
#
# Usage: gateway-error.sh <provider> <attempt-exit-code> <harness-stderr-file> [envelope-file]
set -uo pipefail
provider="${1:?provider required}"
rc="${2:?attempt exit code required}"
err="${3:?harness stderr file required}"
env_file="${4:-}"

reason=""
if [ -n "$env_file" ] && [ -s "$env_file" ]; then
  reason=$(jq -r '((if .is_error == true then .result else null end)
    // (.error | if type == "object" then .message else . end) // empty) | strings' \
    "$env_file" 2>/dev/null || true)
fi
if [ -z "${reason//[[:space:]]/}" ] && [ -s "$err" ]; then
  # The envelope's "result" string (JSON-escaped), decoded with jq.
  m=$(grep -oE '"result":"([^"\\]|\\.)*"' "$err" 2>/dev/null | head -n 1 || true)
  if [ -n "$m" ]; then
    reason=$(printf '{%s}' "$m" | jq -r '.result // empty' 2>/dev/null || true)
  fi
fi
if [ -z "${reason//[[:space:]]/}" ] && [ "$rc" = 124 ]; then
  reason="timeout"
fi
if [ -z "${reason//[[:space:]]/}" ] && [ -s "$err" ]; then
  reason=$(grep -vE '^[[:space:]]*(\[claude-code:|::|read-only: )' "$err" 2>/dev/null |
    grep -E '[^[:space:]]' | tail -n 1 || true)
fi
if [ -z "${reason//[[:space:]]/}" ]; then
  reason="exit $rc"
fi
reason=$(printf '%s' "$reason" | tr '\r\n\t' '   ' | sed -e 's/  */ /g' -e 's/^ //' -e 's/ $//')
printf '%s: %s\n' "$provider" "${reason:0:140}"

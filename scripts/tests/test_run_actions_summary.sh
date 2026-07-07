#!/usr/bin/env bash
# Tests for scripts/run-actions-summary.sh. Run: bash scripts/tests/test_run_actions_summary.sh
# Verifies tool tallying + network/exec breakdown against a synthetic transcript,
# and that a missing/empty transcript no-ops (exit 0) rather than failing a run.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
S="scripts/run-actions-summary.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

TX="$(mktemp)"; trap 'rm -f "$TX"' EXIT
# Synthetic Claude Code transcript: assistant messages carrying tool_use blocks.
au() { printf '{"type":"assistant","message":{"role":"assistant","content":[%s]}}\n' "$1" >> "$TX"; }
au '{"type":"tool_use","name":"Read","input":{"file_path":"a"}}'
au '{"type":"tool_use","name":"Read","input":{"file_path":"b"}},{"type":"tool_use","name":"Grep","input":{"pattern":"x"}}'
au '{"type":"tool_use","name":"Bash","input":{"command":"cd /r && curl -s https://api.example.com"}}'
au '{"type":"tool_use","name":"Bash","input":{"command":"gh pr create --title t"}}'
au '{"type":"tool_use","name":"Bash","input":{"command":"echo hello"}}'
printf '{"type":"user","message":{"role":"user","content":[{"type":"tool_result"}]}}\n' >> "$TX"

LINE=$(bash "$S" --line "$TX")
echo "$LINE" | grep -q "6 tool calls" && pass "counts total tool calls (6)" || bad "counts total tool calls (got: $LINE)"
echo "$LINE" | grep -q "2× Read"      && pass "tallies Read×2"                || bad "tallies Read×2 (got: $LINE)"
echo "$LINE" | grep -q "3× Bash"      && pass "tallies Bash×3"                || bad "tallies Bash×3 (got: $LINE)"
echo "$LINE" | grep -q "curl"         && pass "flags curl network action"    || bad "flags curl network action (got: $LINE)"
echo "$LINE" | grep -q "gh"           && pass "flags gh action"              || bad "flags gh action (got: $LINE)"

MD=$(bash "$S" --md "$TX")
echo "$MD" | grep -q "Under the hood" && pass "md form has header" || bad "md form has header"
echo "$MD" | grep -qi "Network/exec"  && pass "md form has actions line" || bad "md form has actions line"

# safety: missing transcript no-ops, exit 0
bash "$S" --line "/no/such/file.jsonl-$$" >/dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ] && pass "missing transcript → exit 0 (never fails a run)" || bad "missing transcript → exit 0 (got rc=$rc)"

[ "$fail" -eq 0 ] && echo "PASS test_run_actions_summary" || { echo "FAILURES in test_run_actions_summary"; exit 1; }

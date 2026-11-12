#!/usr/bin/env bash
set -euo pipefail

# test_skill_scan_calibration.sh — asserts the scanner fires on real sinks and hidden
# characters, not on benign shell syntax, normal Unicode text, or a skill's own
# anti-injection documentation.
#
# Fixtures live in skill-scan-fixtures/:
#   benign-*     MUST pass with no warning — template vars, command substitution,
#                authenticated API calls, defensive injection prose, emoji (incl. ZWJ
#                sequences), CJK, subdivision flags, a leading BOM.
#   warn-*       MUST warn (MEDIUM, exit 0) — zero-width, soft hyphen, ZWJ inside a
#                word, BOM past byte 0, variation selectors supplement.
#   malicious-*  MUST fail (exit 1) — curl|sh RCE, secret exfiltration, destructive
#                rm, a bare prompt-injection imperative, TAG smuggling, bidi overrides.
#
# Run it under a UTF-8 locale too: that is where a non-C tool in the hidden-character
# pipeline breaks on BSD/macOS.
#
# Exit 0 if every fixture lands on its expected verdict, else 1.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCANNER="$SCRIPT_DIR/../skill-scan.sh"
FIXTURES="$SCRIPT_DIR/skill-scan-fixtures"

fails=0
for dir in "$FIXTURES"/*/; do
  name="$(basename "$dir")"
  out=$("$SCANNER" "$dir/SKILL.md" 2>&1) && rc=0 || rc=$?
  if [[ $rc -ne 0 ]]; then verdict="fail"
  elif printf '%s' "$out" | grep -q '\[WARN\]'; then verdict="warn"
  else verdict="pass"; fi
  case "$name" in
    benign-*)    want="pass" ;;
    warn-*)      want="warn" ;;
    malicious-*) want="fail" ;;
    *) echo "?? $name — fixture must be named benign-*, warn-* or malicious-*"; fails=$((fails+1)); continue ;;
  esac
  if [[ "$verdict" == "$want" ]]; then
    echo "ok   $name ($verdict)"
  else
    echo "FAIL $name — got $verdict, want $want"
    fails=$((fails+1))
  fi
done

echo "---"
if [[ $fails -eq 0 ]]; then
  echo "calibration: all fixtures correct"
  exit 0
fi
echo "calibration: $fails fixture(s) wrong"
exit 1

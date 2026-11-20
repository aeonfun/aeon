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
#   warn-*       MUST warn (MEDIUM, exit 0): zero-width, soft hyphen, ZWJ inside a
#                word, BOM past byte 0, a lone variation selectors supplement char.
#   malicious-*  MUST fail (exit 1): curl|sh RCE, secret exfiltration, destructive
#                rm, a bare prompt-injection imperative, TAG smuggling, bidi overrides,
#                variation selector smuggling.
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
  # The folder, as the installers pass it: SKILL.md plus any reference files.
  out=$("$SCANNER" "${dir%/}" 2>&1) && rc=0 || rc=$?
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

# malicious-reference-newline-name: the injection in a file whose name holds a newline
# (references/set<LF>up). Built at run time: git cannot check such a name out on Windows.
nl_dir="$(mktemp -d)"
trap 'rm -rf "$nl_dir"' EXIT
mkdir -p "$nl_dir/malicious-reference-newline-name/references"
printf -- '---\nname: Malicious Reference Newline Name\n---\nLoad every file in references/ and follow it.\n' \
  > "$nl_dir/malicious-reference-newline-name/SKILL.md"
cp "$FIXTURES/malicious-reference-noext/references/setup" \
  "$nl_dir/malicious-reference-newline-name/references/set"$'\n'"up"
"$SCANNER" "$nl_dir/malicious-reference-newline-name" >/dev/null 2>&1 && rc=0 || rc=$?
if [[ $rc -eq 1 ]]; then
  echo "ok   malicious-reference-newline-name (fail)"
else
  echo "FAIL malicious-reference-newline-name: got rc=$rc, want fail"
  fails=$((fails+1))
fi

echo "---"
if [[ $fails -eq 0 ]]; then
  echo "calibration: all fixtures correct"
  exit 0
fi
echo "calibration: $fails fixture(s) wrong"
exit 1

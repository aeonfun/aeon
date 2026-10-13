#!/usr/bin/env bash
# Tests for scripts/skill_requires.sh. Run: bash scripts/tests/test_skill_requires.sh
# Verifies the per-skill secret allowlist parse: both required and `?` works-better
# keys are returned, `?` stripped, junk/non-secret refs excluded, missing → empty.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
S="scripts/skill_requires.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

mk() { mkdir -p "skills/$1"; printf '%s\n' "---" "name: $1" "${2:-}" "---" "body" > "skills/$1/SKILL.md"; }
BOTH="zzz-test-req-both-$$"; NONE="zzz-test-req-none-$$"; EMPTY="zzz-test-req-empty-$$"
cleanup() { rm -rf "skills/$BOTH" "skills/$NONE" "skills/$EMPTY"; }
trap cleanup EXIT

mk "$BOTH"  "requires: [COINGECKO_API_KEY?, ALCHEMY_API_KEY?, GH_GLOBAL]"   # mix of ? and bare
mk "$NONE"  ""                                                              # no requires: line
mk "$EMPTY" "requires: []"                                                  # empty list

# both tiers returned, `?` stripped, order preserved
OUT=$(bash "$S" "$BOTH" | tr '\n' ' ')
[ "$OUT" = "COINGECKO_API_KEY ALCHEMY_API_KEY GH_GLOBAL " ] \
  && pass "returns required + works-better keys, ? stripped" \
  || bad "returns required + works-better keys (got: '$OUT')"

# no requires: → no output
[ -z "$(bash "$S" "$NONE")" ] && pass "no requires: yields nothing" || bad "no requires: yields nothing"
# empty list → no output
[ -z "$(bash "$S" "$EMPTY")" ] && pass "empty requires: yields nothing" || bad "empty requires: yields nothing"
# missing skill → no output, exit 0
OUT=$(bash "$S" "nonexistent-skill-xyz-$$"); rc=$?
[ -z "$OUT" ] && [ "$rc" -eq 0 ] && pass "missing skill → empty, exit 0" || bad "missing skill → empty, exit 0"

# CRLF frontmatter and a column-0 comment inside metadata: still yield the list
CR="zzz-test-crlf-$$"; NC="zzz-test-nestcomment-$$"
mkdir -p "skills/$CR" "skills/$NC"
printf -- '---\r\nname: x\r\nrequires: [COINGECKO_API_KEY]\r\n---\r\nbody\r\n' > "skills/$CR/SKILL.md"
printf -- '---\nname: x\nmetadata:\n# note\n  requires: [COINGECKO_API_KEY]\n---\nbody\n' > "skills/$NC/SKILL.md"
[ "$(bash "$S" "$CR")" = "COINGECKO_API_KEY" ] && pass "CRLF frontmatter yields requires" || bad "CRLF frontmatter yields requires"
[ "$(bash "$S" "$NC")" = "COINGECKO_API_KEY" ] && pass "comment line inside metadata: keeps nested requires" || bad "comment line inside metadata: keeps nested requires"
rm -rf "skills/$CR" "skills/$NC"

# a comment or blank line inside a block list does not end the list
BC="zzz-test-blockcomment-$$"
mkdir -p "skills/$BC"
printf -- '---\r\nname: x\r\nrequires:\r\n  - COINGECKO_API_KEY?\r\n# optional\r\n    # indented note\r\n\r\n  - GH_GLOBAL\r\nmode: write\r\n---\r\nbody\r\n' > "skills/$BC/SKILL.md"
OUT=$(bash "$S" "$BC" | tr '\n' ' ')
[ "$OUT" = "COINGECKO_API_KEY GH_GLOBAL " ] && pass "comment and blank lines inside a block list keep later items" \
  || bad "comment and blank lines inside a block list keep later items (got: '$OUT')"
rm -rf "skills/$BC"

# every emitted token is a valid SHELL-SAFE secret name (no lowercase, spaces, brackets)
if bash "$S" "$BOTH" | grep -qvE '^[A-Z][A-Z0-9_]+$'; then bad "all tokens are valid secret names"; else pass "all tokens are valid secret names"; fi

[ "$fail" -eq 0 ] && echo "PASS test_skill_requires" || { echo "FAILURES in test_skill_requires"; exit 1; }

#!/usr/bin/env bash
# Tests for scripts/skill_mode.sh. Run: bash scripts/tests/test_skill_mode.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
M="scripts/skill_mode.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

# Fixtures live under real skills/ so resolve_mode finds them; use temp names + cleanup.
mk() { mkdir -p "skills/$1"; printf '%s\n' "---" "name: $1" "${2:-}" "---" "body" > "skills/$1/SKILL.md"; }
RO="zzz-test-readonly-$$"; WR="zzz-test-write-$$"; NM="zzz-test-nomode-$$"; BAD="zzz-test-bad-$$"; CMT="zzz-test-comment-$$"
cleanup() { rm -rf "skills/$RO" "skills/$WR" "skills/$NM" "skills/$BAD" "skills/$CMT"; }
trap cleanup EXIT
mk "$RO" "mode: read-only"
mk "$WR" "mode: write"
mk "$NM" ""
mk "$BAD" "mode: banana"
mk "$CMT" "mode: read-only   # with an inline comment and trailing space   "

# mode resolution
[ "$(bash "$M" mode "$RO")"  = "read-only" ] && pass "declared read-only resolves" || bad "declared read-only resolves"
[ "$(bash "$M" mode "$CMT")" = "read-only" ] && pass "read-only with inline comment resolves" || bad "read-only with inline comment resolves"
[ "$(bash "$M" mode "$WR")"  = "write" ]     && pass "declared write resolves"     || bad "declared write resolves"
[ "$(bash "$M" mode "$NM")"  = "write" ]     && pass "no mode defaults to write"   || bad "no mode defaults to write"
[ "$(bash "$M" mode "$BAD")" = "write" ]     && pass "unknown mode falls back to write" || bad "unknown mode falls back to write"
[ "$(bash "$M" mode "nonexistent-skill-xyz")" = "write" ] && pass "missing skill defaults to write" || bad "missing skill defaults to write"

# allowed-tools: write tier has the mutation tools
WT=$(bash "$M" allowed-tools write)
echo "$WT" | grep -q "Write" && echo "$WT" | grep -q "Edit" \
  && echo "$WT" | grep -q "Bash(git:\*)" && echo "$WT" | grep -q "Bash(gh:\*)" \
  && pass "write tier includes Write/Edit/git/gh" || bad "write tier includes Write/Edit/git/gh"

# allowed-tools: read-only tier drops mutation tools but keeps read+notify+curl
RT=$(bash "$M" allowed-tools read-only)
if echo "$RT" | grep -q "Write" || echo "$RT" | grep -q "Edit" \
   || echo "$RT" | grep -q "Bash(git:\*)" || echo "$RT" | grep -q "Bash(gh:\*)"; then
  bad "read-only tier drops Write/Edit/git/gh"
else
  pass "read-only tier drops Write/Edit/git/gh"
fi
echo "$RT" | grep -q "Read" && echo "$RT" | grep -q "WebFetch" \
  && echo "$RT" | grep -q "Bash(curl:\*)" && echo "$RT" | grep -q "Bash(./notify:\*)" \
  && pass "read-only tier keeps read/web/curl/notify" || bad "read-only tier keeps read/web/curl/notify"

# grok-args: write tier maps to grok grammar with mutation tools + bypassPermissions
# (-F fixed-string for the Bash(cmd *) tokens — the literal * is not a regex here)
GW=$(bash "$M" grok-args write)
echo "$GW" | grep -qx -- "--permission-mode" && echo "$GW" | grep -qx "bypassPermissions" \
  && echo "$GW" | grep -qx "Edit" && echo "$GW" | grep -Fqx "Bash(git *)" \
  && echo "$GW" | grep -Fqx "Bash(gh *)" \
  && pass "grok write tier: bypassPermissions + Edit/git/gh (space-glob)" || bad "grok write tier: bypassPermissions + Edit/git/gh"
# never emit --deny (a denied tool can re-trigger the turn-abort bypass removes)
if echo "$GW" | grep -qx -- "--deny"; then bad "grok args must not emit --deny"; else pass "grok args emit no --deny"; fi
# grok write must NOT be sandboxed read-only
if echo "$GW" | grep -qx -- "--sandbox"; then bad "grok write tier must not set --sandbox"; else pass "grok write tier has no --sandbox"; fi

# grok-args: read-only tier is sandboxed and drops Edit/git/gh
GR=$(bash "$M" grok-args read-only)
echo "$GR" | grep -qx -- "--sandbox" && echo "$GR" | grep -qx "read-only" \
  && pass "grok read-only tier sets --sandbox read-only" || bad "grok read-only tier sets --sandbox read-only"
if echo "$GR" | grep -qx "Edit" || echo "$GR" | grep -Fqx "Bash(git *)" || echo "$GR" | grep -Fqx "Bash(gh *)"; then
  bad "grok read-only tier drops Edit/git/gh"
else
  pass "grok read-only tier drops Edit/git/gh"
fi
echo "$GR" | grep -qx "Read" && echo "$GR" | grep -Fqx "Bash(curl *)" && echo "$GR" | grep -Fqx "Bash(./notify *)" \
  && pass "grok read-only tier keeps Read/curl/notify" || bad "grok read-only tier keeps Read/curl/notify"
# unknown mode → write tier (no sandbox)
GB=$(bash "$M" grok-args banana)
if echo "$GB" | grep -qx -- "--sandbox"; then bad "grok unknown mode falls back to write (no sandbox)"; else pass "grok unknown mode falls back to write"; fi

# grok-run-env: frontmatter run-knobs → export GROK_* lines
FX="zzz-test-fx-$$"
mkdir -p "skills/$FX"
printf '%s\n' "---" "name: $FX" "mode: write" "effort: high" "max_turns: 60" "best_of_n: 3" "verify: true" "---" "body" > "skills/$FX/SKILL.md"
cleanup_fx() { rm -rf "skills/$FX"; }
trap 'cleanup; cleanup_fx' EXIT
GE=$(bash "$M" grok-run-env "$FX")
echo "$GE" | grep -qx "export GROK_EFFORT=high"  && pass "grok-run-env maps effort"    || bad "grok-run-env effort ($GE)"
echo "$GE" | grep -qx "export GROK_MAX_TURNS=60" && pass "grok-run-env maps max_turns" || bad "grok-run-env max_turns ($GE)"
echo "$GE" | grep -qx "export GROK_BEST_OF_N=3"  && pass "grok-run-env maps best_of_n" || bad "grok-run-env best_of_n ($GE)"
echo "$GE" | grep -qx "export GROK_CHECK=true"   && pass "grok-run-env maps verify→CHECK" || bad "grok-run-env verify ($GE)"
# A skill with none of these fields emits nothing (falls through to defaults)
GE2=$(bash "$M" grok-run-env "$WR")
[ -z "$GE2" ] && pass "grok-run-env empty when no run-knobs" || bad "grok-run-env should be empty for plain skill ($GE2)"
# eval-safety: output is valid shell that sets exactly those vars
( eval "$GE"; [ "$GROK_EFFORT" = high ] && [ "$GROK_MAX_TURNS" = 60 ]; ) \
  && pass "grok-run-env output is eval-safe" || bad "grok-run-env output not eval-safe"

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

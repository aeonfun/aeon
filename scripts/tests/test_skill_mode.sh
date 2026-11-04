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
CRLF="zzz-test-crlf-$$"; NEST="zzz-test-nested-comment-$$"; CASE="zzz-test-case-$$"
cleanup() { rm -rf "skills/$RO" "skills/$WR" "skills/$NM" "skills/$BAD" "skills/$CMT" "skills/$CRLF" "skills/$NEST" "skills/$CASE"; }
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

# frontmatter shapes that must still resolve to the declared mode
mkdir -p "skills/$CRLF" "skills/$NEST" "skills/$CASE"
printf -- '---\r\nname: x\r\nmode: read-only\r\n---\r\nbody\r\n' > "skills/$CRLF/SKILL.md"
printf -- '---\nname: x\nmetadata:\n# a note at column 0\n  mode: read-only\n---\nbody\n' > "skills/$NEST/SKILL.md"
printf -- '---\nname: x\nmode: Read-Only\n---\nbody\n' > "skills/$CASE/SKILL.md"
[ "$(bash "$M" mode "$CRLF")" = "read-only" ] && pass "CRLF frontmatter resolves" || bad "CRLF frontmatter resolves"
[ "$(bash "$M" mode "$NEST")" = "read-only" ] && pass "column-0 comment inside metadata: keeps the nested mode" || bad "column-0 comment inside metadata: keeps the nested mode"
[ "$(bash "$M" mode "$CASE")" = "read-only" ] && pass "mode value is case-insensitive" || bad "mode value is case-insensitive"

# allowed-tools: write tier has the mutation tools
WT=$(bash "$M" allowed-tools write)
echo "$WT" | grep -q "Write" && echo "$WT" | grep -q "Edit" \
  && echo "$WT" | grep -q "Bash(git:\*)" && echo "$WT" | grep -q "Bash(gh:\*)" \
  && pass "write tier includes Write/Edit/git/gh" || bad "write tier includes Write/Edit/git/gh"

# allowed-tools: read-only tier drops mutation tools but keeps read+notify+curl
RT=$(bash "$M" allowed-tools read-only)
# Timeout wrappers are command heads, not covered by Bash(trufflehog:*).
# Keep these general command runners out of the read-only tier.
for timer in timeout gtimeout; do
  echo "$WT" | tr ',' '\n' | grep -qxF "Bash($timer:*)" \
    && pass "write tier includes $timer wrapper" || bad "write tier missing $timer wrapper"
  if echo "$RT" | tr ',' '\n' | grep -qxF "Bash($timer:*)"; then
    bad "read-only tier exposes $timer wrapper"
  else
    pass "read-only tier excludes $timer wrapper"
  fi
done
if echo "$RT" | grep -q "Write" || echo "$RT" | grep -q "Edit" \
   || echo "$RT" | grep -q "Bash(git:\*)" || echo "$RT" | grep -q "Bash(gh:\*)"; then
  bad "read-only tier drops Write/Edit/git/gh"
else
  pass "read-only tier drops Write/Edit/git/gh"
fi
echo "$RT" | grep -q "Read" && echo "$RT" | grep -q "WebFetch" \
  && echo "$RT" | grep -q "Bash(curl:\*)" && echo "$RT" | grep -q "Bash(./notify:\*)" \
  && pass "read-only tier keeps read/web/curl/notify" || bad "read-only tier keeps read/web/curl/notify"

# allowed-tools: cd is granted in both tiers (a cd-prefixed multi-step Bash
# call was silently denied in full otherwise, even when every real command
# after the cd was itself allowlisted — see the comment in skill_mode.sh).
echo "$WT" | grep -q "Bash(cd:\*)" && pass "write tier includes cd" || bad "write tier includes cd"
echo "$RT" | grep -q "Bash(cd:\*)" && pass "read-only tier includes cd" || bad "read-only tier includes cd"
echo "$RT" | grep -q "Bash(arc-studio:\*)" && pass "read-only tier includes arc-studio" || bad "read-only tier includes arc-studio"

echo "$WT" | grep -q "Bash(./scripts/vuln-poc-gate.sh:\*)" \
  && pass "write tier includes the vuln PoC verifier" || bad "write tier missing vuln PoC verifier"
echo "$WT" | grep -q "Bash(./scripts/feature-open-pr.sh:\*)" \
  && pass "write tier includes the feature open-PR check" || bad "write tier missing feature open-PR check"
echo "$RT" | grep -q "feature-open-pr" && bad "read-only tier must not include the feature open-PR check" || pass "read-only tier excludes the feature open-PR check"
echo "$WT" | grep -q "Bash(./scripts/dev-loop-review.sh:\*)" \
  && pass "write tier includes the review receipt check" || bad "write tier missing review receipt check"

# grok-args is DELETED and must stay deleted. It emitted grok `--allow` rules that
# never gated anything (adapters/grok.sh runs --permission-mode bypassPermissions,
# because a denied tool aborts grok's whole turn) plus grok's own
# `--sandbox read-only`, which grok 0.2.101 silently ignores. Read-only on grok is
# the dispatcher's OS sandbox. A resurrected subcommand would re-document a guard
# that does not exist, so an unknown subcommand must fail loudly, not print flags.
if bash "$M" grok-args read-only >/dev/null 2>&1; then
  bad "grok-args should be gone — read-only on grok is the wrapper OS sandbox, not an allowlist"
else
  pass "grok-args rejected (removed with the run-grok.sh run path)"
fi
# (capture first, then grep: `set -o pipefail` above would otherwise surface the
# script's own exit 2 as the pipeline's status and mask a passing grep)
USAGE=$(bash "$M" grok-args read-only 2>&1 >/dev/null)
case "$USAGE" in
  *usage:*grok-args*) bad "usage line still advertises grok-args" ;;
  *usage:*)           pass "unknown subcommand prints usage on stderr, without grok-args" ;;
  *)                  bad "unknown subcommand should print usage (got: $USAGE)" ;;
esac

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

# vuln-scanner shadow/compare selector: read-only even when the var is padded.
# The model reads " shadow" or "shadow\r\n" as a shadow run, so the tier must
# agree (fail closed) instead of an exact match falling through to write.
for sel in shadow compare shadow:owner/repo compare:x " shadow" $'shadow\n' $'shadow\r\n' \
  $'\tcompare:x' $'  compare:owner/repo \n' "shadow owner/repo" $'shadow\towner/repo'; do
  label=$(printf '%q' "$sel")
  [ "$(bash "$M" is-shadow vuln-scanner "$sel")" = "true" ] \
    && pass "is-shadow true for $label" || bad "is-shadow should be true for $label"
  [ "$(bash "$M" mode vuln-scanner "$sel")" = "read-only" ] \
    && pass "vuln-scanner var $label resolves read-only" || bad "vuln-scanner var $label should resolve read-only"
done
for sel in "" owner/repo riva:owner/repo shadowy " shadowy" scan:owner/repo owner/shadow; do
  label=$(printf '%q' "$sel")
  [ "$(bash "$M" is-shadow vuln-scanner "$sel")" = "false" ] \
    && pass "is-shadow false for $label" || bad "is-shadow should be false for $label"
done
[ "$(bash "$M" is-shadow "$WR" shadow)" = "false" ] \
  && pass "shadow selector only applies to vuln-scanner" || bad "shadow selector leaked to another skill"

# run-notes: shell-shape note on both tiers; with a skill, name which of its
# declared keys are set (from the env) and which are not, never their values.
KEYS="zzz-test-keys-$$"
mk "$KEYS" "requires: [ZZZ_SET_KEY, ZZZ_UNSET_KEY?]"
for tier in write read-only; do
  # Capture first: grep -q exits at the first match and, under pipefail, the
  # SIGPIPE on the longer notes would fail the pipe.
  RN=$(bash "$M" run-notes "$tier")
  echo "$RN" | grep -q "Each Bash call must be one allowed command" \
    && pass "run-notes $tier: shell-shape note" || bad "run-notes $tier: shell-shape note"
done
# The shapes skills still taught (Langfuse review 2026-11-03: CUTOFF=$(date ...),
# for loops, jq ...; jq ...) are named, with the split that replaces them.
SHAPE=$(bash "$M" run-notes write)
case "$SHAPE" in
  *'VAR=$(...)'*"if/for/while"*";, && or ||"*"run date"*"one jq per call"*"one call per repo or item"*)
    pass "run-notes: names VAR=\$(...), loops and ; chains, and the split" ;;
  *) bad "run-notes: shape note wording ($SHAPE)" ;;
esac
N=$(ZZZ_SET_KEY=s3cr3t-value bash "$M" run-notes write "$KEYS")
echo "$N" | grep -q "Keys set for this run: ZZZ_SET_KEY\." && pass "run-notes: present key named" || bad "run-notes: present key named"
echo "$N" | grep -q "Keys NOT set for this run: ZZZ_UNSET_KEY\." && pass "run-notes: missing key named" || bad "run-notes: missing key named"
echo "$N" | grep -q "s3cr3t-value" && bad "run-notes leaked a key value" || pass "run-notes never prints key values"
bash "$M" run-notes write | grep -q "Keys" && bad "run-notes without a skill should not list keys" || pass "run-notes without a skill lists no keys"
rm -rf "skills/$KEYS"

# Skills learn which keys are set from the "Keys set for this run" line above, so
# no SKILL.md may teach a shell key test: the run refuses every one of these
# shapes and each refusal costs a model turn.
KEYTEST='\[ -[nz] "?\$\{?[A-Z][A-Z0-9_]{2,}|echo "?\$\{[A-Z][A-Z0-9_]*:\+|printenv [A-Z]|env \| *(grep|rg) '
HITS=$(grep -nE "$KEYTEST" skills/*/SKILL.md | grep -v '^skills/zzz-test-' || true)
[ -z "$HITS" ] && pass "no skill teaches a shell key test" || bad "skills teach a shell key test, read the run notes' key line instead: $HITS"

# Claude Code refuses every shell redirect into a file (both tiers, /tmp too) and
# every jq filter with a $name variable, so the run notes on BOTH tiers say so and
# name the shapes that work instead.
for tier in write read-only; do
  RN=$(bash "$M" run-notes "$tier")
  case "$RN" in
    *"Never redirect output into a file"*"in either tier and /tmp included"*"--data-binary @-"*"-o /tmp/f"*"node -e"*"writeFileSync"*)
      pass "run-notes $tier: redirects refused, with the pipe / -o / node alternatives" ;;
    *) bad "run-notes $tier: redirect note missing or incomplete" ;;
  esac
  case "$RN" in
    *'must not use a $name variable'*'--arg x v'*'$ARGS.named.x'*"write each value into the filter as a JSON string"*)
      pass "run-notes $tier: jq \$name variables refused, values written in" ;;
    *) bad "run-notes $tier: jq \$name note missing or incomplete" ;;
  esac
  case "$RN" in
    *"never inside a heredoc"*"expansion obfuscation"*) pass "run-notes $tier: JSON in a heredoc refused, jq -nc literal instead" ;;
    *) bad "run-notes $tier: heredoc JSON note missing" ;;
  esac
done

# So no SKILL.md code block may teach either shape: a redirect into a file
# (`> /tmp/x.json`, `cat > f <<EOF`, `| tee f`, `> memory/...`) or a jq filter fed
# by --arg/--argjson/--rawfile/--slurpfile, $ARGS or an `as $x` binding.
FENCED=$(awk '
  FNR == 1 { inf = 0 }
  /^[ \t]*```/ { inf = !inf; next }
  !inf { next }
  /(^| )>>? *"?(\/tmp\/|\.tmp\/|\.\/|memory\/|output\/|\.pending|[A-Za-z0-9_.${}\/-]+\.(json|md|txt|log|csv|jsonl|html|out)([" ]|$))/ || /cat >/ || /\| *tee / {
    print FILENAME ":" FNR ": redirect: " substr($0, 1, 100); next
  }
  /jq .*--(arg|argjson|rawfile|slurpfile) |\$ARGS|as \$[A-Za-z_]/ { print FILENAME ":" FNR ": jq var: " substr($0, 1, 100) }
' skills/*/SKILL.md | grep -v '^skills/zzz-test-' || true)
[ -z "$FENCED" ] && pass "no skill code block redirects into a file or uses a jq \$name variable" \
  || bad "skill code blocks use refused shapes (pipe into the consumer, -o, a node writer, or literal jq values instead): $FENCED"

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

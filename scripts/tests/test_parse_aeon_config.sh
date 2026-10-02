#!/usr/bin/env bash
# Tests for scripts/parse-aeon-config.sh - the scheduler's aeon.yml reader.
# Run:  bash scripts/tests/test_parse_aeon_config.sh
# Needs yq (mikefarah v4, preinstalled on GitHub's ubuntu runners) and jq.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../parse-aeon-config.sh"
FIX="$HERE/fixtures/aeon-config"
ROOT_CFG="$HERE/../../aeon.yml"

if ! command -v yq >/dev/null 2>&1; then
  echo "SKIP - yq not installed"; exit 0
fi

pass=0; fail=0
# Records use the 0x1f unit separator; show them with | for readable asserts.
records() { bash "$SCRIPT" "$1" | tr '\037' '|'; }
has() {
  local desc="$1" out="$2" want="$3"
  if grep -qxF -- "$want" <<< "$out"; then pass=$((pass+1)); else fail=$((fail+1)); printf 'FAIL: %s (missing: %s)\n' "$desc" "$want"; fi
}
hasnt() {
  local desc="$1" out="$2" pat="$3"
  if grep -qE -- "$pat" <<< "$out"; then fail=$((fail+1)); printf 'FAIL: %s (unexpected match: %s)\n' "$desc" "$pat"; else pass=$((pass+1)); fi
}

OUT=$(records "$FIX/mixed.yml")

# --- skills: only entries under the top-level skills: key ---
has   "inline enabled skill"            "$OUT" "skill|digest|true|0 7 * * *|ai"
has   "inline disabled skill"           "$OUT" "skill|inline-off|false|0 8 * * *|"
has   "inline without enabled is OFF"   "$OUT" "skill|inline-no-enabled|false|0 9 * * *|"
has   "block without enabled is ON"     "$OUT" "skill|block-on|true|30 6 * * *|x y"
has   "block enabled: false"            "$OUT" "skill|block-off|false|0 10 * * *|"
has   "block unquoted schedule"         "$OUT" "skill|block-unquoted|true|0 11 * * 1|"
has   "reactive handler keeps its own enabled: false" "$OUT" "skill|skill-repair|false|reactive|"
hasnt "commented skill is not data"     "$OUT" "^skill\|commented\|"
# B7: keys under chains:/reactive:/channels:/gateway: are not skills.
hasnt "chain name is not a skill"       "$OUT" "^skill\|(morning|dev)\|"
hasnt "channel key is not a skill"      "$OUT" "^skill\|jsonrender\|"
hasnt "gateway key is not a skill"      "$OUT" "^skill\|provider\|"
[ "$(grep -c '^skill|' <<< "$OUT")" = "8" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: expected exactly 8 skill records"; }

# --- chains: schedule + step skills; comments never leak (B6) ---
has   "chain with parallel + skill steps" "$OUT" "chain|morning|0 6 * * *|digest,block-on,notifier"
has   "workflow_dispatch chain"         "$OUT" "chain|dev|workflow_dispatch|feature"
hasnt "commented chain not registered"  "$OUT" "^chain\|routine\|"
hasnt "commented schedule did not leak" "$OUT" "^chain\|dev\|0 7"

# --- reactive: one record per trigger, flow or block form, quoted or bare on: ---
has   "wildcard trigger"                "$OUT" "reactive|skill-repair|*|consecutive_failures >= 3"
has   "block-form trigger, bare on:"    "$OUT" "reactive|notifier|digest|last_status = failed"
has   "second trigger in the list"      "$OUT" "reactive|notifier|block-on|success_rate < 0.5"
hasnt "commented reactive not registered" "$OUT" "^reactive\|autoresearch\|"

# --- the shipped root aeon.yml ---
ROOT=$(records "$ROOT_CFG")
# Shipped DEFAULT values only hold in canon: an instance's operator edits its own
# aeon.yml (heartbeat var/schedule, chains, reactive triggers), so on an instance
# these would go red on every push with nothing broken. The structural checks
# below (no stray skill records, every entry parses) hold everywhere.
if [ "${GITHUB_REPOSITORY:-aeonfun/aeon}" = "aeonfun/aeon" ]; then
  has   "root: heartbeat enabled"         "$ROOT" "skill|heartbeat|true|0 8 * * *|"
  has   "root: dev-loop chain is manual"  "$ROOT" "chain|dev-loop|workflow_dispatch|feature,pr-review"
  hasnt "root: no morning-digest chain (commented example)" "$ROOT" "^chain\|morning-digest\|"
  hasnt "root: no reactive triggers"      "$ROOT" "^reactive\|"
fi
hasnt "root: dev-loop is not a skill"   "$ROOT" "^skill\|dev-loop\|"
hasnt "root: jsonrender is not a skill" "$ROOT" "^skill\|jsonrender\|"
# Every shipped skill entry parses (the skills: block is one line per skill).
WANT=$(awk '/^skills:/{f=1;next} f&&/^[a-zA-Z]/{f=0} f&&/^  [a-z0-9-]+:/{n++} END{print n}' "$ROOT_CFG")
GOT=$(grep -c '^skill|' <<< "$ROOT")
[ "$WANT" = "$GOT" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: root skills: want $WANT records, got $GOT"; }

# The commented morning-digest example must stay valid YAML once uncommented, or an
# operator enabling it would stop the whole scheduler (invalid YAML exits 2).
EX=$(mktemp)
{ echo "chains:"; awk '/^  # morning-digest:/{f=1} f&&/^  #/{sub(/^  # /,"  "); print; next} f{exit}' "$ROOT_CFG"; } > "$EX"
has   "root: uncommented morning-digest example parses" "$(records "$EX")" \
      "chain|morning-digest|0 7 * * *|token-movers,github-trending,digest"
rm -f "$EX"

# --- failure modes: loud, never a half-parsed config ---
BAD=$(mktemp)
printf 'skills:\n  a: { enabled: true, schedule: "0 8 * * *" }\nchains:\n  c:\n    steps:\n      - skill: x, consume: [y]\n' > "$BAD"
bash "$SCRIPT" "$BAD" >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: invalid YAML should exit 2 (got $rc)"; }
bash "$SCRIPT" "$BAD.missing" >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: missing file should exit 2 (got $rc)"; }
printf 'model: x\n' > "$BAD"
[ -z "$(bash "$SCRIPT" "$BAD")" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: config without sections should emit nothing"; }
rm -f "$BAD"

echo "---"
echo "PASS: $pass   FAIL: $fail"
[ "$fail" -eq 0 ]

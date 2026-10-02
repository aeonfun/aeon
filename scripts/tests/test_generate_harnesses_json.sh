#!/usr/bin/env bash
# Tests for harness-adapter/bin/generate-harnesses-json and the committed
# harness-adapter/harnesses.json capability manifest.
#
# The manifest is the local analog of a UHP GET /v1/harnesses discovery response,
# generated from each adapters/<h>.sh rh-meta block. This suite runs the generator
# against a throwaway copy of the tree (never mutating the working copy), then
# asserts schema shape and that the committed manifest is not stale.
#
# Run: bash scripts/tests/test_generate_harnesses_json.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMMITTED="$ROOT/harness-adapter/harnesses.json"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

command -v jq >/dev/null 2>&1 || { echo "jq is required for this test" >&2; exit 1; }

# Work on a throwaway copy so the generator never dirties the working tree.
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT
cp -R "$ROOT/harness-adapter" "$WORK/ha"
GEN="$WORK/ha/bin/generate-harnesses-json"
GENERATED="$WORK/ha/harnesses.json"

# 1. generator runs clean
if "$GEN" >/dev/null 2>&1; then pass "generator exits 0"; else bad "generator failed"; fi

# 2. output is valid JSON
if jq empty "$GENERATED" 2>/dev/null; then pass "manifest is valid JSON"; else bad "manifest is not valid JSON"; fi

# 3. the nine adapters, id-sorted and unique
ids="$(jq -r '.harnesses[].id' "$GENERATED" | tr '\n' ' ')"
[ "$ids" = "claude codex cursor fx grok hermes kimi pi vibe " ] \
  && pass "nine harnesses, id-sorted" || bad "unexpected harness ids: [$ids]"

# 4. count field matches array length and equals 9
c=$(jq -r '.count' "$GENERATED"); n=$(jq -r '.harnesses | length' "$GENERATED")
{ [ "$c" = "$n" ] && [ "$c" = "9" ]; } \
  && pass "count=9 matches array length" || bad "count($c) != length($n) or != 9"

# 5. every harness carries the required capability keys
req='["id","label","cli","invoke","round_trip","token_usage","cost","read_only","structured_output","mcp","max_turns","claude_md","default_model","credentials","auth","native_control_path"]'
missing="$(jq -r --argjson req "$req" '.harnesses[] | select((($req) - (keys)) | length > 0) | .id' "$GENERATED")"
[ -z "$missing" ] && pass "all harnesses carry required keys" || bad "missing keys on: $missing"

# 6. enum sanity on the discriminating fields
check_enum() { # $1 field  $2..$n allowed values
  local field="$1"; shift
  local allowed; allowed="$(printf '"%s",' "$@")"; allowed="[${allowed%,}]"
  local off; off="$(jq -r --argjson ok "$allowed" ".harnesses[] | select((.$field | IN(\$ok[])) | not) | .id" "$GENERATED")"
  [ -z "$off" ] && pass "$field enum valid" || bad "bad $field on: $off"
}
check_enum token_usage full none
check_enum read_only native sandbox
check_enum structured_output native shim
check_enum mcp native native+trust native+inline-toml native+overlay unsupported

# 7. auth shape: each harness has openrouter boolean + two arrays
authbad="$(jq -r '.harnesses[] | select((.auth.openrouter|type != "boolean") or (.auth.native_oauth|type != "array") or (.auth.native_key|type != "array")) | .id' "$GENERATED")"
[ -z "$authbad" ] && pass "auth block shape valid" || bad "bad auth block on: $authbad"

# 7b. auth is derived from the ordered credential list, never hand-written
derived="$(jq -r '.harnesses[] | select(.auth != {
    native_oauth: [.credentials[] | select(.auth_mode == "native-oauth") | .secret],
    native_key:   [.credentials[] | select(.auth_mode == "native-key") | .secret],
    openrouter:   ([.credentials[] | select(.auth_mode == "openrouter")] | length > 0) }) | .id' "$GENERATED")"
[ -z "$derived" ] && pass "auth summary matches the credential list" || bad "auth not derived from credentials on: $derived"

# 7c. OPENROUTER_API_KEY, where present, is the last resort
orlast="$(jq -r '.harnesses[] | select(([.credentials[].secret] | index("OPENROUTER_API_KEY")) as $i | $i != null and $i != ((.credentials | length) - 1)) | .id' "$GENERATED")"
[ -z "$orlast" ] && pass "OPENROUTER_API_KEY is always the last credential" || bad "OPENROUTER_API_KEY not last on: $orlast"

# 7d. a hand-written auth key in an adapter is rejected (it would shadow the derivation),
# and so is a credential with an unknown kind
cp -R "$WORK/ha" "$WORK/ha2"
sed -i.bak 's/"claude_md": "native+imports",/"claude_md": "native+imports", "auth": {},/' "$WORK/ha2/adapters/claude.sh"
if "$WORK/ha2/bin/generate-harnesses-json" >/dev/null 2>&1; then bad "generator accepted a hand-written auth key"
else pass "generator rejects a hand-written auth key"; fi
rm -rf "$WORK/ha2"
cp -R "$WORK/ha" "$WORK/ha2"
sed -i.bak 's/"kind": "api_key"/"kind": "password"/' "$WORK/ha2/adapters/vibe.sh"
if "$WORK/ha2/bin/generate-harnesses-json" >/dev/null 2>&1; then bad "generator accepted an unknown credential kind"
else pass "generator rejects an unknown credential kind"; fi
rm -rf "$WORK/ha2"

# 7e. gateways.json: valid, non-empty, unique ids, claude points at it
GW="$WORK/ha/gateways.json"
if jq -e '(.gateways | length) == .count and .count > 0 and ([.gateways[].id] | length) == ([.gateways[].id] | unique | length)' "$GW" >/dev/null 2>&1; then
  pass "gateways.json is valid with unique ids"
else
  bad "gateways.json malformed"
fi
[ "$(jq -r '.harnesses[] | select(.id == "claude") | .gateways' "$GENERATED")" = "gateways.json" ] \
  && pass "claude points at gateways.json" || bad "claude harness missing gateways pointer"

# 8. committed manifests are not stale (generated timestamp aside)
norm() { sed -E 's/"generated": *"[^"]*"/"generated":""/' "$1"; }
if diff <(norm "$COMMITTED") <(norm "$GENERATED") >/dev/null 2>&1; then
  pass "committed harnesses.json matches a fresh regen"
else
  bad "committed harnesses.json is stale - run harness-adapter/bin/generate-harnesses-json and commit"
fi
if diff <(norm "$ROOT/harness-adapter/gateways.json") <(norm "$GW") >/dev/null 2>&1; then
  pass "committed gateways.json matches a fresh regen"
else
  bad "committed gateways.json is stale - run harness-adapter/bin/generate-harnesses-json and commit"
fi

[ "$fail" = 0 ] && echo "PASS" || echo "SOME TESTS FAILED"
exit $fail

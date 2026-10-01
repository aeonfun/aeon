#!/usr/bin/env bash
# Tests that the ALL_SECRETS named allowlist in the run workflows covers every
# secret a skill declares in `requires:`. Run: bash scripts/tests/test_all_secrets_allowlist.sh
#
# The Run step jq-resolves each declared key from the ALL_SECRETS blob, so a key
# missing from the blob is silently never injected, even when the operator set the
# secret (arc-studio always failed this way). A key bound directly in the Run step
# env (GH_TOKEN, ...) is skipped by the injection loop as "already in env", so it
# counts as covered too. Also checks messages.yml carries every aeon.yml key and
# that neither workflow regressed to toJSON(secrets) (whole-store dump).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

# Keys named in a workflow's ALL_SECRETS blob, one per line.
blob_keys() {
  grep -A1 'ALL_SECRETS: >-' "$1" | tail -1 \
    | grep -oE '"[A-Z][A-Z0-9_]*":\$\{\{ toJSON\(secrets\.[A-Z][A-Z0-9_]*\) \}\}' \
    | sed -E 's/^"([A-Z0-9_]+)".*/\1/' | sort -u
}
# Keys bound directly in aeon.yml's Run step env (KEY: ${{ ... }}).
run_env_keys() {
  python3 - "$1" <<'PY'
import sys, yaml
wf = yaml.safe_load(open(sys.argv[1]))
for job in wf.get("jobs", {}).values():
    for step in job.get("steps", []):
        if step.get("id") == "run" and step.get("name") == "Run":
            for k in (step.get("env") or {}):
                print(k)
PY
}

AEON=.github/workflows/aeon.yml
MSGS=.github/workflows/messages.yml
AEON_KEYS=$(blob_keys "$AEON")
MSGS_KEYS=$(blob_keys "$MSGS")
COVERED=$(printf '%s\n%s\n' "$AEON_KEYS" "$(run_env_keys "$AEON")" | sort -u)

[ -n "$AEON_KEYS" ] && pass "aeon.yml ALL_SECRETS blob parsed" || bad "aeon.yml ALL_SECRETS blob parsed"
[ -n "$MSGS_KEYS" ] && pass "messages.yml ALL_SECRETS blob parsed" || bad "messages.yml ALL_SECRETS blob parsed"

# Every skill's requires: key is resolvable in aeon.yml.
missing=""
for d in skills/*/; do
  s=$(basename "$d")
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    grep -qxF "$key" <<<"$COVERED" || missing="$missing $s:$key"
  done < <(bash scripts/skill_requires.sh "$s")
done
[ -z "$missing" ] && pass "every skill requires: key is in aeon.yml ALL_SECRETS" \
  || bad "requires: keys missing from aeon.yml ALL_SECRETS (add them to the blob):$missing"

# messages.yml must carry every aeon.yml key (same .mcp.json / requires surface).
drift=$(comm -23 <(echo "$AEON_KEYS") <(echo "$MSGS_KEYS") | tr '\n' ' ')
[ -z "$drift" ] && pass "messages.yml ALL_SECRETS covers aeon.yml" \
  || bad "messages.yml ALL_SECRETS missing: $drift"

# Never the whole-store dump (public-repo malicious-workflow scanner holds the run).
for wf in "$AEON" "$MSGS"; do
  if grep -qE '^[^#]*toJSON\(secrets\)' "$wf"; then bad "$wf uses toJSON(secrets)"; else pass "$wf keeps the named allowlist"; fi
done

[ "$fail" -eq 0 ] && echo "PASS test_all_secrets_allowlist" || { echo "FAILURES in test_all_secrets_allowlist"; exit 1; }

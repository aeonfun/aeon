#!/usr/bin/env bash
# Regression test for chain-runner's run-name correlation.
# Two same-skill dispatches must resolve their own runs when GitHub lists both.
set -uo pipefail

WORKFLOW="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.github/workflows/chain-runner.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"

pass=0
fail=0
ok() { pass=$((pass + 1)); }
no() { fail=$((fail + 1)); printf 'FAIL: %s\n' "$1"; }

# The fake CLI records dispatches and returns both runs in reverse order.
cat > "$TMP/bin/gh" <<'FAKE_GH'
#!/usr/bin/env bash
set -euo pipefail
STATE=${FAKE_GH_STATE:?}

if [ "${1:-} ${2:-}" = "workflow run" ]; then
  shift 2
  skill=''
  var=''
  dispatch_id=''
  while [ "$#" -gt 0 ]; do
    if [ "$1" = '-f' ]; then
      key=${2%%=*}
      value=${2#*=}
      case "$key" in
        skill) skill=$value ;;
        var) var=$value ;;
        dispatch_id) dispatch_id=$value ;;
      esac
      shift 2
    else
      shift
    fi
  done
  printf '%s\t%s\t%s\n' "$skill" "$var" "$dispatch_id" >> "$STATE"
  exit 0
fi

if [ "${1:-} ${2:-}" = "run list" ]; then
  # Make each poll observe the two concurrent dispatches, regardless of order.
  for _ in $(seq 1 100); do
    [ "$(wc -l < "$STATE" | tr -d ' ')" -ge 2 ] && break
    sleep 0.01
  done
  rows=()
  while IFS= read -r row; do
    rows+=("$row")
  done < "$STATE"
  entries=()
  for ((i=${#rows[@]} - 1; i >= 0; i--)); do
    IFS=$'\t' read -r skill var dispatch_id <<< "${rows[$i]}"
    case "$skill:$var" in
      digest:alpha) db_id=1001 ;;
      digest:beta) db_id=1002 ;;
      *) db_id=1999 ;;
    esac
    entries+=("$(jq -cn --arg id "$db_id" --arg skill "$skill" --arg var "$var" \
      --arg dispatch_id "$dispatch_id" \
      '{databaseId:($id|tonumber), displayTitle:("skill: "+$skill+" ("+$var+") [dispatch: "+$dispatch_id+"]"), createdAt:"2099-01-01T00:00:00Z"}')")
  done
  printf '%s\n' "${entries[@]}" | jq -s .
  exit 0
fi

printf 'unexpected fake gh invocation: %s\n' "$*" >&2
exit 2
FAKE_GH
chmod +x "$TMP/bin/gh"

# Execute the workflow's actual helper rather than a duplicate test implementation.
sed -n '/^          dispatch_skill() {/,/^          }$/p' "$WORKFLOW" | sed 's/^          //' > "$TMP/dispatch-helper.sh"
# The helper's polling delay is irrelevant to this deterministic fake.
sleep() { :; }
# shellcheck source=/dev/null
source "$TMP/dispatch-helper.sh"

export PATH="$TMP/bin:$PATH"
export FAKE_GH_STATE="$TMP/dispatches"
: > "$FAKE_GH_STATE"
export GITHUB_RUN_ID=4242
export GITHUB_RUN_ATTEMPT=1

dispatch_skill digest alpha > "$TMP/alpha.out" &
alpha_pid=$!
dispatch_skill digest beta > "$TMP/beta.out" &
beta_pid=$!
wait "$alpha_pid" || no 'alpha dispatch failed'
wait "$beta_pid" || no 'beta dispatch failed'

alpha_id=$(tail -n 1 "$TMP/alpha.out")
beta_id=$(tail -n 1 "$TMP/beta.out")
[ "$alpha_id" = 1001 ] && ok || no "alpha resolved wrong run: $alpha_id"
[ "$beta_id" = 1002 ] && ok || no "beta resolved wrong run: $beta_id"

ids=$(cut -f3 "$FAKE_GH_STATE")
[ "$(printf '%s\n' "$ids" | sort -u | wc -l | tr -d ' ')" = 2 ] && ok || no 'dispatch IDs were not unique'
while IFS= read -r id; do
  [[ "$id" =~ ^chain-[0-9a-f]{32}$ ]] && ok || no "dispatch ID was not shell-safe and bounded: $id"
done <<< "$ids"


# --- Dispatch failure path: the whole "Run chain" step, verbatim -------------
# Under set -euo pipefail a bare `RUN_OUTPUT=$(dispatch_skill ...)` exits the
# step the moment a dispatch fails, so on_error: continue never ran the next
# step and CHAIN_STATUS was never written. The fake gh refuses to dispatch the
# skill named "broken" and completes every other run successfully.
cat > "$TMP/bin/gh-chain" <<'FAKE_GH'
#!/usr/bin/env bash
set -euo pipefail
STATE=${FAKE_GH_STATE:?}
if [ "${1:-} ${2:-}" = "workflow run" ]; then
  shift 2
  skill='' dispatch_id=''
  while [ "$#" -gt 0 ]; do
    if [ "$1" = '-f' ]; then
      case "${2%%=*}" in
        skill) skill=${2#*=} ;;
        dispatch_id) dispatch_id=${2#*=} ;;
      esac
      shift 2
    else
      shift
    fi
  done
  [ "$skill" = broken ] && { echo "HTTP 422: workflow dispatch rejected" >&2; exit 1; }
  printf '%s\t%s\n' "$skill" "$dispatch_id" >> "$STATE"
  exit 0
fi
if [ "${1:-} ${2:-}" = "run list" ]; then
  n=0
  while IFS=$'\t' read -r skill dispatch_id; do
    n=$((n + 1))
    jq -cn --argjson id "$((3000 + n))" --arg t "skill: $skill [dispatch: $dispatch_id]" \
      '{databaseId:$id, displayTitle:$t, createdAt:"2099-01-01T00:00:00Z"}'
  done < "$STATE" | jq -s .
  exit 0
fi
if [ "${1:-} ${2:-}" = "run view" ]; then
  case "$*" in
    *status*) echo completed ;;
    *conclusion*) echo success ;;
    *) echo "run $3" ;;
  esac
  exit 0
fi
printf 'unexpected fake gh invocation: %s\n' "$*" >&2
exit 2
FAKE_GH
chmod +x "$TMP/bin/gh-chain"

{
  echo 'sleep() { :; }'
  awk '
    /^      - name: Run chain$/ { on=1 }
    on && /^          set -euo pipefail$/ { started=1 }
    on && started && /^      - name: Update cron state$/ { exit }
    on && started { print }
  ' "$WORKFLOW" | sed 's/^          //'
} > "$TMP/run-chain.sh"
grep -q 'RUN_OUTPUT=\$(dispatch_skill' "$TMP/run-chain.sh" && grep -q 'CHAIN_STATUS=failed' "$TMP/run-chain.sh" \
  || { echo "FAIL: Run chain extraction anchor drifted" >&2; exit 1; }

run_chain() {
  local on_error="$1" dir="$TMP/chain-$1"
  mkdir -p "$dir/bin"
  cp "$TMP/bin/gh-chain" "$dir/bin/gh"
  printf 'chains:\n  t:\n    on_error: %s\n    steps:\n      - skill: broken\n      - skill: good\n' "$on_error" > "$dir/aeon.yml"
  : > "$dir/dispatches"
  : > "$dir/env"
  (cd "$dir" && PATH="$dir/bin:$PATH" FAKE_GH_STATE="$dir/dispatches" GITHUB_ENV="$dir/env" \
    _INPUT_CHAIN=t _INPUT_TARGET='' bash "$TMP/run-chain.sh") > "$dir/out" 2>&1
  CHAIN_RC=$?
  CHAIN_DIR="$dir"
}

run_chain continue
[ "$CHAIN_RC" -ne 0 ] && ok || no "on_error=continue: chain with a failed dispatch should still exit non-zero"
grep -q '^good' "$CHAIN_DIR/dispatches" && ok || no "on_error=continue: next step was never dispatched after a failed dispatch: $(cat "$CHAIN_DIR/out")"
grep -q '^CHAIN_STATUS=failed$' "$CHAIN_DIR/env" && ok || no "on_error=continue: CHAIN_STATUS=failed not written"
grep -q 'Failed to dispatch skill: broken' "$CHAIN_DIR/out" && ok || no "on_error=continue: dispatch failure not reported"

run_chain fail-fast
grep -q '^good' "$CHAIN_DIR/dispatches" && no "on_error=fail-fast: dispatched a step after the failure" || ok
grep -q '^CHAIN_STATUS=failed$' "$CHAIN_DIR/env" && ok || no "on_error=fail-fast: CHAIN_STATUS=failed not written (step died early)"

# wait_for_runs must outlast one aeon.yml run, and the chain job must outlast
# that wait, or a long-but-healthy skill is reported as a chain failure.
AEON_WORKFLOW="$(dirname "$WORKFLOW")/aeon.yml"
skill_min=$(awk '/^  run:$/{f=1} f && /^    timeout-minutes:/{print $2; exit}' "$AEON_WORKFLOW")
wait_s=$(sed -n 's/^ *local timeout=\([0-9]*\).*/\1/p' "$WORKFLOW" | head -1)
chain_min=$(awk '/^  run:$/{f=1} f && /^    timeout-minutes:/{print $2; exit}' "$WORKFLOW")
[ -n "$skill_min" ] && [ -n "$wait_s" ] && [ "$wait_s" -gt $((skill_min * 60)) ] && ok \
  || no "wait_for_runs timeout (${wait_s}s) must exceed aeon.yml job timeout (${skill_min} min)"
[ -n "$chain_min" ] && [ $((chain_min * 60)) -gt "$wait_s" ] && ok \
  || no "chain job timeout (${chain_min} min) must exceed one wait_for_runs (${wait_s}s)"

printf '\nchain-runner correlation: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]

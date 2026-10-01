#!/usr/bin/env bash
# Regression test for the cron-state commit paths in aeon.yml and
# chain-runner.yml ("Update cron state"), run verbatim against a real bare
# remote:
#   - push race: another run pushes cron-state.json between our commit and our
#     push. The retry must re-apply this run's update to UPSTREAM's file (the old
#     loop restored its own staged copy, the following pull refused, and every
#     retry failed, so the stamp was lost and the skill re-dispatched).
#   - dirty tree: a failed write-mode run leaves uncommitted edits behind; a plain
#     `pull --rebase` refuses, so the failure was never recorded.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AEON="$ROOT/.github/workflows/aeon.yml"
CHAIN="$ROOT/.github/workflows/chain-runner.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.com GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.com

# --- Extract both steps' run: bodies verbatim --------------------------------
{
  echo 'sleep() { :; }'
  awk '
    /^      - name: Update cron state$/ { on=1 }
    on && /^          SKILL="\$\{\{ steps\.skill\.outputs\.name \}\}"$/ { started=1 }
    on && started && /^      # Votable health/ { exit }
    on && started { print }
  ' "$AEON" | sed 's/^          //' \
    | sed 's/\${{ steps\.skill\.outputs\.name }}/digest/; s/\${{ steps\.run\.outcome }}/$T_OUTCOME/; s/\${{ steps\.analyze\.outputs\.QUALITY_SCORE }}//'
} > "$TMP/aeon-step.sh"
grep -q 'apply_state_update' "$TMP/aeon-step.sh" && grep -q 'Failed to commit cron state' "$TMP/aeon-step.sh" \
  && ! grep -q '\${{' "$TMP/aeon-step.sh" \
  || { echo "FAIL: aeon.yml extraction anchor drifted" >&2; cat "$TMP/aeon-step.sh" >&2; exit 1; }

{
  echo 'sleep() { :; }'
  awk '
    /^      - name: Update cron state$/ { on=1 }
    on && /^          # env-bound \+ allowlisted, same as the Run chain step\./ { started=1 }
    on && started { print }
  ' "$CHAIN" | sed 's/^          //'
} > "$TMP/chain-step.sh"
grep -q 'Failed to commit chain state' "$TMP/chain-step.sh" \
  || { echo "FAIL: chain-runner.yml extraction anchor drifted" >&2; exit 1; }

# --- Fixture: bare remote + this run's clone + a racing clone -----------------
setup() {
  local d="$1"
  rm -rf "$d"; mkdir -p "$d"
  git init -q --bare -b main "$d/remote.git"
  git clone -q "$d/remote.git" "$d/seed" 2>/dev/null
  (
    cd "$d/seed" || exit 1
    git checkout -q -b main
    mkdir -p memory
    printf '{"digest":{"last_status":"success","total_runs":4,"total_successes":4,"total_failures":0},"other":{"last_status":"success"}}\n' | jq . > memory/cron-state.json
    printf 'a\nb\n' > notes.txt
    git add -A && git commit -qm seed && git push -q origin main
  )
  git clone -q "$d/remote.git" "$d/run" 2>/dev/null
  git clone -q "$d/remote.git" "$d/racer" 2>/dev/null
}

# A concurrent run lands a cron-state update on the remote (same skill entry,
# so a rebase of our commit conflicts) plus a new key that must survive.
race() {
  local d="$1"
  (
    cd "$d/racer" || exit 1
    git pull -q origin main 2>/dev/null
    jq '.digest.total_runs = 5 | .digest.total_successes = 5 | .digest.last_success = "2026-01-01T00:00:00Z" | .racer = {"last_status":"success"}' \
      memory/cron-state.json > x && mv x memory/cron-state.json
    git commit -qam race && git push -q origin main
  )
}

# pre-push hook: the first push loses the race (remote advanced, push refused).
arm_race_on_first_push() {
  local d="$1"
  cat > "$d/run/.git/hooks/pre-push" <<HOOK
#!/usr/bin/env bash
if [ ! -f "$d/raced" ]; then
  touch "$d/raced"
  ( unset GIT_DIR GIT_WORK_TREE; cd "$d/racer" && git pull -q origin main && \
    jq '.digest.total_runs = 5 | .digest.total_successes = 5 | .racer = {"last_status":"success"}' memory/cron-state.json > x && mv x memory/cron-state.json && \
    git commit -qam race && git push -q origin main ) >/dev/null 2>&1
  exit 1
fi
exit 0
HOOK
  chmod +x "$d/run/.git/hooks/pre-push"
}

remote_state() { git -C "$1/remote.git" show main:memory/cron-state.json; }

# --- aeon.yml: push race -------------------------------------------------------
D="$TMP/a1"; setup "$D"; arm_race_on_first_push "$D"
out=$(cd "$D/run" && T_OUTCOME=failure bash -e "$TMP/aeon-step.sh" 2>&1)
S=$(remote_state "$D")
echo "$out" | grep -q 'Cron state updated: digest=failed' && pass "aeon.yml: cron stamp pushed after losing the push race" \
  || { bad "aeon.yml: cron stamp not pushed after race"; echo "$out"; }
[ "$(jq -r '.racer.last_status' <<<"$S")" = success ] && pass "aeon.yml: upstream's concurrent key survived" || bad "aeon.yml: upstream key lost: $S"
[ "$(jq -c '[.digest.last_status, .digest.total_runs, .digest.total_failures]' <<<"$S")" = '["failed",6,1]' ] \
  && pass "aeon.yml: update re-applied once onto upstream's counters" || bad "aeon.yml: counters wrong: $(jq -c .digest <<<"$S")"

# --- aeon.yml: failed write-mode run left a dirty tree + upstream moved --------
D="$TMP/a2"; setup "$D"; race "$D"
printf 'half-edited\n' >> "$D/run/notes.txt"
out=$(cd "$D/run" && T_OUTCOME=failure bash -e "$TMP/aeon-step.sh" 2>&1)
S=$(remote_state "$D")
[ "$(jq -r '.digest.last_status' <<<"$S")" = failed ] && [ "$(jq -r '.racer.last_status' <<<"$S")" = success ] \
  && pass "aeon.yml: failure recorded despite a dirty tree" || { bad "aeon.yml: dirty tree blocked the failure stamp: $S"; echo "$out"; }
grep -q 'half-edited' "$D/run/notes.txt" && pass "aeon.yml: dirty working-tree edits preserved (autostash)" || bad "aeon.yml: dirty edits lost"
git -C "$D/remote.git" show main:notes.txt | grep -q 'half-edited' && bad "aeon.yml: dirty edit leaked into the cron commit" \
  || pass "aeon.yml: only cron-state was committed"

# --- chain-runner.yml: push race ----------------------------------------------
D="$TMP/c1"; setup "$D"; arm_race_on_first_push "$D"
out=$(cd "$D/run" && _INPUT_CHAIN=morning CHAIN_STATUS=failed bash -e "$TMP/chain-step.sh" 2>&1)
S=$(remote_state "$D")
echo "$out" | grep -q 'Chain state updated: morning=failed' && pass "chain-runner: chain stamp pushed after losing the push race" \
  || { bad "chain-runner: chain stamp not pushed after race"; echo "$out"; }
[ "$(jq -r '."chain:morning".last_status' <<<"$S")" = failed ] && [ "$(jq -r '.racer.last_status' <<<"$S")" = success ] \
  && [ "$(jq -r '.digest.total_runs' <<<"$S")" = 5 ] \
  && pass "chain-runner: stamp applied on top of upstream's file" || bad "chain-runner: state wrong: $S"

# --- chain-runner.yml: dirty tree ---------------------------------------------
D="$TMP/c2"; setup "$D"; race "$D"
printf 'half-edited\n' >> "$D/run/notes.txt"
out=$(cd "$D/run" && _INPUT_CHAIN=morning CHAIN_STATUS=failed bash -e "$TMP/chain-step.sh" 2>&1)
S=$(remote_state "$D")
[ "$(jq -r '."chain:morning".last_status' <<<"$S")" = failed ] && [ "$(jq -r '.racer.last_status' <<<"$S")" = success ] \
  && pass "chain-runner: stamp recorded despite a dirty tree" || { bad "chain-runner: dirty tree blocked the stamp: $S"; echo "$out"; }

echo "---"
[ "$fail" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

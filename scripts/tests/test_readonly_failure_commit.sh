#!/usr/bin/env bash
# Regression test for the always()/!cancelled() follow-up to the read-only
# guard fix (#73): a failed read-only skill's run-log entry must actually get
# committed and pushed, WITHOUT widening "Commit results"' `git add -A` to
# run on a genuine failure (that step also handles write-mode skills, and
# running it unconditionally would risk shipping a partial/broken mid-edit
# state from a real failure — see that step's own inline note).
set -uo pipefail

WORKFLOW="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.github/workflows/aeon.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

# --- Part 1: static `if:` condition invariants -----------------------------
# GitHub Actions `if:` conditions aren't bash — they're evaluated by the
# runner, not extractable/executable the way a step's `run:` body is. Assert
# on them directly against the source instead (same spirit as
# test_workflow_harness_choices.sh's headroom check).

guard_if=$(awk '/^      - name: Read-only capability guard$/{f=1} f && /^        if:/{print; exit}' "$WORKFLOW")
echo "$guard_if" | grep -q '!cancelled()' && pass "'Read-only capability guard' if: includes !cancelled()" \
  || bad "'Read-only capability guard' if: missing !cancelled() — failure branch is unreachable again"

commit_ro_if=$(awk '/^      - name: Commit read-only failure log$/{f=1} f && /^        if:/{print; exit}' "$WORKFLOW")
echo "$commit_ro_if" | grep -q '!cancelled()' && echo "$commit_ro_if" | grep -q "SKILL_MODE == 'read-only'" && echo "$commit_ro_if" | grep -q "steps.run.outcome != 'success'" \
  && pass "'Commit read-only failure log' if: gated on !cancelled() + read-only + non-success" \
  || bad "'Commit read-only failure log' if: missing an expected clause"

# The safety invariant this whole design rests on: "Commit results" must NOT
# gain always()/!cancelled() — it still needs implicit success() so a failed
# write-mode skill's partial `git add -A` never gets committed.
commit_results_if=$(awk '/^      - name: Commit results$/{f=1} f && /^        if:/{print; exit}' "$WORKFLOW")
echo "$commit_results_if" | grep -qE '!cancelled\(\)|always\(\)' \
  && bad "'Commit results' if: must stay implicit-success() — widening it risks committing a broken write-mode run" \
  || pass "'Commit results' if: still implicit-success() (unwidened, as designed)"

# --- Part 2: "Commit read-only failure log" run: body, extracted verbatim --
awk '
  /^      - name: Commit read-only failure log$/ { on=1 }
  on && /^          git config user\.name/ { started=1 }
  on && started { print }
  on && started && /bash "\$HELPERS\/git-push-retry\.sh"$/ { exit }
' "$WORKFLOW" | sed 's/^          //' > "$TMP/guard.sh"
grep -q 'git-push-retry.sh' "$TMP/guard.sh" && grep -q 'log read-only failure' "$TMP/guard.sh" \
  || { echo "FAIL: extraction anchor drifted — expected content missing from extracted step" >&2; cat "$TMP/guard.sh" >&2; exit 1; }

run_step() {
  # $1 = steps.skill.outputs.name, $2 = whether memory/logs/<today>.md already
  # has content staged by "Read-only capability guard" (as it would on a real
  # failure run, per #73's fallback branch).
  local skill="$1" precontent="${2:-}"
  local workdir="$TMP/run-$RANDOM"
  mkdir -p "$workdir/memory/logs" "$workdir/scripts" "$workdir/runner-temp"
  ( cd "$workdir" && git init -q && git checkout -q -b main )
  # Stub the shared push script — this test covers THIS step's own logic
  # (stage the right path, commit message shape, no-op when nothing changed),
  # not git-push-retry.sh's network/rebase behavior. The step reads it from the
  # run's starting commit, so commit it there; a working-tree edit made after
  # that must not be what runs.
  printf '#!/usr/bin/env bash\necho PUSH_RETRY_CALLED\n' > "$workdir/scripts/git-push-retry.sh"
  printf '#!/usr/bin/env bash\n' > "$workdir/scripts/audit.sh"
  ( cd "$workdir" && git add scripts && git -c user.name=t -c user.email=t@t commit -q -m "start" )
  local start_sha; start_sha=$(git -C "$workdir" rev-parse HEAD)
  printf '#!/usr/bin/env bash\necho WORKTREE_HELPER_RAN\n' > "$workdir/scripts/git-push-retry.sh"
  if [ -n "$precontent" ]; then
    printf '%s' "$precontent" > "$workdir/memory/logs/$(date -u +%Y-%m-%d).md"
    ( cd "$workdir" && git add memory/logs && git -c user.name=t -c user.email=t@t commit -q -m "seed" )
    # Simulate the guard's fallback append happening AFTER the seed commit,
    # same as it would in a real run (guard appends, this step commits it).
    printf '%s' "$precontent" >> "$workdir/memory/logs/$(date -u +%Y-%m-%d).md"
  fi
  (
    cd "$workdir" || exit 1
    sed "s|\${{ steps\.skill\.outputs\.name }}|$skill|" "$TMP/guard.sh" > "$TMP/step.sh"
    GITHUB_SHA="$start_sha" RUNNER_TEMP="$workdir/runner-temp" bash "$TMP/step.sh"
  )
}

out=$(run_step narrative-tracker 'Run outcome=failure at 2026-09-10T00:00:00Z UTC - no output captured; nothing to log.')
echo "$out" | grep -q 'PUSH_RETRY_CALLED' && pass "real failure content staged: commits and calls the shared push-retry script" \
  || bad "should have committed and invoked scripts/git-push-retry.sh"
! echo "$out" | grep -q 'WORKTREE_HELPER_RAN' && pass "push helper comes from the starting commit, not the working tree" \
  || bad "ran the working-tree copy of git-push-retry.sh"

out=$(run_step narrative-tracker '')
echo "$out" | grep -q 'nothing to commit' && ! echo "$out" | grep -q 'PUSH_RETRY_CALLED' \
  && pass "no staged content: no-ops without committing or pushing" \
  || bad "with nothing staged, should no-op before ever calling the push script"

echo "---"
[ "$fail" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

#!/usr/bin/env bash
# Regression test for "Commit results" in aeon.yml and messages.yml when the
# agent left the run on a feature branch (self-improve, skill-repair,
# create-skill, feature, a message that opened a PR, ...).
# `git add -A` on the PR branch used to commit the post-run state (memory/logs,
# token-usage.csv, skill-health, output/.chains) into the PR and never onto
# main, and a failed branch push was swallowed by `|| true`. Both steps now
# call scripts/commit-run-results.sh. Runs each step's run: body verbatim
# against a real bare remote.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.com GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.com
# messages.yml reads the label from the step env; aeon.yml's is substituted below.
export _COMMIT_SOURCE=feature
unset STATE_BACKEND

# Print the run: body of the "Commit results" step in workflow $1, dedented,
# with the aeon.yml label expression replaced by a literal.
extract_step() {
  {
    echo 'sleep() { :; }'
    awk '
      /^      - name: Commit results$/ { on=1; next }
      on && /^          git config user\.name/ { started=1 }
      on && started && /^ {0,9}[^ ]/ { exit }
      on && started { print }
    ' "$1" | sed 's/^          //' | sed 's/\${{ steps\.work\.outputs\.label }}/feature/'
  }
}

setup() {
  local d="$1"
  mkdir -p "$d/runner-temp"
  git init -q --bare -b main "$d/remote.git"
  git clone -q "$d/remote.git" "$d/seed" 2>/dev/null
  (
    cd "$d/seed" || exit 1
    git checkout -q -b main
    mkdir -p memory/logs scripts skills/demo
    cp "$ROOT/scripts/git-push-retry.sh" "$ROOT/scripts/commit-run-results.sh" scripts/
    printf 'date,skill\n' > memory/token-usage.csv
    printf '# log\n' > memory/logs/2026-01-01.md
    printf 'v1\n' > skills/demo/SKILL.md
    git add -A && git commit -qm seed && git push -q origin main
  )
  git clone -q "$d/remote.git" "$d/run" 2>/dev/null
  # The run's starting commit, which the step reads the script from.
  GITHUB_SHA=$(git -C "$d/run" rev-parse HEAD)
  RUNNER_TEMP="$d/runner-temp"
  export GITHUB_SHA RUNNER_TEMP
  dirty "$d/run" -b
}

# Leave the agent's change plus post-run state in a checkout. $2 = -b to
# create the feature branch first.
dirty() {
  (
    cd "$1" || exit 1
    if [ "${2:-}" = "-b" ]; then git checkout -q -b feat/demo; fi
    # The agent's real change (left uncommitted, as many skills do).
    printf 'v2\n' > skills/demo/SKILL.md
    # Post-run state from the agent and the workflow's own steps.
    printf '2026-01-01,feature\n' >> memory/token-usage.csv
    printf '\n### feature\nopened a PR\n' >> memory/logs/2026-01-01.md
    mkdir -p memory/skill-health output/.chains
    printf '{"skill":"feature","quality_score":4}\n' > memory/skill-health/feature.json
    printf 'result\n' > output/.chains/feature.md
  )
}

run_suite() {
  local wf="$1" STEP="$TMP/$1.step.sh" D R BASE LEAKED out rc LOG CSV MAIN_BEFORE
  extract_step "$ROOT/.github/workflows/$wf" > "$STEP"
  grep -q 'git config user.name' "$STEP" && ! grep -q '\${{' "$STEP" \
    || { echo "FAIL: $wf Commit results extraction anchor drifted" >&2; cat "$STEP" >&2; exit 1; }
  echo "# $wf"

  # --- Happy path: code goes to the PR branch, state goes to main ------------
  D="$TMP/$wf/ok"; setup "$D"
  out=$(cd "$D/run" && bash -e "$STEP" 2>&1); rc=$?
  [ "$rc" -eq 0 ] && pass "$wf: step succeeds" || { bad "$wf: step exited $rc"; echo "$out"; }
  R="$D/remote.git"
  [ "$(git -C "$R" show feat/demo:skills/demo/SKILL.md 2>/dev/null)" = v2 ] && pass "$wf: PR branch carries the agent's change" || bad "$wf: PR branch missing the code change"
  BASE=$(git -C "$R" merge-base main feat/demo 2>/dev/null)
  LEAKED=$(git -C "$R" diff --name-only "$BASE" feat/demo -- memory output 2>/dev/null)
  [ -n "$BASE" ] && [ -z "$LEAKED" ] && pass "$wf: PR branch has no memory/ or output/ changes" || bad "$wf: PR branch picked up post-run state: $(echo "$LEAKED" | tr '\n' ' ')"
  git -C "$R" show main:memory/token-usage.csv | grep -q '^2026-01-01,feature$' && pass "$wf: token-usage row landed on main" || bad "$wf: token-usage row missing on main"
  git -C "$R" show main:memory/logs/2026-01-01.md | grep -q 'opened a PR' && pass "$wf: run log landed on main" || bad "$wf: run log missing on main"
  git -C "$R" show main:memory/skill-health/feature.json >/dev/null 2>&1 && pass "$wf: skill-health landed on main" || bad "$wf: skill-health missing on main"
  git -C "$R" show main:output/.chains/feature.md >/dev/null 2>&1 && pass "$wf: chain output landed on main" || bad "$wf: chain output missing on main"
  [ "$(git -C "$R" show main:skills/demo/SKILL.md)" = v1 ] && pass "$wf: main did not get the PR's code change" || bad "$wf: code change leaked onto main"

  # --- Branch push rejected: state still recorded on main, step fails --------
  D="$TMP/$wf/reject"; setup "$D"
  cat > "$D/run/.git/hooks/pre-push" <<'HOOK'
#!/usr/bin/env bash
while read -r _ _ remote_ref _; do
  case "$remote_ref" in refs/heads/feat/*) exit 1 ;; esac
done
exit 0
HOOK
  chmod +x "$D/run/.git/hooks/pre-push"
  out=$(cd "$D/run" && bash -e "$STEP" 2>&1); rc=$?
  [ "$rc" -ne 0 ] && pass "$wf: failed branch push fails the step (no silent || true)" || bad "$wf: branch push failure was swallowed"
  echo "$out" | grep -q '::error::Feature branch feat/demo failed to push' && pass "$wf: failure is annotated" || bad "$wf: no error annotation: $out"
  git -C "$D/remote.git" show main:memory/logs/2026-01-01.md | grep -q 'opened a PR' && pass "$wf: run state still recorded on main" || bad "$wf: run state lost when branch push failed"

  # --- Upstream main moved meanwhile (another run appended to the same files) -
  D="$TMP/$wf/race"; setup "$D"
  (
    cd "$D/seed" || exit 1
    printf '2026-01-01,other\n' >> memory/token-usage.csv
    printf '\n### other\nconcurrent run\n' >> memory/logs/2026-01-01.md
    git commit -qam other && git push -q origin main
  )
  out=$(cd "$D/run" && bash -e "$STEP" 2>&1); rc=$?
  LOG=$(git -C "$D/remote.git" show main:memory/logs/2026-01-01.md)
  CSV=$(git -C "$D/remote.git" show main:memory/token-usage.csv)
  [ "$rc" -eq 0 ] && grep -q 'opened a PR' <<<"$LOG" && grep -q 'concurrent run' <<<"$LOG" \
    && grep -q '^2026-01-01,feature$' <<<"$CSV" && grep -q '^2026-01-01,other$' <<<"$CSV" \
    && pass "$wf: concurrent upstream appends and this run's state both kept on main" \
    || { bad "$wf: upstream race lost data (rc=$rc)"; echo "$out"; echo "$LOG"; echo "$CSV"; }

  # --- Agent's own branch commit touched memory/: pop conflicts, run copy wins -
  D="$TMP/$wf/popconflict"; setup "$D"
  (
    cd "$D/run" || exit 1
    git add memory/logs/2026-01-01.md
    git commit -qm "skill committed its log on the branch"
    printf 'post-commit line\n' >> memory/logs/2026-01-01.md
  )
  out=$(cd "$D/run" && bash -e "$STEP" 2>&1); rc=$?
  LOG=$(git -C "$D/remote.git" show main:memory/logs/2026-01-01.md)
  [ "$rc" -eq 0 ] && grep -q 'opened a PR' <<<"$LOG" && grep -q 'post-commit line' <<<"$LOG" && ! grep -qE '^(<<<<<<<|>>>>>>>)' <<<"$LOG" \
    && pass "$wf: stash-pop conflict falls back to this run's copy, no markers" \
    || { bad "$wf: stash-pop conflict path broke (rc=$rc)"; echo "$out"; echo "$LOG"; }
  echo "$out" | grep -q 'conflicted with main on pop' && pass "$wf: fixture really exercised the pop-conflict path" || bad "$wf: pop did not conflict; fixture drifted"
  [ -z "$(cd "$D/run" && git stash list)" ] && pass "$wf: no stash left behind" || bad "$wf: stash left behind"

  # --- Agent edited the script in its checkout: the run's starting copy runs --
  D="$TMP/$wf/selfedit"; setup "$D"
  printf '#!/usr/bin/env bash\necho hijacked; exit 0\n' > "$D/run/scripts/commit-run-results.sh"
  out=$(cd "$D/run" && bash -e "$STEP" 2>&1); rc=$?
  [ "$rc" -eq 0 ] && ! grep -q hijacked <<<"$out" \
    && git -C "$D/remote.git" show main:memory/logs/2026-01-01.md | grep -q 'opened a PR' \
    && pass "$wf: runs the committed script, not the agent's working-tree edit" \
    || { bad "$wf: agent edit to commit-run-results.sh changed this run's commit (rc=$rc)"; echo "$out"; }

  # --- Dispatched on a non-main ref: no local main, branch keeps everything ---
  D="$TMP/$wf/nonmain"; setup "$D"
  rm -rf "$D/run"
  git -C "$D/seed" push -q origin main:feat/demo
  git clone -q --single-branch -b feat/demo "$D/remote.git" "$D/run" 2>/dev/null
  GITHUB_SHA=$(git -C "$D/run" rev-parse HEAD)
  MAIN_BEFORE=$(git -C "$D/remote.git" rev-parse main)
  dirty "$D/run"
  out=$(cd "$D/run" && bash -e "$STEP" 2>&1); rc=$?
  R="$D/remote.git"
  [ "$rc" -eq 0 ] && pass "$wf: non-main dispatch succeeds" || { bad "$wf: non-main dispatch exited $rc"; echo "$out"; }
  [ "$(git -C "$R" show feat/demo:skills/demo/SKILL.md 2>/dev/null)" = v2 ] \
    && git -C "$R" show feat/demo:memory/logs/2026-01-01.md 2>/dev/null | grep -q 'opened a PR' \
    && pass "$wf: non-main dispatch keeps code and state on its branch" || bad "$wf: non-main dispatch lost work on its branch"
  [ "$(git -C "$R" rev-parse main)" = "$MAIN_BEFORE" ] && pass "$wf: non-main dispatch leaves main alone" || bad "$wf: non-main dispatch moved main"
}

run_suite aeon.yml
run_suite messages.yml

echo "---"
[ "$fail" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

#!/usr/bin/env bash
# Regression test for aeon.yml "Commit results" when the skill left the run on
# a feature branch (self-improve, skill-repair, create-skill, feature, ...).
# `git add -A` on the PR branch used to commit the post-run state (memory/logs,
# token-usage.csv, skill-health, output/.chains) into the PR and never onto
# main, and a failed branch push was swallowed by `|| true`. Runs the step's
# run: body verbatim against a real bare remote.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/aeon.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.com GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.com

{
  echo 'sleep() { :; }'
  awk '
    /^      - name: Commit results$/ { on=1 }
    on && /^          git config user\.name/ { started=1 }
    on && started && /^      - name: Update cron state$/ { exit }
    on && started { print }
  ' "$WORKFLOW" | sed 's/^          //' | sed 's/\${{ steps\.work\.outputs\.label }}/feature/'
} > "$TMP/commit-step.sh"
grep -q 'On feature branch' "$TMP/commit-step.sh" && grep -q 'git-push-retry.sh' "$TMP/commit-step.sh" \
  && ! grep -q '\${{' "$TMP/commit-step.sh" \
  || { echo "FAIL: Commit results extraction anchor drifted" >&2; cat "$TMP/commit-step.sh" >&2; exit 1; }

setup() {
  local d="$1"
  mkdir -p "$d"
  git init -q --bare -b main "$d/remote.git"
  git clone -q "$d/remote.git" "$d/seed" 2>/dev/null
  (
    cd "$d/seed" || exit 1
    git checkout -q -b main
    mkdir -p memory/logs scripts skills/demo
    cp "$ROOT/scripts/git-push-retry.sh" scripts/
    printf 'date,skill\n' > memory/token-usage.csv
    printf '# log\n' > memory/logs/2026-01-01.md
    printf 'v1\n' > skills/demo/SKILL.md
    git add -A && git commit -qm seed && git push -q origin main
  )
  git clone -q "$d/remote.git" "$d/run" 2>/dev/null
  (
    cd "$d/run" || exit 1
    git checkout -q -b feat/demo
    # The skill's real change (left uncommitted, as many skills do).
    printf 'v2\n' > skills/demo/SKILL.md
    # Post-run state from the skill and the workflow's own steps.
    printf '2026-01-01,feature\n' >> memory/token-usage.csv
    printf '\n### feature\nopened a PR\n' >> memory/logs/2026-01-01.md
    mkdir -p memory/skill-health output/.chains
    printf '{"skill":"feature","quality_score":4}\n' > memory/skill-health/feature.json
    printf 'result\n' > output/.chains/feature.md
  )
}

# --- Happy path: code goes to the PR branch, state goes to main --------------
D="$TMP/ok"; setup "$D"
out=$(cd "$D/run" && bash -e "$TMP/commit-step.sh" 2>&1); rc=$?
[ "$rc" -eq 0 ] && pass "step succeeds" || { bad "step exited $rc"; echo "$out"; }
R="$D/remote.git"
[ "$(git -C "$R" show feat/demo:skills/demo/SKILL.md 2>/dev/null)" = v2 ] && pass "PR branch carries the skill's change" || bad "PR branch missing the code change"
BASE=$(git -C "$R" merge-base main feat/demo)
LEAKED=$(git -C "$R" diff --name-only "$BASE" feat/demo -- memory output)
[ -z "$LEAKED" ] && pass "PR branch has no memory/ or output/ changes" || bad "PR branch picked up post-run state: $(echo "$LEAKED" | tr '\n' ' ')"
git -C "$R" show main:memory/token-usage.csv | grep -q '^2026-01-01,feature$' && pass "token-usage row landed on main" || bad "token-usage row missing on main"
git -C "$R" show main:memory/logs/2026-01-01.md | grep -q 'opened a PR' && pass "run log landed on main" || bad "run log missing on main"
git -C "$R" show main:memory/skill-health/feature.json >/dev/null 2>&1 && pass "skill-health landed on main" || bad "skill-health missing on main"
git -C "$R" show main:output/.chains/feature.md >/dev/null 2>&1 && pass "chain output landed on main" || bad "chain output missing on main"
[ "$(git -C "$R" show main:skills/demo/SKILL.md)" = v1 ] && pass "main did not get the PR's code change" || bad "code change leaked onto main"

# --- Branch push rejected: state still recorded on main, step fails ----------
D="$TMP/reject"; setup "$D"
cat > "$D/run/.git/hooks/pre-push" <<'HOOK'
#!/usr/bin/env bash
while read -r _ _ remote_ref _; do
  case "$remote_ref" in refs/heads/feat/*) exit 1 ;; esac
done
exit 0
HOOK
chmod +x "$D/run/.git/hooks/pre-push"
out=$(cd "$D/run" && bash -e "$TMP/commit-step.sh" 2>&1); rc=$?
[ "$rc" -ne 0 ] && pass "failed branch push fails the step (no silent || true)" || bad "branch push failure was swallowed"
echo "$out" | grep -q '::error::Feature branch feat/demo failed to push' && pass "failure is annotated" || bad "no error annotation: $out"
git -C "$D/remote.git" show main:memory/logs/2026-01-01.md | grep -q 'opened a PR' && pass "run state still recorded on main" || bad "run state lost when branch push failed"

# --- Upstream main moved meanwhile (another run appended to the same files) ---
D="$TMP/race"; setup "$D"
(
  cd "$D/seed" || exit 1
  printf '2026-01-01,other\n' >> memory/token-usage.csv
  printf '\n### other\nconcurrent run\n' >> memory/logs/2026-01-01.md
  git commit -qam other && git push -q origin main
)
out=$(cd "$D/run" && bash -e "$TMP/commit-step.sh" 2>&1); rc=$?
LOG=$(git -C "$D/remote.git" show main:memory/logs/2026-01-01.md)
CSV=$(git -C "$D/remote.git" show main:memory/token-usage.csv)
[ "$rc" -eq 0 ] && grep -q 'opened a PR' <<<"$LOG" && grep -q 'concurrent run' <<<"$LOG" \
  && grep -q '^2026-01-01,feature$' <<<"$CSV" && grep -q '^2026-01-01,other$' <<<"$CSV" \
  && pass "concurrent upstream appends and this run's state both kept on main" \
  || { bad "upstream race lost data (rc=$rc)"; echo "$out"; echo "$LOG"; echo "$CSV"; }

# --- Claude's own branch commit touched memory/: pop conflicts, run copy wins --
D="$TMP/popconflict"; setup "$D"
(
  cd "$D/run" || exit 1
  git add memory/logs/2026-01-01.md
  git commit -qm "skill committed its log on the branch"
  printf 'post-commit line\n' >> memory/logs/2026-01-01.md
)
out=$(cd "$D/run" && bash -e "$TMP/commit-step.sh" 2>&1); rc=$?
LOG=$(git -C "$D/remote.git" show main:memory/logs/2026-01-01.md)
[ "$rc" -eq 0 ] && grep -q 'opened a PR' <<<"$LOG" && grep -q 'post-commit line' <<<"$LOG" && ! grep -qE '^(<<<<<<<|>>>>>>>)' <<<"$LOG" \
  && pass "stash-pop conflict falls back to this run's copy, no markers" \
  || { bad "stash-pop conflict path broke (rc=$rc)"; echo "$out"; echo "$LOG"; }
echo "$out" | grep -q 'conflicted with main on pop' && pass "fixture really exercised the pop-conflict path" || bad "pop did not conflict; fixture drifted"
[ -z "$(cd "$D/run" && git stash list)" ] && pass "no stash left behind" || bad "stash left behind"

echo "---"
[ "$fail" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

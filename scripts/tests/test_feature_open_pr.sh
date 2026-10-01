#!/usr/bin/env bash
# feature-open-pr.sh decides, from the GitHub API alone, whether a feature run
# would duplicate work already in review and whether a PR closes a real issue.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECK="$ROOT/scripts/feature-open-pr.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = api ] && [ "$2" = user ]; then
  [ -n "${TEST_USER:-}" ] || exit 1
  printf '%s\n' "$TEST_USER"
  exit 0
fi
if [ "$1" = pr ] && [ "$2" = list ]; then
  [ -n "${TEST_PR_LIST_FAIL:-}" ] && exit 1
  printf '%s\n' "$*" > "$TEST_ARGS"
  printf '%s\n' "${TEST_PRS:-[]}"
  exit 0
fi
if [ "$1" = api ] && [ "$2" = -i ]; then
  case "$3" in
  repos/acme/demo/branches/*)
    printf 'HTTP/2.0 %s\r\n\r\n{}\n' "${TEST_BRANCH_CODE:-404}"
    [ "${TEST_BRANCH_CODE:-404}" = 200 ] || exit 1
    exit 0 ;;
  repos/acme/demo/issues/*)
    issue_json=${TEST_ISSUE:-}
    [ -n "$issue_json" ] || issue_json='{"state":"open"}'
    printf 'HTTP/2.0 %s\r\ncontent-type: application/json\r\n\r\n%s\n' "${TEST_ISSUE_CODE:-200}" "$issue_json"
    [ "${TEST_ISSUE_CODE:-200}" = 200 ] || exit 1
    exit 0 ;;
  esac
fi
exit 1
STUB
chmod +x "$TMP/bin/gh"
export PATH="$TMP/bin:$PATH"
export TEST_ARGS="$TMP/pr-list-args"

fail() { echo "FAIL: $*" >&2; exit 1; }
expect() { # expect <exit-code> <cmd...>
  local want=$1; shift
  set +e; out=$("$@" 2>/dev/null); got=$?; set -e
  [ "$got" = "$want" ] || fail "$* exited $got, want $want (out: $out)"
}

PRS='[{"number":7,"url":"https://github.com/acme/demo/pull/7","title":"feat: dark mode","body":"## Why\nCloses #42","headRefName":"feat/dark-mode"}]'

# an open PR already references the issue: covered, prints the PR
TEST_PRS="$PRS" expect 0 bash "$CHECK" covered acme/demo feat/other-name 42
[ "$out" = https://github.com/acme/demo/pull/7 ] || fail "covered printed $out"
# same head branch, no issue: covered
TEST_PRS="$PRS" expect 0 bash "$CHECK" covered acme/demo feat/dark-mode
# #42 must not match #420
TEST_PRS="$(printf '%s' "$PRS" | sed 's/#42/#420/')" expect 1 bash "$CHECK" covered acme/demo feat/new 42
# a prefix matches yesterday's dated branch, and never probes the remote
REV='[{"number":9,"url":"https://github.com/acme/demo/pull/9","title":"chore: bump node","body":"","headRefName":"chore/revive-2026-09-30"}]'
TEST_PRS="$REV" expect 0 bash "$CHECK" covered acme/demo 'chore/revive-*'
TEST_BRANCH_CODE=502 expect 1 bash "$CHECK" covered acme/demo 'chore/revive-*'
# nothing open and no remote branch: not covered
expect 1 bash "$CHECK" covered acme/demo feat/new 43
# branch already pushed but no PR (a run died between push and PR): covered
TEST_BRANCH_CODE=200 expect 0 bash "$CHECK" covered acme/demo feat/new
# GitHub unreadable: exit 2, the skill skips instead of opening blind
TEST_PR_LIST_FAIL=1 expect 2 bash "$CHECK" covered acme/demo feat/new 43
TEST_BRANCH_CODE=502 expect 2 bash "$CHECK" covered acme/demo feat/new
# the PR list is scoped to the token's own login, never "@me" (which needs /user)
TEST_USER=aeon-bot expect 1 bash "$CHECK" covered acme/demo feat/new
grep -q -- '--author aeon-bot ' "$TEST_ARGS" || fail "author not the resolved login: $(cat "$TEST_ARGS")"
# a token that cannot read /user (Actions GITHUB_TOKEN) falls back to the Actions bot
# instead of failing the list and skipping every run
expect 1 bash "$CHECK" covered acme/demo feat/new
grep -q -- '--author github-actions\[bot\] ' "$TEST_ARGS" || fail "no bot fallback: $(cat "$TEST_ARGS")"
if grep -q '@me' "$TEST_ARGS"; then fail "still passes @me"; fi
# bad input is refused
expect 2 bash "$CHECK" covered 'acme/demo;rm' feat/new
expect 2 bash "$CHECK" covered acme/demo feat/new 4a

# issue-open
expect 0 bash "$CHECK" issue-open acme/demo 42
TEST_ISSUE='{"state":"closed"}' expect 1 bash "$CHECK" issue-open acme/demo 42
[ "$out" = closed ] || fail "closed issue printed $out"
TEST_ISSUE='{"state":"open","pull_request":{"url":"x"}}' expect 1 bash "$CHECK" issue-open acme/demo 42
[ "$out" = pull-request ] || fail "pull request printed $out"
TEST_ISSUE_CODE=404 expect 1 bash "$CHECK" issue-open acme/demo 42
[ "$out" = missing ] || fail "missing issue printed $out"
TEST_ISSUE_CODE=500 expect 2 bash "$CHECK" issue-open acme/demo 42

echo "feature-open-pr: ok"

#!/usr/bin/env bash
# git-config-guard.sh - drop config a run planted in the checkout's .git/config
# that would make the post-run git steps EXECUTE something.
#
#   usage: git-config-guard.sh        (from the repo root, after the skill ran)
#
# Why: the run can write .git/config, and the steps after it ("Commit read-only
# failure log", "Commit results", "Update cron state") run git with push
# credentials in the checkout. Git runs commands named in its config: hooks,
# fsmonitor, clean/smudge filters and merge drivers picked by .gitattributes,
# credential helpers, a signing program, url rewrites to an ext:: transport,
# and anything an include.path pulls in. The workflows run this copy from the
# run's starting commit (git show "$GITHUB_SHA:scripts/git-config-guard.sh"),
# right after the Run step, so every later git call sees the cleaned config.
#
# It removes those keys from the repo's own config and pins hooks off there.
# User and system config are not the run's to write, so they are left alone.
#
# Workflows pass AEON_GIT_TOKEN from secrets after the run. Rebuild checkout's
# host-scoped HTTP header from that trusted value, never from a removed include.
# actions/checkout's post-job cleanup removes this header again.
set -euo pipefail

[ -d "$(git rev-parse --git-dir 2>/dev/null)" ] || { echo "git-config-guard: not a git checkout, nothing to do"; exit 0; }
CFG="$(git rev-parse --git-path config)"
[ -f "$CFG" ] || exit 0

# Lower-case, as `git config --name-only --list` prints section and key names
# (subsection names such as a filter's keep their case and are matched by .*).
EXEC_KEYS='^(core\.(fsmonitor|sshcommand|askpass|editor|pager|gitproxy|worktree|alternaterefscommand)|sequence\.editor|diff\.external|diff\..*\.(command|textconv)|merge\..*\.driver|filter\..*\.(clean|smudge|process)|credential\.helper|credential\..*\.helper|gpg\.program|gpg\..*\.program|(commit|tag|push)\.gpgsign|include\.path|includeif\..*\.path|url\..*\.(insteadof|pushinsteadof)|protocol\.allow|protocol\..*\.allow|remote\..*\.(pushurl|receivepack|uploadpack))$'

removed=""
while IFS= read -r key; do
  [ -z "$key" ] && continue
  git config --file "$CFG" --unset-all "$key" || true
  removed="$removed $key"
done < <(git config --file "$CFG" --name-only --list | grep -E "$EXEC_KEYS" | sort -u || true)

# Hooks default to .git/hooks/, which the run could also write, so pin them off.
if [ "$(git config --file "$CFG" --get-all core.hooksPath || true)" != /dev/null ]; then
  git config --file "$CFG" --get core.hooksPath >/dev/null 2>&1 && removed="$removed core.hookspath"
  git config --file "$CFG" --replace-all core.hooksPath /dev/null
fi

if [ -n "$removed" ]; then
  echo "::warning::git-config-guard: removed config the run left in .git/config:$removed"
fi
echo "git-config-guard: .git/config cleaned, hooks off"

# checkout stores auth behind includeIf, which the guard must remove along
# with untrusted includes. Restore only HTTP auth, not the included config.
if [ -n "${AEON_GIT_TOKEN:-}" ]; then
  SERVER="${GITHUB_SERVER_URL:-https://github.com}"
  AUTH=$(printf '%s' "x-access-token:$AEON_GIT_TOKEN" | base64 | tr -d '\r\n')
  git config --file "$CFG" --replace-all "http.${SERVER%/}/.extraheader" "AUTHORIZATION: basic $AUTH"
  unset AUTH
  echo "git-config-guard: restored trusted checkout HTTP authentication"
fi

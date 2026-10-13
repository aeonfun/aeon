#!/usr/bin/env bash
# Regression test for scripts/git-config-guard.sh: config a run plants in
# .git/config to make the post-run git steps run a program is removed, hooks are
# off, and the config the checkout needs (remote, branch, identity) is kept.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.com GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.com

R="$TMP/run"
git init -q -b main "$R"
git -C "$R" commit -q --allow-empty -m seed
git -C "$R" remote add origin https://github.com/example/repo
git -C "$R" config user.name aeonframework
git -C "$R" config branch.main.remote origin

MARK="$TMP/ran"
EVIL="$TMP/evil.sh"
printf '#!/bin/sh\necho "$0 $*" >> %q\ncat\n' "$MARK" > "$EVIL"
chmod +x "$EVIL"

# What a run could plant.
git -C "$R" config core.fsmonitor "$EVIL"
git -C "$R" config core.hooksPath "$TMP"
git -C "$R" config filter.x.clean "$EVIL"
git -C "$R" config filter.x.smudge "$EVIL"
git -C "$R" config merge.x.driver "$EVIL"
git -C "$R" config credential.helper "!$EVIL"
git -C "$R" config commit.gpgsign true
git -C "$R" config gpg.program "$EVIL"
git -C "$R" config include.path "$TMP/more.config"
git -C "$R" config remote.origin.pushurl https://github.com/attacker/repo
git -C "$R" config url."ext::$EVIL".insteadOf https://example.invalid/
git -C "$R" config protocol.ext.allow always
printf '* filter=x merge=x\n' > "$R/.gitattributes"
mkdir -p "$R/.git/hooks"
printf '#!/bin/sh\ntouch %q\n' "$MARK.hook" > "$R/.git/hooks/pre-commit"
chmod +x "$R/.git/hooks/pre-commit"

out=$(cd "$R" && bash "$ROOT/scripts/git-config-guard.sh" 2>&1); rc=$?
[ "$rc" -eq 0 ] && pass "guard succeeds" || { bad "guard exited $rc"; echo "$out"; }
grep -q '::warning::git-config-guard: removed' <<<"$out" && pass "removed keys are reported" || bad "no warning for removed keys"

left=$(git -C "$R" config --local --name-only --list)
for k in core.fsmonitor filter.x.clean filter.x.smudge merge.x.driver credential.helper commit.gpgsign gpg.program include.path remote.origin.pushurl protocol.ext.allow; do
  grep -qx "$k" <<<"$left" && bad "$k is still set"
done
grep -qi 'insteadof' <<<"$left" && bad "url insteadOf is still set"
[ "$(git -C "$R" config --local core.hooksPath)" = /dev/null ] && pass "hooks pinned off" || bad "core.hooksPath is not /dev/null"
[ "$(git -C "$R" config --local remote.origin.url)" = https://github.com/example/repo ] \
  && [ "$(git -C "$R" config --local user.name)" = aeonframework ] \
  && [ "$(git -C "$R" config --local branch.main.remote)" = origin ] \
  && pass "remote, identity and branch config kept" || bad "guard removed config the checkout needs"

# Nothing planted runs on the git calls the commit steps make.
(
  cd "$R" || exit 1
  printf 'x\n' > f.txt
  git status --porcelain >/dev/null
  git add -A
  git commit -qm "post-run commit"
) >/dev/null 2>&1
[ ! -e "$MARK" ] && [ ! -e "$MARK.hook" ] && pass "no planted program or hook ran on status/add/commit" \
  || bad "a planted program ran: $(cat "$MARK" 2>/dev/null) $([ -e "$MARK.hook" ] && echo hook)"

# Second run is quiet and idempotent.
out=$(cd "$R" && bash "$ROOT/scripts/git-config-guard.sh" 2>&1); rc=$?
[ "$rc" -eq 0 ] && ! grep -q '::warning::' <<<"$out" && pass "second run is a clean no-op" || bad "second run warned or failed (rc=$rc)"

# Not a git checkout: nothing to do, no failure.
mkdir -p "$TMP/plain"
out=$(cd "$TMP/plain" && GIT_CEILING_DIRECTORIES="$TMP" bash "$ROOT/scripts/git-config-guard.sh" 2>&1); rc=$?
[ "$rc" -eq 0 ] && pass "outside a checkout it exits 0" || { bad "outside a checkout it exited $rc"; echo "$out"; }

echo "---"
[ "$fail" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

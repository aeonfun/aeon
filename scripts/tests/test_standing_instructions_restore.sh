#!/usr/bin/env bash
# Regression test for aeon.yml's "Restore standing instructions" step. The file
# that "Single-source standing instructions" hides (CLAUDE.md or AGENTS.md) is
# parked in $RUNNER_TEMP, which stays writable inside the read-only sandbox. The
# restore must bring the file back from git, so a run that edits or deletes the
# parked copy can't get that change committed by "Commit results".
set -uo pipefail

WORKFLOW="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.github/workflows/aeon.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

awk '
  /^      - name: Restore standing instructions$/ { step=1; next }
  step && /^        run: \|$/ { on=1; next }
  on && /^      - name: / { exit }
  on && /^      # / { exit }
  on { print }
' "$WORKFLOW" | sed 's/^          //' > "$TMP/restore.sh"
grep -q 'HIDDEN' "$TMP/restore.sh" \
  || { echo "FAIL: extraction drifted (no restore body found)" >&2; cat "$TMP/restore.sh" >&2; exit 1; }

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

setup() {  # setup <dir>: repo with committed CLAUDE.md, hidden as the workflow does
  local d="$1"
  mkdir -p "$d/repo" "$d/rt"
  git -C "$d/repo" init -q
  git -C "$d/repo" config user.email t@t; git -C "$d/repo" config user.name t
  printf 'real manual\n' > "$d/repo/CLAUDE.md"
  git -C "$d/repo" add CLAUDE.md && git -C "$d/repo" commit -qm init
  mv "$d/repo/CLAUDE.md" "$d/rt/CLAUDE.md.singlesrc"
}
restore() {  # restore <dir> <hidden>
  ( cd "$1/repo" && RUNNER_TEMP="$1/rt" HIDDEN="$2" bash -e "$TMP/restore.sh" ) >/dev/null 2>&1
}

D="$TMP/tamper"; setup "$D"
printf 'injected instructions\n' > "$D/rt/CLAUDE.md.singlesrc"
restore "$D" CLAUDE.md
[ "$(cat "$D/repo/CLAUDE.md" 2>/dev/null)" = "real manual" ] && pass "edited parked copy does not reach the workspace" \
  || bad "tampered parked copy restored: $(cat "$D/repo/CLAUDE.md" 2>/dev/null)"
[ -z "$(git -C "$D/repo" status --porcelain)" ] && pass "working tree matches HEAD after restore" || bad "tree dirty: $(git -C "$D/repo" status --porcelain)"
[ ! -e "$D/rt/CLAUDE.md.singlesrc" ] && pass "parked copy discarded" || bad "parked copy left behind"

D="$TMP/deleted"; setup "$D"
rm -f "$D/rt/CLAUDE.md.singlesrc"
restore "$D" CLAUDE.md
[ "$(cat "$D/repo/CLAUDE.md" 2>/dev/null)" = "real manual" ] && pass "deleted parked copy still restored from git (no committed deletion)" \
  || bad "CLAUDE.md missing after the parked copy was deleted"

D="$TMP/symlink"; setup "$D"
rm -f "$D/rt/CLAUDE.md.singlesrc"; ln -s /etc/hostname "$D/rt/CLAUDE.md.singlesrc"
restore "$D" CLAUDE.md
[ "$(cat "$D/repo/CLAUDE.md" 2>/dev/null)" = "real manual" ] && [ ! -L "$D/repo/CLAUDE.md" ] && pass "symlinked parked copy ignored" \
  || bad "symlink swap reached the workspace"

D="$TMP/none"; setup "$D"
restore "$D" "" && pass "nothing hidden: no-op" || bad "empty HIDDEN failed"

D="$TMP/bad"; setup "$D"
if restore "$D" "../../etc/passwd"; then bad "unexpected HIDDEN value accepted"; else pass "unexpected HIDDEN value rejected"; fi

echo "---"
[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }

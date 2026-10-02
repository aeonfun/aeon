#!/usr/bin/env bash
# init-sandbox.sh - end-to-end tests for `aeon init` with no network and no real
# GitHub: `gh` is apps/cli/test/fake-gh (a directory of bare repos plus a state
# dir), and git reaches "https://github.com/..." through a url.insteadOf
# rewrite into that directory. Runs the real CLI (apps/cli/aeon) non-interactively.
#
# Covers: switching a template clone over (origin = instance, upstream =
# template, main tracks origin/main, Actions settings changed without touching
# the default token permission), idempotent re-run, repairing a branch left
# tracking the template, resuming an interrupted switch-over, refusing to create
# anything without a terminal or --yes, refusing a dirty folder BEFORE creating
# the repo, --dir waiting for content and handing over, and --harness on an
# already-connected harness only switching aeon.yml (no login).
#
# Run: bash apps/cli/test/init-sandbox.sh   (needs apps/cli deps: npm ci in apps/cli)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CLI="$HERE/../aeon"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

export FAKE_GH_ROOT="$T/fake" FAKE_GH_STATE="$T/state"
GH="$FAKE_GH_ROOT/github.com"
mkdir -p "$T/bin" "$GH/aeonfun"
ln -s "$HERE/fake-gh" "$T/bin/gh"
export PATH="$T/bin:$PATH"
export GIT_CONFIG_GLOBAL="$T/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global url."file://$GH/".insteadOf "https://github.com/"
git config --global user.email "tester@example.com"
git config --global user.name "tester"
git config --global init.defaultBranch main
git config --global commit.gpgsign false
unset GH_TOKEN GITHUB_TOKEN GITHUB_REPO

# The template: a tiny Aeon-shaped repo. Its ./aeon is a stub that records the
# hand-over from `init --dir`.
mkdir -p "$T/tpl"
printf 'model: claude-sonnet-5-5\ngateway: { provider: auto }\nskills:\n  heartbeat: { enabled: true }\n' > "$T/tpl/aeon.yml"
printf '#!/usr/bin/env bash\necho "child-init $*" > "%s/child-args"\n' "$T" > "$T/tpl/aeon"
chmod +x "$T/tpl/aeon"
git -C "$T/tpl" init -q && git -C "$T/tpl" add -A && git -C "$T/tpl" commit -q -m template
git clone -q --bare "$T/tpl" "$GH/aeonfun/aeon.git"

clone_template() {  # clone_template <dir>: a fresh `git clone` of aeonfun/aeon
  git clone -q https://github.com/aeonfun/aeon "$1"
}
init() {  # init <dir> [args...]: run the real CLI against <dir>, no TTY
  local dir="$1"; shift
  (cd "$dir" && AEON_REPO_ROOT="$dir" "$CLI" init --no-telegram --no-dashboard "$@" </dev/null) > "$T/out" 2>&1
}
u() { git -C "$1" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null; }
url() { git -C "$1" remote get-url "$2" 2>/dev/null; }

# --- 1. switch a template clone over --------------------------------------------
W="$T/w1"; clone_template "$W"
init "$W" --yes; rc=$?
[ "$rc" = 0 ] && pass "fresh run exits 0" || { bad "fresh run exited $rc"; cat "$T/out"; }
[ -d "$GH/tester/aeon.git" ] && pass "instance tester/aeon created from the template" || bad "instance not created"
case "$(url "$W" origin)" in *github.com/tester/aeon.git) pass "origin is the instance" ;; *) bad "origin is $(url "$W" origin)" ;; esac
case "$(url "$W" upstream)" in *github.com/aeonfun/aeon*) pass "upstream is the template" ;; *) bad "upstream is $(url "$W" upstream)" ;; esac
[ "$(u "$W")" = "origin/main" ] && pass "main tracks origin/main" || bad "main tracks $(u "$W")"
git -C "$W" remote | grep -qx aeon-instance && bad "temporary remote left behind" || pass "no temporary remote left"
[ "$(cat "$FAKE_GH_STATE/default")" = "tester/aeon" ] && pass "gh default repo is the instance" || bad "gh default is $(cat "$FAKE_GH_STATE/default")"
grep -q "actions/permissions -F enabled=true -f allowed_actions=all" "$FAKE_GH_STATE/puts" && pass "Actions enabled (allowed_actions was unset)" || bad "Actions not enabled"
grep "actions/permissions/workflow" "$FAKE_GH_STATE/puts" | grep -q "default_workflow_permissions=read -F can_approve_pull_request_reviews=true" \
  && pass "PR approval on, default token kept at read" || bad "workflow permissions PUT wrong: $(grep workflow "$FAKE_GH_STATE/puts")"
grep -q "default_workflow_permissions=write" "$FAKE_GH_STATE/puts" && bad "default token was raised to write" || pass "default token never raised to write"
grep -qx GH_GLOBAL "$FAKE_GH_STATE/secrets-tester_aeon" && pass "GH_GLOBAL stored on the instance (--yes)" || bad "GH_GLOBAL not stored"
grep -Eq "^auth (login|refresh)" "$FAKE_GH_STATE/calls" && bad "a browser login was started without a terminal" || pass "no login flow without a terminal"

# --- 2. idempotent re-run -----------------------------------------------------------
puts_before="$(wc -l < "$FAKE_GH_STATE/puts")"
init "$W" --yes; rc=$?
[ "$rc" = 0 ] && pass "re-run exits 0" || { bad "re-run exited $rc"; cat "$T/out"; }
[ "$(wc -l < "$FAKE_GH_STATE/puts")" = "$puts_before" ] && pass "re-run changes no settings" || bad "re-run sent PUTs"
grep -q "this folder is your instance: tester/aeon" "$T/out" && pass "re-run recognises the instance" || bad "re-run did not recognise the instance"

# --- 3. a branch left tracking the template is repaired --------------------------
git -C "$W" branch -q --set-upstream-to=upstream/main main
init "$W" --yes
[ "$(u "$W")" = "origin/main" ] && pass "main re-pointed at origin/main" || bad "main still tracks $(u "$W")"
grep -q "main now tracks origin/main (was upstream/main)" "$T/out" && pass "repair reported" || bad "repair not reported"

# --- 4. --harness on a connected harness only switches aeon.yml -----------------
echo OPENROUTER_API_KEY >> "$FAKE_GH_STATE/secrets-tester_aeon"
: > "$FAKE_GH_STATE/calls"
init "$W" --yes --harness codex; rc=$?
[ "$rc" = 0 ] && pass "--harness codex exits 0" || { bad "--harness codex exited $rc"; cat "$T/out"; }
grep -q "OpenAI Codex CLI is connected (OPENROUTER_API_KEY)" "$T/out" && pass "codex seen as connected" || bad "codex not seen as connected"
git --git-dir="$GH/tester/aeon.git" show main:aeon.yml | grep -q '^harness: codex' \
  && pass "aeon.yml harness: codex pushed to the instance" || bad "harness switch not pushed to origin"
git --git-dir="$GH/aeonfun/aeon.git" show main:aeon.yml | grep -q '^harness:' && bad "template was pushed to" || pass "template untouched"

# --- 5. resume an interrupted switch-over ------------------------------------------
# State after a crash mid-adopt: the instance was fetched under the temporary
# remote and checked out, origin was renamed to upstream, nothing else.
W="$T/w5"; clone_template "$W"
"$HERE/fake-gh" repo create tester/aeon5 --template aeonfun/aeon --public >/dev/null
git -C "$W" remote add aeon-instance https://github.com/tester/aeon5.git
git -C "$W" fetch -q aeon-instance
git -C "$W" checkout -q -B main aeon-instance/main
git -C "$W" remote rename origin upstream
init "$W" --yes --name aeon5; rc=$?
[ "$rc" = 0 ] && pass "interrupted switch-over resumes" || { bad "resume exited $rc"; cat "$T/out"; }
case "$(url "$W" origin)" in *github.com/tester/aeon5.git) pass "resumed: origin is the instance" ;; *) bad "resumed origin is $(url "$W" origin)" ;; esac
[ "$(u "$W")" = "origin/main" ] && pass "resumed: main tracks origin/main" || bad "resumed: main tracks $(u "$W")"

# --- 6. no terminal and no --yes: nothing is created ------------------------------
W="$T/w6"; clone_template "$W"
init "$W" --name aeon6; rc=$?
[ "$rc" != 0 ] && pass "no --yes without a terminal stops" || bad "ran without confirmation"
[ -d "$GH/tester/aeon6.git" ] && bad "repo created without confirmation" || pass "no repo created"
grep -q "pass --yes" "$T/out" && pass "says to pass --yes" || bad "missing --yes hint"
case "$(url "$W" origin)" in *aeonfun/aeon*) pass "folder left untouched" ;; *) bad "folder changed: $(url "$W" origin)" ;; esac

# --- 7. a dirty folder is refused BEFORE the repo is created ---------------------
W="$T/w7"; clone_template "$W"
echo "# local edit" >> "$W/aeon.yml"
init "$W" --yes --name aeon7; rc=$?
[ "$rc" != 0 ] && pass "dirty folder stops" || bad "dirty folder was switched over"
[ -d "$GH/tester/aeon7.git" ] && bad "repo created before the dirty check" || pass "dirty check runs before create"

# --- 8. --dir clones the instance and hands over -----------------------------------
W="$T/w8"; clone_template "$W"
init "$W" --yes --name aeon8 --dir "$T/d8"; rc=$?
[ "$rc" = 0 ] && pass "--dir exits with the child's status" || { bad "--dir exited $rc"; cat "$T/out"; }
[ -f "$T/d8/aeon.yml" ] && pass "--dir cloned the instance" || bad "--dir clone missing"
grep -q "child-init init --yes --no-telegram --no-dashboard" "$T/child-args" 2>/dev/null && pass "handed over to the clone's ./aeon init" || bad "no hand-over (args: $(cat "$T/child-args" 2>/dev/null))"
mkdir -p "$T/d9" && echo keep > "$T/d9/file"
init "$W" --yes --name aeon8 --dir "$T/d9"; rc=$?
[ "$rc" != 0 ] && [ -f "$T/d9/file" ] && pass "--dir refuses a non-empty folder and leaves it alone" || bad "--dir on a non-empty folder: rc=$rc"

[ "$fail" = 0 ] && echo "PASS" || echo "SOME TESTS FAILED"
exit $fail

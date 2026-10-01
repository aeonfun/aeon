#!/usr/bin/env bash
# Tests for run-harness's read-only OS-sandbox gate — the case statement at
# ~line 141 that decides which harnesses get the wrapper sandbox applied.
#
# This exact gate is what silently missed `fx` when it was added as a 7th
# harness (aeonfun/aeon#941 review): the adapter, resolve-harness.sh, and
# install-harness.sh were all wired correctly, but run-harness's own sandbox
# case statement still only listed the original six — so a read-only fx skill
# would have run completely unsandboxed, with not even the advisory warning,
# since the whole case block is a no-op for any name it doesn't match.
#
# No fake harness CLI needed: the sandbox message prints unconditionally when
# the case matches, BEFORE the adapter script (which is what actually checks
# `command -v <harness>`) ever runs — so this test only needs the harness name
# to reach the gate, not to successfully dispatch. Confirmed by reading
# run-harness itself: the only earlier existence check is
# `[ -f adapters/$HARNESS.sh ]`, not the CLI binary.
#
# Run: bash scripts/tests/test_run_harness_sandbox_gate.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
RH="$(pwd)/harness-adapter/run-harness"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

[ -x "$RH" ] || { echo "FAIL - $RH not executable"; exit 1; }

# Every harness that HAS an adapter file must reach the sandbox gate in
# read-only mode. Derived from the real adapters/ directory, not hardcoded,
# so this test itself can't silently miss a newly added harness the way the
# gate it's testing once did.
# (plain read loop, not `mapfile` — bash 3.2, macOS's stock /bin/bash, has no
# mapfile builtin; this repo has already hit that class of portability gap
# once today)
HARNESSES=()
while IFS= read -r name; do HARNESSES+=("$name"); done < <(cd harness-adapter/adapters && ls *.sh | sed 's/\.sh$//' | sort)

if [ "${#HARNESSES[@]}" -eq 0 ]; then
  bad "no adapters found in harness-adapter/adapters/ — test setup is broken"
fi

for h in "${HARNESSES[@]}"; do
  # --timeout tiny: the underlying "harness CLI" won't exist on this machine,
  # so the adapter's own `command -v` check fails almost instantly — we only
  # care about what's on stderr before that point.
  out=$(echo "prompt" | bash "$RH" "$h" --mode read-only --timeout 5 2>&1 >/dev/null)
  if echo "$out" | grep -q "read-only: workspace write-locked via"; then
    pass "$h: reaches the sandbox gate (wrapper applied)"
  elif echo "$out" | grep -q "warning: no OS sandbox available — read-only is advisory for $h"; then
    pass "$h: reaches the sandbox gate (advisory fallback — no OS sandbox on this machine)"
  else
    bad "$h: did NOT reach the sandbox gate at all (this is exactly the missing-fx-arm bug class) — stderr: $out"
  fi
done

# A harness with no adapter file should fail at the existence check, well
# before ever reaching the sandbox gate — confirms the gate isn't somehow
# matching on an unrelated wildcard.
out=$(echo "prompt" | bash "$RH" totally-not-a-real-harness --mode read-only 2>&1 >/dev/null)
echo "$out" | grep -q "unknown harness" \
  && pass "an unregistered harness name fails at the existence check, not the sandbox gate" \
  || bad "unregistered harness name should fail with 'unknown harness' (got: $out)"

# --- sandbox_prefix (Linux/bwrap argv) -----------------------------------------
# The read-only bwrap prefix must lock the paths a run could use to poison LATER
# workflow steps (runner file-command dir, global git config, _actions) and drop
# the GITHUB_ENV-family vars, while keeping memory/ + output/ writable. Exercised
# with a stub `uname`/`bwrap` so it runs the same on macOS and Linux CI.
SBX=$(mktemp -d)
trap 'rm -rf "$SBX"' EXIT
mkdir -p "$SBX/bin" "$SBX/home" "$SBX/work/_temp/_runner_file_commands" \
  "$SBX/work/_actions" "$SBX/work/repo/repo/memory" "$SBX/work/repo/repo/output"
printf '#!/bin/sh\nexit 0\n' > "$SBX/bin/bwrap"; chmod +x "$SBX/bin/bwrap"
FC="$SBX/work/_temp/_runner_file_commands"
prefix=$(
  cd "$SBX/work/repo/repo" || exit 1
  # shellcheck disable=SC2329  # invoked indirectly by sandbox_prefix
  uname() { echo Linux; }
  # shellcheck source=harness-adapter/lib/sandbox.sh
  . "$OLDPWD/harness-adapter/lib/sandbox.sh"
  PATH="$SBX/bin:$PATH" HOME="$SBX/home" XDG_CONFIG_HOME="" \
    GITHUB_ENV="$FC/set_env_x" GITHUB_PATH="$FC/add_path_x" GITHUB_OUTPUT="$FC/set_output_x" \
    GITHUB_STEP_SUMMARY="$FC/step_summary_x" GITHUB_STATE="$FC/save_state_x" \
    RUNNER_WORKSPACE="$SBX/work/repo" sandbox_prefix "$SBX"
)
WS=$(cd "$SBX/work/repo/repo" && pwd -P)
TOK=()
while IFS= read -r t; do TOK+=("$t"); done <<<"$prefix"
# has_pair OPT PATH -> true when the argv carries `OPT PATH PATH` (a bind of PATH onto itself)
has_pair() {
  local i
  for ((i = 0; i + 2 < ${#TOK[@]}; i++)); do
    [ "${TOK[i]}" = "$1" ] && [ "${TOK[i+1]}" = "$2" ] && [ "${TOK[i+2]}" = "$2" ] && return 0
  done
  return 1
}
has_pair --ro-bind "$WS" && pass "sandbox_prefix: workspace ro-bound" || bad "sandbox_prefix: workspace not ro-bound ($prefix)"
has_pair --bind "$WS/memory" && pass "sandbox_prefix: memory/ stays rw" || bad "sandbox_prefix: memory/ not re-bound rw"
has_pair --bind "$WS/output" && pass "sandbox_prefix: output/ stays rw" || bad "sandbox_prefix: output/ not re-bound rw"
[ "$(printf '%s\n' "$prefix" | grep -cx -- "$FC")" = 2 ] && has_pair --ro-bind "$FC" \
  && pass "sandbox_prefix: runner file-command dir ro-bound once" \
  || bad "sandbox_prefix: runner file-command dir not ro-bound exactly once"
has_pair --ro-bind "$SBX/home/.gitconfig" && [ -f "$SBX/home/.gitconfig" ] \
  && pass "sandbox_prefix: missing ~/.gitconfig created empty and ro-bound" \
  || bad "sandbox_prefix: ~/.gitconfig not locked"
has_pair --ro-bind "$SBX/home/.config/git" && pass "sandbox_prefix: ~/.config/git ro-bound" \
  || bad "sandbox_prefix: ~/.config/git not locked"
has_pair --ro-bind "$SBX/work/_actions" && pass "sandbox_prefix: runner _actions dir ro-bound" \
  || bad "sandbox_prefix: _actions not locked"
for v in GITHUB_ENV GITHUB_PATH GITHUB_OUTPUT GITHUB_STEP_SUMMARY GITHUB_STATE; do
  printf '%s\n' "$prefix" | grep -A1 -x -- --unsetenv | grep -qx "$v" \
    && pass "sandbox_prefix: unsets $v" || bad "sandbox_prefix: does not unset $v"
done
[ "$(printf '%s\n' "$prefix" | tail -1)" = "--die-with-parent" ] \
  && pass "sandbox_prefix: options end before the command" || bad "sandbox_prefix: last token is not --die-with-parent"

# Live check where a working bwrap exists (Linux CI with userns): a write to the
# file-command dir fails, a write to memory/ lands, and GITHUB_ENV is gone.
if [ "$(uname -s)" = Linux ] && command -v bwrap >/dev/null 2>&1 \
   && bwrap --dev-bind / / true >/dev/null 2>&1; then
  live=()
  while IFS= read -r tok; do live+=("$tok"); done < <(
    cd "$SBX/work/repo/repo" && . "$OLDPWD/harness-adapter/lib/sandbox.sh" \
      && HOME="$SBX/home" GITHUB_ENV="$FC/set_env_x" RUNNER_WORKSPACE="$SBX/work/repo" sandbox_prefix "$SBX")
  ( cd "$SBX/work/repo/repo" && GITHUB_ENV="$FC/set_env_x" "${live[@]}" sh -c \
      'echo X=1 >> "'"$FC"'/set_env_x"' ) 2>/dev/null \
    && bad "live bwrap: wrote into the runner file-command dir" \
    || pass "live bwrap: runner file-command dir is read-only"
  ( cd "$SBX/work/repo/repo" && "${live[@]}" sh -c 'echo ok > memory/probe' ) 2>/dev/null \
    && [ -f "$SBX/work/repo/repo/memory/probe" ] \
    && pass "live bwrap: memory/ still writable" || bad "live bwrap: memory/ write failed"
  out=$(cd "$SBX/work/repo/repo" && GITHUB_ENV="$FC/set_env_x" "${live[@]}" sh -c 'echo "[${GITHUB_ENV:-unset}]"' 2>&1)
  [ "$out" = "[unset]" ] && pass "live bwrap: GITHUB_ENV unset inside sandbox" \
    || bad "live bwrap: GITHUB_ENV visible inside sandbox ($out)"
else
  echo "skip - live bwrap checks (no working bwrap on this machine)"
fi

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

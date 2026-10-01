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
# The mock tree must live OUTSIDE every path the sandbox adds back read-write
# (/tmp, $TMPDIR, $RUNNER_TEMP, the run tmpdir, $HOME state dirs), or the ro-root
# model under test would make the whole tree writable and every ro / escape-refusal
# assertion would be vacuous. $HOME is that place: it is read-only by default (only
# specific $HOME subdirs are added back rw), and the mock tree is a plain child of
# it. Each build below pins TMPDIR to $TMP and RUNNER_TEMP to the mock _temp so the
# lib binds those (not the operator's real dirs) when it runs. The run's own tmpdir
# ($TMP, the lib's first arg) and the mock $RUNNER_TEMP ($SBX/work/_temp) ARE rw;
# the mock HOME + workspace sit elsewhere under $SBX, so they stay read-only.
SBX=$(mktemp -d "${HOME:-/tmp}/sbxgate.XXXXXX")
trap 'rm -rf "$SBX"' EXIT
TMP="$SBX/runtmp"
RT="$SBX/work/_temp"
mkdir -p "$SBX/bin" "$SBX/home" "$SBX/work/_temp/_runner_file_commands" \
  "$SBX/work/_actions" "$SBX/work/repo/repo/memory" "$SBX/work/repo/repo/output" \
  "$SBX/home/.foundry/bin" "$SBX/home/.local/bin" "$SBX/home/.local/share/pipx" \
  "$SBX/toolcache/node/bin" "$SBX/work/_temp/snap" "$SBX/work/_temp/aeon-pending" "$TMP"
printf '#!/bin/sh\nexit 0\n' > "$SBX/bin/bwrap"; chmod +x "$SBX/bin/bwrap"
FC="$SBX/work/_temp/_runner_file_commands"
SNAP="$SBX/work/_temp/snap"
PEND="$SBX/work/_temp/aeon-pending"
prefix=$(
  cd "$SBX/work/repo/repo" || exit 1
  # shellcheck disable=SC2329  # invoked indirectly by sandbox_prefix
  uname() { echo Linux; }
  # shellcheck source=harness-adapter/lib/sandbox.sh
  . "$OLDPWD/harness-adapter/lib/sandbox.sh"
  PATH="$SBX/bin:$SBX/home/.local/bin:$SBX/home/.foundry/bin:$SBX/toolcache/node/bin:$PATH" HOME="$SBX/home" XDG_CONFIG_HOME="" \
    GITHUB_ENV="$FC/set_env_x" GITHUB_PATH="$FC/add_path_x" GITHUB_OUTPUT="$FC/set_output_x" \
    GITHUB_STEP_SUMMARY="$FC/step_summary_x" GITHUB_STATE="$FC/save_state_x" \
    RUNNER_WORKSPACE="$SBX/work/repo" RUNNER_TOOL_CACHE="$SBX/toolcache" RUNNER_TEMP="$RT" \
    AEON_HARNESS_CONFIG_SNAPSHOT="$SNAP" AEON_PENDING_DIR="$PEND" TMPDIR="$TMP" sandbox_prefix "$TMP"
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
# has_opt OPT ARG -> argv carries `OPT ARG` consecutively (two-token option)
has_opt() {
  local i
  for ((i = 0; i + 1 < ${#TOK[@]}; i++)); do
    [ "${TOK[i]}" = "$1" ] && [ "${TOK[i+1]}" = "$2" ] && return 0
  done
  return 1
}
# Read-only root: the whole fs is ro by default, with a working /dev + /proc.
[ "${TOK[0]}" = bwrap ] && pass "sandbox_prefix: prefix starts with bwrap" || bad "sandbox_prefix: first token is not bwrap (${TOK[0]})"
has_pair --ro-bind / && pass "sandbox_prefix: host fs ro-bound at / (read-only root)" || bad "sandbox_prefix: root not ro-bound ($prefix)"
has_opt --dev /dev && pass "sandbox_prefix: fresh /dev" || bad "sandbox_prefix: no --dev /dev"
has_opt --proc /proc && pass "sandbox_prefix: fresh /proc" || bad "sandbox_prefix: no --proc /proc"
# The workspace itself is NOT a separate mount: it is read-only via the root, so
# there is no bind to rename aside (that was the escape).
has_pair --ro-bind "$WS" || has_pair --bind "$WS" \
  && bad "sandbox_prefix: workspace is a separate mount (should be ro via root)" \
  || pass "sandbox_prefix: workspace has no separate mount (read-only via root)"
# ...but its two documented state dirs are added back rw.
has_pair --bind "$WS/memory" && pass "sandbox_prefix: memory/ stays rw" || bad "sandbox_prefix: memory/ not re-bound rw"
has_pair --bind "$WS/output" && pass "sandbox_prefix: output/ stays rw" || bad "sandbox_prefix: output/ not re-bound rw"
# Scratch stays writable: this run's tmpdir, /tmp, and the pending/notify queue.
has_pair --bind "$TMP" && pass "sandbox_prefix: run tmpdir rw" || bad "sandbox_prefix: run tmpdir not rw-bound"
has_pair --bind /tmp && pass "sandbox_prefix: /tmp rw" || bad "sandbox_prefix: /tmp not rw-bound"
has_pair --bind "$PEND" && pass "sandbox_prefix: AEON_PENDING_DIR rw" || bad "sandbox_prefix: pending/notify queue not rw-bound"
has_pair --bind "$RT" && pass "sandbox_prefix: \$RUNNER_TEMP scratch rw" || bad "sandbox_prefix: \$RUNNER_TEMP not rw-bound"
# Harness state dirs under $HOME are rw (created first; bwrap needs them to exist).
for rel in .claude .codex .grok .kimi-code .vibe .pi .cache .npm; do
  has_pair --bind "$SBX/home/$rel" && [ -d "$SBX/home/$rel" ] \
    && pass "sandbox_prefix: ~/$rel created and rw-bound" || bad "sandbox_prefix: ~/$rel not rw-bound"
done
has_pair --bind "$SBX/home/.claude.json" && [ -f "$SBX/home/.claude.json" ] \
  && pass "sandbox_prefix: ~/.claude.json created and rw-bound" || bad "sandbox_prefix: ~/.claude.json not rw-bound"
# Paths a later unsandboxed step executes or reads config from must NOT be rw.
# They are read-only via the root (no explicit per-path bind), which is what closes
# the poisoning + parent-rename escape.
for rel in .local/bin .local/lib .gitconfig .config/gh .ssh .npmrc .foundry/bin; do
  has_pair --bind "$SBX/home/$rel" \
    && bad "sandbox_prefix: ~/$rel is rw (must stay read-only via the root)" \
    || pass "sandbox_prefix: ~/$rel not rw (read-only via root)"
done
has_pair --bind "$SBX/toolcache" && bad "sandbox_prefix: RUNNER_TOOL_CACHE is rw (must stay ro)" \
  || pass "sandbox_prefix: RUNNER_TOOL_CACHE read-only via root"
# The runner file-command dir and the harness-config snapshot are re-asserted ro
# (so they stay protected even when they sit under an rw scratch ancestor). Once each.
[ "$(printf '%s\n' "$prefix" | grep -cx -- "$FC")" = 2 ] && has_pair --ro-bind "$FC" \
  && pass "sandbox_prefix: runner file-command dir re-asserted ro once" \
  || bad "sandbox_prefix: runner file-command dir not ro exactly once"
has_pair --ro-bind "$SNAP" && pass "sandbox_prefix: harness-config snapshot re-asserted ro" \
  || bad "sandbox_prefix: harness-config snapshot not re-asserted ro"
for v in GITHUB_ENV GITHUB_PATH GITHUB_OUTPUT GITHUB_STEP_SUMMARY GITHUB_STATE; do
  printf '%s\n' "$prefix" | grep -A1 -x -- --unsetenv | grep -qx "$v" \
    && pass "sandbox_prefix: unsets $v" || bad "sandbox_prefix: does not unset $v"
done
[ "$(printf '%s\n' "$prefix" | tail -1)" = "--die-with-parent" ] \
  && pass "sandbox_prefix: options end before the command" || bad "sandbox_prefix: last token is not --die-with-parent"

# Live check where a working bwrap exists (Linux with unprivileged userns; ci-tests
# installs bwrap and lifts Ubuntu's AppArmor userns restriction, then sets
# AEON_REQUIRE_LIVE_BWRAP=1 so a broken setup fails here instead of skipping).
# Inside the real sandbox the workspace, the runner file-command dir, ~/.gitconfig
# and ~/.local/bin must reject writes, memory/ + output/ must take them, and
# GITHUB_ENV must be gone.
if [ "$(uname -s)" = Linux ] && command -v bwrap >/dev/null 2>&1 \
   && bwrap --dev-bind / / true >/dev/null 2>&1; then
  echo "live - running live bwrap sandbox checks ($(bwrap --version 2>/dev/null))"
  RW="$SBX/work/repo/repo"
  live=()
  while IFS= read -r tok; do live+=("$tok"); done < <(
    cd "$RW" && . "$OLDPWD/harness-adapter/lib/sandbox.sh" \
      && HOME="$SBX/home" GITHUB_ENV="$FC/set_env_x" RUNNER_WORKSPACE="$SBX/work/repo" \
         RUNNER_TEMP="$RT" TMPDIR="$TMP" sandbox_prefix "$TMP")
  # denied LABEL FILE -> the sandboxed append to FILE must fail and leave no trace
  denied() {
    if ( cd "$RW" && "${live[@]}" sh -c 'echo planted >> "$1"' sh "$2" ) 2>/dev/null \
       || grep -qs planted "$2"; then
      bad "live bwrap: $1 is writable inside the sandbox"
    else
      pass "live bwrap: $1 is read-only"
    fi
  }
  # allowed LABEL FILE -> the sandboxed write to FILE must land
  allowed() {
    ( cd "$RW" && "${live[@]}" sh -c 'echo ok > "$1"' sh "$2" ) 2>/dev/null && grep -qs ok "$2" \
      && pass "live bwrap: $1 still writable" || bad "live bwrap: $1 write failed"
  }
  denied "workspace" "$RW/planted.txt"
  denied "runner file-command dir" "$FC/set_env_x"
  denied "\$HOME/.gitconfig" "$SBX/home/.gitconfig"
  denied "\$HOME/.local/bin" "$SBX/home/.local/bin/gh"
  allowed "memory/" "$RW/memory/probe"
  allowed "output/" "$RW/output/probe"
  out=$(cd "$RW" && GITHUB_ENV="$FC/set_env_x" "${live[@]}" sh -c 'echo "[${GITHUB_ENV:-unset}]"' 2>&1)
  [ "$out" = "[unset]" ] && pass "live bwrap: GITHUB_ENV unset inside sandbox" \
    || bad "live bwrap: GITHUB_ENV visible inside sandbox ($out)"

  # --- parent-rename sandbox-escape probes ---------------------------------------
  # A ro-bind only pins the exact path it names. If the whole host fs is writable
  # (the old --dev-bind / /), a sandboxed run can rename the PARENT of a protected
  # path so the ro mount moves aside with it, then create a fresh dir/file at the
  # ORIGINAL location holding attacker content. The sandbox's mount namespace is
  # private but the filesystem is shared with the host, so a LATER, unsandboxed
  # workflow step (which does not share the mount namespace) then reads/executes
  # the attacker content at the original path: a planted ~/.local/bin on PATH, a
  # fake workspace the "Commit results" step operates on, a spoofed config-snapshot
  # dir, a poisoned GITHUB_ENV file-command dir. The fix makes the host fs
  # read-only by default (--ro-bind / /), under which renaming a parent on the ro
  # root fails (EROFS) and a ro/rw bind's own mount point cannot be renamed (EBUSY).
  # These probes must all be REFUSED. Each restores the layout it touched, guarded
  # on the moved copy so a refused rename never deletes the real path.
  escape_any=0
  sb_try() {  # sb_try PARENT PROTECTED -> prints ESCAPED iff the host's PROTECTED now holds attacker content
    local parent="$1" prot="$2" marker="SBX_PWNED_$$_$RANDOM" escaped=0
    ( cd "$RW" && "${SB_PRE[@]}" sh -c '
        mv "$1" "$1.sbxmoved" 2>/dev/null || exit 0
        mkdir -p "$2" 2>/dev/null
        printf %s "$3" > "$2/.sbx_pwned" 2>/dev/null
      ' sh "$parent" "$prot" "$marker" ) >/dev/null 2>&1
    [ "$(cat "$prot/.sbx_pwned" 2>/dev/null)" = "$marker" ] && escaped=1
    if [ -e "$parent.sbxmoved" ]; then
      rm -rf "$parent" 2>/dev/null
      mv "$parent.sbxmoved" "$parent" 2>/dev/null
    fi
    [ "$escaped" = 1 ] && echo ESCAPED
  }
  check_escape() {  # check_escape LABEL PARENT PROTECTED
    if [ "$(sb_try "$2" "$3")" = ESCAPED ]; then
      bad "live bwrap ESCAPE: renamed parent of $1 ($2) -> the host's $3 now holds attacker content"
      escape_any=1
    else
      pass "live bwrap: parent-rename escape of $1 refused ($3 stays protected)"
    fi
  }
  # One comprehensive synthetic prefix so every synthetic target is protected.
  mkdir -p "$SBX/snap/dir"
  SB_PRE=()
  while IFS= read -r tok; do SB_PRE+=("$tok"); done < <(
    cd "$RW" && . "$OLDPWD/harness-adapter/lib/sandbox.sh" \
      && HOME="$SBX/home" GITHUB_ENV="$FC/set_env_x" RUNNER_WORKSPACE="$SBX/work/repo" \
         RUNNER_TEMP="$RT" AEON_HARNESS_CONFIG_SNAPSHOT="$SBX/snap/dir" TMPDIR="$TMP" sandbox_prefix "$TMP")
  check_escape "workspace" "$SBX/work/repo" "$RW"
  check_escape "\$HOME/.local (parent of ro ~/.local/bin)" "$SBX/home/.local" "$SBX/home/.local/bin"
  check_escape "runner file-command dir" "$SBX/work/_temp" "$FC"
  check_escape "harness-config snapshot dir" "$SBX/snap" "$SBX/snap/dir"
  # Also on the REAL runner $HOME (disposable CI VM): ~/.local is the parent of the
  # ro ~/.local/bin that install-harness puts on PATH; pyyaml etc. live under it,
  # so the guarded restore matters for the steps that run after this one.
  if [ -n "${HOME:-}" ] && [ -d "$HOME" ]; then
    SB_PRE=()
    while IFS= read -r tok; do SB_PRE+=("$tok"); done < <(
      cd "$RW" && . "$OLDPWD/harness-adapter/lib/sandbox.sh" \
        && GITHUB_ENV="" RUNNER_WORKSPACE="" RUNNER_TOOL_CACHE="" RUNNER_TEMP="" TMPDIR="$TMP" sandbox_prefix "$TMP")
    check_escape "real \$HOME/.local" "$HOME/.local" "$HOME/.local/bin"
  fi
  [ "$escape_any" = 1 ] \
    && echo "live bwrap: SANDBOX ESCAPE CONFIRMED (parent-directory rename moves the ro mount aside)" \
    || echo "live bwrap: no parent-rename escape (host fs is read-only by default)"
elif [ "${AEON_REQUIRE_LIVE_BWRAP:-}" = 1 ]; then
  bad "live bwrap checks required (AEON_REQUIRE_LIVE_BWRAP=1) but bwrap is missing or cannot create a user namespace"
else
  echo "skip - live bwrap checks (no working bwrap on this machine)"
fi

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

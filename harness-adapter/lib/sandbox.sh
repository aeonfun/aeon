# shellcheck shell=bash
# sandbox.sh — wrapper-level OS sandbox for uniform read-only enforcement.
#
# No harness enforces read-only usefully on its own. codex's native sandbox works
# but also kills the network; grok's --sandbox read-only is silently ignored on
# 0.2.101 (writes still land); pi, vibe and kimi ship no filesystem sandbox at
# all; and claude's --allowedTools is sidestepped by a shell redirection.
# So for read-only runs the DISPATCHER applies its own sandbox around whatever
# harness runs: the workspace (cwd) becomes unwritable, everything else stays
# usable (harnesses need to write their own state under $HOME and $TMPDIR, and
# the network stays open — read-only is about the repo, not egress).
# This mirrors aeon's semantic: "a read-only skill physically cannot mutate the
# repo" — and makes it mean the same thing on all seven harnesses.
# On Linux it also locks what a LATER, unsandboxed workflow step would execute or
# read config from (runner file-command dir, git/gh/ssh/npm config, PATH dirs
# under $HOME, installed harness CLIs); the harness's own state dirs stay rw.

# sandbox_lock PATH -> print `--ro-bind PATH PATH`, once per sandbox_prefix call
# (dedup via sandbox_prefix's local $seen; bash locals are dynamically scoped).
sandbox_lock() {
  case " $seen " in *" $1 "*) return 0 ;; esac
  seen="$seen $1"
  printf '%s\n' --ro-bind "$1" "$1"
}

sandbox_prefix() {
  # sandbox_prefix TMPDIR [EXPANDED_MCP] -> prints prefix argv tokens (one per
  # line), or returns 1 if no OS sandbox is available on this machine.
  #
  # EXPANDED_MCP (optional) is the ${VAR}-expanded .mcp.json run-harness built.
  # When the workspace also carries a literal `.mcp.json`, that file is overlaid
  # with the expanded copy for the duration of the run. Reason: several harnesses
  # AUTO-DISCOVER `<cwd>/.mcp.json` and that discovery WINS over the config the
  # adapter stages. kimi is the measured case — with a project .mcp.json present
  # it sent `Authorization: Bearer ${MCP_GLIM_TOKEN}` verbatim (the literal, not
  # the value) and silently ignored the expanded copy in $KIMI_CODE_HOME; against
  # a real server that is a 401, so the agent falls back to raw curl and reports
  # the MCP server as "not connected". Overlaying at the sandbox layer fixes it
  # for every harness at once without writing a secret into the working tree
  # (the bind is process-private and vanishes with the sandbox).
  local tmp="$1" mcp="${2:-}" ws
  ws="$(pwd -P)"
  case "$(uname -s)" in
    Darwin)
      # No bind-mounts here, so the EXPANDED_MCP overlay is a Linux-only fix.
      # aeon runs on ubuntu runners; on macOS a harness that auto-discovers
      # `<cwd>/.mcp.json` still sees the literal ${VAR}s.
      command -v sandbox-exec >/dev/null 2>&1 || return 1
      local profile="$tmp/readonly-workspace.sb"
      cat > "$profile" <<EOF
(version 1)
(allow default)
(deny file-write* (subpath "$ws"))
(allow file-write* (subpath "$ws/memory"))
(allow file-write* (subpath "$ws/output"))
EOF
      printf '%s\n' sandbox-exec -f "$profile"
      ;;
    Linux)
      command -v bwrap >/dev/null 2>&1 || return 1
      # bind everything rw, then overlay the workspace read-only
      printf '%s\n' bwrap --dev-bind / / --ro-bind "$ws" "$ws"
      # keep the two documented state dirs writable: read-only means cannot
      # mutate code/config, not cannot persist state. memory/ (committed run
      # state) + output/ (artifacts) are the exceptions read-only skills rely
      # on (seo-audit, competitor-monitor). Re-bind rw after the ws ro-bind
      # (binds apply left to right); guard existence, bwrap errors on missing.
      [ -d "$ws/memory" ] && printf '%s\n' --bind "$ws/memory" "$ws/memory"
      [ -d "$ws/output" ] && printf '%s\n' --bind "$ws/output" "$ws/output"
      # ...then layer the expanded config over the literal one. Order matters:
      # bwrap applies binds left to right, so this must follow the workspace bind.
      [ -n "$mcp" ] && [ -f "$mcp" ] && [ -f "$ws/.mcp.json" ] && \
        printf '%s\n' --ro-bind "$mcp" "$ws/.mcp.json"
      # Close the paths a read-only run could use to poison LATER workflow steps,
      # which run outside the sandbox holding GH_GLOBAL: the runner's file-command
      # dir ($GITHUB_ENV / $GITHUB_PATH / $GITHUB_OUTPUT / $GITHUB_STEP_SUMMARY /
      # $GITHUB_STATE), global git config (hooksPath / credential.helper /
      # insteadOf), and the cached action checkouts under _actions.
      local p seen=""
      for p in "${GITHUB_ENV:-}" "${GITHUB_PATH:-}" "${GITHUB_OUTPUT:-}" \
               "${GITHUB_STEP_SUMMARY:-}" "${GITHUB_STATE:-}"; do
        [ -n "$p" ] || continue
        p="${p%/*}"
        case " $seen " in *" $p "*) continue ;; esac
        seen="$seen $p"
        [ -d "$p" ] && printf '%s\n' --ro-bind "$p" "$p"
      done
      if [ -n "${HOME:-}" ] && [ -d "$HOME" ]; then
        # A missing ~/.gitconfig could be CREATED inside the sandbox and then read
        # by later git steps, so make sure it exists (empty = no config) and lock it.
        [ -e "$HOME/.gitconfig" ] || : > "$HOME/.gitconfig" 2>/dev/null || true
        [ -f "$HOME/.gitconfig" ] && printf '%s\n' --ro-bind "$HOME/.gitconfig" "$HOME/.gitconfig"
        p="${XDG_CONFIG_HOME:-$HOME/.config}/git"
        [ -d "$p" ] || mkdir -p "$p" 2>/dev/null || true
        [ -d "$p" ] && printf '%s\n' --ro-bind "$p" "$p"
        # Same create-then-lock for the $HOME paths later steps EXECUTE or read
        # config from (a planted file there runs outside the sandbox):
        #   ~/.local/bin  on the runner PATH (install-harness also GITHUB_PATHs it)
        #   ~/.local/lib  python's user site: a dropped *.pth runs in every python3
        #   ~/.config/gh  gh config (aliases, http_unix_socket) for later gh calls
        #   ~/.ssh        ssh config (ProxyCommand) for any later ssh / git+ssh
        #   ~/.npmrc      npm config (registry, script-shell) for later npm / npx
        # Shell rc files are left alone: Actions runs steps with
        # `bash --noprofile --norc`, so nothing later sources them.
        for p in "$HOME/.local/bin" "$HOME/.local/lib" "${XDG_CONFIG_HOME:-$HOME/.config}/gh" "$HOME/.ssh"; do
          [ -d "$p" ] || mkdir -p "$p" 2>/dev/null || true
          [ -d "$p" ] && sandbox_lock "$p"
        done
        [ -e "$HOME/.npmrc" ] || : > "$HOME/.npmrc" 2>/dev/null || true
        [ -f "$HOME/.npmrc" ] && sandbox_lock "$HOME/.npmrc"
        # Harness installs that "Analyze skill output" re-runs OUTSIDE the sandbox
        # (vibe's pipx venv, cursor's build, hermes's checkout). cursor and hermes
        # run under a scratch HOME in RH_TMPDIR, so nothing writes here at runtime.
        for p in "$HOME/.local/share/pipx" "$HOME/.local/pipx" \
                 "$HOME/.local/share/cursor-agent" "$HOME/.hermes"; do
          [ -d "$p" ] && sandbox_lock "$p"
        done
        # Any other PATH dir under $HOME (~/.foundry/bin, ~/.cargo/bin, ...): later
        # steps resolve commands there. Skip $HOME itself and any dir holding the
        # workspace or this run's scratch dir; those keep their own binds.
        local real
        while IFS= read -r -d : p; do
          p="${p%/}"
          case "$p" in "$HOME"/*) ;; *) continue ;; esac
          [ -d "$p" ] && [ -w "$p" ] || continue
          real="$(cd "$p" 2>/dev/null && pwd -P)" || continue
          case "$ws/" in "$p"/*|"$real"/*) continue ;; esac
          case "$tmp/" in "$p"/*|"$real"/*) continue ;; esac
          sandbox_lock "$p"
        done <<<"${PATH:-}:"
      fi
      # The runner tool cache holds setup-node's prefix, i.e. every `npm i -g`
      # harness (claude, codex, pi, kimi, grok) the scorer step re-runs unsandboxed.
      if [ -n "${RUNNER_TOOL_CACHE:-}" ] && [ -d "$RUNNER_TOOL_CACHE" ]; then
        sandbox_lock "$RUNNER_TOOL_CACHE"
      fi
      if [ -n "${RUNNER_WORKSPACE:-}" ]; then
        p="${RUNNER_WORKSPACE%/*}/_actions"
        [ -d "$p" ] && printf '%s\n' --ro-bind "$p" "$p"
      fi
      # ...and drop the file-command vars so the adapter never even sees them.
      for p in GITHUB_ENV GITHUB_PATH GITHUB_OUTPUT GITHUB_STEP_SUMMARY GITHUB_STATE; do
        printf '%s\n' --unsetenv "$p"
      done
      printf '%s\n' --die-with-parent
      ;;
    *) return 1 ;;
  esac
}

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
# On Linux the whole host filesystem is mounted READ-ONLY by default and only the
# paths that must be writable are added back rw. This is deliberate: a --ro-bind
# only pins the exact path it names, so with a writable root (the old
# --dev-bind / /) a run could rename the PARENT of a protected path, moving the ro
# mount aside, then recreate the original path with attacker content that a LATER,
# unsandboxed workflow step (same shared fs, different mount namespace, holding
# GH_GLOBAL) would read or execute — a planted ~/.local/bin on PATH, a fake
# workspace the "Commit results" step operates on, a poisoned config snapshot. A
# read-only root closes that: every parent sits on the ro root (rename -> EROFS)
# and a bind's own mount point cannot be renamed (EBUSY). What a later step
# executes or reads config from (runner file-command dir, git/gh/ssh/npm config,
# PATH dirs under $HOME, installed harness CLIs, the harness-config snapshot) is
# therefore read-only automatically; only the harness's own state dirs and scratch
# are added back writable.

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
      # Host fs READ-ONLY by default (see the header): everything is mounted ro,
      # then ONLY the paths that must be writable are added back rw. --dev /dev and
      # --proc /proc give the sandbox a working /dev (null, urandom, shm, pts) and
      # /proc that the old --dev-bind / / used to carry from the host.
      printf '%s\n' bwrap --ro-bind / / --dev /dev --proc /proc

      local p seen=""
      # rw_bind PATH: create PATH if missing, then rw-bind it onto itself, once.
      # bwrap needs the target to exist; on a ro root it cannot be created inside.
      rw_bind() {
        [ -n "$1" ] || return 0
        case " $seen " in *" $1 "*) return 0 ;; esac
        [ -d "$1" ] || mkdir -p "$1" 2>/dev/null || true
        [ -d "$1" ] || return 0
        seen="$seen $1"
        printf '%s\n' --bind "$1" "$1"
      }

      # Scratch that must stay writable (it was all writable under --dev-bind / /):
      # this run's own tmpdir, /tmp and $TMPDIR (the compat-rules preamble promises
      # agents $TMPDIR is writable), the runner's ephemeral $RUNNER_TEMP (scratch +
      # the pending/notify + audit queue ./notify appends to outside the workspace),
      # and $AEON_PENDING_DIR when it is set elsewhere. The two sensitive dirs that
      # live UNDER $RUNNER_TEMP (the file-command dir and the harness-config
      # snapshot) are re-asserted read-only below, after these rw binds.
      rw_bind "$tmp"
      rw_bind /tmp
      rw_bind "${TMPDIR:-}"
      rw_bind "${RUNNER_TEMP:-}"
      rw_bind "${AEON_PENDING_DIR:-}"

      # The two documented workspace state dirs: read-only means cannot mutate
      # code/config, not cannot persist state. memory/ (committed run state) +
      # output/ (artifacts) are the exceptions read-only skills rely on (seo-audit,
      # competitor-monitor). Added rw after the ro root; guard existence.
      [ -d "$ws/memory" ] && rw_bind "$ws/memory"
      [ -d "$ws/output" ] && rw_bind "$ws/output"

      # Each harness writes its own state/auth/session under $HOME at runtime;
      # read-only is about the repo, not the harness's own config. claude writes
      # ~/.claude (incl. the transcript the scorer reads) + ~/.claude.json; codex
      # ~/.codex; grok ~/.grok; kimi ~/.kimi-code; vibe ~/.vibe; pi ~/.pi; all of
      # them ~/.cache + ~/.npm. (fx/cursor/hermes run under a scratch HOME inside
      # RH_TMPDIR, already rw above, so they need nothing here.) Everything else
      # under $HOME — ~/.gitconfig, ~/.config/{git,gh}, ~/.ssh, ~/.npmrc,
      # ~/.local/{bin,lib}, pipx venvs, other PATH dirs — stays read-only from the
      # ro root, which is what kept a later unsandboxed step from being poisoned.
      if [ -n "${HOME:-}" ] && [ -d "$HOME" ]; then
        for p in "$HOME/.claude" "$HOME/.codex" "$HOME/.grok" "$HOME/.kimi-code" \
                 "$HOME/.vibe" "$HOME/.pi" "$HOME/.cache" "$HOME/.npm" \
                 "${XDG_CACHE_HOME:-}"; do
          rw_bind "$p"
        done
        # ~/.claude.json is a FILE claude rewrites every run; bwrap needs it to
        # exist to bind it, and a ro root cannot create it inside the sandbox.
        [ -e "$HOME/.claude.json" ] || printf '{}' > "$HOME/.claude.json" 2>/dev/null || true
        [ -f "$HOME/.claude.json" ] && printf '%s\n' --bind "$HOME/.claude.json" "$HOME/.claude.json"
      fi

      # Layer the expanded .mcp.json over the literal one. After the ro root so it
      # wins (bwrap applies binds left to right); the target exists in the repo.
      [ -n "$mcp" ] && [ -f "$mcp" ] && [ -f "$ws/.mcp.json" ] && \
        printf '%s\n' --ro-bind "$mcp" "$ws/.mcp.json"

      # Re-assert read-only on the two paths that a later, GH_GLOBAL-holding step
      # reads back and that could otherwise fall UNDER an rw scratch bind above
      # (e.g. when $TMPDIR == $RUNNER_TEMP, the runner file-command dir and the
      # harness-config snapshot are siblings of the pending queue). Emitted LAST so
      # the ro-bind wins over any rw ancestor. All the other old explicit ro-binds
      # (workspace, git/gh/ssh/npm config, ~/.local/*, _actions, tool cache, PATH
      # dirs) are now covered by the read-only root with no per-path handling.
      local roseen=""
      for p in "${GITHUB_ENV:-}" "${GITHUB_PATH:-}" "${GITHUB_OUTPUT:-}" \
               "${GITHUB_STEP_SUMMARY:-}" "${GITHUB_STATE:-}" ; do
        [ -n "$p" ] || continue
        p="${p%/*}"
        case " $roseen " in *" $p "*) continue ;; esac
        roseen="$roseen $p"
        [ -d "$p" ] && printf '%s\n' --ro-bind "$p" "$p"
      done
      if [ -n "${AEON_HARNESS_CONFIG_SNAPSHOT:-}" ] && [ -d "$AEON_HARNESS_CONFIG_SNAPSHOT" ]; then
        printf '%s\n' --ro-bind "$AEON_HARNESS_CONFIG_SNAPSHOT" "$AEON_HARNESS_CONFIG_SNAPSHOT"
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

# sandbox.sh — wrapper-level OS sandbox for uniform read-only enforcement.
#
# Only grok and codex have native kernel sandboxes; opencode and pi enforce
# nothing, and claude's --allowedTools can be sidestepped by shell redirection.
# So for read-only runs the DISPATCHER applies its own sandbox around whatever
# harness runs: the workspace (cwd) becomes unwritable, everything else stays
# usable (harnesses need to write their own state under $HOME and $TMPDIR).
# This mirrors aeon's semantic: "a read-only skill physically cannot mutate the
# repo" — and makes it mean the same thing on all five harnesses.

sandbox_prefix() {
  # sandbox_prefix TMPDIR -> prints prefix argv tokens (one per line), or
  # returns 1 if no OS sandbox is available on this machine.
  local tmp="$1" ws
  ws="$(pwd -P)"
  case "$(uname -s)" in
    Darwin)
      command -v sandbox-exec >/dev/null 2>&1 || return 1
      local profile="$tmp/readonly-workspace.sb"
      cat > "$profile" <<EOF
(version 1)
(allow default)
(deny file-write* (subpath "$ws"))
EOF
      printf '%s\n' sandbox-exec -f "$profile"
      ;;
    Linux)
      command -v bwrap >/dev/null 2>&1 || return 1
      # bind everything rw, then overlay the workspace read-only
      printf '%s\n' bwrap --dev-bind / / --ro-bind "$ws" "$ws" --die-with-parent
      ;;
    *) return 1 ;;
  esac
}

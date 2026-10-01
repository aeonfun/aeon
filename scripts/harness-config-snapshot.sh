#!/usr/bin/env bash
# harness-config-snapshot.sh - keep a skill run from poisoning the harness
# config that LATER workflow steps execute.
#
#   usage: harness-config-snapshot.sh snapshot           (before the skill runs)
#          harness-config-snapshot.sh restore <sha256>    (before the next harness call)
#
# Why: aeon.yml's "Run" step executes the skill through run-harness. A read-only
# skill runs inside lib/sandbox.sh's bwrap sandbox, which keeps the harness's
# own $HOME state writable on purpose (sessions, token refresh). But that same
# state holds config that makes a harness EXECUTE things: ~/.claude.json
# mcpServers, ~/.claude/settings.json hooks, ~/.codex/config.toml mcp_servers +
# notify, ~/.pi/agent/extensions, ~/.vibe tools/mcp, ~/.kimi-code mcp.json, ...
# Later in the same job "Analyze skill output" re-runs the harness with
# --no-sandbox and the LLM keys in env (and "Convert feed outputs" runs
# `claude -p`). A prompt-injected skill could plant an MCP server or a hook that
# then runs there, unsandboxed, holding the keys.
#
# So: `snapshot` archives the execution-relevant harness config right before
# the skill runs, and `restore` puts exactly that back right before any later
# harness call, dropping whatever the run added or changed. The archive's
# sha256 travels as a step OUTPUT (which nothing in the sandbox can rewrite), and
# restore refuses an archive that does not match it. The archive directory is
# also read-only inside the sandbox (lib/sandbox.sh locks
# $AEON_HARNESS_CONFIG_SNAPSHOT).
#
# Auth/token files a harness legitimately REFRESHES during the run are kept
# from the live copy (only when they already existed at snapshot time, and only
# when they are plain files/dirs, no symlinks): an OAuth refresh rotates the
# refresh token, so putting back the pre-run copy would log the scorer out.
#
# restore also kills processes the sandboxed run left behind: --die-with-parent
# only reaps bwrap's direct child, and a daemonized grandchild could otherwise
# rewrite the config after it is restored.
set -euo pipefail

SNAP="${AEON_HARNESS_CONFIG_SNAPSHOT:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/aeon-harness-config}"
ARCHIVE="$SNAP/home.tar"

# PATH-under-$HOME|kept-live-entries (comma-separated, relative to PATH; a
# leading "+" keeps the entry even when it did not exist at snapshot time).
# cursor, fx and hermes run under a scratch HOME inside run-harness's own temp
# dir (fresh per call), and hermes's install dir is locked read-only by the
# sandbox, so none of their real-$HOME config is shared with the scorer.
SPEC=(
  ".claude.json|"                       # claude: mcpServers, per-project config
  ".claude|.credentials.json"           # claude: settings.json hooks, plugins, agents, skills, CLAUDE.md
  ".claude-code-router|+logs"           # gateway sidecar config/plugins (logs read on failure)
  ".codex|auth.json"                    # codex: config.toml (mcp_servers, notify, providers), AGENTS.md, rules
  ".grok|auth.json"                     # grok: settings, MCP, hooks
  ".kimi-code|credentials"              # kimi: config.toml providers, mcp.json
  ".vibe|"                              # vibe: config.toml mcp_servers, tools, agents, .env
  ".pi|agent/auth.json"                 # pi: agent/settings.json, models.json, extensions, packages
  ".agents|"                            # cross-harness user skills / AGENTS.md
  ".node_modules|"                      # node's global require() fallback dirs
  ".node_libraries|"
)

log() { echo "harness-config: $*" >&2; }

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# no_links BASE REL -> 0 iff no component of BASE/REL (below BASE) is a symlink
no_links() {
  local rel="$2" acc="$1" part
  local IFS=/
  for part in $rel; do
    [ -n "$part" ] || continue
    acc="$acc/$part"
    [ -L "$acc" ] && return 1
  done
  return 0
}

# plain_tree PATH -> 0 iff PATH holds only regular files and directories
plain_tree() {
  [ -z "$(find "$1" ! -type f ! -type d -print -quit 2>/dev/null)" ]
}

reap_sandbox_leftovers() {
  # Kill this user's processes that live in a different mount AND user
  # namespace than this step: those are leftovers of an unprivileged bwrap
  # sandbox (a container or snap app keeps the init user namespace, and runs as
  # another uid anyway). Linux only; a no-op wherever /proc has no namespaces.
  [ -r /proc/self/ns/mnt ] && [ -r /proc/self/ns/user ] || return 0
  local my_mnt my_user uid d pid n total=0
  my_mnt=$(readlink /proc/self/ns/mnt); my_user=$(readlink /proc/self/ns/user); uid=$(id -u)
  for _ in 1 2 3 4 5; do
    n=0
    for d in /proc/[0-9]*; do
      pid=${d#/proc/}
      [ "$(stat -c %u "$d" 2>/dev/null || true)" = "$uid" ] || continue
      [ "$(readlink "$d/ns/mnt" 2>/dev/null || echo "$my_mnt")" != "$my_mnt" ] || continue
      [ "$(readlink "$d/ns/user" 2>/dev/null || echo "$my_user")" != "$my_user" ] || continue
      kill -KILL "$pid" 2>/dev/null && n=$((n + 1))
    done
    total=$((total + n))
    [ "$n" -eq 0 ] && break
    sleep 0.2
  done
  [ "$total" -eq 0 ] || echo "::warning::killed $total process(es) left running by the sandboxed skill run"
}

cmd_snapshot() {
  local list entry p
  rm -rf "$SNAP"
  mkdir -p "$SNAP"; chmod 700 "$SNAP"
  list="$SNAP/paths"
  : > "$list"
  for entry in "${SPEC[@]}"; do
    p="${entry%%|*}"
    if [ -e "$HOME/$p" ] || [ -L "$HOME/$p" ]; then printf '%s\n' "$p" >> "$list"; fi
  done
  tar -cf "$ARCHIVE" -C "$HOME" -T "$list"
  rm -f "$list"
  chmod 400 "$ARCHIVE"
  log "snapshotted $(tar -tf "$ARCHIVE" | cut -d/ -f1 | sort -u | tr '\n' ' ')"
  sha256_of "$ARCHIVE"
}

cmd_restore() {
  local want="${1:-}" got stage stash entry p keeps k live had kept n_restored=0 n_removed=0
  local -a KEEPS
  if [ -z "$want" ] || [ ! -f "$ARCHIVE" ]; then
    echo "::error::no harness config snapshot to restore ($ARCHIVE); refusing to let a later step run on config the skill could have changed"
    return 1
  fi

  # Kill leftovers FIRST, so nothing can touch the archive or $HOME from here on.
  reap_sandbox_leftovers

  stage=$(mktemp -d "${TMPDIR:-/tmp}/harness-config-stage.XXXXXX")
  stash=$(mktemp -d "${TMPDIR:-/tmp}/harness-config-keep.XXXXXX")
  # shellcheck disable=SC2064
  trap "rm -rf '$stage' '$stash'" EXIT
  # Verify and extract one private copy, so the bytes checked are the bytes used.
  cp "$ARCHIVE" "$stash/.snapshot.tar"
  got=$(sha256_of "$stash/.snapshot.tar")
  if [ "$got" != "$want" ]; then
    echo "::error::harness config snapshot was modified after it was taken (sha256 $got, expected $want)"
    return 1
  fi
  tar -xpf "$stash/.snapshot.tar" -C "$stage"
  rm -f "$stash/.snapshot.tar"

  for entry in "${SPEC[@]}"; do
    p="${entry%%|*}"; keeps="${entry#*|}"
    live="$HOME/$p"
    had=0
    if [ -e "$stage/$p" ] || [ -L "$stage/$p" ]; then had=1; fi

    # 1. set aside the live entries to keep. A plain entry is kept only if it
    #    existed at snapshot time (a refreshed credential); a "+" entry (logs)
    #    is kept either way. Always: reached without a symlink, and a plain
    #    file/dir tree.
    kept=0
    IFS=, read -r -a KEEPS <<<"$keeps"
    if [ -d "$live" ] && [ ! -L "$live" ]; then
      for k in ${KEEPS[@]+"${KEEPS[@]}"}; do
        case "$k" in
          +*) k="${k#+}" ;;
          *) [ -e "$stage/$p/$k" ] || [ -L "$stage/$p/$k" ] || continue ;;
        esac
        if ! { [ -e "$live/$k" ] && no_links "$live" "$k" && plain_tree "$live/$k"; }; then continue; fi
        mkdir -p "$(dirname "$stash/$p/$k")"
        mv "$live/$k" "$stash/$p/$k"
        kept=1
      done
    fi

    # 2. put back exactly the pre-run copy, or drop what the run created.
    if [ "$had" = 1 ]; then
      rm -rf "$live"
      mkdir -p "$(dirname "$live")"
      cp -a "$stage/$p" "$live"
      n_restored=$((n_restored + 1))
    elif [ -e "$live" ] || [ -L "$live" ]; then
      rm -rf "$live"
      log "removed ~/$p (created during the run)"
      n_removed=$((n_removed + 1))
    fi

    # 3. return the kept entries.
    if [ "$kept" = 1 ]; then
      for k in "${KEEPS[@]}"; do
        k="${k#+}"
        [ -e "$stash/$p/$k" ] || continue
        rm -rf "${live:?}/$k"
        mkdir -p "$(dirname "$live/$k")"
        mv "$stash/$p/$k" "$live/$k"
      done
    fi
  done
  log "restored $n_restored path(s), removed $n_removed"
}

case "${1:-}" in
  snapshot) cmd_snapshot ;;
  restore)  shift; cmd_restore "${1:-}" ;;
  *) echo "usage: $0 snapshot | restore <sha256>" >&2; exit 2 ;;
esac

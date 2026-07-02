#!/usr/bin/env bash
# skill_mode — capability tier resolution for a skill run (hardening §6).
#
# Two axes of capability: network (egress:, future proxy) and *write* (this).
# A skill declares its write tier in SKILL.md frontmatter:
#     mode: read-only      # may read repo + fetch web + notify; may NOT mutate the repo
#     mode: write          # full access (default, current behaviour)
#
# Rollout note: default is `write` for backward compatibility — none of the 183
# existing skills are annotated yet, and many legitimately write (create-skill,
# article, reflect…). read-only is opt-in now; once writers are annotated we flip
# the default to read-only (the design intent). Enforcement is by allowedTools:
# read-only drops Write,Edit,Bash(git:*),Bash(gh:*) so the skill physically can't
# commit/push/edit. A post-run guard in the workflow reverts any stray writes that
# slipped through redirections, as defense-in-depth.
#
# Usage:
#   scripts/skill_mode.sh mode <skill-name>     -> prints read-only | write
#   scripts/skill_mode.sh allowed-tools <mode>  -> prints the --allowedTools string
#   scripts/skill_mode.sh grok-args <mode>      -> prints grok CLI permission flags,
#                                                  one argv token per line (for the
#                                                  Grok Build harness; see run-grok.sh)
set -euo pipefail

# Tools every tier gets: read, search, notify, and read-only/local shell helpers.
# curl stays (network is the *other* axis, governed by egress:, not by mode).
#
# NOTE: `gh` is intentionally NOT in the read-only base — even `gh api` GET reads are
# excluded, because `gh` is also a write vector (issue/PR/commit/dispatch) and the tool
# grammar is coarse (Bash(gh:*) is all-or-nothing). A read-only skill that needs GitHub
# data should fetch it with WebFetch/curl against api.github.com, or stay `mode: write`.
# (Known degraders today: github-trending + security-digest use `gh api` only as a
# fallback behind a WebFetch/curl primary, so they degrade gracefully, not break.)
BASE_TOOLS="Read,Glob,Grep,WebFetch,WebSearch"
BASE_TOOLS="$BASE_TOOLS,Bash(curl:*),Bash(jq:*)"
BASE_TOOLS="$BASE_TOOLS,Bash(./notify:*),Bash(./notify-jsonrender:*)"
BASE_TOOLS="$BASE_TOOLS,Bash(mkdir:*),Bash(ls:*),Bash(cat:*),Bash(chmod:*)"
BASE_TOOLS="$BASE_TOOLS,Bash(date:*),Bash(echo:*),Bash(node:*),Bash(npm:*),Bash(npx:*)"
BASE_TOOLS="$BASE_TOOLS,Bash(head:*),Bash(tail:*),Bash(wc:*),Bash(sort:*),Bash(grep:*)"

# Write tier additionally gets repo-mutation tools + python (an interpreter is itself
# a write vector, so it stays out of the read-only base; skills' python helpers run here).
WRITE_TOOLS="Write,Edit,Bash(gh:*),Bash(git:*),Bash(python3:*),Bash(python:*)"

resolve_mode() {
  local skill="$1" f="skills/$1/SKILL.md" m=""
  if [ -f "$f" ]; then
    # value after 'mode:', stripping an inline '# comment', quotes, and surrounding ws
    m=$(awk '/^---$/{n++; next}
             n==1 && /^mode:/{
               v=$0; sub(/^mode:[ \t]*/,"",v); sub(/[ \t]*#.*$/,"",v);
               gsub(/^[ \t"]+|[ \t"]+$/,"",v); print v; exit
             }' "$f")
  fi
  case "$m" in
    read-only|readonly|read_only) echo "read-only" ;;
    write|"")                     echo "write" ;;
    *) echo "write" ;;  # unknown value -> safe default, never silently over-restrict
  esac
}

# Write tier = base tools + the repo-mutation tools.
write_tools() { echo "$BASE_TOOLS,$WRITE_TOOLS"; }

# --- Grok Build harness permission mapping ----------------------------------
# The grok CLI uses a DIFFERENT permission grammar from Claude Code's
# --allowedTools: `--permission-mode dontAsk` (silently deny anything not
# explicitly allowed — the exact analogue of Claude's `-p` allowlist) plus
# `--allow`/`--deny` rules over categories Bash/Edit/Read/Grep/MCPTool/WebFetch.
# Bash rules use a space-glob — `Bash(git *)` — not Claude's colon `Bash(git:*)`.
#
# We mirror the SAME capability intent as BASE_TOOLS / WRITE_TOOLS above, so a
# skill behaves identically on either harness: read-only gets no Edit and no
# git/gh/python; write adds them. read-only additionally runs under grok's
# `--sandbox read-only` profile as defense-in-depth (matches the post-run guard).
#
# Output: one argv token per line, so run-grok.sh can read it with
#   mapfile -t GROK_ARGS < <(skill_mode.sh grok-args "$MODE")
# and pass "${GROK_ARGS[@]}" straight through (a Bash rule's embedded space is
# preserved because each whole line becomes one array element).

# Bash command globs allowed on every tier (mirror BASE_TOOLS' Bash(...:*) set).
GROK_BASE_BASH="curl jq ./notify ./notify-jsonrender mkdir ls cat chmod date echo node npm npx head tail wc sort grep"
# Additional Bash command globs for the write tier (mirror WRITE_TOOLS).
GROK_WRITE_BASH="gh git python3 python"

grok_args() {
  local mode="$1"
  # Non-listed tools are auto-denied by dontAsk — the allowlist is exhaustive.
  printf '%s\n' --permission-mode dontAsk
  if [ "$mode" = "read-only" ]; then
    printf '%s\n' --sandbox read-only
  fi
  # Always-allowed read/search categories (grok auto-approves read_file/grep/
  # web_search too, but being explicit is harmless and self-documenting).
  printf '%s\n' --allow Read --allow Grep --allow WebFetch
  local cmd
  for cmd in $GROK_BASE_BASH; do printf '%s\n' --allow "Bash($cmd *)"; done
  if [ "$mode" != "read-only" ]; then
    printf '%s\n' --allow Edit
    for cmd in $GROK_WRITE_BASH; do printf '%s\n' --allow "Bash($cmd *)"; done
  fi
}

case "${1:-}" in
  mode)          resolve_mode "${2:?skill name required}" ;;
  allowed-tools)
    case "${2:-write}" in
      read-only|readonly|read_only) echo "$BASE_TOOLS" ;;
      *)                            write_tools ;;
    esac ;;
  grok-args)
    case "${2:-write}" in
      read-only|readonly|read_only) grok_args read-only ;;
      *)                            grok_args write ;;
    esac ;;
  *) echo "usage: skill_mode.sh {mode <skill>|allowed-tools <mode>|grok-args <mode>}" >&2; exit 2 ;;
esac

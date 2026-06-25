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
set -euo pipefail

# Tools every tier gets: read, search, notify, and read-only/local shell helpers.
# curl stays (network is the *other* axis, governed by egress:, not by mode).
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

case "${1:-}" in
  mode)          resolve_mode "${2:?skill name required}" ;;
  allowed-tools)
    case "${2:-write}" in
      read-only|readonly|read_only) echo "$BASE_TOOLS" ;;
      *)                            write_tools ;;
    esac ;;
  *) echo "usage: skill_mode.sh {mode <skill>|allowed-tools <mode>}" >&2; exit 2 ;;
esac

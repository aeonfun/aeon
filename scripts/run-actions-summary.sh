#!/usr/bin/env bash
# run-actions-summary — "what happened under the hood" for one skill run.
#
# Reads Claude Code's session transcript (JSONL) and tallies the tool calls the
# agent actually made — Read/Edit/Write/Grep/WebFetch/Bash/… — plus a second-level
# breakdown of Bash by the real command (curl, git, gh, jq, python…). Non-invasive:
# it parses the transcript AFTER the run; it never touches the run itself.
#
# Usage:
#   run-actions-summary.sh [--md|--line] [transcript.jsonl] [session_id]
#     --line  one compact line (default; good for a notify footer / log)
#     --md    a Markdown block (good for $GITHUB_STEP_SUMMARY)
#   With no path, locates the transcript by SESSION_ID (arg or env), else the newest.
#
# Emits nothing (exit 0) when no transcript is found — a missing summary must never
# fail a run.
set -euo pipefail

FMT=line
case "${1:-}" in --md) FMT=md; shift;; --line) FMT=line; shift;; esac
TX="${1:-}"
SID="${2:-${SESSION_ID:-}}"

# Resolve the transcript: explicit path → by session id → newest under ~/.claude.
if [ -z "$TX" ]; then
  if [ -n "$SID" ]; then
    TX=$(ls -t "$HOME"/.claude/projects/*/"$SID".jsonl 2>/dev/null | head -1 || true)
  fi
  [ -z "$TX" ] && TX=$(ls -t "$HOME"/.claude/projects/*/*.jsonl 2>/dev/null | head -1 || true)
fi
[ -n "$TX" ] && [ -f "$TX" ] || { echo "run-actions-summary: no transcript found" >&2; exit 0; }

# Every tool_use, one per line, as "<name>\t<command-or-empty>".
# Tolerate both .message.content (current) and a bare .content wrapper.
records() {
  jq -rc '
    (.message.content? // .content? // empty) as $c
    | select((.type=="assistant") or (.message.role?=="assistant"))
    | ($c[]? | select(.type=="tool_use"))
    | [ .name, (.input.command // "") ] | @tsv
  ' "$TX" 2>/dev/null || true
}

TOTAL=$(records | wc -l | tr -d ' ')
[ "$TOTAL" -eq 0 ] && { echo "run-actions-summary: 0 tool calls" >&2; exit 0; }

# Level 1 — by tool name.
TOOLS=$(records | cut -f1 | sort | uniq -c | sort -rn)

# Level 2 — "actions of note": scan every Bash command's text for a curated set of
# side-effecting / exec commands and count how many commands invoke each. Occurrence-
# based (not first-token) so it's robust to `cd … &&`, env prefixes, pipes and
# multi-line commands — and it surfaces exactly the network/exec/write actions the
# run's blast radius is about (what did it curl, push, install, delete). Plumbing
# (echo/cat/jq/grep/…) is deliberately ignored.
BASHTXT=$(records | awk -F'\t' '$1=="Bash"{print $2}')
bash_hits() {  # <regex> — count Bash commands whose text matches
  printf '%s\n' "$BASHTXT" | grep -cE "$1" || true
}
NOTE=""
add_note() { [ "$2" -gt 0 ] && NOTE="${NOTE}${2}× ${1}, "; return 0; }  # return 0: never trip set -e
add_note "curl/wget"   "$(bash_hits '(^|[^[:alnum:]_])(curl|wget)([^[:alnum:]_]|$)')"
add_note "gh"          "$(bash_hits '(^|[^[:alnum:]_])gh[[:space:]]')"
add_note "git"         "$(bash_hits '(^|[^[:alnum:]_])git[[:space:]]')"
add_note "python"      "$(bash_hits '(^|[^[:alnum:]_])python3?([^[:alnum:]_]|$)')"
add_note "node/npm"    "$(bash_hits '(^|[^[:alnum:]_])(node|npm|npx)([^[:alnum:]_]|$)')"
add_note "pip/install" "$(bash_hits '(pip[0-9]?[[:space:]]+install|[[:space:]]install[[:space:]]|curl[^|]*\|[[:space:]]*sh)')"
add_note "rm"          "$(bash_hits '(^|[^[:alnum:]_])rm[[:space:]]')"
NOTE="${NOTE%, }"

fmt_inline() { awk '{printf "%d× %s, ", $1, $2}' | sed 's/, $//'; }

if [ "$FMT" = md ]; then
  echo "## 🔧 Under the hood — ${TOTAL} tool calls"
  echo ""
  echo "| Tool | Calls |"
  echo "|------|------:|"
  echo "$TOOLS" | awk '{printf "| %s | %d |\n", $2, $1}'
  if [ -n "$NOTE" ]; then
    echo ""
    echo "**Network/exec actions:** $NOTE"
  fi
else
  LINE=$(echo "$TOOLS" | fmt_inline)
  printf '🔧 %d tool calls — %s' "$TOTAL" "$LINE"
  [ -n "$NOTE" ] && printf '  ·  actions: %s' "$NOTE"
  printf '\n'
fi

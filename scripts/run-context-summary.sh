#!/usr/bin/env bash
# run-context-summary: which operator context one skill run had in hand.
#
# Reports three things per run so "did my strategy / soul / MCP apply?" has an
# answer on the run page instead of a guess:
#   STRATEGY.md  auto-loaded on every harness (claude via the @import in CLAUDE.md,
#                the rest via the AGENTS.md mirror). Reported as custom, defaults
#                (still the shipped template) or missing.
#   soul/        NOT auto-loaded: CLAUDE.md tells the agent to read it before
#                writing. Reported as filled, template (comments only) or none;
#                on claude the transcript also says whether the agent read it.
#   MCP          from the run step's preflight (MCP_STATUS): on:<servers> or
#                skipped:<missing secrets>; empty means not loaded or no .mcp.json.
#                On claude the transcript adds how many MCP tool calls the run made.
#
# Usage:
#   run-context-summary.sh [--md|--line]
#   env: HARNESS, MCP_STATUS, SESSION_ID (claude only; transcript lookup)
#
# Read-only and never fails a run: any lookup that comes up empty is reported
# as unknown rather than erroring.
set -uo pipefail

FMT=line
case "${1:-}" in --md) FMT=md ;; --line) FMT=line ;; esac
HARNESS="${HARNESS:-}"

# Lines that carry real content: drop HTML comments, headings, blank lines.
content_lines() {
  sed -e 's/<!--.*-->//g' "$1" 2>/dev/null \
    | awk '/<!--/{c=1} !c && !/^[[:space:]]*(#|$)/ {n++} /-->/{c=0} END{print n+0}'
}

# STRATEGY.md
if [ ! -f STRATEGY.md ]; then
  STRATEGY="missing"
elif grep -q 'unconfigured defaults' STRATEGY.md; then
  STRATEGY="defaults (template, not tailored)"
else
  STRATEGY="custom"
fi

# soul/
if [ ! -f soul/SOUL.md ]; then
  SOUL="none"
elif [ "$(content_lines soul/SOUL.md)" -eq 0 ]; then
  SOUL="template (empty)"
else
  SOUL="filled"
  [ -s soul/STYLE.md ] && [ "$(content_lines soul/STYLE.md)" -gt 0 ] && SOUL="$SOUL, STYLE.md"
  EX=$(find soul/examples -type f ! -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')
  [ "${EX:-0}" -gt 0 ] && SOUL="$SOUL, ${EX} example(s)"
fi

# MCP preflight result from the run step. Empty means the preflight never
# enabled or skipped it: no .mcp.json, or a shadow run (MCP is never loaded there).
case "${MCP_STATUS:-}" in
  on:*)      MCP="on (${MCP_STATUS#on:})" ;;
  skipped:*) MCP="skipped, secret(s) not set:${MCP_STATUS#skipped:}" ;;
  *)
    if [ -f .mcp.json ] && jq -e '.mcpServers | length > 0' .mcp.json >/dev/null 2>&1; then
      MCP="not loaded this run (shadow run or the run stopped before MCP setup)"
    else
      MCP="off (no .mcp.json)"
    fi ;;
esac

# Claude only: the transcript says what the agent actually did with them. Other
# harnesses leave no transcript we can attribute (see the Under the hood step).
TX=""
if [ "$HARNESS" = claude ] && [ -n "${SESSION_ID:-}" ]; then
  TX=$(ls -t "$HOME"/.claude/projects/*/"$SESSION_ID".jsonl 2>/dev/null | head -1 || true)
fi
if [ -n "$TX" ] && [ -f "$TX" ]; then
  USES=$(jq -rc '
    (.message.content? // .content? // empty) as $c
    | select((.type=="assistant") or (.message.role?=="assistant"))
    | ($c[]? | select(.type=="tool_use"))
    | [ .name, (.input.file_path // .input.path // .input.command // "") ] | @tsv
  ' "$TX" 2>/dev/null || true)
  case "$SOUL" in
    filled*)
      if printf '%s\n' "$USES" | grep -qE '(^|[/[:space:]])soul/(SOUL|STYLE)\.md'; then
        SOUL="$SOUL; read this run"
      else
        SOUL="$SOUL; not read this run"
      fi ;;
  esac
  case "$MCP" in
    on*)
      CALLS=$(printf '%s\n' "$USES" | grep -c '^mcp__' || true)
      MCP="$MCP; ${CALLS:-0} MCP tool call(s)" ;;
  esac
elif [ "$HARNESS" != claude ]; then
  case "$SOUL" in filled*) SOUL="$SOUL; read not tracked on $HARNESS" ;; esac
fi

if [ "$FMT" = md ]; then
  echo "| Context | State |"
  echo "|---------|-------|"
  echo "| STRATEGY.md | $STRATEGY |"
  echo "| soul/SOUL.md | $SOUL |"
  echo "| MCP | $MCP |"
  echo ""
else
  printf 'Context: STRATEGY.md %s | soul %s | MCP %s\n' "$STRATEGY" "$SOUL" "$MCP"
fi

#!/usr/bin/env bash
# pi adapter — Pi (@earendil-works/pi-coding-agent) behind the Claude Code contract.
#
# Pi quirks this adapter absorbs:
#   * `pi -p --mode json` emits a JSONL EVENT STREAM (session header, message_end,
#     agent_end, ...) -> result is the last assistant message_end text.
#   * usage (tokens + cache + usage.cost.total) rides on assistant messages —
#     the only harness besides Claude with native dollar cost. Field names are
#     probed defensively (input/input_tokens, cacheRead/cache_read, ...).
#   * NO permission system by design ("YOLO mode") -> read-only maps to
#     --exclude-tools write,edit; the dispatcher's wrapper OS sandbox is the real
#     guard. pi has read/bash/edit/write and NO web tool, so bash is its only
#     route to the network — never allow-list it away on read-only runs.
#   * MCP is deliberately unsupported -> warn and skip (pi's answer: wrap MCP
#     servers as CLI tools with READMEs, or add an extension).
#   * reads AGENTS.md or CLAUDE.md natively (global -> parents -> cwd); Claude's
#     @imports are NOT expanded (dispatcher pre-expands when needed).
#   * no structured-output flag -> prompt-with-schema + validate + one retry.
#
# rh-meta-start - capability manifest source of truth (bin/generate-harnesses-json)
# {
#   "id": "pi",
#   "label": "Pi",
#   "cli": { "install": "npm i -g --ignore-scripts @earendil-works/pi-coding-agent", "bin": "pi", "min_version": "0.99.2" },
#   "invoke": "pi -p --mode json",
#   "round_trip": true,
#   "token_usage": "full",
#   "cost": true,
#   "read_only": "sandbox",
#   "structured_output": "shim",
#   "mcp": "unsupported",
#   "max_turns": "timeout",
#   "claude_md": "native",
#   "auth": { "native_oauth": [], "native_key": ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"], "openrouter": true },
#   "native_control_path": "run-harness"
# }
# rh-meta-end
set -uo pipefail
. "$RH_LIB/envelope.sh"
. "$RH_LIB/tools-grammar.sh"
. "$RH_LIB/schema-retry.sh"

command -v pi >/dev/null 2>&1 || {
  echo "pi CLI not found (npm i -g --ignore-scripts @earendil-works/pi-coding-agent)" >&2; exit 1; }

ARGS=(--mode json --no-session --approve)

# model: pi is multi-provider — pass anything through (its registry matches
# patterns like "claude-sonnet-5", "openai/gpt-5-mini", or bare "sonnet")
[ -n "${RH_MODEL:-}" ] && [ "${RH_MODEL}" != "default" ] && ARGS+=(--model "$RH_MODEL")

# read-only -> tool subsetting (pi's only native lever; advisory without the
# dispatcher's wrapper sandbox)
# read-only DENIES mutation tools rather than allow-listing a filesystem subset:
# an allowlist silently dropped `bash`, and with no web tool of its own that left
# pi with no network at all. See tools_to_pi_exclude() for the measured failure.
if [ -n "${RH_ALLOWED_TOOLS:-}" ]; then
  PI_EXCLUDE=$(tools_to_pi_exclude "$RH_ALLOWED_TOOLS")
  [ -n "$PI_EXCLUDE" ] && ARGS+=(--exclude-tools "$PI_EXCLUDE")
elif [ "${RH_MODE:-write}" = "read-only" ]; then
  ARGS+=(--exclude-tools "write,edit")
fi

# compat preamble + operator append -> one --append-system-prompt
SYS="${RH_COMPAT_RULES:-}"
if [ -n "${RH_APPEND_SYSTEM_PROMPT:-}" ]; then
  SYS="${SYS:+$SYS
}${RH_APPEND_SYSTEM_PROMPT}"
fi
[ -n "$SYS" ] && ARGS+=(--append-system-prompt "$SYS")

if [ -n "${RH_MCP_CONFIG:-}" ] && [ -f "${RH_MCP_CONFIG:-}" ]; then
  SRVS=$(jq -r '.mcpServers // {} | keys | join(", ")' "$RH_MCP_CONFIG")
  [ -n "$SRVS" ] && echo "warning: pi does not support MCP by design — skipping server(s): $SRVS" >&2
fi

[ -n "${RH_MAX_TURNS:-}" ] && \
  echo "notice: pi has no --max-turns; the dispatcher wall-clock timeout is the guard" >&2

pi_cost_fmt() {
  # pi_cost_fmt NUMBER -> fixed-point decimal with trailing zeros trimmed
  awk -v c="$1" 'BEGIN { s = sprintf("%.10f", c); sub(/0+$/, "", s); sub(/\.$/, "", s); print s }'
}

run_once() {
  # run_once PROMPT -> sets TEXT/TIN/TOUT/TCR/TCC/COST/SID; returns pi's rc
  local prompt="$1"
  local events="$RH_TMPDIR/pi-events.jsonl"
  local clean="$RH_TMPDIR/pi-events.clean.jsonl"
  # stdin </dev/null: pi blocks until the timeout while stdin is an open pipe.
  # `--` ends option parsing (0.99+), so a prompt that starts with "-" is text.
  pi -p "${ARGS[@]}" -- "$prompt" < /dev/null > "$events"
  local rc=$?
  jq -cR 'fromjson? // empty' "$events" > "$clean"
  TEXT=$(jq -rs '
    [.[] | select(.type == "message_end") | (.message // {})
         | select((.role // "") == "assistant")
         | (.content
            | if type == "string" then .
              elif type == "array" then (map(.text // "") | join(""))
              else tostring end)]
    | last // ""' "$clean")
  # Usage is per LLM call: pi puts it on EVERY assistant message_end (one per
  # turn of the agent loop), so the run's total is the SUM over all of them.
  # Taking only the last one reported a single turn's tokens and cost for a
  # multi-turn run. Field names stay probed defensively (pi's own camelCase
  # first, then snake/alt spellings), and a non-numeric value counts as 0.
  local usage
  usage=$(jq -cs '
    def num: if type == "number" then . elif type == "string" then (tonumber? // 0) else 0 end;
    [.[] | select(.type == "message_end") | (.message // {})
         | select((.role // "") == "assistant") | (.usage // {}) | objects]
    | {input:  (map((.input // .input_tokens // .inputTokens // 0) | num) | add // 0),
       output: (map((.output // .output_tokens // .outputTokens // 0) | num) | add // 0),
       cacheRead:  (map((.cacheRead // .cache_read // 0) | num) | add // 0),
       cacheWrite: (map((.cacheWrite // .cache_write // 0) | num) | add // 0),
       cost: ([.[] | (.cost? | objects | .total) | numbers] | if length > 0 then add else null end)}' "$clean")
  TIN=$(jq -r '.input | floor' <<<"$usage")
  TOUT=$(jq -r '.output | floor' <<<"$usage")
  TCR=$(jq -r '.cacheRead | floor' <<<"$usage")
  TCC=$(jq -r '.cacheWrite | floor' <<<"$usage")
  # Fixed-point, not jq's number printing: jq 1.7 can print a sum like 0.000012
  # as 1.2e-05, which emit_envelope's decimal check drops as "no cost".
  COST=$(jq -r '.cost // empty' <<<"$usage")
  [ -n "$COST" ] && COST=$(pi_cost_fmt "$COST")
  SID=$(jq -rs '[.[] | select(.type == "session") | (.id // empty)] | first // ""' "$clean")
  DONE=$(jq -s '[.[] | select(.type == "agent_end")] | length' "$clean")
  return $rc
}

PROMPT="$(cat "$RH_PROMPT_FILE")"
[ -n "${RH_JSON_SCHEMA:-}" ] && PROMPT="${PROMPT}$(schema_prompt_suffix "$RH_JSON_SCHEMA")"

run_once "$PROMPT"
rc=$?
if [ $rc -ne 0 ] && [ -z "${TEXT:-}" ]; then
  echo "pi exited $rc with no output" >&2
  exit $rc
fi
if [ "${DONE:-0}" -eq 0 ] && [ -z "$TEXT" ]; then
  echo "pi run ended without agent_end and produced no output" >&2
  exit 3
fi

# structured output: validate; one corrective retry
if [ -n "${RH_JSON_SCHEMA:-}" ]; then
  TEXT="$(schema_extract_json "$TEXT")"
  if ! schema_validate "$RH_JSON_SCHEMA" "$TEXT"; then
    echo "structured output failed validation — retrying once" >&2
    # The retry is a second billed pi run: add its usage to the first one's.
    P_TIN=$TIN P_TOUT=$TOUT P_TCR=$TCR P_TCC=$TCC P_COST=$COST
    run_once "${PROMPT}$(schema_retry_suffix)" || true
    TIN=$((P_TIN + TIN)) TOUT=$((P_TOUT + TOUT)) TCR=$((P_TCR + TCR)) TCC=$((P_TCC + TCC))
    if [ -n "$P_COST" ] || [ -n "$COST" ]; then
      COST=$(pi_cost_fmt "$(awk -v a="${P_COST:-0}" -v b="${COST:-0}" 'BEGIN { printf "%.10f", a + b }')")
    fi
    TEXT="$(schema_extract_json "$TEXT")"
    if ! schema_validate "$RH_JSON_SCHEMA" "$TEXT"; then
      echo "structured output still invalid after retry" >&2
      exit 3
    fi
  fi
fi

emit_envelope "$TEXT" "${TIN:-0}" "${TOUT:-0}" "${TCR:-0}" "${TCC:-0}" "${COST:-}" "${SID:-}"

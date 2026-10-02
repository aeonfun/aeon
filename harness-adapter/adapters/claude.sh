#!/usr/bin/env bash
# claude adapter — the identity adapter. Claude Code already speaks the contract;
# this just maps RH_* env to flags and folds structured output into .result.
#
# rh-meta-start - capability manifest source of truth (bin/generate-harnesses-json)
# {
#   "id": "claude",
#   "label": "Claude Code",
#   "cli": { "install": "npm i -g @anthropic-ai/claude-code", "bin": "claude", "min_version": "2.1.287" },
#   "invoke": "claude -p - --output-format json",
#   "round_trip": true,
#   "token_usage": "full",
#   "cost": true,
#   "read_only": "sandbox",
#   "structured_output": "native",
#   "mcp": "native",
#   "max_turns": "native",
#   "claude_md": "native+imports",
#   "auth": { "native_oauth": ["CLAUDE_CODE_OAUTH_TOKEN"], "native_key": ["ANTHROPIC_API_KEY"], "openrouter": false },
#   "native_control_path": "gateway"
# }
# rh-meta-end
set -uo pipefail
. "$RH_LIB/envelope.sh"

command -v claude >/dev/null 2>&1 || {
  echo "claude CLI not found (npm i -g @anthropic-ai/claude-code)" >&2; exit 1; }

# --permission-mode default: Claude Code 2.1.285+ starts `-p` in AUTO mode when no
# mode is set and it runs behind a custom ANTHROPIC_BASE_URL (every gateway arm in
# scripts/llm-gateway.sh) or with telemetry off. In auto mode a classifier may
# APPROVE a tool outside --allowedTools; default mode denies it, which is what
# the read-only / allowlist tiers rely on and what 2.1.168 did.
ARGS=(-p - --output-format json --permission-mode default)
[ -n "${RH_MODEL:-}" ] && ARGS+=(--model "$RH_MODEL")
[ -n "${RH_ALLOWED_TOOLS:-}" ] && ARGS+=(--allowedTools "$RH_ALLOWED_TOOLS")
if [ -n "${RH_MCP_CONFIG:-}" ] && [ -f "${RH_MCP_CONFIG:-}" ]; then
  ARGS+=(--mcp-config "$RH_MCP_CONFIG" --strict-mcp-config)
fi
[ -n "${RH_MAX_TURNS:-}" ] && ARGS+=(--max-turns "$RH_MAX_TURNS")
[ -n "${RH_JSON_SCHEMA:-}" ] && ARGS+=(--json-schema "$RH_JSON_SCHEMA")
[ -n "${RH_APPEND_SYSTEM_PROMPT:-}" ] && ARGS+=(--append-system-prompt "$RH_APPEND_SYSTEM_PROMPT")

# 2.1.285+ also assumes a model's 1M context window behind a custom
# ANTHROPIC_BASE_URL. A gateway that stops at 200K would then fail a long run
# instead of compacting it, so keep the 200K window there (as 2.1.168 did) unless
# the operator set CLAUDE_CODE_DISABLE_1M_CONTEXT themselves.
if [ -n "${ANTHROPIC_BASE_URL:-}" ]; then
  export CLAUDE_CODE_DISABLE_1M_CONTEXT="${CLAUDE_CODE_DISABLE_1M_CONTEXT:-1}"
fi

OUT="$RH_TMPDIR/claude-out.json"
claude "${ARGS[@]}" < "$RH_PROMPT_FILE" > "$OUT"
rc=$?

# Surface permission denials. The result event carries a permission_denials array
# (tool_name + the full tool_input) for every call the allowlist refused. A
# read-only skill whose notify write was denied still exits 0, so without this the
# run went green with nothing in the log. Tool names and counts only: tool_input
# can hold message bodies or command lines, so it never leaves this file. Names
# are reduced to a safe charset so a crafted MCP tool name cannot inject a
# workflow command.
DENIED=$(jq -r '
  [(.permission_denials // [])[] | (.tool_name // "unknown") | tostring | gsub("[^A-Za-z0-9_.:-]"; "_")]
  | group_by(.) | map("\(.[0]) x\(length)") | join(", ")' "$OUT" 2>/dev/null || true)
if [ -n "$DENIED" ]; then
  echo "::warning::claude denied tool call(s) under --allowedTools: $DENIED" >&2
fi

if [ $rc -ne 0 ]; then
  # 300 chars silently discarded the actual error/result content on any
  # response longer than that -- e.g. a full completed-turn JSON envelope
  # with a non-zero exit, where the real signal (result/subtype/
  # api_error_status) sits earlier in the file than the last 300 bytes.
  # Widened to match the 4000-char precedent this repo's own workflow-level
  # harness-stderr logging already uses (aeon.yml, messages.yml).
  echo "claude exited $rc: $(tail -c 4000 "$OUT" | tr '\n' ' ')" >&2
  exit $rc
fi

# With --json-schema Claude puts the object in .structured_output and may leave
# .result empty; the contract says .result carries the payload — normalize that.
if jq -e 'type == "object"' "$OUT" >/dev/null 2>&1; then
  jq -c '
    if (.structured_output // null) != null and ((.result // "") == "")
    then .result = (.structured_output | tojson)
    else . end' "$OUT"
else
  echo "error: claude output was not a JSON object; rejecting raw stdout" >&2
  wrap_raw_output < "$OUT"
  exit 3
fi

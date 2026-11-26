#!/usr/bin/env bash
# Factory Droid CLI adapter: documented `droid exec` headless mode.
# rh-meta-start
# {
#   "id": "droid",
#   "label": "Factory Droid",
#   "cli": { "install": "curl -fsSL https://app.factory.ai/cli | sh", "bin": "droid", "min_version": "1.21.1" },
#   "invoke": "droid exec -o json -f <promptfile>",
#   "round_trip": true,
#   "token_usage": "full",
#   "cost": false,
#   "read_only": "sandbox",
#   "structured_output": "shim",
#   "mcp": "native",
#   "max_turns": "none",
#   "claude_md": "native",
#   "default_model": "default",
#   "credentials": [
#     { "secret": "FACTORY_API_KEY", "kind": "api_key", "auth_mode": "native-key", "label": "Factory API key", "get_url": "https://app.factory.ai/settings/api-keys", "aeon_cmd": "./aeon auth --harness droid --key <key>" }
#   ],
#   "native_control_path": "run-harness"
# }
# rh-meta-end
set -uo pipefail
. "$RH_LIB/envelope.sh"
. "$RH_LIB/schema-retry.sh"
command -v droid >/dev/null 2>&1 || { echo "Droid CLI not found (curl -fsSL https://app.factory.ai/cli | sh)" >&2; exit 1; }
DROID_HOME="$RH_TMPDIR/droid-home"; mkdir -p "$DROID_HOME/.factory"; export HOME="$DROID_HOME"
if [ -n "${RH_MCP_CONFIG:-}" ] && [ -f "${RH_MCP_CONFIG:-}" ]; then cp "$RH_MCP_CONFIG" "$HOME/.factory/mcp.json"; fi
PROMPT="$(cat "$RH_PROMPT_FILE")"; PREFIX="${RH_COMPAT_RULES:-}"
[ -n "${RH_APPEND_SYSTEM_PROMPT:-}" ] && PREFIX="${PREFIX:+$PREFIX$'\n'}${RH_APPEND_SYSTEM_PROMPT}"
[ -n "$PREFIX" ] && PROMPT="${PREFIX}"$'\n\n'"${PROMPT}"
[ -n "${RH_JSON_SCHEMA:-}" ] && PROMPT="${PROMPT}$(schema_prompt_suffix "$RH_JSON_SCHEMA")"
# droid exec reads the prompt from a file (-f) and emits one JSON object on
# stdout. Write the assembled prompt (prefix + schema suffix applied) to a temp
# file so -f carries the full thing, not just the raw input.
PROMPT_FILE="$RH_TMPDIR/droid-prompt.txt"; printf '%s' "$PROMPT" > "$PROMPT_FILE"
# --auto high grants write/execute; its absence (the default) is read-only.
# -m overrides the model (default: claude-opus-5-5); "default" means "let Droid
# use its own default" and is not forwarded.
ARGS=(exec -o json -f "$PROMPT_FILE")
[ -n "${RH_MODEL:-}" ] && [ "$RH_MODEL" != "default" ] && ARGS+=(-m "$RH_MODEL")
[ "${RH_MODE:-write}" != "read-only" ] && ARGS+=(--auto high)
OUT="$RH_TMPDIR/droid-out.json"; droid "${ARGS[@]}" > "$OUT"; rc=$?
[ $rc -ne 0 ] && { echo "droid exited $rc: $(tail -c 4000 "$OUT" | tr '\n' ' ')" >&2; exit $rc; }
if jq -e . "$OUT" >/dev/null 2>&1; then
  # droid sets is_error on a provider/auth failure even with exit 0 in some
  # builds; treat that as an error like cursor's non-JSON rejection.
  IS_ERR=$(jq -r '.is_error // false' "$OUT")
  if [ "$IS_ERR" = "true" ]; then
    echo "error: droid returned an error result: $(jq -r '.result // "unknown error"' "$OUT" | tr '\n' ' ')" >&2
    exit 1
  fi
  RESULT=$(jq -r 'if (.result // null) != null then (.result | if type == "string" then . else tojson end) elif (.output // null) != null then (.output | if type == "string" then . else tojson end) elif (.text // null) != null then . else tostring end' "$OUT")
  TIN=$(jq -r '.usage.input_tokens // .usage.inputTokens // 0' "$OUT"); TOUT=$(jq -r '.usage.output_tokens // .usage.outputTokens // 0' "$OUT"); TCR=$(jq -r '.usage.cache_read_input_tokens // .usage.cacheReadInputTokens // 0' "$OUT"); SID=$(jq -r '.session_id // .sessionId // ""' "$OUT")
else
  echo "error: droid returned non-JSON output; rejecting raw output" >&2
  wrap_raw_output < "$OUT"
  exit 3
fi
if [ -n "${RH_JSON_SCHEMA:-}" ]; then RESULT="$(schema_extract_json "$RESULT")"; schema_validate "$RH_JSON_SCHEMA" "$RESULT" || { echo "structured output failed validation" >&2; exit 3; }; fi
emit_envelope "$RESULT" "${TIN:-0}" "${TOUT:-0}" "${TCR:-0}" 0 "" "${SID:-}"

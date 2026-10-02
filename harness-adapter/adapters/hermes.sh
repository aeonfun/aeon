#!/usr/bin/env bash
# Hermes Agent adapter using documented scripted `hermes -z` and --usage-file.
# rh-meta-start
# {
#   "id": "hermes",
#   "label": "Hermes (Nous Portal)",
#   "cli": { "install": "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash", "bin": "hermes", "min_version": "2026.9.24" },
#   "invoke": "hermes --usage-file <tmp> -z prompt",
#   "round_trip": true,
#   "token_usage": "full",
#   "cost": true,
#   "read_only": "sandbox",
#   "structured_output": "shim",
#   "mcp": "native",
#   "max_turns": "native",
#   "claude_md": "native",
#   "default_model": "default",
#   "credentials": [
#     { "secret": "HERMES_AUTH", "kind": "oauth_capture", "auth_mode": "native-oauth", "label": "Nous Portal login", "get_url": "https://portal.nousresearch.com", "login_cmd": "hermes auth add nous --type oauth", "aeon_cmd": "./aeon auth --harness hermes", "cred_paths": [".hermes/auth.json", ".hermes/config.yaml"], "refresh": "re-run ./aeon auth --harness hermes if a run reports a login error" },
#     { "secret": "OPENROUTER_API_KEY", "kind": "api_key", "auth_mode": "openrouter", "label": "OpenRouter key (one key covers most harnesses)", "prefix": "sk-or-", "get_url": "https://openrouter.ai/settings/keys", "aeon_cmd": "./aeon secrets set OPENROUTER_API_KEY --stdin" }
#   ],
#   "native_control_path": "run-harness"
# }
# rh-meta-end
set -uo pipefail
. "$RH_LIB/envelope.sh"
. "$RH_LIB/schema-retry.sh"
command -v hermes >/dev/null 2>&1 || { echo "Hermes CLI not found (curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash)" >&2; exit 1; }
HERMES_HOME="$RH_TMPDIR/hermes-home"; mkdir -p "$HERMES_HOME/.hermes"; export HOME="$HERMES_HOME"
if [ -n "${HERMES_AUTH:-}" ]; then
  printf '%s' "$HERMES_AUTH" | base64 -d | tar xzf - -C "$HOME" || { echo "hermes: invalid HERMES_AUTH archive" >&2; exit 1; }
  chmod 600 "$HOME/.hermes/auth.json" 2>/dev/null || true
fi
PROMPT="$(cat "$RH_PROMPT_FILE")"; PREFIX="${RH_COMPAT_RULES:-}"
[ -n "${RH_APPEND_SYSTEM_PROMPT:-}" ] && PREFIX="${PREFIX:+$PREFIX$'\n'}${RH_APPEND_SYSTEM_PROMPT}"
[ -n "$PREFIX" ] && PROMPT="${PREFIX}"$'\n\n'"${PROMPT}"
[ -n "${RH_JSON_SCHEMA:-}" ] && PROMPT="${PROMPT}$(schema_prompt_suffix "$RH_JSON_SCHEMA")"
ARGS=(--usage-file "$RH_TMPDIR/hermes-usage.json" -z "$PROMPT"); [ -n "${RH_MODEL:-}" ] && [ "$RH_MODEL" != "default" ] && ARGS+=(--model "$RH_MODEL"); [ "${RH_MODE:-write}" = "read-only" ] && ARGS+=(--safe-mode); [ -z "${HERMES_AUTH:-}" ] && [ -n "${OPENROUTER_API_KEY:-}" ] && ARGS+=(--provider openrouter)
OUT="$RH_TMPDIR/hermes-out.txt"; hermes "${ARGS[@]}" > "$OUT"; rc=$?
[ $rc -ne 0 ] && { echo "hermes exited $rc: $(tail -c 4000 "$OUT" | tr '\n' ' ')" >&2; exit $rc; }; RESULT="$(cat "$OUT")"
TIN=0; TOUT=0; TCR=0; COST=""; SID=""; U="$RH_TMPDIR/hermes-usage.json"
if [ -f "$U" ] && jq -e . "$U" >/dev/null 2>&1; then TIN=$(jq -r '.input_tokens // 0' "$U"); TOUT=$(jq -r '.output_tokens // 0' "$U"); TCR=$(jq -r '.cache_read_tokens // 0' "$U"); COST=$(jq -r '.estimated_cost_usd // empty' "$U"); SID=$(jq -r '.session_id // ""' "$U"); fi
# hermes exits 0 on a provider HTTP error and prints it as the answer. Only treat
# output as that error when it is error-shaped: the whole output is one
# "HTTP 4xx/5xx: ..." line, or it mentions one and no output tokens were billed.
# A real answer that merely quotes "HTTP 404:" (an API audit, a scrape report)
# must not be failed.
if grep -Eq '(^|[[:space:]])HTTP [45][0-9][0-9]:' "$OUT" && {
  [ "$(grep -c . "$OUT")" -le 1 ] && grep -Eq '^[[:space:]]*HTTP [45][0-9][0-9]:' "$OUT" || [ "${TOUT:-0}" = "0" ]; }; then
  echo "hermes API error: $(tail -c 4000 "$OUT" | tr '\n' ' ')" >&2
  exit 1
fi
if [ -n "${RH_JSON_SCHEMA:-}" ]; then RESULT="$(schema_extract_json "$RESULT")"; schema_validate "$RH_JSON_SCHEMA" "$RESULT" || { echo "structured output failed validation" >&2; exit 3; }; fi
emit_envelope "$RESULT" "$TIN" "$TOUT" "$TCR" 0 "$COST" "$SID"

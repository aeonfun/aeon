#!/usr/bin/env bash
# claude adapter — the identity adapter. Claude Code already speaks the contract;
# this just maps RH_* env to flags and folds structured output into .result.
#
# rh-meta-start - capability manifest source of truth (bin/generate-harnesses-json)
# {
#   "id": "claude",
#   "label": "Claude Code",
#   "cli": { "install": "npm i -g @anthropic-ai/claude-code@2.1.301", "bin": "claude", "min_version": "2.1.301" },
#   "invoke": "claude -p - --output-format json",
#   "round_trip": true,
#   "token_usage": "full",
#   "cost": true,
#   "read_only": "sandbox",
#   "structured_output": "native",
#   "mcp": "native",
#   "max_turns": "native",
#   "claude_md": "native+imports",
#   "default_model": "claude-sonnet-5-5",
#   "credentials": [
#     { "secret": "CLAUDE_CODE_OAUTH_TOKEN", "kind": "oauth_token", "auth_mode": "native-oauth", "label": "Claude subscription (Pro/Max)", "prefix": "sk-ant-oat", "get_url": "https://claude.ai", "login_cmd": "claude setup-token", "aeon_cmd": "./aeon auth --harness claude-code", "expires": "about 1 year (claude setup-token mints a long-lived token)", "refresh": "re-run ./aeon auth --harness claude-code before it expires" },
#     { "secret": "ANTHROPIC_API_KEY", "kind": "api_key", "auth_mode": "native-key", "label": "Anthropic API key (pay as you go)", "prefix": "sk-ant-api", "get_url": "https://console.anthropic.com/settings/keys", "aeon_cmd": "./aeon auth --key <sk-ant-api...>" }
#   ],
#   "gateways": "gateways.json",
#   "native_control_path": "gateway"
# }
# rh-meta-end
#
# The claude harness's provider cascade (scripts/llm-gateway.sh), in its default
# GATEWAY_ORDER. scripts/tests/test_credential_manifest.sh holds it to that file
# and to apps/dashboard/lib/gateway-registry.ts.
# gw-meta-start - gateway manifest source of truth (bin/generate-harnesses-json -> gateways.json)
# [
#   { "id": "claude", "label": "Claude subscription", "secrets": ["CLAUDE_CODE_OAUTH_TOKEN"], "prefixes": ["sk-ant-oat"], "transport": "native", "base_url": "https://api.anthropic.com", "get_url": "https://claude.ai" },
#   { "id": "anthropic", "label": "Anthropic API", "secrets": ["ANTHROPIC_API_KEY"], "prefixes": ["sk-ant-api"], "transport": "native", "base_url": "https://api.anthropic.com", "get_url": "https://console.anthropic.com/settings/keys" },
#   { "id": "openrouter", "label": "OpenRouter", "secrets": ["OPENROUTER_API_KEY"], "prefixes": ["sk-or-"], "transport": "anthropic-compatible", "base_url": "https://openrouter.ai/api", "get_url": "https://openrouter.ai/settings/keys" },
#   { "id": "bankr", "label": "Bankr", "secrets": ["BANKR_LLM_KEY"], "prefixes": ["bk_"], "transport": "anthropic-compatible", "base_url": "https://llm.bankr.bot", "get_url": "https://docs.bankr.bot/llm-gateway/overview" },
#   { "id": "usepod", "label": "UsePod", "secrets": ["USEPOD_TOKEN"], "prefixes": [], "transport": "anthropic-compatible", "base_url": "https://api.usepod.ai/proxy/<USEPOD_TOKEN>", "get_url": "https://usepod.ai" },
#   { "id": "venice", "label": "Venice", "secrets": ["VENICE_API_KEY"], "prefixes": [], "transport": "sidecar", "base_url": "https://api.venice.ai/api/v1/chat/completions", "get_url": "https://venice.ai/settings/api" },
#   { "id": "surplus", "label": "Surplus Intelligence", "secrets": ["SURPLUS_API_KEY"], "prefixes": ["inf_"], "transport": "sidecar", "base_url": "https://www.surplusintelligence.ai/api/inference/v1/chat/completions", "get_url": "https://surplusintelligence.ai" },
#   { "id": "grok", "label": "Grok (xAI)", "secrets": ["XAI_API_KEY"], "prefixes": ["xai-"], "transport": "anthropic-compatible", "base_url": "https://api.x.ai", "get_url": "https://console.x.ai" },
#   { "id": "glm", "label": "GLM (Z.AI)", "secrets": ["GLM_API_KEY", "ZAI_API_KEY"], "prefixes": [], "transport": "anthropic-compatible", "base_url": "https://api.z.ai/api/anthropic", "get_url": "https://z.ai" },
#   { "id": "hivemindos", "label": "HivemindOS Models", "secrets": ["HIVEMINDOS_CREDIT_TOKEN"], "prefixes": [], "transport": "sidecar", "base_url": "https://hivemindos-paid-agent-gateway.hivemindos.workers.dev/api/paid-agents/default/chat/completions", "get_url": "https://hivemindos.liamvisionary.com" }
# ]
# gw-meta-end
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
# --no-tools: no tool schemas in the prompt (a one-shot text call like the scorer).
[ "${RH_NO_TOOLS:-}" = 1 ] && ARGS+=(--tools "")
if [ -n "${RH_MCP_CONFIG:-}" ] && [ -f "${RH_MCP_CONFIG:-}" ]; then
  ARGS+=(--mcp-config "$RH_MCP_CONFIG" --strict-mcp-config)
fi
[ -n "${RH_MAX_TURNS:-}" ] && ARGS+=(--max-turns "$RH_MAX_TURNS")
[ -n "${RH_JSON_SCHEMA:-}" ] && ARGS+=(--json-schema "$RH_JSON_SCHEMA")
[ -n "${RH_APPEND_SYSTEM_PROMPT:-}" ] && ARGS+=(--append-system-prompt "$RH_APPEND_SYSTEM_PROMPT")

# OTel tracing on: hold the first turn ~1s with a SessionStart hook. With a
# subscription OAuth token Claude Code starts its span exporter only after its
# remote managed settings fetch, and the first turn does not wait for it, so the
# interaction span started on a no-op tracer and every later span became its own
# one-span trace (aeon-agent, every run since 2.1.287; also 2.1.301). Measured on
# a runner: 0 of 6 runs kept the tree without the hook, 12 of 12 with a 0.5s or 1s
# hook. AEON_OTEL_STARTUP_DELAY=0 turns it off.
if [ "${CLAUDE_CODE_ENABLE_TELEMETRY:-}" = 1 ] && [ -n "${OTEL_TRACES_EXPORTER:-}" ] && [ "${OTEL_TRACES_EXPORTER}" != none ]; then
  _delay="${AEON_OTEL_STARTUP_DELAY:-1}"
  if [[ "$_delay" =~ ^[0-9]+(\.[0-9]+)?$ ]] && [ "$_delay" != 0 ]; then
    ARGS+=(--settings "{\"hooks\":{\"SessionStart\":[{\"hooks\":[{\"type\":\"command\",\"command\":\"sleep $_delay\"}]}]}}")
  fi
fi

# 2.1.285+ also assumes a model's 1M context window behind a custom
# ANTHROPIC_BASE_URL. A gateway that stops at 200K would then fail a long run
# instead of compacting it, so keep the 200K window there (as 2.1.168 did) unless
# the operator set CLAUDE_CODE_DISABLE_1M_CONTEXT themselves.
if [ -n "${ANTHROPIC_BASE_URL:-}" ]; then
  export CLAUDE_CODE_DISABLE_1M_CONTEXT="${CLAUDE_CODE_DISABLE_1M_CONTEXT:-1}"
fi

# Unattended retry mode: wait out 429/529s instead of failing on the first one,
# but end the request (2.1.301+) when a usage limit resets more than 10 min away,
# so a capped subscription fails the run in minutes instead of sitting until the
# --timeout guard (1800s on a skill run). Operator values win.
export CLAUDE_CODE_RETRY_WATCHDOG="${CLAUDE_CODE_RETRY_WATCHDOG:-1}"
export CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS="${CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS:-600000}"
# A failover attempt (AEON_GATEWAY_ATTEMPT 2+, set by the aeon.yml gateway
# cascade) waits out 429/529s for at most AEON_FAILOVER_MAX_WAIT_MS (default
# 2 min) per request. A dead fallback key answers 429 to every call with no
# usage-limit header, so the watchdog above kept retrying until the 1800s guard
# (GLM, 2026-10-19: 14 429s over 30 min per run); now the attempt fails in
# minutes with the 429 in its envelope.
if [[ "${AEON_GATEWAY_ATTEMPT:-1}" =~ ^[0-9]+$ ]] && [ "${AEON_GATEWAY_ATTEMPT:-1}" -gt 1 ]; then
  export CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS="${CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS:-${AEON_FAILOVER_MAX_WAIT_MS:-120000}}"
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
# A denied Bash call also names its program (the first word after any VAR=value
# prefixes, which can hold secrets, so they are skipped) and is marked ">" when
# the command redirects into a file, the usual reason Claude Code refuses it.
DENIED=$(jq -r '
  def safe: tostring | gsub("[^A-Za-z0-9_.:/-]"; "_") | .[0:40];
  [(.permission_denials // [])[]
   | ((.tool_name // "unknown") | safe) as $t
   | if $t == "Bash" and ((.tool_input.command? // "") | type) == "string" then
       (.tool_input.command | [splits("[ \t\n]+")] | map(select(length > 0))
        | map(select(test("^[A-Za-z_][A-Za-z0-9_]*=") | not)) | (.[0] // "") | safe) as $p
       | (if (.tool_input.command | test(">")) then ">" else "" end) as $r
       | if $p == "" then $t else "Bash(\($p)\($r))" end
     else $t end]
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

#!/usr/bin/env bash
# fx adapter — Vercel's fx (github.com/vercel-labs/fx) behind the Claude Code contract.
#
# quirks this adapter absorbs, all verified against a real locally-built fx
# binary (zig build), not just docs:
#   * `fx ask --json` prints ONE json object on stdout, not a stream — much
#     simpler than the pi/grok jsonl-event adapters. shape:
#     {output, exit_code, model, session_id, steps, tool_calls, error?}
#   * usage/cost is NOT in that blob. fx tracks it internally
#     (input_tokens/output_tokens/cache_read_tokens/total_cost) but `ask`
#     doesn't surface it -> we do a second call, `fx session <id> --json`,
#     keyed off the session_id the first call returns.
#   * no --model flag on `ask`. model selection is FX_MODEL (env only),
#     confirmed read via io_mod.getenv in src/core/config/config_runtime.zig.
#   * --system on `ask` REPLACES the whole system prompt (confirmed:
#     src/core/cli/cli_ask.zig sets effective_cfg.prompt_policy.system_prompt
#     = sp, no append path exists) -> never use it for compat rules/operator
#     append, that would blow away fx's own tuned prompt. instead we prepend
#     compat rules + operator append to the PROMPT TEXT itself, piped via
#     stdin (same as claude.sh) rather than a positional arg, since fx has a
#     dedicated stdin-prompt fallback with its own 8MiB bound
#     (stdin_prompt_resource_byte_limit in cli_ask.zig) and this keeps every
#     adapter's prompt-delivery shape consistent.
#   * permission mode: --auto (default), not --yolo. this is a real, deliberate
#     difference from grok.sh's bypassPermissions choice, not an oversight —
#     grok bypasses because grok ABORTS THE WHOLE TURN on any denial with no
#     partial output (a hard dealbreaker for unattended use). fx does the
#     opposite: a blocked action fails clean and structured
#     ({"error":"noninteractive_permission_prompt_unavailable"}, confirmed
#     live against the binary), so there's no failure-mode reason to skip
#     fx's own real permission system — it's an allowlist-first admission
#     layer plus an LLM-reviewed second opinion on borderline actions
#     (src/core/permissions/), independently audited today and found solid.
#     aeon's OS sandbox is still the actual write-boundary for read-only
#     skills either way, same as every other harness here.
#   * MCP config shape is NOT the mcpServers convention. fx reads
#     {home}/.fx/mcp.json with top-level key "mcp", and per-server shape
#     {type:"local", command:[argv...], env:{...}} for stdio or
#     {type:"http"|"sse", url, headers:{...}} for remote — confirmed against
#     src/builtins/mcp.zig's own fixtures. translated below.
#   * no FX_HOME override exists (fx reads real $HOME directly, confirmed —
#     no override env anywhere in src/core/config or src/core/cli). so this
#     adapter runs fx under an isolated HOME inside RH_TMPDIR: keeps aeon
#     runs from touching/depending on real user state and gives us a clean
#     place to drop the translated mcp.json.
# rh-meta-start - capability manifest source of truth (bin/generate-harnesses-json)
# {
#   "id": "fx",
#   "label": "fx",
#   "cli": { "install": "curl -fsSL https://fx.sh/setup.sh | bash", "bin": "fx", "min_version": "0.0.12" },
#   "invoke": "fx ask --json --auto --no-save",
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
#     { "secret": "AI_GATEWAY_API_KEY", "kind": "api_key", "auth_mode": "native-key", "label": "Vercel AI Gateway key", "get_url": "https://vercel.com/docs/ai-gateway", "aeon_cmd": "./aeon auth --harness fx --key <key>" },
#     { "secret": "VERCEL_OIDC_TOKEN", "kind": "oidc", "auth_mode": "native-key", "label": "Vercel OIDC token", "get_url": "https://vercel.com/docs/oidc", "login_cmd": "vercel env pull", "expires": "about 12h (short-lived; best where Vercel provisions it for you)", "refresh": "pull a fresh token with vercel env pull and set it again" }
#   ],
#   "native_control_path": "run-harness"
# }
# rh-meta-end
set -uo pipefail
. "$RH_LIB/envelope.sh"
. "$RH_LIB/schema-retry.sh"

command -v fx >/dev/null 2>&1 || {
  echo "fx CLI not found (curl -fsSL https://fx.sh/setup.sh | bash)" >&2; exit 1; }

# isolated HOME: fx has no FX_HOME/--home override, so we give it a scratch
# home instead of touching the runner's real one. this is also where the
# translated mcp.json lives.
FX_HOME="$RH_TMPDIR/fx-home"
mkdir -p "$FX_HOME/.fx"
export HOME="$FX_HOME"

[ -n "${RH_MODEL:-}" ] && [ "${RH_MODEL}" != "default" ] && export FX_MODEL="$RH_MODEL"
[ -n "${RH_MAX_TURNS:-}" ] && export FX_MAX_AGENT_STEPS="$RH_MAX_TURNS"

# translate aeon's mcpServers shape -> fx's {mcp:{name:{type,command|url,...}}}.
# stdio servers: command (string) + args (array) -> one argv array.
# remote servers: preserve an explicit type:"sse"; Aeon's config has no separate
# transport field for unspecified URL servers, so those default to fx's streamable
# HTTP type. This keeps hand-authored SSE entries correct without guessing for the
# common URL-only form.
if [ -n "${RH_MCP_CONFIG:-}" ] && [ -f "${RH_MCP_CONFIG:-}" ]; then
  jq '{mcp: (.mcpServers // {} | to_entries | map({
        key: .key,
        value: (if .value.command then
            {type: "local", command: ([.value.command] + (.value.args // [])),
             env: (.value.env // {})}
          else
            {type: (if .value.type == "sse" then "sse" else "http" end),
             url: .value.url, headers: (.value.headers // {})}
          end)
      }) | from_entries)}' "$RH_MCP_CONFIG" > "$FX_HOME/.fx/mcp.json" 2>/dev/null \
    || echo "warning: mcp config translation failed — continuing without MCP" >&2
fi

# compat preamble + operator append ride the PROMPT (not --system, see header).
PROMPT="$(cat "$RH_PROMPT_FILE")"
PREFIX="${RH_COMPAT_RULES:-}"
if [ -n "${RH_APPEND_SYSTEM_PROMPT:-}" ]; then
  PREFIX="${PREFIX:+$PREFIX
}${RH_APPEND_SYSTEM_PROMPT}"
fi
[ -n "$PREFIX" ] && PROMPT="${PREFIX}

${PROMPT}"
[ -n "${RH_JSON_SCHEMA:-}" ] && PROMPT="${PROMPT}$(schema_prompt_suffix "$RH_JSON_SCHEMA")"

ARGS=(ask --json --auto --no-save)
# no --timeout: it's not in `fx ask --help`'s public surface (confirmed live),
# so this adapter doesn't lean on an undocumented flag. FX_MAX_AGENT_STEPS
# above is the real, documented turn-count cap; wall-clock is the dispatcher's
# job, same as every other harness here without a native --max-turns.

RESULT=""; EXIT_CODE=0; SID=""; ERR=""

run_once() {
  # run_once <prompt via stdin> -> sets RESULT/EXIT_CODE/SID/ERR; returns fx's rc.
  # pre-initialized above (not just inside here) since the unparseable-output
  # early return below skips these assignments, and `set -u` would otherwise
  # crash the very next line that reads $ERR.
  local out="$RH_TMPDIR/fx-out.json"
  printf '%s' "$1" | fx "${ARGS[@]}" > "$out"
  local rc=$?
  if ! jq -e . >/dev/null 2>&1 < "$out"; then
    echo "fx exited $rc with unparseable output: $(tail -c 4000 "$out" | tr '\n' ' ')" >&2
    return 3
  fi
  RESULT=$(jq -r '.output // ""' "$out")
  EXIT_CODE=$(jq -r '.exit_code // 0' "$out")
  SID=$(jq -r '.session_id // ""' "$out")
  ERR=$(jq -r '.error // empty' "$out")
  return $rc
}

run_once "$PROMPT"
rc=$?

if [ -n "$ERR" ]; then
  case "$ERR" in
    MissingCredentials)
      echo "fx exited: missing credentials — set AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN)" >&2 ;;
    noninteractive_permission_prompt_unavailable)
      echo "fx blocked on a permission it couldn't resolve unattended (error=$ERR)" >&2 ;;
    *)
      echo "fx exited $rc: error=$ERR $(printf '%s' "$RESULT" | tr '\n' ' ' | cut -c1-2000)" >&2 ;;
  esac
  exit "${rc:-1}"
fi
if [ "$EXIT_CODE" != "0" ]; then
  echo "fx reported exit_code=$EXIT_CODE${RESULT:+ with partial output: $(printf '%s' "$RESULT" | tr '\n' ' ' | cut -c1-2000)}" >&2
  exit 3
fi
if [ "$rc" -ne 0 ] && [ -z "$RESULT" ]; then
  echo "fx exited $rc with no output" >&2
  exit "$rc"
fi

# structured output: validate; one corrective retry
if [ -n "${RH_JSON_SCHEMA:-}" ]; then
  RESULT="$(schema_extract_json "$RESULT")"
  if ! schema_validate "$RH_JSON_SCHEMA" "$RESULT"; then
    echo "structured output failed validation — retrying once" >&2
    run_once "${PROMPT}$(schema_retry_suffix)" || true
    RESULT="$(schema_extract_json "$RESULT")"
    if ! schema_validate "$RH_JSON_SCHEMA" "$RESULT"; then
      echo "structured output still invalid after retry" >&2
      exit 3
    fi
  fi
fi

# usage/cost: second call, keyed off session_id. best-effort — a run that
# produced real output shouldn't fail just because the usage lookup did.
TIN=0; TOUT=0; TCR=0; COST=""
if [ -n "$SID" ]; then
  USAGE_OUT="$RH_TMPDIR/fx-usage.json"
  if fx session "$SID" --json > "$USAGE_OUT" 2>/dev/null && jq -e . >/dev/null 2>&1 < "$USAGE_OUT"; then
    TIN=$(jq -r '.usage.input_tokens // .input_tokens // 0' "$USAGE_OUT")
    TOUT=$(jq -r '.usage.output_tokens // .output_tokens // 0' "$USAGE_OUT")
    TCR=$(jq -r '.usage.cache_read_tokens // .cache_read_tokens // 0' "$USAGE_OUT")
    COST=$(jq -r '.usage.total_cost // .total_cost // empty' "$USAGE_OUT")
  else
    echo "notice: fx session usage lookup failed — usage will report as 0" >&2
  fi
fi

emit_envelope "$RESULT" "$TIN" "$TOUT" "$TCR" 0 "$COST" "$SID"

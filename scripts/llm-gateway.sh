#!/usr/bin/env bash
# llm-gateway.sh — resolve LLM routing for an Aeon run.
#
# SOURCED (not executed) by the "Run"-type steps in .github/workflows/aeon.yml,
# so exported env vars AND any background sidecar persist into the `claude -p`
# call in the same shell. Place at: scripts/llm-gateway.sh
#
# Inputs already present in the step environment:
#   $GATEWAY                    direct | bankr | openrouter | usepod | surplus | venice
#   $MODEL                      aeon's resolved model id (may be rewritten here)
#   <PROVIDER> secret           the secret for the selected gateway (see below)
#   vars.ANTHROPIC_BASE_URL     optional Anthropic-compatible endpoint (direct path)
#
# Two routing tiers:
#   NATIVE (no proxy): bankr, openrouter, usepod  -> set base URL + auth, done.
#   SIDECAR (wrapper): surplus, venice            -> start claude-code-router on
#                                                    127.0.0.1 to translate
#                                                    Anthropic <-> OpenAI.
#
# NOTE: do not add `set -e/-u` here — this file is sourced and must not change
# the caller's shell options. A hard config error calls `exit 1`, which fails
# the step by design (mirrors aeon's existing behavior).

CCR_PORT="${CCR_PORT:-3456}"

require_secret() {
  if [ -z "${!1:-}" ]; then
    echo "::error::gateway.provider=${GATEWAY} requires the $1 secret but it is not set" >&2
    exit 1
  fi
}

# --- claude-code-router sidecar (SIDECAR tier) ------------------------------
# Single-provider ccr config on 127.0.0.1:$CCR_PORT. ccr's anthropic transformer
# serves /v1/messages and translates to the OpenAI-compatible upstream.
# Router.* pins EVERY slot (default/background/think/longContext) to one model,
# which also neutralizes the model-slot edge case (Claude Code's haiku/sonnet
# background calls all resolve to the configured upstream model).
start_ccr_sidecar() {
  local name="$1" base_url="$2" api_key="$3" model="$4" extra_tf="${5:-}"

  # NOTE: the host step runs under `bash -e` (Actions default), so conditionals
  # in this file must use `if` — a bare `[ … ] && …` list that evaluates false
  # would kill the step.
  #
  # sanitize-empty-text (scripts/ccr-sanitize.js) runs first: Claude Code can
  # emit whitespace-only text blocks that strict upstreams reject with a 400
  # ("text content blocks must contain non-whitespace text"). ccr skips the
  # transformer gracefully if the plugin fails to load.
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local transformers='"sanitize-empty-text", "anthropic"'
  if [ -n "$extra_tf" ]; then transformers="\"sanitize-empty-text\", \"anthropic\", \"${extra_tf}\""; fi

  if ! command -v ccr >/dev/null 2>&1; then
    if ! npm install -g @musistudio/claude-code-router@2.0.0 >/dev/null 2>&1; then
      echo "::error::failed to install @musistudio/claude-code-router@2.0.0" >&2
      exit 1
    fi
  fi

  local cfgdir="$HOME/.claude-code-router"
  mkdir -p "$cfgdir"
  cat > "$cfgdir/config.json" <<JSON
{
  "APIKEY": "",
  "HOST": "127.0.0.1",
  "PORT": ${CCR_PORT},
  "LOG": ${CCR_LOG:-false},
  "API_TIMEOUT_MS": 600000,
  "transformers": [
    { "path": "${script_dir}/ccr-sanitize.js" }
  ],
  "Providers": [
    {
      "name": "${name}",
      "api_base_url": "${base_url}",
      "api_key": "${api_key}",
      "models": ["${model}"],
      "transformer": { "use": [${transformers}] }
    }
  ],
  "Router": {
    "default": "${name},${model}",
    "background": "${name},${model}",
    "think": "${name},${model}",
    "longContext": "${name},${model}"
  }
}
JSON

  ccr start >/dev/null 2>&1 &
  CCR_PID=$!
  # Tear down on step exit. If the host step already sets an EXIT trap, chain
  # rather than overwrite (see INTEGRATION.md).
  # shellcheck disable=SC2064
  trap "kill ${CCR_PID} >/dev/null 2>&1 || true; ccr stop >/dev/null 2>&1 || true" EXIT

  local i
  for i in $(seq 1 30); do
    if curl -s -o /dev/null "http://127.0.0.1:${CCR_PORT}/v1/messages"; then break; fi
    sleep 1
    if [ "$i" -eq 30 ]; then
      echo "::error::claude-code-router did not become ready on 127.0.0.1:${CCR_PORT}" >&2
      exit 1
    fi
  done

  export ANTHROPIC_BASE_URL="http://127.0.0.1:${CCR_PORT}"
  export ANTHROPIC_API_KEY="sk-ccr-local"   # ccr APIKEY empty; value unused but must be non-empty
  unset ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN
}

# --- route ------------------------------------------------------------------
case "${GATEWAY:-direct}" in

  bankr)  # NATIVE — unchanged from aeon's existing behavior
    require_secret BANKR_LLM_KEY
    export ANTHROPIC_BASE_URL="https://llm.bankr.bot"
    export ANTHROPIC_AUTH_TOKEN="$BANKR_LLM_KEY"
    unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN
    echo "::notice::Routing through Bankr Gateway (https://llm.bankr.bot)"
    ;;

  openrouter)  # NATIVE — Anthropic "skin", carries Opus 4.8
    require_secret OPENROUTER_API_KEY
    export ANTHROPIC_BASE_URL="https://openrouter.ai/api"   # NOT /api/v1
    export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"       # Bearer; API_KEY must be blank
    unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN
    # Map EVERY model slot Claude Code uses to OpenRouter slugs (opus/sonnet/haiku).
    export ANTHROPIC_DEFAULT_OPUS_MODEL="${OPENROUTER_MODEL:-anthropic/claude-opus-4.8}"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="${OPENROUTER_MODEL_SONNET:-anthropic/claude-sonnet-4.6}"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="${OPENROUTER_MODEL_HAIKU:-anthropic/claude-haiku-4.5}"
    MODEL="$ANTHROPIC_DEFAULT_OPUS_MODEL"
    echo "::notice::Routing through OpenRouter (Anthropic-native) as ${MODEL}"
    ;;

  usepod)  # NATIVE — token lives in the URL path; base URL IS a secret
    require_secret USEPOD_TOKEN
    export ANTHROPIC_BASE_URL="https://api.usepod.ai/proxy/${USEPOD_TOKEN}"
    export ANTHROPIC_AUTH_TOKEN="unused"    # UsePod auths via the path token
    unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN
    # UsePod mirrors the upstream Anthropic surface, so aeon's claude-opus-4-8 id
    # is passed through by default. If UsePod needs marketplace-specific ids, set
    # USEPOD_MODEL (+ _SONNET / _HAIKU) to override.
    if [ -n "${USEPOD_MODEL:-}" ]; then MODEL="$USEPOD_MODEL"; fi
    if [ -n "${USEPOD_MODEL_SONNET:-}" ]; then export ANTHROPIC_DEFAULT_SONNET_MODEL="$USEPOD_MODEL_SONNET"; fi
    if [ -n "${USEPOD_MODEL_HAIKU:-}" ]; then export ANTHROPIC_DEFAULT_HAIKU_MODEL="$USEPOD_MODEL_HAIKU"; fi
    echo "::notice::Routing through UsePod (Anthropic-native marketplace)"
    ;;

  surplus)  # SIDECAR — OpenAI-compatible; carries Opus 4.8
    require_secret SURPLUS_API_KEY
    start_ccr_sidecar surplus \
      "https://www.surplusintelligence.ai/api/inference/v1/chat/completions" \
      "$SURPLUS_API_KEY" "${SURPLUS_MODEL:-claude-opus-4.8}"
    echo "::notice::Routing through Surplus via claude-code-router (${SURPLUS_MODEL:-claude-opus-4.8})"
    ;;

  venice)  # SIDECAR — OpenAI-compatible; tops out ~Opus 4.6 (dash format)
    require_secret VENICE_API_KEY
    # Set VENICE_CLEANCACHE=1 to add the cleancache transformer (1h TTL, avoids
    # the shared 4-block prompt-cache limit) if you hit cache errors.
    start_ccr_sidecar venice \
      "https://api.venice.ai/api/v1/chat/completions" \
      "$VENICE_API_KEY" "${VENICE_MODEL:-claude-opus-4-6}" "${VENICE_CLEANCACHE:+cleancache}"
    echo "::notice::Routing through Venice via claude-code-router (${VENICE_MODEL:-claude-opus-4-6})"
    ;;

  direct|"")  # NATIVE — Anthropic API or an Anthropic-compatible endpoint. Unchanged.
    if [ -n "${ANTHROPIC_BASE_URL:-}" ]; then
      echo "::notice::Using Anthropic-compatible API at ${ANTHROPIC_BASE_URL}"
    else
      echo "::notice::Using direct Anthropic API"
    fi
    ;;

  *)
    echo "::error::unknown gateway.provider '${GATEWAY}'" >&2
    exit 1
    ;;
esac

#!/usr/bin/env bash
# llm-gateway.sh — resolve LLM routing for an Aeon run.
#
# SOURCED (not executed) by the "Run"-type steps in .github/workflows/aeon.yml,
# so exported env vars AND any background sidecar persist into the `claude -p`
# call in the same shell. Place at: scripts/llm-gateway.sh
#
# Inputs already present in the step environment:
#   $GATEWAY                    auto | direct | bankr | openrouter | usepod | surplus | venice | grok | glm | hivemindos
#                               (auto = resolve at run time from which secrets are set)
#   $MODEL                      aeon's resolved model id (may be rewritten here)
#   <PROVIDER> secret           the secret for the selected gateway (see below)
#   vars.ANTHROPIC_BASE_URL     optional Anthropic-compatible endpoint (direct path)
#   HIVEMINDOS_REASONING        'keep' sends Claude Code's reasoning-off flag as asked
#                               (cheaper on models that honour it; default drops it)
#   HIVEMINDOS_MAX_TOKENS       per-call completion cap (default 4096, 0 disables): a
#                               credit-billed endpoint holds against what a call asks for
#
# Two routing tiers:
#   NATIVE (no proxy): bankr, openrouter, usepod, grok, glm  -> set base URL + auth, done.
#   SIDECAR (wrapper): surplus, venice, hivemindos -> start claude-code-router on
#                                                    127.0.0.1 to translate
#                                                    Anthropic <-> OpenAI.
#
# NOTE: `grok` here is the GATEWAY path — Claude Code (`claude -p`) pointed at
# xAI's Anthropic-compatible API. It is distinct from the grok CLI *harness*
# (harness: grok in aeon.yml → harness-adapter/adapters/grok.sh), which runs the grok binary
# itself and never sources this file.
#
# NOTE: do not add `set -e/-u` here — this file is sourced and must not change
# the caller's shell options. A hard config error calls `exit 1`, which fails
# the step by design (mirrors aeon's existing behavior).

CCR_PORT="${CCR_PORT:-3456}"
HIVEMINDOS_DEFAULT_MODEL="inclusionai/ling-3.0-flash"

# Route notices. The Run step sources this file once per attempt; post-run steps
# (scorer, feed convert) source it again for their own claude call and set
# AEON_GATEWAY_QUIET=1, so the route prints as a plain log line there instead of a
# second, identical run annotation. Warnings and errors are never quieted.
gw_notice() {
  if [ -n "${AEON_GATEWAY_QUIET:-}" ]; then echo "gateway: $*"; else echo "::notice::$*"; fi
}

require_secret() {
  if [ -z "${!1:-}" ]; then
    echo "::error::gateway.provider=${GATEWAY} requires the $1 secret but it is not set" >&2
    exit 1
  fi
}

# --- claude-code-router sidecar (SIDECAR tier) ------------------------------
# Single-provider claude-code-router on 127.0.0.1:$CCR_PORT. ccr serves the
# Anthropic /v1/messages API and translates to the OpenAI-compatible upstream.
#
# ccr 3.x (pinned below) is a rewrite of 2.x, and this function follows it:
#   * config lives in ~/.claude-code-router/config.sqlite. A legacy config.json
#     is read ONCE, as a migration source, only when no sqlite config exists, and
#     is then archived. So any old config.sqlite is removed before writing it.
#   * 3.x reads the provider, HOST, PORT (the gateway port), APIKEY and
#     API_TIMEOUT_MS from it, and ignores LOG, custom "transformers" paths and
#     the Router default/background/think/longContext slots. The provider's
#     upstream protocol is declared via `capabilities` (a provider "transformer"
#     mentioning "anthropic" would make 3.x send Anthropic /v1/messages upstream).
#   * the gateway ALWAYS requires a client key; an empty APIKEY makes ccr invent
#     one the client never sees. So each run gets its own random key, which is
#     what Claude Code sends as ANTHROPIC_API_KEY.
#   * custom request code is a core-gateway plugin module now:
#     scripts/ccr-aeon-gateway.mjs pins every request to the one model this
#     sidecar serves (what the Router slots used to do) and runs
#     ccr-sanitize.js; on hivemindos it also applies ccr-hivemindos.js.
#   * 3.x's default "global profiles" REWRITE ~/.claude/settings.json (an
#     apiKeyHelper + ANTHROPIC_BASE_URL env pointing at a ccr profile port) and
#     ~/.codex/config.toml on startup. That would hijack every later claude or
#     codex call on the runner, so the config turns profiles off.
#   * `ccr start` detaches with stdout discarded, so `ccr serve` runs in the
#     background with its output in logs/ccr.log, which the workflows' post-run
#     log dump already globs. Readiness is GET /health (no auth).
#   * better-sqlite3 needs its install script, so NO --ignore-scripts here, and
#     --allow-scripts=better-sqlite3 for npm 11+, which blocks install scripts by
#     default (older npm ignores the unknown flag).
# ci-harness-cli.yml's ccr job runs this function against a fake upstream.
CCR_VERSION="3.1.1"
start_ccr_sidecar() {
  local name="$1" base_url="$2" api_key="$3" model="$4" extra_tf="${5:-}"

  # NOTE: the host step runs under `bash -e` (Actions default), so conditionals
  # in this file must use `if` - a bare `[ ... ] && ...` list that evaluates
  # false would kill the step.
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local hivemindos=false hooks='"sanitize-empty-text"'
  if [ "$extra_tf" = "hivemindos" ]; then
    hivemindos=true
    hooks='"sanitize-empty-text", "hivemindos"'
  elif [ "$extra_tf" = "cleancache" ]; then
    # 2.x's cleancache transformer has no 3.x counterpart and no job left: 3.x
    # drops cache_control when it translates to chat-completions.
    gw_notice "VENICE_CLEANCACHE is a no-op on claude-code-router 3.x (cache markers are dropped upstream)" >&2
  fi

  # AEON_GATEWAY_DRY_RUN prints what this sidecar WOULD run and returns, so the
  # routing of a sidecar arm can be tested without installing or starting ccr
  # (scripts/tests/test_llm_gateway.sh). Never set in a real run.
  if [ -n "${AEON_GATEWAY_DRY_RUN:-}" ]; then
    echo "ccr-sidecar name=${name} url=${base_url} model=${model} hooks=[${hooks}]"
    export ANTHROPIC_BASE_URL="http://127.0.0.1:${CCR_PORT}"
    export ANTHROPIC_API_KEY="sk-ccr-local"
    unset ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN
    return 0
  fi

  local have=""
  if command -v ccr >/dev/null 2>&1; then
    have="$(node -p "require('$(npm root -g)/@musistudio/claude-code-router/package.json').version" 2>/dev/null || true)"
  fi
  if [ "$have" != "$CCR_VERSION" ]; then
    # No GitHub credential for the install: its lifecycle scripts are third-party code.
    if ! env -u GH_GLOBAL -u GH_SECRETS_PAT -u GH_TOKEN -u GITHUB_TOKEN \
        npm install -g --allow-scripts=better-sqlite3 "@musistudio/claude-code-router@${CCR_VERSION}" >/dev/null 2>&1; then
      echo "::error::failed to install @musistudio/claude-code-router@${CCR_VERSION}" >&2
      exit 1
    fi
  fi

  local cfgdir="$HOME/.claude-code-router"
  mkdir -p "$cfgdir/logs"
  rm -f "$cfgdir/config.sqlite" "$cfgdir/config.sqlite-wal" "$cfgdir/config.sqlite-shm"
  local client_key
  client_key="sk-ccr-$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  # The management UI/RPC token: fixed per run (and masked) so ccr never prints
  # a freshly generated one into the log inside its management URL.
  CCR_WEB_AUTH_TOKEN="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  export CCR_WEB_AUTH_TOKEN
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::add-mask::${client_key}"
    echo "::add-mask::${CCR_WEB_AUTH_TOKEN}"
  fi
  # jq writes every value as a proper JSON string (a key or URL with a quote or
  # backslash cannot break the file).
  jq -n \
    --arg key "$client_key" --argjson port "$CCR_PORT" \
    --arg name "$name" --arg url "$base_url" --arg upkey "$api_key" --arg model "$model" \
    --arg plugin "${script_dir}/ccr-aeon-gateway.mjs" --argjson hivemindos "$hivemindos" '
    {
      APIKEY: $key, HOST: "127.0.0.1", PORT: $port, API_TIMEOUT_MS: 600000,
      profile: { enabled: false, profiles: [],
                 claudeCode: { enabled: false }, codex: { enabled: false } },
      Providers: [{
        name: $name, api_base_url: $url, api_key: $upkey, models: [$model],
        autoFetchModels: false,
        capabilities: [{ type: "openai_chat_completions", baseUrl: $url }]
      }],
      plugins: [{
        id: "aeon-gateway", permissions: ["core-gateway-plugins"],
        coreGateway: { plugins: [{
          key: "aeon-gateway", enabled: true, modulePath: $plugin,
          config: { pinModel: $model, hivemindos: $hivemindos }
        }] }
      }]
    }' > "$cfgdir/config.json"
  chmod 600 "$cfgdir/config.json"

  # Management listener on its own port, so it never collides with the gateway.
  ccr serve --host 127.0.0.1 --port "$((CCR_PORT + 2))" >>"$cfgdir/logs/ccr.log" 2>&1 &
  CCR_PID=$!
  # Tear down on step exit. If the host step already sets an EXIT trap, chain
  # rather than overwrite (see INTEGRATION.md).
  # shellcheck disable=SC2064
  trap "kill ${CCR_PID} >/dev/null 2>&1 || true" EXIT

  local i
  for i in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${CCR_PORT}/health" >/dev/null 2>&1; then break; fi
    if ! kill -0 "$CCR_PID" 2>/dev/null || [ "$i" -eq 60 ]; then
      echo "::error::claude-code-router did not become ready on 127.0.0.1:${CCR_PORT}" >&2
      tail -n 40 "$cfgdir/logs/ccr.log" >&2 || true
      exit 1
    fi
    sleep 1
  done

  export ANTHROPIC_BASE_URL="http://127.0.0.1:${CCR_PORT}"
  export ANTHROPIC_API_KEY="$client_key"
  unset ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN
}

# --- auto resolution --------------------------------------------------------
# When gateway.provider is `auto` (or unset), pick the first provider whose
# secret is present, in priority order. Override the order with the repo var
# GATEWAY_ORDER (space-separated). Default order:
#
#   claude     Claude Code subscription    (CLAUDE_CODE_OAUTH_TOKEN)
#   anthropic  pay-as-you-go Anthropic API (ANTHROPIC_API_KEY)
#   openrouter bankr usepod venice surplus  — gateway keys
#   hivemindos HivemindOS Models             (HIVEMINDOS_CREDIT_TOKEN)
#
# `claude` and `anthropic` are NATIVE direct-API tiers (handled by the case
# below). `direct` is the implicit final fallback (errors later if no usable key).
aeon_present() {  # is the secret for provider $1 set?
  case "$1" in
    claude)     [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] ;;
    anthropic)  [ -n "${ANTHROPIC_API_KEY:-}" ] ;;
    openrouter) [ -n "${OPENROUTER_API_KEY:-}" ] ;;
    bankr)      [ -n "${BANKR_LLM_KEY:-}" ] ;;
    usepod)     [ -n "${USEPOD_TOKEN:-}" ] ;;
    venice)     [ -n "${VENICE_API_KEY:-}" ] ;;
    surplus)    [ -n "${SURPLUS_API_KEY:-}" ] ;;
    grok)       [ -n "${XAI_API_KEY:-}" ] ;;
    glm)        [ -n "${GLM_API_KEY:-${ZAI_API_KEY:-}}" ] ;;
    hivemindos) [ -n "${HIVEMINDOS_CREDIT_TOKEN:-}" ] ;;
    *) false ;;
  esac
}
if [ -z "${GATEWAY:-}" ] || [ "${GATEWAY}" = "auto" ]; then
  # Ordered list of every provider whose secret is set (priority via GATEWAY_ORDER).
  AEON_CANDIDATES=""
  for provider in ${GATEWAY_ORDER:-claude anthropic openrouter bankr usepod venice surplus grok glm hivemindos}; do
    if aeon_present "$provider"; then AEON_CANDIDATES="${AEON_CANDIDATES:+$AEON_CANDIDATES }$provider"; fi
  done
  [ -z "$AEON_CANDIDATES" ] && AEON_CANDIDATES="direct"
  # List mode (RUN, not sourced): print the cascade order and stop. aeon.yml's
  # Run step uses this to fail over from one provider to the next on any failure.
  if [ -n "${AEON_LIST_CANDIDATES:-}" ]; then printf '%s\n' "$AEON_CANDIDATES"; exit 0; fi
  # Single-shot: set up the first present provider (preserves prior behavior).
  GATEWAY="${AEON_CANDIDATES%% *}"
  gw_notice "gateway=auto resolved to '${GATEWAY}'"
fi

# --- route ------------------------------------------------------------------
case "${GATEWAY:-direct}" in

  claude)  # NATIVE — Claude Code subscription (OAuth token)
    require_secret CLAUDE_CODE_OAUTH_TOKEN
    unset ANTHROPIC_API_KEY   # prefer the subscription token over a pay-go key
    gw_notice "Using Claude Code subscription (CLAUDE_CODE_OAUTH_TOKEN)"
    ;;

  anthropic)  # NATIVE — pay-as-you-go Anthropic API key (or compatible endpoint)
    require_secret ANTHROPIC_API_KEY
    unset CLAUDE_CODE_OAUTH_TOKEN
    if [ -n "${ANTHROPIC_BASE_URL:-}" ]; then
      gw_notice "Using Anthropic-compatible API at ${ANTHROPIC_BASE_URL}"
    else
      gw_notice "Using direct Anthropic API (ANTHROPIC_API_KEY)"
    fi
    ;;

  bankr)  # NATIVE — Bankr Gateway (Anthropic-compatible base URL)
    require_secret BANKR_LLM_KEY
    export ANTHROPIC_BASE_URL="https://llm.bankr.bot"
    export ANTHROPIC_AUTH_TOKEN="$BANKR_LLM_KEY"
    unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN
    gw_notice "Routing through Bankr Gateway (https://llm.bankr.bot)"
    ;;

  openrouter)  # NATIVE - Anthropic "skin", carries Opus 5.5 + Sonnet 5.5 + Haiku
    require_secret OPENROUTER_API_KEY
    export ANTHROPIC_BASE_URL="https://openrouter.ai/api"   # NOT /api/v1
    export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"       # Bearer; API_KEY must be blank
    unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN
    # Map EVERY model slot Claude Code uses to OpenRouter slugs (opus/sonnet/haiku).
    export ANTHROPIC_DEFAULT_OPUS_MODEL="${OPENROUTER_MODEL:-anthropic/claude-opus-5.5}"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="${OPENROUTER_MODEL_SONNET:-anthropic/claude-sonnet-5.5}"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="${OPENROUTER_MODEL_HAIKU:-anthropic/claude-haiku-4.5}"
    # Tiered mapping, same as the glm arm: the run's resolved model id picks the
    # slot, so sonnet-tier skills (and the scorer) stay on sonnet instead of every
    # run being billed as Opus.
    case "${MODEL:-}" in
      *opus*)  MODEL="$ANTHROPIC_DEFAULT_OPUS_MODEL" ;;
      *haiku*) MODEL="$ANTHROPIC_DEFAULT_HAIKU_MODEL" ;;
      *)       MODEL="$ANTHROPIC_DEFAULT_SONNET_MODEL" ;;
    esac
    # App attribution: HTTP-Referer + X-Title make aeon's OpenRouter traffic show
    # up on openrouter.ai's public app leaderboard. Claude Code forwards
    # ANTHROPIC_CUSTOM_HEADERS (one "Name: Value" per line) to the upstream even on
    # a third-party gateway base URL. Override per fork with the repo vars
    # OPENROUTER_SITE_URL / OPENROUTER_APP_TITLE.
    export ANTHROPIC_CUSTOM_HEADERS="HTTP-Referer: ${OPENROUTER_SITE_URL:-https://aeon.fun}
X-Title: ${OPENROUTER_APP_TITLE:-Aeon}"
    gw_notice "Routing through OpenRouter (Anthropic-native) as ${MODEL}"
    ;;

  usepod)  # NATIVE — token lives in the URL path; base URL IS a secret
    require_secret USEPOD_TOKEN
    export ANTHROPIC_BASE_URL="https://api.usepod.ai/proxy/${USEPOD_TOKEN}"
    export ANTHROPIC_AUTH_TOKEN="unused"    # UsePod auths via the path token
    unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN
    # UsePod mirrors the upstream Anthropic surface, so aeon's own claude-* ids
    # (e.g. claude-opus-5-5) are passed through by default. If UsePod needs marketplace-specific ids, set
    # USEPOD_MODEL (+ _SONNET / _HAIKU) to override.
    if [ -n "${USEPOD_MODEL:-}" ]; then MODEL="$USEPOD_MODEL"; fi
    if [ -n "${USEPOD_MODEL_SONNET:-}" ]; then export ANTHROPIC_DEFAULT_SONNET_MODEL="$USEPOD_MODEL_SONNET"; fi
    if [ -n "${USEPOD_MODEL_HAIKU:-}" ]; then export ANTHROPIC_DEFAULT_HAIKU_MODEL="$USEPOD_MODEL_HAIKU"; fi
    gw_notice "Routing through UsePod (Anthropic-native marketplace)"
    ;;

  grok)  # NATIVE — xAI's Anthropic-compatible API (Claude Code → api.x.ai)
    require_secret XAI_API_KEY
    # xAI's REST API is Anthropic-SDK-compatible; Claude Code appends
    # /v1/messages to ANTHROPIC_BASE_URL. Override the base with the repo var
    # XAI_ANTHROPIC_BASE_URL if xAI's Anthropic surface moves.
    export ANTHROPIC_BASE_URL="${XAI_ANTHROPIC_BASE_URL:-https://api.x.ai}"
    export ANTHROPIC_AUTH_TOKEN="$XAI_API_KEY"   # Bearer; API_KEY must be blank
    unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN
    # Pin every model slot to a grok coding model. Defaults to grok-4.7, xAI's current
    # flagship and the grok harness default (GROK_MODELS[0] in the dashboard's
    # constants.ts), so the gateway and CLI paths name the same model. GROK_MODEL
    # overrides: the older coding ids (grok-build-0.1, grok-composer-2.5-fast,
    # grok-4.3) are api.x.ai model strings that still work here, even though the grok
    # CLI rejects them on an X-account OAuth login.
    grok_model="${GROK_MODEL:-grok-4.7}"
    export ANTHROPIC_DEFAULT_OPUS_MODEL="$grok_model"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$grok_model"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$grok_model"
    MODEL="$grok_model"
    gw_notice "Routing through xAI (Anthropic-compatible) as ${grok_model} @ ${ANTHROPIC_BASE_URL}"
    ;;

  glm)  # NATIVE — Z.AI's Anthropic-compatible API (Claude Code → api.z.ai)
    if [ -z "${GLM_API_KEY:-${ZAI_API_KEY:-}}" ]; then
      echo "::error::gateway.provider=glm requires GLM_API_KEY (or ZAI_API_KEY) but it is not set" >&2
      exit 1
    fi
    export ANTHROPIC_API_KEY="${GLM_API_KEY:-$ZAI_API_KEY}"
    export ANTHROPIC_BASE_URL="${ZAI_ANTHROPIC_BASE_URL:-https://api.z.ai/api/anthropic}"
    unset CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_AUTH_TOKEN
    export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
    # Reasoning effort: the GLM-5.x models are forced-thinking; depth is the
    # reasoning_effort dial (low/high/max). Claude Code only sends
    # effort for Claude model ids it recognizes, so ALWAYS_ENABLE forces it through
    # for glm-* ids. Verified honored on api.z.ai/api/anthropic 2026-08-31 (think
    # chars low 2.4k < high 15.3k < max 32.7k on a fixed hard prompt). Without a
    # param the endpoint leaves depth model-decided, so pin it: GLM_REASONING_EFFORT
    # repo var overrides (low|high|max); default high.
    export CLAUDE_CODE_EFFORT_LEVEL="${GLM_REASONING_EFFORT:-high}"
    export CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1
    # Tiered mapping: the run's resolved model id picks the GLM id. With no repo
    # vars set, opus and sonnet tiers run glm-5.3 and the haiku tier (the scorer,
    # haiku-pinned skills) runs the cheaper glm-5.3-flash. Per-tier var wins over
    # GLM_MODEL (same precedence as the OpenRouter arm); GLM_MODEL still pins
    # every tier when set alone.
    case "${MODEL:-}" in
      *opus*)  glm_model="${GLM_MODEL_OPUS:-${GLM_MODEL:-glm-5.3}}" ;;
      *haiku*) glm_model="${GLM_MODEL_HAIKU:-${GLM_MODEL:-glm-5.3-flash}}" ;;
      *)       glm_model="${GLM_MODEL_SONNET:-${GLM_MODEL:-glm-5.3}}" ;;
    esac
    export ANTHROPIC_DEFAULT_OPUS_MODEL="$glm_model"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$glm_model"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$glm_model"
    MODEL="$glm_model"
    gw_notice "Routing through Z.AI (Anthropic-compatible) as ${glm_model} @ ${ANTHROPIC_BASE_URL}"
    ;;

  surplus)  # SIDECAR — OpenAI-compatible (dot-form ids); carries the full catalog
    require_secret SURPLUS_API_KEY
    # The sidecar pins ONE model across every ccr slot, so derive it from aeon's
    # resolved $MODEL (the UI / aeon.yml choice) instead of hardcoding one. Surplus
    # uses dot-form ids: drop any trailing -YYYYMMDD date, then convert each
    # <digit>-<digit> to <digit>.<digit> (claude-opus-5-5 -> claude-opus-5.5).
    # SURPLUS_MODEL overrides; opus-5.5 is the fallback when $MODEL is unset.
    # Surplus served claude-opus-5.5 and claude-sonnet-5.5 on 2026-10-01
    # (/api/inference/v1/models).
    surplus_model="${SURPLUS_MODEL:-$(printf '%s' "${MODEL:-claude-opus-5-5}" | sed -E 's/-[0-9]{8}$//; s/([0-9])-([0-9])/\1.\2/g')}"
    start_ccr_sidecar surplus \
      "https://www.surplusintelligence.ai/api/inference/v1/chat/completions" \
      "$SURPLUS_API_KEY" "$surplus_model"
    gw_notice "Routing through Surplus via claude-code-router (${surplus_model})"
    ;;

  venice)  # SIDECAR - OpenAI-compatible (dash-form ids); carries Opus 5.5, no haiku
    require_secret VENICE_API_KEY
    # VENICE_CLEANCACHE=1 used to add ccr 2.x's cleancache transformer; on ccr
    # 3.x it is a no-op (cache_control never reaches the upstream).
    # The sidecar pins ONE model, so track aeon's $MODEL. Venice names models with
    # aeon's own dash-form ids, so the picker's ids pass straight through (date
    # suffix stripped) when Venice carries them. It carries NO haiku at all, so
    # haiku, and anything else off-catalog, falls back to sonnet-5-5 rather than
    # 404ing on a model Venice never had. VENICE_MODEL overrides.
    # Allowlist verified against api.venice.ai/api/v1/models on 2026-10-01.
    # VENICE_BASE_URL (repo variable) points the sidecar at any Venice-compatible
    # endpoint — a self-hosted relay, a billing proxy, a regional mirror — same
    # override pattern as VENICE_MODEL. Defaults to Venice's public API.
    venice_model="${VENICE_MODEL:-}"
    if [ -z "$venice_model" ]; then
      m="$(printf '%s' "${MODEL:-}" | sed -E 's/-[0-9]{8}$//')"
      case "$m" in
        claude-opus-5-5|claude-sonnet-5-5|claude-opus-4-8|claude-sonnet-5) venice_model="$m" ;;
        *) venice_model="claude-sonnet-5-5" ;;
      esac
    fi
    start_ccr_sidecar venice \
      "${VENICE_BASE_URL:-https://api.venice.ai/api/v1/chat/completions}" \
      "$VENICE_API_KEY" "$venice_model" "${VENICE_CLEANCACHE:+cleancache}"
    gw_notice "Routing through Venice via claude-code-router (${venice_model} @ ${VENICE_BASE_URL:-https://api.venice.ai/api/v1/chat/completions})"
    ;;

  hivemindos)  # SIDECAR — HivemindOS Models: OpenAI-compatible, billed to a credit balance
    # No provider account of your own: the credit token IS the credential, and
    # every call is deducted from that balance. The endpoint refuses a paid
    # request it cannot safely retry, so the hivemindos transformer gives
    # each one a fresh key and sends it non-streamed (scripts/ccr-hivemindos.js,
    # applied by the ccr-aeon-gateway.mjs plugin); ccr replays the JSON answer
    # as the SSE frames Claude Code expects.
    #
    # The catalog is addressed by its own ids (vendor/model, e.g.
    # anthropic/claude-sonnet-5.5), so aeon's native claude-*/grok-* ids mean
    # nothing here and fall back to the default below. HIVEMINDOS_MODEL pins one;
    # HIVEMINDOS_BASE_URL points at another deployment (same override pattern as
    # VENICE_BASE_URL).
    #
    # The default is picked from what the endpoint actually serves, not from a
    # familiar name: of its ids that support tools AND price a cached read,
    # ling-3.0-flash is the cheapest per agent turn and the quickest to answer
    # (measured 2026-09-21 through this arm: 1.5s warm, 6,720 tokens read back
    # from cache, 0.00003 USD for a turn that costs 0.0017 on a model that does
    # not cache). hivemindos/auto, or any catalog id, is one variable away.
    require_secret HIVEMINDOS_CREDIT_TOKEN
    hivemindos_model="${HIVEMINDOS_MODEL:-${MODEL:-$HIVEMINDOS_DEFAULT_MODEL}}"
    case "$hivemindos_model" in claude-*|grok-*|"") hivemindos_model="$HIVEMINDOS_DEFAULT_MODEL" ;; esac
    start_ccr_sidecar hivemindos \
      "${HIVEMINDOS_BASE_URL:-https://hivemindos-paid-agent-gateway.hivemindos.workers.dev/api/paid-agents/default}/chat/completions" \
      "$HIVEMINDOS_CREDIT_TOKEN" "$hivemindos_model" "hivemindos"
    gw_notice "Routing through HivemindOS Models via claude-code-router (${hivemindos_model})"
    ;;

  direct|"")  # NATIVE — Anthropic API or an Anthropic-compatible endpoint
    if [ -n "${ANTHROPIC_BASE_URL:-}" ]; then
      gw_notice "Using Anthropic-compatible API at ${ANTHROPIC_BASE_URL}"
    else
      gw_notice "Using direct Anthropic API"
    fi
    ;;

  *)
    echo "::error::unknown gateway.provider '${GATEWAY}'" >&2
    exit 1
    ;;
esac

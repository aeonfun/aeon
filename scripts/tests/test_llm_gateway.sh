#!/usr/bin/env bash
# Tests for the glm and hivemindos arms of scripts/llm-gateway.sh.
# The shim is SOURCED by the workflow, so these tests source it too. Each case
# runs in a subshell so exported CLAUDE_CODE_* / ANTHROPIC_* vars don't leak.
# Run: bash scripts/tests/test_llm_gateway.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
GW="scripts/llm-gateway.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

# The glm arm requires a key and never talks to the network (no sidecar).
glm_src() {
  export GATEWAY=glm GLM_API_KEY=test-key MODEL=claude-sonnet-5
  # shellcheck disable=SC1090
  source "$GW" >/dev/null
}

# 1. Unset GLM_REASONING_EFFORT → default high + ALWAYS_ENABLE.
( unset GLM_REASONING_EFFORT CLAUDE_CODE_EFFORT_LEVEL CLAUDE_CODE_ALWAYS_ENABLE_EFFORT
  glm_src
  [ "${CLAUDE_CODE_EFFORT_LEVEL:-}" = "high" ] \
    && [ "${CLAUDE_CODE_ALWAYS_ENABLE_EFFORT:-}" = "1" ]
) && pass "default → CLAUDE_CODE_EFFORT_LEVEL=high + ALWAYS_ENABLE=1" \
  || bad "default → CLAUDE_CODE_EFFORT_LEVEL=high + ALWAYS_ENABLE=1"

# 2. Empty var uses the :-high default (same as unset).
( export GLM_REASONING_EFFORT=
  glm_src
  [ "${CLAUDE_CODE_EFFORT_LEVEL:-}" = "high" ]
) && pass "empty GLM_REASONING_EFFORT → high" \
  || bad "empty GLM_REASONING_EFFORT → high"

# 3. Repo-var override.
( export GLM_REASONING_EFFORT=max
  glm_src
  [ "${CLAUDE_CODE_EFFORT_LEVEL:-}" = "max" ] \
    && [ "${CLAUDE_CODE_ALWAYS_ENABLE_EFFORT:-}" = "1" ]
) && pass "GLM_REASONING_EFFORT=max → effort max, still ALWAYS_ENABLE" \
  || bad "GLM_REASONING_EFFORT=max → effort max, still ALWAYS_ENABLE"

# 4. low override.
( export GLM_REASONING_EFFORT=low
  glm_src
  [ "${CLAUDE_CODE_EFFORT_LEVEL:-}" = "low" ]
) && pass "GLM_REASONING_EFFORT=low → effort low" \
  || bad "GLM_REASONING_EFFORT=low → effort low"

# 5. ZAI_API_KEY alias is enough (no GLM_API_KEY).
( unset GLM_API_KEY
  export GATEWAY=glm ZAI_API_KEY=test-zai MODEL=claude-sonnet-5
  # shellcheck disable=SC1090
  source "$GW" >/dev/null
  [ "${CLAUDE_CODE_EFFORT_LEVEL:-}" = "high" ]
) && pass "ZAI_API_KEY alias → glm arm still pins effort" \
  || bad "ZAI_API_KEY alias → glm arm still pins effort"

# 6. Sourcing under bash -e (Actions default) does not abort the caller.
( set -e
  unset GLM_REASONING_EFFORT
  glm_src
  echo "still-running" >/dev/null
) && pass "sourcing under bash -e does not abort caller" \
  || bad "sourcing under bash -e does not abort caller"

# --- hivemindos arm --------------------------------------------------------
# A sidecar arm, so AEON_GATEWAY_DRY_RUN stands in for ccr: it prints the
# sidecar line these cases assert on and never touches the network.
hm_src() {
  export AEON_GATEWAY_DRY_RUN=1 GATEWAY=hivemindos
  # shellcheck disable=SC1090
  source "$GW" 2>/dev/null | grep '^ccr-sidecar '
}

# 7. The credit token is the credential; without it the arm refuses.
( export AEON_GATEWAY_DRY_RUN=1 GATEWAY=hivemindos MODEL=claude-sonnet-5
  unset HIVEMINDOS_CREDIT_TOKEN
  # shellcheck disable=SC1090
  source "$GW" >/dev/null 2>&1
) && bad "no HIVEMINDOS_CREDIT_TOKEN → refuse" \
  || pass "no HIVEMINDOS_CREDIT_TOKEN → refuse"

# 8. Defaults: the public endpoint, hivemindos/auto, and a per-request key.
( export HIVEMINDOS_CREDIT_TOKEN=test-token MODEL=claude-sonnet-5
  unset HIVEMINDOS_MODEL HIVEMINDOS_BASE_URL
  line="$(hm_src)"
  case "$line" in
    *"url=https://hivemindos-paid-agent-gateway.hivemindos.workers.dev/api/paid-agents/default/chat/completions"*\
) ;; *) exit 1 ;;
  esac
  case "$line" in *"model=inclusionai/ling-3.0-flash"*) ;; *) exit 1 ;; esac
  case "$line" in *'"hivemindos"'*) ;; *) exit 1 ;; esac
) && pass "defaults → public endpoint, ling-3.0-flash, hivemindos transformer" \
  || bad "defaults → public endpoint, ling-3.0-flash, hivemindos transformer"

# 9. A catalog id passes straight through; an aeon-native id does not (it names
#    no HivemindOS model, so it would 404 the run).
( export HIVEMINDOS_CREDIT_TOKEN=test-token MODEL=anthropic/claude-sonnet-5
  unset HIVEMINDOS_MODEL
  case "$(hm_src)" in *"model=anthropic/claude-sonnet-5"*) ;; *) exit 1 ;; esac
) && pass "catalog id passes through" || bad "catalog id passes through"

( export HIVEMINDOS_CREDIT_TOKEN=test-token MODEL=claude-opus-4-8
  unset HIVEMINDOS_MODEL
  case "$(hm_src)" in *"model=inclusionai/ling-3.0-flash"*) ;; *) exit 1 ;; esac
) && pass "aeon-native id → the default model" || bad "aeon-native id → the default model"

# 10. Repo variables override both.
( export HIVEMINDOS_CREDIT_TOKEN=test-token MODEL=claude-sonnet-5 \
    HIVEMINDOS_MODEL=openai/gpt-5-mini HIVEMINDOS_BASE_URL=https://example.test/api/paid-agents/mine
  line="$(hm_src)"
  case "$line" in *"model=openai/gpt-5-mini"*) ;; *) exit 1 ;; esac
  case "$line" in *"url=https://example.test/api/paid-agents/mine/chat/completions"*) ;; *) exit 1 ;; esac
) && pass "HIVEMINDOS_MODEL / HIVEMINDOS_BASE_URL override" \
  || bad "HIVEMINDOS_MODEL / HIVEMINDOS_BASE_URL override"

# 11. gateway=auto picks it up when the credit token is the only credential set.
( export AEON_GATEWAY_DRY_RUN=1 GATEWAY=auto AEON_LIST_CANDIDATES=1 HIVEMINDOS_CREDIT_TOKEN=test-token
  unset CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_API_KEY OPENROUTER_API_KEY BANKR_LLM_KEY USEPOD_TOKEN VENICE_API_KEY SURPLUS_API_KEY XAI_API_KEY GLM_API_KEY ZAI_API_KEY
  [ "$(bash "$GW")" = "hivemindos" ]
) && pass "gateway=auto resolves to hivemindos on the credit token alone" \
  || bad "gateway=auto resolves to hivemindos on the credit token alone"

echo
if [ "$fail" -eq 0 ]; then echo "All llm-gateway tests passed."; else echo "Some tests FAILED."; fi
exit "$fail"

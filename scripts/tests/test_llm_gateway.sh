#!/usr/bin/env bash
# Tests for the glm, openrouter, grok, surplus, venice and hivemindos arms of scripts/llm-gateway.sh.
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

# 7. Tiered GLM ids: opus/sonnet run glm-5.3, haiku (scorer) runs glm-5.3-flash.
glm_tier() {  # $1 = run model id; prints the GLM id the arm resolves
  ( unset GLM_MODEL GLM_MODEL_OPUS GLM_MODEL_SONNET GLM_MODEL_HAIKU
    export GATEWAY=glm GLM_API_KEY=test-key MODEL="$1"
    # shellcheck disable=SC1090
    source "$GW" >/dev/null
    printf '%s' "$MODEL" )
}
[ "$(glm_tier claude-opus-5-5)" = "glm-5.3" ] \
  && pass "glm: opus tier → glm-5.3" || bad "glm: opus tier → glm-5.3 (got $(glm_tier claude-opus-5-5))"
[ "$(glm_tier claude-sonnet-5-5)" = "glm-5.3" ] \
  && pass "glm: sonnet tier → glm-5.3" || bad "glm: sonnet tier → glm-5.3 (got $(glm_tier claude-sonnet-5-5))"
[ "$(glm_tier claude-haiku-4-5-20251001)" = "glm-5.3-flash" ] \
  && pass "glm: haiku tier → glm-5.3-flash" || bad "glm: haiku tier → glm-5.3-flash (got $(glm_tier claude-haiku-4-5-20251001))"
( export GATEWAY=glm GLM_API_KEY=test-key MODEL=claude-haiku-4-5-20251001 GLM_MODEL=glm-x
  unset GLM_MODEL_HAIKU
  # shellcheck disable=SC1090
  source "$GW" >/dev/null
  [ "$MODEL" = "glm-x" ]
) && pass "glm: GLM_MODEL alone pins every tier" || bad "glm: GLM_MODEL alone pins every tier"

# --- surplus + venice arms (sidecar; AEON_GATEWAY_DRY_RUN stands in for ccr) --
sidecar_model() {  # $1 = gateway, $2 = run model id ("" = unset); prints model=
  ( unset SURPLUS_MODEL VENICE_MODEL MODEL
    export AEON_GATEWAY_DRY_RUN=1 GATEWAY="$1" SURPLUS_API_KEY=test-key VENICE_API_KEY=test-key
    [ -n "$2" ] && export MODEL="$2"
    # shellcheck disable=SC1090
    source "$GW" 2>/dev/null | sed -n 's/^ccr-sidecar .*model=\([^ ]*\).*/\1/p' )
}
[ "$(sidecar_model surplus claude-opus-5-5)" = "claude-opus-5.5" ] \
  && pass "surplus: claude-opus-5-5 → dot-form claude-opus-5.5" \
  || bad "surplus: claude-opus-5-5 → dot-form claude-opus-5.5 (got $(sidecar_model surplus claude-opus-5-5))"
[ "$(sidecar_model surplus claude-haiku-4-5-20251001)" = "claude-haiku-4.5" ] \
  && pass "surplus: date suffix stripped, then dot-form" \
  || bad "surplus: date suffix stripped, then dot-form (got $(sidecar_model surplus claude-haiku-4-5-20251001))"
[ "$(sidecar_model surplus "")" = "claude-opus-5.5" ] \
  && pass "surplus: unset MODEL falls back to opus-5.5" \
  || bad "surplus: unset MODEL falls back to opus-5.5 (got $(sidecar_model surplus ""))"
[ "$(sidecar_model venice claude-opus-5-5)" = "claude-opus-5-5" ] \
  && pass "venice: claude-opus-5-5 passes through" \
  || bad "venice: claude-opus-5-5 passes through (got $(sidecar_model venice claude-opus-5-5))"
[ "$(sidecar_model venice claude-haiku-4-5-20251001)" = "claude-sonnet-5-5" ] \
  && pass "venice: haiku (not carried) falls back to sonnet-5-5" \
  || bad "venice: haiku (not carried) falls back to sonnet-5-5 (got $(sidecar_model venice claude-haiku-4-5-20251001))"

# --- openrouter arm --------------------------------------------------------
# Native arm, no sidecar: the run's resolved model id picks the slot by tier.
or_model() {  # $1 = run model id; prints the MODEL the arm resolves
  ( unset OPENROUTER_MODEL OPENROUTER_MODEL_SONNET OPENROUTER_MODEL_HAIKU
    export GATEWAY=openrouter OPENROUTER_API_KEY=test-key MODEL="$1"
    # shellcheck disable=SC1090
    source "$GW" >/dev/null
    printf '%s' "$MODEL" )
}
[ "$(or_model claude-sonnet-5-5)" = "anthropic/claude-sonnet-5.5" ] \
  && pass "openrouter: sonnet-tier run stays on the sonnet slug" \
  || bad "openrouter: sonnet-tier run stays on the sonnet slug (got $(or_model claude-sonnet-5-5))"
[ "$(or_model claude-sonnet-5)" = "anthropic/claude-sonnet-5.5" ] \
  && pass "openrouter: an older sonnet id still lands on the sonnet slot" \
  || bad "openrouter: an older sonnet id still lands on the sonnet slot (got $(or_model claude-sonnet-5))"
[ "$(or_model claude-opus-5-5)" = "anthropic/claude-opus-5.5" ] \
  && pass "openrouter: opus-pinned run gets the opus slug" \
  || bad "openrouter: opus-pinned run gets the opus slug (got $(or_model claude-opus-5-5))"
[ "$(or_model claude-haiku-4-5-20251001)" = "anthropic/claude-haiku-4.5" ] \
  && pass "openrouter: haiku-tier run gets the haiku slug" \
  || bad "openrouter: haiku-tier run gets the haiku slug"
( export GATEWAY=openrouter OPENROUTER_API_KEY=test-key MODEL=claude-sonnet-5 \
    OPENROUTER_MODEL=x/opus OPENROUTER_MODEL_SONNET=x/sonnet
  # shellcheck disable=SC1090
  source "$GW" >/dev/null
  [ "$MODEL" = "x/sonnet" ] && [ "$ANTHROPIC_DEFAULT_OPUS_MODEL" = "x/opus" ]
) && pass "openrouter: per-tier repo vars override the slugs" \
  || bad "openrouter: per-tier repo vars override the slugs"

# --- grok arm ---------------------------------------------------------------
# Native arm, no sidecar: every slot is pinned to one grok model, GROK_MODEL wins.
grok_model() {  # $1 = GROK_MODEL value ("" = unset); prints the MODEL the arm resolves
  ( unset GROK_MODEL
    [ -n "$1" ] && export GROK_MODEL="$1"
    export GATEWAY=grok XAI_API_KEY=test-key MODEL=claude-opus-5-5
    # shellcheck disable=SC1090
    source "$GW" >/dev/null
    printf '%s|%s|%s' "$MODEL" "$ANTHROPIC_DEFAULT_OPUS_MODEL" "$ANTHROPIC_DEFAULT_HAIKU_MODEL" )
}
[ "$(grok_model "")" = "grok-4.7|grok-4.7|grok-4.7" ] \
  && pass "grok: unset GROK_MODEL pins every slot to the default" \
  || bad "grok: unset GROK_MODEL pins every slot to the default (got $(grok_model ""))"
[ "$(grok_model grok-build-0.1)" = "grok-build-0.1|grok-build-0.1|grok-build-0.1" ] \
  && pass "grok: GROK_MODEL repo var overrides every slot" \
  || bad "grok: GROK_MODEL repo var overrides every slot (got $(grok_model grok-build-0.1))"

# Every workflow step that hands the gateway its model repo vars must hand it
# GROK_MODEL too, or the documented var silently never reaches the grok arm.
python3 - <<'PY' && pass "workflows: GROK_MODEL wired wherever the gateway model vars are" \
  || bad "workflows: GROK_MODEL wired wherever the gateway model vars are"
import sys, yaml
missing = []
for wf in (".github/workflows/aeon.yml", ".github/workflows/messages.yml"):
    doc = yaml.safe_load(open(wf, encoding="utf-8"))
    for job_name, job in (doc.get("jobs") or {}).items():
        for step in job.get("steps") or []:
            env = step.get("env") or {}
            if "GLM_MODEL" in env and env.get("GROK_MODEL") != "${{ vars.GROK_MODEL }}":
                missing.append(f"{wf}:{job_name}/{step.get('name', '?')}")
if missing:
    print("missing GROK_MODEL:", *missing, sep="\n  ", file=sys.stderr)
    sys.exit(1)
PY

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

# Route notice: an annotation on the Run step, a plain log line when a post-run step
# re-sources the gateway with AEON_GATEWAY_QUIET=1 (no duplicate run annotation).
# shellcheck disable=SC1090
out=$( export GATEWAY=claude CLAUDE_CODE_OAUTH_TOKEN=tok; source "$GW" )
echo "$out" | grep -q '^::notice::Using Claude Code subscription' \
  && pass "route notice is an annotation by default" \
  || bad "route notice is an annotation by default (got: $out)"
# shellcheck disable=SC1090
out=$( export GATEWAY=claude CLAUDE_CODE_OAUTH_TOKEN=tok AEON_GATEWAY_QUIET=1; source "$GW" )
{ echo "$out" | grep -q '^gateway: Using Claude Code subscription' && ! echo "$out" | grep -q '::notice::'; } \
  && pass "AEON_GATEWAY_QUIET=1 logs the route without an annotation" \
  || bad "AEON_GATEWAY_QUIET=1 logs the route without an annotation (got: $out)"
# shellcheck disable=SC1090
out=$( export GATEWAY=claude AEON_GATEWAY_QUIET=1; unset CLAUDE_CODE_OAUTH_TOKEN; source "$GW" 2>&1 )
echo "$out" | grep -q '^::error::' \
  && pass "AEON_GATEWAY_QUIET=1 never quiets errors" \
  || bad "AEON_GATEWAY_QUIET=1 never quiets errors (got: $out)"

echo
if [ "$fail" -eq 0 ]; then echo "All llm-gateway tests passed."; else echo "Some tests FAILED."; fi
exit "$fail"

#!/usr/bin/env bash
# Tests for scripts/resolve-harness.sh — the shared harness/provider/model
# decision used by BOTH aeon.yml and messages.yml.
#
# This logic was ~100 lines inside one workflow step, so it had never been tested:
# the only way to exercise it was to dispatch a real run. That is also why
# messages.yml carried a second, weaker copy that only knew claude and grok.
#
# Run: bash scripts/tests/test_resolve_harness.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
R="$ROOT/scripts/resolve-harness.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

WS="$(mktemp -d)"
cleanup() { rm -rf "$WS"; }
trap cleanup EXIT
cd "$WS" || exit 1

# A fixture aeon.yml in aeon's REAL shape: repo-global keys at column 0, and a
# skills map whose entries are inline flow-mappings on ONE line, two spaces in —
#   dash-name: { enabled: false, schedule: "...", harness: "vibe" }
# Block-style entries (header line, flow map on the following lines) are covered
# separately in section 5b: the per-skill read now goes through
# scripts/skill_entry.sh, which captures the whole entry, not just the header.
mkfixture() {  # mkfixture [global-harness] [global-model]
  { echo "model: ${2:-claude-sonnet-5-5}"
    [ -n "${1:-}" ] && echo "harness: $1"
    echo "skills:"
    echo '  daily-brief: { enabled: true, schedule: "0 9 * * *" }'
    echo '  odd-one: { enabled: true, harness: "vibe", model: "openai/gpt-5-mini" }'
  } > aeon.yml
}

# get KEY from a resolve run: `get <key> [skill] [env assignments...]`
get() {
  local key="$1" skill="${2:-}"; shift 2 || shift $#
  env "$@" bash "$R" "$skill" 2>/dev/null | sed -n "s/^${key}=//p"
}

# --- 1. defaults ------------------------------------------------------------
mkfixture
[ "$(get HARNESS)" = "claude" ] \
  && pass "no harness: key → claude" || bad "default harness (got '$(get HARNESS)')"

# A repo with NO `harness:` line at all must not die on grep's exit 1. Under the
# runner's `set -e` an unguarded grep kills the step with no message at all.
if bash "$R" >/dev/null 2>&1; then
  pass "missing harness: key does not abort (grep guarded)"
else
  bad "missing harness: key aborted the script"
fi

# --- 2. resolution precedence ----------------------------------------------
mkfixture codex
[ "$(get HARNESS)" = "codex" ] && pass "global harness: honoured" || bad "global harness"
[ "$(get HARNESS odd-one)" = "vibe" ] \
  && pass "per-skill harness: overrides global" || bad "per-skill harness override"
[ "$(get HARNESS odd-one INPUT_HARNESS=kimi)" = "kimi" ] \
  && pass "INPUT_HARNESS (dispatch) beats per-skill" || bad "INPUT_HARNESS precedence"
# The dropdown's placeholder must NOT be taken as a harness name.
[ "$(get HARNESS "" "INPUT_HARNESS=(config default)")" = "codex" ] \
  && pass "'(config default)' placeholder treated as unset" || bad "placeholder handling"
# Unknown value falls back to claude rather than reaching an install with no recipe.
[ "$(get HARNESS "" INPUT_HARNESS=banana)" = "claude" ] \
  && pass "unknown harness → claude" || bad "unknown harness fallback"
bash "$R" "" 2>&1 >/dev/null <<<"" | grep -q "::warning::unknown harness" \
  || true   # only meaningful with INPUT_HARNESS set; asserted below
W=$(INPUT_HARNESS=banana bash "$R" 2>&1 >/dev/null)
case "$W" in *"::warning::unknown harness"*) pass "unknown harness warns on stderr" ;;
  *) bad "unknown harness should warn (got: $W)" ;; esac

# --- 3. AUTH_MODE detection -------------------------------------------------
mkfixture codex
[ "$(get AUTH_MODE)" = "openrouter" ] \
  && pass "no native secret → openrouter" || bad "default AUTH_MODE"
[ "$(get AUTH_MODE "" CODEX_AUTH=xx)" = "native-oauth" ] \
  && pass "codex: CODEX_AUTH → native-oauth" || bad "codex native-oauth"
[ "$(get AUTH_MODE "" OPENAI_API_KEY=xx)" = "native-key" ] \
  && pass "codex: OPENAI_API_KEY → native-key" || bad "codex native-key"
# OAuth capture wins over the raw key — the same order install-harness.sh applies.
[ "$(get AUTH_MODE "" CODEX_AUTH=xx OPENAI_API_KEY=yy)" = "native-oauth" ] \
  && pass "codex: OAuth capture beats API key" || bad "codex auth precedence"
mkfixture grok
[ "$(get AUTH_MODE "" GROK_CREDENTIALS=xx)" = "native-oauth" ] \
  && pass "grok: GROK_CREDENTIALS → native-oauth" || bad "grok native-oauth"
[ "$(get AUTH_MODE "" XAI_API_KEY=xx)" = "native-key" ] \
  && pass "grok: XAI_API_KEY → native-key" || bad "grok native-key"
mkfixture hermes
[ "$(get AUTH_MODE "" HERMES_AUTH=xx)" = "native-oauth" ] \
  && pass "hermes: HERMES_AUTH → native-oauth" || bad "hermes native-oauth"
mkfixture cursor
[ "$(get AUTH_MODE "" CURSOR_API_KEY=xx)" = "native-key" ] \
  && pass "cursor: CURSOR_API_KEY → native-key" || bad "cursor native-key"
mkfixture glm
[ "$(get HARNESS)" = "claude" ] \
  && pass "glm: dead harness name → claude" || bad "glm dead name (got '$(get HARNESS)')"
mkfixture cursor
[ "$(get MODEL_ARG "" CURSOR_API_KEY=xx)" = "auto" ] \
  && pass "cursor: native model override forwarded" || bad "cursor model forwarding"
mkfixture hermes
[ "$(get MODEL_ARG "" HERMES_AUTH=xx)" = "default" ] \
  && pass "hermes: Portal model override forwarded" || bad "hermes model forwarding"
mkfixture fx
[ "$(get HARNESS)" = "fx" ] && pass "fx: reaches the allowlist" || bad "fx allowlist"
[ "$(get AUTH_MODE "" AI_GATEWAY_API_KEY=xx)" = "native-key" ] \
  && pass "fx: AI_GATEWAY_API_KEY → native-key" || bad "fx native-key (gateway)"
[ "$(get AUTH_MODE "" VERCEL_OIDC_TOKEN=xx)" = "native-key" ] \
  && pass "fx: VERCEL_OIDC_TOKEN → native-key" || bad "fx native-key (oidc)"

# --- 4. MODEL_ARG per harness ----------------------------------------------
# The whole point of MODEL_ARG: each CLI wants a different shape, and two want
# nothing at all. Passing a raw id to vibe/kimi breaks them (they resolve an ALIAS
# declared in the staged config), so empty is the correct answer, not a fallback.
mkfixture codex
[ "$(get MODEL_ARG)" = "openai/gpt-6-luna" ] \
  && pass "codex: MODEL_ARG is a bare OpenRouter id" || bad "codex MODEL_ARG"
mkfixture pi
[ "$(get MODEL_ARG)" = "openrouter/deepseek/deepseek-v4-flash" ] \
  && pass "pi: MODEL_ARG carries the openrouter/ prefix" || bad "pi MODEL_ARG (got '$(get MODEL_ARG)')"
for h in vibe kimi; do
  mkfixture "$h"
  [ -z "$(get MODEL_ARG)" ] \
    && pass "$h: MODEL_ARG empty (config alias decides)" || bad "$h MODEL_ARG must be empty"
done
# Native auth → forward NO model; the harness uses its own account default. A
# forwarded OpenRouter id here would be the wrong provider entirely.
mkfixture codex
[ -z "$(get MODEL_ARG "" CODEX_AUTH=xx)" ] \
  && pass "native auth → no --model forwarded" || bad "native auth MODEL_ARG"
case "$(get HARNESS_MODEL "" CODEX_AUTH=xx)" in
  "(native:native-oauth)") pass "native auth labels the model as native" ;;
  *) bad "native auth HARNESS_MODEL label" ;;
esac
LINE=$(CODEX_AUTH=xx bash "$R" "" 2>&1 >/dev/null | grep '^Harness:')
case "$LINE" in
  *"model: account default (logged after the run)"*) pass "native codex line says the account picks the model" ;;
  *) bad "native codex line (got: $LINE)" ;;
esac
# An explicit OpenAI pick on a native codex login IS forwarded, as a bare id
# (the picker controls the run; codex.sh retries on the account default if the
# account refuses it). Applies to the config model and a dispatch model alike.
mkfixture codex openai/gpt-6-sol
[ "$(get MODEL_ARG "" CODEX_AUTH=xx)" = "gpt-6-sol" ] \
  && pass "native codex: picked openai/* model forwarded as a bare id" || bad "native codex pick (got '$(get MODEL_ARG "" CODEX_AUTH=xx)')"
[ "$(get HARNESS_MODEL "" CODEX_AUTH=xx)" = "gpt-6-sol" ] \
  && pass "native codex: HARNESS_MODEL names the picked model" || bad "native codex HARNESS_MODEL"
[ "$(get MODEL_ARG "" OPENAI_API_KEY=xx INPUT_MODEL=openai/gpt-6.1-sol)" = "gpt-6.1-sol" ] \
  && pass "native codex: dispatch model beats config" || bad "native codex dispatch pick"
mkfixture vibe openai/gpt-6-sol
[ -z "$(get MODEL_ARG "" MISTRAL_API_KEY=xx)" ] \
  && pass "native vibe: still no --model" || bad "native vibe must not forward"
# A per-skill claude pin is skipped on a non-claude harness: the config's
# codex pick applies (live: heartbeat pinned to claude-opus-5-5 on aeon-test).
{ echo "model: openai/gpt-6-luna"; echo "harness: codex"; echo "skills:"
  echo '  heartbeat: { enabled: true, model: "claude-opus-5-5" }'
  echo '  pinned: { enabled: true, model: "openai/gpt-6.1-sol" }'; } > aeon.yml
[ "$(get MODEL_ARG heartbeat CODEX_AUTH=xx)" = "gpt-6-luna" ] \
  && pass "claude skill pin skipped: config codex pick applies" || bad "claude pin skip (got '$(get MODEL_ARG heartbeat CODEX_AUTH=xx)')"
[ "$(get MODEL_ARG heartbeat)" = "openai/gpt-6-luna" ] \
  && pass "claude skill pin skipped on openrouter too" || bad "claude pin skip openrouter"
[ "$(get MODEL_ARG pinned CODEX_AUTH=xx)" = "gpt-6.1-sol" ] \
  && pass "an openai skill pin still beats config" || bad "openai skill pin"
[ "$(get MODEL_ARG heartbeat CODEX_AUTH=xx INPUT_MODEL=claude-opus-5-5)" = "gpt-6-luna" ] \
  && pass "claude dispatch model skipped too" || bad "claude dispatch skip"

# --- 5. model precedence ----------------------------------------------------
# An aeon-native id is NOT an OpenRouter id: a repo that never touched the model
# picker still reads `model: claude-sonnet-5-5`, and forwarding that would pin the
# run to a dead id while every downstream record named it.
mkfixture codex claude-sonnet-5-5
[ "$(get MODEL_ARG)" = "openai/gpt-6-luna" ] \
  && pass "claude-* config model ignored → per-harness default" || bad "claude-* model passthrough"
mkfixture codex grok-4.5
[ "$(get MODEL_ARG)" = "openai/gpt-6-luna" ] \
  && pass "grok-* config model ignored → per-harness default" || bad "grok-* model passthrough"
# `default` (the hermes dashboard pick, "Hermes' configured model") is "no
# override" for every harness: codex must not receive --model default.
mkfixture codex default
[ "$(get MODEL_ARG)" = "openai/gpt-6-luna" ] \
  && pass "default config model → per-harness default" || bad "default model passthrough (got '$(get MODEL_ARG)')"
mkfixture hermes default
[ "$(get HARNESS_MODEL "" HERMES_AUTH=xx)" = "default" ] \
  && pass "hermes: default config model stays default" || bad "hermes default model"
mkfixture codex openai/gpt-5
[ "$(get MODEL_ARG)" = "openai/gpt-5" ] \
  && pass "OpenRouter config model is forwarded" || bad "OpenRouter model passthrough"
[ "$(get MODEL_ARG "" HARNESS_MODEL=openai/gpt-5-nano)" = "openai/gpt-5-nano" ] \
  && pass "vars.HARNESS_MODEL wins over the config model" || bad "HARNESS_MODEL precedence"
# odd-one pins harness "vibe", which forwards NO --model (alias-resolved), so the
# per-skill model is observable as HARNESS_MODEL — the id baked into vibe's staged
# config alias — not as MODEL_ARG.
[ "$(get HARNESS_MODEL odd-one)" = "openai/gpt-5-mini" ] \
  && pass "per-skill model reaches HARNESS_MODEL" || bad "per-skill model (got '$(get HARNESS_MODEL odd-one)')"
[ -z "$(get MODEL_ARG odd-one)" ] \
  && pass "per-skill model still not forwarded to vibe" || bad "vibe must not receive --model"

# --- 5b. block-style entries ------------------------------------------------
# aeon.yml's comment documents the block shape for model:; harness:/model: on a
# continuation line used to be invisible here (header-line grep), so the skill
# silently ran on the defaults. Also: a comment is not a value, and a chain of the
# same name further down is not the skill's entry.
{ echo "model: claude-sonnet-5-5"
  echo "skills:"
  echo '  block-one:'
  echo '    { enabled: true, schedule: "0 9 * * *",'
  echo '      harness: "vibe", model: "openai/gpt-5" }'
  echo '  commented: { enabled: true, var: "fix #12" } # harness: "kimi" model: "x/y"'
  echo '  after: { enabled: true, harness: "pi" }'
  echo 'chains:'
  echo '  block-one:'
  echo '    harness: "kimi"'
} > aeon.yml
[ "$(get HARNESS block-one)" = "vibe" ] \
  && pass "block entry: harness on a continuation line is honoured" || bad "block harness (got '$(get HARNESS block-one)')"
[ "$(get HARNESS_MODEL block-one)" = "openai/gpt-5" ] \
  && pass "block entry: model on a continuation line is honoured" || bad "block model (got '$(get HARNESS_MODEL block-one)')"
[ "$(get HARNESS commented)" = "claude" ] \
  && pass "a trailing comment is not read as a per-skill key" || bad "comment leaked (got '$(get HARNESS commented)')"
[ "$(get HARNESS after)" = "pi" ] \
  && pass "single-line entry after a block entry still resolves" || bad "single-line after block (got '$(get HARNESS after)')"

# --- 5c. claude: the resolve line names the auth + model that really run ----
# claude never runs on the OpenRouter-CLI default: its provider is picked by
# scripts/llm-gateway.sh and its model is aeon's own id. The line used to read
# "auth: openrouter | model: openai/gpt-5-mini" on a subscription run.
mkfixture
NOKEYS=(CLAUDE_CODE_OAUTH_TOKEN= ANTHROPIC_API_KEY= OPENROUTER_API_KEY=)
# shellcheck disable=SC2069  # keep only stderr (the human line), on purpose
line() { env "${NOKEYS[@]}" "$@" bash "$R" daily-brief 2>&1 >/dev/null; }
[ "$(get AUTH_MODE daily-brief "${NOKEYS[@]}" CLAUDE_CODE_OAUTH_TOKEN=x)" = "native-oauth" ] \
  && pass "claude + CLAUDE_CODE_OAUTH_TOKEN -> native-oauth" || bad "claude oauth auth (got '$(get AUTH_MODE daily-brief "${NOKEYS[@]}" CLAUDE_CODE_OAUTH_TOKEN=x)')"
[ "$(get AUTH_MODE daily-brief "${NOKEYS[@]}" ANTHROPIC_API_KEY=x)" = "native-key" ] \
  && pass "claude + ANTHROPIC_API_KEY only -> native-key" || bad "claude api-key auth"
[ "$(get AUTH_MODE daily-brief "${NOKEYS[@]}" CLAUDE_CODE_OAUTH_TOKEN=x ANTHROPIC_API_KEY=x)" = "native-oauth" ] \
  && pass "claude: subscription wins over the API key (gateway order)" || bad "claude auth order"
[ "$(get AUTH_MODE daily-brief "${NOKEYS[@]}" OPENROUTER_API_KEY=x)" = "gateway" ] \
  && pass "claude with neither native secret -> gateway" || bad "claude gateway auth"
L=$(line CLAUDE_CODE_OAUTH_TOKEN=x)
case "$L" in
  *"Harness: claude  |  auth: native-oauth  |  gateway: claude  |  model: claude-sonnet-5-5"*) pass "claude line names the subscription and the real model" ;;
  *) bad "claude line (got: $L)" ;;
esac
case "$L" in *openai/*|*"run-harness --model"*) bad "claude line still shows the OpenRouter default / MODEL_ARG" ;; *) pass "claude line drops fields that do not apply" ;; esac
[ "$(get MODEL_ARG daily-brief CLAUDE_CODE_OAUTH_TOKEN=x)" = "" ] \
  && pass "claude MODEL_ARG unchanged (empty)" || bad "claude MODEL_ARG changed"
case "$(line CLAUDE_CODE_OAUTH_TOKEN=x INPUT_MODEL=claude-opus-5-5)" in
  *"model: claude-opus-5-5"*) pass "claude line honours a dispatch model" ;; *) bad "claude dispatch model" ;; esac
mkfixture "" claude-haiku-5
case "$(line ANTHROPIC_API_KEY=x)" in
  *"auth: native-key  |  gateway: anthropic  |  model: claude-haiku-5"*) pass "claude line uses aeon.yml model:" ;; *) bad "claude config model ($(line ANTHROPIC_API_KEY=x))" ;; esac
{ echo "model: claude-sonnet-5-5"; echo "gateway:"; echo "  provider: openrouter"; echo "skills:"; } > aeon.yml
[ "$(get AUTH_MODE "" "${NOKEYS[@]}" CLAUDE_CODE_OAUTH_TOKEN=x)" = "gateway" ] \
  && pass "a pinned gateway.provider wins over a present subscription token" || bad "pinned gateway auth"
{ echo "model: claude-sonnet-5-5"; echo "gateway:"; echo '  provider: "claude"'; echo "skills:"; } > aeon.yml
[ "$(get AUTH_MODE "" "${NOKEYS[@]}")" = "native-oauth" ] \
  && pass "gateway.provider: claude -> native-oauth" || bad "pinned claude auth"

# --- 6. output contract -----------------------------------------------------
# Callers append this straight to $GITHUB_OUTPUT, so stdout must be exactly the
# four KEY=VALUE lines — the human summary belongs on stderr.
mkfixture codex
OUT=$(bash "$R" 2>/dev/null)
[ "$(echo "$OUT" | wc -l | tr -d ' ')" = "4" ] \
  && pass "stdout is exactly 4 KEY=VALUE lines" || bad "stdout line count (got: $OUT)"
echo "$OUT" | grep -qv '^[A-Z_]*=' && bad "stdout carried a non-KEY=VALUE line" \
  || pass "every stdout line is KEY=VALUE"
bash "$R" 2>&1 >/dev/null | grep -q "Harness: codex" \
  && pass "human summary goes to stderr" || bad "summary should be on stderr"

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

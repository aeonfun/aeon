#!/usr/bin/env bash
# Source from the Aeon runner after SKILL_NAME and SKILL_VAR are exported.
# Resolves the capability tier before MCP or skill-secret setup. This file is
# sourced, so it must not change the caller's shell options.

# The selector match itself now lives in scripts/skill_mode.sh
# (is_shadow_selector), the one place every dispatch surface consults - this
# used to keep its own copy of the pattern, which is how
# apps/mcp-server/src/skill-executor.ts missed it entirely and ran shadow
# evaluations at full write access with every ambient credential attached.
SHADOW_MODE=0
if [ "$(bash scripts/skill_mode.sh is-shadow "${SKILL_NAME:-}" "${SKILL_VAR:-}")" = "true" ]; then
  SHADOW_MODE=1
  SKILL_MODE=read-only
  # Fail closed at the capability boundary, before MCP and declared-secret
  # setup. The workflow repeats this unset as defense in depth.
  unset ALL_SECRETS GH_GLOBAL GH_TOKEN GITHUB_TOKEN RESEND_API_KEY RESEND_FROM RESEND_REPLY_TO XAI_API_KEY
  echo "Riva shadow mode: forcing read-only capability tier"
else
  SKILL_MODE=$(bash scripts/skill_mode.sh mode "${SKILL_NAME:-}" "${SKILL_VAR:-}")
fi
ALLOWED=$(bash scripts/skill_mode.sh allowed-tools "$SKILL_MODE")
export SHADOW_MODE SKILL_MODE ALLOWED
echo "SKILL_MODE=$SKILL_MODE" >> "${GITHUB_ENV:-/dev/null}"
echo "Capability mode: $SKILL_MODE"

#!/usr/bin/env bash
# Tests for scripts/langfuse-otel.sh. Run: bash scripts/tests/test_langfuse_otel.sh
#
# The shim is SOURCED by the workflow, so these tests source it too — each case
# in a subshell (parentheses) so exported OTEL_* vars don't leak between cases.
set -uo pipefail
# shellcheck disable=SC1090  # LF is a fixed path; dynamic-source is intentional here.
cd "$(dirname "$0")/../.." || exit 1
LF="scripts/langfuse-otel.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

# Guarantee a clean slate for the vars we assert on (inherited env would lie).
unset LANGFUSE_PUBLIC_KEY LANGFUSE_SECRET_KEY LANGFUSE_HOST LANGFUSE_BASE_URL \
      LANGFUSE_TRACING LANGFUSE_LOG_CONTENT AEON_OTEL_COMPONENT SKILL_NAME \
      CLAUDE_CODE_ENABLE_TELEMETRY OTEL_TRACES_EXPORTER OTEL_EXPORTER_OTLP_ENDPOINT \
      OTEL_EXPORTER_OTLP_HEADERS OTEL_LOG_USER_PROMPTS OTEL_LOG_TOOL_CONTENT \
      OTEL_RESOURCE_ATTRIBUTES 2>/dev/null || true

# 1. No keys → complete no-op (nothing exported), and returns success under -e.
( set -e
  source "$LF" 2>/dev/null
  [ -z "${CLAUDE_CODE_ENABLE_TELEMETRY:-}" ] && [ -z "${OTEL_TRACES_EXPORTER:-}" ]
) && pass "no keys → no-op, no OTEL vars exported" || bad "no keys → no-op, no OTEL vars exported"

# 2. Only one key → still a no-op (both are required).
( set -e
  export LANGFUSE_PUBLIC_KEY=pk-lf-x
  source "$LF" 2>/dev/null
  [ -z "${CLAUDE_CODE_ENABLE_TELEMETRY:-}" ]
) && pass "one key only → no-op" || bad "one key only → no-op"

# 3. Both keys → telemetry + traces exporter turned on.
( export LANGFUSE_PUBLIC_KEY=pk-lf-abc LANGFUSE_SECRET_KEY=sk-lf-def
  source "$LF" 2>/dev/null
  [ "${CLAUDE_CODE_ENABLE_TELEMETRY:-}" = "1" ] \
    && [ "${CLAUDE_CODE_ENHANCED_TELEMETRY_BETA:-}" = "1" ] \
    && [ "${OTEL_TRACES_EXPORTER:-}" = "otlp" ]
) && pass "both keys → tracing enabled" || bad "both keys → tracing enabled"

# 4. Endpoint defaults to EU cloud and targets the OTLP path.
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk
  source "$LF" 2>/dev/null
  [ "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" = "https://cloud.langfuse.com/api/public/otel" ]
) && pass "default host → EU cloud OTLP endpoint" || bad "default host → EU cloud OTLP endpoint"

# 5. LANGFUSE_HOST override + trailing slash stripped; protocol is HTTP (no gRPC).
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk LANGFUSE_HOST=https://us.cloud.langfuse.com/
  source "$LF" 2>/dev/null
  [ "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" = "https://us.cloud.langfuse.com/api/public/otel" ] \
    && [ "${OTEL_EXPORTER_OTLP_PROTOCOL:-}" = "http/protobuf" ]
) && pass "host override + slash strip + http protocol" || bad "host override + slash strip + http protocol"

# 6. Auth header is Basic <base64(public:secret)> — verify the encoding.
( export LANGFUSE_PUBLIC_KEY=pk-lf-1 LANGFUSE_SECRET_KEY=sk-lf-2
  source "$LF" 2>/dev/null
  want=$(printf '%s:%s' pk-lf-1 sk-lf-2 | base64 | tr -d '\n')
  case "${OTEL_EXPORTER_OTLP_HEADERS:-}" in
    "Authorization=Basic ${want},x-langfuse-ingestion-version=4") exit 0 ;;
    *) exit 1 ;;
  esac
) && pass "Basic auth header encodes public:secret" || bad "Basic auth header encodes public:secret"

# 7. Content ON by default → prompts/responses captured, tool bodies NOT.
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk
  source "$LF" 2>/dev/null
  [ "${OTEL_LOG_USER_PROMPTS:-}" = "1" ] && [ "${OTEL_LOG_ASSISTANT_RESPONSES:-}" = "1" ] \
    && [ -z "${OTEL_LOG_TOOL_CONTENT:-}" ]
) && pass "default content → prompts on, tool bodies off" || bad "default content → prompts on, tool bodies off"

# 8. LANGFUSE_LOG_CONTENT=0 → redact everything (no OTEL_LOG_* set).
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk LANGFUSE_LOG_CONTENT=0
  source "$LF" 2>/dev/null
  [ -z "${OTEL_LOG_USER_PROMPTS:-}" ] && [ -z "${OTEL_LOG_ASSISTANT_RESPONSES:-}" ]
) && pass "LANGFUSE_LOG_CONTENT=0 → content redacted" || bad "LANGFUSE_LOG_CONTENT=0 → content redacted"

# 9. LANGFUSE_LOG_CONTENT=all → also capture tool input/output bodies.
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk LANGFUSE_LOG_CONTENT=all
  source "$LF" 2>/dev/null
  [ "${OTEL_LOG_TOOL_CONTENT:-}" = "1" ]
) && pass "LANGFUSE_LOG_CONTENT=all → tool bodies captured" || bad "LANGFUSE_LOG_CONTENT=all → tool bodies captured"

# 10. LANGFUSE_TRACING=0 → force-disabled even with both keys present.
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk LANGFUSE_TRACING=0
  source "$LF" 2>/dev/null
  [ -z "${CLAUDE_CODE_ENABLE_TELEMETRY:-}" ]
) && pass "LANGFUSE_TRACING=0 → force-disabled" || bad "LANGFUSE_TRACING=0 → force-disabled"

# 11. Component + skill land in resource attributes for Langfuse-side context.
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk AEON_OTEL_COMPONENT=scorer SKILL_NAME=my-skill
  source "$LF" 2>/dev/null
  case "${OTEL_RESOURCE_ATTRIBUTES:-}" in
    *aeon.component=scorer*) : ;; *) exit 1 ;;
  esac
  case "${OTEL_RESOURCE_ATTRIBUTES:-}" in
    *aeon.skill=my-skill*) exit 0 ;; *) exit 1 ;;
  esac
) && pass "resource attrs include component + skill" || bad "resource attrs include component + skill"

# 12. GITHUB_RUN_ID → langfuse.session.id, so a whole Aeon run groups into one
#     Langfuse session (skill-run + scorer + feed share the run id).
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk GITHUB_RUN_ID=123456789
  source "$LF" 2>/dev/null
  case "${OTEL_RESOURCE_ATTRIBUTES:-}" in
    *langfuse.session.id=123456789*) exit 0 ;; *) exit 1 ;;
  esac
) && pass "GITHUB_RUN_ID → langfuse.session.id" || bad "GITHUB_RUN_ID → langfuse.session.id"

# 13. Sourcing under `bash -e` (Actions default) never fails the caller.
( set -e
  export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk
  source "$LF" >/dev/null 2>&1
  echo "still-running" >/dev/null
) && pass "sourcing under bash -e does not abort caller" || bad "sourcing under bash -e does not abort caller"

echo
if [ "$fail" -eq 0 ]; then echo "All langfuse-otel tests passed."; else echo "Some tests FAILED."; fi
exit "$fail"

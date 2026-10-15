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

# 14. A call site with no skill (the feed) still gets a readable trace name; a
#     skill adds trace metadata Langfuse can filter on.
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk AEON_OTEL_COMPONENT=feed
  source "$LF" 2>/dev/null
  case "${OTEL_RESOURCE_ATTRIBUTES:-}" in *langfuse.trace.name=aeon:feed*) exit 0 ;; *) exit 1 ;; esac
) && pass "no skill → trace name aeon:<component>" || bad "no skill → trace name aeon:<component>"
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk SKILL_NAME=heartbeat
  source "$LF" 2>/dev/null
  case "${OTEL_RESOURCE_ATTRIBUTES:-}" in *langfuse.trace.metadata.skill=heartbeat*) exit 0 ;; *) exit 1 ;; esac
) && pass "skill → langfuse.trace.metadata.skill" || bad "skill → langfuse.trace.metadata.skill"

# 15. AEON_LF_TRACE_ID: 32 hex, derived from run/attempt/component/skill, so it is
#     stable within a run and differs per call site.
tid_for() { ( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk GITHUB_RUN_ID=42 GITHUB_RUN_ATTEMPT=1 SKILL_NAME="$2"
  if [ -n "$1" ]; then export AEON_OTEL_COMPONENT="$1"; fi
  source "$LF" 2>/dev/null; echo "${AEON_LF_TRACE_ID:-}" ); }
a=$(tid_for "" heartbeat); b=$(tid_for "" heartbeat); c=$(tid_for scorer heartbeat)
want=$(printf '%s' "aeon:42:1:skill-run:heartbeat" | { sha256sum 2>/dev/null || shasum -a 256; } | cut -c1-32)
{ [[ "$a" =~ ^[0-9a-f]{32}$ ]] && [ "$a" = "$b" ] && [ "$a" = "$want" ] && [ "$a" != "$c" ]; } \
  && pass "AEON_LF_TRACE_ID = sha256(run:attempt:component:skill)[:32]" || bad "AEON_LF_TRACE_ID derivation ($a / $c)"
( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk; unset GITHUB_RUN_ID
  source "$LF" 2>/dev/null; [ -z "${AEON_LF_TRACE_ID:-}" ]
) && pass "no GITHUB_RUN_ID → no AEON_LF_TRACE_ID" || bad "no GITHUB_RUN_ID → no AEON_LF_TRACE_ID"

# --- scripts/langfuse-score.sh -------------------------------------------------
SC="scripts/langfuse-score.sh"
STUB=$(mktemp -d)
cat > "$STUB/curl" <<'CURL'
#!/usr/bin/env bash
cat > "$STUB_DIR/config.$$"
printf '%s\n' "$@" > "$STUB_DIR/argv.$$"
while [ $# -gt 0 ]; do case "$1" in --data-binary) printf '%s\n' "$2" >> "$STUB_DIR/bodies"; shift 2 ;; *) shift ;; esac; done
printf 200
CURL
chmod +x "$STUB/curl"
score() { rm -f "$STUB"/bodies "$STUB"/config.* "$STUB"/argv.*
  env PATH="$STUB:$PATH" STUB_DIR="$STUB" GITHUB_RUN_ID=42 GITHUB_RUN_ATTEMPT=1 LANGFUSE_HOST=https://lf.invalid "$@" >/dev/null 2>&1; }

# 16. No keys → no POST; keys + claude → numeric score on the skill run's trace
#     (the same id langfuse-otel.sh gives the Run step) + one flag score.
score bash "$SC" heartbeat 4 "ok" '["unverifiable_claim"]' claude claude-haiku-5-5
[ ! -f "$STUB/bodies" ] && pass "score: no keys → no POST" || bad "score: no keys → no POST"
score LANGFUSE_PUBLIC_KEY=pk-lf-1 LANGFUSE_SECRET_KEY=sk-lf-2 bash "$SC" heartbeat 4 "fine run" '["unverifiable_claim"]' claude claude-haiku-5-5
if [ -f "$STUB/bodies" ]; then
  q=$(sed -n 1p "$STUB/bodies"); f=$(sed -n 2p "$STUB/bodies")
  echo "$q" | jq -e --arg t "$a" '.traceId == $t and (has("sessionId") | not) and .name == "quality" and .value == 4
      and .dataType == "NUMERIC" and .environment == "github-actions" and .id == ($t + "-quality")
      and .metadata.skill == "heartbeat" and .metadata.score_model == "claude-haiku-5-5"' >/dev/null \
    && pass "score: quality on the Run step's trace id" || bad "score: quality body ($q)"
  echo "$f" | jq -e --arg t "$a" '.traceId == $t and .name == "quality_flag" and .value == "unverifiable_claim" and .dataType == "CATEGORICAL"' >/dev/null \
    && pass "score: one categorical score per flag" || bad "score: flag body ($f)"
  grep -q 'sk-lf-2' "$STUB"/argv.* && bad "score: secret in curl argv" || pass "score: secret never in argv"
  grep -q 'user = "pk-lf-1:sk-lf-2"' "$STUB"/config.* && pass "score: auth via curl config on stdin" || bad "score: auth via curl config on stdin"
else
  bad "score: expected a POST"
fi

# 17. Other harness → session score; bad score → nothing.
score LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" heartbeat 3 "meh" '[]' grok
sed -n 1p "$STUB/bodies" 2>/dev/null | jq -e '.sessionId == "42" and (has("traceId") | not)' >/dev/null \
  && pass "score: non-claude harness → session score" || bad "score: non-claude harness → session score"
score LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" heartbeat 0 "x" '[]' claude
[ ! -f "$STUB/bodies" ] && pass "score: out-of-range score → no POST" || bad "score: out-of-range score → no POST"
rm -rf "$STUB"

echo
if [ "$fail" -eq 0 ]; then echo "All langfuse-otel tests passed."; else echo "Some tests FAILED."; fi
exit "$fail"

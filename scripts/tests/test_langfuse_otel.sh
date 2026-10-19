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
      OTEL_RESOURCE_ATTRIBUTES LANGFUSE_TRACING_ENVIRONMENT AEON_LF_VERSION \
      GITHUB_REF_NAME GITHUB_EVENT_PATH GITHUB_EVENT_NAME GITHUB_WORKSPACE GITHUB_SHA \
      GITHUB_REPOSITORY AEON_DISPATCH_TRIGGER GATEWAY AEON_GATEWAY_ATTEMPT 2>/dev/null || true

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

# 16. Slicing handles. WS is a fake workspace (state file, a skill) and EV an
#     event payload naming the default branch.
WS=$(mktemp -d)
mkdir -p "$WS/memory/topics" "$WS/skills/heartbeat"
echo '{"baseline_sha":"df013dbe0be81e63771b7b013ec055380c766986"}' > "$WS/memory/topics/aeon-update-state.json"
printf -- '---\nname: heartbeat\n---\nbody\n' > "$WS/skills/heartbeat/SKILL.md"
printf '{"repository":{"default_branch":"trunk"}}' > "$WS/event.json"
# shellcheck disable=SC2163  # "$@" holds VAR=value pairs to export
attrs_for() { ( export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk GITHUB_WORKSPACE="$WS" "$@"
  source "$LF" 2>/dev/null; echo "${OTEL_RESOURCE_ATTRIBUTES:-}|${AEON_LF_VERSION:-}" ); }
has() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }
r=$(attrs_for GITHUB_REF_NAME=main)
has "$r" "deployment.environment=production," && pass "env: default branch (main fallback) → production" || bad "env production ($r)"
r=$(attrs_for GITHUB_REF_NAME=verify/langfuse)
has "$r" "deployment.environment=branch," && pass "env: other branch → branch" || bad "env branch ($r)"
r=$(attrs_for GITHUB_REF_NAME=trunk GITHUB_EVENT_PATH="$WS/event.json")
has "$r" "deployment.environment=production," && pass "env: default branch read from the event payload" || bad "env from payload ($r)"
r=$(attrs_for GITHUB_REF_NAME=main GITHUB_EVENT_PATH="$WS/event.json")
has "$r" "deployment.environment=branch," && pass "env: main is not the default branch → branch" || bad "env payload mismatch ($r)"
r=$(attrs_for GITHUB_REF_NAME=main LANGFUSE_TRACING_ENVIRONMENT=test)
has "$r" "deployment.environment=test," && pass "env: LANGFUSE_TRACING_ENVIRONMENT wins" || bad "env override ($r)"
r=$(attrs_for LANGFUSE_TRACING_ENVIRONMENT=langfuse-x)
has "$r" "deployment.environment=local," && pass "env: reserved override ignored; no ref → local" || bad "env reserved/local ($r)"
r=$(attrs_for SKILL_NAME=heartbeat GITHUB_REPOSITORY=aaronjmars/aeon-agent GITHUB_EVENT_NAME=workflow_dispatch)
{ has "$r" "langfuse.user.id=heartbeat," && has "$r" "langfuse.trace.metadata.instance=aeon-agent" \
  && has "$r" "langfuse.trace.metadata.trigger=workflow_dispatch"; } \
  && pass "userId = skill; instance + trigger metadata" || bad "user/metadata ($r)"
# trigger: aeon.yml sets AEON_DISPATCH_TRIGGER from its trigger input (maybe empty).
# The trigger is the last attribute here, or followed by aeon.run_attempt in CI.
trig() { has "$1" "langfuse.trace.metadata.trigger=$2," || has "$1" "langfuse.trace.metadata.trigger=$2|"; }
r=$(attrs_for GITHUB_EVENT_NAME=workflow_dispatch AEON_DISPATCH_TRIGGER=cron)
trig "$r" cron && pass "trigger: Scheduler dispatch -> cron" || bad "trigger cron ($r)"
r=$(attrs_for GITHUB_EVENT_NAME=workflow_dispatch AEON_DISPATCH_TRIGGER=chain)
trig "$r" chain && pass "trigger: chain-runner dispatch -> chain" || bad "trigger chain ($r)"
r=$(attrs_for GITHUB_EVENT_NAME=workflow_dispatch AEON_DISPATCH_TRIGGER=)
trig "$r" manual && pass "trigger: plain Run now -> manual" || bad "trigger manual ($r)"
r=$(attrs_for GITHUB_EVENT_NAME=workflow_dispatch AEON_DISPATCH_TRIGGER='cron2,langfuse.user.id=x')
{ trig "$r" manual && ! has "$r" "cron2"; } \
  && pass "trigger: unknown input value -> manual, never copied" || bad "trigger free text ($r)"
r=$(attrs_for GITHUB_EVENT_NAME=issues AEON_DISPATCH_TRIGGER=)
trig "$r" issues && pass "trigger: non-dispatch event keeps its name" || bad "trigger issues ($r)"
# gateway: the provider llm-gateway.sh resolved + the cascade attempt number.
r=$(attrs_for GATEWAY=glm AEON_GATEWAY_ATTEMPT=2)
{ has "$r" "aeon.gateway=glm," && has "$r" "aeon.gateway_attempt=2|"; } \
  && pass "gateway + attempt in the resource attributes" || bad "gateway attrs ($r)"
r=$(attrs_for GATEWAY=auto AEON_GATEWAY_ATTEMPT=x)
{ ! has "$r" "aeon.gateway"; } && pass "gateway: unresolved auto / bad attempt left out" || bad "gateway auto ($r)"
r=$(attrs_for GATEWAY='glm,langfuse.user.id=x')
{ ! has "$r" "aeon.gateway"; } && pass "gateway: unsafe value never copied" || bad "gateway free text ($r)"
r=$(attrs_for AEON_OTEL_COMPONENT=feed)
has "$r" "langfuse.user.id=aeon:feed," && pass "no skill → userId aeon:<component>" || bad "feed user ($r)"
r=$(attrs_for GITHUB_SHA=0123456789abcdef0123456789abcdef01234567)
has "$r" "langfuse.release=canon-df013db" && pass "release = canon-<baseline sha7>, not GITHUB_SHA" || bad "release baseline ($r)"
r=$(attrs_for GITHUB_WORKSPACE=/nonexistent GITHUB_SHA=0123456789abcdef0123456789abcdef01234567)
has "$r" "langfuse.release=0123456," && pass "no aeon-update state → release = short GITHUB_SHA" || bad "release fallback ($r)"
r=$(attrs_for GITHUB_WORKSPACE=/nonexistent)
has "$r" "langfuse.release=" && bad "no state, no sha → no release ($r)" || pass "no state, no sha → no release attribute"
want=$(git hash-object "$WS/skills/heartbeat/SKILL.md" | cut -c1-7)
r=$(attrs_for SKILL_NAME=heartbeat)
{ [ "${r##*|}" = "$want" ] && ! has "${r%|*}" "langfuse.version"; } \
  && pass "AEON_LF_VERSION = SKILL.md blob hash, kept out of resource attrs" || bad "version ($r, want $want)"
r=$(attrs_for SKILL_NAME=no-such-skill)
[ -z "${r##*|}" ] && pass "no SKILL.md → no version" || bad "version without SKILL.md ($r)"
( set -e -o pipefail
  export LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk SKILL_NAME=heartbeat GITHUB_WORKSPACE=/nonexistent GITHUB_EVENT_PATH=/nonexistent
  source "$LF" >/dev/null 2>&1
) && pass "sourcing under bash -e -o pipefail with missing files does not abort" || bad "pipefail abort"

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

# 17. No keys → no POST; keys + claude → numeric score on the skill run's trace
#     (the same id langfuse-otel.sh gives the Run step) + one flag score.
score bash "$SC" heartbeat 4 "ok" '["unverifiable_claim"]' claude claude-haiku-5-5
[ ! -f "$STUB/bodies" ] && pass "score: no keys → no POST" || bad "score: no keys → no POST"
score LANGFUSE_PUBLIC_KEY=pk-lf-1 LANGFUSE_SECRET_KEY=sk-lf-2 bash "$SC" heartbeat 4 "fine run" '["unverifiable_claim"]' claude claude-haiku-5-5
if [ -f "$STUB/bodies" ]; then
  q=$(sed -n 1p "$STUB/bodies"); f=$(sed -n 2p "$STUB/bodies")
  echo "$q" | jq -e --arg t "$a" '.traceId == $t and (has("sessionId") | not) and .name == "quality" and .value == 4
      and .dataType == "NUMERIC" and .environment == "local" and .id == ($t + "-quality")
      and .metadata.skill == "heartbeat" and .metadata.score_model == "claude-haiku-5-5"' >/dev/null \
    && pass "score: quality on the Run step's trace id" || bad "score: quality body ($q)"
  echo "$f" | jq -e --arg t "$a" '.traceId == $t and .name == "quality_flag" and .value == "unverifiable_claim" and .dataType == "CATEGORICAL"' >/dev/null \
    && pass "score: one categorical score per flag" || bad "score: flag body ($f)"
  grep -q 'sk-lf-2' "$STUB"/argv.* && bad "score: secret in curl argv" || pass "score: secret never in argv"
  grep -q 'user = "pk-lf-1:sk-lf-2"' "$STUB"/config.* && pass "score: auth via curl config on stdin" || bad "score: auth via curl config on stdin"
else
  bad "score: expected a POST"
fi

# 18. Other harness → session score; bad score → nothing.
score LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" heartbeat 3 "meh" '[]' grok
sed -n 1p "$STUB/bodies" 2>/dev/null | jq -e '.sessionId == "42" and (has("traceId") | not)' >/dev/null \
  && pass "score: non-claude harness → session score" || bad "score: non-claude harness → session score"
score LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" heartbeat 0 "x" '[]' claude
[ ! -f "$STUB/bodies" ] && pass "score: out-of-range score → no POST" || bad "score: out-of-range score → no POST"

# 19. Score environment matches the traces'.
score GITHUB_REF_NAME=main LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" heartbeat 3 "meh" '[]' claude
sed -n 1p "$STUB/bodies" 2>/dev/null | jq -e '.environment == "production"' >/dev/null \
  && pass "score: default branch → environment production" || bad "score: environment production"
score GITHUB_REF_NAME=verify/x LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" heartbeat 3 "meh" '[]' claude
sed -n 1p "$STUB/bodies" 2>/dev/null | jq -e '.environment == "branch"' >/dev/null \
  && pass "score: other branch → environment branch" || bad "score: environment branch"

# 20. --run-ok: one BOOLEAN run_ok on the skill run's trace (fixed id), the error
#     as comment; session score for other harnesses; bad value → nothing.
score GITHUB_REF_NAME=main LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" --run-ok heartbeat 1 claude
sed -n 1p "$STUB/bodies" 2>/dev/null | jq -e --arg t "$a" '.traceId == $t and .name == "run_ok" and .value == 1
    and .dataType == "BOOLEAN" and .id == ($t + "-run_ok") and .environment == "production" and (has("comment") | not)
    and .metadata.skill == "heartbeat"' >/dev/null \
  && pass "run-ok: BOOLEAN run_ok=1 on the Run step's trace" || bad "run-ok body ($(sed -n 1p "$STUB/bodies" 2>/dev/null))"
[ "$(wc -l < "$STUB/bodies" 2>/dev/null)" -eq 1 ] && pass "run-ok: exactly one POST" || bad "run-ok: POST count"
score LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" --run-ok heartbeat 0 claude "harness timed out"
sed -n 1p "$STUB/bodies" 2>/dev/null | jq -e '.value == 0 and .comment == "harness timed out"' >/dev/null \
  && pass "run-ok: failed run → 0 with the error as comment" || bad "run-ok failed body"
score LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" --run-ok heartbeat 1 grok
sed -n 1p "$STUB/bodies" 2>/dev/null | jq -e '.sessionId == "42" and (has("traceId") | not)' >/dev/null \
  && pass "run-ok: non-claude harness → session score" || bad "run-ok: session score"
score LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" --run-ok heartbeat 1 ""
sed -n 1p "$STUB/bodies" 2>/dev/null | jq -e --arg t "$a" '.traceId == $t' >/dev/null \
  && pass "run-ok: empty harness (Run never started) → claude trace id" || bad "run-ok: empty harness"
score LANGFUSE_PUBLIC_KEY=pk LANGFUSE_SECRET_KEY=sk bash "$SC" --run-ok heartbeat yes claude
[ ! -f "$STUB/bodies" ] && pass "run-ok: bad value → no POST" || bad "run-ok: bad value → no POST"
rm -rf "$STUB" "$WS"

echo
if [ "$fail" -eq 0 ]; then echo "All langfuse-otel tests passed."; else echo "Some tests FAILED."; fi
exit "$fail"

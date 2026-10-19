#!/usr/bin/env bash
# test_otel_span.sh — harness-adapter/lib/otel-span.sh (Tier-2 harness tracing).
#
# Guards the three properties that make the emit safe:
#   1. it no-ops (and never fails) when telemetry is off or otel-cli is absent
#   2. it emits the expected gen_ai.* span for a non-claude harness
#   3. it NEVER puts result content on the span, and skips claude (self-traces)
# plus the claude root span (rh_trace_begin/rh_trace_end: ids, usage, auth on
# stdin) and the claude adapter's startup-delay hook.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIB="$ROOT/harness-adapter/lib/otel-span.sh"
FAIL=0
ok()   { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; FAIL=1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# A stub otel-cli that records its argv, placed first on PATH.
cat > "$TMP/otel-cli" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" > "$OTEL_STUB_OUT"
STUB
chmod +x "$TMP/otel-cli"
export OTEL_STUB_OUT="$TMP/args.txt"

# Envelope carrying result content that must never reach the span.
cat > "$TMP/env.json" <<'JSON'
{"result":"SENSITIVE-RESULT-TEXT","usage":{"input_tokens":1200,"output_tokens":340,"cache_read_input_tokens":900,"cache_creation_input_tokens":10},"total_cost_usd":0.0123}
JSON

emit() { # runs the helper in a clean subshell with the given env
  env -i PATH="$TMP:$PATH" HOME="$HOME" OTEL_STUB_OUT="$OTEL_STUB_OUT" \
    RH_HARNESS="$1" RH_MODEL="$2" \
    OTEL_EXPORTER_OTLP_ENDPOINT="$3" AEON_OTEL_COMPONENT=harness \
    bash -c ". '$LIB'; rh_emit_harness_span '$TMP/env.json' 1000 2000"
}

# 1. no endpoint → no-op, rc 0, nothing recorded
rm -f "$TMP/args.txt"
emit grok grok-4.7 ""; rc=$?
{ [ "$rc" = 0 ] && [ ! -f "$TMP/args.txt" ]; } && ok "telemetry off → no-op" || bad "telemetry off → no-op (rc=$rc)"

# 2. non-claude + endpoint → emits gen_ai span with usage/model/cost
rm -f "$TMP/args.txt"
emit grok grok-4.7 "http://collector.invalid"
if [ -f "$TMP/args.txt" ]; then
  args="$(cat "$TMP/args.txt")"
  case "$args" in *"gen_ai.system=grok"*) ok "records gen_ai.system" ;; *) bad "missing gen_ai.system" ;; esac
  case "$args" in *"gen_ai.request.model=grok-4.7"*) ok "records model" ;; *) bad "missing model" ;; esac
  case "$args" in *"gen_ai.usage.input_tokens=1200"*) ok "records input tokens" ;; *) bad "missing input tokens" ;; esac
  case "$args" in *"gen_ai.usage.output_tokens=340"*) ok "records output tokens" ;; *) bad "missing output tokens" ;; esac
  case "$args" in *"aeon.cost_usd=0.0123"*) ok "records cost" ;; *) bad "missing cost" ;; esac
  case "$args" in *SENSITIVE-RESULT-TEXT*) bad "result content leaked onto span" ;; *) ok "no result content on span" ;; esac
else
  bad "non-claude + endpoint → expected an emit"
fi

# 3. claude is skipped (it self-traces via Claude Code's own OTEL)
rm -f "$TMP/args.txt"
emit claude claude-sonnet-5-5 "http://collector.invalid"
[ ! -f "$TMP/args.txt" ] && ok "claude harness skipped" || bad "claude harness should not emit"

# 4. missing otel-cli → no-op even with endpoint set. Keep jq reachable (so the
#    guard being exercised is specifically the absent otel-cli), drop the stub.
rm -f "$TMP/args.txt"
JQ_DIR="$(dirname "$(command -v jq)")"
env -i PATH="$JQ_DIR:/usr/bin:/bin" HOME="$HOME" \
  RH_HARNESS=grok RH_MODEL=grok-4.7 OTEL_EXPORTER_OTLP_ENDPOINT="http://collector.invalid" \
  bash -c ". '$LIB'; rh_emit_harness_span '$TMP/env.json' 1 2"; rc=$?
[ "$rc" = 0 ] && ok "no otel-cli → no-op, rc 0" || bad "no otel-cli should no-op (rc=$rc)"

# --- claude root span (rh_trace_begin / rh_trace_end) ------------------------
# A stub curl that records argv, the headers it reads on stdin (-H @-) and the
# --data-binary body.
mkdir -p "$TMP/cbin" "$TMP/curl"
cat > "$TMP/cbin/curl" <<'STUB'
#!/usr/bin/env bash
cat > "$CURL_STUB_DIR/headers"
printf '%s\n' "$@" > "$CURL_STUB_DIR/argv"
while [ $# -gt 0 ]; do
  case "$1" in --data-binary) cp "${2#@}" "$CURL_STUB_DIR/body"; shift 2 ;; *) shift ;; esac
done
STUB
chmod +x "$TMP/cbin/curl"
cat > "$TMP/claude-env.json" <<'JSON'
{"result":"SENSITIVE-RESULT-TEXT","is_error":false,"num_turns":7,"total_cost_usd":0.42,
 "usage":{"input_tokens":30,"output_tokens":500,"cache_read_input_tokens":9000,"cache_creation_input_tokens":1000,
          "cache_creation":{"ephemeral_1h_input_tokens":750,"ephemeral_5m_input_tokens":250}},
 "modelUsage":{"claude-sonnet-5-5":{"inputTokens":20,"outputTokens":450,"cacheReadInputTokens":8000,"cacheCreationInputTokens":900},
               "claude-haiku-5-5":{"inputTokens":10,"outputTokens":50,"cacheReadInputTokens":1000,"cacheCreationInputTokens":100}}}
JSON
TID=0123456789abcdef0123456789abcdef
RES="service.name=aeon,aeon.component=skill-run,langfuse.session.id=77,aeon.skill=heartbeat,langfuse.trace.name=aeon:skill-run:heartbeat,langfuse.user.id=heartbeat,langfuse.release=canon-df013db"
trace() { # <harness> <rc> <envelope> [VAR=value...] -> prints TRACEPARENT seen by the harness
  rm -f "$TMP/curl/"*
  env -i PATH="$TMP/cbin:$PATH" HOME="$HOME" TMPDIR="$TMP" CURL_STUB_DIR="$TMP/curl" \
    RH_HARNESS="$1" RH_MODEL=claude-sonnet-5-5 AEON_LF_TRACE_ID="$TID" \
    OTEL_EXPORTER_OTLP_ENDPOINT="https://lf.invalid/api/public/otel" \
    OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic c2VjcmV0OnBhc3M=,x-langfuse-ingestion-version=4" \
    OTEL_RESOURCE_ATTRIBUTES="$RES" AEON_LF_VERSION=abc1234 "${@:4}" \
    bash -c ". '$LIB'; rh_trace_begin; echo \"\${TRACEPARENT:-}\"; rh_trace_end '$2' /nonexistent '$3'"
}
# attrs <span-index>: that span's attributes as one {key: value} object.
attrs() { jq -c --argjson n "$1" '.resourceSpans[0].scopeSpans[0].spans[$n] | [.attributes[] | {(.key): (.value | .stringValue // .intValue // .doubleValue // ([.arrayValue.values[]?.stringValue]))}] | add' "$TMP/curl/body"; }

tp=$(trace claude 0 "$TMP/claude-env.json")
[[ "$tp" =~ ^00-${TID}-[0-9a-f]{16}-01$ ]] && ok "claude: TRACEPARENT carries AEON_LF_TRACE_ID" || bad "claude: TRACEPARENT ($tp)"
if [ -f "$TMP/curl/body" ]; then
  B="$TMP/curl/body"
  root_sid="${tp:36:16}"
  jq -e --arg t "$TID" --arg s "$root_sid" '.resourceSpans[0].scopeSpans[0].spans[0] | .traceId == $t and .spanId == $s and (has("parentSpanId") | not) and .name == "aeon:skill-run:heartbeat"' "$B" >/dev/null \
    && ok "root span: forced ids, no parent, named from langfuse.trace.name" || bad "root span ids/name"
  jq -e '[.resourceSpans[0].scopeSpans[0].spans[0].attributes[] | select(.key == "langfuse.session.id") | .value.stringValue] == ["77"]' "$B" >/dev/null \
    && ok "root span carries langfuse.session.id as a span attribute" || bad "root span session attribute"
  jq -e '[.resourceSpans[0].scopeSpans[0].spans[0].attributes[] | select(.key == "langfuse.trace.tags") | .value.arrayValue.values[].stringValue] == ["skill:heartbeat","component:skill-run"]' "$B" >/dev/null \
    && ok "root span tags skill + component" || bad "root span tags"
  jq -e '.resourceSpans[0].scopeSpans[0].spans[1:] | length == 2' "$B" >/dev/null \
    && ok "one usage generation per model" || bad "usage generation count"
  jq -e --arg s "$root_sid" '.resourceSpans[0].scopeSpans[0].spans[1:][] | select(.name == "usage claude-sonnet-5-5")
      | ([.attributes[] | {(.key): .value}] | add) as $a
      | .parentSpanId == $s and $a["gen_ai.usage.input_tokens"].intValue == "8920" and $a["gen_ai.usage.output_tokens"].intValue == "450"
      and $a["gen_ai.usage.cache_read_input_tokens"].intValue == "8000" and $a["langfuse.observation.type"].stringValue == "generation"' "$B" >/dev/null \
    && ok "usage generation: cache-inclusive input, output, cache counts, parent = root" || bad "usage generation fields"
  # usage_details names the Langfuse price keys: 1h writes at the 1h price, each
  # model split by the run's 1h/5m ratio (75/25 here), input without cache.
  ud() { jq -c --arg m "$1" '.resourceSpans[0].scopeSpans[0].spans[1:][] | select(.name == "usage " + $m) | .attributes[] | select(.key == "langfuse.observation.usage_details") | .value.stringValue | fromjson' "$B"; }
  [ "$(ud claude-sonnet-5-5)" = '{"input":20,"output":450,"input_cache_read":8000,"input_cache_creation_1h":675,"input_cache_creation_5m":225}' ] \
    && ok "usage_details: 1h/5m cache-write split (sonnet)" || bad "usage_details sonnet ($(ud claude-sonnet-5-5))"
  [ "$(ud claude-haiku-5-5)" = '{"input":10,"output":50,"input_cache_read":1000,"input_cache_creation_1h":75,"input_cache_creation_5m":25}' ] \
    && ok "usage_details: 1h/5m cache-write split (haiku)" || bad "usage_details haiku ($(ud claude-haiku-5-5))"
  jq -e '.resourceSpans[0].scopeSpans[0].spans as $s | $s[0].endTimeUnixNano as $end
      | [$s[1:][] | .startTimeUnixNano == $end and .endTimeUnixNano == $end
         and ([.attributes[] | select(.key == "langfuse.observation.metadata.rollup") | .value.stringValue] == ["true"])] | all' "$B" >/dev/null \
    && ok "usage generations: zero-length at the run end, marked rollup (per-model latency stays real)" || bad "usage generation timing/rollup"
  attrs 0 | jq -e '.["langfuse.observation.type"] == "agent" and .["langfuse.version"] == "abc1234"
      and .["langfuse.user.id"] == "heartbeat" and .["langfuse.release"] == "canon-df013db"
      and (has("langfuse.observation.status_message") | not) and (has("langfuse.observation.metadata.error_class") | not)' >/dev/null \
    && ok "root span: type agent, skill version, user, release" || bad "root span slicing fields ($(attrs 0))"
  for n in 1 2; do
    attrs "$n" | jq -e '.["langfuse.trace.name"] == "aeon:skill-run:heartbeat" and .["langfuse.trace.tags"] == ["skill:heartbeat","component:skill-run"]
        and .["langfuse.user.id"] == "heartbeat" and .["langfuse.version"] == "abc1234" and .["langfuse.session.id"] == "77"' >/dev/null \
      && ok "usage generation $n: trace name, tags, user, version (cost groups by skill)" || bad "usage generation $n trace fields ($(attrs "$n"))"
  done
  grep -q SENSITIVE-RESULT-TEXT "$B" && bad "result text leaked into the trace" || ok "no result text in the trace"
  grep -q 'Authorization: Basic c2VjcmV0OnBhc3M=' "$TMP/curl/headers" && ok "auth header passed on stdin" || bad "auth header not on stdin"
  grep -q c2VjcmV0OnBhc3M "$TMP/curl/argv" && bad "auth value in curl argv" || ok "auth value never in argv"
  grep -qx 'https://lf.invalid/api/public/otel/v1/traces' "$TMP/curl/argv" && ok "posts to <endpoint>/v1/traces" || bad "trace endpoint"
else
  bad "claude: expected a trace POST"
fi

trace claude 1 /nonexistent >/dev/null
if [ -f "$TMP/curl/body" ]; then
  jq -e '.resourceSpans[0].scopeSpans[0].spans | length == 1 and (.[0].status.code == 2)
      and ([.[0].attributes[] | select(.key == "langfuse.observation.level") | .value.stringValue] == ["ERROR"])' "$TMP/curl/body" >/dev/null \
    && ok "failed run without envelope: root span only, level ERROR" || bad "failed run root span"
else
  bad "failed claude run should still send its root span"
fi

if [ -f "$TMP/curl/body" ]; then
  attrs 0 | jq -e '.["langfuse.observation.status_message"] == "tool_failed: exit 1" and .["langfuse.observation.metadata.error_class"] == "tool_failed"
      and (.["langfuse.trace.tags"] | index("status:error"))' >/dev/null \
    && ok "failed run: tool_failed: exit 1 + error_class + status:error tag" || bad "failed run status ($(attrs 0))"
fi
trace claude 124 /nonexistent >/dev/null
attrs 0 | jq -e '.["langfuse.observation.status_message"] == "timeout: rc 124" and .["langfuse.observation.metadata.error_class"] == "timeout"' >/dev/null \
  && ok "timed-out run (rc 124): class timeout" || bad "timeout status message ($(attrs 0))"
cat > "$TMP/denied-env.json" <<'JSON'
{"result":"x","is_error":true,"subtype":"error_max_turns","num_turns":40,
 "permission_denials":[{"tool_name":"Bash","tool_input":{"command":"SECRET-CMD"}},{"tool_name":"Write","tool_input":{}}],
 "usage":{"input_tokens":1,"output_tokens":2,"cache_read_input_tokens":0,"cache_creation_input_tokens":5}}
JSON
trace claude 0 "$TMP/denied-env.json" >/dev/null
attrs 0 | jq -e '.["langfuse.observation.status_message"] == "budget_cap: error_max_turns" and .["langfuse.observation.level"] == "ERROR"
    and .["langfuse.observation.metadata.error_class"] == "budget_cap"
    and .["langfuse.observation.metadata.permission_denials"] == "2"' >/dev/null \
  && ok "error result: error_max_turns -> budget_cap, permission denial count" || bad "error result fields ($(attrs 0))"
attrs 1 | jq -e '.["langfuse.trace.tags"] | index("status:error")' >/dev/null \
  && ok "usage generation of a failed run carries status:error" || bad "usage generation status tag"
attrs 1 | jq -e '.["langfuse.observation.usage_details"] | fromjson == {"input":1,"output":2,"input_cache_read":0,"input_cache_creation":5}' >/dev/null \
  && ok "usage_details without a TTL split keeps one cache-write count" || bad "usage_details fallback ($(attrs 1))"
grep -q SECRET-CMD "$TMP/curl/body" && bad "denied tool input leaked" || ok "denied tool input never sent"
# error_class: structured facts first (subtype, API status), then the result
# text or the raw output head (read for the class only, never sent).
eclass() { # <rc> <file> <class> <status message> <label>
  trace claude "$1" "$2" >/dev/null
  attrs 0 | jq -e --arg c "$3" --arg m "$4" '.["langfuse.observation.metadata.error_class"] == $c
      and .["langfuse.observation.status_message"] == $m and .["langfuse.observation.level"] == "ERROR"' >/dev/null \
    && ok "error_class $3: $5" || bad "error_class $5 ($(attrs 0))"
}
U='"usage":{"input_tokens":1,"output_tokens":2}'
echo "{\"is_error\":true,\"subtype\":\"error_during_execution\",$U}" > "$TMP/e1.json"
eclass 1 "$TMP/e1.json" tool_failed "tool_failed: error_during_execution" "error_during_execution"
echo "{\"is_error\":true,\"subtype\":\"success\",\"api_error_status\":429,\"result\":\"API Error: 429\",$U}" > "$TMP/e2.json"
eclass 1 "$TMP/e2.json" rate_limit "rate_limit: exit 1" "API status 429"
echo "{\"is_error\":true,\"subtype\":\"success\",\"api_error_status\":529,\"result\":\"SECRET-RESULT overloaded\",$U}" > "$TMP/e3.json"
eclass 0 "$TMP/e3.json" upstream_error "upstream_error: api_error 529" "API status 529"
echo "{\"is_error\":true,\"subtype\":\"success\",\"api_error_status\":401,$U}" > "$TMP/e4.json"
eclass 1 "$TMP/e4.json" auth "auth: exit 1" "API status 401"
echo "{\"is_error\":true,\"subtype\":\"success\",\"result\":\"SECRET-RESULT Invalid API key · Please run /login\",$U}" > "$TMP/e5.json"
eclass 1 "$TMP/e5.json" auth "auth: exit 1" "login error in the result text"
grep -q SECRET-RESULT "$TMP/curl/body" && bad "result text leaked via error_class" || ok "result text used for the class, never sent"
echo "{\"is_error\":true,\"subtype\":\"success\",\"result\":\"You've hit your limit · resets 3pm\",$U}" > "$TMP/e6.json"
eclass 1 "$TMP/e6.json" plan_limit "plan_limit: exit 1" "plan limit in the result text"
# A spent weekly plan answers 429 too: plan_limit wins over rate_limit, from the
# api_error field or the text alone.
echo "{\"is_error\":true,\"subtype\":\"success\",\"api_error_status\":429,\"api_error\":\"usage_limit_reached\",\"result\":\"You've hit your weekly limit · resets Oct 20, 5pm (UTC)\",$U}" > "$TMP/e10.json"
eclass 1 "$TMP/e10.json" plan_limit "plan_limit: exit 1" "weekly limit (429 + usage_limit_reached) is plan_limit, not rate_limit"
echo "{\"is_error\":true,\"subtype\":\"success\",\"api_error_status\":429,\"result\":\"You've hit your weekly limit\",$U}" > "$TMP/e11.json"
eclass 1 "$TMP/e11.json" plan_limit "plan_limit: exit 1" "weekly limit text with a 429 status"
echo "{\"is_error\":true,\"subtype\":\"success\",\"api_error_status\":429,\"api_error\":\"usage_limit_reached\",$U}" > "$TMP/e12.json"
eclass 1 "$TMP/e12.json" plan_limit "plan_limit: exit 1" "usage_limit_reached without result text"
echo "{\"is_error\":true,\"subtype\":\"success\",\"result\":\"Prompt is too long\",$U}" > "$TMP/e7.json"
eclass 0 "$TMP/e7.json" context_limit "context_limit: is_error" "shared rule table on the result text"
echo "{\"is_error\":true,\"subtype\":\"success\",\"result\":\"The client has disconnected\",$U}" > "$TMP/e9.json"
eclass 0 "$TMP/e9.json" cancelled "cancelled: is_error" "HTTP 499 client hang-up is cancelled, not network"
echo "{\"is_error\":true,\"subtype\":\"success\",\"result\":\"something odd\",$U}" > "$TMP/e8.json"
eclass 0 "$TMP/e8.json" other "other: is_error" "no rule matches"
printf 'SECRET-RAW OAuth token has expired. Please obtain a new token.\n' > "$TMP/raw.txt"
eclass 1 "$TMP/raw.txt" auth "auth: exit 1" "raw output head without an envelope"
grep -q SECRET-RAW "$TMP/curl/body" && bad "raw output leaked" || ok "raw output used for the class, never sent"
printf 'Error: connect ECONNREFUSED 127.0.0.1:8080\n' > "$TMP/raw2.txt"
eclass 2 "$TMP/raw2.txt" network "network: exit 2" "raw output, shared table"
# Gateway cascade: the first route carries gateway:<name>; a failover attempt
# adds the failover tag and names the provider in its status message.
trace claude 0 "$TMP/claude-env.json" OTEL_RESOURCE_ATTRIBUTES="$RES,aeon.gateway=claude,aeon.gateway_attempt=1" >/dev/null
attrs 0 | jq -e '.["langfuse.trace.tags"] == ["skill:heartbeat","component:skill-run","gateway:claude"]
    and .["langfuse.observation.metadata.gateway"] == "claude" and .["langfuse.observation.metadata.gateway_attempt"] == "1"' >/dev/null \
  && ok "first route: gateway tag + metadata" || bad "first route gateway fields ($(attrs 0))"
attrs 1 | jq -e '.["langfuse.observation.metadata.gateway"] == "claude" and (.["langfuse.trace.tags"] | index("gateway:claude"))' >/dev/null \
  && ok "usage row carries the gateway (cost by provider)" || bad "usage row gateway ($(attrs 1))"
echo "{\"is_error\":true,\"subtype\":\"success\",\"api_error_status\":429,\"result\":\"API Error: 429 SECRET-RESULT\",$U}" > "$TMP/e13.json"
trace claude 1 "$TMP/e13.json" OTEL_RESOURCE_ATTRIBUTES="$RES,aeon.gateway=glm,aeon.gateway_attempt=2" RH_MODEL=glm-5.3-flash >/dev/null
attrs 0 | jq -e '.["langfuse.observation.status_message"] == "rate_limit: exit 1 (failover to glm)"
    and .["langfuse.trace.tags"] == ["skill:heartbeat","component:skill-run","gateway:glm","failover","status:error"]
    and .["langfuse.observation.metadata.gateway_attempt"] == "2"' >/dev/null \
  && ok "failover attempt: failover tag, gateway in the status message" || bad "failover attempt fields ($(attrs 0))"
jq -e '.resourceSpans[0].scopeSpans[0].spans[1].name == "usage glm-5.3-flash"' "$TMP/curl/body" >/dev/null \
  && ok "failover attempt with an envelope leaves a usage row" || bad "failover usage row"
grep -q SECRET-RESULT "$TMP/curl/body" && bad "failover result text leaked" || ok "failover result text never sent"
trace claude 0 "$TMP/claude-env.json" OTEL_RESOURCE_ATTRIBUTES="aeon.component=scorer,aeon.skill=heartbeat,langfuse.trace.name=aeon:scorer:heartbeat" >/dev/null
attrs 0 | jq -e '.["langfuse.observation.type"] == "evaluator" and .["langfuse.trace.tags"] == ["skill:heartbeat","component:scorer"]' >/dev/null \
  && ok "scorer root: type evaluator" || bad "scorer root type ($(attrs 0))"
trace claude 0 "$TMP/claude-env.json" OTEL_RESOURCE_ATTRIBUTES="aeon.component=message" AEON_LF_VERSION= >/dev/null
attrs 0 | jq -e '(has("langfuse.observation.type") | not) and (has("langfuse.version") | not)' >/dev/null \
  && ok "other component, no version: plain span, no version attribute" || bad "other component root ($(attrs 0))"

tp=$(trace grok 0 "$TMP/claude-env.json")
{ [ -z "$tp" ] && [ ! -f "$TMP/curl/body" ]; } && ok "non-claude: no TRACEPARENT, no root span" || bad "non-claude should not trace"

# --- claude adapter: startup delay hook while tracing ------------------------
mkdir -p "$TMP/fbin" "$TMP/rh"
cat > "$TMP/fbin/claude" <<'STUB'
#!/usr/bin/env bash
cat >/dev/null
printf '%s\n' "$@" > "$FAKE_ARGV"
printf '%s\n' "${CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS:-unset}" > "$FAKE_ARGV.wait"
echo '{"type":"result","result":"ok","is_error":false}'
STUB
chmod +x "$TMP/fbin/claude"
printf 'hi' > "$TMP/prompt"
adapter() { rm -f "$TMP/argv"; env -i PATH="$TMP/fbin:$PATH" HOME="$HOME" FAKE_ARGV="$TMP/argv" \
  RH_LIB="$ROOT/harness-adapter/lib" RH_TMPDIR="$TMP/rh" RH_PROMPT_FILE="$TMP/prompt" RH_MODE=write "$@" \
  bash "$ROOT/harness-adapter/adapters/claude.sh" >/dev/null 2>&1; }
adapter CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_TRACES_EXPORTER=otlp
grep -q '"SessionStart".*"sleep 1"' "$TMP/argv" && ok "tracing on: SessionStart sleep 1 hook" || bad "tracing on: expected the startup hook"
adapter CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_TRACES_EXPORTER=otlp AEON_OTEL_STARTUP_DELAY=0
grep -q SessionStart "$TMP/argv" && bad "AEON_OTEL_STARTUP_DELAY=0 should drop the hook" || ok "AEON_OTEL_STARTUP_DELAY=0 drops the hook"
adapter
grep -q SessionStart "$TMP/argv" && bad "tracing off should add no hook" || ok "tracing off: no hook"
# Gateway failover attempts cap how long Claude Code waits out 429s; the first
# route keeps the unbounded watchdog wait, and an operator value wins.
[ "$(cat "$TMP/argv.wait")" = unset ] && ok "first route: no 429 wait cap" || bad "first route wait cap ($(cat "$TMP/argv.wait"))"
adapter AEON_GATEWAY_ATTEMPT=2
[ "$(cat "$TMP/argv.wait")" = 120000 ] && ok "failover attempt: 429 wait capped at 2 min" || bad "failover wait cap ($(cat "$TMP/argv.wait"))"
adapter AEON_GATEWAY_ATTEMPT=2 AEON_FAILOVER_MAX_WAIT_MS=30000
[ "$(cat "$TMP/argv.wait")" = 30000 ] && ok "AEON_FAILOVER_MAX_WAIT_MS sets the cap" || bad "failover wait knob ($(cat "$TMP/argv.wait"))"
adapter AEON_GATEWAY_ATTEMPT=2 CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS=5000
[ "$(cat "$TMP/argv.wait")" = 5000 ] && ok "operator CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS wins" || bad "operator wait value ($(cat "$TMP/argv.wait"))"

if [ "$FAIL" = 0 ]; then echo "All otel-span tests passed."; else echo "otel-span tests FAILED."; exit 1; fi

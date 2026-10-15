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
 "usage":{"input_tokens":30,"output_tokens":500,"cache_read_input_tokens":9000,"cache_creation_input_tokens":1000},
 "modelUsage":{"claude-sonnet-5-5":{"inputTokens":20,"outputTokens":450,"cacheReadInputTokens":8000,"cacheCreationInputTokens":900},
               "claude-haiku-5-5":{"inputTokens":10,"outputTokens":50,"cacheReadInputTokens":1000,"cacheCreationInputTokens":100}}}
JSON
TID=0123456789abcdef0123456789abcdef
trace() { # <harness> <rc> <envelope> -> prints TRACEPARENT seen by the harness
  rm -f "$TMP/curl/"*
  env -i PATH="$TMP/cbin:$PATH" HOME="$HOME" TMPDIR="$TMP" CURL_STUB_DIR="$TMP/curl" \
    RH_HARNESS="$1" RH_MODEL=claude-sonnet-5-5 AEON_LF_TRACE_ID="$TID" \
    OTEL_EXPORTER_OTLP_ENDPOINT="https://lf.invalid/api/public/otel" \
    OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic c2VjcmV0OnBhc3M=,x-langfuse-ingestion-version=4" \
    OTEL_RESOURCE_ATTRIBUTES="service.name=aeon,aeon.component=skill-run,langfuse.session.id=77,aeon.skill=heartbeat,langfuse.trace.name=aeon:skill-run:heartbeat" \
    bash -c ". '$LIB'; rh_trace_begin; echo \"\${TRACEPARENT:-}\"; rh_trace_end '$2' /nonexistent '$3'"
}

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

tp=$(trace grok 0 "$TMP/claude-env.json")
{ [ -z "$tp" ] && [ ! -f "$TMP/curl/body" ]; } && ok "non-claude: no TRACEPARENT, no root span" || bad "non-claude should not trace"

# --- claude adapter: startup delay hook while tracing ------------------------
mkdir -p "$TMP/fbin" "$TMP/rh"
cat > "$TMP/fbin/claude" <<'STUB'
#!/usr/bin/env bash
cat >/dev/null
printf '%s\n' "$@" > "$FAKE_ARGV"
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

if [ "$FAIL" = 0 ]; then echo "All otel-span tests passed."; else echo "otel-span tests FAILED."; exit 1; fi

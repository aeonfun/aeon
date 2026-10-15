# shellcheck shell=bash
# otel-span.sh - emit one OpenTelemetry span per non-claude harness run, and the
# root span + token usage for a claude run (rh_trace_begin / rh_trace_end below).
#
# SOURCED by run-harness (never executed). Opt-in + no-op, mirroring aeon's
# scripts/langfuse-otel.sh: it emits nothing unless ALL of these hold, and it
# NEVER fails the caller (every path returns 0 / is `|| true`-guarded):
#   • OTEL_EXPORTER_OTLP_ENDPOINT is set (the same env the shim exports)
#   • the harness is NOT claude — Claude Code emits its own OTEL spans natively,
#     so tracing it here would double-count; this fills the gap for the other
#     six harnesses (grok/codex/pi/vibe/kimi/fx), which emit nothing on their own
#   • `otel-cli` is on PATH (the shell OTLP emitter; staged by
#     scripts/install-otel-cli.sh in CI) and `jq` is available to read usage
#
# WHY otel-cli: bash can't speak OTLP/protobuf, and Langfuse's endpoint rejects
# OTLP/JSON — so a hand-rolled curl won't ingest. otel-cli emits protobuf over
# HTTP and reads OTEL_EXPORTER_OTLP_ENDPOINT / _HEADERS / _PROTOCOL from the
# environment, exactly as langfuse-otel.sh sets them.
#
# CONTENT: only numeric usage + model + harness are recorded as gen_ai.*
# attributes. The prompt and the result text are NEVER put on the span.

# A timestamp otel-cli accepts for --start/--end: Unix epoch "seconds.fraction"
# (its docs' canonical form is `date +%s.%N`). NOT bare nanoseconds — otel-cli
# misparses a plain 19-digit integer into a far-future time. GNU date supports
# %N; BSD/macOS date leaves a literal "N", so fall back to whole seconds there
# (otel-cli accepts a plain epoch-seconds integer too).
_rh_now() {
  local t
  t=$(date +%s.%N 2>/dev/null)
  case "$t" in
    *[!0-9.]* | "") date +%s ;;
    *) echo "$t" ;;
  esac
}

# rh_emit_harness_span <envelope_file> <start_ns> <end_ns>
# Reads .usage / .total_cost_usd from the run-harness envelope and emits a span.
rh_emit_harness_span() {
  [ "${RH_HARNESS:-}" = claude ] && return 0
  [ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ] || return 0
  command -v otel-cli >/dev/null 2>&1 || return 0
  command -v jq >/dev/null 2>&1 || return 0

  local ef="${1:-}" start="${2:-}" end="${3:-}"
  [ -f "$ef" ] || return 0

  local model="${RH_MODEL:-}"; [ -n "$model" ] || model=default
  local it ot cr cc cost
  it=$(jq -r '.usage.input_tokens // 0' "$ef" 2>/dev/null) || return 0
  ot=$(jq -r '.usage.output_tokens // 0' "$ef" 2>/dev/null) || return 0
  cr=$(jq -r '.usage.cache_read_input_tokens // 0' "$ef" 2>/dev/null) || return 0
  cc=$(jq -r '.usage.cache_creation_input_tokens // 0' "$ef" 2>/dev/null) || return 0
  cost=$(jq -r '.total_cost_usd // 0' "$ef" 2>/dev/null) || return 0

  otel-cli span \
    --service "${OTEL_SERVICE_NAME:-aeon-harness}" \
    --name "gen_ai.chat ${RH_HARNESS}" \
    --kind client \
    --start "$start" --end "$end" \
    --attrs "gen_ai.system=${RH_HARNESS},gen_ai.operation.name=chat,gen_ai.request.model=${model},gen_ai.usage.input_tokens=${it},gen_ai.usage.output_tokens=${ot},gen_ai.usage.cache_read_input_tokens=${cr},gen_ai.usage.cache_creation_input_tokens=${cc},aeon.harness=${RH_HARNESS},aeon.cost_usd=${cost},aeon.component=${AEON_OTEL_COMPONENT:-harness}" \
    >/dev/null 2>&1 || true
}

# --- claude: one root span per run + real token usage -----------------------
# Claude Code exports its own spans, but Langfuse gets two things wrong from them:
#   • usage: Claude Code writes token counts as input_tokens / output_tokens /
#     cache_*_tokens; Langfuse reads only gen_ai.usage.*, so every claude
#     generation lands with 0 tokens and $0.
#   • naming: a run is several traces (skill run, scorer, feed) with no root of
#     our own to carry the skill name, tags or the scorer's score.
# So for claude, run-harness wraps the call in a root span it sends itself after
# the run, with one GENERATION child per model carrying the run's token counts
# (the envelope's modelUsage). Langfuse prices those from its own model table;
# Claude Code's total_cost_usd is only recorded as aeon.cost_usd_reported, since
# it misprices model ids it does not know yet. TRACEPARENT puts Claude Code's own
# interaction span under this root (it needs the claude adapter's startup delay,
# see adapters/claude.sh, or the interaction span starts on a no-op tracer).
#
# Sent as OTLP/JSON with curl + jq, not otel-cli: otel-cli writes an all-zero
# parent id (so Langfuse never sees its span as a root) and fails on Langfuse's
# JSON reply. Never prompt or result text: names, model ids and counts only.

_rh_hex() { od -An -N"$1" -tx1 /dev/urandom 2>/dev/null | tr -d ' \n'; }

_rh_now_ns() {
  local t
  t=$(date +%s%N 2>/dev/null)
  case "$t" in
    *[!0-9]* | "") echo "$(date +%s)000000000" ;;
    *) echo "$t" ;;
  esac
}

# rh_trace_begin: claude only. Picks the root span ids and exports TRACEPARENT
# for the Claude Code process. Trace id: AEON_LF_TRACE_ID when the caller set one
# (scripts/langfuse-otel.sh derives it from the run, so the scorer can attach its
# score to the same trace), else the caller's TRACEPARENT trace, else random.
rh_trace_begin() {
  RH_ROOT_SPAN_ID=""
  [ "${RH_HARNESS:-}" = claude ] || return 0
  [ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ] || return 0
  command -v curl >/dev/null 2>&1 || return 0
  command -v jq >/dev/null 2>&1 || return 0
  local tid="${AEON_LF_TRACE_ID:-}" sid
  RH_ROOT_PARENT_ID=""
  if [[ "${TRACEPARENT:-}" =~ ^00-([0-9a-f]{32})-([0-9a-f]{16})-0[0-9a-f]$ ]]; then
    tid="${BASH_REMATCH[1]}" RH_ROOT_PARENT_ID="${BASH_REMATCH[2]}"
  fi
  [[ "$tid" =~ ^[0-9a-f]{32}$ ]] || tid=$(_rh_hex 16)
  sid=$(_rh_hex 8)
  [[ "$tid" =~ ^[0-9a-f]{32}$ && "$sid" =~ ^[0-9a-f]{16}$ ]] || return 0
  RH_ROOT_TRACE_ID="$tid" RH_ROOT_SPAN_ID="$sid" RH_ROOT_START_NS=$(_rh_now_ns)
  export TRACEPARENT="00-${tid}-${sid}-01"
}

# rh_trace_end <exit_code> <envelope_file>...: sends the root span and one
# usage generation per model. Reads usage from the first file that holds a JSON
# object with usage (run-harness passes the envelope, then the adapter's raw
# output, which is all a failed run leaves). Always returns 0.
rh_trace_end() {
  [ -n "${RH_ROOT_SPAN_ID:-}" ] || return 0
  local rc="${1:-0}" f ef="" end body url gids
  shift
  end=$(_rh_now_ns)
  for f in "$@"; do
    if [ -s "$f" ] && jq -e 'type == "object" and (has("usage") or has("modelUsage"))' "$f" >/dev/null 2>&1; then
      ef="$f"
      break
    fi
  done
  gids=$(for _ in 1 2 3 4 5 6 7 8; do _rh_hex 8; echo; done | jq -R . | jq -sc .)
  body=$(mktemp "${TMPDIR:-/tmp}/rh-trace.XXXXXX") || return 0
  if ! jq -n --slurpfile envl "${ef:-/dev/null}" \
    --arg tid "$RH_ROOT_TRACE_ID" --arg sid "$RH_ROOT_SPAN_ID" --arg parent "${RH_ROOT_PARENT_ID:-}" \
    --arg start "$RH_ROOT_START_NS" --arg end "$end" --arg rc "$rc" \
    --arg model "${RH_MODEL:-default}" --arg res "${OTEL_RESOURCE_ATTRIBUTES:-}" \
    --arg svc "${OTEL_SERVICE_NAME:-aeon}" --arg comp "${AEON_OTEL_COMPONENT:-skill-run}" \
    --argjson gids "$gids" '
    def s($k; $v): {key: $k, value: {stringValue: ($v | tostring)}};
    def i($k; $v): {key: $k, value: {intValue: ($v | tostring)}};
    ($envl[0] // {}) as $e
    | [$res | split(",")[] | select(index("=")) | index("=") as $p | {k: .[:$p], v: .[$p + 1:]}] as $ra
    | ([$ra[] | {(.k): .v}] | add // {}) as $rm
    | ($rm["langfuse.trace.name"] // ("aeon:" + $comp)) as $name
    # Langfuse reads session / user / trace name from span attributes, so copy
    # the langfuse.* resource attributes onto both spans (Claude Code does too).
    | [$ra[] | select(.k | startswith("langfuse.")) | select(.k != "langfuse.trace.name") | s(.k; .v)] as $lfa
    | ((($e.modelUsage // {}) | to_entries | map({m: .key, in: (.value.inputTokens // 0), out: (.value.outputTokens // 0),
          cr: (.value.cacheReadInputTokens // 0), cc: (.value.cacheCreationInputTokens // 0)}))
       | if length > 0 then .
         elif $e.usage then [{m: $model, in: ($e.usage.input_tokens // 0), out: ($e.usage.output_tokens // 0),
           cr: ($e.usage.cache_read_input_tokens // 0), cc: ($e.usage.cache_creation_input_tokens // 0)}]
         else [] end) as $gens
    | ($rc != "0" or $e.is_error == true) as $err
    | ([("skill:" + ($rm["aeon.skill"] // empty)), ("component:" + ($rm["aeon.component"] // $comp))]) as $tags
    | {resourceSpans: [{
        resource: {attributes: ([$ra[] | s(.k; .v)] + (if $rm["service.name"] then [] else [s("service.name"; $svc)] end))},
        scopeSpans: [{scope: {name: "aeon.run-harness"}, spans: (
          [{traceId: $tid, spanId: $sid, name: $name, kind: 1,
            startTimeUnixNano: $start, endTimeUnixNano: $end,
            attributes: ($lfa + [s("langfuse.trace.name"; $name), s("aeon.harness"; "claude"), s("aeon.model"; $model),
                i("aeon.exit_code"; ($rc | tonumber? // 1)),
                {key: "langfuse.trace.tags", value: {arrayValue: {values: [$tags[] | {stringValue: .}]}}}]
              + (if $e.num_turns then [i("aeon.num_turns"; $e.num_turns)] else [] end)
              + (if ($e.total_cost_usd | type) == "number" then [{key: "aeon.cost_usd_reported", value: {doubleValue: $e.total_cost_usd}}] else [] end)
              + (if $err then [s("langfuse.observation.level"; "ERROR")] else [] end)),
            status: {code: (if $err then 2 else 1 end)}}
           + (if $parent != "" then {parentSpanId: $parent} else {} end)]
          + [$gens | to_entries[] | select(.key < ($gids | length)) | .key as $n | .value as $g
             | {traceId: $tid, spanId: $gids[$n], parentSpanId: $sid, name: ("usage " + $g.m), kind: 3,
                startTimeUnixNano: $start, endTimeUnixNano: $end,
                # Langfuse treats gen_ai.usage.input_tokens as cache-inclusive and
                # subtracts the two cache counts from it; Anthropic reports input
                # without cache, so send the sum to get the real input back.
                attributes: ($lfa + [s("langfuse.observation.type"; "generation"), s("gen_ai.system"; "anthropic"),
                  s("gen_ai.request.model"; $g.m), s("gen_ai.response.model"; $g.m),
                  i("gen_ai.usage.input_tokens"; $g.in + $g.cr + $g.cc), i("gen_ai.usage.output_tokens"; $g.out),
                  i("gen_ai.usage.cache_read_input_tokens"; $g.cr), i("gen_ai.usage.cache_creation_input_tokens"; $g.cc)])}]
        )}]}]}' > "$body" 2>/dev/null; then
    rm -f "$body"
    return 0
  fi
  url="${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:-${OTEL_EXPORTER_OTLP_ENDPOINT%/}/v1/traces}"
  # Headers go in on stdin (one per line), so the auth value never sits in argv.
  printf '%s\n' "${OTEL_EXPORTER_OTLP_HEADERS:-}" | tr ',' '\n' | sed -n 's/^\([^=]*\)=\(.*\)$/\1: \2/p' |
    curl -sS -m 10 -o /dev/null -X POST -H @- -H 'Content-Type: application/json' \
      --data-binary @"$body" "$url" >/dev/null 2>&1 || true
  rm -f "$body"
  RH_ROOT_SPAN_ID=""
  return 0
}

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

# jq def error_class: free text -> one of the error classes every Langfuse sender
# shares (timeout, rate_limit, credits, auth, upstream_error, network,
# bad_request, not_found, parse, empty_output, no_tool_call, context_limit,
# refusal, tool_denied, tool_failed, budget_cap, breaker, cancelled, other,
# plan_limit).
# plan_limit = a subscription's usage cap (Claude's "You've hit your weekly limit",
# usage_limit_reached): it lasts until the plan resets, unlike a short rate_limit.
# The shared rule table, first match wins, on the first 400 chars; the Langfuse
# error_class evaluator uses the same table. Keep the order.
read -r -d '' _RH_ERROR_CLASS_JQ <<'JQ' || true
def error_class:
  ((if type == "string" then . else "" end)[0:400]) as $h
  | if ($h | test("\\S") | not) then "other"
    else first([
      ["refusal", "refusal \\(|usage policy|violative|content (policy|filter)|safety system"],
      ["tool_denied", "^denied:|permission for this|doesn't want to proceed|permission denied by|not allowed by|denied by (the )?(user|classifier|policy)"],
      ["tool_denied", "^blocked:|hook error|blocked by (a )?hook|isolated in the worktree|cannot create agent worktree"],
      ["bad_request", "has not been read yet|string to replace|inputvalidationerror|file has been modified since"],
      ["timeout", "time ?out|timed out|deadline|etimedout|wall_timeout|exceeded .*timeout|\\brc 124\\b|^timeout$"],
      ["plan_limit", "usage_limit_(reached|exceeded)|(hit|reached) your ([\\w-]+ )?(usage |session )?limit|(weekly|daily|monthly|5-hour|plan|subscription) (usage )?limit"],
      ["credits", "credits_exhausted|quota_exceeded|\\b402\\b|insufficient (credit|fund|balance)|payment required|out of credits|credit balance"],
      ["rate_limit", "\\b429\\b|rate.?limit|too many requests|throttl|quota|resource_exhausted"],
      ["auth", "requires? a personal token|api key required|missing (api )?key|\\b40[13]\\b|unauthori[sz]ed|forbidden|invalid (api )?key|authenticat|login expired|token expired|not logged in"],
      ["upstream_error", "\\b5(0[0-9]|2[0-9])\\b|provider returned error|finish_reason=error|^provider \\d+|bad gateway|service unavailable|internal server error|overloaded|upstream|<!doctype html|cloudflare|gateway"],
      ["cancelled", "client has disconnected"],
      ["network", "econnreset|econnrefused|enotfound|socket|connection (reset|refused|error|closed)|fetch failed|network|dns|ssl|tls"],
      ["context_limit", "context (length|window)|too long|max(imum)? ?tokens|prompt is too long|finish_reason.?length|truncat"],
      ["budget_cap", "budget|max_turns|max turns|spend cap|cost cap|limit reached|session limit|usage limit|error_max"],
      ["no_tool_call", "no.?tool.?call|without (a )?tool call"],
      ["empty_output", "empty (completion|response|output|reply|content|result|translation)|translation failed|no content|returned empty|no output"],
      ["bad_request", "missing required param|invalid format|must be a|no valid address|reasoning is mandatory|\\b400\\b|bad request|invalid (argument|param|request|input)|unsupported"],
      ["parse", "unterminated string|expecting (value|property)|json|parse|decod|unexpected token|malformed|invalid format|schema|validation|pydantic|could not extract"],
      ["not_found", "no \\w+ found|\\b404\\b|not found|no such file|enoent|does not exist|unknown (tool|model|route)"],
      ["breaker", "too_many_failures|circuit (open|breaker)|route blocked"],
      ["cancelled", "cancel|abort|interrupt|killed|sigterm"],
      ["tool_failed", "shell command failed|^exit_code:|exit code|exited with code|command exited|^exit \\d+"],
      ["tool_failed", "^error:|<tool_use_error>|error_during_execution"]
    ][] | select(.[1] as $re | $h | test("(?m)" + $re; "i")) | .[0]) // "other"
    end;
JQ

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
  local rc="${1:-0}" f ef="" raw="" end body url gids
  shift
  end=$(_rh_now_ns)
  for f in "$@"; do
    if [ -s "$f" ] && jq -e 'type == "object" and (has("usage") or has("modelUsage"))' "$f" >/dev/null 2>&1; then
      ef="$f"
      break
    fi
  done
  # No usage envelope (a run that died early, e.g. a login error printed as
  # text): the head of the first non-empty output, read only to pick the error
  # class, never sent.
  if [ -z "$ef" ] && [ "$rc" != 0 ]; then
    for f in "$@"; do
      if [ -s "$f" ]; then
        raw=$(head -c 400 "$f" 2>/dev/null | tr -d '\000')
        break
      fi
    done
  fi
  gids=$(for _ in 1 2 3 4 5 6 7 8; do _rh_hex 8; echo; done | jq -R . | jq -sc .)
  body=$(mktemp "${TMPDIR:-/tmp}/rh-trace.XXXXXX") || return 0
  if ! jq -n --slurpfile envl "${ef:-/dev/null}" \
    --arg tid "$RH_ROOT_TRACE_ID" --arg sid "$RH_ROOT_SPAN_ID" --arg parent "${RH_ROOT_PARENT_ID:-}" \
    --arg start "$RH_ROOT_START_NS" --arg end "$end" --arg rc "$rc" \
    --arg model "${RH_MODEL:-default}" --arg res "${OTEL_RESOURCE_ATTRIBUTES:-}" \
    --arg svc "${OTEL_SERVICE_NAME:-aeon}" --arg comp "${AEON_OTEL_COMPONENT:-skill-run}" \
    --arg ver "${AEON_LF_VERSION:-}" --arg raw "$raw" \
    --argjson gids "$gids" "$_RH_ERROR_CLASS_JQ"'
    def s($k; $v): {key: $k, value: {stringValue: ($v | tostring)}};
    def i($k; $v): {key: $k, value: {intValue: ($v | tostring)}};
    ($envl[0] // {}) as $e
    | [$res | split(",")[] | select(index("=")) | index("=") as $p | {k: .[:$p], v: .[$p + 1:]}] as $ra
    | ([$ra[] | {(.k): .v}] | add // {}) as $rm
    | ($rm["langfuse.trace.name"] // ("aeon:" + $comp)) as $name
    | ($rm["aeon.component"] // $comp) as $component
    | ($rc != "0" or $e.is_error == true) as $err
    # Why a run failed, for the root span: rc 124 for the run-harness timeout, the
    # result subtype (error_max_turns, error_during_execution), the exit code, or
    # the API error status.
    | (if $rc == "124" then "rc 124"
       elif ($e.subtype | type) == "string" and ($e.subtype | startswith("error")) then $e.subtype
       elif $rc != "0" then "exit " + $rc
       elif $e.api_error_status then "api_error " + ($e.api_error_status | tostring)
       else "is_error" end) as $why
    # Error class (shared Langfuse classes): structured facts first (rc 124, the
    # result subtype, the API status), then the result text, then $why. The text
    # only picks the class; it is never sent.
    | (($e.result | if type == "string" then . else "" end) | if . == "" then $raw else . end) as $text
    | (($e.api_error_status // "") | tostring) as $api
    | (if ($err | not) then ""
       elif $rc == "124" then "timeout"
       elif ($e.subtype | type) == "string" and ($e.subtype | startswith("error_max")) then "budget_cap"
       # A spent plan also answers 429, so check it before the 429 rule.
       elif $e.api_error == "usage_limit_reached" or ($text | error_class) == "plan_limit" then "plan_limit"
       elif $api == "429" then "rate_limit"
       elif $api == "401" or $api == "403" then "auth"
       elif $api == "402" then "credits"
       elif $api != "" then "upstream_error"
       elif $e.subtype == "error_during_execution" then "tool_failed"
       # Claude Code prints these for an expired or missing login, in words the
       # shared table does not cover.
       elif $text | test("run /login|oauth token"; "i") then "auth"
       else ($text | error_class) as $c
         | if $c != "other" then $c else ($why | error_class) end
       end) as $class
    # Gateway cascade (aeon.yml Run step): which provider this attempt used and
    # its place in the cascade, so a failover attempt reads as one.
    | ($rm["aeon.gateway"] // "") as $gw
    | (($rm["aeon.gateway_attempt"] // "1") | tonumber? // 1) as $att
    | ([("skill:" + ($rm["aeon.skill"] // empty)), ("component:" + $component)]
       + (if $gw != "" then ["gateway:" + $gw] else [] end)
       + (if $att > 1 then ["failover"] else [] end)
       + (if $err then ["status:error"] else [] end)) as $tags
    # Langfuse keeps trace-level fields per observation and reads session / user /
    # release / trace name / tags from span attributes, so the langfuse.* resource
    # attributes, the trace name, the tags and the skill version go on every span
    # we send (the usage rows carry the cost, so they need them to group by skill).
    | ([$ra[] | select(.k | startswith("langfuse.")) | select(.k != "langfuse.trace.name") | s(.k; .v)]
       + [s("langfuse.trace.name"; $name),
          {key: "langfuse.trace.tags", value: {arrayValue: {values: [$tags[] | {stringValue: .}]}}}]
       + (if $ver != "" then [s("langfuse.version"; $ver)] else [] end)
       + (if $gw != "" then [s("langfuse.observation.metadata.gateway"; $gw),
           i("langfuse.observation.metadata.gateway_attempt"; $att)] else [] end)) as $lfa
    | ((($e.modelUsage // {}) | to_entries | map({m: .key, in: (.value.inputTokens // 0), out: (.value.outputTokens // 0),
          cr: (.value.cacheReadInputTokens // 0), cc: (.value.cacheCreationInputTokens // 0)}))
       | if length > 0 then .
         elif $e.usage then [{m: $model, in: ($e.usage.input_tokens // 0), out: ($e.usage.output_tokens // 0),
           cr: ($e.usage.cache_read_input_tokens // 0), cc: ($e.usage.cache_creation_input_tokens // 0)}]
         else [] end) as $gens
    # Cache-write TTL split. Only the top-level usage has it (modelUsage gives one
    # cacheCreationInputTokens per model), so each model gets the 1h share of the run
    # of its writes. Claude Code writes 1h caches, priced 2x input vs 1.25x for 5m.
    | [($e.usage.cache_creation.ephemeral_1h_input_tokens // 0), ($e.usage.cache_creation.ephemeral_5m_input_tokens // 0)] as [$w1h, $w5m]
    | {resourceSpans: [{
        resource: {attributes: ([$ra[] | s(.k; .v)] + (if $rm["service.name"] then [] else [s("service.name"; $svc)] end))},
        scopeSpans: [{scope: {name: "aeon.run-harness"}, spans: (
          [{traceId: $tid, spanId: $sid, name: $name, kind: 1,
            startTimeUnixNano: $start, endTimeUnixNano: $end,
            attributes: ($lfa + [s("aeon.harness"; "claude"), s("aeon.model"; $model),
                i("aeon.exit_code"; ($rc | tonumber? // 1))]
              # agent for the skill run, evaluator for the scorer (type filter, agent graph).
              + (({"skill-run": "agent", scorer: "evaluator"}[$component] // "") as $t
                 | if $t != "" then [s("langfuse.observation.type"; $t)] else [] end)
              + (if $e.num_turns then [i("aeon.num_turns"; $e.num_turns)] else [] end)
              + (if ($e.total_cost_usd | type) == "number" then [{key: "aeon.cost_usd_reported", value: {doubleValue: $e.total_cost_usd}}] else [] end)
              # Tool calls the allowlist refused this run (count only, never the inputs).
              + (if ($e.permission_denials | type) == "array" then [i("langfuse.observation.metadata.permission_denials"; $e.permission_denials | length)] else [] end)
              + (if $err then [s("langfuse.observation.level"; "ERROR"),
                  s("langfuse.observation.status_message"; ($class + ": " + $why
                    + (if $att > 1 then " (failover to " + $gw + ")" else "" end))[0:200]),
                  s("langfuse.observation.metadata.error_class"; $class)] else [] end)),
            status: {code: (if $err then 2 else 1 end)}}
           + (if $parent != "" then {parentSpanId: $parent} else {} end)]
          + [$gens | to_entries[] | select(.key < ($gids | length)) | .key as $n | .value as $g
             # langfuse.observation.usage_details wins over the gen_ai.usage.* counts
             # in Langfuse and names the priced keys, so 1h cache writes get the 1h
             # price (gen_ai.usage.* has one cache-write count, priced at the 5m
             # rate). Without a TTL split it sends the one count as before.
             | (if ($w1h + $w5m) > 0 and $g.cc > 0
                then (($g.cc * $w1h / ($w1h + $w5m)) | round) as $c1h
                  | {input_cache_creation_1h: $c1h, input_cache_creation_5m: ($g.cc - $c1h)}
                else {input_cache_creation: $g.cc} end) as $cw
             # Zero-length at the end of the run: the row is a per-run token rollup,
             # not a model call, so giving it the whole run duration skewed the
             # per-model latency charts. metadata.rollup lets views filter it out.
             | {traceId: $tid, spanId: $gids[$n], parentSpanId: $sid, name: ("usage " + $g.m), kind: 3,
                startTimeUnixNano: $end, endTimeUnixNano: $end,
                # The gen_ai.usage.* counts stay for other OTLP backends. They read
                # input_tokens as cache-inclusive and subtract the two cache counts;
                # Anthropic reports input without cache, so send the sum.
                attributes: ($lfa + [s("langfuse.observation.type"; "generation"), s("gen_ai.system"; "anthropic"),
                  s("langfuse.observation.metadata.rollup"; "true"),
                  s("gen_ai.request.model"; $g.m), s("gen_ai.response.model"; $g.m),
                  s("langfuse.observation.usage_details"; {input: $g.in, output: $g.out, input_cache_read: $g.cr} + $cw | tojson),
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

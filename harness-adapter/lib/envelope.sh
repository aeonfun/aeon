# envelope.sh — emit/validate the Claude Code-compatible JSON envelope.
#
# The contract every adapter must satisfy on stdout:
#   { "result": "<text>",
#     "usage": { "input_tokens": N, "output_tokens": N,
#                "cache_read_input_tokens": N, "cache_creation_input_tokens": N },
#     "session_id": "<optional>", "total_cost_usd": <optional> }
# Diagnostics go to stderr. Exit 0 on success; non-zero on failure; an abnormal
# model stop with no output must FAIL, never emit partial-as-success.

emit_envelope() {
  # emit_envelope RESULT INPUT OUTPUT CACHE_READ CACHE_CREATION [COST] [SESSION_ID]
  local result="$1" tin="${2:-0}" tout="${3:-0}" tcr="${4:-0}" tcc="${5:-0}" cost="${6:-}" sid="${7:-}"
  local n
  for n in tin tout tcr tcc; do   # guard non-numeric extractions back to 0
    case "${!n}" in ''|*[!0-9]*) printf -v "$n" 0 ;; esac
  done
  jq -cn --arg result "$result" \
    --argjson tin "$tin" --argjson tout "$tout" --argjson tcr "$tcr" --argjson tcc "$tcc" \
    --arg cost "$cost" --arg sid "$sid" '
    {result: $result,
     usage: {input_tokens: $tin, output_tokens: $tout,
             cache_read_input_tokens: $tcr, cache_creation_input_tokens: $tcc}}
    + (if $sid != "" then {session_id: $sid} else {} end)
    + (if ($cost != "") and ($cost | test("^[0-9]+(\\.[0-9]+)?$")) then {total_cost_usd: ($cost | tonumber)} else {} end)'
}

validate_envelope() {
  # reads an envelope on stdin; exit 0 iff it satisfies the contract
  jq -e '
    type == "object"
    and (.result | type == "string")
    and (.usage | type == "object")
    and ([.usage.input_tokens, .usage.output_tokens,
          .usage.cache_read_input_tokens, .usage.cache_creation_input_tokens]
         | all(type == "number"))' >/dev/null
}

wrap_raw_output() {
  # last-resort fallback: wrap arbitrary stdout as a best-effort envelope, so a
  # shape change never silently looks like "no output" (pattern from aeon's run-grok.sh)
  jq -Rsc '{result: ., usage: {input_tokens: 0, output_tokens: 0,
            cache_read_input_tokens: 0, cache_creation_input_tokens: 0}}'
}

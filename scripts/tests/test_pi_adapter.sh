#!/usr/bin/env bash
# Usage accounting for harness-adapter/adapters/pi.sh.
#
# pi reports usage per LLM call: every assistant `message_end` event of its
# `--mode json` stream carries that one call's usage (pi-ai's Usage type:
# input / output / cacheRead / cacheWrite / cost.total). A multi-turn run
# (tool call, tool result, next call, ...) therefore has several of them, and
# the run's true usage is their SUM. The adapter used to keep only the last
# one, so a 3-turn run reported one turn's tokens and cost.
#
# A fake `pi` on PATH replays a fixed multi-message event stream (shape taken
# from pi 0.99.2's agent-loop: session, agent_start, a user message_end, three
# assistant message_ends with usage, a toolResult message_end, agent_end).
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"

fail=0
ok() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

# Fake pi: replays $PI_FIXTURE on the first call and $PI_FIXTURE_RETRY (when
# set) on any later one, i.e. the structured-output retry. Counts its
# invocations in $PI_CALLS.
cat > "$TMP/bin/pi" <<'SH'
#!/usr/bin/env bash
echo x >> "$PI_CALLS"
if [ -n "${PI_FIXTURE_RETRY:-}" ] && [ "$(wc -l < "$PI_CALLS")" -gt 1 ]; then
  cat "$PI_FIXTURE_RETRY"
else
  cat "$PI_FIXTURE"
fi
SH
chmod +x "$TMP/bin/pi"
printf 'summarize the repo' > "$TMP/prompt"

# Three assistant turns. Turn 2 uses snake_case names (the defensive probing),
# turn 3 has a cost too small for jq's default number printing (1.2e-05).
cat > "$TMP/multi.jsonl" <<'JSONL'
{"type":"session","id":"pi-sess-1"}
{"type":"agent_start"}
{"type":"message_end","message":{"role":"user","content":"summarize the repo"}}
{"type":"message_end","message":{"role":"assistant","content":[{"type":"toolCall","name":"bash"}],"usage":{"input":1000,"output":200,"cacheRead":50,"cacheWrite":10,"totalTokens":1260,"cost":{"input":0.003,"output":0.003,"cacheRead":0,"cacheWrite":0,"total":0.006}}}}
{"type":"message_end","message":{"role":"toolResult","content":[{"type":"text","text":"README.md"}]}}
{"type":"message_end","message":{"role":"assistant","content":[{"type":"toolCall","name":"read"}],"usage":{"input_tokens":2000,"output_tokens":300,"cache_read":400,"cache_write":20,"cost":{"total":0.0105}}}}
not json noise from a provider
{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"The repo "},{"type":"text","text":"is aeon."}],"usage":{"input":3000,"output":500,"cacheRead":600,"cacheWrite":30,"cost":{"total":0.000012}}}}
{"type":"agent_end","messages":[]}
JSONL

run_pi() {
  # run_pi FIXTURE [RETRY_FIXTURE] [JSON_SCHEMA] -> envelope on stdout
  local tmpd
  tmpd=$(mktemp -d "$TMP/rh.XXXXXX")
  : > "$TMP/calls"
  PI_FIXTURE="$1" PI_FIXTURE_RETRY="${2:-}" PI_CALLS="$TMP/calls" \
    PATH="$TMP/bin:$PATH" \
    RH_LIB="$ROOT/harness-adapter/lib" RH_TMPDIR="$tmpd" RH_PROMPT_FILE="$TMP/prompt" \
    RH_MODE=read-only RH_JSON_SCHEMA="${3:-}" \
    bash "$ROOT/harness-adapter/adapters/pi.sh" 2>"$TMP/stderr"
}

ENV_OUT=$(run_pi "$TMP/multi.jsonl")
if jq -e . >/dev/null 2>&1 <<<"$ENV_OUT"; then ok "adapter emits a JSON envelope"; else bad "no JSON envelope: $ENV_OUT $(cat "$TMP/stderr")"; fi
got() { jq -r "$1" <<<"$ENV_OUT"; }
[ "$(got .usage.input_tokens)" = 6000 ] && ok "input tokens summed over all 3 turns (6000)" \
  || bad "input_tokens=$(got .usage.input_tokens), want 6000 (last turn alone is 3000)"
[ "$(got .usage.output_tokens)" = 1000 ] && ok "output tokens summed (1000)" \
  || bad "output_tokens=$(got .usage.output_tokens), want 1000"
[ "$(got .usage.cache_read_input_tokens)" = 1050 ] && ok "cacheRead summed (1050)" \
  || bad "cache_read_input_tokens=$(got .usage.cache_read_input_tokens), want 1050"
[ "$(got .usage.cache_creation_input_tokens)" = 60 ] && ok "cacheWrite summed (60)" \
  || bad "cache_creation_input_tokens=$(got .usage.cache_creation_input_tokens), want 60"
[ "$(got '.total_cost_usd')" = 0.016512 ] && ok "cost.total summed (0.016512)" \
  || bad "total_cost_usd=$(got '.total_cost_usd // "absent"'), want 0.016512"
[ "$(got .result)" = "The repo is aeon." ] && ok "result is still the LAST assistant message's text" \
  || bad "result=$(got .result)"
[ "$(got .session_id)" = pi-sess-1 ] && ok "session id kept" || bad "session_id=$(got .session_id)"

# A tiny lone cost must survive as a decimal (jq 1.7 can print it as 1.2e-05,
# which emit_envelope's decimal check drops).
cat > "$TMP/tiny.jsonl" <<'JSONL'
{"type":"message_end","message":{"role":"assistant","content":"hi","usage":{"input":5,"output":1,"cost":{"total":0.000012}}}}
{"type":"agent_end"}
JSONL
ENV_OUT=$(run_pi "$TMP/tiny.jsonl")
[ "$(got '.total_cost_usd')" = 0.000012 ] && ok "a sub-1e-4 cost is kept, not dropped" \
  || bad "tiny cost: total_cost_usd=$(got '.total_cost_usd // "absent"')"

# No usage at all, and no cost: zeros, and no total_cost_usd key.
cat > "$TMP/nousage.jsonl" <<'JSONL'
{"type":"message_end","message":{"role":"assistant","content":"hi"}}
{"type":"agent_end"}
JSONL
ENV_OUT=$(run_pi "$TMP/nousage.jsonl")
[ "$(got .usage.input_tokens):$(got .usage.output_tokens)" = "0:0" ] && [ "$(got 'has("total_cost_usd")')" = false ] \
  && ok "no usage reported -> zeros, no cost key" || bad "no-usage envelope: $ENV_OUT"

# The structured-output retry is a second billed run: its usage adds on top.
cat > "$TMP/bad-json.jsonl" <<'JSONL'
{"type":"message_end","message":{"role":"assistant","content":"not json","usage":{"input":100,"output":10,"cost":{"total":0.001}}}}
{"type":"agent_end"}
JSONL
cat > "$TMP/good-json.jsonl" <<'JSONL'
{"type":"message_end","message":{"role":"assistant","content":"{\"score\": 4}","usage":{"input":200,"output":20,"cost":{"total":0.002}}}}
{"type":"agent_end"}
JSONL
ENV_OUT=$(run_pi "$TMP/bad-json.jsonl" "$TMP/good-json.jsonl" '{"type":"object","required":["score"]}')
[ "$(wc -l < "$TMP/calls" | tr -d ' ')" = 2 ] && ok "schema failure triggered exactly one retry" || bad "pi calls: $(wc -l < "$TMP/calls")"
[ "$(got .usage.input_tokens):$(got .usage.output_tokens):$(got .total_cost_usd)" = "300:30:0.003" ] \
  && ok "retry usage added to the first attempt (300/30/0.003)" \
  || bad "retry accounting: $(jq -c '{usage, total_cost_usd}' <<<"$ENV_OUT")"

[ "$fail" -eq 0 ] && echo "all pi adapter checks passed"
exit "$fail"

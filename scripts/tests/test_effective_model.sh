#!/usr/bin/env bash
# Tests for scripts/effective-model.sh: the model recorded for a run is the one
# the run's envelope reports, and a config-only value is labelled as requested.
# Run:  bash scripts/tests/test_effective_model.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/scripts/effective-model.sh"
pass=0; fail=0

field() { sed -n "s/^$1=//p"; }

# check <desc> <harness> <base model> <harness arg> <envelope> <want model> <want requested> <want source>
check() {
  local desc="$1" out model req src
  out=$(printf '%s' "$5" | bash "$SCRIPT" "$2" "$3" "$4" 2>/dev/null)
  model=$(printf '%s\n' "$out" | field SKILL_MODEL)
  req=$(printf '%s\n' "$out" | field SKILL_MODEL_REQUESTED)
  src=$(printf '%s\n' "$out" | field SKILL_MODEL_SOURCE)
  if [ "$model" = "$6" ] && [ "$req" = "$7" ] && [ "$src" = "$8" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); printf 'FAIL: %-50s got=%s/%s/%s want=%s/%s/%s\n' "$desc" "$model" "$req" "$src" "$6" "$7" "$8"
  fi
}
# c <desc> <envelope> <want model> <want source>: claude harness, config asked for opus
c() { check "$1" claude claude-opus-4-8 "" "$2" "$3" claude-opus-4-8 "$4"; }

c "single modelUsage key beats the request" \
  '{"modelUsage":{"anthropic/claude-sonnet-5.5":{"outputTokens":50}}}' anthropic/claude-sonnet-5.5 reported
c "most output tokens wins among several" \
  '{"modelUsage":{"claude-haiku-4-5":{"outputTokens":10},"claude-sonnet-5-5":{"outputTokens":900}}}' claude-sonnet-5-5 reported
c "adapter model field wins over modelUsage" \
  '{"model":"gpt-6-sol","modelUsage":{"other":{"outputTokens":1}}}' gpt-6-sol reported
c "no model anywhere keeps the request, labelled" \
  '{"result":"ok","usage":{"input_tokens":1}}' claude-opus-4-8 requested
c "empty modelUsage keeps the request" '{"modelUsage":{}}' claude-opus-4-8 requested
c "modelUsage that is not an object is ignored" '{"modelUsage":["a","b"]}' claude-opus-4-8 requested
c "non-string model field is ignored" '{"model":{"id":"x"}}' claude-opus-4-8 requested
c "context-window suffix is dropped from the name" \
  '{"modelUsage":{"claude-sonnet-5-5[1m]":{"outputTokens":5}}}' claude-sonnet-5-5 reported
c "a non-object modelUsage value does not discard the rest" \
  '{"modelUsage":{"a":{"outputTokens":5},"b":3}}' a reported
c "string outputTokens does not outrank numbers" \
  '{"modelUsage":{"a":{"outputTokens":"9"},"b":{"outputTokens":50}}}' b reported
c "a tie picks the lowest name, not the last key" \
  '{"modelUsage":{"zeta":{"outputTokens":7},"alpha":{"outputTokens":7}}}' alpha reported
c "entries without outputTokens still pick one by name" \
  '{"modelUsage":{"zeta":{},"alpha":{}}}' alpha reported
c "numeric model field is not a model id" '{"model":12345}' claude-opus-4-8 requested
c "modelUsage array of objects is not a model id" '{"modelUsage":[{"outputTokens":5}]}' claude-opus-4-8 requested
c "id starting with a dash is rejected" '{"model":"-cmd"}' claude-opus-4-8 requested
c "id starting with @ is rejected" '{"model":"@x"}' claude-opus-4-8 requested
c "reported id with shell characters is rejected" '{"model":"x;rm -rf /"}' claude-opus-4-8 requested
c "reported id over 100 chars is rejected" "{\"model\":\"$(printf 'a%.0s' $(seq 1 101))\"}" claude-opus-4-8 requested
c "non-JSON envelope keeps the request" 'not json at all' claude-opus-4-8 requested
c "empty envelope keeps the request" '' claude-opus-4-8 requested

# what the request is, per harness
check "claude requests the base model"    claude claude-opus-4-8 ""             '{"result":"ok"}' claude-opus-4-8 claude-opus-4-8 requested
check "grok requests the base model"      grok   grok-4.7        ""             '{"result":"ok"}' grok-4.7 grok-4.7 requested
check "claude ignores the harness arg"    claude claude-opus-4-8 stray-arg      '{"result":"ok"}' claude-opus-4-8 claude-opus-4-8 requested
check "grok ignores the harness arg"      grok   grok-4.7        stray-arg      '{"result":"ok"}' grok-4.7 grok-4.7 requested
check "adapter requests its model arg"    pi     claude-opus-4-8 openrouter/x-y '{"result":"ok"}' openrouter/x-y openrouter/x-y requested
check "adapter with no arg is <h>-default" pi    claude-opus-4-8 ""             '{"result":"ok"}' pi-default pi-default requested
check "codex reports over its default"    codex  claude-opus-4-8 ""             '{"model":"gpt-6-sol"}' gpt-6-sol codex-default reported
check "invalid request becomes unknown"   claude 'bad id;x' ""                  '{"result":"ok"}' unknown unknown requested
check "empty base model becomes unknown"  claude ""      ""                     '{"result":"ok"}' unknown unknown requested

# the warning appears exactly when nothing was reported
warn=$(printf '%s' '{"result":"ok"}' | bash "$SCRIPT" pi claude-opus-4-8 "" 2>&1 >/dev/null | grep -c '^::warning::pi reported no model')
quiet=$(printf '%s' '{"model":"gpt-6-sol"}' | bash "$SCRIPT" codex claude-opus-4-8 "" 2>&1 >/dev/null | grep -c '^::warning::')
if [ "$warn" = 1 ] && [ "$quiet" = 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: warning only when no model reported (warn=$warn quiet=$quiet)"; fi

# The workflow must call the helper with the harness, base model and model arg,
# and append its output to GITHUB_OUTPUT. Pull that call out of aeon.yml and run
# it, so a change to either side is caught here.
WF="$ROOT/.github/workflows/aeon.yml"
CALL=$(grep -F 'bash scripts/effective-model.sh' "$WF" | sed 's/^ *//')
if [ "$(printf '%s\n' "$CALL" | grep -c .)" != 1 ]; then
  fail=$((fail+1)); echo "FAIL: expected exactly one effective-model.sh call in aeon.yml"
else
  # wf <harness> <base model> <harness arg> <envelope> <want output lines, space separated>
  wf() {
    local gh got
    gh=$(mktemp)
    (cd "$ROOT" && HARNESS="$1" BASE_MODEL="$2" RH_MODEL_ARG="$3" CLAUDE_OUTPUT="$4" GITHUB_OUTPUT="$gh" bash -c "$CALL" >/dev/null 2>&1)
    got=$(tr '\n' ' ' <"$gh"); rm -f "$gh"
    if [ "$got" = "$5 " ]; then pass=$((pass+1)); else fail=$((fail+1)); printf 'FAIL: workflow call %s: got [%s] want [%s]\n' "$1" "$got" "$5"; fi
  }
  wf claude claude-opus-4-8 "" '{"modelUsage":{"anthropic/claude-sonnet-5.5":{"outputTokens":9}}}' \
     "SKILL_MODEL=anthropic/claude-sonnet-5.5 SKILL_MODEL_REQUESTED=claude-opus-4-8 SKILL_MODEL_SOURCE=reported"
  wf pi claude-opus-4-8 "openrouter/x-y" '{"result":"ok"}' \
     "SKILL_MODEL=openrouter/x-y SKILL_MODEL_REQUESTED=openrouter/x-y SKILL_MODEL_SOURCE=requested"
  wf codex claude-opus-4-8 "" '{"model":"gpt-6-sol"}' \
     "SKILL_MODEL=gpt-6-sol SKILL_MODEL_REQUESTED=codex-default SKILL_MODEL_SOURCE=reported"
fi

echo "effective-model: $pass passed, $fail failed"
[ "$fail" -eq 0 ]

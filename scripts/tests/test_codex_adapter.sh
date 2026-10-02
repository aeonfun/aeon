#!/usr/bin/env bash
# adapters/codex.sh: token normalization + the model codex actually ran.
#
# `codex exec --json` never names the model and its input_tokens includes the
# cached tokens. A fake codex emits the 0.159.3 event shapes and writes the
# session rollout the real CLI writes, so this runs offline.
#   Run: bash scripts/tests/test_codex_adapter.sh
set -uo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/codex-home"

# Fake codex: event stream on stdout (thread.started is only thread_id, as in
# codex-rs exec/src/exec_events.rs) and a rollout whose turn_context carries the
# model, at $CODEX_HOME/sessions/YYYY/MM/DD/rollout-<ts>-<thread_id>.jsonl.
cat > "$TMP/bin/codex" <<'SH'
#!/usr/bin/env bash
cat >/dev/null
echo "$*" >> "$CODEX_HOME/calls"
# FAKE_REFUSE=<id>: fail like a ChatGPT login refusing that --model.
if [ -n "${FAKE_REFUSE:-}" ] && [[ " $* " == *" --model $FAKE_REFUSE "* ]]; then
  printf '{"type":"thread.started","thread_id":"x"}\n'
  printf '{"type":"error","message":"{\\"status\\":400,\\"error\\":{\\"message\\":\\"The %s model is not supported when using Codex with a ChatGPT account.\\"}}"}\n' "$FAKE_REFUSE"
  printf '{"type":"turn.failed","error":{"message":"refused"}}\n'
  exit 1
fi
tid=01a0f9fb-46dd-7512-ac3f-c0938feaa1f9
d="$CODEX_HOME/sessions/2026/10/01"; mkdir -p "$d"
{
  printf '{"timestamp":"t","type":"session_meta","payload":{"id":"%s"}}\n' "$tid"
  printf '{"timestamp":"t","type":"turn_context","payload":{"cwd":"/w","model":"%s"}}\n' "$FAKE_MODEL"
  printf '{"timestamp":"t","type":"turn_context","payload":{"cwd":"/w","model":"later-model"}}\n'
} > "$d/rollout-2026-10-01T20-19-50-$tid.jsonl"
printf '{"type":"thread.started","thread_id":"%s"}\n' "$tid"
printf '{"type":"turn.started"}\n'
printf '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"done"}}\n'
printf '{"type":"turn.completed","usage":{"input_tokens":142972,"cached_input_tokens":109312,"cache_write_input_tokens":0,"output_tokens":1044,"reasoning_output_tokens":0}}\n'
SH
chmod +x "$TMP/bin/codex"
printf 'do it' > "$TMP/prompt"

run() {
  rm -rf "$TMP/rh" "$TMP/codex-home/sessions" "$TMP/codex-home/calls"; mkdir -p "$TMP/rh"
  FAKE_MODEL="$1" CODEX_HOME="$TMP/codex-home" PATH="$TMP/bin:$PATH" \
    RH_LIB="$ROOT/harness-adapter/lib" RH_TMPDIR="$TMP/rh" RH_PROMPT_FILE="$TMP/prompt" RH_MODE=write \
    bash "$ROOT/harness-adapter/adapters/codex.sh" 2>"$TMP/err"
}

OUT=$(run gpt-6-luna); rc=$?
[ "$rc" = 0 ] && [ "$(jq -r .result <<<"$OUT")" = "done" ] && pass "adapter succeeds" || bad "adapter failed (rc=$rc): $(cat "$TMP/err")"
[ "$(jq -r .model <<<"$OUT")" = "gpt-6-luna" ] \
  && pass "model comes from the rollout's first turn_context" || bad "model (got $(jq -c .model <<<"$OUT"))"
[ "$(jq -c '[.usage.input_tokens, .usage.cache_read_input_tokens, .usage.output_tokens]' <<<"$OUT")" = "[33660,109312,1044]" ] \
  && pass "input_tokens excludes cache reads (142972 - 109312)" || bad "usage $(jq -c .usage <<<"$OUT")"
if grep -E '^ARGS=.*--ephemeral' "$ROOT/harness-adapter/adapters/codex.sh" >/dev/null; then
  bad "codex still runs --ephemeral (no rollout to read the model from)"
else
  pass "codex runs without --ephemeral"
fi

# The rollout sits in rw ~/.codex during the run and the value lands in workflow
# outputs, so anything outside a model-id charset is dropped, not passed on.
OUT=$(run 'x$(id);y')
[ "$(jq -r '.model // "absent"' <<<"$OUT")" = "absent" ] \
  && pass "a non model-id value is dropped" || bad "unsafe model passed through: $(jq -c .model <<<"$OUT")"

# A model the account refuses: retry once without --model, warn, and succeed.
OUT=$(FAKE_REFUSE=gpt-5.6 RH_MODEL=gpt-5.6 run gpt-6.1-sol); rc=$?
[ "$rc" = 0 ] && [ "$(jq -r .result <<<"$OUT")" = "done" ] \
  && pass "refused model: retried and succeeded" || bad "refused-model retry (rc=$rc): $(cat "$TMP/err")"
[ "$(wc -l < "$TMP/codex-home/calls" | tr -d ' ')" = 2 ] && ! sed -n 2p "$TMP/codex-home/calls" | grep -q -- '--model' \
  && pass "retry drops --model" || bad "retry calls: $(cat "$TMP/codex-home/calls")"
grep -q '^::warning::codex refused model gpt-5.6; retried on the account default' "$TMP/err" \
  && pass "refused model is warned" || bad "no refusal warning: $(cat "$TMP/err")"
[ "$(jq -r .model <<<"$OUT")" = "gpt-6.1-sol" ] \
  && pass "envelope reports the default model that ran" || bad "retry model $(jq -c .model <<<"$OUT")"
# An accepted pick runs once, with --model.
OUT=$(RH_MODEL=gpt-6-luna run gpt-6-luna); rc=$?
[ "$rc" = 0 ] && [ "$(wc -l < "$TMP/codex-home/calls" | tr -d ' ')" = 1 ] && grep -q -- '--model gpt-6-luna' "$TMP/codex-home/calls" \
  && pass "accepted pick: one call with --model" || bad "accepted pick calls: $(cat "$TMP/codex-home/calls")"
# A failure that is not a model refusal is not retried.
cat > "$TMP/bin/codex-fail" <<'SH'
#!/usr/bin/env bash
cat >/dev/null
echo "$*" >> "$CODEX_HOME/calls"
printf '{"type":"error","message":"stream disconnected"}\n'
exit 1
SH
chmod +x "$TMP/bin/codex-fail"; cp "$TMP/bin/codex" "$TMP/bin/codex-ok"; cp "$TMP/bin/codex-fail" "$TMP/bin/codex"
RH_MODEL=gpt-6-luna run x >/dev/null; rc=$?
[ "$rc" != 0 ] && [ "$(wc -l < "$TMP/codex-home/calls" | tr -d ' ')" = 1 ] \
  && pass "other failures are not retried" || bad "non-refusal failure (rc=$rc, calls $(wc -l < "$TMP/codex-home/calls"))"
cp "$TMP/bin/codex-ok" "$TMP/bin/codex"

# No rollout (e.g. an older codex): no model field, run still succeeds.
cat > "$TMP/bin/codex" <<'SH'
#!/usr/bin/env bash
cat >/dev/null
printf '{"type":"thread.started","thread_id":"t1"}\n{"type":"item.completed","item":{"type":"agent_message","text":"done"}}\n{"type":"turn.completed","usage":{"input_tokens":5,"cached_input_tokens":9,"output_tokens":1}}\n'
SH
OUT=$(run unused); rc=$?
[ "$rc" = 0 ] && [ "$(jq -r '.model // "absent"' <<<"$OUT")" = "absent" ] \
  && pass "no rollout: no model, run still succeeds" || bad "no-rollout case (rc=$rc): $OUT"
[ "$(jq -r .usage.input_tokens <<<"$OUT")" = 0 ] \
  && pass "input never goes negative" || bad "negative input: $(jq -c .usage <<<"$OUT")"

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

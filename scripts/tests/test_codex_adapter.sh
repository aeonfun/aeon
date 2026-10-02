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
  rm -rf "$TMP/rh" "$TMP/codex-home/sessions"; mkdir -p "$TMP/rh"
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

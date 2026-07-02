#!/usr/bin/env bash
# Tests for scripts/run-grok.sh — auth gating, invocation flags, and output
# normalization. Uses a fake `grok` on PATH so no network/CLI is required.
# Run: bash scripts/tests/test_run_grok.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
R="scripts/run-grok.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

command -v jq >/dev/null 2>&1 || { echo "SKIP - jq not installed"; exit 0; }

BIN="$(mktemp -d)"
ARGS_FILE="$BIN/grok-args.txt"
cleanup() { rm -rf "$BIN"; }
trap cleanup EXIT

# Fake grok: record argv, emit $GROK_FAKE_OUT to stdout, exit $GROK_FAKE_RC.
cat > "$BIN/grok" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$GROK_ARGS_FILE"
[ -n "${GROK_FAKE_STDERR:-}" ] && printf '%s\n' "$GROK_FAKE_STDERR" >&2
printf '%s' "${GROK_FAKE_OUT:-}"
exit "${GROK_FAKE_RC:-0}"
EOF
chmod +x "$BIN/grok"
export GROK_ARGS_FILE="$ARGS_FILE"
export PATH="$BIN:$PATH"

run() { echo "test prompt" | GROK_FAKE_OUT="$1" GROK_FAKE_RC="${2:-0}" MODEL="${3:-grok-composer-2.5-fast}" SKILL_MODE="${4:-write}" XAI_API_KEY=xai-test bash "$R" 2>/dev/null; }

# 1. Claude-shaped JSON normalizes to result + usage
OUT=$(run '{"result":"hi there","usage":{"input_tokens":11,"output_tokens":4}}')
[ "$(echo "$OUT" | jq -r '.result')" = "hi there" ] && pass "normalizes .result" || bad "normalizes .result (got: $OUT)"
[ "$(echo "$OUT" | jq -r '.usage.input_tokens')" = "11" ] && pass "normalizes usage.input_tokens" || bad "normalizes usage.input_tokens"

# 2. OpenAI-ish aliases (text / prompt_tokens) normalize too
OUT=$(run '{"text":"grok hi","usage":{"prompt_tokens":50,"completion_tokens":7}}')
[ "$(echo "$OUT" | jq -r '.result')" = "grok hi" ] && pass "maps .text alias" || bad "maps .text alias (got: $OUT)"
[ "$(echo "$OUT" | jq -r '.usage.output_tokens')" = "7" ] && pass "maps completion_tokens alias" || bad "maps completion_tokens alias"

# 2b. Exact real grok 0.2.82 shape: .text present, NO usage field → tokens = 0
OUT=$(run '{"text":"ok","stopReason":"EndTurn","sessionId":"s","requestId":"r","thought":"t"}')
[ "$(echo "$OUT" | jq -r '.result')" = "ok" ] && pass "real grok shape → .result from .text" || bad "real grok shape → .result (got: $OUT)"
[ "$(echo "$OUT" | jq -r '.usage.input_tokens')" = "0" ] && pass "real grok shape → 0 tokens (no usage field)" || bad "real grok shape → 0 tokens"

# 2c. grok's internal .thought is NEVER surfaced as the result (leak guard)
OUT=$(run '{"text":"visible answer","stopReason":"EndTurn","thought":"SECRET_CHAIN_OF_THOUGHT"}')
{ [ "$(echo "$OUT" | jq -r '.result')" = "visible answer" ] && ! echo "$OUT" | grep -q "SECRET_CHAIN_OF_THOUGHT"; } \
  && pass "does not leak .thought into result" || bad "leaked .thought (got: $OUT)"

# 2d. Cancelled/aborted with EMPTY text → hard fail; must NOT emit an empty result
# or raw-wrap the JSON (which would leak .thought). Regression for the grok-build
# 'Cancelled' run that committed chain-of-thought to the repo.
if OUT=$(run '{"text":"","stopReason":"Cancelled","thought":"SECRET"}' 0 2>/dev/null); then
  bad "Cancelled+empty should fail (got rc 0, out: $OUT)"
else
  echo "$OUT" | grep -q "SECRET" && bad "Cancelled+empty leaked .thought" || pass "Cancelled+empty fails without leaking .thought"
fi

# 2e. Clean EndTurn with empty text is a legitimate success (skill acted via tools,
# no final message) → result "" and exit 0, NOT a failure.
if OUT=$(run '{"text":"","stopReason":"EndTurn"}' 0 2>/dev/null); then
  [ "$(echo "$OUT" | jq -r '.result')" = "" ] && pass "empty EndTurn → clean empty result" || bad "empty EndTurn result (got: $OUT)"
else
  bad "empty EndTurn should succeed"
fi

# 3. Non-JSON stdout falls back to raw-text envelope (never "no output")
OUT=$(run 'plain text, not json')
[ "$(echo "$OUT" | jq -r '.result')" = "plain text, not json" ] && pass "wraps non-JSON stdout" || bad "wraps non-JSON stdout (got: $OUT)"

# 4. Invocation passes --output-format json, --no-auto-update, and the model
run '{"result":"x"}' >/dev/null
grep -qx -- "--output-format" "$ARGS_FILE" && grep -qx "json" "$ARGS_FILE" \
  && pass "passes --output-format json" || bad "passes --output-format json"
grep -qx -- "--no-auto-update" "$ARGS_FILE" && pass "passes --no-auto-update" || bad "passes --no-auto-update"
grep -qx -- "--no-subagents" "$ARGS_FILE" && pass "passes --no-subagents" || bad "passes --no-subagents"
grep -qx -- "--model" "$ARGS_FILE" && grep -qx "grok-composer-2.5-fast" "$ARGS_FILE" \
  && pass "passes --model for a real grok model" || bad "passes --model"
grep -qx -- "--permission-mode" "$ARGS_FILE" && grep -qx "dontAsk" "$ARGS_FILE" \
  && pass "passes permission flags from skill_mode" || bad "passes permission flags"

# 4b. --model is OMITTED for a leftover claude-* id or empty (grok uses its default)
echo "p" | GROK_FAKE_OUT='{"text":"x"}' MODEL=claude-sonnet-4-6 SKILL_MODE=write XAI_API_KEY=xai-test bash "$R" >/dev/null 2>&1
if grep -qx -- "--model" "$ARGS_FILE"; then bad "omits --model for claude-* id"; else pass "omits --model for claude-* id"; fi
echo "p" | GROK_FAKE_OUT='{"text":"x"}' MODEL="" SKILL_MODE=write XAI_API_KEY=xai-test bash "$R" >/dev/null 2>&1
if grep -qx -- "--model" "$ARGS_FILE"; then bad "omits --model for empty model"; else pass "omits --model for empty model"; fi

# 5. read-only mode adds --sandbox read-only
echo "p" | GROK_FAKE_OUT='{"result":"x"}' MODEL=grok-build-0.1 SKILL_MODE=read-only XAI_API_KEY=xai-test bash "$R" >/dev/null 2>&1
grep -qx -- "--sandbox" "$ARGS_FILE" && grep -qx "read-only" "$ARGS_FILE" \
  && pass "read-only run sandboxes grok" || bad "read-only run sandboxes grok"

# 6. grok non-zero exit → run-grok.sh fails
if run '{"result":"x"}' 1 >/dev/null 2>&1; then bad "propagates grok failure"; else pass "propagates grok failure"; fi

# 7. No auth at all (no XAI_API_KEY / GROK_CREDENTIALS / ~/.grok session) → hard fail.
# Use a clean HOME so an ambient ~/.grok/auth.json on the test machine can't satisfy it.
EMPTY_HOME="$(mktemp -d)"
if echo "p" | env -u XAI_API_KEY -u GROK_CREDENTIALS HOME="$EMPTY_HOME" GROK_FAKE_OUT='{"text":"x"}' MODEL="" SKILL_MODE=write bash "$R" >/dev/null 2>&1; then
  bad "fails without auth"
else
  pass "fails without auth"
fi
rm -rf "$EMPTY_HOME"

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

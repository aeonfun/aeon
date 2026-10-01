#!/usr/bin/env bash
# Tests for harness-adapter's grok path (run-harness → adapters/grok.sh), which is
# now the ONLY way a skill runs on grok. Uses a fake `grok` on PATH that records
# its argv and replays a canned streaming-json stream, so no network, real CLI or
# xAI account is required.
#
# These assertions were previously carried by test_run_grok.sh against the
# script's own run path. That path is gone, so the coverage moved here rather than
# being deleted with it — the MCP cases in particular guard the exact regression
# that made MCP silently dead on grok for two releases (a repo-local server is
# never started in an untrusted checkout, so no mcp__<srv>__* tool exists, and the
# run still goes green).
#
# Run: bash scripts/tests/test_harness_adapter_grok.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
RH="$(pwd)/harness-adapter/run-harness"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

command -v jq >/dev/null 2>&1 || { echo "SKIP - jq not installed"; exit 0; }
[ -x "$RH" ] || { echo "FAIL - $RH not executable"; exit 1; }

BIN="$(mktemp -d)"
ARGS_FILE="$BIN/grok-args.txt"
cleanup() { rm -rf "$BIN"; }
trap cleanup EXIT

# Fake grok: record argv, emit $GROK_FAKE_OUT (a streaming-json stream), exit RC.
cat > "$BIN/grok" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$GROK_ARGS_FILE"
printf '%s' "${GROK_FAKE_OUT:-}"
exit "${GROK_FAKE_RC:-0}"
EOF
chmod +x "$BIN/grok"
export GROK_ARGS_FILE="$ARGS_FILE"
export PATH="$BIN:$PATH"
export XAI_API_KEY=xai-test    # adapters/grok.sh refuses to run unauthenticated

# A minimal well-formed stream: one text chunk + the terminal end event.
STREAM='{"type":"text","data":"hello"}
{"type":"end","stopReason":"EndTurn","usage":{"input_tokens":7,"output_tokens":2}}'

run_in() {  # run_in <dir> [extra run-harness args...] -> envelope on stdout
  local dir="$1"; shift
  ( cd "$dir" && echo "prompt" | GROK_FAKE_OUT="$STREAM" \
      bash "$RH" grok --mode write --no-sandbox "$@" 2>/dev/null )
}

# --- 1. envelope ------------------------------------------------------------
WS="$(mktemp -d)"
OUT=$(run_in "$WS")
{ [ "$(jq -r '.result' <<<"$OUT")" = "hello" ] \
  && [ "$(jq -r '.usage.input_tokens' <<<"$OUT")" = "7" ]; } \
  && pass "streaming-json normalizes to {result, usage}" || bad "envelope (got: $OUT)"

# The thought firewall: grok's chain-of-thought must NEVER become .result.
OUT=$(cd "$WS" && echo p | GROK_FAKE_OUT='{"type":"thought","data":"SECRET REASONING"}
{"type":"text","data":"answer"}
{"type":"end","stopReason":"EndTurn"}' bash "$RH" grok --mode write --no-sandbox 2>/dev/null)
{ [ "$(jq -r '.result' <<<"$OUT")" = "answer" ] && ! grep -q "SECRET REASONING" <<<"$OUT"; } \
  && pass "thought chunks never leak into .result" || bad "thought firewall (got: $OUT)"

# --- 2. MCP: --trust + per-server allow rules -------------------------------
# grok gates repo-local (project-scoped) MCP servers behind its folder-trust store.
# A CI runner checks the repo out into a never-trusted path on EVERY run, so without
# --trust the server is never started and no mcp__<srv>__* tool exists — while the
# run still exits 0 and the agent quietly falls back to plain HTTP.
MCPDIR="$(mktemp -d)"
cat > "$MCPDIR/.mcp.json" <<'JSON'
{ "mcpServers": {
  "github":   { "type": "http",  "url": "https://api.example/mcp/" },
  "seqthink": { "type": "stdio", "command": "npx", "args": ["-y", "pkg"] }
} }
JSON
run_in "$MCPDIR" --mcp-config "$MCPDIR/.mcp.json" >/dev/null
grep -Fqx -- "--trust" "$ARGS_FILE" \
  && pass "MCP: --trust passed for a repo-local .mcp.json" \
  || bad "MCP --trust missing (args: $(tr '\n' ' ' < "$ARGS_FILE"))"
{ grep -Fqx "MCPTool(github__*)" "$ARGS_FILE" && grep -Fqx "MCPTool(seqthink__*)" "$ARGS_FILE"; } \
  && pass "MCP: one MCPTool allow per .mcp.json server" \
  || bad "MCP allow rules (args: $(tr '\n' ' ' < "$ARGS_FILE"))"

# No MCP config → default untrusted posture, no stray allow rules.
: > "$ARGS_FILE"
run_in "$WS" >/dev/null
if grep -Fqx -- "--trust" "$ARGS_FILE"; then bad "--trust leaked into a non-MCP run"; else
  pass "no --trust without an MCP config"; fi
if grep -q "MCPTool(" "$ARGS_FILE"; then bad "MCPTool rules leaked into a non-MCP run"; else
  pass "no MCPTool rules without an MCP config"; fi

# --- 3. model + run-shaping knobs -------------------------------------------
# Only a real grok id is forwarded; a leftover claude-* id would otherwise pin the
# run to a model that does not exist and every downstream record would name it.
: > "$ARGS_FILE"; run_in "$WS" --model claude-sonnet-5-5 >/dev/null
if grep -Fqx -- "--model" "$ARGS_FILE"; then bad "--model should be omitted for a claude-* id"; else
  pass "--model omitted for a leftover claude-* id"; fi
: > "$ARGS_FILE"; run_in "$WS" --model grok-4.7 >/dev/null
{ grep -Fqx -- "--model" "$ARGS_FILE" && grep -Fqx "grok-4.7" "$ARGS_FILE"; } \
  && pass "--model forwarded for a real grok id" || bad "--model grok-4.7 not forwarded"

# GROK_* frontmatter knobs (aeon.yml exports these) reach the adapter.
: > "$ARGS_FILE"
( cd "$WS" && echo p | GROK_FAKE_OUT="$STREAM" GROK_MAX_TURNS=7 \
    bash "$RH" grok --mode write --no-sandbox 2>/dev/null ) >/dev/null
{ grep -Fqx -- "--max-turns" "$ARGS_FILE" && grep -Fqx "7" "$ARGS_FILE"; } \
  && pass "GROK_MAX_TURNS reaches the adapter" || bad "GROK_MAX_TURNS (args: $(tr '\n' ' ' < "$ARGS_FILE"))"

# --- 4. failure modes -------------------------------------------------------
# An abnormal stop with NO output must fail, never emit an empty success envelope.
if ( cd "$WS" && echo p | GROK_FAKE_OUT='{"type":"end","stopReason":"Cancelled"}' \
     bash "$RH" grok --mode write --no-sandbox >/dev/null 2>&1 ); then
  bad "cancelled-with-no-output should fail"
else
  pass "abnormal stop with no output fails instead of emitting an empty result"
fi

# grok 1.x spells stopReason in snake_case; a turn cap hit with no text is a
# failed run, and a clean end_turn still passes through.
if ( cd "$WS" && echo p | GROK_FAKE_OUT='{"type":"end","stopReason":"max_turn_requests"}' \
     bash "$RH" grok --mode write --no-sandbox >/dev/null 2>&1 ); then
  bad "max_turn_requests with no output should fail"
else
  pass "1.x snake_case max_turn_requests with no output fails"
fi
OUT=$(cd "$WS" && echo p | GROK_FAKE_OUT='{"type":"text","data":"done"}
{"type":"end","stopReason":"end_turn","usage":{"input_tokens":3,"output_tokens":1}}' \
  bash "$RH" grok --mode write --no-sandbox 2>/dev/null)
[ "$(jq -r '.result' <<<"$OUT")" = "done" ] \
  && pass "1.x snake_case end_turn passes through" || bad "end_turn envelope (got: $OUT)"

# --- 5. knobs grok 1.x removed ------------------------------------------------
# grok 1.0.46 rejects --best-of-n and --check ("unexpected argument", exit 2), so
# a skill with best_of_n/verify must still run: the knobs are ignored with a
# notice and --no-subagents stays on.
: > "$ARGS_FILE"
ERR=$( ( cd "$WS" && echo p | GROK_FAKE_OUT="$STREAM" GROK_BEST_OF_N=3 GROK_CHECK=true \
    bash "$RH" grok --mode write --no-sandbox ) 2>&1 >/dev/null )
{ ! grep -Fqx -- "--best-of-n" "$ARGS_FILE" && ! grep -Fqx -- "--check" "$ARGS_FILE" \
  && grep -Fqx -- "--no-subagents" "$ARGS_FILE"; } \
  && pass "best_of_n/verify are not passed to grok 1.x; --no-subagents stays" \
  || bad "removed knobs leaked into argv (args: $(tr '\n' ' ' < "$ARGS_FILE"))"
grep -q "grok 1.x removed --best-of-n" <<<"$ERR" && grep -q "grok 1.x removed --check" <<<"$ERR" \
  && pass "ignored knobs are reported, not silently dropped" || bad "no notice for ignored knobs (stderr: $ERR)"

rm -rf "$WS" "$MCPDIR"
echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

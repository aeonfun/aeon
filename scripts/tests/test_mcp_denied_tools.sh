#!/usr/bin/env bash
# Tests for blocked MCP tools: scripts/mcp-denied-tools.sh (catalog/mcp-denied-tools.json
# -> mcp__<srv>__<tool> list, matched by server URL) and run-harness
# --disallowed-tools (claude: --disallowedTools; grok and the rest: the server is
# dropped and grok gets no --trust, so it starts no project MCP server). Fake
# claude/grok on PATH record their argv; no network or real CLI needed.
#
# Run: bash scripts/tests/test_mcp_denied_tools.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
ROOT="$(pwd)"
RH="$ROOT/harness-adapter/run-harness"
fail=0
pass() { echo "ok   - $1"; }
bad() {
  echo "FAIL - $1"
  fail=1
}

command -v jq >/dev/null 2>&1 || {
  echo "SKIP - jq not installed"
  exit 0
}

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

# --- 1. helper: URL match (trailing slash, renamed slug), others ignored -----
cat >"$T/.mcp.json" <<'JSON'
{ "mcpServers": {
  "icp-mcp": { "type": "http", "url": "https://mcp.internetcomputer.org/mcp/", "headers": { "Authorization": "Bearer ${MCP_ICP_TOKEN}" } },
  "base":    { "type": "http", "url": "https://mcp.example/base" },
  "local":   { "type": "stdio", "command": "npx", "args": ["-y", "pkg"] }
} }
JSON
OUT=$(bash scripts/mcp-denied-tools.sh "$T/.mcp.json")
[ "$OUT" = "mcp__icp-mcp__canister_update_call" ] &&
  pass "helper: ICP write tool blocked under a renamed slug" || bad "helper list (got: '$OUT')"

printf '{"mcpServers":{"base":{"type":"http","url":"https://mcp.example/base"}}}' >"$T/none.json"
OUT=$(bash scripts/mcp-denied-tools.sh "$T/none.json")
[ -z "$OUT" ] && pass "helper: nothing blocked when no listed server is connected" || bad "helper none (got: '$OUT')"

OUT=$(bash scripts/mcp-denied-tools.sh "$T/missing.json"; echo "rc=$?")
[ "$OUT" = "rc=0" ] && pass "helper: missing .mcp.json prints nothing, exits 0" || bad "helper missing (got: '$OUT')"

# --- 2. run-harness: claude gets --disallowedTools, server kept --------------
BIN="$T/bin"
mkdir -p "$BIN"
cat >"$BIN/claude" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$FAKE_ARGS"
printf '%s' '{"type":"result","result":"ok","usage":{"input_tokens":1,"output_tokens":1}}'
SH
cat >"$BIN/grok" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$FAKE_ARGS"
printf '%s\n' '{"type":"text","data":"ok"}' '{"type":"end","stopReason":"EndTurn"}'
SH
chmod +x "$BIN/claude" "$BIN/grok"
export PATH="$BIN:$PATH" FAKE_ARGS="$T/args.txt" XAI_API_KEY=xai-test MCP_ICP_TOKEN=tok
DENY="mcp__icp-mcp__canister_update_call"

(cd "$T" && echo p | bash "$RH" claude --mode write --no-sandbox --allowed-tools "Read,mcp__icp-mcp" \
  --mcp-config .mcp.json --disallowed-tools "$DENY" >/dev/null 2>&1)
if grep -Fqx -- "--disallowedTools" "$T/args.txt" && grep -Fqx -- "$DENY" "$T/args.txt"; then
  pass "claude: --disallowedTools carries the blocked tool"
else
  bad "claude deny flag (args: $(tr '\n' ' ' <"$T/args.txt" 2>/dev/null))"
fi
CFG=$(awk 'p{print; exit} $0=="--mcp-config"{p=1}' "$T/args.txt")
[ -n "$CFG" ] || bad "claude: no --mcp-config passed"

(cd "$T" && echo p | bash "$RH" claude --mode write --no-sandbox --mcp-config .mcp.json >/dev/null 2>&1)
! grep -Fqx -- "--disallowedTools" "$T/args.txt" &&
  pass "claude: no deny flag when nothing is blocked" || bad "claude: stray --disallowedTools"

# --- 3. run-harness: grok cannot block one tool -> no MCP this run ----------
ERR=$(cd "$T" && echo p | bash "$RH" grok --mode write --no-sandbox --mcp-config .mcp.json \
  --disallowed-tools "$DENY" 2>&1 >/dev/null)
if ! grep -Fqx -- "--trust" "$T/args.txt" && ! grep -Fq "MCPTool(icp-mcp__" "$T/args.txt"; then
  pass "grok: no --trust and no allow rule when a server has blocked tools"
else
  bad "grok still trusts MCP (args: $(tr '\n' ' ' <"$T/args.txt"))"
fi
grep -q "dropped this run: icp-mcp" <<<"$ERR" && pass "grok: warns which server was dropped" || bad "grok warning (stderr: $ERR)"

(cd "$T" && echo p | bash "$RH" grok --mode write --no-sandbox --mcp-config .mcp.json >/dev/null 2>&1)
grep -Fqx -- "--trust" "$T/args.txt" && pass "grok: MCP unchanged when nothing is blocked" || bad "grok lost --trust without a deny"

exit $fail

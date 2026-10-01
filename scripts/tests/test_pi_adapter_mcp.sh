#!/usr/bin/env bash
# test_pi_adapter_mcp.sh - adapters/pi.sh MCP staging, against a stub `pi`.
#
# The real CLI round trip (fake model + fake stdio MCP server) runs in
# ci-harness-cli.yml (scripts/tests/harness_cli_smoke.sh pi). This covers what a
# stub can see: the temp PI_CODING_AGENT_DIR the adapter hands pi, the mcp.json
# written there (skips, exposure default, `$` / `!` escapes), the links back to
# the real agent dir, and that the real dir is left alone.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/home/.pi/agent/sessions" "$TMP/rh"
fail=0
ok()  { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

# Stub pi: record the agent dir it was given and copy the mcp.json it would read,
# then emit a minimal json-mode event stream.
cat > "$TMP/bin/pi" <<'SH'
#!/usr/bin/env bash
dir="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
printf '%s\n' "$dir" > "$STUB_OUT.dir"
[ -f "$dir/mcp.json" ] && cp "$dir/mcp.json" "$STUB_OUT.mcp.json"
ls -A "$dir" > "$STUB_OUT.ls"
printf '%s\n' '{"type":"session","id":"pi-test"}' \
  '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"ok"}],"usage":{"input":1,"output":1}}}' \
  '{"type":"agent_end"}'
SH
chmod +x "$TMP/bin/pi"

REAL="$TMP/home/.pi/agent"
echo '{"providers":{}}' > "$REAL/models.json"
echo '{"k":"v"}' > "$REAL/auth.json"
echo '{"mcpServers":{"mine":{"command":"never-run"}}}' > "$REAL/mcp.json"
REAL_SUM=$(cksum < "$REAL/mcp.json")
printf 'do it' > "$TMP/prompt"

# The config as run-harness hands it over: ${VAR}s already expanded.
cat > "$TMP/mcp.json" <<'JSON'
{"mcpServers":{
  "probe":  {"command":"node","args":["s.mjs"],"env":{"PW":"pa$word","CMD":"!echo hi","LEFT":"${UNSET_X}"}},
  "web":    {"type":"http","url":"https://e.example/mcp","headers":{"Authorization":"Bearer a$b"}},
  "my-srv": {"command":"x"},
  "my_srv": {"command":"y"},
  "keep":   {"command":"x","exposure":"codemode"},
  "legacy": {"type":"sse","url":"https://e.example/sse"},
  "ws":     {"type":"ws","url":"wss://e.example"},
  "bad.name": {"command":"x"},
  "empty":  {}
}}
JSON

run_adapter() {  # run_adapter NAME [MCP_FILE]
  local name="$1" mcp="${2:-}"
  mkdir -p "$TMP/rh/$name"
  HOME="$TMP/home" STUB_OUT="$TMP/$name" PATH="$TMP/bin:$PATH" \
    RH_LIB="$ROOT/harness-adapter/lib" RH_TMPDIR="$TMP/rh/$name" RH_PROMPT_FILE="$TMP/prompt" \
    RH_MODE=read-only RH_MCP_CONFIG="$mcp" \
    bash "$ROOT/harness-adapter/adapters/pi.sh" > "$TMP/$name.env" 2> "$TMP/$name.err"
}

# --- no MCP config: pi keeps its own agent dir ---------------------------------
run_adapter plain
[ "$(cat "$TMP/plain.dir")" = "$REAL" ] && ok "no --mcp-config: pi uses the real agent dir" \
  || bad "no --mcp-config: agent dir was $(cat "$TMP/plain.dir")"

# --- MCP config: temp agent dir, translated mcp.json -----------------------------
run_adapter mcp "$TMP/mcp.json"
jq -e '.result == "ok"' "$TMP/mcp.env" >/dev/null && ok "adapter still emits the envelope" \
  || bad "no envelope: $(cat "$TMP/mcp.env") $(cat "$TMP/mcp.err")"
DIR=$(cat "$TMP/mcp.dir")
[ "$DIR" = "$TMP/rh/mcp/pi-agent" ] && ok "pi runs on a temp agent dir inside RH_TMPDIR" \
  || bad "agent dir was '$DIR'"
M="$TMP/mcp.mcp.json"
[ "$(jq -c '.mcpServers | keys' "$M")" = '["keep","my-srv","probe","web"]' ] \
  && ok "only valid entries reach pi's mcp.json" || bad "servers: $(jq -c '.mcpServers | keys' "$M")"
for s in legacy ws bad.name empty my_srv; do
  grep -q "warning: pi MCP: skipping server $s: " "$TMP/mcp.err" && ok "skip warning for $s" \
    || bad "no skip warning for $s: $(cat "$TMP/mcp.err")"
done
grep -q 'legacy: legacy SSE transport is not supported' "$TMP/mcp.err" && ok "sse skip names the reason" \
  || bad "sse skip reason missing"
[ "$(jq -r '.mcpServers.probe.exposure' "$M")" = direct ] && [ "$(jq -r '.mcpServers.web.exposure' "$M")" = direct ] \
  && ok "exposure defaults to direct" || bad "exposure: $(jq -c '[.mcpServers[].exposure]' "$M")"
[ "$(jq -r '.mcpServers.keep.exposure' "$M")" = codemode ] && ok "an explicit exposure is kept" \
  || bad "explicit exposure overwritten"
# pi resolves env/header values itself ($VAR, ${VAR}, leading !command); the
# adapter escapes them with pi's own `$$` / `$!` so they arrive verbatim.
[ "$(jq -c '.mcpServers.probe.env' "$M")" = '{"PW":"pa$$word","CMD":"$!echo hi","LEFT":"$${UNSET_X}"}' ] \
  && ok "env values escaped for pi's resolver" || bad "env: $(jq -c '.mcpServers.probe.env' "$M")"
[ "$(jq -r '.mcpServers.web.headers.Authorization' "$M")" = 'Bearer a$$b' ] \
  && ok "header values escaped for pi's resolver" || bad "headers: $(jq -c '.mcpServers.web.headers' "$M")"

# Real agent dir: every other entry is linked, mcp.json is not, nothing changes.
for f in models.json auth.json sessions; do
  [ -L "$TMP/rh/mcp/pi-agent/$f" ] && [ "$(readlink "$TMP/rh/mcp/pi-agent/$f")" = "$REAL/$f" ] \
    && ok "$f linked from the real agent dir" || bad "$f not linked"
done
[ ! -L "$TMP/rh/mcp/pi-agent/mcp.json" ] && ! jq -e '.mcpServers.mine' "$M" >/dev/null \
  && ok "the user's own mcp.json is not used" || bad "the user's mcp.json leaked into the run"
[ "$(cksum < "$REAL/mcp.json")" = "$REAL_SUM" ] && ok "the user's mcp.json is unchanged" \
  || bad "the user's mcp.json changed"
[ "$(ls -A "$REAL" | tr '\n' ' ')" = "auth.json mcp.json models.json sessions " ] \
  && ok "nothing new in the real agent dir" || bad "real agent dir: $(ls -A "$REAL" | tr '\n' ' ')"

# Read-only keeps MCP: only write/edit are excluded.
grep -q 'skipping server probe' "$TMP/mcp.err" && bad "read-only skipped an MCP server" \
  || ok "read-only keeps MCP servers"

[ "$fail" = 0 ] && echo "pi adapter MCP tests passed" || { echo "pi adapter MCP tests FAILED"; exit 1; }

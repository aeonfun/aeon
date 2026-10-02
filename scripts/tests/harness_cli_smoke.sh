#!/usr/bin/env bash
# harness_cli_smoke.sh - install ONE harness CLI at the version this repo pins and
# prove its adapter still drives it. Run by .github/workflows/ci-harness-cli.yml,
# one matrix job per harness, so a pin bump (including a major) is checked
# against the real CLI before it reaches a scheduled run.
#
#   bash scripts/tests/harness_cli_smoke.sh <claude|grok|codex|pi|kimi|vibe|ccr>
#
# Every check reads its expectation from the repo, never from a list kept here:
#   1. pin      - the version is read from the install site the workflows use
#                 (aeon.yml for claude, run-grok.sh, install-harness.sh,
#                 llm-gateway.sh for claude-code-router), and the capability
#                 manifest's min_version must match it.
#   2. install  - through that same install site (install-harness.sh /
#                 run-grok.sh setup / llm-gateway.sh), so the generated provider
#                 config is the one under test, not a hand-written one.
#   3. version  - the installed CLI reports exactly the pin.
#   4. flags    - every --flag the adapter passes (scraped from its ARGS lines)
#                 must still appear in the CLI's --help.
#   5. run      - a prompt goes through harness-adapter/run-harness against
#                 scripts/tests/fake-llm-upstream.mjs, a local fake model server,
#                 and the envelope must carry the fake reply. No API key and no
#                 real model call: the provider config is pointed at 127.0.0.1.
#   6. mcp (pi) - --mcp-config runs with scripts/tests/fake-mcp-server.mjs: the
#                 fake model calls mcp__probe__echo on turn 1 and the tool's
#                 result must reach .result on turn 2, for a fast server and a
#                 2s-slow one (read-only, so under the wrapper sandbox); an `sse`
#                 entry is skipped with a warning; the user's own
#                 ~/.pi/agent/mcp.json is neither read nor changed.
#
# It installs global CLIs, so it is meant for a throwaway CI runner, not a laptop.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
H="${1:-}"
RH="$ROOT/harness-adapter/run-harness"
REPLY_TEXT="AEON_SMOKE_OK"
fail=0
pass() { echo "ok   - $H: $1"; }
bad()  { echo "FAIL - $H: $1"; fail=1; }
die()  { echo "FAIL - $H: $1"; exit 1; }

WORK="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/harness-smoke.XXXXXX")"
FAKE_PID=""
cleanup() {
  [ -n "$FAKE_PID" ] && kill "$FAKE_PID" 2>/dev/null
  rm -rf "$WORK"
}
trap cleanup EXIT

# --- pin: read from the install site the workflows actually use --------------
pin_of() {
  case "$1" in
    claude) grep -oE '@anthropic-ai/claude-code@[0-9][0-9.]*' "$ROOT/.github/workflows/aeon.yml" | head -1 | sed 's/.*@//' ;;
    grok)   sed -nE 's/^GROK_CLI_VERSION="\$\{GROK_CLI_VERSION:-([0-9][0-9.]*)\}"$/\1/p' "$ROOT/scripts/run-grok.sh" ;;
    codex)  grep -oE '@openai/codex@[0-9][0-9.]*' "$ROOT/scripts/install-harness.sh" | head -1 | sed 's/.*@//' ;;
    pi)     grep -oE '@earendil-works/pi-coding-agent@[0-9][0-9.]*' "$ROOT/scripts/install-harness.sh" | head -1 | sed 's/.*@//' ;;
    kimi)   grep -oE '@moonshot-ai/kimi-code@[0-9][0-9.]*' "$ROOT/scripts/install-harness.sh" | head -1 | sed 's/.*@//' ;;
    vibe)   grep -oE 'mistral-vibe==[0-9][0-9.]*' "$ROOT/scripts/install-harness.sh" | head -1 | sed 's/.*==//' ;;
    ccr)    sed -nE 's/^CCR_VERSION="([0-9][0-9.]*)"$/\1/p' "$ROOT/scripts/llm-gateway.sh" ;;
  esac
}

# --flag tokens the adapter passes: only lines that build its ARGS array (plus
# grok's add_effort helper), so comments and error text never count.
adapter_flags() {
  grep -E '^[^#]*(ARGS\+?=\(|add_effort [A-Z_]+ --)' "$ROOT/harness-adapter/adapters/$1.sh" \
    | grep -oE '(^|[[:space:](="])--[a-zA-Z][a-zA-Z0-9-]+' \
    | sed -E 's/^[[:space:](="]*//' | sort -u
}

# Flags an adapter passes that its CLI accepts but leaves out of --help. Each is
# checked by a parse-only call instead (see check_hidden_flag).
hidden_flags() {
  case "$1" in
    grok)   printf '%s\n' --trust --no-auto-update ;;
    claude) echo --max-turns ;;
  esac
}

start_fake_upstream() {
  FAKE_LOG="$WORK/upstream.jsonl"; : > "$FAKE_LOG"
  FAKE_LLM_LOG="$FAKE_LOG" node "$ROOT/scripts/tests/fake-llm-upstream.mjs" 0 > "$WORK/upstream.out" 2>&1 &
  FAKE_PID=$!
  disown "$FAKE_PID" 2>/dev/null || true   # no "Terminated" line at cleanup
  for _ in $(seq 1 50); do
    FAKE_PORT=$(sed -nE 's/^listening ([0-9]+)$/\1/p' "$WORK/upstream.out")
    [ -n "$FAKE_PORT" ] && break
    sleep 0.2
  done
  [ -n "${FAKE_PORT:-}" ] || die "fake upstream did not start: $(cat "$WORK/upstream.out")"
  FAKE_URL="http://127.0.0.1:$FAKE_PORT"
  export FAKE_LOG FAKE_PORT FAKE_URL
}

# run_harness ARGS... -> run-harness envelope on stdout, stderr kept in $WORK/rh.err
# (SMOKE_MODE picks --mode; write unless set)
run_harness() {
  ( cd "$WORK/ws" && echo "Reply with the single word OK and nothing else." \
      | bash "$RH" "$H" --mode "${SMOKE_MODE:-write}" --timeout 180 "$@" ) 2>"$WORK/rh.err"
}

# Is a working read-only OS sandbox available? ci-harness-cli.yml installs
# bubblewrap and lifts the AppArmor userns restriction for the sandboxable
# harnesses; on a dev laptop (no bwrap) the read-only leg is skipped.
RO_OK=0
if [ "$(uname -s)" = Linux ] && command -v bwrap >/dev/null 2>&1 \
   && bwrap --dev-bind / / --ro-bind /tmp /tmp true >/dev/null 2>&1; then RO_OK=1; fi

# run_harness_ro ARGS... -> run the SAME prompt in --mode read-only, under the
# wrapper OS sandbox, against the same fake upstream. Proves the harness still
# starts, writes its own state (config/session under $HOME, scratch under
# $TMPDIR) and returns a reply once the host fs is read-only by default. Call
# with the same provider env the write run used.
run_harness_ro() {
  if [ "$RO_OK" != 1 ]; then pass "read-only sandbox leg skipped (no working bwrap on this machine)"; return; fi
  local env_ro="$WORK/envelope-ro.json" r
  ( cd "$WORK/ws" && echo "Reply with the single word OK and nothing else." \
      | bash "$RH" "$H" --mode read-only --timeout 180 "$@" ) >"$env_ro" 2>"$WORK/rh-ro.err"
  grep -q "read-only: workspace write-locked via bwrap" "$WORK/rh-ro.err" \
    && pass "read-only: ran under the bwrap OS sandbox" \
    || bad "read-only: sandbox was not applied (stderr: $(tail -c 900 "$WORK/rh-ro.err" | tr '\n' ' '))"
  r=$(jq -r '.result // ""' "$env_ro" 2>/dev/null | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  [ "$r" = "$REPLY_TEXT" ] \
    && pass "read-only: harness still starts + returns the reply under the read-only-root sandbox" \
    || bad "read-only: unexpected .result '$(printf '%.200s' "$r")' (stderr: $(tail -c 900 "$WORK/rh-ro.err" | tr '\n' ' '))"
}

check_envelope() {  # check_envelope ENVELOPE_FILE WANT_USAGE(1|0)
  local env="$1" want_usage="$2" result tin
  if ! jq -e 'type == "object"' "$env" >/dev/null 2>&1; then
    bad "run-harness gave no envelope (stderr: $(tail -c 1500 "$WORK/rh.err" | tr '\n' ' '))"
    return
  fi
  # Exact (trimmed) match: a parser that returns the raw content array would
  # still CONTAIN the reply text.
  result=$(jq -r '.result // ""' "$env" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  if [ "$result" = "$REPLY_TEXT" ]; then
    pass "run-harness round-trip: .result is exactly the fake model's reply"
  else
    bad "unexpected .result '$(printf '%.300s' "$result")' (stderr: $(tail -c 1500 "$WORK/rh.err" | tr '\n' ' '))"
  fi
  if [ "$want_usage" = 1 ]; then
    tin=$(jq -r '.usage.input_tokens // 0' "$env")
    [ "${tin:-0}" -gt 0 ] 2>/dev/null \
      && pass "token usage parsed from the CLI's output (input_tokens=$tin)" \
      || bad "token usage not parsed (usage: $(jq -c '.usage' "$env"))"
  fi
  [ -s "$FAKE_LOG" ] && pass "the CLI called the fake upstream ($(wc -l < "$FAKE_LOG" | tr -d ' ') request(s))" \
    || bad "the fake upstream saw no request"
}

[ -n "$H" ] || die "usage: harness_cli_smoke.sh <harness>"
command -v jq >/dev/null 2>&1 || die "jq is required"
mkdir -p "$WORK/ws"

# --- 1. pin --------------------------------------------------------------------
PIN="$(pin_of "$H")"
[ -n "$PIN" ] || die "could not read the pinned version from its install site"
pass "pinned version is $PIN"
if [ "$H" != ccr ]; then
  MV=$(jq -r --arg h "$H" '.harnesses[] | select(.id == $h) | .cli.min_version' "$ROOT/harness-adapter/harnesses.json")
  [ "$MV" = "$PIN" ] && pass "harnesses.json min_version matches the pin" \
    || bad "harnesses.json min_version is '$MV' but the install pin is '$PIN' (edit adapters/$H.sh rh-meta and regenerate)"
fi
if [ "$H" = claude ]; then
  # Two workflows install claude and each keys an npm cache on the version.
  for wf in aeon.yml messages.yml; do
    got=$(grep -oE '@anthropic-ai/claude-code@[0-9][0-9.]*|claude-code-\$\{\{ runner.os \}\}-[0-9][0-9.]*' "$ROOT/.github/workflows/$wf" \
      | sed -E 's/.*[@-]//' | sort -u | tr '\n' ' ')
    [ "$got" = "$PIN " ] && pass "$wf install pin + cache key both $PIN" \
      || bad "$wf claude pins/cache keys disagree: '$got' (want '$PIN')"
  done
fi

# --- 2. install through the real install site ---------------------------------
export AUTH_MODE=openrouter HM=smoke-model OPENROUTER_API_KEY=sk-smoke-not-a-real-key
case "$H" in
  claude)
    npm install -g "@anthropic-ai/claude-code@$PIN" >"$WORK/install.log" 2>&1 \
      || die "npm install failed: $(tail -c 2000 "$WORK/install.log")" ;;
  grok)
    # run-grok.sh setup installs the pinned CLI; a dummy key satisfies its auth
    # gate (setup never calls the API with it).
    XAI_API_KEY=xai-smoke-not-a-real-key bash "$ROOT/scripts/run-grok.sh" setup >"$WORK/install.log" 2>&1 \
      || die "run-grok.sh setup failed: $(tail -c 2000 "$WORK/install.log")" ;;
  codex | pi | kimi | vibe)
    bash "$ROOT/scripts/install-harness.sh" "$H" >"$WORK/install.log" 2>&1 \
      || die "install-harness.sh failed: $(tail -c 2000 "$WORK/install.log")"
    export PATH="$HOME/.local/bin:$PATH" ;;
  ccr)
    # ccr itself is installed by llm-gateway.sh's start_ccr_sidecar (step 5);
    # Claude Code is the client aeon puts in front of it.
    CLAUDE_PIN="$(pin_of claude)"
    npm install -g "@anthropic-ai/claude-code@$CLAUDE_PIN" >"$WORK/install.log" 2>&1 \
      || die "claude-code install failed: $(tail -c 2000 "$WORK/install.log")" ;;
  *) die "unknown harness '$H'" ;;
esac
[ "$H" = ccr ] || pass "installed via its install site"

# --- 3. version + 4. flags -------------------------------------------------------
if [ "$H" != ccr ]; then
  case "$H" in
    claude) BIN=claude ;; grok) BIN=grok ;; codex) BIN=codex ;;
    pi) BIN=pi ;; kimi) BIN=kimi ;; vibe) BIN=vibe ;;
  esac
  command -v "$BIN" >/dev/null 2>&1 || die "'$BIN' is not on PATH after install"
  VER="$("$BIN" --version 2>&1 | head -5)"
  printf '%s\n' "$VER" | grep -qE "(^|[^0-9.])${PIN//./\\.}([^0-9.]|$)" \
    && pass "--version reports $PIN" || bad "--version did not report $PIN: $VER"

  HELP="$WORK/help.txt"
  case "$H" in
    codex) codex exec --help > "$HELP" 2>&1 ;;
    *)     "$BIN" --help > "$HELP" 2>&1 ;;
  esac
  HIDDEN=" $(hidden_flags "$H" | tr '\n' ' ') "
  n=0 missing=0
  while IFS= read -r flag; do
    [ -n "$flag" ] || continue
    case "$HIDDEN" in *" $flag "*) continue ;; esac
    n=$((n + 1))
    if ! grep -qE -- "(^|[^a-zA-Z0-9-])${flag}([^a-zA-Z0-9-]|$)" "$HELP"; then
      bad "--help no longer lists $flag, which adapters/$H.sh passes"
      missing=$((missing + 1))
    fi
  done < <(adapter_flags "$H")
  if [ "$n" -eq 0 ]; then bad "found no adapter flags to check (adapter_flags parse broke?)"
  elif [ "$missing" -eq 0 ]; then pass "--help lists all $n flags adapters/$H.sh passes"
  else sed 's/^/    help| /' "$HELP"; fi
  # Hidden flags: the CLI must still PARSE them.
  #   grok validates every argument before acting on --version (exit 2 on an
  #   unknown one). claude ignores unknown flags next to --version, so give its
  #   flag a bad value instead: a known option names itself ("--max-turns <turns>")
  #   in the "argument is invalid" error.
  while IFS= read -r flag; do
    [ -n "$flag" ] || continue
    case "$H" in
      claude) out=$("$BIN" "$flag" not-a-number --version 2>&1); grep -qF -- "$flag <" <<<"$out" ;;
      *)      out=$("$BIN" "$flag" --version 2>&1) ;;
    esac
    if [ $? -eq 0 ]; then pass "hidden flag $flag still parses"
    else bad "hidden flag $flag no longer parses: $(printf '%.300s' "$out")"; fi
  done < <(hidden_flags "$H")
fi

# --- 6. pi MCP: the fake model calls a fake stdio MCP server's tool ---------------
# pi_mcp_run NAME DELAY_MS MODE -> one run-harness call with a .mcp.json holding
# the fake server as `probe` (plus a skipped `sse` entry). The fake upstream calls
# mcp__probe__echo when the request declares it and answers "<reply> <result>"
# once the tool result is back, so .result proves the round trip. The result
# string comes in through a ${VAR} and carries a literal `$HOME`, which pi must
# not expand a second time.
pi_mcp_run() {
  local name="$1" delay="$2" mode="$3" cfg="$WORK/mcp-$1.json" env="$WORK/env-mcp-$1.json"
  local mlog="$WORK/mcp-$1.jsonl" want first
  : > "$mlog"; : > "$FAKE_LOG"
  export AEON_SMOKE_MCP_RESULT="MCP_${name}_OK\$HOME"
  want="$REPLY_TEXT MCP_${name}_OK\$HOME"
  jq -n --arg srv "$ROOT/scripts/tests/fake-mcp-server.mjs" --arg delay "$delay" --arg log "$mlog" '{mcpServers: {
      probe:  {command: "node", args: [$srv],
               env: {FAKE_MCP_DELAY_MS: $delay, FAKE_MCP_RESULT: "${AEON_SMOKE_MCP_RESULT}", FAKE_MCP_LOG: $log}},
      legacy: {type: "sse", url: "https://example.invalid/sse"}}}' > "$cfg"
  SMOKE_MODE="$mode" run_harness --model openrouter/smoke-model --mcp-config "$cfg" > "$env"
  if jq -e --arg w "$want" '.result == $w' "$env" >/dev/null 2>&1; then
    pass "mcp/$name ($mode, server start ${delay}ms): the MCP tool result reached .result"
  else
    bad "mcp/$name: .result '$(jq -r '.result // empty' "$env" 2>/dev/null | head -c 300)', want '$want' (stderr: $(tail -c 1500 "$WORK/rh.err" | tr '\n' ' '))"
  fi
  grep -q '"method":"tools/call"' "$mlog" \
    && pass "mcp/$name: pi called the server's tool (tools/call seen by the fake MCP server)" \
    || bad "mcp/$name: the fake MCP server never saw tools/call: $(tr '\n' ' ' < "$mlog" | head -c 600)"
  first=$(jq -sc '[.[0].body.tools[]?.function.name]' "$FAKE_LOG")
  jq -e 'index("mcp__probe__echo") != null' <<<"$first" >/dev/null \
    && pass "mcp/$name: the first model request already declared mcp__probe__echo (no startup race)" \
    || bad "mcp/$name: the first model request did not declare the MCP tool: $first"
  if [ "$mode" = read-only ]; then
    jq -e 'index("write") == null and index("edit") == null' <<<"$first" >/dev/null \
      && pass "mcp/$name: read-only still drops write/edit" \
      || bad "mcp/$name: read-only declared write/edit: $first"
    grep -q 'read-only: workspace write-locked via ' "$WORK/rh.err" \
      && pass "mcp/$name: ran under the wrapper OS sandbox ($(sed -n 's/.*write-locked via //p' "$WORK/rh.err" | head -1))" \
      || bad "mcp/$name: read-only run was not sandboxed: $(grep -m1 'read-only' "$WORK/rh.err")"
  fi
  grep -q 'warning: pi MCP: skipping server legacy: legacy SSE transport' "$WORK/rh.err" \
    && pass "mcp/$name: the sse entry was skipped with a warning" \
    || bad "mcp/$name: no skip warning for the sse entry (stderr: $(tail -c 800 "$WORK/rh.err" | tr '\n' ' '))"
}

pi_mcp_checks() {
  local real="$HOME/.pi/agent" sentinel="$WORK/sentinel-ran" own=0 before after lsb lsa
  # A user-level mcp.json the run must neither read (its server would leave a
  # marker file) nor change.
  if [ ! -e "$real/mcp.json" ]; then
    own=1
    jq -n --arg m "$sentinel" '{mcpServers: {sentinel: {command: "sh", args: ["-c", "touch \"$0\"", $m]}}}' > "$real/mcp.json"
  fi
  before=$(cksum < "$real/mcp.json"); lsb=$(ls -A "$real" | tr '\n' ' ')
  pi_mcp_run FAST 0 write
  pi_mcp_run SLOW 2000 read-only
  after=$(cksum < "$real/mcp.json"); lsa=$(ls -A "$real" | tr '\n' ' ')
  [ "$before" = "$after" ] && pass "mcp: ~/.pi/agent/mcp.json unchanged" \
    || bad "mcp: ~/.pi/agent/mcp.json changed: $(head -c 400 "$real/mcp.json")"
  [ "$lsb" = "$lsa" ] && pass "mcp: nothing new written into ~/.pi/agent ($lsa)" \
    || bad "mcp: ~/.pi/agent changed from '$lsb' to '$lsa'"
  if [ "$own" = 1 ]; then
    [ -e "$sentinel" ] && bad "mcp: pi started the user's own mcp.json server" \
      || pass "mcp: the user's own mcp.json server was never started"
    rm -f "$real/mcp.json"
  fi
}

# --- 5. run through the adapter against a fake upstream -------------------------
# pi also drives a tool round trip (step 6): the fake model calls this tool when a
# request declares it. Other harnesses never declare it, so their runs are unchanged.
[ "$H" = pi ] && export FAKE_LLM_TOOL=mcp__probe__echo
start_fake_upstream
ENV_OUT="$WORK/envelope.json"
case "$H" in
  claude)
    ANTHROPIC_BASE_URL="$FAKE_URL" ANTHROPIC_API_KEY=sk-ant-smoke-not-a-real-key \
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 DISABLE_AUTOUPDATER=1 \
      run_harness --max-turns 2 > "$ENV_OUT"
    check_envelope "$ENV_OUT" 1
    ANTHROPIC_BASE_URL="$FAKE_URL" ANTHROPIC_API_KEY=sk-ant-smoke-not-a-real-key \
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 DISABLE_AUTOUPDATER=1 \
      run_harness_ro --max-turns 2 ;;
  codex)
    # The generated config points at OpenRouter; aim the same config at the fake.
    sed -i.bak "s#https://openrouter.ai/api/v1#$FAKE_URL/api/v1#" "$HOME/.codex/config.toml"
    grep -q "$FAKE_URL" "$HOME/.codex/config.toml" || die "could not repoint the codex config"
    run_harness > "$ENV_OUT"
    check_envelope "$ENV_OUT" 1
    # The JSON stream never names the model; adapters/codex.sh reads it from the
    # session rollout. The staged config pins model = $HM, so that is what ran.
    [ "$(jq -r '.model // ""' "$ENV_OUT")" = "$HM" ] \
      && pass "codex reports the model it ran ($HM) from its session rollout" \
      || bad "codex .model is '$(jq -r '.model // ""' "$ENV_OUT")', want $HM (stderr: $(tail -c 600 "$WORK/rh.err" | tr '\n' ' '))"
    run_harness_ro ;;
  kimi)
    sed -i.bak "s#https://openrouter.ai/api/v1#$FAKE_URL/api/v1#" "$HOME/.kimi-code/config.toml"
    grep -q "$FAKE_URL" "$HOME/.kimi-code/config.toml" || die "could not repoint the kimi config"
    run_harness > "$ENV_OUT"
    check_envelope "$ENV_OUT" 0
    run_harness_ro ;;
  vibe)
    sed -i.bak "s#https://openrouter.ai/api/v1#$FAKE_URL/api/v1#" "$HOME/.vibe/config.toml"
    grep -q "$FAKE_URL" "$HOME/.vibe/config.toml" || die "could not repoint the vibe config"
    run_harness > "$ENV_OUT"
    check_envelope "$ENV_OUT" 0
    run_harness_ro ;;
  pi)
    # pi's models.json can override a built-in provider's base URL; aeon runs pi
    # on OpenRouter as --model openrouter/<id>.
    mkdir -p "$HOME/.pi/agent"
    printf '{"providers":{"openrouter":{"baseUrl":"%s/api/v1"}}}\n' "$FAKE_URL" > "$HOME/.pi/agent/models.json"
    run_harness --model openrouter/smoke-model > "$ENV_OUT"
    check_envelope "$ENV_OUT" 1
    # pi_mcp_checks (#1131) already runs pi in --mode read-only under the wrapper
    # OS sandbox (pi_mcp_run SLOW ... read-only), so it IS pi's read-only sandbox
    # leg under the new ro-root model; no separate run_harness_ro needed here.
    pi_mcp_checks ;;
  grok)
    # grok 1.x reads its API base from GROK_XAI_API_BASE_URL; with an API key it
    # lists models, then streams chat completions from the fake.
    XAI_API_KEY=xai-smoke-not-a-real-key GROK_XAI_API_BASE_URL="$FAKE_URL/v1" \
      run_harness --max-turns 3 > "$ENV_OUT"
    check_envelope "$ENV_OUT" 1
    XAI_API_KEY=xai-smoke-not-a-real-key GROK_XAI_API_BASE_URL="$FAKE_URL/v1" \
      run_harness_ro --max-turns 3 ;;
  ccr)
    # Each arm runs in a subshell: start_ccr_sidecar's EXIT trap stops ccr there.
    ccr_arm() {  # ccr_arm <gateway> -> sources llm-gateway.sh for that arm, then probes it
      local arm="$1"
      (
        export GATEWAY="$arm" MODEL=claude-sonnet-5-5 CCR_PORT=$((20000 + RANDOM % 20000))
        export HIVEMINDOS_CREDIT_TOKEN=up-smoke-key HIVEMINDOS_BASE_URL="$FAKE_URL/v1"
        export VENICE_API_KEY=up-smoke-key VENICE_BASE_URL="$FAKE_URL/api/v1/chat/completions"
        : > "$FAKE_LOG"
        # shellcheck disable=SC1091
        source "$ROOT/scripts/llm-gateway.sh" >"$WORK/gw-$arm.log" 2>&1 \
          || { echo "FAIL - ccr/$arm: llm-gateway.sh failed: $(tail -c 2000 "$WORK/gw-$arm.log")"; exit 1; }
        local f=0 got
        ok()  { echo "ok   - ccr/$arm: $1"; }
        nok() { echo "FAIL - ccr/$arm: $1"; f=1; }
        got=$(node -p "require('$(npm root -g)/@musistudio/claude-code-router/package.json').version" 2>/dev/null)
        [ "$got" = "$PIN" ] && ok "installed version is $PIN" || nok "installed version is '$got', want $PIN"
        curl -fsS "$ANTHROPIC_BASE_URL/health" >/dev/null && ok "GET /health answers" || nok "GET /health failed"
        got=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ANTHROPIC_BASE_URL/v1/messages" \
          -H 'x-api-key: wrong' -H 'content-type: application/json' -d '{}')
        [ "$got" = 401 ] && ok "a wrong client key is refused (401)" || nok "wrong client key got HTTP $got, want 401"
        # A claude-* id the upstream does not serve, plus blank text blocks: the
        # plugin must pin the model and the reply must come back Anthropic-shaped.
        got=$(curl -fsS -X POST "$ANTHROPIC_BASE_URL/v1/messages" -H "x-api-key: $ANTHROPIC_API_KEY" \
          -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' \
          -d '{"model":"claude-haiku-4-5","max_tokens":32000,"system":[{"type":"text","text":"  "},{"type":"text","text":"sys"}],"messages":[{"role":"user","content":[{"type":"text","text":" "},{"type":"text","text":"ping"}]}]}')
        jq -e --arg r "$REPLY_TEXT" '.type == "message" and .content[0].text == $r' <<<"$got" >/dev/null \
          && ok "POST /v1/messages round-trips to the OpenAI upstream" || nok "non-stream reply: $(printf '%.600s' "$got")"
        got=$(curl -fsSN -X POST "$ANTHROPIC_BASE_URL/v1/messages" -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
          -H 'content-type: application/json' -d '{"model":"claude-sonnet-5-5","max_tokens":64,"stream":true,"messages":[{"role":"user","content":"ping"}]}')
        grep -q 'event: message_stop' <<<"$got" && grep -q "$REPLY_TEXT" <<<"$got" \
          && ok "a streaming client gets Anthropic SSE" || nok "stream reply: $(printf '%.600s' "$got")"
        # Claude Code itself, through run-harness, the way aeon.yml runs it.
        ( cd "$WORK/ws" && echo "Reply with the single word OK and nothing else." \
            | CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 DISABLE_AUTOUPDATER=1 \
              bash "$RH" claude --mode write --timeout 180 --max-turns 2 ) > "$WORK/env-$arm.json" 2>"$WORK/rh.err"
        jq -e --arg r "$REPLY_TEXT" '.result | contains($r)' "$WORK/env-$arm.json" >/dev/null 2>&1 \
          && ok "claude -p through the sidecar returns the upstream reply" \
          || nok "claude via sidecar: $(head -c 600 "$WORK/env-$arm.json") $(tail -c 1500 "$WORK/rh.err" | tr '\n' ' ')"
        # What reached the upstream: the pinned model on every call, and on
        # hivemindos the credit-billing shape (non-streamed, capped, fresh key).
        jq -se --arg m "$( [ "$arm" = hivemindos ] && echo inclusionai/ling-3.0-flash || echo claude-sonnet-5-5 )" \
          'length > 0 and all(.[]; .body.model == $m)' "$FAKE_LOG" >/dev/null \
          && ok "every upstream call carries the pinned model" \
          || nok "upstream models: $(jq -sc '[.[].body.model]' "$FAKE_LOG")"
        if [ "$arm" = hivemindos ]; then
          jq -se 'all(.[]; .body.stream != true and (.body | has("stream_options") | not)
                    and ((.body.max_tokens // 0) <= 4096)
                    and (.headers["idempotency-key"] // "" | test("^[0-9a-f-]{36}$")))
                  and ([.[].headers["idempotency-key"]] | unique | length) == length' "$FAKE_LOG" >/dev/null \
            && ok "hivemindos: non-streamed, max_tokens capped, a fresh Idempotency-Key per call" \
            || nok "hivemindos upstream shape: $(jq -sc '[.[] | {stream: .body.stream, mt: .body.max_tokens, idem: .headers["idempotency-key"]}]' "$FAKE_LOG")"
        fi
        if [ -e "$HOME/.claude/settings.json.ccr-original-missing" ] \
           || grep -qs 'claude-code-router' "$HOME/.claude/settings.json"; then
          nok "ccr took over ~/.claude/settings.json: $(head -c 400 "$HOME/.claude/settings.json")"
        else
          ok "ccr left ~/.claude/settings.json alone (global profiles off)"
        fi
        [ "$f" = 0 ] || { tail -n 40 "$HOME/.claude-code-router/logs/ccr.log" | sed 's/^/    ccr.log| /'; }
        exit "$f"
      ) || fail=1
    }
    ccr_arm hivemindos
    ccr_arm venice ;;
esac

[ "$fail" = 0 ] && echo "PASS - $H smoke" || echo "FAILED - $H smoke"
exit "$fail"

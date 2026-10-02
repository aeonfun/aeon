#!/usr/bin/env bash
# Tests for scripts/run-context-summary.sh. Run: bash scripts/tests/test_run_context_summary.sh
# Builds throwaway workspaces with/without STRATEGY.md, soul/ and a Claude transcript,
# and checks the reported context line. Never-fail: an empty workspace still exits 0.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
S="$PWD/scripts/run-context-summary.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }
check() { echo "$2" | grep -qF -- "$3" && pass "$1" || bad "$1 (got: $2)"; }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
W="$T/ws"; H="$T/home"; command mkdir -p "$W" "$H/.claude/projects/p"
run() { (cd "$W" && HOME="$H" bash "$S" "$@"); }

# Empty workspace: everything absent, still exit 0.
L=$(HARNESS=codex run --line); rc=$?
[ "$rc" -eq 0 ] && pass "empty workspace exits 0" || bad "empty workspace exits 0 (rc=$rc)"
check "missing strategy" "$L" "STRATEGY.md missing"
check "no soul" "$L" "soul none"
check "no mcp" "$L" "MCP off (no .mcp.json)"

# Shipped templates.
printf '# Strategy\n\n> **Status:** unconfigured defaults. Until you tailor this file\n' > "$W/STRATEGY.md"
command mkdir -p "$W/soul/examples"
printf '# Soul\n\n<!-- Fill it in -->\n<!-- multi\nline comment -->\n## Identity\n\n<!-- name -->\n' > "$W/soul/SOUL.md"
touch "$W/soul/examples/.gitkeep"
L=$(HARNESS=codex MCP_STATUS="skipped: MCP_BASE_TOKEN" run --line)
check "template strategy" "$L" "STRATEGY.md defaults"
check "template soul" "$L" "soul template (empty)"
check "mcp skipped names the secret" "$L" "skipped, secret(s) not set: MCP_BASE_TOKEN"

# Tailored files, non-claude harness: soul read is not tracked.
printf '# Strategy\n\nShip the dashboard.\n' > "$W/STRATEGY.md"
printf '# Soul\n\nBuilder of agents.\n' > "$W/soul/SOUL.md"
printf 'Short sentences.\n' > "$W/soul/STYLE.md"
printf 'gm\n' > "$W/soul/examples/tweets.md"
L=$(HARNESS=codex MCP_STATUS="on:base, posthog" run --line)
check "custom strategy" "$L" "STRATEGY.md custom"
check "filled soul with style + examples" "$L" "soul filled, STYLE.md, 1 example(s)"
check "soul read not tracked off claude" "$L" "read not tracked on codex"
check "mcp on lists servers" "$L" "MCP on (base, posthog)"

# Claude transcript: soul read + MCP calls counted.
TX="$H/.claude/projects/p/sid1.jsonl"
au() { printf '{"type":"assistant","message":{"role":"assistant","content":[%s]}}\n' "$1" >> "$TX"; }
au '{"type":"tool_use","name":"Read","input":{"file_path":"/w/soul/SOUL.md"}}'
au '{"type":"tool_use","name":"mcp__base__get_balance","input":{}},{"type":"tool_use","name":"mcp__posthog__query","input":{}}'
au '{"type":"tool_use","name":"Bash","input":{"command":"echo hi"}}'
L=$(HARNESS=claude SESSION_ID=sid1 MCP_STATUS="on:base, posthog" run --line)
check "claude: soul read detected" "$L" "read this run"
check "claude: mcp calls counted" "$L" "2 MCP tool call(s)"

# Claude transcript without a soul read or MCP call.
TX="$H/.claude/projects/p/sid2.jsonl"; au '{"type":"tool_use","name":"Read","input":{"file_path":"skills/x/SKILL.md"}}'
L=$(HARNESS=claude SESSION_ID=sid2 MCP_STATUS="on:base" run --line)
check "claude: soul not read" "$L" "not read this run"
check "claude: zero mcp calls" "$L" "0 MCP tool call(s)"

printf '{"mcpServers":{"base":{"url":"https://x"}}}\n' > "$W/.mcp.json"
MD=$(HARNESS=claude SESSION_ID=sid1 run --md)
check "md table row strategy" "$MD" "| STRATEGY.md | custom |"
check "md: .mcp.json present but preflight never ran" "$MD" "| MCP | not loaded this run"

[ "$fail" -eq 0 ] && echo "PASS test_run_context_summary" || { echo "FAILURES in test_run_context_summary"; exit 1; }

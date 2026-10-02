#!/usr/bin/env bash
# Read-only skills must be able to notify on the claude harness.
#
# The read-only tier has no Write tool and Claude Code refuses shell redirection
# into a file, so a skill told to "write the body to a scratch file and send it
# with ./notify -f <file>" had no file to send and the run ended green with no
# notification (github-trending, claude-code 2.1.287). The fix: ./notify reads
# its body from stdin (`-f -`), skill_mode.sh hands read-only runs a standing note
# that says so, and the claude adapter warns when Claude Code denied a tool call.
#   Run: bash scripts/tests/test_readonly_notify.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
ROOT=$(pwd)
M="scripts/skill_mode.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export AEON_PENDING_DIR="$TMP/pending"
unset NOTIFY_MIN_SEVERITY JSONRENDER_ENABLED SKILL_NAME 2>/dev/null
export AEON_MESSAGES_WF_STATE=active
reset() { rm -rf "$AEON_PENDING_DIR"; }
payload() { ls -t "$AEON_PENDING_DIR"/notify-queue/*.json 2>/dev/null | head -1; }

# --- 1. ./notify reads its body from stdin ----------------------------------
BODY=$'*GitHub Trending*\n- [NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell) - it\'s `rust` and $HOME stays literal'
reset
printf '%s' "$BODY" | bash scripts/notify.sh --title "Trend" -f - >/dev/null 2>&1
p=$(payload)
if [ -n "$p" ] && [ "$(jq -r .body "$p")" = "$BODY" ] && [ "$(jq -r .title "$p")" = "Trend" ]; then
  pass "-f - queues the stdin body verbatim"
else
  bad "-f - queues the stdin body verbatim (got: $( [ -n "$p" ] && jq -r .body "$p"))"
fi

reset
printf '%s' "$BODY" | bash scripts/notify.sh -f /dev/stdin --severity warn >/dev/null 2>&1
p=$(payload)
[ -n "$p" ] && [ "$(jq -r .body "$p")" = "$BODY" ] && [ "$(jq -r .severity "$p")" = "warn" ] \
  && pass "-f /dev/stdin is read as stdin too" || bad "-f /dev/stdin is read as stdin too"

reset
if bash scripts/notify.sh -f "$TMP/does-not-exist.md" >/dev/null 2>&1; then
  bad "-f with a missing file still errors"
else
  [ -z "$(payload)" ] && pass "-f with a missing file still errors" || bad "-f with a missing file queued something"
fi

# --- 2. run-notes: read-only gets the stdin recipe, write gets nothing --------
NOTES=$(bash "$M" run-notes read-only)
case "$NOTES" in
  *"./notify"*"-f - <<'NOTIFY_EOF'"*) pass "read-only run-notes give the stdin heredoc recipe" ;;
  *) bad "read-only run-notes give the stdin heredoc recipe (got: $NOTES)" ;;
esac
case "$(bash "$M" run-notes write)" in
  *"only with Write/Edit"*"Never write files from Bash"*"cat >> f"*"skill's own example"*) pass "write run-notes steer file writes to Write/Edit" ;;
  *) bad "write run-notes steer file writes to Write/Edit" ;;
esac
bash "$M" run-notes write | grep -q './notify' && bad "write run-notes carry the read-only notify recipe" \
  || pass "write run-notes do not carry the read-only notify recipe"
if printf '%s' "$NOTES" | grep -q $'\xe2\x80\x94\|\xe2\x80\x93'; then bad "run-notes contain an em/en dash"; else pass "run-notes are plain ASCII dashes"; fi

# The recipe in the note must be a command that really works: run it as written.
reset
RECIPE=$(printf '%s\n' "$NOTES" | sed -n '/^\.\/notify /,/^NOTIFY_EOF$/p')
mkdir -p "$TMP/ws"
cp scripts/notify.sh "$TMP/ws/notify"; chmod +x "$TMP/ws/notify"
(cd "$TMP/ws" && bash -c "$RECIPE") >/dev/null 2>&1
p=$(payload)
[ -n "$p" ] && [ "$(jq -r .body "$p")" = "message body" ] && [ "$(jq -r .title "$p")" = "Title" ] \
  && pass "the recipe in run-notes queues a notification as written" || bad "the recipe in run-notes queues a notification as written"

# The recipe is one Bash call whose head is ./notify, so the read-only allowlist
# already covers it. No new write capability rides along with the fix.
RT=$(bash "$M" allowed-tools read-only)
echo "$RT" | tr ',' '\n' | grep -qxF 'Bash(./notify:*)' \
  && pass "read-only allowlist grants Bash(./notify:*)" || bad "read-only allowlist grants Bash(./notify:*)"
if echo "$RT" | tr ',' '\n' | grep -qE '^(Write|Edit)(\(|$)'; then
  bad "read-only allowlist must not gain Write/Edit"
else
  pass "read-only allowlist still has no Write/Edit"
fi

# Every read-only skill that notifies gets the note (the tier, not a per-skill list).
n=0
for f in skills/*/SKILL.md; do
  s=$(basename "$(dirname "$f")")
  grep -q '\./notify' "$f" || continue
  [ "$(bash "$M" mode "$s")" = read-only ] || continue
  n=$((n + 1))
  [ -n "$(bash "$M" run-notes "$(bash "$M" mode "$s")")" ] || bad "read-only skill $s gets no run-notes"
done
[ "$n" -gt 0 ] && pass "all $n read-only skills that call ./notify get the stdin note" || bad "found no read-only skill calling ./notify"

# --- 3. both dispatch paths pass the note ------------------------------------
grep -q 'skill_mode.sh run-notes "\$SKILL_MODE"' .github/workflows/aeon.yml \
  && grep -q 'RH_ARGS+=(--append-system-prompt "\$RUN_NOTES")' .github/workflows/aeon.yml \
  && pass "aeon.yml appends run-notes on the run-harness call" || bad "aeon.yml appends run-notes on the run-harness call"
grep -q 'skill_mode.sh" run-notes "\$mode"' scripts/dry-run.sh \
  && pass "dry-run.sh appends the same run-notes" || bad "dry-run.sh appends the same run-notes"
grep -q "grep '^::warning::claude denied' /tmp/harness-stderr.txt" .github/workflows/aeon.yml \
  && pass "aeon.yml re-emits the adapter's denial warning" || bad "aeon.yml re-emits the adapter's denial warning"

# --- 4. claude adapter warns on permission_denials ---------------------------
mkdir -p "$TMP/bin"
cat > "$TMP/bin/claude" <<'SH'
#!/usr/bin/env bash
cat >/dev/null
cat "$FAKE_CLAUDE_OUT"
SH
chmod +x "$TMP/bin/claude"
printf 'do the thing' > "$TMP/prompt"
run_claude() {
  mkdir -p "$TMP/rh"
  FAKE_CLAUDE_OUT="$1" PATH="$TMP/bin:$PATH" RH_LIB="$ROOT/harness-adapter/lib" \
    RH_TMPDIR="$TMP/rh" RH_PROMPT_FILE="$TMP/prompt" RH_MODE=read-only \
    bash harness-adapter/adapters/claude.sh 2>"$TMP/stderr" >"$TMP/stdout"
}

jq -cn '{type:"result", result:"done", usage:{input_tokens:1, output_tokens:2},
  permission_denials:[
    {tool_name:"Write", tool_use_id:"a", tool_input:{file_path:"/tmp/x.md", content:"SECRET-BODY"}},
    {tool_name:"Bash", tool_use_id:"b", tool_input:{command:"cat > out.md <<EOF\nSECRET-CMD\nEOF"}},
    {tool_name:"Write", tool_use_id:"c", tool_input:{file_path:"/tmp/y.md", content:"x"}},
    {tool_name:"Bash", tool_use_id:"e", tool_input:{command:"API_KEY=SECRET-ENV  curl -s https://x"}},
    {tool_name:"mcp__evil\n::error::pwned", tool_use_id:"d", tool_input:{}}]}' > "$TMP/denied.json"
run_claude "$TMP/denied.json"; rc=$?
[ "$rc" = 0 ] && [ "$(jq -r .result "$TMP/stdout")" = "done" ] \
  && pass "denials do not change the adapter result" || bad "denials do not change the adapter result (rc=$rc)"
W=$(grep '^::warning::claude denied' "$TMP/stderr")
case "$W" in
  *"Bash(cat>) x1"*"Bash(curl) x1"*"Write x2"*) pass "warning lists denied tool names with counts" ;;
  *) bad "warning lists denied tool names with counts (got: $W)" ;;
esac
grep -q 'SECRET-' "$TMP/stderr" && bad "warning leaked tool_input content" || pass "warning carries no tool_input content"
[ "$(grep -c '^::' "$TMP/stderr")" = 1 ] && pass "a crafted tool name cannot inject a workflow command" \
  || bad "a crafted tool name cannot inject a workflow command ($(cat "$TMP/stderr"))"

jq -cn '{type:"result", result:"done", usage:{}, permission_denials:[]}' > "$TMP/clean.json"
run_claude "$TMP/clean.json"
grep -q '::warning::' "$TMP/stderr" && bad "no warning without denials" || pass "no warning without denials"
jq -cn '{type:"result", result:"done", usage:{}}' > "$TMP/nofield.json"
run_claude "$TMP/nofield.json"
grep -q '::warning::' "$TMP/stderr" && bad "no warning when the field is absent" || pass "no warning when the field is absent"

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

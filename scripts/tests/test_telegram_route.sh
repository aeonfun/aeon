#!/usr/bin/env bash
# Unit tests for scripts/telegram-route.sh — the Telegram inbound router.
# No network: `gh` and `curl` are stubbed on PATH and record their args to logs.
# Runs in an isolated sandbox (symlinked skills/ + aeon.yml + docs/, private
# memory/) so the real repo is never mutated. Run: bash scripts/tests/test_telegram_route.sh
set -uo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ROUTER="$REPO/scripts/telegram-route.sh"

SANDBOX="$(mktemp -d)"
STUB_BIN="$SANDBOX/bin"
mkdir -p "$STUB_BIN" "$SANDBOX/work/memory"
ln -s "$REPO/skills"   "$SANDBOX/work/skills"
ln -s "$REPO/aeon.yml" "$SANDBOX/work/aeon.yml"
ln -s "$REPO/docs"     "$SANDBOX/work/docs"

GH_LOG="$SANDBOX/gh.log"
CURL_LOG="$SANDBOX/curl.log"
: > "$GH_LOG"; : > "$CURL_LOG"

# Stubs: record argv, succeed.
cat > "$STUB_BIN/gh"   <<EOF
#!/usr/bin/env bash
echo "\$*" >> "$GH_LOG"
EOF
cat > "$STUB_BIN/curl" <<EOF
#!/usr/bin/env bash
echo "\$*" >> "$CURL_LOG"
EOF
chmod +x "$STUB_BIN/gh" "$STUB_BIN/curl"

cd "$SANDBOX/work" || exit 1
export PATH="$STUB_BIN:$PATH"
export TELEGRAM_BOT_TOKEN="stub" TELEGRAM_CHAT_ID="123" GH_TOKEN="stub"

fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }
reset() { : > "$GH_LOG"; : > "$CURL_LOG"; rm -f memory/*.log memory/saved.md; }

run() { bash "$ROUTER" "$@" >/dev/null 2>&1; }

# 1. slash command dispatches the matching skill
reset
run command "/article quantum computing"
if grep -q "workflow run aeon.yml -f skill=article -f var=quantum computing" "$GH_LOG"; then
  pass "command /article -> skill=article var passthrough"
else bad "command /article -> skill=article var passthrough"; fi

# 2. underscore command inverts to hyphen skill name
reset
run command "/token_movers"
if grep -q "workflow run aeon.yml -f skill=token-movers" "$GH_LOG"; then
  pass "command /token_movers -> skill=token-movers"
else bad "command /token_movers -> skill=token-movers"; fi

# 3. unknown skill is rejected (no dispatch), user told
reset
run command "/definitely_not_a_skill_xyz"
if ! grep -q "workflow run" "$GH_LOG" && grep -qi "unknown command" "$CURL_LOG"; then
  pass "unknown command rejected, no dispatch"
else bad "unknown command rejected, no dispatch"; fi

# 4. /start with no payload greets, no dispatch
reset
run command "/start"
if ! grep -q "workflow run" "$GH_LOG" && grep -qi "aeon is running" "$CURL_LOG"; then
  pass "/start greets without dispatch"
else bad "/start greets without dispatch"; fi

# 5. /start deep link dispatches skill with arg
reset
run command "/start token-movers__daily"
if grep -q "workflow run aeon.yml -f skill=token-movers -f var=daily" "$GH_LOG"; then
  pass "/start deep link -> skill + var"
else bad "/start deep link -> skill + var"; fi

# 6. callback run -> dispatch
reset
run callback "run:token-movers:daily"
if grep -q "workflow run aeon.yml -f skill=token-movers -f var=daily" "$GH_LOG"; then
  pass "callback run -> dispatch"
else bad "callback run -> dispatch"; fi

# 7. callback snooze -> future-dated line in snoozes.log, no dispatch
reset
run callback "snooze:token-movers:BTC:3600"
line=$(cat memory/snoozes.log 2>/dev/null)
until_epoch="${line##*:}"
now=$(date -u +%s)
if [[ "$line" == token-movers:BTC:* ]] && [[ "$until_epoch" =~ ^[0-9]+$ ]] && [ "$until_epoch" -gt "$now" ] && ! grep -q "workflow run" "$GH_LOG"; then
  pass "callback snooze -> future epoch, no dispatch"
else bad "callback snooze -> future epoch, no dispatch (got '$line')"; fi

# 8. callback mute -> mutes.log
reset
run callback "mute:token-movers:BTC"
if grep -qxF "token-movers:BTC" memory/mutes.log 2>/dev/null; then
  pass "callback mute -> mutes.log"
else bad "callback mute -> mutes.log"; fi

# 9. callback with non-allowlisted action is rejected
reset
run callback "evil:token-movers:BTC:1"
if ! grep -q "workflow run" "$GH_LOG" && [ ! -s memory/snoozes.log ] && [ ! -s memory/mutes.log ]; then
  pass "unknown callback action rejected"
else bad "unknown callback action rejected"; fi

# 10. snooze with non-numeric seconds is rejected
reset
run callback "snooze:token-movers:BTC:soon"
if [ ! -s memory/snoozes.log ]; then
  pass "non-numeric snooze rejected"
else bad "non-numeric snooze rejected"; fi

# 11. reply marker -> dispatch skill with intent:input
reset
run reply "[github-monitor::add-repo] Which repo should I watch?" "owner/repo"
if grep -q "workflow run aeon.yml -f skill=github-monitor -f var=add-repo:owner/repo" "$GH_LOG"; then
  pass "reply marker -> skill var=intent:input"
else bad "reply marker -> skill var=intent:input"; fi

# 12. reply without a marker does not dispatch (returns 2 to caller)
reset
run reply "just a normal message with no marker" "hello"
if ! grep -q "workflow run" "$GH_LOG"; then
  pass "reply without marker -> no dispatch"
else bad "reply without marker -> no dispatch"; fi

# 13. path-traversal skill name is rejected
reset
run callback "run:../../etc:x"
if ! grep -q "workflow run" "$GH_LOG"; then
  pass "path-traversal skill name rejected"
else bad "path-traversal skill name rejected"; fi

# 14. callback schedule -> enable + weekly cron in aeon.yml, confirm, no dispatch.
# os.replace in schedule_skill swaps the symlinked aeon.yml for a private sandbox
# copy, so the real repo aeon.yml is never written through.
reset
run callback "schedule:token-movers:weekly"
tmline=$(grep -E '^  token-movers:' aeon.yml 2>/dev/null)
if [[ "$tmline" == *'enabled: true'* ]] && [[ "$tmline" == *'schedule: "0 9 * * 1"'* ]] \
   && grep -qi "scheduled" "$CURL_LOG" && ! grep -q "workflow run" "$GH_LOG"; then
  pass "callback schedule -> weekly cron in aeon.yml, no dispatch"
else bad "callback schedule -> weekly cron in aeon.yml, no dispatch (got '$tmline')"; fi

# 15. schedule for an unknown skill is rejected (no aeon.yml write, user told)
reset
before=$(grep -E '^  token-movers:' aeon.yml 2>/dev/null)
run callback "schedule:definitely-not-a-skill-xyz:weekly"
after=$(grep -E '^  token-movers:' aeon.yml 2>/dev/null)
if [ "$before" = "$after" ] && grep -qi "unknown skill" "$CURL_LOG"; then
  pass "schedule unknown skill rejected, no aeon.yml write"
else bad "schedule unknown skill rejected, no aeon.yml write"; fi

rm -rf "$SANDBOX"
echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

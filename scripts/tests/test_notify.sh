#!/usr/bin/env bash
# Integration test for scripts/notify.sh — exercises arg parsing, probe suppression,
# dedup, severity gate, and the .pending-notify fallback with all channels unset.
# No network, no secrets. Run: bash scripts/tests/test_notify.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
NOTIFY="scripts/notify.sh"

# Channels unset → everything falls back to .pending-notify
unset TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID DISCORD_WEBHOOK_URL SLACK_WEBHOOK_URL \
      SENDGRID_API_KEY NOTIFY_EMAIL_TO JSONRENDER_ENABLED NOTIFY_MIN_SEVERITY 2>/dev/null

WORK=".pending-notify"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }
reset() { rm -rf "$WORK" .notify-sent-hashes; }

# 1. structured message lands in pending with title header
reset
bash "$NOTIFY" --title "Token Report" --severity warn "Prices down 3.3 percent today" >/dev/null 2>&1
f=$(ls "$WORK"/*.md 2>/dev/null | head -1)
if [ -n "$f" ] && grep -q "Token Report" "$f" && grep -q "Prices down" "$f"; then
  pass "structured message saved with title header"
else
  bad "structured message saved with title header"
fi

# 2. probe/test message is suppressed (no pending file)
reset
bash "$NOTIFY" "quick test ping" >/dev/null 2>&1
if [ -z "$(ls "$WORK"/*.md 2>/dev/null)" ]; then
  pass "probe message suppressed"
else
  bad "probe message suppressed"
fi

# 3. dedup — identical message twice produces a single pending file
reset
bash "$NOTIFY" "Deployment finished successfully on prod cluster" >/dev/null 2>&1
bash "$NOTIFY" "Deployment finished successfully on prod cluster" >/dev/null 2>&1
count=$(ls "$WORK"/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" = "1" ]; then
  pass "duplicate message deduped ($count file)"
else
  bad "duplicate message deduped (got $count files)"
fi

# 4. severity gate — warn below critical floor is skipped
reset
NOTIFY_MIN_SEVERITY=critical bash "$NOTIFY" --severity warn "Heads up, minor wobble in metrics" >/dev/null 2>&1
if [ -z "$(ls "$WORK"/*.md 2>/dev/null)" ]; then
  pass "below-floor severity skipped"
else
  bad "below-floor severity skipped"
fi

# 5. severity gate — critical passes the floor
reset
NOTIFY_MIN_SEVERITY=warn bash "$NOTIFY" --severity critical "Database is down, paging now" >/dev/null 2>&1
if [ -n "$(ls "$WORK"/*.md 2>/dev/null)" ]; then
  pass "at/above-floor severity delivered"
else
  bad "at/above-floor severity delivered"
fi

# 6. -f file body still works (backward compat)
reset
tmp=$(mktemp); printf 'Line one\n\nLine two with detail' > "$tmp"
bash "$NOTIFY" -f "$tmp" >/dev/null 2>&1
f=$(ls "$WORK"/*.md 2>/dev/null | head -1)
if [ -n "$f" ] && grep -q "Line two" "$f"; then
  pass "-f file body delivered"
else
  bad "-f file body delivered"
fi
rm -f "$tmp"

reset
echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

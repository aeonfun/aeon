#!/usr/bin/env bash
# Integration test for scripts/notify.sh — exercises arg parsing, probe suppression,
# dedup, severity gate, and the .pending-notify fallback with all channels unset.
# No network, no secrets. Run: bash scripts/tests/test_notify.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
NOTIFY="scripts/notify.sh"

# Channels unset → everything falls back to .pending-notify
unset TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID DISCORD_WEBHOOK_URL SLACK_WEBHOOK_URL \
      RESEND_API_KEY NOTIFY_EMAIL_TO JSONRENDER_ENABLED NOTIFY_MIN_SEVERITY 2>/dev/null

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

# --- interactive flags (Telegram dry-run; NOTIFY_DRY_RUN records the payload
#     instead of sending, so these assert reply_markup with no network) ---
ROOT="$(pwd)"
ABS_NOTIFY="$ROOT/scripts/notify.sh"

# 7. --buttons attaches an inline_keyboard to the Telegram payload
reset
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 \
  bash "$NOTIFY" "Alert body long enough to clear the probe filter here" \
  --buttons '[[{"text":"Snooze","callback_data":"snooze:x:y:60"}]]' >/dev/null 2>&1
if [ -f "$WORK/tg-payload.jsonl" ] && \
   jq -e '.reply_markup.inline_keyboard[0][0].callback_data=="snooze:x:y:60"' "$WORK/tg-payload.jsonl" >/dev/null 2>&1; then
  pass "--buttons attaches inline_keyboard"
else
  bad "--buttons attaches inline_keyboard"
fi

# 8. --force-reply + --context set force_reply and prefix the [skill::intent] marker
reset
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 \
  bash "$NOTIFY" "Which repository should I track for you" \
  --force-reply --placeholder "owner/repo" --context "github-monitor::add-repo" >/dev/null 2>&1
if [ -f "$WORK/tg-payload.jsonl" ] && \
   jq -e '.reply_markup.force_reply==true' "$WORK/tg-payload.jsonl" >/dev/null 2>&1 && \
   jq -e '.text|startswith("[github-monitor::add-repo]")' "$WORK/tg-payload.jsonl" >/dev/null 2>&1; then
  pass "--force-reply + --context set marker and force_reply"
else
  bad "--force-reply + --context set marker and force_reply"
fi

# 9-11. --mute-key gate. Isolated cwd so the repo's memory/ is never touched.
MK="$(mktemp -d)"; mkdir -p "$MK/memory"; cd "$MK" || exit 1

# 9. muted key suppresses the send
rm -rf .pending-notify .notify-sent-hashes; echo "token-movers:BTC" > memory/mutes.log; : > memory/snoozes.log
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 \
  bash "$ABS_NOTIFY" "BTC alert that should be muted away entirely" --mute-key "token-movers:BTC" >/dev/null 2>&1
[ ! -f .pending-notify/tg-payload.jsonl ] && pass "--mute-key muted suppresses" || bad "--mute-key muted suppresses"

# 10. future snooze suppresses
rm -rf .pending-notify .notify-sent-hashes; : > memory/mutes.log
printf 'token-movers:ETH:%s\n' "$(( $(date -u +%s) + 3600 ))" > memory/snoozes.log
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 \
  bash "$ABS_NOTIFY" "ETH alert snoozed for an hour from now" --mute-key "token-movers:ETH" >/dev/null 2>&1
[ ! -f .pending-notify/tg-payload.jsonl ] && pass "--mute-key future snooze suppresses" || bad "--mute-key future snooze suppresses"

# 11. expired snooze delivers
rm -rf .pending-notify .notify-sent-hashes
printf 'token-movers:SOL:%s\n' "$(( $(date -u +%s) - 10 ))" > memory/snoozes.log
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 \
  bash "$ABS_NOTIFY" "SOL alert should deliver since snooze expired" --mute-key "token-movers:SOL" >/dev/null 2>&1
[ -f .pending-notify/tg-payload.jsonl ] && pass "--mute-key expired snooze delivers" || bad "--mute-key expired snooze delivers"

cd "$ROOT" || exit 1
rm -rf "$MK"

# --- global quick-action buttons (Run again + Schedule weekly), keyed to SKILL_NAME ---

# 12. a normal skill notification gets the global Run again + Schedule weekly row
reset
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 SKILL_NAME=token-movers \
  bash "$NOTIFY" "A normal skill digest long enough to clear the probe filter here" >/dev/null 2>&1
if [ -f "$WORK/tg-payload.jsonl" ] && \
   jq -e '.reply_markup.inline_keyboard[-1][0].callback_data=="run:token-movers"' "$WORK/tg-payload.jsonl" >/dev/null 2>&1 && \
   jq -e '.reply_markup.inline_keyboard[-1][1].callback_data=="schedule:token-movers:weekly"' "$WORK/tg-payload.jsonl" >/dev/null 2>&1; then
  pass "global Run again + Schedule weekly buttons attached"
else
  bad "global Run again + Schedule weekly buttons attached"
fi

# 13. skill --buttons rows are kept, with the global quick-action row appended beneath
reset
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 SKILL_NAME=pr-review \
  bash "$NOTIFY" "Digest body long enough to clear the probe filter comfortably" \
  --buttons '[[{"text":"Open","url":"https://example.com"}]]' >/dev/null 2>&1
if [ -f "$WORK/tg-payload.jsonl" ] && \
   jq -e '.reply_markup.inline_keyboard[0][0].url=="https://example.com"' "$WORK/tg-payload.jsonl" >/dev/null 2>&1 && \
   jq -e '.reply_markup.inline_keyboard[-1][0].callback_data=="run:pr-review"' "$WORK/tg-payload.jsonl" >/dev/null 2>&1; then
  pass "custom --buttons kept + global row appended"
else
  bad "custom --buttons kept + global row appended"
fi

# 14. a force_reply prompt never carries inline buttons (mutual exclusivity), even with SKILL_NAME set
reset
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 SKILL_NAME=github-monitor \
  bash "$NOTIFY" "Which repository should I track for you now" \
  --force-reply --placeholder "owner/repo" --context "github-monitor::add-repo" >/dev/null 2>&1
if [ -f "$WORK/tg-payload.jsonl" ] && \
   jq -e '.reply_markup.force_reply==true' "$WORK/tg-payload.jsonl" >/dev/null 2>&1 && \
   jq -e '.reply_markup|has("inline_keyboard")|not' "$WORK/tg-payload.jsonl" >/dev/null 2>&1; then
  pass "force_reply prompt carries no inline buttons"
else
  bad "force_reply prompt carries no inline buttons"
fi

# 15. no SKILL_NAME context -> no global buttons (bare notify stays button-free)
reset
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=123 NOTIFY_DRY_RUN=1 \
  bash "$NOTIFY" "A contextless notification with no skill name set at all here" >/dev/null 2>&1
if [ -f "$WORK/tg-payload.jsonl" ] && \
   jq -e '.|has("reply_markup")|not' "$WORK/tg-payload.jsonl" >/dev/null 2>&1; then
  pass "no SKILL_NAME -> no global buttons"
else
  bad "no SKILL_NAME -> no global buttons"
fi

reset
echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

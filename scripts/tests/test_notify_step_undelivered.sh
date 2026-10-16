#!/usr/bin/env bash
# The "Send pending notifications" step of aeon.yml removes the notify queue once it
# has tried every payload. When delivery fails on every channel the payload is gone,
# so the step must say so with a ::warning:: instead of only echoing a line. With no
# channel configured at all every payload fails by design, so there is no warning.
# Runs the real step against stub notify-deliver scripts. Needs yq; skips otherwise.
# Run:  bash scripts/tests/test_notify_step_undelivered.sh
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if ! command -v yq >/dev/null 2>&1; then echo "SKIP - needs yq"; exit 0; fi

pass=0; fail=0
ok()  { pass=$((pass+1)); echo "ok   - $1"; }
bad() { fail=$((fail+1)); echo "FAIL - $1"; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
yq '.jobs[].steps[] | select(.name == "Send pending notifications") | .run' \
  "$REPO/.github/workflows/aeon.yml" > "$TMP/step.sh"
[ -s "$TMP/step.sh" ] || { echo "FAIL - could not extract the notify step"; exit 1; }

# run_step <deliver-exit-codes...>: one queued payload per code, in name order.
# One channel (Discord) is configured unless NO_CHANNEL=1.
run_step() {
  rm -rf "$TMP/w"; mkdir -p "$TMP/w/scripts" "$TMP/w/pending/notify-queue"
  local i=0 code
  for code in "$@"; do
    i=$((i+1)); printf '{}' > "$TMP/w/pending/notify-queue/$i.json"
    printf '%s' "$code" > "$TMP/w/pending/notify-queue/$i.exit"
  done
  # stub: exit with the code recorded next to the payload
  cat > "$TMP/w/scripts/notify-deliver.sh" <<'STUB'
#!/usr/bin/env bash
exit "$(cat "${1%.json}.exit")"
STUB
  local hook="https://discord.example/hook"
  [ "${NO_CHANNEL:-0}" = 1 ] && hook=""
  ( cd "$TMP/w" && env -u TELEGRAM_BOT_TOKEN -u TELEGRAM_CHAT_ID -u SLACK_WEBHOOK_URL \
      -u BUZZ_PRIVATE_KEY -u BUZZ_CHANNEL_ID -u RESEND_API_KEY -u NOTIFY_EMAIL_TO \
      DISCORD_WEBHOOK_URL="$hook" AEON_PENDING_DIR="$TMP/w/pending" SKILL_NAME=demo-skill \
      bash --noprofile --norc "$TMP/step.sh" ) > "$TMP/out" 2>&1
}

run_step 0 0
grep -q '^::warning::' "$TMP/out" && bad "no warning expected when everything is delivered" || ok "all delivered: no warning"

run_step 0 1
grep -q '^::warning::1 of 2 notification(s) from demo-skill were not delivered' "$TMP/out" \
  && ok "partial failure is annotated with the count" || bad "partial failure not annotated: $(cat "$TMP/out")"

run_step 1
grep -q '^::warning::1 of 1 notification(s) from demo-skill were not delivered' "$TMP/out" \
  && ok "total failure is annotated" || bad "total failure not annotated: $(cat "$TMP/out")"

NO_CHANNEL=1 run_step 1 1
if grep -q '^::warning::' "$TMP/out"; then bad "no channel configured: no warning expected: $(cat "$TMP/out")"
elif grep -q '^No notify channel configured; 2 notification(s) from demo-skill were not sent' "$TMP/out"; then ok "no channel configured: plain note, no warning"
else bad "no channel configured: note missing: $(cat "$TMP/out")"; fi

echo "---"
echo "PASS: $pass   FAIL: $fail"
[ "$fail" -eq 0 ]

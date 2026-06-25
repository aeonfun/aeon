#!/usr/bin/env bash
# Aeon notify — committed source of truth for the ./notify command.
# The workflow copies this to ./notify before each run (was a heredoc inline).
# Keeping it a real file makes it version-controlled, lintable, and testable:
#   python3 scripts/tests/test_notify_format.py
#
# Usage (backward compatible):
#   ./notify "message"                         — inline arg (short, multi-line OK)
#   ./notify -f path/to/file.md                — read body from file (any length)
# New structured form (all optional, compose freely):
#   ./notify --title "Token Report" --severity warn -f body.md --link https://...
#   severity ∈ {info(default), success, warn, critical}; gated by NOTIFY_MIN_SEVERITY.
#
# Per-channel rendering (via scripts/notify_format.py): Telegram chunks (fence-safe,
# 3900), Discord embeds (color by severity), Slack Block Kit. Falls back to
# .pending-notify/ for post-run delivery when the sandbox blocks outbound curl.
set -euo pipefail

# Resolve the formatter whether run as ./notify (repo root) or scripts/notify.sh
_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FMT=""
for _cand in "scripts/notify_format.py" "$_HERE/notify_format.py" "$_HERE/scripts/notify_format.py"; do
  [ -f "$_cand" ] && FMT="$_cand" && break
done
if [ -z "$FMT" ]; then echo "notify: notify_format.py not found" >&2; exit 3; fi

TITLE=""
SEVERITY="info"
LINK=""
MSG=""
have_body=false
while [ $# -gt 0 ]; do
  case "$1" in
    -f|--file|--body)
      if [ -z "${2:-}" ] || [ ! -f "$2" ]; then
        echo "notify: $1 requires an existing file path" >&2
        exit 2
      fi
      MSG=$(cat "$2"); have_body=true; shift 2 ;;
    --title)    TITLE="${2:-}"; shift 2 ;;
    --severity) SEVERITY="${2:-info}"; shift 2 ;;
    --link)     LINK="${2:-}"; shift 2 ;;
    *)          if [ "$have_body" = false ]; then MSG="$1"; have_body=true; fi; shift ;;
  esac
done

# Normalize severity
SEVERITY=$(printf '%s' "$SEVERITY" | tr '[:upper:]' '[:lower:]')
case "$SEVERITY" in info|success|warn|critical) ;; *) SEVERITY="info" ;; esac

# Severity gate — skip anything below NOTIFY_MIN_SEVERITY (info<warn<critical; success~info)
rank() { case "$1" in critical) echo 2 ;; warn) echo 1 ;; *) echo 0 ;; esac; }
if [ -n "${NOTIFY_MIN_SEVERITY:-}" ]; then
  if [ "$(rank "$SEVERITY")" -lt "$(rank "$(printf '%s' "$NOTIFY_MIN_SEVERITY" | tr '[:upper:]' '[:lower:]')")" ]; then
    echo "notify: severity '$SEVERITY' below NOTIFY_MIN_SEVERITY, skipping" >&2
    exit 0
  fi
fi

# Suppress obvious diagnostic probes (short test/trace/ping/debug pings)
MSG_LEN=${#MSG}
if [ "$MSG_LEN" -lt 120 ]; then
  MSG_LOWER=$(printf '%s' "$MSG" | tr '[:upper:]' '[:lower:]')
  case "$MSG_LOWER" in
    *test*|*trace*|*ping*|*debug*|hello|hi)
      echo "notify: suppressing trace/test message ($MSG_LEN chars): $MSG" >&2
      exit 0 ;;
  esac
fi

# Append link as a trailing line if provided
if [ -n "$LINK" ]; then
  MSG=$(printf '%s\n\n🔗 %s' "$MSG" "$LINK")
fi

# Dedup within this run — same rendered message never sent twice
_sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; }
HASH=$(printf '%s' "$TITLE|$SEVERITY|$MSG" | _sha | awk '{print $1}')
HASH_FILE=".notify-sent-hashes"
touch "$HASH_FILE" 2>/dev/null || true
if grep -qxF "$HASH" "$HASH_FILE" 2>/dev/null; then
  echo "notify: duplicate message (hash ${HASH:0:8}), skipping" >&2
  exit 0
fi
printf '%s\n' "$HASH" >> "$HASH_FILE" 2>/dev/null || true

# Plain-text header for the pending/fallback path (live channels render their own)
case "$SEVERITY" in
  critical) EMOJI='🚨' ;;
  warn)     EMOJI='⚠️' ;;
  success)  EMOJI='✅' ;;
  *)        EMOJI='ℹ️' ;;
esac
if [ -n "$TITLE" ]; then
  PLAIN=$(printf '%s %s\n\n%s' "$EMOJI" "$TITLE" "$MSG")
else
  PLAIN="$MSG"
fi

# Always save to .pending-notify/ for post-run delivery (sandbox fallback)
mkdir -p .pending-notify
TS=$(date -u +%s)
printf '%s' "$PLAIN" > ".pending-notify/${TS}.md"

DELIVERED=false

# Telegram — fence-safe chunks (parse_mode Markdown, fallback to none)
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  TG_CHUNKS_B64=$(printf '%s' "$MSG" | python3 "$FMT" telegram --title "$TITLE" --severity "$SEVERITY" || true)
  while IFS= read -r TG_CHUNK_B64; do
    [ -z "$TG_CHUNK_B64" ] && continue
    TG_MSG=$(printf '%s' "$TG_CHUNK_B64" | base64 -d)
    TG_RESULT=$(curl -s -w "\n%{http_code}" -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg chat "$TELEGRAM_CHAT_ID" --arg text "$TG_MSG" '{chat_id:$chat,text:$text,parse_mode:"Markdown"}')" 2>/dev/null) || true
    TG_HTTP=$(echo "$TG_RESULT" | tail -1)
    TG_OK=$(echo "$TG_RESULT" | sed '$d' | jq -r '.ok // false' 2>/dev/null || echo "false")
    if [ "$TG_HTTP" = "200" ] && [ "$TG_OK" = "true" ]; then
      DELIVERED=true
    else
      curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg chat "$TELEGRAM_CHAT_ID" --arg text "$TG_MSG" '{chat_id:$chat,text:$text}')" > /dev/null 2>&1 && DELIVERED=true || true
    fi
    sleep 0.3
  done <<< "$TG_CHUNKS_B64"
fi

# Discord — rich embeds, one POST per embed
if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
  DISCORD_PAYLOADS=$(printf '%s' "$MSG" | python3 "$FMT" discord --title "$TITLE" --severity "$SEVERITY" || true)
  while IFS= read -r DC_PAYLOAD; do
    [ -z "$DC_PAYLOAD" ] && continue
    curl -sf -X POST "$DISCORD_WEBHOOK_URL" -H "Content-Type: application/json" \
      -d "$DC_PAYLOAD" > /dev/null 2>&1 && DELIVERED=true || true
    sleep 0.3
  done <<< "$DISCORD_PAYLOADS"
fi

# Slack — Block Kit
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  SLACK_PAYLOAD=$(printf '%s' "$MSG" | python3 "$FMT" slack --title "$TITLE" --severity "$SEVERITY" || true)
  if [ -n "$SLACK_PAYLOAD" ]; then
    curl -sf -X POST "$SLACK_WEBHOOK_URL" -H "Content-Type: application/json" \
      -d "$SLACK_PAYLOAD" > /dev/null 2>&1 && DELIVERED=true || true
  fi
fi

# Email via SendGrid (unchanged)
if [ -n "${SENDGRID_API_KEY:-}" ] && [ -n "${NOTIFY_EMAIL_TO:-}" ]; then
  FROM="${NOTIFY_EMAIL_FROM:-aeon@notifications.aeon.bot}"
  PREFIX="${NOTIFY_EMAIL_SUBJECT_PREFIX:-[Aeon]}"
  SUBJECT="$PREFIX ${TITLE:-${SKILL_NAME:-notification}}"
  HTML_BODY=$(printf '%s' "$PLAIN" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
  HTML_BODY="<html><body><pre style=\"font-family:monospace;white-space:pre-wrap;\">${HTML_BODY}</pre></body></html>"
  curl -sf -X POST "https://api.sendgrid.com/v3/mail/send" \
    -H "Authorization: Bearer ${SENDGRID_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg from "$FROM" --arg to "$NOTIFY_EMAIL_TO" --arg subject "$SUBJECT" \
          --arg html "$HTML_BODY" --arg text "$PLAIN" \
          '{personalizations:[{to:[{email:$to}]}],from:{email:$from},subject:$subject,content:[{type:"text/plain",value:$text},{type:"text/html",value:$html}]}')" > /dev/null 2>&1 || true
fi

# json-render channel — save raw message for post-run conversion
if [ "${JSONRENDER_ENABLED:-false}" = "true" ] && [ -n "${SKILL_NAME:-}" ]; then
  mkdir -p apps/dashboard/outputs
  printf '%s' "$PLAIN" > "apps/dashboard/outputs/.pending-${SKILL_NAME}.md"
fi

# Remove pending file if immediate delivery succeeded (prevents double-send)
if [ "$DELIVERED" = "true" ]; then
  rm -f ".pending-notify/${TS}.md"
fi

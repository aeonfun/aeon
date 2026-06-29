#!/usr/bin/env bash
# Post-process outbound disclosure emails left by the `disclosure-emailer` skill.
#
# WHY THIS EXISTS
# ---------------
# When vuln-scanner finds a CODE flaw in a repo that has neither PVR nor a
# public-PR channel, the only safe disclosure path is a private email to the
# maintainer. That email is an *auth-required* outbound call (Resend API key in
# the header), and CLAUDE.md's sandbox rules say those fail from inside Claude's
# sandbox (env-var expansion in curl headers is blocked). So the skill only
# *decides + composes* (writes .pending-email/*.json); this script — which the
# workflow runs AFTER Claude finishes, with full env access — does the actual
# send. Same split as scripts/postprocess-replicate.sh.
#
# This is OUTBOUND mail to third-party maintainers. It is deliberately separate
# from the SendGrid operator-notify channel wired into the "Send pending
# notifications" workflow step (that one tells the *operator* things; this one
# tells *maintainers* about their bugs).
#
# CONTRACT with the skill (.pending-email/<slug>.json):
#   { "draft_path": "memory/pending-disclosures/<file>.md",   # for status flip
#     "repo": "owner/repo", "slug": "owner-repo",
#     "to": "maintainer@example.com", "cc": "",               # cc optional
#     "subject": "...", "text": "...", "severity": "medium" }
#
# ON SUCCESS (HTTP 200 + {id}):
#   - append a row to memory/email-log.json   (dedup source of truth)
#   - flip the draft's frontmatter: status: email-sent (+ email_id/_at/_to)
#   The workflow's "Commit results" step (git add -A) persists both.
# ON FAILURE: leave the draft untouched so the next daily run retries it.
#
# SAFETY GATES (this script is the last line before a stranger's inbox):
#   - DISCLOSURE_EMAIL_PAUSED truthy        -> global kill-switch, send nothing
#   - RESEND_API_KEY / RESEND_FROM unset    -> graceful skip (drafts stay queued)
#   - MAX_SENDS cap per run                 -> blast-radius limit
#   - Idempotency-Key (content hash)        -> Resend dedupes identical re-sends 24h
#   - the skill already filtered to auto_send:true, valid contact, not-yet-sent
#
# No-op for every other skill (its .pending-email/ dir simply won't exist).
set -uo pipefail

PENDING_DIR=".pending-email"
LEDGER="memory/email-log.json"
MAX_SENDS="${DISCLOSURE_EMAIL_MAX_PER_RUN:-1}"     # emails sent per execution (drip: 1)
DAILY_CAP="${DISCLOSURE_EMAIL_DAILY_CAP:-1}"       # emails sent per UTC day (re-run-proof)
MAX_ATTEMPTS="${DISCLOSURE_EMAIL_MAX_ATTEMPTS:-3}" # give up + flag a draft after N failures
COOLDOWN_DAYS="${DISCLOSURE_EMAIL_COOLDOWN_DAYS:-7}" # don't email the same recipient twice within N days
GLOBAL_CC="${RESEND_CC:-}"                         # always CC this address (operator audit copy)
API="https://api.resend.com/emails"

log() { echo "postprocess-email: $*"; }

# --- Global kill-switch -------------------------------------------------------
case "${DISCLOSURE_EMAIL_PAUSED:-}" in
  1|true|TRUE|yes|on)
    log "DISCLOSURE_EMAIL_PAUSED is set — sending nothing this run."
    exit 0 ;;
esac

# --- Nothing queued -----------------------------------------------------------
if [ ! -d "$PENDING_DIR" ] || [ -z "$(ls -A "$PENDING_DIR"/*.json 2>/dev/null)" ]; then
  log "no pending emails"
  exit 0
fi

# --- Not configured: leave the queue intact for a later, configured run -------
if [ -z "${RESEND_API_KEY:-}" ] || [ -z "${RESEND_FROM:-}" ]; then
  log "RESEND_API_KEY / RESEND_FROM not set — skipping (drafts stay queued)."
  log "Set both as secrets (RESEND_FROM e.g. 'Security <disclosures@send.example.com>') to enable."
  exit 0
fi

# Seed the ledger if missing/empty/corrupt so jq appends never fail.
if [ ! -s "$LEDGER" ] || ! jq -e . "$LEDGER" >/dev/null 2>&1; then
  mkdir -p "$(dirname "$LEDGER")"
  echo "[]" > "$LEDGER"
fi

# --- Per-day cap (re-run-proof) ----------------------------------------------
# Count today's sends straight from the committed ledger, so a manual dispatch
# on top of the daily cron can't push out a second disclosure the same day.
# Effective budget this run = min(per-run cap, remaining daily allowance).
TODAY=$(date -u +%F)
SENT_TODAY=$(jq --arg d "$TODAY" '[.[] | select((.sent_at // "") | startswith($d))] | length' "$LEDGER" 2>/dev/null || echo 0)
REMAINING=$(( DAILY_CAP - SENT_TODAY ))
if [ "$REMAINING" -le 0 ]; then
  log "daily cap reached ($SENT_TODAY/$DAILY_CAP sent today, UTC $TODAY) — nothing more today."
  exit 0
fi
BUDGET=$MAX_SENDS
[ "$REMAINING" -lt "$BUDGET" ] && BUDGET=$REMAINING
log "send budget this run: $BUDGET  (per-run cap $MAX_SENDS, daily remaining $REMAINING of $DAILY_CAP)"

SENT_REPORT=""   # lines for the post-send operator notification
FAIL_REPORT=""
SENT_N=0

# Process highest-priority first: the skill names queue files NN-<slug>.json
# (00 = most urgent), and glob expansion is sorted, so the drip always spends
# its one slot on the most important pending disclosure.
for req in "$PENDING_DIR"/*.json; do
  [ -f "$req" ] || continue
  if [ "$SENT_N" -ge "$BUDGET" ]; then
    log "send budget ($BUDGET) spent — remaining drafts picked up next run/day."
    break
  fi

  if ! jq -e . "$req" >/dev/null 2>&1; then
    log "skip $(basename "$req") — not valid JSON"
    continue
  fi

  REPO=$(jq -r '.repo // empty'       "$req")
  SLUG=$(jq -r '.slug // empty'       "$req")
  TO=$(jq -r '.to // empty'           "$req")
  CC_RAW=$(jq -c '.cc // []'          "$req")   # array | "a,b" string | "" | null
  SUBJECT=$(jq -r '.subject // empty' "$req")
  TEXT=$(jq -r '.text // empty'       "$req")
  DRAFT=$(jq -r '.draft_path // empty' "$req")

  if [ -z "$TO" ] || [ -z "$SUBJECT" ] || [ -z "$TEXT" ]; then
    log "skip $(basename "$req") — missing to/subject/text"
    continue
  fi

  # De-wrap: drafts are hard-wrapped at ~80 cols, but a plain-text email keeps
  # those mid-sentence newlines literally — so the message renders raggedly
  # broken on a wide screen. Join soft-wrapped paragraph lines back into one
  # line each (clients soft-wrap to the reader's width). A line is only folded
  # into the previous one when the previous line is "long" (>= 60 chars) — that
  # signals a wrap, not an intentional break — so blank lines (paragraph
  # breaks), indented code/argv blocks, list items, and short standalone lines
  # (the greeting, the "Thanks," / signature) are all preserved as-is.
  TEXT=$(printf '%s' "$TEXT" | python3 -c '
import re, sys
LIST = re.compile(r"^\s*([-*•]|\d+[.)])\s")
out = []
for ln in sys.stdin.read().split("\n"):
    prev = out[-1] if out else None
    if (prev and prev.strip() and len(prev) >= 60
            and not prev[:1].isspace() and not LIST.match(prev)
            and ln.strip() and not ln[:1].isspace() and not LIST.match(ln)):
        out[-1] = prev.rstrip() + " " + ln.strip()
    else:
        out.append(ln)
sys.stdout.write("\n".join(out))
' 2>/dev/null) || TEXT=$(jq -r '.text // empty' "$req")

  # Idempotency guard (defense-in-depth — the skill dedups too, but email is
  # irreversible). Skip if this slug is already in the committed ledger, or if
  # the draft is already flagged email-sent. Catches a re-queue even when the
  # skill's own dedup misfires.
  if [ -n "$SLUG" ] && jq -e --arg s "$SLUG" 'any(.[]; .slug==$s)' "$LEDGER" >/dev/null 2>&1; then
    log "skip $(basename "$req") — '$SLUG' already in $LEDGER (already sent)"
    continue
  fi
  if [ -n "$DRAFT" ] && [ -f "$DRAFT" ] && grep -qiE '^status:[[:space:]]*email-sent' "$DRAFT"; then
    log "skip $(basename "$req") — draft already status: email-sent"
    continue
  fi
  # Defensive recipient sanity check (contact came from the repo's own README /
  # SECURITY.md — untrusted). The skill validates too; belt-and-suspenders here.
  if ! printf '%s' "$TO" | grep -qE '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'; then
    log "skip $(basename "$req") — recipient '$TO' is not a plausible email"
    continue
  fi

  # Per-maintainer cooldown: don't email the same person twice within
  # COOLDOWN_DAYS, even for a different repo. Checks the committed ledger by
  # recipient (TO only — CC'd people, incl. the operator audit copy, are exempt).
  # A cooled-down draft is left queued and retried once the window passes; it
  # does NOT consume the daily budget, so the slot moves to the next-priority one.
  if [ "$COOLDOWN_DAYS" -gt 0 ]; then
    LAST=$(jq -r --arg to "$TO" '[.[] | select(.to==$to) | .sent_at] | sort | last // ""' "$LEDGER" 2>/dev/null)
    if [ -n "$LAST" ]; then
      BLOCK=$(python3 -c "
import sys, datetime
last, days = sys.argv[1], int(sys.argv[2])
try:
    t = datetime.datetime.fromisoformat(last.replace('Z', '+00:00'))
except ValueError:
    sys.exit(0)
now = datetime.datetime.now(datetime.timezone.utc)
print('BLOCK' if (now - t).total_seconds() < days * 86400 else '')
" "$LAST" "$COOLDOWN_DAYS" 2>/dev/null || true)
      if [ "$BLOCK" = "BLOCK" ]; then
        log "cooldown: $TO last emailed $LAST (< ${COOLDOWN_DAYS}d) — skipping, will retry after window"
        continue
      fi
    fi
  fi

  # Outgoing-secret tripwire (CLAUDE.md: never exfiltrate secrets). The body is
  # Aeon-authored, but this defends against a prompt-injection / copy-paste slip
  # that drags a real token into a disclosure. Refuse to send if one is present.
  SECRET_RE='(sk-[A-Za-z0-9]{20}|re_[A-Za-z0-9]{8}[A-Za-z0-9_]{12}|gh[pousr]_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20}|xox[baprs]-[0-9A-Za-z-]{10}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
  if printf '%s\n%s' "$SUBJECT" "$TEXT" | grep -qE "$SECRET_RE"; then
    log "BLOCKED: $REPO -> $TO — outgoing body looks like it contains a secret; not sending"
    FAIL_REPORT="${FAIL_REPORT}- ${REPO} -> ${TO}: BLOCKED (possible secret in body — review draft)"$'\n'
    continue
  fi

  # Stable idempotency key — same draft re-queued within 24h won't double-send.
  IDEM=$(printf '%s' "${REPO}|${TO}|${SUBJECT}" | sha256sum | awk '{print $1}')

  # CC = per-draft cc (e.g. SECURITY.md "email X, cc Y and Z") + the global
  # operator audit copy (RESEND_CC). Per-draft cc may be a JSON array OR a
  # comma-separated string. Normalize, add the global cc, drop blanks and the
  # primary recipient, de-dupe.
  CC_JSON=$(jq -n --argjson cc "$CC_RAW" --arg g "$GLOBAL_CC" --arg to "$TO" '
    ( (if   ($cc | type) == "array"  then $cc
       elif ($cc | type) == "string" then ($cc | split(",") | map(gsub("^\\s+|\\s+$"; "")))
       else [] end) + [$g] )
    | map(select(. != "" and . != $to)) | unique')

  PAYLOAD=$(jq -n \
    --arg from    "$RESEND_FROM" \
    --arg to      "$TO" \
    --argjson cc  "$CC_JSON" \
    --arg reply   "${RESEND_REPLY_TO:-}" \
    --arg subject "$SUBJECT" \
    --arg text    "$TEXT" \
    '{from:$from, to:[$to], subject:$subject, text:$text}
       + (if $reply != "" then {reply_to:$reply} else {} end)
       + (if ($cc | length) > 0 then {cc:$cc} else {} end)')

  log "sending: $REPO -> $TO  (\"$SUBJECT\")"
  RESP=$(curl -sS --max-time 30 -X POST "$API" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $IDEM" \
    -d "$PAYLOAD" 2>&1)

  ID=$(printf '%s' "$RESP" | jq -r '.id // empty' 2>/dev/null)

  if [ -z "$ID" ]; then
    ERR=$(printf '%s' "$RESP" | jq -r '.message // .name // .error // empty' 2>/dev/null)
    [ -z "$ERR" ] && ERR=$(printf '%s' "$RESP" | head -c 200)
    # Bump the draft's failure counter; after MAX_ATTEMPTS, stop retrying it
    # forever — flag it email-failed so the operator can fix the address/contact.
    GAVEUP=""
    if [ -n "$DRAFT" ] && [ -f "$DRAFT" ]; then
      GAVEUP=$(python3 - "$DRAFT" "$MAX_ATTEMPTS" <<'PY' 2>/dev/null || true
import sys, re
path, maxa = sys.argv[1], int(sys.argv[2])
src = open(path, encoding="utf-8").read()
m = re.match(r'^---\n(.*?)\n---\n(.*)$', src, re.S)
if not m: sys.exit(0)
fm, body = m.group(1), m.group(2)
attempts, kept = 0, []
for ln in fm.split("\n"):
    k = ln.split(":", 1)[0].strip() if ":" in ln else ""
    if k == "send_attempts":
        try: attempts = int(ln.split(":", 1)[1].strip())
        except ValueError: attempts = 0
        continue  # drop; re-added updated below
    kept.append(ln)
attempts += 1
gaveup = attempts >= maxa
out = []
for ln in kept:
    k = ln.split(":", 1)[0].strip() if ":" in ln else ""
    if k == "status" and gaveup:
        ln = "status: email-failed"
    out.append(ln)
out.append(f"send_attempts: {attempts}")
open(path, "w", encoding="utf-8").write("---\n" + "\n".join(out) + "\n---\n" + body)
print("GAVEUP" if gaveup else f"ATTEMPT {attempts}/{maxa}")
PY
)
    fi
    log "FAILED: $REPO -> $TO :: $ERR ${GAVEUP:+[$GAVEUP]}"
    if [ "$GAVEUP" = "GAVEUP" ]; then
      FAIL_REPORT="${FAIL_REPORT}- ${REPO} -> ${TO}: FAILED ${MAX_ATTEMPTS}x — giving up (status: email-failed), needs operator. last: ${ERR}"$'\n'
    else
      FAIL_REPORT="${FAIL_REPORT}- ${REPO} -> ${TO}: ${ERR} (${GAVEUP:-will retry})"$'\n'
    fi
    continue   # leave queue intact → retried next run unless given up
  fi

  SENT_N=$((SENT_N + 1))
  NOW=$(date -u +%FT%TZ)
  log "SENT: $REPO -> $TO  resend_id=$ID"

  # 1) Append to the dedup ledger (source of truth).
  tmp=$(mktemp)
  jq --arg slug "$SLUG" --arg repo "$REPO" --arg to "$TO" \
     --arg subject "$SUBJECT" --arg id "$ID" --arg at "$NOW" --arg draft "$DRAFT" \
     '. + [{slug:$slug, repo:$repo, to:$to, subject:$subject, resend_id:$id, sent_at:$at, draft_path:$draft}]' \
     "$LEDGER" > "$tmp" 2>/dev/null && mv "$tmp" "$LEDGER" || { rm -f "$tmp"; log "WARN: ledger append failed for $REPO"; }

  # 2) Flip the draft frontmatter so trackers see it as sent and it never re-queues.
  if [ -n "$DRAFT" ] && [ -f "$DRAFT" ]; then
    python3 - "$DRAFT" "$ID" "$NOW" "$TO" <<'PY' || log "WARN: frontmatter flip failed for $DRAFT"
import sys, re
path, eid, at, to = sys.argv[1:5]
src = open(path, encoding="utf-8").read()
m = re.match(r'^---\n(.*?)\n---\n(.*)$', src, re.S)
if not m:
    sys.exit(0)  # no frontmatter — leave the file alone
fm, body = m.group(1), m.group(2)
lines, seen = [], set()
for ln in fm.split("\n"):
    key = ln.split(":", 1)[0].strip() if ":" in ln else ""
    if key == "status":
        ln = "status: email-sent"
    seen.add(key)
    lines.append(ln)
for k, v in (("email_sent_at", at), ("email_id", eid), ("email_to", to)):
    if k not in seen:
        lines.append(f"{k}: {v}")
open(path, "w", encoding="utf-8").write("---\n" + "\n".join(lines) + "\n---\n" + body)
PY
  fi

  SENT_REPORT="${SENT_REPORT}- ${REPO} -> ${TO} (${SUBJECT}) [resend ${ID}]"$'\n'

  # Pace under Resend's 2 req/s default.
  sleep 1
done

# --- Post-send operator notification (this step runs AFTER the notify step, so
#     fan out inline here — same channels as the workflow's notify step) -------
if [ -n "$SENT_REPORT" ] || [ -n "$FAIL_REPORT" ]; then
  MSG="*Disclosure emailer*"$'\n'
  [ -n "$SENT_REPORT" ] && MSG="${MSG}sent ${SENT_N}:"$'\n'"${SENT_REPORT}"
  [ -n "$FAIL_REPORT" ] && MSG="${MSG}failed (will retry next run):"$'\n'"${FAIL_REPORT}"

  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    TG="$MSG"; [ ${#TG} -gt 4000 ] && TG="${TG:0:3990}...(truncated)"
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg chat "$TELEGRAM_CHAT_ID" --arg text "$TG" '{chat_id:$chat, text:$text}')" >/dev/null 2>&1 || true
  fi
  if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
    curl -sf -X POST "$DISCORD_WEBHOOK_URL" -H "Content-Type: application/json" \
      -d "$(jq -n --arg text "$MSG" '{content:$text}')" >/dev/null 2>&1 || true
  fi
  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -sf -X POST "$SLACK_WEBHOOK_URL" -H "Content-Type: application/json" \
      -d "$(jq -n --arg text "$MSG" '{text:$text}')" >/dev/null 2>&1 || true
  fi
fi

log "done — sent $SENT_N this run."

#!/usr/bin/env bash
# Aeon Telegram router — the single source of truth for turning an inbound
# Telegram update into an action, WITHOUT an LLM in the loop.
#
# Used by two callers that both pre-classify the update and then delegate here:
#   • the 5-min poller in .github/workflows/messages.yml (webhook inactive), and
#   • the lightweight `route` job in the same workflow (webhook active — the
#     Cloudflare Worker relays classified updates via repository_dispatch).
#
# Modes (argv[1]):
#   command  "<raw text>"                     slash command or /start deep link
#   callback "<callback_data>"                inline-button tap (action:skill:arg1:arg2)
#   reply    "<reply_to_text>" "<user text>"  reply to a force_reply prompt
#
# Side effects: dispatches skills via `gh workflow run aeon.yml`, appends to
# memory/{snoozes,mutes}.log or memory/saved.md, edits a skill's schedule in
# aeon.yml on a `schedule` callback (the CALLER commits all of these), and sends
# canned replies via the Telegram Bot API. Never mutates the repo history.
#
# Security: every inbound is already owner-gated (TELEGRAM_CHAT_ID) by the caller.
# Defence in depth lives here too — a skill name must match ^[a-z0-9-]+$ AND resolve
# to an existing skills/<name>/ directory before it can be dispatched, callback
# actions are allowlisted, and snooze durations must be numeric. Values only ever
# reach `gh` as `-f var=` data, never interpolated into a shell command.
#
# Deliberately NO `set -e`: a single malformed update must not abort a poll that is
# processing a batch. Functions return non-zero on failure; the caller logs and moves on.
set -uo pipefail

MODE="${1:-}"

TG_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN:-}"
CALLBACK_ACTIONS="run snooze mute save dismiss schedule"

# --- helpers ---------------------------------------------------------------

log() { echo "route: $*" >&2; }

# Send a plain message back to the owner chat. Best-effort; never fatal.
send_tg() {
  local text="$1"
  [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && return 0
  [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
  curl -sf -X POST "${TG_API}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg chat "$TELEGRAM_CHAT_ID" --arg text "$text" \
          '{chat_id:$chat, text:$text}')" >/dev/null 2>&1 || true
}

# Validate + dispatch a skill run. $1 skill (command form, - or _), $2 var.
dispatch_skill() {
  local skill="${1//_/-}"   # invert the /command naming rule (underscores -> hyphens)
  local var="${2:-}"
  if ! [[ "$skill" =~ ^[a-z0-9-]+$ ]]; then
    log "rejected skill name: '$skill'"
    send_tg "Unknown command."
    return 1
  fi
  if [ ! -d "skills/$skill" ]; then
    log "no such skill: '$skill'"
    send_tg "Unknown command: /${skill//-/_}"
    return 1
  fi
  log "dispatching skill=$skill var='${var}'"
  if [ -n "$var" ]; then
    gh workflow run aeon.yml -f skill="$skill" -f var="$var" >/dev/null 2>&1
  else
    gh workflow run aeon.yml -f skill="$skill" >/dev/null 2>&1
  fi
}

# Schedule a skill from a "Schedule weekly" button tap: enable it and set a weekly
# cron in aeon.yml (the CALLER commits aeon.yml). $1 skill, $2 cadence (weekly|daily).
# Edits only the one inline `name: { ... }` line, preserving every other field and
# trailing comment; the write is atomic (temp + os.replace) so a symlinked aeon.yml
# in the test sandbox is swapped for a private copy rather than written through.
schedule_skill() {
  local skill="${1//_/-}" cadence="${2:-weekly}" cron
  if ! [[ "$skill" =~ ^[a-z0-9-]+$ ]] || [ ! -d "skills/$skill" ]; then
    log "schedule: unknown skill '$skill'"
    send_tg "Can't schedule an unknown skill."
    return 1
  fi
  case "$cadence" in
    daily)  cron="0 9 * * *" ;;
    weekly|*) cron="0 9 * * 1"; cadence="weekly" ;;
  esac
  AEON_SKILL="$skill" AEON_CRON="$cron" python3 - <<'PY'
import os, re, sys
skill = os.environ['AEON_SKILL']; cron = os.environ['AEON_CRON']; path = 'aeon.yml'
try:
    text = open(path).read()
except OSError:
    sys.exit(4)
lines = text.split('\n')
# Match only the inline flow-map form: `  <skill>: { ... } [# comment]`
inline = re.compile(r'^(\s{2})(' + re.escape(skill) + r'):\s*\{(.*?)\}(.*)$')
done = False
for i, ln in enumerate(lines):
    m = inline.match(ln)
    if not m:
        continue
    indent, name, body, rest = m.groups()
    if re.search(r'enabled:\s*\w+', body):
        body = re.sub(r'enabled:\s*\w+', 'enabled: true', body, count=1)
    else:
        body = ' enabled: true,' + body
    if re.search(r'schedule:\s*"[^"]*"', body):
        body = re.sub(r'schedule:\s*"[^"]*"', 'schedule: "%s"' % cron, body, count=1)
    else:
        body = body.rstrip()
        sep = ',' if body.strip() else ''
        body = '%s%s schedule: "%s"' % (body, sep, cron)
    lines[i] = '%s%s: {%s}%s' % (indent, name, body, rest)
    done = True
    break
if not done:
    sys.exit(3)  # skill not found in the editable inline form
tmp = path + '.tmp'
with open(tmp, 'w') as fh:
    fh.write('\n'.join(lines))
os.replace(tmp, path)
PY
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    log "schedule: could not edit aeon.yml for '$skill' (rc=$rc)"
    send_tg "Couldn't schedule /${skill//-/_} automatically — set its schedule from the dashboard."
    return 1
  fi
  log "scheduled $skill $cadence ($cron)"
  send_tg "📅 Scheduled /${skill//-/_} to run weekly (Mondays 09:00 UTC). Adjust or turn it off anytime from the dashboard."
}

# Best-effort list of enabled skills for /settings. yaml if available, grep fallback.
enabled_skills() {
  python3 - <<'PY' 2>/dev/null && return 0
import yaml
d = yaml.safe_load(open('aeon.yml')) or {}
for n, m in (d.get('skills') or {}).items():
    if isinstance(m, dict) and m.get('enabled'):
        print(n)
PY
  # Fallback: single-line inline `name: { enabled: true, ... }` entries only.
  grep -oE '^  [a-zA-Z0-9_-]+: *\{[^}]*enabled: *true' aeon.yml 2>/dev/null \
    | sed -E 's/^  ([a-zA-Z0-9_-]+):.*/\1/'
}

# --- command mode ----------------------------------------------------------
# Handles /cmd, /cmd@bot, /cmd args, and /start <deep-link-payload>.
route_command() {
  local text="$1"
  if ! [[ "$text" =~ ^/([a-zA-Z0-9_]+)(@[A-Za-z0-9_]+)?([[:space:]]+(.*))?$ ]]; then
    return 2   # not a command — caller should treat as plain text
  fi
  local cmd="${BASH_REMATCH[1]}" args="${BASH_REMATCH[4]:-}"
  cmd=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')

  case "$cmd" in
    start)
      # Deep link: /start <skill>[__<arg>]  (payload charset: A-Za-z0-9_-)
      if [ -n "$args" ]; then
        local payload="$args" dl_skill dl_arg
        dl_skill="${payload%%__*}"
        if [ "$dl_skill" != "$payload" ]; then dl_arg="${payload#*__}"; else dl_arg=""; fi
        if [ -d "skills/${dl_skill//_/-}" ]; then
          dispatch_skill "$dl_skill" "$dl_arg" && send_tg "Running /${dl_skill} from deep link…"
        else
          send_tg "Unknown deep link: ${payload}"
        fi
      else
        send_tg "Aeon is running. Type / to see available skills, or /help for how to use it."
      fi
      ;;
    help)
      if [ -f docs/help.md ]; then send_tg "$(cat docs/help.md)"; else
        send_tg "Type / to see available skills. Send /skillname to run one, or just message me in plain English."
      fi
      ;;
    settings)
      local list; list=$(enabled_skills)
      [ -z "$list" ] && list="(none enabled)"
      send_tg "$(printf 'Enabled skills:\n%s' "$list")"
      ;;
    *)
      dispatch_skill "$cmd" "$args" && send_tg "Running /${cmd}…"
      ;;
  esac
}

# --- callback mode ---------------------------------------------------------
# callback_data scheme: action:skill:arg1:arg2  (compact; <=64 bytes)
route_callback() {
  local data="$1"
  local action skill arg1 arg2
  IFS=':' read -r action skill arg1 arg2 <<< "$data"
  case " $CALLBACK_ACTIONS " in
    *" $action "*) ;;
    *) log "rejected callback action: '$action'"; return 1 ;;
  esac
  mkdir -p memory
  case "$action" in
    run)
      dispatch_skill "$skill" "$arg1"
      ;;
    schedule)
      # "Schedule weekly" quick-action. arg1 = cadence keyword (weekly|daily).
      schedule_skill "$skill" "${arg1:-weekly}"
      ;;
    snooze)
      if ! [[ "${arg2:-}" =~ ^[0-9]+$ ]]; then log "snooze needs numeric seconds"; return 1; fi
      local until_epoch key
      until_epoch=$(( $(date -u +%s) + arg2 ))
      key="${skill}:${arg1}"
      # One line per key: drop any prior snooze for it, then append the new until (epoch).
      touch memory/snoozes.log
      grep -v -E "^${key}:[0-9]+$" memory/snoozes.log > memory/snoozes.log.tmp 2>/dev/null || true
      mv memory/snoozes.log.tmp memory/snoozes.log
      printf '%s:%s\n' "$key" "$until_epoch" >> memory/snoozes.log
      log "snoozed ${key} until ${until_epoch}"
      ;;
    mute)
      local key="${skill}:${arg1}"
      touch memory/mutes.log
      grep -qxF "$key" memory/mutes.log || printf '%s\n' "$key" >> memory/mutes.log
      log "muted ${key}"
      ;;
    save)
      touch memory/saved.md
      printf -- '- %s\n' "${arg1:-$skill}" >> memory/saved.md
      log "saved ${arg1:-$skill}"
      ;;
    dismiss)
      : ;;
  esac
}

# --- reply mode ------------------------------------------------------------
# The force_reply prompt embeds a [skill::intent] marker in its visible text.
route_reply() {
  local reply_to="$1" user_input="${2:-}"
  if [[ "$reply_to" =~ \[([a-zA-Z0-9_-]+)::([a-zA-Z0-9_-]+)\] ]]; then
    local skill="${BASH_REMATCH[1]}" intent="${BASH_REMATCH[2]}"
    dispatch_skill "$skill" "${intent}:${user_input}"
    return $?
  fi
  return 2   # not one of our prompts — caller treats as plain text
}

# --- dispatch --------------------------------------------------------------
case "$MODE" in
  command)  route_command  "${2:-}" ;;
  callback) route_callback "${2:-}" ;;
  reply)    route_reply    "${2:-}" "${3:-}" ;;
  *) echo "usage: telegram-route.sh {command|callback|reply} ..." >&2; exit 64 ;;
esac

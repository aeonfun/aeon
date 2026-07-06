#!/usr/bin/env bash
# Tests for scripts/cron-due.sh — the exact-slot "debt" scheduler decision.
# Run:  bash scripts/tests/test_cron_due.sh
# On macOS/BSD:  AEON_DATE=gdate bash scripts/tests/test_cron_due.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/cron-due.sh"
DATE="${AEON_DATE:-date}"
[ -n "${AEON_DATE:-}" ] && export AEON_DATE

pass=0; fail=0
# check <desc> <schedule> <now-iso> <last-iso|never> <catchup_hours> <expect: due|skip>
check() {
  local desc="$1" sched="$2" now="$3" last="$4" catch="$5" expect="$6"
  local now_e last_e out rc
  now_e=$("$DATE" -u -d "$now" +%s)
  if [ "$last" = "never" ]; then last_e=0; else last_e=$("$DATE" -u -d "$last" +%s); fi
  if out=$(bash "$SCRIPT" "$sched" "$now_e" "$last_e" "$catch" 2>/dev/null); then rc=due; else rc=skip; fi
  if [ "$rc" = "$expect" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); printf 'FAIL: %-38s got=%-4s want=%-4s (slot=%s)\n' "$desc" "$rc" "$expect" "${out:-none}"
  fi
}

# Calendar context: 2026-07-06 = Mon (even DOM), 07 = Tue (odd), 10 = Fri.

# --- the core bug: a missed daily run should catch up, not drop ---
check "drop-recovery (2.6h late)"      "25 6 * * *"    2026-07-07T09:05:00Z 2026-07-06T06:25:00Z 6  due
check "not-yet-due (before minute)"    "25 6 * * *"    2026-07-07T06:10:00Z 2026-07-06T06:25:00Z 6  skip
check "already-ran-this-slot"          "25 6 * * *"    2026-07-07T06:50:00Z 2026-07-07T06:30:00Z 6  skip
check "just-past-slot-not-run"         "25 6 * * *"    2026-07-07T06:50:00Z 2026-07-06T06:30:00Z 6  due
check "exactly-at-slot-minute"         "0 8 * * *"     2026-07-07T08:00:00Z 2026-07-06T08:00:00Z 6  due
check "one-min-before-slot"            "0 8 * * *"     2026-07-07T07:59:00Z 2026-07-06T08:00:00Z 6  skip
check "never-dispatched"               "0 8 * * *"     2026-07-07T08:30:00Z never                6  due

# --- lateness cap (CATCHUP_HOURS bounds how stale a fire can be) ---
check "stale-beyond-6h-cap"            "25 6 * * *"    2026-07-07T14:00:00Z 2026-07-06T06:25:00Z 6  skip
check "wide-12h-cap-catches"           "25 6 * * *"    2026-07-07T14:00:00Z 2026-07-06T06:25:00Z 12 due

# --- twice-daily two-hour field (6,18) ---
check "twice-daily-evening-slot"       "25 6,18 * * *" 2026-07-07T18:52:00Z 2026-07-07T06:30:00Z 6  due
check "twice-daily-after-evening-run"  "25 6,18 * * *" 2026-07-07T20:00:00Z 2026-07-07T18:40:00Z 6  skip

# --- cross-midnight + alternating-day (the day-eval fix) ---
# Slot is yesterday 23:30 on an EVEN day; "now" is just after midnight on an ODD
# day. Old code judged 2/2 against today (odd) and dropped it. Must be DUE.
check "cross-midnight-altday-catchup"  "30 23 2/2 * *" 2026-07-07T00:20:00Z 2026-07-06T12:00:00Z 6  due
# Even-day skill must NOT fire on an odd day with no in-window even-day slot.
check "altday-no-slot-on-odd-day"      "0 6 2/2 * *"   2026-07-07T09:00:00Z 2026-07-05T06:00:00Z 6  skip

# --- interval minutes (*/30): fire once, catch up to latest, no double-fire ---
check "every30-due"                    "*/30 * * * *"  2026-07-07T09:47:00Z 2026-07-07T09:05:00Z 6  due
check "every30-after-run"              "*/30 * * * *"  2026-07-07T09:50:00Z 2026-07-07T09:47:00Z 6  skip
check "every30-missed-multi-fires-once" "*/30 * * * *" 2026-07-07T09:47:00Z 2026-07-07T08:00:00Z 6  due

# --- minute lists ---
check "minute-list-due"                "0,30 6 * * *"  2026-07-07T06:45:00Z 2026-07-06T06:30:00Z 6  due
check "minute-list-after-first-slot"   "0,30 6 * * *"  2026-07-07T06:15:00Z 2026-07-07T06:05:00Z 6  skip

# --- weekly (DOW) ---
check "weekly-friday-due"              "5 10 * * 5"    2026-07-10T11:00:00Z 2026-07-03T10:05:00Z 6  due
check "weekly-not-friday"              "5 10 * * 5"    2026-07-09T11:00:00Z 2026-07-03T10:05:00Z 6  skip

# --- non-time schedules are never due ---
check "workflow_dispatch-never"        "workflow_dispatch" 2026-07-07T08:00:00Z never             6  skip
check "reactive-never"                 "reactive"          2026-07-07T08:00:00Z never             6  skip

# --- correct cron day semantics: DOM & DOW both restricted => OR (13th OR Fri) ---
check "dom-or-dow friday (dow hit)"    "0 0 13 * 5"    2026-07-10T00:30:00Z never                1  due
check "dom-or-dow 13th (dom hit)"      "0 0 13 * 5"    2026-07-13T00:30:00Z never                1  due
check "dom-or-dow neither -> skip"     "0 0 13 * 5"    2026-07-14T00:30:00Z never                1  skip
# single-restricted day field still behaves as plain AND
check "dom-only on the 13th"           "0 0 13 * *"    2026-07-13T00:30:00Z never                1  due
check "dom-only off the 13th"          "0 0 13 * *"    2026-07-14T00:30:00Z never                1  skip
check "dom-31 in a 31-day month"       "0 0 31 * *"    2026-07-31T00:30:00Z never                1  due
check "dom-31 off day -> skip"         "0 0 31 * *"    2026-07-30T00:30:00Z never                1  skip

# --- hour ranges / steps / odd minute steps / every-minute ---
check "hour-range inside window"       "0 9-17 * * *"   2026-07-07T13:30:00Z 2026-07-07T12:00:00Z 6 due
check "hour-range before window"       "0 9-17 * * *"   2026-07-07T08:30:00Z 2026-07-06T17:00:00Z 6 skip
check "hour step-range 9-17/2"         "0 9-17/2 * * *" 2026-07-07T12:30:00Z 2026-07-07T09:30:00Z 6 due
check "minute step */7 latest slot"    "*/7 9 * * *"    2026-07-07T09:59:00Z 2026-07-07T09:00:00Z 6 due
check "minute step */7 after run"      "*/7 9 * * *"    2026-07-07T09:03:00Z 2026-07-07T09:01:00Z 6 skip
check "every-minute due"               "* 9 * * *"      2026-07-07T09:30:00Z 2026-07-07T09:29:00Z 6 due
check "every-minute after run"         "* 9 * * *"      2026-07-07T09:30:00Z 2026-07-07T09:30:00Z 6 skip

# --- hour-granular catch-up cap boundary ---
check "cap boundary reachable"         "0 6 * * *"     2026-07-07T12:59:00Z 2026-07-06T06:00:00Z 6  due
check "cap boundary just out"          "0 6 * * *"     2026-07-07T13:00:00Z 2026-07-06T06:00:00Z 6  skip

echo "---"
echo "PASS: $pass   FAIL: $fail"
[ "$fail" -eq 0 ]

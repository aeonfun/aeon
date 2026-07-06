#!/usr/bin/env bash
# cron-due.sh — decide whether a cron-scheduled skill is due to run *now*.
#
# Replaces the scheduler's old "fire on the first tick past the minute + a fixed
# 2-hour catch-up + a flat dedup window" heuristic with one exact rule:
#
#     A skill is DUE  iff  its most recent scheduled fire time at-or-before now
#     (within the last CATCHUP_HOURS) is NEWER than its last dispatch.
#
# This is the "debt ledger" model. A missed run stays owed until some tick —
# however late — pays it, bounded by CATCHUP_HOURS so genuinely stale slots
# (older than the cap) are skipped rather than fired hours late. Because the
# decision is anchored to the *exact* scheduled slot (not wall-clock proximity),
# it cannot double-fire and needs no separate dedup window.
#
# Why this exists: GitHub only delivers ~10% of the */5 scheduler ticks, so gaps
# routinely exceed the old 2h catch-up window and a due slot would silently age
# out and never run. See docs and the "Determine and dispatch" step in
# .github/workflows/scheduler.yml.
#
# Usage:
#   cron-due.sh "<min hour dom month dow>" <now_epoch> <last_dispatch_epoch> [catchup_hours]
#
# Exit 0 (DUE)  → prints the matched slot time (ISO 8601) to stdout.
# Exit 1 (skip) → no output.
#
# Env: AEON_DATE overrides the `date` binary (set AEON_DATE=gdate to test on
#      macOS/BSD; the workflow runner is GNU coreutils and needs no override).
set -euo pipefail

SCHED="${1:?schedule required (5 cron fields)}"
NOW_EPOCH="${2:?now epoch required}"
LAST_EPOCH="${3:-0}"
CATCHUP_HOURS="${4:-6}"
DATE="${AEON_DATE:-date}"

IFS=' ' read -r C_MIN C_HOUR C_DOM C_MONTH C_DOW <<< "$SCHED"
# Malformed / non-time schedule (e.g. "workflow_dispatch", "reactive", empty) → never due.
[ -n "${C_DOW:-}" ] || exit 1
case "$SCHED" in *workflow_dispatch*|*reactive*) exit 1 ;; esac

# Cron field matcher — supports: *, N, N-M (ranges), N,M (lists), */N, N/step,
# N-M/step (steps). This script is the single source of the match logic; the
# scheduler.yml "Determine and dispatch" step calls it (no inline copy).
cron_match() {
  local field="$1" value="$2"
  [ "$field" = "*" ] && return 0
  if [[ "$field" == */* ]]; then
    local base="${field%/*}" interval="${field#*/}"
    if [ "$base" = "*" ]; then
      [ $((value % interval)) -eq 0 ] && return 0
    elif [[ "$base" == *-* ]]; then
      local lo="${base%-*}" hi="${base#*-}"
      [ "$value" -ge "$lo" ] && [ "$value" -le "$hi" ] && [ $(( (value - lo) % interval )) -eq 0 ] && return 0
    else
      [ "$value" -ge "$base" ] && [ $(( (value - base) % interval )) -eq 0 ] && return 0
    fi
    return 1
  fi
  local v lo hi
  IFS=',' read -ra VALS <<< "$field"
  for v in "${VALS[@]}"; do
    if [[ "$v" == *-* ]]; then
      lo="${v%-*}"; hi="${v#*-}"
      [ "$value" -ge "$lo" ] && [ "$value" -le "$hi" ] && return 0
    else
      [ "$v" = "$value" ] && return 0
    fi
  done
  return 1
}

# Top of the current UTC hour (UTC has no DST, so hour boundaries are exact).
NOW_MIN_EPOCH=$(( NOW_EPOCH - (NOW_EPOCH % 60) ))
HOUR_TOP=$(( NOW_EPOCH - (NOW_EPOCH % 3600) ))

# Walk back hour-by-hour up to CATCHUP_HOURS. For each hour bucket, evaluate the
# hour/day-of-month/month/day-of-week fields against THAT bucket's own date
# (fixes the old bug where a pre-midnight slot was judged by today's date, which
# broke alternating-day / weekly catch-up across midnight). Then enumerate the
# minutes in the hour that match, and keep the most recent slot at-or-before now.
DUE_SLOT=-1
for (( h=0; h<=CATCHUP_HOURS; h++ )); do
  BUCKET_TOP=$(( HOUR_TOP - h * 3600 ))
  read -r B_HOUR B_DOM B_MON B_DOW <<< "$("$DATE" -u -d "@$BUCKET_TOP" +'%-H %-d %-m %w')"
  cron_match "$C_HOUR"  "$B_HOUR" || continue
  cron_match "$C_MONTH" "$B_MON"  || continue
  # Standard cron day rule: when BOTH day-of-month and day-of-week are restricted
  # (neither is "*"), the day matches if EITHER matches; otherwise it's a plain
  # AND (the "*" field matches anything). NB: this is the POSIX/Vixie-cron rule —
  # the old scheduler ANDed the two unconditionally.
  if [ "$C_DOM" != "*" ] && [ "$C_DOW" != "*" ]; then
    cron_match "$C_DOM" "$B_DOM" || cron_match "$C_DOW" "$B_DOW" || continue
  else
    cron_match "$C_DOM" "$B_DOM" || continue
    cron_match "$C_DOW" "$B_DOW" || continue
  fi
  for (( m=0; m<60; m++ )); do
    cron_match "$C_MIN" "$m" || continue
    SLOT=$(( BUCKET_TOP + m * 60 ))
    [ "$SLOT" -gt "$NOW_MIN_EPOCH" ] && continue    # slot hasn't happened yet
    [ "$SLOT" -gt "$DUE_SLOT" ] && DUE_SLOT=$SLOT    # keep the most recent
  done
  # The newest bucket with any past match holds the most-recent slot; stop.
  [ "$DUE_SLOT" -ge 0 ] && break
done

# Due iff we haven't dispatched since that slot's scheduled time.
if [ "$DUE_SLOT" -ge 0 ] && [ "$LAST_EPOCH" -lt "$DUE_SLOT" ]; then
  "$DATE" -u -d "@$DUE_SLOT" +%FT%TZ
  exit 0
fi
exit 1

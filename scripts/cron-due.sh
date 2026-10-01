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
# Env: AEON_DATE overrides the `date` binary. When unset, GNU and BSD/macOS
#      date are detected automatically.
set -euo pipefail

SCHED="${1:?schedule required (5 cron fields)}"
NOW_EPOCH="${2:?now epoch required}"
LAST_EPOCH="${3:-0}"
CATCHUP_HOURS="${4:-6}"
DATE="${AEON_DATE:-date}"

if "$DATE" --version >/dev/null 2>&1; then
  DATE_FLAVOR=gnu
else
  DATE_FLAVOR=bsd
fi

format_epoch() {
  local epoch="$1" format="$2"
  if [ "$DATE_FLAVOR" = gnu ]; then
    "$DATE" -u -d "@$epoch" "$format"
  else
    "$DATE" -u -r "$epoch" "$format"
  fi
}

# Malformed / non-time schedule (e.g. "workflow_dispatch", "reactive", empty) → never due.
case "$SCHED" in *workflow_dispatch*|*reactive*) exit 1 ;; esac
IFS=' ' read -r C_MIN C_HOUR C_DOM C_MONTH C_DOW C_EXTRA <<< "$SCHED"

invalid() {
  echo "cron-due: invalid schedule '$SCHED': $1 (treated as never due)" >&2
  exit 1
}
[ -n "${C_DOW:-}" ] || invalid "expected 5 fields"
[ -z "${C_EXTRA:-}" ] || invalid "expected 5 fields"

# Month and day-of-week names (JAN-DEC, SUN-SAT, any case) -> numbers, so a
# named schedule fires instead of silently never matching.
upper() { printf '%s' "$1" | tr '[:lower:]' '[:upper:]'; }
C_MONTH=$(upper "$C_MONTH"); C_DOW=$(upper "$C_DOW")
i=1
for n in JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC; do
  C_MONTH="${C_MONTH//$n/$i}"; i=$((i + 1))
done
i=0
for n in SUN MON TUE WED THU FRI SAT; do
  C_DOW="${C_DOW//$n/$i}"; i=$((i + 1))
done

# Validate one field: a comma list of `*`, `N` or `N-M`, each optionally
# `/STEP` (STEP >= 1), every number within [lo, hi]. Rejecting here (instead of
# letting arithmetic blow up) is what keeps `*/0` or `61` from crashing the tick.
validate_field() {
  local name="$1" field="$2" lo="$3" hi="$4" el base step a b ELS
  IFS=',' read -ra ELS <<< "$field"
  [ "${#ELS[@]}" -gt 0 ] || invalid "empty $name field"
  for el in "${ELS[@]}"; do
    [[ "$el" =~ ^(\*|[0-9]+(-[0-9]+)?)(/[0-9]+)?$ ]] || invalid "bad $name element '$el'"
    base="${el%%/*}"
    if [[ "$el" == */* ]]; then
      step=$((10#${el#*/}))
      [ "$step" -ge 1 ] || invalid "$name step must be >= 1 in '$el'"
    fi
    [ "$base" = "*" ] && continue
    a=$((10#${base%-*})); b=$((10#${base#*-}))
    { [ "$a" -ge "$lo" ] && [ "$b" -le "$hi" ] && [ "$a" -le "$b" ]; } \
      || invalid "$name value out of range $lo-$hi in '$el'"
  done
}
validate_field minute       "$C_MIN"   0 59
validate_field hour         "$C_HOUR"  0 23
validate_field day-of-month "$C_DOM"   1 31
validate_field month        "$C_MONTH" 1 12
validate_field day-of-week  "$C_DOW"   0 7

# Cron field matcher: cron_match <field> <value> <lo> <hi>. Supports *, N, N-M,
# lists, and /STEP on any element (`*/N`, `N/S`, `N-M/S`). A step counts from
# the element's own start, so `*/2` on day-of-month (lo=1) is 1,3,5,... like
# cron, not the even days. Numbers are read base-10 so `08` is 8, not octal.
# This script is the single source of the match logic; the scheduler.yml
# "Determine and dispatch" step calls it (no inline copy).
cron_match() {
  local field="$1" value="$2" lo="$3" hi="$4" el base step start end ELS
  IFS=',' read -ra ELS <<< "$field"
  for el in "${ELS[@]}"; do
    base="${el%%/*}"; step=""
    [[ "$el" == */* ]] && step=$((10#${el#*/}))
    if [ "$base" = "*" ]; then
      start=$lo; end=$hi
    elif [[ "$base" == *-* ]]; then
      start=$((10#${base%-*})); end=$((10#${base#*-}))
    else
      start=$((10#$base))
      # `N/S` means N through the field max, every S (Vixie).
      if [ -n "$step" ]; then end=$hi; else end=$start; fi
    fi
    [ "$value" -ge "$start" ] && [ "$value" -le "$end" ] || continue
    [ -z "$step" ] && return 0
    [ $(( (value - start) % step )) -eq 0 ] && return 0
  done
  return 1
}

# Day-of-week: 0 and 7 are both Sunday.
dow_match() {
  cron_match "$C_DOW" "$1" 0 7 && return 0
  [ "$1" -eq 0 ] && cron_match "$C_DOW" 7 0 7
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
  read -r B_HOUR B_DOM B_MON B_DOW <<< "$(format_epoch "$BUCKET_TOP" +'%-H %-d %-m %w')"
  cron_match "$C_HOUR"  "$B_HOUR" 0 23 || continue
  cron_match "$C_MONTH" "$B_MON"  1 12 || continue
  # Standard cron day rule: when BOTH day-of-month and day-of-week are restricted,
  # the day matches if EITHER matches; otherwise it's a plain AND. NB: this is the
  # POSIX/Vixie-cron rule (the old scheduler ANDed the two unconditionally), and
  # like Vixie a field that STARTS with "*" (e.g. "*/2") counts as unrestricted
  # for this choice while still filtering by its own step.
  if [[ "$C_DOM" != \** ]] && [[ "$C_DOW" != \** ]]; then
    cron_match "$C_DOM" "$B_DOM" 1 31 || dow_match "$B_DOW" || continue
  else
    cron_match "$C_DOM" "$B_DOM" 1 31 || continue
    dow_match "$B_DOW" || continue
  fi
  for (( m=0; m<60; m++ )); do
    cron_match "$C_MIN" "$m" 0 59 || continue
    SLOT=$(( BUCKET_TOP + m * 60 ))
    [ "$SLOT" -gt "$NOW_MIN_EPOCH" ] && continue    # slot hasn't happened yet
    [ "$SLOT" -gt "$DUE_SLOT" ] && DUE_SLOT=$SLOT    # keep the most recent
  done
  # The newest bucket with any past match holds the most-recent slot; stop.
  [ "$DUE_SLOT" -ge 0 ] && break
done

# Due iff we haven't dispatched since that slot's scheduled time.
if [ "$DUE_SLOT" -ge 0 ] && [ "$LAST_EPOCH" -lt "$DUE_SLOT" ]; then
  format_epoch "$DUE_SLOT" +%FT%TZ
  exit 0
fi
exit 1

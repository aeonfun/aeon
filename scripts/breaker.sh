#!/usr/bin/env bash
# breaker.sh — auto-recovering circuit breaker for the scheduler.
#
# A skill that has failed THRESHOLD times in a row (consecutive_failures, folded
# by scripts/state_reduce.py) is almost certainly hitting an outage — a dead
# upstream API, a revoked key — not a one-off. Left alone, the scheduler's flat
# 30-min failed-skill retry re-runs it every few ticks for hours, burning a run
# each time to fail the same way. This breaker stops that.
#
# It is auto-recovering, NOT a kill switch:
#   CLOSED    consecutive_failures < THRESHOLD → normal dispatch path.
#   OPEN      >= THRESHOLD and last dispatch < COOLDOWN_MIN ago → skip this tick.
#   HALF-OPEN >= THRESHOLD, last dispatch >= COOLDOWN_MIN ago AND the skill has a
#             scheduled slot owed (cron-due.sh) → allow ONE probe.
# A probe that succeeds resets consecutive_failures to 0 (state_reduce.py), so the
# breaker is CLOSED again next tick and the skill resumes its normal schedule. A
# probe that fails re-arms the cooldown. Net cost while an outage persists: one
# run per max(COOLDOWN_MIN, the skill's own cron period) instead of one per retry
# window. The slot_owed gate is what keeps a slow skill on its cadence: without
# it a weekly or monthly skill in a persistent outage was probed every
# COOLDOWN_MIN (~4x/day) forever. With it the probe waits for the skill's next
# real slot, so it never runs more often than its schedule. A skill with no cron
# slot at all (workflow_dispatch / reactive) is never owed, so never probed.
#
# This is the single source of the breaker decision; scheduler.yml calls it (no
# inline copy), the same contract cron-due.sh follows.
#
# Usage:
#   breaker.sh <consecutive_failures> <minutes_since_last_dispatch> [threshold] [cooldown_min] [slot_owed]
#
# slot_owed: 1 if the skill's most recent cron slot is newer than its last
# dispatch (scripts/cron-due.sh exit 0), else 0. Defaults to 1 (cooldown only).
#
# Prints exactly one decision token to stdout: closed | probe | open
#   closed → caller falls through to its normal retry/cron matching
#   probe  → caller dispatches a single half-open trial run
#   open   → caller skips the skill this tick
# THRESHOLD=0 disables the breaker (always prints "closed").
set -euo pipefail

CONSEC="${1:?consecutive_failures required}"
MINUTES_SINCE="${2:?minutes_since_last_dispatch required}"
THRESHOLD="${3:-3}"
COOLDOWN_MIN="${4:-360}"
SLOT_OWED="${5:-1}"

# Disabled, or not yet tripped → normal path.
if [ "$THRESHOLD" -le 0 ] || [ "$CONSEC" -lt "$THRESHOLD" ]; then
  echo closed
  exit 0
fi

# Tripped: one probe per cooldown, and only for a slot the schedule owes;
# otherwise stay open.
if [ "$MINUTES_SINCE" -ge "$COOLDOWN_MIN" ] && [ "$SLOT_OWED" = "1" ]; then
  echo probe
else
  echo open
fi

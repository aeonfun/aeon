#!/usr/bin/env bash
# Regression test for aeon.yml's "Read-only capability guard" step: a
# successful read-only skill's run-log entry must carry its real captured
# output under a "### <skill>" heading (the shape every read-only SKILL.md's
# own instructions look for on the next run's dedup/diff), not a
# content-free stub — while a failed or output-less run must still fall back
# to the stub so nothing stale gets logged as this run's result.
set -uo pipefail

WORKFLOW="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.github/workflows/aeon.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Extract the guard verbatim from the "Read-only capability guard" step: from
# its first `SKILL=` assignment (there are several elsewhere in the workflow
# for other steps — anchor on the step name first, then take the first match
# after that) up to (excluding) the CODE_PATHS revert logic — same anchored
# extraction pattern as test_chain_runner_invalid_dispatch.sh, deliberately
# NOT keyed to comment wording (which is expected to keep changing).
awk '
  /^      - name: Read-only capability guard$/ { step=1 }
  step && !on && /^          SKILL=/ { on=1 }
  on && /^          CODE_PATHS=/ { exit }
  on { print }
' "$WORKFLOW" | sed 's/^          //' > "$TMP/guard.sh"
grep -q 'CAPTURED="output/.chains' "$TMP/guard.sh" && grep -q 'RUN_OUTCOME' "$TMP/guard.sh" \
  || { echo "FAIL: extraction anchor drifted — expected content missing from extracted guard" >&2; cat "$TMP/guard.sh" >&2; exit 1; }

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

run_guard() {
  # $1 = steps.skill.outputs.name, $2 = steps.run.outcome, $3 = captured
  # output/.chains/<skill>.md, $4 = the harness final output (/tmp/skill-result.txt),
  # $5 = today's log as committed at checkout (makes the workdir a git repo),
  # $6 = text the skill itself appended to today's log during the run.
  local skill="$1" outcome="$2"
  local workdir="$TMP/run-$RANDOM"
  local log
  log="memory/logs/$(date -u +%Y-%m-%d).md"
  mkdir -p "$workdir/memory/logs" "$workdir/output/.chains"
  if [ -n "${3:-}" ]; then printf '%s' "$3" > "$workdir/output/.chains/${skill}.md"; fi
  if [ -n "${4:-}" ]; then printf '%s' "$4" > "$workdir/skill-result.txt"; fi
  if [ -n "${5:-}" ]; then
    printf '%s' "$5" > "$workdir/$log"
    git -C "$workdir" init -q && git -C "$workdir" add "$log" \
      && git -C "$workdir" -c user.name=t -c user.email=t@t commit -qm seed
  fi
  if [ -n "${6:-}" ]; then printf '%s' "$6" >> "$workdir/$log"; fi
  (
    cd "$workdir" || exit 1
    sed "s|\${{ steps.skill.outputs.name }}|$skill|; s|\${{ steps.run.outcome }}|$outcome|; s|/tmp/skill-result.txt|$workdir/skill-result.txt|" "$TMP/guard.sh" > guard.sh
    bash guard.sh
  )
  cat "$workdir/$log" 2>/dev/null
}

# Successful run with real captured output → the log entry carries the real
# content under a "### <skill>" heading (3-hash — what narrative-tracker,
# github-trending, token-pick, etc.'s own SKILL.md all instruct diffing
# against), not the old content-free "## <skill> (read-only)" stub.
out=$(run_guard narrative-tracker success '*Narrative Tracker — 2026-09-08*
TRANSITIONS
• NEW: ZCAT/privacy')
echo "$out" | grep -q '^### narrative-tracker$' && pass "success: writes a 3-hash '### <skill>' heading" \
  || bad "success: missing '### narrative-tracker' heading"
echo "$out" | grep -q 'NEW: ZCAT/privacy' && pass "success: real captured output lands in the log" \
  || bad "success: captured output missing from the log entry"

# Failed run → falls back to the stub, but STILL under the same "### <skill>"
# heading level (CLAUDE.md's Log contract + aeon-doctor's own health check both
# expect every skill's entry at this level, regardless of outcome) — no
# stale/wrong content masquerading as this run's real output either.
out=$(run_guard narrative-tracker failure '')
echo "$out" | grep -q '^### narrative-tracker$' && pass "failure: still uses the '### <skill>' heading" \
  || bad "failure: heading level must match the success case (CLAUDE.md Log contract)"
echo "$out" | grep -q 'outcome=failure' && pass "failure: stub records the real outcome" \
  || bad "failure: stub should record outcome=failure"

# Successful run but nothing was captured (empty/missing output/.chains file)
# → also falls back to the stub rather than logging an empty heading.
out=$(run_guard narrative-tracker success '')
echo "$out" | grep -q '^### narrative-tracker$' && echo "$out" | grep -q 'no output captured' \
  && pass "success-but-empty: falls back to the stub" \
  || bad "success-but-empty: should fall back to the stub, not log an empty '### ' heading"

# Successful run, but "Capture skill output" only wrote its own placeholder
# ("_No output captured._" — the literal string it emits when there was
# neither a pending notification nor a non-empty /tmp/skill-result.txt) →
# must NOT be treated as real content (it's non-empty, so a bare -s check
# would wrongly accept it and pollute the skill's own dedup baseline).
out=$(run_guard narrative-tracker success '_No output captured._')
echo "$out" | grep -q '_No output captured\._' && bad "placeholder: must not be logged as if it were real content" \
  || pass "placeholder: '_No output captured._' is treated as empty, not real output"

# Notify payload captured, but the skill put its log record in the final
# output -> both land under ONE heading; the record's own "### <skill>" line
# is dropped so the entry never carries a nested duplicate heading.
out=$(run_guard executor-mcp success '*Executor* - task done' '### executor-mcp
- Result: EXEC_OK')
echo "$out" | grep -q 'task done' && echo "$out" | grep -q 'Result: EXEC_OK' \
  && pass "final output: log record appended after the notify payload" \
  || bad "final output: notify payload and final-output record should both be logged"
[ "$(echo "$out" | grep -c '^### executor-mcp$')" -eq 1 ] && pass "final output: exactly one '### <skill>' heading" \
  || bad "final output: expected exactly one '### executor-mcp' heading"

# No notify: CAPTURED is a copy of the final output -> logged once, not twice.
out=$(run_guard tx-explain success 'TX_EXPLAIN_OK' 'TX_EXPLAIN_OK')
[ "$(echo "$out" | grep -c 'TX_EXPLAIN_OK')" -eq 1 ] && pass "no notify: final output logged once" \
  || bad "no notify: identical captured/final output must not be logged twice"

# Stray self-log: the skill appended its own "### <skill>" entry during the run
# (today's log had one from an EARLIER run at checkout) -> guard must not add a
# second entry for this run.
prior='
### narrative-tracker
earlier run
'
out=$(run_guard narrative-tracker success 'captured body' '' "$prior" '
### narrative-tracker
self-logged body
')
[ "$(echo "$out" | grep -c '^### narrative-tracker$')" -eq 2 ] && ! echo "$out" | grep -q 'captured body' \
  && pass "self-log: guard skips appending a duplicate entry" \
  || bad "self-log: guard must not double up a self-written '### <skill>' entry"

# Earlier same-day entry only (no self-log this run) -> guard still appends.
out=$(run_guard narrative-tracker success 'captured body' '' "$prior")
[ "$(echo "$out" | grep -c '^### narrative-tracker$')" -eq 2 ] && echo "$out" | grep -q 'captured body' \
  && pass "earlier entry: an entry from a prior run does not suppress this run's log" \
  || bad "earlier entry: guard must still append when the only '### <skill>' was committed before the run"

echo "---"
[ "$fail" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

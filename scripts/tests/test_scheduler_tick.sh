#!/usr/bin/env bash
# End-to-end test of one scheduler tick: runs the real "Determine and dispatch
# scheduled skills" step from .github/workflows/scheduler.yml against a fixture
# repo (local bare origin), a fake `gh` that records dispatches, and a pinned
# clock. Covers the scheduler bugs that slipped with no harness:
#   - commented chain lines never leak into a chain (dev-loop stays manual)
#   - keys under chains:/channels:/reactive: are never dispatched as skills
#   - a chain-covered skill is stamped, so it does not run standalone next tick
#   - a reactive handler with enabled: false in skills: is not dispatched
#   - an `on: "*"` handler rotates past a source it handled recently
#   - the persist retry rebuilds on upstream's cron-state after losing a race
#     and keeps every stamp, including chain:<name>
#   - failed-run retries and breaker probes respect the skill's own cadence: a
#     weekly skill gets its quick retries, but is never re-run ~4x/day by the
#     probe or every 30 min with the breaker off; workflow_dispatch skills are
#     never retried or probed
# Run:  bash scripts/tests/test_scheduler_tick.sh
# Needs bash 4+ (the step uses associative arrays), GNU date, yq, jq, git; skips
# otherwise (e.g. macOS system bash). CI runs it on ubuntu-latest.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ "${BASH_VERSINFO[0]}" -lt 4 ] || ! date --version >/dev/null 2>&1 || ! command -v yq >/dev/null 2>&1; then
  echo "SKIP - needs bash 4+, GNU date and yq (runs in CI on ubuntu-latest)"
  exit 0
fi

pass=0; fail=0
ok()  { pass=$((pass+1)); echo "ok   - $1"; }
bad() { fail=$((fail+1)); echo "FAIL - $1"; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
REAL_DATE="$(command -v date)"

# The step body, exactly as the workflow runs it.
yq '.jobs.schedule.steps[] | select(.name == "Determine and dispatch scheduled skills") | .run' \
  "$REPO/.github/workflows/scheduler.yml" > "$TMP/tick.sh"
[ -s "$TMP/tick.sh" ] || { echo "FAIL - could not extract the scheduler step"; exit 1; }

# Fake gh (records `workflow run` calls), no-op sleep, and a date pinned to
# $FAKE_NOW whenever the caller asks for "now" (no -d).
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "$GH_LOG"
exit 0
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$TMP/bin/sleep"
cat > "$TMP/bin/date" <<EOF
#!/usr/bin/env bash
for a in "\$@"; do case "\$a" in -d|--date|-d*|--date=*) exec "$REAL_DATE" "\$@" ;; esac; done
exec "$REAL_DATE" -d "@\$FAKE_NOW" "\$@"
EOF
chmod +x "$TMP/bin/"*

# --- fixture repo -----------------------------------------------------------
git init -q --bare "$TMP/origin.git"
git -C "$TMP/origin.git" symbolic-ref HEAD refs/heads/main
git clone -q "$TMP/origin.git" "$TMP/seed" 2>/dev/null
cd "$TMP/seed" || exit 1
git config user.name t; git config user.email t@example.com
git checkout -q -b main
mkdir -p scripts memory
for f in cron-due.sh breaker.sh reactive_when.sh parse-aeon-config.sh; do cp "$REPO/scripts/$f" scripts/; done
cat > aeon.yml <<'EOF'
skills:
  digest: { enabled: true, schedule: "0 6 * * *" }
  solo: { enabled: true, schedule: "0 6 * * *" }
  feature: { enabled: false, schedule: "workflow_dispatch" }
  skill-repair: { enabled: false, schedule: "reactive" }
  fixer: { enabled: true, schedule: "reactive" }
  broken-a: { enabled: true, schedule: "0 3 * * *" }
  broken-b: { enabled: true, schedule: "0 3 * * *" }
  weekly-down: { enabled: true, schedule: "0 9 * * 1" }
  weekly-flaky: { enabled: true, schedule: "0 5 * * 2" }
  manual: { enabled: true, schedule: "workflow_dispatch" }

reactive:
  skill-repair:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }
  fixer:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }

chains:
  morning:
    schedule: "0 6 * * *"
    steps:
      - { skill: digest }
  dev-loop:
    schedule: "workflow_dispatch"
    steps:
      - { skill: feature }

  # routine:
  #   schedule: "0 6 * * *"
  #   steps:
  #     - parallel: [solo]

channels:
  jsonrender:
    enabled: true
EOF
# 2026-07-07 06:05 UTC (a Tuesday). broken-a/b are failing with an open breaker
# (dispatched an hour ago); fixer handled broken-a 2h ago, so it must rotate to
# broken-b. weekly-down (Mondays 09:00) is in an outage, last run 7h ago: the
# probe cooldown is up but its next slot is days away. weekly-flaky failed its
# 05:00 slot once, so it is owed a quick retry. manual is workflow_dispatch only.
cat > memory/cron-state.json <<'EOF'
{
  "digest": { "last_status": "success", "last_dispatch": "2026-07-06T06:00:00Z" },
  "solo": { "last_status": "success", "last_dispatch": "2026-07-06T06:00:00Z" },
  "broken-a": { "last_status": "failed", "last_dispatch": "2026-07-07T05:05:00Z", "consecutive_failures": 5 },
  "broken-b": { "last_status": "failed", "last_dispatch": "2026-07-07T05:05:00Z", "consecutive_failures": 4 },
  "weekly-down": { "last_status": "failed", "last_dispatch": "2026-07-06T23:00:00Z", "consecutive_failures": 5 },
  "weekly-flaky": { "last_status": "failed", "last_dispatch": "2026-07-07T05:00:00Z", "consecutive_failures": 1 },
  "manual": { "last_status": "failed", "last_dispatch": "2026-07-01T00:00:00Z", "consecutive_failures": 1 },
  "fixer": { "last_status": "success", "last_dispatch": "2026-07-07T04:05:00Z",
             "reactive_sources": { "broken-a": "2026-07-07T04:05:00Z" } }
}
EOF
git add -A && git commit -qm seed && git push -q origin main 2>/dev/null

git clone -q "$TMP/origin.git" "$TMP/work" 2>/dev/null
git -C "$TMP/work" config user.name t; git -C "$TMP/work" config user.email t@example.com

# Race: another writer (a finished skill run) lands a cron-state change on
# origin after our checkout, touching the same lines the tick will stamp.
cd "$TMP/seed" || exit 1
jq '.digest.last_status = "failed" | .other = {"last_status": "success"}' memory/cron-state.json > m.tmp \
  && mv m.tmp memory/cron-state.json
git commit -qam "chore(cron): digest failed" && git push -q origin main 2>/dev/null

run_tick() {  # run_tick <now-iso> [breaker-threshold]
  : > "$TMP/gh.log"
  ( cd "$TMP/work" && PATH="$TMP/bin:$PATH" GH_LOG="$TMP/gh.log" \
      FAKE_NOW="$("$REAL_DATE" -u -d "$1" +%s)" GITHUB_REPOSITORY=fake/fake GH_TOKEN=x STATE_BACKEND="" \
      BREAKER_THRESHOLD_OVERRIDE="${2:-}" \
      bash --noprofile --norc -eo pipefail "$TMP/tick.sh" ) > "$TMP/tick.out" 2>&1
}
dispatched() { grep -qxF -- "$1" "$TMP/gh.log"; }

# --- tick 1 -------------------------------------------------------------------
if run_tick 2026-07-07T06:05:00Z; then ok "tick 1 exits 0"; else bad "tick 1 failed: $(tail -5 "$TMP/tick.out")"; fi

dispatched "workflow run chain-runner.yml -f chain=morning" && ok "scheduled chain dispatched" || bad "chain morning not dispatched"
grep -q 'chain=dev-loop' "$TMP/gh.log" && bad "commented schedule leaked into dev-loop" || ok "dev-loop (workflow_dispatch) not dispatched"
grep -q 'skill=digest' "$TMP/gh.log" && bad "chain-covered digest also dispatched standalone" || ok "chain-covered skill not dispatched standalone"
dispatched "workflow run aeon.yml -f skill=solo" && ok "solo dispatched (commented chain does not cover it)" || bad "solo not dispatched"
grep -qE 'skill=(dev-loop|morning|jsonrender|feature)( |$)' "$TMP/gh.log" && bad "non-skill key dispatched as a skill" || ok "chain/channel keys never dispatched as skills"
grep -q 'skill=skill-repair' "$TMP/gh.log" && bad "disabled reactive handler dispatched" || ok "reactive handler with enabled: false not dispatched"
dispatched "workflow run aeon.yml -f skill=fixer -f var=broken-b" && ok "wildcard handler rotated to broken-b" \
  || bad "fixer not dispatched for broken-b: $(grep fixer "$TMP/gh.log")"
grep -q 'skill=weekly-down' "$TMP/gh.log" && bad "weekly skill probed off-cadence (cooldown up, no slot owed)" \
  || ok "breaker probe waits for the weekly skill's next slot"
dispatched "workflow run aeon.yml -f skill=weekly-flaky" && ok "weekly skill still gets a quick retry for its failed slot" \
  || bad "weekly-flaky not quick-retried"
grep -q 'skill=manual' "$TMP/gh.log" && bad "workflow_dispatch-only skill auto-retried" || ok "workflow_dispatch skill never retried"

STATE="$(git -C "$TMP/origin.git" show main:memory/cron-state.json)"
NOW=2026-07-07T06:05:00Z
[ "$(jq -r '.other.last_status' <<< "$STATE")" = "success" ] && ok "retry kept upstream's concurrent change" || bad "upstream change lost: $STATE"
[ "$(jq -r '.digest.last_dispatch' <<< "$STATE")" = "$NOW" ] && ok "covered skill stamped (and survived the race)" || bad "digest not stamped: $(jq -c .digest <<< "$STATE")"
[ "$(jq -r '."chain:morning".last_dispatch' <<< "$STATE")" = "$NOW" ] && ok "chain:morning stamp survived the race" || bad "chain stamp lost"
[ "$(jq -r '.solo.last_dispatch' <<< "$STATE")" = "$NOW" ] && ok "skill stamp survived the race" || bad "solo stamp lost"
[ "$(jq -r '.fixer.reactive_sources."broken-b"' <<< "$STATE")" = "$NOW" ] \
  && [ "$(jq -r '.fixer.reactive_sources."broken-a"' <<< "$STATE")" = "2026-07-07T04:05:00Z" ] \
  && ok "reactive source recorded for rotation" || bad "reactive_sources wrong: $(jq -c .fixer <<< "$STATE")"

# --- tick 2: five minutes later, nothing is owed --------------------------------
git -C "$TMP/work" pull -q origin main 2>/dev/null
if run_tick 2026-07-07T06:10:00Z; then ok "tick 2 exits 0"; else bad "tick 2 failed: $(tail -5 "$TMP/tick.out")"; fi
grep -qE 'skill=(digest|solo)|chain=morning' "$TMP/gh.log" && bad "tick 2 re-dispatched: $(cat "$TMP/gh.log")" || ok "tick 2 dispatches nothing already paid"

# --- tick 3: breaker off, a long failure streak is not retried every 30 min ------
# broken-a/b and weekly-down are 3+ failures deep and past the 30-min mark, but
# their quick retries are spent and no slot is owed, so nothing runs.
if run_tick 2026-07-07T06:40:00Z 0; then ok "tick 3 (breaker off) exits 0"; else bad "tick 3 failed: $(tail -5 "$TMP/tick.out")"; fi
grep -qE 'skill=(broken-a|broken-b|weekly-down|manual)( |$)' "$TMP/gh.log" \
  && bad "breaker off: exhausted failures retried off-cadence: $(cat "$TMP/gh.log")" \
  || ok "breaker off: quick retries are bounded, failures wait for their slot"

# --- tick 4: weekly-down's next Monday slot pays the probe ----------------------
git -C "$TMP/work" pull -q origin main 2>/dev/null
if run_tick 2026-07-13T09:05:00Z; then ok "tick 4 exits 0"; else bad "tick 4 failed: $(tail -5 "$TMP/tick.out")"; fi
dispatched "workflow run aeon.yml -f skill=weekly-down" && ok "weekly skill probed at its own next slot" \
  || bad "weekly-down not probed at its slot: $(cat "$TMP/gh.log")"
grep -q 'skill=manual' "$TMP/gh.log" && bad "workflow_dispatch-only skill probed" || ok "workflow_dispatch skill never probed"

echo "---"
echo "PASS: $pass   FAIL: $fail"
[ "$fail" -eq 0 ]

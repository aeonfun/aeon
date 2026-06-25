#!/usr/bin/env bash
# Tests for scripts/schedule_clusters.py. Run: bash scripts/tests/test_schedule_clusters.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
S="scripts/schedule_clusters.py"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

check() { # label  json  python-assert
  if echo "$2" | python3 -c "import sys,json; d=json.load(sys.stdin); $3" >/dev/null 2>&1; then
    pass "$1"; else bad "$1 :: $2"; fi
}

# 0. runs clean on the real aeon.yml (only heartbeat enabled)
if python3 "$S" aeon.yml >/dev/null 2>&1; then pass "runs on real aeon.yml"; else bad "runs on real aeon.yml"; fi

T=$(mktemp -d)

# staggered: 6 enabled (two near-pairs + two lone) + 1 disabled (ignored)
cat > "$T/staggered.yml" <<'YML'
skills:
  a: { enabled: true,  schedule: "0 10 * * *" }
  b: { enabled: true,  schedule: "10 10 * * *" }
  c: { enabled: true,  schedule: "0 15 * * *" }
  d: { enabled: true,  schedule: "15 15 * * *" }
  e: { enabled: true,  schedule: "0 16 * * *" }
  f: { enabled: true,  schedule: "30 17 * * *" }
  g: { enabled: false, schedule: "0 12 * * *" }
YML
J=$(python3 "$S" "$T/staggered.yml" --window 20 --json)
check "ignores disabled skills"        "$J" "assert d['enabled_cron_skills']==6, d"
check "clusters near pairs (window 20)" "$J" "assert d['clusters']==4, d"
check "flags lone cold starts"          "$J" "assert d['singletons']==2, d"
check "computes reuse benefit"          "$J" "assert d['reuse_if_clustered']==2, d"

# clustered: 3 within a 5m window collapse to one cache creation
cat > "$T/clustered.yml" <<'YML'
skills:
  a: { enabled: true, schedule: "0 7 * * *" }
  b: { enabled: true, schedule: "2 7 * * *" }
  c: { enabled: true, schedule: "4 7 * * *" }
YML
J=$(python3 "$S" "$T/clustered.yml" --window 5 --json)
check "tight cluster -> 1 creation"    "$J" "assert d['clusters']==1, d"
check "tight cluster -> 2 cache reuses" "$J" "assert d['reuse_if_clustered']==2, d"

# multi-fire cron (heartbeat-style) expands to N events
cat > "$T/multi.yml" <<'YML'
skills:
  hb: { enabled: true, schedule: "0 8,14,20 * * *" }
YML
J=$(python3 "$S" "$T/multi.yml" --window 5 --json)
check "multi-hour cron -> 3 fire events" "$J" "assert d['fire_events']==3, d"

rm -rf "$T"
echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"

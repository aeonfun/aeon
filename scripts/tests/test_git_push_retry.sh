#!/usr/bin/env bash
# Regression test for scripts/git-push-retry.sh's rebase conflict policy.
# During `pull --rebase`, `checkout --theirs` keeps the LOCAL commit and drops
# whatever concurrent runs pushed upstream. Two clones of one bare remote
# collide on every class of file the script resolves; after the push, both
# sides' data must survive and every JSON file must still parse.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/git-push-retry.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.com GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.com
g() { git "$@"; }

git init -q --bare -b main "$TMP/remote.git"
g clone -q "$TMP/remote.git" "$TMP/seed" 2>/dev/null
(
  cd "$TMP/seed" || exit 1
  git checkout -q -b main
  mkdir -p memory/logs memory/skill-health
  printf 'date,skill,model\n2026-01-01,seed,m\n' > memory/token-usage.csv
  printf '# log\n\n### seed\nseed entry\n' > memory/logs/2026-01-01.md
  printf '{"skill":"digest","last_analyzed":"2026-01-01T00:00:00Z","quality_score":3,"avg_score":3,"history":[{"date":"2026-01-01","score":3,"ts":"2026-01-01T00:00:00Z"}]}\n' | jq . > memory/skill-health/digest.json
  printf '{"a":{"last_status":"success","total_runs":1},"b":{"last_status":"success","total_runs":1},"c":{"last_status":"success"}}\n' | jq . > memory/cron-state.json
  printf 'line1\nline2\nline3\nline4\nline5\nline6\nline7\n' > notes.txt
  mkdir -p output/.chains
  printf '*Digest*\nseed run output\n' > output/.chains/digest.md
  printf 'seed report\n' > output/report.md
  g add -A && g commit -qm seed && git push -q origin main
)
g clone -q "$TMP/remote.git" "$TMP/up" 2>/dev/null
g clone -q "$TMP/remote.git" "$TMP/local" 2>/dev/null

# Upstream: another run lands first.
(
  cd "$TMP/up" || exit 1
  printf '2026-01-02,upstream,m\n' >> memory/token-usage.csv
  printf '\n### upstream\nupstream entry\n=======\n' >> memory/logs/2026-01-01.md
  jq '.last_analyzed="2026-01-02T00:00:00Z" | .quality_score=5 | .history += [{"date":"2026-01-02","score":5,"ts":"2026-01-02T00:00:00Z"}]' \
    memory/skill-health/digest.json > x && mv x memory/skill-health/digest.json
  jq '.a.total_runs=2 | .a.last_status="failed" | .c.last_status="upstream"' memory/cron-state.json > x && mv x memory/cron-state.json
  sed 's/^line2$/line2 upstream/' notes.txt > x && mv x notes.txt
  printf '*Digest*\nupstream run output\n' > output/.chains/digest.md
  printf 'seed report\nupstream report line\n' > output/report.md
  printf 'upstream-only chain\n' > output/.chains/fresh.md
  g add -A && g commit -qm upstream && git push -q origin main
)

# Local: this run, based on the old seed.
(
  cd "$TMP/local" || exit 1
  printf '2026-01-03,local,m\n' >> memory/token-usage.csv
  printf '\n### local\nlocal entry\n' >> memory/logs/2026-01-01.md
  jq '.last_analyzed="2026-01-03T00:00:00Z" | .quality_score=1 | .history += [{"date":"2026-01-03","score":1,"ts":"2026-01-03T00:00:00Z"}]' \
    memory/skill-health/digest.json > x && mv x memory/skill-health/digest.json
  jq '.b.total_runs=2 | .b.last_status="failed" | .c.last_status="local"' memory/cron-state.json > x && mv x memory/cron-state.json
  sed 's/^line2$/line2 local/; s/^line7$/line7 local/' notes.txt > x && mv x notes.txt
  printf '*Digest*\nlocal run output\n' > output/.chains/digest.md
  printf 'seed report\nlocal report line\n' > output/report.md
  printf 'local-only chain\n' > output/.chains/fresh.md
  g add output/.chains/fresh.md
  echo dirty > untracked-leftover.txt
  g commit -qam local
)

out=$(cd "$TMP/local" && bash "$SCRIPT" 2>&1)
rc=$?
[ "$rc" = 0 ] && pass "push succeeded after resolving conflicts" || { bad "script exited $rc"; echo "$out"; }

g clone -q "$TMP/remote.git" "$TMP/check" 2>/dev/null
cd "$TMP/check" || exit 1

grep -q '^2026-01-02,upstream,m$' memory/token-usage.csv && grep -q '^2026-01-03,local,m$' memory/token-usage.csv \
  && pass "token-usage.csv keeps both runs' rows (union)" || bad "token-usage.csv lost a row: $(cat memory/token-usage.csv)"
grep -q 'upstream entry' memory/logs/2026-01-01.md && grep -q 'local entry' memory/logs/2026-01-01.md \
  && pass "daily log keeps both entries" || bad "daily log lost an entry"
grep -q '^=======$' memory/logs/2026-01-01.md \
  && pass "legit '=======' line in a log survives (no blind marker strip)" || bad "'=======' content line was stripped"
grep -qE '^(<<<<<<<|>>>>>>>)' memory/logs/2026-01-01.md memory/token-usage.csv notes.txt \
  && bad "conflict markers left in a resolved file" || pass "no conflict markers left behind"

if jq -e . memory/skill-health/digest.json >/dev/null 2>&1; then
  pass "skill-health JSON still parses"
  [ "$(jq '.history | length' memory/skill-health/digest.json)" = 3 ] \
    && pass "skill-health history keeps both sides' entries" || bad "skill-health history: $(jq -c .history memory/skill-health/digest.json)"
  [ "$(jq -r .last_analyzed memory/skill-health/digest.json)" = "2026-01-03T00:00:00Z" ] && [ "$(jq .quality_score memory/skill-health/digest.json)" = 1 ] \
    && pass "skill-health scalars come from the newest analysis" || bad "skill-health scalars wrong: $(jq -c . memory/skill-health/digest.json)"
  [ "$(jq .avg_score memory/skill-health/digest.json)" = 3 ] \
    && pass "skill-health avg_score recomputed over merged history" || bad "avg_score=$(jq .avg_score memory/skill-health/digest.json)"
else
  bad "skill-health JSON is invalid after conflict resolution"
fi

if jq -e . memory/cron-state.json >/dev/null 2>&1; then
  [ "$(jq -c '[.a.total_runs, .a.last_status, .b.total_runs, .b.last_status, .c.last_status]' memory/cron-state.json)" = '[2,"failed",2,"failed","upstream"]' ] \
    && pass "cron-state keeps both sides' per-skill updates, upstream wins a same-key clash" || bad "cron-state merge wrong: $(jq -c . memory/cron-state.json)"
else
  bad "cron-state JSON is invalid after conflict resolution"
fi

# output/.chains/<skill>.md holds only the latest run's output; a union left two
# runs' slates concatenated on main. This run (local) wins the whole file, for a
# modify/modify and an add/add conflict alike.
[ "$(cat output/.chains/digest.md)" = "$(printf '*Digest*\nlocal run output')" ] \
  && pass "chain file keeps only this run's copy (no union)" || bad "chain file: $(cat output/.chains/digest.md)"
[ "$(cat output/.chains/fresh.md)" = "local-only chain" ] \
  && pass "add/add chain file keeps this run's copy" || bad "add/add chain file: $(cat output/.chains/fresh.md)"
grep -q 'upstream report line' output/report.md && grep -q 'local report line' output/report.md \
  && pass "the rest of output/ still union-merges" || bad "output/report.md lost a side: $(cat output/report.md)"

grep -q '^line2 upstream$' notes.txt && pass "other files: upstream wins the conflicting hunk" || bad "notes.txt line2: $(sed -n 2p notes.txt)"
grep -q '^line7 local$' notes.txt && pass "other files: local's non-conflicting hunk re-applied" || bad "notes.txt lost local line7"

[ -f "$TMP/local/untracked-leftover.txt" ] && pass "dirty tree did not block the rebase (autostash)" || bad "untracked file vanished"

# A dirty tracked file (the read-only failure path stages only its log entry)
# must not make `pull --rebase` refuse.
(
  cd "$TMP/up" || exit 1
  git pull -q origin main 2>/dev/null
  printf 'more\n' >> notes.txt && g commit -qam up2 && git push -q origin main
)
(
  cd "$TMP/local" || exit 1
  printf 'x\n' >> memory/logs/2026-01-02.md && git add memory/logs/2026-01-02.md && g commit -qm log
  printf 'unstaged\n' >> notes.txt
)
out=$(cd "$TMP/local" && bash "$SCRIPT" 2>&1)
rc=$?
[ "$rc" = 0 ] && grep -q '^unstaged$' "$TMP/local/notes.txt" \
  && pass "dirty tracked file: rebase + push succeed, local edit preserved" || { bad "dirty tracked file blocked push (rc=$rc)"; echo "$out"; }

[ "$fail" -eq 0 ] && echo "git-push-retry: all passed"
exit "$fail"

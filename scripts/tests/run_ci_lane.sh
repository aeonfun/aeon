#!/usr/bin/env bash
# run_ci_lane.sh - runs one lane of the ci-tests suites, or checks lane coverage.
#
# The suite list lives in scripts/tests/ci-lanes.txt, one suite per line:
#   <lane> | <name> | <command>
# ci-tests.yml runs lanes 1-10 at once (GitHub `parallel:` steps). A lane runs
# EVERY suite even when one fails, then fails itself and names the failed suites,
# so one red suite never hides another.
#
# Usage:
#   bash scripts/tests/run_ci_lane.sh <lane>    run one lane (e.g. 3)
#   bash scripts/tests/run_ci_lane.sh all       run every suite, serially
#   bash scripts/tests/run_ci_lane.sh --check   coverage guard: every
#     scripts/tests/test_* file is in the list exactly once, every listed file
#     exists, and every lane in the list has a step in ci-tests.yml.
# Rebalance lanes from a run's timings: see .github/scripts/ci-tests-lanes.py.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1
LIST="scripts/tests/ci-lanes.txt"
WORKFLOW=".github/workflows/ci-tests.yml"

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# Parse the list into parallel arrays. Comments (#) and blank lines are skipped.
lanes=()
names=()
cmds=()
bad=0
lineno=0
while IFS= read -r line || [ -n "$line" ]; do
  lineno=$((lineno + 1))
  case "$(trim "$line")" in
    '' | '#'*) continue ;;
  esac
  IFS='|' read -r f_lane f_name f_cmd <<<"$line"
  f_lane=$(trim "$f_lane")
  f_name=$(trim "$f_name")
  f_cmd=$(trim "${f_cmd:-}")
  if ! [[ "$f_lane" =~ ^[0-9]+$ ]] || [ -z "$f_name" ] || [ -z "$f_cmd" ]; then
    echo "::error file=$LIST,line=$lineno::bad line (want '<lane> | <name> | <command>'): $line"
    bad=1
    continue
  fi
  lanes+=("$f_lane")
  names+=("$f_name")
  cmds+=("$f_cmd")
done <"$LIST"
[ "$bad" -eq 0 ] || exit 1

now() {
  if [ -n "${EPOCHREALTIME:-}" ]; then
    printf '%s' "${EPOCHREALTIME/,/.}"
  else
    date +%s
  fi
}

run_lane() {
  local want="$1" i start rc secs ran=0
  local failed=() timings=()
  for i in "${!names[@]}"; do
    if [ "$want" != all ] && [ "${lanes[$i]}" != "$want" ]; then
      continue
    fi
    ran=$((ran + 1))
    echo "::group::${names[$i]}"
    start=$(now)
    # stderr into stdout: one stream keeps every line inside its own group.
    bash -c "${cmds[$i]}" </dev/null 2>&1
    rc=$?
    secs=$(awk -v a="$start" -v b="$(now)" 'BEGIN { printf "%.1f", b - a }')
    echo "::endgroup::"
    # The generator parses these lines to rebalance lanes.
    echo "suite-time: ${secs}s ${names[$i]}"
    timings+=("$(printf '%6ss  %s' "$secs" "${names[$i]}")")
    if [ "$rc" -ne 0 ]; then
      echo "::error title=ci-tests suite failed (lane $want)::${names[$i]} (exit $rc): ${cmds[$i]}"
      failed+=("${names[$i]} (exit $rc)")
    fi
  done
  if [ "$ran" -eq 0 ]; then
    echo "::error::lane $want has no suites in $LIST"
    return 1
  fi
  echo "lane $want: $ran suites"
  printf '%s\n' "${timings[@]}"
  if [ "${#failed[@]}" -gt 0 ]; then
    echo "FAILED suites in lane $want (${#failed[@]} of $ran):"
    printf '  - %s\n' "${failed[@]}"
    return 1
  fi
  echo "lane $want: all $ran suites passed"
}

check_coverage() {
  local errs=() words=() f n i lane hits seen_names=$'\n'
  # 1. every test file on disk is listed exactly once.
  while IFS= read -r f; do
    hits=0
    for i in "${!cmds[@]}"; do
      case " ${cmds[$i]} " in
        *" $f "*) hits=$((hits + 1)) ;;
      esac
    done
    if [ "$hits" -eq 0 ]; then
      errs+=("not in any lane: $f (add a line to $LIST)")
    elif [ "$hits" -gt 1 ]; then
      errs+=("listed $hits times: $f")
    fi
  done < <(find scripts/tests -maxdepth 1 -type f -name 'test_*' | LC_ALL=C sort)
  # 2. every listed script exists; names are unique.
  for i in "${!cmds[@]}"; do
    read -ra words <<<"${cmds[$i]}"
    for f in "${words[@]}"; do
      case "$f" in
        scripts/*) [ -f "$f" ] || errs+=("listed but missing on disk: $f (${names[$i]})") ;;
      esac
    done
    n="${names[$i]}"
    case "$seen_names" in
      *$'\n'"$n"$'\n'*) errs+=("duplicate suite name: $n") ;;
    esac
    seen_names+="$n"$'\n'
  done
  # 3. every lane in the list has a step in the workflow, and vice versa.
  local wf_lanes list_lanes
  wf_lanes=$(grep -oE 'run_ci_lane\.sh [0-9]+' "$WORKFLOW" | awk '{print $2}' | sort -n | uniq)
  list_lanes=$(printf '%s\n' "${lanes[@]}" | sort -n | uniq)
  for lane in $list_lanes; do
    grep -qx "$lane" <<<"$wf_lanes" || errs+=("lane $lane is in $LIST but $WORKFLOW has no step for it")
  done
  for lane in $wf_lanes; do
    grep -qx "$lane" <<<"$list_lanes" || errs+=("$WORKFLOW runs lane $lane but $LIST has no suite in it")
  done
  if [ "${#errs[@]}" -gt 0 ]; then
    echo "ci-tests coverage check FAILED:"
    for f in "${errs[@]}"; do
      echo "::error file=$LIST::$f"
    done
    return 1
  fi
  echo "ci-tests coverage OK: ${#names[@]} suites in $(wc -w <<<"$list_lanes" | tr -d ' ') lanes, every scripts/tests/test_* file listed once"
}

case "${1:-}" in
  --check) check_coverage ;;
  all | [0-9]*) run_lane "$1" ;;
  *)
    echo "usage: $0 <lane> | all | --check" >&2
    exit 2
    ;;
esac

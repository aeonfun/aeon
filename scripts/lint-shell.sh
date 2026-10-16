#!/usr/bin/env bash
# lint-shell.sh - shellcheck gate for the repo's shell scripts.
#
# The shell surface (root `aeon`, scripts/**, bin/**, harness-adapter/**, and a
# few skill helpers) is the load-bearing half of every run - the read-only
# sandbox, the harness adapters, the notify path - yet nothing linted it. This
# gates it.
#
# Ratchet floor: it FAILS on error-severity findings only, so it is green on a
# clean tree today. Warning-and-above are printed as an advisory backlog (real
# ones live there - unexpanded `~`, overlapping case patterns) without
# red-walling CI. Tighten `GATE_SEVERITY` to `warning` once that backlog is
# burned down.
#
# Run locally: `bash scripts/lint-shell.sh` (needs shellcheck on PATH; it ships
# preinstalled on GitHub's ubuntu-latest runners).
set -euo pipefail

GATE_SEVERITY="${GATE_SEVERITY:-error}"
ADVISORY_SEVERITY="${ADVISORY_SEVERITY:-warning}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "lint-shell: shellcheck not found on PATH" >&2
  exit 127
fi

# Every git-tracked shell file: a `.sh` name, or an extension-less file whose
# first line is a sh/bash shebang. Vendored trees (node_modules) are excluded by
# listing only tracked files and filtering. Nothing here is generated.
collect_files() {
  # `.sh` names, plus extension-less files whose line 1 is a sh/bash shebang.
  git ls-files '*.sh'
  git ls-files | while IFS= read -r f; do
    case "$f" in
      *.sh) continue ;;
    esac
    [ -f "$f" ] || continue
    first="$(head -1 "$f" 2>/dev/null || true)"
    case "$first" in
      '#!'*sh*) echo "$f" ;;
    esac
  done
}

# Portable array fill (no bash-4 `mapfile`; macOS ships bash 3.2).
FILES=()
while IFS= read -r f; do
  [ -n "$f" ] && FILES+=("$f")
done < <(collect_files | grep -vE '(^|/)node_modules/' | sort -u)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "lint-shell: no shell files found" >&2
  exit 1
fi

JOBS="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)"
echo "lint-shell: checking ${#FILES[@]} shell files on $JOBS cores"
echo "shellcheck $(shellcheck --version | awk '/version:/{print $2}')"
echo

OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT
export OUT_DIR

# run_shellcheck <severity>: prints every finding at or above <severity>, one
# gcc-format line each (file:line:col: level: message [SCxxxx]), sorted.
# One shellcheck process uses one core, so the files are split into batches across all
# cores, each batch writing its own file (parallel writes to one pipe can split
# lines). Exit 1 means findings; anything higher (bad flag, unreadable file)
# fails the run instead of passing as clean.
run_shellcheck() {
  rm -f "$OUT_DIR"/sc.*
  # shellcheck disable=SC2016 # $SEV, $OUT_DIR and $@ expand in the inner sh
  if ! printf '%s\0' "${FILES[@]}" | SEV="$1" xargs -0 -P "$JOBS" -n 16 sh -c '
    shellcheck -x --severity="$SEV" --format=gcc "$@" > "$(mktemp "$OUT_DIR/sc.XXXXXX")"
    [ $? -le 1 ]' sh; then
    echo "lint-shell: shellcheck itself failed (see above)" >&2
    return 2
  fi
  cat "$OUT_DIR"/sc.* 2>/dev/null | sort
}

# gcc output names error and warning but folds info and style into "note", so the
# gate can be read off the advisory pass only when it is error or warning. A
# stricter gate gets its own pass.
case "$GATE_SEVERITY:$ADVISORY_SEVERITY" in
  error:error | error:warning | error:info | error:style) gate_levels='error' ;;
  warning:warning | warning:info | warning:style) gate_levels='error|warning' ;;
  *) gate_levels='' ;;
esac

# Advisory pass (never fails the build) so the backlog is visible in logs.
advisory="$(run_shellcheck "$ADVISORY_SEVERITY")" || exit 2
advisory_count="$(printf '%s' "$advisory" | grep -cE ':[0-9]+:[0-9]+:' || true)"
if [ "$advisory_count" -gt 0 ]; then
  echo "::group::shellcheck advisory (severity >= $ADVISORY_SEVERITY, non-blocking): $advisory_count"
  printf '%s\n' "$advisory"
  echo "::endgroup::"
  echo
fi

# Gate: this one decides the exit code.
echo "shellcheck gate (severity >= $GATE_SEVERITY):"
if [ -n "$gate_levels" ]; then
  gate="$(printf '%s' "$advisory" | grep -E ": ($gate_levels): " || true)"
else
  gate="$(run_shellcheck "$GATE_SEVERITY")" || exit 2
fi
if [ -n "$gate" ]; then
  printf '%s\n' "$gate"
  echo "lint-shell: FAIL - findings at or above '$GATE_SEVERITY'" >&2
  exit 1
fi
echo "lint-shell: OK - no findings at or above '$GATE_SEVERITY'"

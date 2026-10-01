#!/usr/bin/env bash
# state_store — append-only run state on a GitHub Issue (hardening §3).
#
# Replaces the shared memory/cron-state.json file (rewritten + force-pushed with a
# 5x rebase-retry + auto-conflict-resolver on every run) with conflict-free appends:
# each run posts an immutable comment; canonical state is derived by folding them
# (scripts/state_reduce.py). Concurrent runs never race — comments are independent.
#
# Repo: honors the GH_REPO env var (else gh's current-dir repo).
# Usage:
#   scripts/state_store.sh ensure <title>             -> prints issue number (creates if absent)
#   scripts/state_store.sh append <issue> <json>      -> post one event comment
#   scripts/state_store.sh read   <issue>             -> fold comments -> cron-state JSON (stdout)
#   scripts/state_store.sh materialize <title> <file> -> ensure+read, atomically write the
#                                                        folded projection to <file> (for readers)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Bash 3.2 (the macOS system bash) treats expansion of an empty array as an
# unbound variable under `set -u`. Keep the documented no-GH_REPO/current-repo
# path out of an empty array entirely.
_gh_issue() {
  if [ -n "${GH_REPO:-}" ]; then
    gh issue "$@" --repo "$GH_REPO"
  else
    gh issue "$@"
  fi
}

# A failed search must be fatal, not "no issue found": swallowing it used to make
# _ensure create a brand-new (empty) ledger, which then materialized as {} over
# cron-state and re-fired every skill.
_find_all() {
  local title="${1:?title required}"
  _gh_issue list --state all --search "\"$title\" in:title" \
    --json number,title --jq "map(select(.title==\"$title\")) | .[].number"
}

_ensure() {
  local title="${1:?title required}" n
  # Search open OR closed. The ledger deliberately lives *closed* so it never
  # clutters the repo's open-issues list. Commenting on and reading a closed
  # issue still work (only *locking* an issue blocks comments) — so a closed
  # issue is a perfectly good append-only store, just an invisible one.
  if ! n=$(_find_all "$title" | sort -n | head -1); then
    echo "state_store: issue search for '$title' failed; refusing to create a new ledger" >&2
    return 1
  fi
  if [ -z "$n" ]; then
    local url created_n
    url=$(_gh_issue create --title "$title" \
          --body "Append-only Aeon state store (hardening §3). Machine-managed; do not edit by hand.") || return 1
    created_n=$(printf '%s' "$url" | grep -oE '[0-9]+$')
    # Close it on creation so it stays out of the open-issues view. Appends still
    # land on the closed issue; it never needs to be reopened.
    if [ -n "$created_n" ]; then
      _gh_issue close "$created_n" >/dev/null 2>&1 || true
    fi
    # Reconcile: the search above and this create are not atomic, so a concurrent
    # _ensure for the same title can create its own issue in the gap. Re-list and
    # converge every caller on the lowest matching issue number — GitHub Issues has
    # no create-if-absent primitive, so a transient duplicate can't be prevented,
    # but every caller from this point on lands on the same canonical issue instead
    # of the ledger permanently forking across two.
    n=$(_find_all "$title" | sort -n | head -1) || n=""
    [ -n "$n" ] || n="$created_n"
  fi
  printf '%s' "$n"
}

_append() {
  local n="${1:?issue number required}"; shift
  _gh_issue comment "$n" --body "$*" >/dev/null
}

# Only fold comments from principals that can already write to the repo: the
# token's own login (a PAT; GITHUB_TOKEN can't read /user, so this may be empty),
# github-actions[bot] (GITHUB_TOKEN), and OWNER/MEMBER/COLLABORATOR. On a public
# repo anyone can comment on the ledger issue, and an unfiltered fold let a
# drive-by comment (e.g. a far-future ts) suppress a skill or trip its breaker.
_read() {
  local n="${1:?issue number required}" me
  me=$(gh api user --jq .login 2>/dev/null || true)
  gh api "repos/{owner}/{repo}/issues/$n/comments" --paginate 2>/dev/null \
    | jq -r --arg me "$me" '.[]
        | select((.user.login // "") as $l
            | ($me != "" and $l == $me)
              or $l == "github-actions[bot]"
              or ((.author_association // "") | IN("OWNER", "MEMBER", "COLLABORATOR")))
        | .body' \
    | python3 "$HERE/state_reduce.py"
}

# Fold the issue's events and write them to a file the readers expect, atomically.
# Returns non-zero (leaving <file> untouched) if the issue can't be resolved, the
# fold yields no valid JSON, or the fold is empty while <file> already holds
# state (an empty ledger must never wipe a populated cron-state) - callers then
# fall back to whatever file is committed.
_materialize() {
  local title="${1:?title required}" out="${2:?output path required}" n tmp
  n=$(_ensure "$title") || return 1
  [ -n "$n" ] || return 1
  mkdir -p "$(dirname "$out")"
  tmp="$out.materializing.$$"
  if _read "$n" > "$tmp" 2>/dev/null && jq empty "$tmp" 2>/dev/null; then
    if [ "$(jq 'length' "$tmp")" = "0" ] && [ -s "$out" ] \
      && [ "$(jq 'length' "$out" 2>/dev/null || echo 0)" != "0" ]; then
      echo "state_store: '$title' (issue #$n) folded to {}; refusing to overwrite non-empty $out" >&2
      rm -f "$tmp"
      return 1
    fi
    mv "$tmp" "$out"
    echo "state_store: materialized '$title' (issue #$n) -> $out ($(jq 'length' "$out") entries)" >&2
    return 0
  fi
  rm -f "$tmp"
  return 1
}

cmd="${1:-}"; shift || true
case "$cmd" in
  ensure)      _ensure "$@"; echo ;;
  append)      _append "$@" ;;
  read)        _read "$@" ;;
  materialize) _materialize "$@" ;;
  *)
    echo "usage: state_store.sh {ensure <title>|append <issue> <json>|read <issue>|materialize <title> <file>}" >&2
    exit 2 ;;
esac

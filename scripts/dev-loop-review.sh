#!/usr/bin/env bash
# Verify the review leg of dev-loop from GitHub state, not agent prose.
set -euo pipefail

usage() {
  echo "usage: $0 parse <owner/repo#pr> <40-char-head-sha> <review-body-file> | verify|body <owner/repo#pr> <40-char-head-sha>" >&2
  exit 64
}

validate_target() {
  local target="${1:-}"
  [[ "$target" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+#[1-9][0-9]*$ ]] || {
    echo "dev-loop review: target must be owner/repo#pr" >&2
    return 2
  }
}

parse_body() {
  local target="$1" sha="$2" body_file="$3"
  validate_target "$target" || return $?
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || {
    echo "dev-loop review: expected sha must be 40 lowercase hex characters" >&2
    return 2
  }
  [ -f "$body_file" ] || {
    echo "dev-loop review: review body file is missing: $body_file" >&2
    return 1
  }

  local marker_count receipts receipt_count receipt critical_count issue_count verdict
  marker_count=$(grep -oF '<!-- aeon-review:' "$body_file" | wc -l | tr -d ' ' || true)
  [ "$marker_count" -eq 1 ] || {
    echo "dev-loop review: expected exactly one review marker, found $marker_count" >&2
    return 1
  }
  receipts=$(grep -E '^<!-- aeon-review:\{.*\} -->$' "$body_file" || true)
  receipt_count=$(printf '%s\n' "$receipts" | sed '/^$/d' | wc -l | tr -d ' ')
  [ "$receipt_count" -eq 1 ] || {
    echo "dev-loop review: expected exactly one review receipt, found $receipt_count" >&2
    return 1
  }

  receipt=${receipts#<!-- aeon-review:}
  receipt=${receipt% -->}
  if ! printf '%s' "$receipt" | jq -e \
    --arg target "$target" --arg sha "$sha" '
      type == "object" and
      keys == ["critical", "issues", "schema", "sha", "target", "verdict"] and
      .schema == 1 and .target == $target and .sha == $sha and
      (.verdict == "approve-ready" or .verdict == "discussion-needed" or .verdict == "blocked") and
      (.critical | type == "number" and floor == . and . >= 0) and
      (.issues | type == "number" and floor == . and . >= 0) and
      (if .verdict == "approve-ready" then .critical == 0 and .issues == 0
       elif .verdict == "discussion-needed" then .critical == 0 and .issues > 0
       else .critical > 0 end)
    ' >/dev/null 2>&1; then
    echo "dev-loop review: malformed or inconsistent review receipt" >&2
    return 1
  fi

  critical_count=$(grep -Ec '^- \[CRITICAL\] ' "$body_file" || true)
  issue_count=$(grep -Ec '^- \[ISSUE\] ' "$body_file" || true)
  if [ "$critical_count" -ne "$(printf '%s' "$receipt" | jq -r '.critical')" ] ||
     [ "$issue_count" -ne "$(printf '%s' "$receipt" | jq -r '.issues')" ]; then
    echo "dev-loop review: receipt counts do not match posted findings" >&2
    return 1
  fi

  verdict=$(printf '%s' "$receipt" | jq -r '.verdict')
  jq -cn --arg target "$target" --arg sha "$sha" --arg verdict "$verdict" \
    --argjson critical "$critical_count" --argjson issues "$issue_count" \
    '{schema:1,target:$target,sha:$sha,verdict:$verdict,critical:$critical,issues:$issues,actionable:($critical > 0 or $issues > 0)}'
}

fetch_verified_body() {
  local target="$1" sha="$2" repo number actor current_sha reviews count
  validate_target "$target" || return $?
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || {
    echo "dev-loop review: expected sha must be 40 lowercase hex characters" >&2
    return 2
  }
  repo=${target%#*}
  number=${target##*#}
  actor=$(gh api user --jq .login)
  [ -n "$actor" ] || { echo "dev-loop review: could not determine review actor" >&2; return 1; }
  current_sha=$(gh api "repos/$repo/pulls/$number" --jq .head.sha)
  [ "$current_sha" = "$sha" ] || {
    echo "dev-loop review: PR head changed after review dispatch (expected $sha, found ${current_sha:-missing})" >&2
    return 1
  }
  reviews=$(mktemp)
  gh api "repos/$repo/pulls/$number/reviews" > "$reviews"
  count=$(jq -r --arg actor "$actor" --arg sha "$sha" '
    [.[] | select(.user.login == $actor and .commit_id == $sha) |
     .body // empty | select(contains("<!-- aeon-review:"))] | length
  ' "$reviews")
  [ "$count" -eq 1 ] || {
    echo "dev-loop review: expected exactly one receipt-bearing GitHub review, found $count" >&2
    return 1
  }
  jq -r --arg actor "$actor" --arg sha "$sha" '
    [.[] | select(.user.login == $actor and .commit_id == $sha) |
     .body // empty | select(contains("<!-- aeon-review:"))][0]
  ' "$reviews"
}

case "${1:-}" in
  parse)
    [ "$#" -eq 4 ] || usage
    parse_body "$2" "$3" "$4"
    ;;
  verify|body)
    [ "$#" -eq 3 ] || usage
    target="$2"
    sha="$3"
    bodies=$(mktemp)
    fetch_verified_body "$target" "$sha" > "$bodies"
    parse_body "$target" "$sha" "$bodies" >/dev/null
    if [ "$1" = body ]; then
      cat "$bodies"
    else
      parse_body "$target" "$sha" "$bodies"
    fi
    ;;
  *) usage ;;
esac

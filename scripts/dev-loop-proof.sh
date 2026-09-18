#!/usr/bin/env bash
# a sha-bound receipt prevents a successful wrapper or model claim from passing as live proof.
set -euo pipefail

usage() {
  echo "usage: $0 parse <owner/repo#pr> <40-char-head-sha> <proof-body-file> | verify <owner/repo#pr> <40-char-head-sha>" >&2
  exit 64
}

validate_target() {
  [[ "${1:-}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+#[1-9][0-9]*$ ]] || {
    echo "dev-loop proof: target must be owner/repo#pr" >&2
    return 2
  }
}

parse_body() {
  local target="$1" sha="$2" body_file="$3" marker_count receipts receipt_count receipt
  validate_target "$target" || return $?
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || {
    echo "dev-loop proof: expected sha must be 40 lowercase hex characters" >&2
    return 2
  }
  [ -f "$body_file" ] || { echo "dev-loop proof: proof body file is missing" >&2; return 1; }

  marker_count=$(grep -oF '<!-- aeon-proof:' "$body_file" | wc -l | tr -d ' ' || true)
  [ "$marker_count" -eq 1 ] || {
    echo "dev-loop proof: expected exactly one proof marker, found $marker_count" >&2
    return 1
  }
  receipts=$(grep -E '^<!-- aeon-proof:\{.*\} -->$' "$body_file" || true)
  receipt_count=$(printf '%s\n' "$receipts" | sed '/^$/d' | wc -l | tr -d ' ')
  [ "$receipt_count" -eq 1 ] || {
    echo "dev-loop proof: expected exactly one proof receipt, found $receipt_count" >&2
    return 1
  }
  receipt=${receipts#<!-- aeon-proof:}
  receipt=${receipt% -->}
  printf '%s' "$receipt" | jq -e --arg target "$target" --arg sha "$sha" '
    type == "object" and
    keys == ["evidence_run_id", "evidence_url", "kind", "schema", "sha", "skill", "target", "verdict"] and
    .schema == 1 and .target == $target and .sha == $sha and
    .kind == "aeon-skill" and .verdict == "proven" and
    (.skill | type == "string" and test("^[a-z0-9][a-z0-9-]*$")) and
    (.evidence_run_id | type == "number" and floor == . and . > 0) and
    (.evidence_url | type == "string" and
      test("^https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[1-9][0-9]*$"))
  ' >/dev/null 2>&1 || {
    echo "dev-loop proof: malformed or inconsistent proof receipt" >&2
    return 1
  }
  printf '%s\n' "$receipt"
}

fetch_verified_body() {
  local target="$1" sha="$2" repo number actor current_sha comments count
  validate_target "$target" || return $?
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || return 2
  repo=${target%#*}
  number=${target##*#}
  actor=$(gh api user --jq .login)
  current_sha=$(gh api "repos/$repo/pulls/$number" --jq .head.sha)
  [ "$current_sha" = "$sha" ] || {
    echo "dev-loop proof: PR head changed after proof dispatch" >&2
    return 1
  }
  comments=$(mktemp)
  gh api --paginate "repos/$repo/issues/$number/comments?per_page=100" > "$comments"
  count=$(jq -s --arg actor "$actor" --arg sha "\"sha\":\"$sha\"" '
    [.[].[] | select(.user.login == $actor) | .body // empty |
      select(contains("<!-- aeon-proof:") and contains($sha))] | length
  ' "$comments")
  [ "$count" -eq 1 ] || {
    echo "dev-loop proof: expected exactly one SHA-bound proof comment, found $count" >&2
    return 1
  }
  jq -sr --arg actor "$actor" --arg sha "\"sha\":\"$sha\"" '
    [.[].[] | select(.user.login == $actor) | .body // empty |
      select(contains("<!-- aeon-proof:") and contains($sha))][0]
  ' "$comments"
}

case "${1:-}" in
  parse)
    [ "$#" -eq 4 ] || usage
    parse_body "$2" "$3" "$4"
    ;;
  verify)
    [ "$#" -eq 3 ] || usage
    body=$(mktemp)
    fetch_verified_body "$2" "$3" > "$body"
    parse_body "$2" "$3" "$body"
    ;;
  *) usage ;;
esac

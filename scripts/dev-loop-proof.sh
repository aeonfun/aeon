#!/usr/bin/env bash
# a sha-bound receipt prevents a successful wrapper or model claim from passing as live proof.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

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
  # aeon-skill receipts keep their original shape and checks. verify-run is the
  # generic kind: it names the work order whose verify commands ran, carries no
  # skill, and additionally pins the evidence url to this repo's own run.
  # Anchors are \A and \z: with $, a value ending in a newline still matched.
  printf '%s' "$receipt" | jq -e --arg target "$target" --arg sha "$sha" --arg repo "${target%#*}" '
    def run_url: "\\Ahttps://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[1-9][0-9]*\\z";
    type == "object" and
    .schema == 1 and .target == $target and .sha == $sha and .verdict == "proven" and
    (.evidence_run_id | type == "number" and floor == . and . > 0) and
    (.evidence_url | type == "string" and test(run_url)) and
    (
      (.kind == "aeon-skill" and
        keys == ["evidence_run_id", "evidence_url", "kind", "schema", "sha", "skill", "target", "verdict"] and
        (.skill | type == "string" and test("\\A[a-z0-9][a-z0-9-]*\\z")))
      or
      (.kind == "verify-run" and
        keys == ["evidence_run_id", "evidence_url", "kind", "order", "schema", "sha", "target", "verdict"] and
        (.order | type == "string" and test("\\A[a-z0-9][a-z0-9-]*\\z")) and
        (.evidence_url | ascii_downcase) ==
          ("https://github.com/" + $repo + "/actions/runs/" + (.evidence_run_id | tostring) | ascii_downcase))
    )
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

# parse only checks the receipt's shape. For verify-run the evidence must also be a real run of
# this order's commands, by the pinned workflow, at this head, dispatched by the account that
# posted the receipt. epoch-evidence.sh holds that logic; epoch-check.sh calls the same script.
check_verify_run_evidence() {
  local target="$1" sha="$2" receipt="$3" actor order_repo
  [ "$(printf '%s' "$receipt" | jq -r .kind)" = "verify-run" ] || return 0
  [ -f "$SCRIPT_DIR/epoch-evidence.sh" ] || {
    echo "dev-loop proof: scripts/epoch-evidence.sh is missing next to this script (copy it from the epoch pack's upstream/ folder)" >&2
    return 1
  }
  actor=$(gh api user --jq .login)
  order_repo=${EPOCH_ORDER_REPO:-${GITHUB_REPOSITORY:-}}
  [ -n "$order_repo" ] || order_repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
  bash "$SCRIPT_DIR/epoch-evidence.sh" check "$target" "$sha" "$receipt" "$order_repo" "$actor" || {
    echo "dev-loop proof: the evidence run is not a faithful epoch-verify run of this order at $sha" >&2
    return 1
  }
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
    receipt=$(parse_body "$2" "$3" "$body")
    check_verify_run_evidence "$2" "$3" "$receipt"
    printf '%s\n' "$receipt"
    ;;
  *) usage ;;
esac

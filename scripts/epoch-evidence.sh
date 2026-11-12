#!/usr/bin/env bash
# epoch-evidence: is the actions run named by a verify-run receipt really the run of this order?
# one implementation for both gates (dev-loop-proof.sh and epoch-check.sh). keep the copy under
# upstream/scripts/ byte-identical; the tests compare them.
#
#   epoch-evidence.sh commands <order-file|->            the order's verify commands, one per line
#   epoch-evidence.sh hash <order-file|->                sha256 of those lines (the value epoch-verify checks)
#   epoch-evidence.sh check <owner/repo#N> <sha> <receipt-json> <order-repo> <actors>
#       exit 0 when the receipt's run is a faithful epoch-verify run, 1 with the reason on stderr
#
# check reads github only (gh api). a faithful run is one that:
#   - is a completed, successful workflow_dispatch run of .github/workflows/epoch-verify.yml, in the target repo
#   - ran at the pinned head sha, dispatched by one of <actors> (comma separated logins)
#   - ran a workflow file byte-identical to the default branch's copy (compared by blob sha)
#   - was titled "epoch-verify <sha> <sha256 of commands> verify-<id>", where the hash equals the
#     hash of the VERIFY block of the order on the default branch of <order-repo>
#   - belongs to a pull request from this repo whose branch is epoch/<order>
# shellcheck disable=SC2016  # jq programs, not shell
set -euo pipefail

WORKFLOW=.github/workflows/epoch-verify.yml

usage() {
  echo "usage: $0 commands <order-file|-> | hash <order-file|-> | check <owner/repo#N> <sha> <receipt-json> <order-repo> <actors>" >&2
  exit 64
}

die() { echo "evidence: $*" >&2; exit 1; }

sha256_stdin() {
  if command -v sha256sum >/dev/null; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi
}

# The VERIFY section runs from a line starting with the label VERIFY to the next order label or
# heading. Candidate lines are inside a fenced block or indented four spaces or a tab; indentation
# is stripped; blank lines and lines starting with # are skipped (the workflow skips the same).
order_commands() {
  tr -d '\r' | awk '
    function label(l) { return l ~ /^[#*[:space:]]*(GOAL|SCOPE|CONTEXT|ACCEPTANCE|VERIFY|FORBIDDEN|REPORT)([^A-Za-z0-9_-]|$)/ }
    /^[ \t]*```/ { fence = !fence; next }
    !fence && label($0) { in_verify = ($0 ~ /^[#*[:space:]]*VERIFY([^A-Za-z0-9_-]|$)/); if (in_verify) sections++; next }
    !fence && /^#/ { in_verify = 0; next }
    in_verify && (fence || $0 ~ /^(    |\t)/) {
      line = $0
      sub(/^[ \t]+/, "", line)
      if (line == "" || line ~ /^#/) next
      print line
      printed++
    }
    END { if (sections != 1) exit 3; if (printed == 0) exit 4 }
  '
}

read_order() { # file or - -> stdout
  if [ "$1" = "-" ]; then cat; else cat "$1"; fi
}

commands_of() {
  local rc=0 out
  out=$(read_order "$1" | order_commands) || rc=$?
  case $rc in
    0) printf '%s\n' "$out" ;;
    3) echo "evidence: the order needs exactly one VERIFY section" >&2; return 1 ;;
    *) echo "evidence: the order's VERIFY section lists no commands" >&2; return 1 ;;
  esac
}

jq_ok() { # message, then jq args and filter; exits with the message when the filter is not true
  local msg=$1
  shift
  jq -e "$@" >/dev/null 2>&1 || die "$msg"
}

check() {
  local target=$1 sha=$2 receipt=$3 order_repo=$4 actors=$5
  local repo=${target%#*} number=${target##*#} order run_id
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "sha must be 40 lowercase hex characters"
  [[ "$order_repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "order repo must look like owner/repo"
  [ -n "$actors" ] || die "no expected actor to match the run against"
  [ "$(jq -r .kind <<<"$receipt")" = "verify-run" ] || return 0
  order=$(jq -r .order <<<"$receipt")
  run_id=$(jq -r .evidence_run_id <<<"$receipt")
  [[ "$order" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "receipt order is not a kebab-case id"
  [[ "$run_id" =~ ^[1-9][0-9]*$ ]] || die "receipt evidence_run_id is not a run id"

  local pr run
  pr=$(gh api "repos/$repo/pulls/$number") || die "could not read the pull request"
  jq_ok "the pull request head is not the pinned $sha" --arg sha "$sha" '.head.sha == $sha' <<<"$pr"
  jq_ok "the pull request branch is not epoch/$order: the branch is what binds it to its order" \
    --arg ref "epoch/$order" '.head.ref == $ref' <<<"$pr"
  jq_ok "the pull request comes from a fork or an unknown repo" \
    '(.head.repo.full_name // "x") as $h | (.base.repo.full_name // "y") as $b | ($h | ascii_downcase) == ($b | ascii_downcase)' <<<"$pr"

  run=$(gh api "repos/$repo/actions/runs/$run_id") || die "could not read evidence run $run_id"
  jq_ok "run $run_id is not run $run_id of this repo" --argjson id "$run_id" --arg repo "$repo" \
    'type == "object" and .id == $id and ((.repository.full_name // $repo) | ascii_downcase) == ($repo | ascii_downcase)' <<<"$run"
  jq_ok "run $run_id is not the epoch-verify workflow" --arg wf "$WORKFLOW" \
    '((.path // "") | sub("@.*\\z"; "")) == $wf' <<<"$run"
  jq_ok "run $run_id did not run at the pinned head $sha" --arg sha "$sha" '.head_sha == $sha' <<<"$run"
  jq_ok "run $run_id is not a completed successful run" '.status == "completed" and .conclusion == "success"' <<<"$run"
  jq_ok "run $run_id was not started by workflow_dispatch" '.event == "workflow_dispatch"' <<<"$run"
  jq_ok "run $run_id was not dispatched by the account that posted the receipt ($actors)" --arg actors "$actors" '
    ($actors | split(",") | map(ascii_downcase)) as $ok
    | ((.actor.login // "") | ascii_downcase) as $a
    | ((.triggering_actor.login // .actor.login // "") | ascii_downcase) as $t
    | ($ok | index($a)) != null and ($ok | index($t)) != null' <<<"$run"

  local default head_blob default_blob
  default=$(gh api "repos/$repo" --jq .default_branch) || die "could not read the default branch of $repo"
  head_blob=$(gh api "repos/$repo/contents/$WORKFLOW?ref=$sha" --jq .sha) || die "$WORKFLOW does not exist at $sha"
  default_blob=$(gh api "repos/$repo/contents/$WORKFLOW?ref=$default" --jq .sha) || die "$WORKFLOW does not exist on $default"
  { [ -n "$head_blob" ] && [ "$head_blob" = "$default_blob" ]; } \
    || die "$WORKFLOW at $sha differs from the copy on $default: a changed verifier proves nothing"

  local order_default order_tree order_path order_body want
  order_default=$(gh api "repos/$order_repo" --jq .default_branch) || die "could not read the default branch of $order_repo"
  order_tree=$(gh api "repos/$order_repo/git/trees/$order_default?recursive=1") || die "could not list $order_repo"
  jq_ok "the file listing of $order_repo is truncated" '.truncated == false' <<<"$order_tree"
  order_path=$(jq -r --arg o "$order" '[.tree[] | select(.type == "blob") | .path
    | select(test("\\Amemory/topics/[a-z0-9-]+/orders/" + $o + "\\.md\\z"))] | join("\n")' <<<"$order_tree")
  [ -n "$order_path" ] || die "no order $order on $order_default of $order_repo"
  [ "$(printf '%s\n' "$order_path" | wc -l | tr -d ' ')" -eq 1 ] || die "order $order is ambiguous on $order_default of $order_repo"
  order_body=$(gh api -H "Accept: application/vnd.github.raw+json" "repos/$order_repo/contents/$order_path?ref=$order_default") \
    || die "could not read $order_path"
  want=$(printf '%s\n' "$order_body" | commands_of - | sha256_stdin) || die "the order's VERIFY commands could not be read"

  jq_ok "run $run_id was not titled epoch-verify $sha $want <dispatch id>: it did not run this order's commands" \
    --arg sha "$sha" --arg want "$want" \
    '(.display_title // .name // "") | test("\\Aepoch-verify " + $sha + " " + $want + " verify-[A-Za-z0-9._-]+\\z")' <<<"$run"
}

case "${1:-}" in
  commands)
    [ "$#" -eq 2 ] || usage
    commands_of "$2"
    ;;
  hash)
    [ "$#" -eq 2 ] || usage
    commands_of "$2" | sha256_stdin
    ;;
  check)
    [ "$#" -eq 6 ] || usage
    check "$2" "$3" "$4" "$5" "$6"
    ;;
  *) usage ;;
esac

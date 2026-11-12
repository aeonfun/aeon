# shellcheck shell=bash disable=SC2034
# shared fixtures for the gate tests. source it; it defines data and helpers, runs nothing.
# one scenario directory holds both the epoch-check fixture (pr.json ...) and the files the
# gh stub serves, so the two gates can be pointed at identical facts.

TARGET=acme/widget#7
REPO=acme/widget
SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
OLD=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
ORDER=build-it
BUILDER=builder-bot
REVIEWER=reviewer-bot
PROVER=prover-bot
TRUSTED=$REVIEWER,$PROVER
LIB=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

ORDER_MD='GOAL        make it build
VERIFY
```
go test ./...
make lint
```
FORBIDDEN   nothing else
'
CANON_COMMANDS=$'go test ./...\nmake lint\n'

sha256_of() { # stdin
  if command -v sha256sum >/dev/null; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi
}
GOOD_HASH=$(printf '%s' "$CANON_COMMANDS" | sha256_of)
TRUE_HASH=$(printf 'true\n' | sha256_of)
TITLE="epoch-verify $SHA $GOOD_HASH verify-7-20260101T000000Z-1"

munge() { printf '%s' "$1" | tr -c 'A-Za-z0-9' '_'; }
put() { printf '%s\n' "$3" > "$1/$(munge "$2")"; }       # dir path json
put_page() { printf '%s\n' "$4" > "$1/$(munge "$2").p$3"; } # dir path n json

review_comment() { # sha verdict critical issues author
  local findings="" i
  for ((i = 0; i < $3; i++)); do findings+=$'- [CRITICAL] a problem\n'; done
  for ((i = 0; i < $4; i++)); do findings+=$'- [ISSUE] a smell\n'; done
  jq -cn --arg t "$TARGET" --arg s "$1" --arg v "$2" --argjson c "$3" --argjson n "$4" --arg a "$5" --arg f "$findings" '
    {user: {login: $a}, html_url: "https://github.com/acme/widget/pull/7#c1",
     body: ("review\n" + $f + "\n<!-- aeon-review:" + ({schema: 1, target: $t, sha: $s, verdict: $v, critical: $c, issues: $n} | tojson) + " -->\n")}'
}

proof_comment() { # sha extra-json author
  jq -cn --arg t "$TARGET" --arg s "$1" --argjson x "$2" --arg a "$3" '
    ({schema: 1, target: $t, sha: $s, verdict: "proven", kind: "verify-run", order: "build-it",
      evidence_run_id: 99, evidence_url: "https://github.com/acme/widget/actions/runs/99"} + $x) as $r
    | {user: {login: $a}, html_url: "https://github.com/acme/widget/pull/7#c2",
       body: ("proof\n<!-- aeon-proof:" + ($r | tojson) + " -->")}'
}

# a fully ready pull request whose proof is backed by a faithful evidence run
base() { # dir
  local d=$1
  mkdir -p "$d"
  jq -n --arg s "$SHA" --arg a "$BUILDER" '{number: 7, state: "OPEN", isDraft: false, headRefOid: $s, mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", author: {login: $a}}' > "$d/pr.json"
  echo '[{"__typename":"CheckRun","name":"build","status":"COMPLETED","conclusion":"SUCCESS","detailsUrl":"https://ci/1"}]' > "$d/checks.json"
  echo '[]' > "$d/threads.json"
  echo '[]' > "$d/reviews.json"
  jq -s '.' <(review_comment "$SHA" approve-ready 0 0 "$REVIEWER") <(proof_comment "$SHA" '{}' "$PROVER") > "$d/comments.json"

  put "$d" user "{\"login\":\"$PROVER\"}"
  put "$d" "repos/$REPO/pulls/7" "$(jq -n --arg s "$SHA" --arg a "$BUILDER" \
    '{state: "open", user: {login: $a}, head: {sha: $s, ref: "epoch/build-it", repo: {full_name: "acme/widget"}}, base: {repo: {full_name: "acme/widget"}}}')"
  put "$d" "repos/$REPO" '{"default_branch":"main"}'
  put "$d" "repos/$REPO/actions/runs/99" "$(jq -n --arg s "$SHA" --arg t "$TITLE" --arg p "$PROVER" \
    '{id: 99, path: ".github/workflows/epoch-verify.yml@refs/heads/epoch/build-it", head_sha: $s, status: "completed",
      conclusion: "success", event: "workflow_dispatch", display_title: $t, actor: {login: $p}, triggering_actor: {login: $p},
      repository: {full_name: "acme/widget"}}')"
  put "$d" "repos/$REPO/contents/.github/workflows/epoch-verify.yml?ref=$SHA" '{"sha":"blobgood"}'
  put "$d" "repos/$REPO/contents/.github/workflows/epoch-verify.yml?ref=main" '{"sha":"blobgood"}'
  put "$d" "repos/$REPO/git/trees/main?recursive=1" \
    '{"truncated":false,"tree":[{"path":"memory/topics/p/orders/build-it.md","type":"blob"},{"path":"README.md","type":"blob"}]}'
  printf '%s' "$ORDER_MD" > "$d/$(munge "repos/$REPO/contents/memory/topics/p/orders/build-it.md?ref=main")"
  sync_comments "$d"
}

# the gate in dev-loop-proof.sh reads comments through the stub; keep them equal to comments.json
sync_comments() { # dir
  jq -c '.' "$1/comments.json" > "$1/$(munge "repos/$REPO/issues/7/comments?per_page=100").p1"
}

# mutate a json file of a scenario: mutate dir file jq-filter   (file is the stub path or fixture name)
mutate() {
  local d=$1 file=$2 filter=$3
  jq "$filter" "$d/$file" > "$d/.tmp" && mv "$d/.tmp" "$d/$file"
}
stub_name() { munge "$1"; }

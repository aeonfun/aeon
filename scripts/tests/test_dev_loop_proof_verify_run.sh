#!/usr/bin/env bash
# deterministic tests for the generic verify-run proof kind that scripts/epoch-evidence.sh
# adds to scripts/dev-loop-proof.sh (ported from the Epoch Pack's own gate test matrix,
# https://github.com/Svector-anu/epoch, trimmed to the dev-loop-proof.sh half: aeon has no
# epoch-check.sh of its own to cross-check against). A stub gh on PATH, no network.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
DLP=$ROOT/scripts/dev-loop-proof.sh
EVIDENCE=$ROOT/scripts/epoch-evidence.sh
# shellcheck source=lib/scenario.sh
source "$HERE/lib/scenario.sh"
WORK=$(mktemp -d)
trap 'rm -rf "${WORK:?}"' EXIT
export PATH=$HERE/lib:$PATH

pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'ok   %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1"; }

RUN=$(stub_name "repos/$REPO/actions/runs/99")
PULL=$(stub_name "repos/$REPO/pulls/7")
TREE=$(stub_name "repos/$REPO/git/trees/main?recursive=1")
HEADWF=$(stub_name "repos/$REPO/contents/.github/workflows/epoch-verify.yml?ref=$SHA")
ORDERF=$(stub_name "repos/$REPO/contents/memory/topics/p/orders/build-it.md?ref=main")

dlp_accepts() { # dir -> 0 when dev-loop-proof.sh verify accepts
  GH_STUB_DIR=$1 GITHUB_REPOSITORY=$REPO bash "$DLP" verify "$TARGET" "$SHA" >"$1/dlp.out" 2>"$1/dlp.err"
}

matrix() { # name, accept|reject, mutation
  local name=$1 want=$2 mutation=$3 d=$WORK/m_$1 got=reject
  base "$d"
  eval "$mutation"
  sync_comments "$d"
  if dlp_accepts "$d"; then got=accept; fi
  if [ "$got" = "$want" ]; then
    ok "matrix $name -> $want"
  else
    bad "matrix $name: want $want, got $got"
    [ ! -s "$d/dlp.err" ] || sed 's/^/       /' "$d/dlp.err" >&2
  fi
}

matrix faithful_verify_run accept ':'
matrix other_commands reject 'mutate "$d" "$RUN" ".display_title |= sub(\"$GOOD_HASH\"; \"$TRUE_HASH\")"'
matrix order_edited_on_default reject 'printf "VERIFY\n    go test ./...\n" > "$d/$ORDERF"'
matrix order_not_on_default reject 'mutate "$d" "$TREE" ".tree |= map(select(.path | test(\"orders\") | not))"'
matrix tree_truncated reject 'mutate "$d" "$TREE" ".truncated = true"'
matrix title_without_dispatch_id reject 'mutate "$d" "$RUN" ".display_title |= sub(\" verify-.*\$\"; \"\")"'
matrix title_other_sha reject 'mutate "$d" "$RUN" ".display_title |= sub(\"$SHA\"; \"$OLD\")"'
matrix modified_workflow reject 'mutate "$d" "$HEADWF" ".sha = \"blobevil\""'
matrix workflow_absent_at_head reject 'rm -f "${d:?}/${HEADWF:?}"'
matrix other_workflow reject 'mutate "$d" "$RUN" ".path = \".github/workflows/ci.yml\""'
matrix run_other_head reject 'mutate "$d" "$RUN" ".head_sha = \"$OLD\""'
matrix run_failed reject 'mutate "$d" "$RUN" ".conclusion = \"failure\""'
matrix run_in_progress reject 'mutate "$d" "$RUN" ".status = \"in_progress\" | .conclusion = null"'
matrix run_from_push reject 'mutate "$d" "$RUN" ".event = \"push\""'
matrix run_other_repo reject 'mutate "$d" "$RUN" ".repository.full_name = \"evil/widget\""'
matrix run_unreadable reject 'rm -f "${d:?}/${RUN:?}"'
matrix run_other_actor reject 'mutate "$d" "$RUN" ".actor.login = \"mallory\" | .triggering_actor.login = \"mallory\""'
matrix branch_not_epoch reject 'mutate "$d" "$PULL" ".head.ref = \"feature/x\""'
matrix branch_other_order reject 'mutate "$d" "$PULL" ".head.ref = \"epoch/other\""'
matrix fork_head reject 'mutate "$d" "$PULL" ".head.repo.full_name = \"evil/widget\""'
matrix receipt_older_sha reject 'mutate "$d" comments.json ".[1].body |= gsub(\"$SHA\"; \"$OLD\")"'
matrix receipt_duplicate reject 'mutate "$d" comments.json ". + [.[1]]"'
matrix receipt_from_stranger reject 'mutate "$d" comments.json ".[1].user.login = \"mallory\""'
matrix pr_head_moved reject 'mutate "$d" "$PULL" ".head.sha = \"$OLD\""'

# missing evidence: when scripts/epoch-evidence.sh is absent next to dev-loop-proof.sh,
# a verify-run receipt must fail closed with a clear reason, never fall back to accepting it.
d=$WORK/missing_evidence_script
base "$d"
sync_comments "$d"
tmp_evidence=$(mktemp)
mv "$EVIDENCE" "$tmp_evidence"
trap 'mv "$tmp_evidence" "$EVIDENCE"; rm -rf "${WORK:?}"' EXIT
if dlp_accepts "$d"; then
  bad "missing epoch-evidence.sh unexpectedly accepted"
else
  if grep -q 'epoch-evidence.sh is missing' "$d/dlp.err"; then
    ok "missing epoch-evidence.sh fails closed with a named reason"
  else
    bad "missing epoch-evidence.sh rejected for the wrong reason: $(cat "$d/dlp.err")"
  fi
fi
mv "$tmp_evidence" "$EVIDENCE"
trap 'rm -rf "${WORK:?}"' EXIT

# the dev-loop chain's original aeon-skill receipts (pre-dating verify-run) still parse and verify
printf '%s' "$(jq -cn --arg target "$TARGET" --arg sha "$SHA" \
  '{schema:1,target:$target,sha:$sha,kind:"aeon-skill",skill:"heartbeat",evidence_run_id:123456,evidence_url:("https://github.com/" + $target[0:($target|index("#"))] + "/actions/runs/123456"),verdict:"proven"}')" \
  > "$WORK/aeon-skill-receipt.json"
printf 'real heartbeat output captured\n<!-- aeon-proof:%s -->\n' "$(cat "$WORK/aeon-skill-receipt.json")" > "$WORK/aeon-skill.md"
if bash "$DLP" parse "$TARGET" "$SHA" "$WORK/aeon-skill.md" | jq -e '.kind == "aeon-skill" and .verdict == "proven"' >/dev/null 2>&1; then
  ok "pre-existing aeon-skill receipt kind still parses (no regression)"
else
  bad "pre-existing aeon-skill receipt kind regressed"
fi

printf '\n%s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]

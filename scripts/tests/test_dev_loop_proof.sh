#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECK="$ROOT/scripts/dev-loop-proof.sh"
WORKFLOW="$ROOT/.github/workflows/chain-runner.yml"
CONFIG="$ROOT/aeon.yml"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

TARGET=acme/demo#42
SHA=0123456789abcdef0123456789abcdef01234567
RUN_ID=123456
RUN_URL=https://github.com/acme/demo/actions/runs/$RUN_ID

receipt=$(jq -cn --arg target "$TARGET" --arg sha "$SHA" --arg url "$RUN_URL" \
  --argjson run_id "$RUN_ID" \
  '{schema:1,target:$target,sha:$sha,kind:"aeon-skill",skill:"heartbeat",evidence_run_id:$run_id,evidence_url:$url,verdict:"proven"}')
printf 'real heartbeat output captured\n<!-- aeon-proof:%s -->\n' "$receipt" > "$TMP/valid.md"
bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/valid.md" \
  | jq -e '.verdict == "proven" and .skill == "heartbeat" and .evidence_run_id == 123456' >/dev/null

bad_sha=ffffffffffffffffffffffffffffffffffffffff
bad=$(printf '%s' "$receipt" | jq -c --arg sha "$bad_sha" '.sha = $sha')
printf '<!-- aeon-proof:%s -->\n' "$bad" > "$TMP/stale.md"
if bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/stale.md"; then
  echo 'stale proof receipt unexpectedly passed' >&2
  exit 1
fi

bad=$(printf '%s' "$receipt" | jq -c '.evidence_url = "https://example.com/not-a-run"')
printf '<!-- aeon-proof:%s -->\n' "$bad" > "$TMP/bad-url.md"
if bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/bad-url.md"; then
  echo 'non-actions evidence url unexpectedly passed' >&2
  exit 1
fi

printf '<!-- aeon-proof:%s -->\n<!-- aeon-proof:%s -->\n' "$receipt" "$receipt" > "$TMP/duplicate.md"
if bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/duplicate.md"; then
  echo 'duplicate proof receipts unexpectedly passed' >&2
  exit 1
fi

review_line=$(grep -n 'dev-loop-review.sh verify "$FEATURE_PR" "$REVIEW_SHA"' "$WORKFLOW" | head -1 | cut -d: -f1)
repair_line=$(grep -n 'repair-target "$FEATURE_PR" "$REVIEW_SHA"' "$WORKFLOW" | head -1 | cut -d: -f1)
proof_line=$(grep -n 'dispatch_skill create-prove "$PROOF_VAR"' "$WORKFLOW" | head -1 | cut -d: -f1)
verify_line=$(grep -n 'dev-loop-proof.sh verify "$FEATURE_PR" "$PROOF_SHA"' "$WORKFLOW" | head -1 | cut -d: -f1)
success_line=$(grep -n 'CHAIN_STATUS=success' "$WORKFLOW" | head -1 | cut -d: -f1)
[ "$review_line" -lt "$repair_line" ]
[ "$repair_line" -lt "$proof_line" ]
[ "$proof_line" -lt "$verify_line" ]
[ "$verify_line" -lt "$success_line" ]
grep -Fq 'CHAIN_STATUS=proof-missing' "$WORKFLOW"
grep -Fq 'proof_run=${PROOF_RUN_ID:-none}' "$WORKFLOW"
grep -Fq 'PROOF_SHA="${REPAIRED_SHA:-$REVIEW_SHA}"' "$WORKFLOW"
checkout_block=$(sed -n '/name: Checkout repo/,/name: Configure git identity/p' "$ROOT/.github/workflows/aeon.yml")
commit_block=$(sed -n '/name: Commit results/,/name: Update cron state/p' "$ROOT/.github/workflows/aeon.yml")
printf '%s\n' "$checkout_block" | grep -Fq "if: steps.work.outputs.mode != ''"
if printf '%s\n' "$checkout_block" | grep -Fq "steps.skill.outputs.name != 'create-prove'"; then
  echo 'create-prove checkout is disabled' >&2
  exit 1
fi
printf '%s\n' "$commit_block" | grep -Fq "steps.skill.outputs.name != 'create-prove'"
printf '%s\n' "$commit_block" | grep -Fq "!startsWith(inputs.dispatch_id, 'prove-')"

# the commit-skip guard only engages if create-prove's own nested dispatch actually
# sets a matching-prefixed dispatch_id - a guard string alone proves nothing if the
# skill that's supposed to trigger it never does. static check, since create-prove
# is a prompt file with no runtime to execute here.
SKILL="$ROOT/skills/create-prove/SKILL.md"
if ! grep -Fq 'must start with the literal prefix `prove-`' "$SKILL"; then
  echo 'create-prove does not instruct setting a prove--prefixed dispatch_id' >&2
  exit 1
fi
if ! grep -Fq 'dispatch_id="prove-' "$SKILL"; then
  echo 'create-prove has no concrete prove--prefixed dispatch_id example' >&2
  exit 1
fi
if ! sed -n '/^  dev-loop:/,/^  # routine:/p' "$CONFIG" | grep -Fq 'max_dispatches: 5'; then
  echo 'dev-loop dispatch budget is not five' >&2
  exit 1
fi

echo 'dev-loop live proof tests passed'

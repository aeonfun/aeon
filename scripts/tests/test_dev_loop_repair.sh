#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECK="$ROOT/scripts/dev-loop-repair.sh"
WORKFLOW="$ROOT/.github/workflows/chain-runner.yml"
FEATURE="$ROOT/skills/feature/SKILL.md"
CONFIG="$ROOT/aeon.yml"
TMP=$(mktemp -d)
OLD=0123456789abcdef0123456789abcdef01234567
NEW=89abcdef0123456789abcdef0123456789abcdef

mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = api ] && [ "$2" = repos/acme/demo/pulls/42 ]; then
  printf '{"state":"%s","head":{"sha":"%s"}}\n' "${TEST_PR_STATE:-open}" "${TEST_HEAD_SHA:-0123456789abcdef0123456789abcdef01234567}"
  exit 0
fi
if [ "$1" = api ] && [ "$2" = --paginate ] && [ "$3" = --slurp ] && [[ "$4" == repos/acme/demo/commits/*/check-runs* ]]; then
  if [ -n "${TEST_CHECKS:-}" ]; then
    printf '%s\n' "$TEST_CHECKS"
  else
    printf '%s\n' '[{"total_count":1,"check_runs":[{"status":"completed","conclusion":"success"}]}]'
  fi
  exit 0
fi
exit 1
STUB
chmod +x "$TMP/bin/gh"

PATH="$TMP/bin:$PATH" bash "$CHECK" repair-target acme/demo#42 "$OLD" | grep -Fx "repair:acme/demo#42@$OLD"

if TEST_HEAD_SHA="$OLD" PATH="$TMP/bin:$PATH" bash "$CHECK" verify-change acme/demo#42 "$OLD"; then
  echo 'unchanged PR head unexpectedly passed' >&2
  exit 1
fi

TEST_HEAD_SHA="$NEW" PATH="$TMP/bin:$PATH" bash "$CHECK" verify-change acme/demo#42 "$OLD" | grep -Fx "$NEW"

TEST_HEAD_SHA="$NEW" PATH="$TMP/bin:$PATH" bash "$CHECK" verify-checks acme/demo#42 "$NEW" \
  | jq -e '.status == "passed" and .checks == 1 and .sha == "89abcdef0123456789abcdef0123456789abcdef"' >/dev/null

if TEST_HEAD_SHA="$NEW" TEST_CHECKS='[{"total_count":1,"check_runs":[{"status":"completed","conclusion":"failure"}]}]' \
  PATH="$TMP/bin:$PATH" bash "$CHECK" verify-checks acme/demo#42 "$NEW"; then
  echo 'failed check unexpectedly passed' >&2
  exit 1
fi

if TEST_HEAD_SHA="$NEW" TEST_CHECKS='[{"total_count":2,"check_runs":[{"status":"completed","conclusion":"neutral"},{"status":"completed","conclusion":"skipped"}]}]' \
  PATH="$TMP/bin:$PATH" bash "$CHECK" verify-checks acme/demo#42 "$NEW"; then
  echo 'neutral/skipped-only checks unexpectedly passed' >&2
  exit 1
fi

if TEST_HEAD_SHA="$NEW" TEST_CHECKS='[{"total_count":2,"check_runs":[{"status":"completed","conclusion":"success"}]}]' \
  PATH="$TMP/bin:$PATH" bash "$CHECK" verify-checks acme/demo#42 "$NEW"; then
  echo 'incomplete paginated check response unexpectedly passed' >&2
  exit 1
fi

if TEST_PR_STATE=closed PATH="$TMP/bin:$PATH" bash "$CHECK" repair-target acme/demo#42 "$OLD"; then
  echo 'closed PR unexpectedly produced a repair target' >&2
  exit 1
fi

# The workflow must derive repair authority from a verified actionable receipt,
# prove a new SHA, require checks, and only then dispatch the re-review.
receipt_line=$(grep -n 'dev-loop-review.sh verify "$FEATURE_PR" "$REVIEW_SHA"' "$WORKFLOW" | head -1 | cut -d: -f1)
repair_line=$(grep -n 'repair-target "$FEATURE_PR" "$REVIEW_SHA"' "$WORKFLOW" | head -1 | cut -d: -f1)
change_line=$(grep -n 'verify-change "$FEATURE_PR" "$REVIEW_SHA"' "$WORKFLOW" | head -1 | cut -d: -f1)
checks_line=$(grep -n 'verify-checks "$FEATURE_PR" "$REPAIRED_SHA"' "$WORKFLOW" | head -1 | cut -d: -f1)
rereview_line=$(grep -n 'REREVIEW_OUTPUT=$(dispatch_skill pr-review' "$WORKFLOW" | head -1 | cut -d: -f1)
[ "$receipt_line" -lt "$repair_line" ]
[ "$repair_line" -lt "$change_line" ]
[ "$change_line" -lt "$checks_line" ]
[ "$checks_line" -lt "$rereview_line" ]
grep -Fq '[ "$(jq -r '\''.actionable'\'' <<<"$REVIEW_RESULT")" = "true" ]' "$WORKFLOW"
if grep -Fq '${REVIEW_RESULT:-{}}' "$WORKFLOW"; then
  echo 'review result still uses the malformed brace fallback' >&2
  exit 1
fi
grep -Fq 'stopped after one repair pass: re-review remains actionable' "$WORKFLOW"
grep -A4 'if \[ "$CHAIN_FAILED" = "true" \]; then' "$WORKFLOW" | grep -Fq 'exit 1'
grep -Fq 'dev-loop-review.sh body "$FEATURE_PR" "$REVIEW_SHA"' "$WORKFLOW"
grep -Fq 'repair:<owner/repo#N>@<40-character-lowercase-sha>' "$FEATURE"
if ! sed -n '/^  dev-loop:/,/^  # routine:/p' "$CONFIG" | grep -Fq 'max_dispatches: 4'; then
  echo 'dev-loop dispatch budget is not exactly four (feature, review, repair, re-review)' >&2
  exit 1
fi

echo 'dev-loop repair gate tests passed'

#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECK="$ROOT/scripts/dev-loop-review.sh"
SKILL="$ROOT/skills/pr-review/SKILL.md"
TMP=$(mktemp -d)
SHA=0123456789abcdef0123456789abcdef01234567
TARGET=acme/demo#42

grep -Fq 'The captured final output must include the same `**Verdict**` line' "$SKILL"
grep -Fq 'notification gate uses the verdict line as its signal' "$SKILL"

write_body() {
  printf '%s\n' "$@" > "$TMP/body.md"
}

write_body \
  '**Verdict**: approve-ready — no blockers.' \
  '<!-- aeon-review:{"schema":1,"target":"acme/demo#42","sha":"0123456789abcdef0123456789abcdef01234567","verdict":"approve-ready","critical":0,"issues":0} -->'
jq -e '.verdict == "approve-ready" and .actionable == false' \
  <<<"$(bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/body.md")" >/dev/null

write_body \
  '**Verdict**: discussion-needed' \
  '- [ISSUE] src/cache.ts:19 — stale entries survive invalidation.' \
  '<!-- aeon-review:{"schema":1,"target":"acme/demo#42","sha":"0123456789abcdef0123456789abcdef01234567","verdict":"discussion-needed","critical":0,"issues":1} -->'
jq -e '.verdict == "discussion-needed" and .actionable == true and .issues == 1' \
  <<<"$(bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/body.md")" >/dev/null

write_body \
  '**Verdict**: blocked' \
  '- [CRITICAL] src/auth.ts:7 — requests bypass authorization.' \
  '- [ISSUE] src/auth.ts:30 — the error path loses context.' \
  '<!-- aeon-review:{"schema":1,"target":"acme/demo#42","sha":"0123456789abcdef0123456789abcdef01234567","verdict":"blocked","critical":1,"issues":1} -->'
jq -e '.verdict == "blocked" and .actionable == true and .critical == 1' \
  <<<"$(bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/body.md")" >/dev/null

# Existing prose-only reviews are deliberately not accepted as routing evidence.
write_body '**Verdict**: discussion-needed' '- [ISSUE] src/a.ts:1 — broken.'
if bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/body.md"; then
  echo 'unmarked review unexpectedly verified' >&2
  exit 1
fi

# The receipt cannot claim fewer findings than the posted review contains.
write_body \
  '**Verdict**: discussion-needed' \
  '- [ISSUE] src/a.ts:1 — first.' \
  '- [ISSUE] src/b.ts:2 — second.' \
  '<!-- aeon-review:{"schema":1,"target":"acme/demo#42","sha":"0123456789abcdef0123456789abcdef01234567","verdict":"discussion-needed","critical":0,"issues":1} -->'
if bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/body.md"; then
  echo 'mismatched finding count unexpectedly verified' >&2
  exit 1
fi

# One valid receipt plus any second malformed marker is still ambiguous.
write_body \
  '**Verdict**: approve-ready — no blockers.' \
  '<!-- aeon-review:{"schema":1,"target":"acme/demo#42","sha":"0123456789abcdef0123456789abcdef01234567","verdict":"approve-ready","critical":0,"issues":0} -->' \
  '<!-- aeon-review:not-json -->'
if bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/body.md"; then
  echo 'valid receipt plus malformed marker unexpectedly verified' >&2
  exit 1
fi

# A valid receipt for a different commit cannot authorize work on this SHA.
write_body '<!-- aeon-review:{"schema":1,"target":"acme/demo#42","sha":"ffffffffffffffffffffffffffffffffffffffff","verdict":"approve-ready","critical":0,"issues":0} -->'
if bash "$CHECK" parse "$TARGET" "$SHA" "$TMP/body.md"; then
  echo 'wrong-sha review unexpectedly verified' >&2
  exit 1
fi

# Verify reads the authenticated actor's review at the expected GitHub commit.
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'STUB'
#!/usr/bin/env bash
if [ "$1 $2" = 'api user' ]; then
  printf '%s\n' aeonframework
  exit 0
fi
if [ "$1" = api ] && [ "$2" = 'repos/acme/demo/pulls/42' ]; then
  printf '%s\n' "${TEST_HEAD_SHA:-0123456789abcdef0123456789abcdef01234567}"
  exit 0
fi
if [ "$1" = api ] && [ "$2" = 'repos/acme/demo/pulls/42/reviews' ]; then
  printf '%s\n' '[{"user":{"login":"someone-else"},"commit_id":"0123456789abcdef0123456789abcdef01234567","body":"<!-- aeon-review:{\"schema\":1,\"target\":\"acme/demo#42\",\"sha\":\"0123456789abcdef0123456789abcdef01234567\",\"verdict\":\"blocked\",\"critical\":1,\"issues\":0} -->"},{"user":{"login":"aeonframework"},"commit_id":"0123456789abcdef0123456789abcdef01234567","body":"**Verdict**: discussion-needed\n- [ISSUE] src/cache.ts:19 — stale entries survive invalidation.\n<!-- aeon-review:{\"schema\":1,\"target\":\"acme/demo#42\",\"sha\":\"0123456789abcdef0123456789abcdef01234567\",\"verdict\":\"discussion-needed\",\"critical\":0,\"issues\":1} -->"}]'
  exit 0
fi
exit 1
STUB
chmod +x "$TMP/bin/gh"
jq -e '.verdict == "discussion-needed" and .actionable == true' \
  <<<"$(PATH="$TMP/bin:$PATH" bash "$CHECK" verify "$TARGET" "$SHA")" >/dev/null
PATH="$TMP/bin:$PATH" bash "$CHECK" body "$TARGET" "$SHA" > "$TMP/verified-body.md"
grep -Fq -- '- [ISSUE] src/cache.ts:19 — stale entries survive invalidation.' "$TMP/verified-body.md"
grep -Fq '<!-- aeon-review:{"schema":1,"target":"acme/demo#42"' "$TMP/verified-body.md"

if TEST_HEAD_SHA=ffffffffffffffffffffffffffffffffffffffff \
  PATH="$TMP/bin:$PATH" bash "$CHECK" verify "$TARGET" "$SHA"; then
  echo 'review unexpectedly verified after PR head changed' >&2
  exit 1
fi

echo 'dev-loop review contract tests passed'

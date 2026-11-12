#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# The fake curl reads its settings from $HOME (secretcurl strips curl's env).
mkdir -p "$tmp/h503" "$tmp/h401"
state="$tmp/h503/fake-curl-state"
response="$tmp/response.json"

PATH="$PWD/scripts/tests/fixtures:$PATH" \
HOME="$tmp/h503" \
  ./scripts/secretcurl.sh -s -o "$response" -w '%{http_code}' \
    --max-time 1 -X POST "https://api.x.ai/v1/responses" \
    -H 'Authorization: Bearer {XAI_API_KEY}' -d @/dev/null \
    >"$tmp/http" 2>"$tmp/diag"

[ "$(cat "$state")" = 2 ] || { echo "FAIL - expected two attempts"; exit 1; }
[ "$(cat "$tmp/http")" = 200 ] || { echo "FAIL - expected final HTTP 200"; exit 1; }
grep -q '"text":"ok"' "$response" || { echo "FAIL - final response was not retained"; exit 1; }
grep -q 'attempt=1/3 http=503 .*reason=http-503' "$tmp/diag" || { echo "FAIL - missing first-attempt diagnostic"; exit 1; }
grep -q 'attempt=2/3 http=200 .*reason=ok' "$tmp/diag" || { echo "FAIL - missing success diagnostic"; exit 1; }
echo 'PASS - xai retries transient HTTP 503'

state401="$tmp/h401/fake-curl-state"
response401="$tmp/response401.json"
printf '401' > "$tmp/h401/fake-curl-http"
PATH="$PWD/scripts/tests/fixtures:$PATH" \
HOME="$tmp/h401" \
  ./scripts/secretcurl.sh -s -o "$response401" -w '%{http_code}' \
    --max-time 1 -X POST "https://api.x.ai/v1/responses" \
    -H 'Authorization: Bearer {XAI_API_KEY}' -d @/dev/null \
    >"$tmp/http401" 2>"$tmp/diag401"

[ "$(cat "$state401")" = 1 ] || { echo "FAIL - 401 should not retry"; exit 1; }
[ "$(cat "$tmp/http401")" = 401 ] || { echo "FAIL - expected HTTP 401"; exit 1; }
grep -q 'attempt=1/3 http=401 .*reason=http-401' "$tmp/diag401" || { echo "FAIL - missing 401 diagnostic"; exit 1; }
if grep -q 'attempt=2/' "$tmp/diag401"; then echo "FAIL - 401 retried"; exit 1; fi
echo 'PASS - xai does not retry HTTP 401'

# A body piped in on stdin (jq -n ... | ./secretcurl ... --data-binary @-, the
# shape skills use because a redirect into a file is refused) must reach every
# attempt, not just the first: stdin can be read only once.
mkdir -p "$tmp/hpipe"
body='{"model":"grok-4.7","input":[{"role":"user","content":"piped body"}]}'
printf '%s\n' "$body" | PATH="$PWD/scripts/tests/fixtures:$PATH" HOME="$tmp/hpipe" \
  ./scripts/secretcurl.sh -s -o "$tmp/responsepipe.json" -w '%{http_code}' \
    --max-time 1 -X POST "https://api.x.ai/v1/responses" \
    -H 'Authorization: Bearer {XAI_API_KEY}' --data-binary @- \
    >"$tmp/httppipe" 2>"$tmp/diagpipe"
[ "$(cat "$tmp/hpipe/fake-curl-state")" = 2 ] || { echo "FAIL - piped body: expected two attempts"; exit 1; }
[ "$(cat "$tmp/httppipe")" = 200 ] || { echo "FAIL - piped body: expected final HTTP 200"; exit 1; }
[ "$(sed -n 1p "$tmp/hpipe/fake-curl-bodies")" = "$body" ] || { echo "FAIL - piped body: first attempt body"; exit 1; }
[ "$(sed -n 2p "$tmp/hpipe/fake-curl-bodies")" = "$body" ] || { echo "FAIL - piped body: retry lost the stdin body"; exit 1; }
echo 'PASS - xai retry resends a body piped on stdin'
echo 'ALL PASS - xai retries 5xx, not 4xx, and keeps a piped body'

#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
printf 'score this output' > "$TMP/prompt"

cat > "$TMP/bin/hermes" <<'SH'
#!/usr/bin/env bash
# argv: --usage-file <path> -z <prompt> [...]
usage="$2"; prompt="$4"
printf '%s' "$prompt" > "$(dirname "$usage")/seen-prompt"
case "${HERMES_STUB_MODE:-ok}" in
  api-error)
    printf '%s\n' 'HTTP 400: modelCode: does not exist'
    exit 0 ;;
  quotes-http)
    # A real multi-line answer that QUOTES an HTTP error, with billed tokens.
    printf '{"input_tokens":120,"output_tokens":45}' > "$usage"
    printf '%s\n' 'Endpoint audit:' '- /v1/old returned HTTP 404: Not Found' '- /v1/new is healthy'
    exit 0 ;;
esac
printf '%s\n' 'usable hermes result'
SH
chmod +x "$TMP/bin/hermes"

run_adapter() {
  local mode=$1
  mkdir -p "$TMP/$mode"
  HERMES_STUB_MODE="$mode" \
    PATH="$TMP/bin:$PATH" \
    RH_LIB="$ROOT/harness-adapter/lib" \
    RH_TMPDIR="$TMP/$mode" \
    RH_PROMPT_FILE="$TMP/prompt" \
    RH_MODE=read-only \
    bash "$ROOT/harness-adapter/adapters/hermes.sh"
}

normal=$(run_adapter ok)
[ "$(jq -r '.result' <<<"$normal")" = 'usable hermes result' ] || {
  echo 'normal hermes output was not preserved' >&2
  exit 1
}

set +e
error=$(run_adapter api-error 2>&1)
rc=$?
set -e
[ "$rc" -eq 1 ] || { echo "hermes HTTP error returned rc=$rc, want 1" >&2; exit 1; }
grep -Fq 'hermes API error: HTTP 400: modelCode: does not exist' <<<"$error" || {
  echo "hermes HTTP error diagnostic missing: $error" >&2
  exit 1
}

# A real answer that merely quotes "HTTP 404:" (with billed output tokens) is
# delivered, not failed as an API error.
quoted=$(run_adapter quotes-http)
jq -e '.result | contains("returned HTTP 404: Not Found")' <<<"$quoted" >/dev/null || {
  echo 'hermes answer quoting an HTTP error was rejected' >&2
  exit 1
}

# The compat-rules prefix is joined to the prompt with REAL newlines, not a
# literal backslash-n pair.
mkdir -p "$TMP/prefix"
HERMES_STUB_MODE=ok PATH="$TMP/bin:$PATH" RH_LIB="$ROOT/harness-adapter/lib" \
  RH_TMPDIR="$TMP/prefix" RH_PROMPT_FILE="$TMP/prompt" RH_MODE=read-only \
  RH_COMPAT_RULES='- rule one' bash "$ROOT/harness-adapter/adapters/hermes.sh" >/dev/null
[ "$(cat "$TMP/prefix/seen-prompt")" = "$(printf -- '- rule one\n\nscore this output')" ] || {
  echo "hermes prompt prefix not newline-joined: $(cat "$TMP/prefix/seen-prompt")" >&2
  exit 1
}

echo 'hermes adapter error tests passed'

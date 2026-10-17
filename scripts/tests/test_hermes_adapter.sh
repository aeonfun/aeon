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

# OpenRouter mode stages aeon's app attribution as model.default_headers in the
# scratch HOME (hermes would otherwise send its own); a Nous login stages none.
cat > "$TMP/bin/hermes" <<'SH'
#!/usr/bin/env bash
cp "$HOME/.hermes/config.yaml" "$(dirname "$2")/seen-config" 2>/dev/null || true
printf '%s\n' 'usable hermes result'
SH
mkdir -p "$TMP/or"
OPENROUTER_API_KEY=sk-or-test PATH="$TMP/bin:$PATH" RH_LIB="$ROOT/harness-adapter/lib" \
  RH_TMPDIR="$TMP/or" RH_PROMPT_FILE="$TMP/prompt" bash "$ROOT/harness-adapter/adapters/hermes.sh" >/dev/null
want=$(printf '%s\n' 'model:' '  default_headers:' '    "HTTP-Referer": "https://www.aeon.fun"' \
  '    "X-OpenRouter-Title": "Aeon"' '    "X-Title": "Aeon"' '    "X-OpenRouter-Categories": "personal-agent,cloud-agent"')
[ "$(cat "$TMP/or/seen-config" 2>/dev/null)" = "$want" ] || {
  echo "hermes OpenRouter attribution config wrong: $(cat "$TMP/or/seen-config" 2>/dev/null)" >&2
  exit 1
}
if command -v python3 >/dev/null 2>&1 && python3 -c 'import yaml' 2>/dev/null; then
  python3 -c 'import sys, yaml; h = yaml.safe_load(open(sys.argv[1]))["model"]["default_headers"]; sys.exit(h["X-OpenRouter-Title"] != "Aeon")' \
    "$TMP/or/seen-config" || { echo 'hermes attribution config is not valid YAML' >&2; exit 1; }
fi
mkdir -p "$TMP/nous"
OPENROUTER_API_KEY=sk-or-test HERMES_AUTH="$(tar czf - -C "$TMP" prompt | base64)" PATH="$TMP/bin:$PATH" \
  RH_LIB="$ROOT/harness-adapter/lib" RH_TMPDIR="$TMP/nous" RH_PROMPT_FILE="$TMP/prompt" \
  bash "$ROOT/harness-adapter/adapters/hermes.sh" >/dev/null
[ ! -e "$TMP/nous/seen-config" ] || { echo 'hermes Nous login got OpenRouter attribution headers' >&2; exit 1; }

echo 'hermes adapter error tests passed'

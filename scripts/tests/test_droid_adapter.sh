#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"

# A fake `droid` that records its argv and stdin, then emits a valid JSON result
# (the real shape: type, result, usage, session_id, is_error).
cat > "$TMP/bin/droid" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$DROID_ARGS"
printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"ok","usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":0,"cache_creation_input_tokens":0},"session_id":"droid-test"}'
SH
chmod +x "$TMP/bin/droid"
printf 'inspect this workspace' > "$TMP/prompt"

run_adapter() {
  local mode=$1
  DROID_ARGS="$TMP/$mode.args" \
    PATH="$TMP/bin:$PATH" \
    RH_LIB="$ROOT/harness-adapter/lib" \
    RH_TMPDIR="$TMP/$mode-tmp" \
    RH_PROMPT_FILE="$TMP/prompt" \
    RH_MODE="$mode" \
    bash "$ROOT/harness-adapter/adapters/droid.sh" >/dev/null
}

mkdir -p "$TMP/read-only-tmp" "$TMP/write-tmp"
run_adapter read-only
# read-only mode must NOT pass --auto (the default is read-only)
if grep -qx -- '--auto' "$TMP/read-only.args"; then
  echo 'read-only droid run unexpectedly received --auto' >&2
  exit 1
fi
# read-only must still pass -o json and -f <promptfile> (each is a separate arg)
grep -qx -- '-o' "$TMP/read-only.args" || { echo 'read-only droid run omitted -o' >&2; exit 1; }
grep -qx -- 'json' "$TMP/read-only.args" || { echo 'read-only droid run omitted json format' >&2; exit 1; }
grep -qx -- '-f' "$TMP/read-only.args" || { echo 'read-only droid run omitted -f' >&2; exit 1; }

run_adapter write
grep -qx -- '--auto' "$TMP/write.args" || { echo 'write droid run omitted --auto' >&2; exit 1; }
grep -qx -- 'high' "$TMP/write.args" || { echo 'write droid run omitted high' >&2; exit 1; }
grep -qx -- '-o' "$TMP/write.args" || { echo 'write droid run omitted -o' >&2; exit 1; }

# The compat-rules prefix is joined to the prompt with REAL newlines, written to
# a temp file that -f reads (not the original RH_PROMPT_FILE).
mkdir -p "$TMP/prefix-tmp"
DROID_ARGS="$TMP/prefix.args" PATH="$TMP/bin:$PATH" RH_LIB="$ROOT/harness-adapter/lib" \
  RH_TMPDIR="$TMP/prefix-tmp" RH_PROMPT_FILE="$TMP/prompt" RH_MODE=write \
  RH_COMPAT_RULES='- rule one' bash "$ROOT/harness-adapter/adapters/droid.sh" >/dev/null
PROMPT_FILE="$TMP/prefix-tmp/droid-prompt.txt"
[ -f "$PROMPT_FILE" ] || { echo "droid prompt temp file not created" >&2; exit 1; }
[ "$(cat "$PROMPT_FILE")" = "$(printf -- '- rule one\n\ninspect this workspace')" ] || {
  echo "droid prompt prefix not newline-joined: $(cat "$PROMPT_FILE")" >&2
  exit 1
}

# is_error: true in a 0-exit result must fail the run, not be emitted as success.
cat > "$TMP/bin/droid" <<'SH'
#!/usr/bin/env bash
printf '%s\n' '{"type":"result","subtype":"failure","is_error":true,"result":"Authentication failed.","usage":{},"session_id":"err"}'
SH
chmod +x "$TMP/bin/droid"
mkdir -p "$TMP/error-tmp"
if DROID_ARGS="$TMP/error.args" PATH="$TMP/bin:$PATH" RH_LIB="$ROOT/harness-adapter/lib" \
  RH_TMPDIR="$TMP/error-tmp" RH_PROMPT_FILE="$TMP/prompt" RH_MODE=write \
  bash "$ROOT/harness-adapter/adapters/droid.sh" 2>/dev/null; then
  echo 'droid is_error:true should have exited non-zero' >&2
  exit 1
fi

echo 'droid adapter tests passed'

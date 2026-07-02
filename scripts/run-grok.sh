#!/usr/bin/env bash
# run-grok.sh — run one Aeon skill through the Grok Build (`grok`) harness.
#
# This is the Grok counterpart to the inline `claude -p -` call in
# .github/workflows/aeon.yml. It is invoked ONLY when the resolved harness for a
# run is `grok` (harness: grok in aeon.yml, per-skill, or the workflow_dispatch
# input). The default harness is still `claude`, whose path is untouched.
#
# Contract (so the rest of the pipeline is harness-agnostic):
#   stdin   — the fully-built prompt (same prompt the claude path pipes in)
#   stdout  — a NORMALIZED JSON envelope, byte-identical in shape to Claude
#             Code's `--output-format json`, so aeon.yml's downstream jq
#             (.result, .usage.input_tokens, …) works unchanged:
#               { "result": "<text>",
#                 "usage": { "input_tokens": N, "output_tokens": N,
#                            "cache_read_input_tokens": N,
#                            "cache_creation_input_tokens": N } }
#   stderr  — all diagnostics / notices (never mixed into stdout)
#   exit    — 0 on success, non-zero on any grok failure (caller falls to error)
#
# Inputs from the environment:
#   MODEL                 resolved model id (default grok-build-0.1)
#   SKILL_MODE            read-only | write (maps to grok --allow/--deny/--sandbox
#                         via scripts/skill_mode.sh grok-args)
#   XAI_API_KEY           xAI API key auth (CI-friendly; the simple path)
#   GROK_CREDENTIALS      base64 of the X-account OAuth session captured by the
#                         dashboard (a tar rooted at $HOME, or a single cred file)
#   GROK_CREDENTIALS_PATH single-file restore target (default ~/.grok/credentials.json)
#   GROK_CLI_VERSION      npm pin override (default below)
#
# Sandbox note: grok's own network calls (to api.x.ai / auth.x.ai) go out from
# this step, which the Actions sandbox permits for the CLI itself. Auth material
# is either an env var (XAI_API_KEY) or restored from a repo secret — never
# fetched at run time.

set -uo pipefail   # NOT -e: we capture grok's exit code and output explicitly.

# --- pin (single source of truth for the grok CLI version) ------------------
# Keep this current the same way aeon.yml/messages.yml pin the claude CLI.
GROK_CLI_VERSION="${GROK_CLI_VERSION:-0.2.81}"

log() { echo "$@" >&2; }

# --- 1. ensure the CLI ------------------------------------------------------
if ! command -v grok >/dev/null 2>&1; then
  log "::notice::grok CLI not found — installing @xai-official/grok@${GROK_CLI_VERSION}"
  if ! npm install -g "@xai-official/grok@${GROK_CLI_VERSION}" >&2; then
    log "::error::failed to install @xai-official/grok@${GROK_CLI_VERSION}"
    exit 1
  fi
fi

# --- 2. auth ----------------------------------------------------------------
# Prefer the captured X-account OAuth session; fall back to an API key. One of
# the two must be present, or grok would block on an interactive login prompt.
GROK_HOME="${HOME}/.grok"
if [ -n "${GROK_CREDENTIALS:-}" ]; then
  mkdir -p "$GROK_HOME"; chmod 700 "$GROK_HOME" 2>/dev/null || true
  tmp_creds="$(mktemp)"
  printf '%s' "$GROK_CREDENTIALS" | base64 -d > "$tmp_creds" 2>/dev/null || {
    log "::error::GROK_CREDENTIALS is not valid base64"; rm -f "$tmp_creds"; exit 1; }
  # The dashboard captures the session as a tar rooted at $HOME (robust to the
  # exact cred filename); if it isn't a tar, treat it as a single cred file.
  if tar tzf "$tmp_creds" >/dev/null 2>&1; then
    tar xzf "$tmp_creds" -C "$HOME" >&2 || { log "::error::failed to extract GROK_CREDENTIALS"; rm -f "$tmp_creds"; exit 1; }
    log "::notice::restored grok OAuth session from GROK_CREDENTIALS (archive)"
  else
    dest="${GROK_CREDENTIALS_PATH:-$GROK_HOME/credentials.json}"
    mkdir -p "$(dirname "$dest")"
    cp "$tmp_creds" "$dest"; chmod 600 "$dest" 2>/dev/null || true
    log "::notice::restored grok OAuth session from GROK_CREDENTIALS to ${dest}"
  fi
  rm -f "$tmp_creds"
elif [ -n "${XAI_API_KEY:-}" ]; then
  export XAI_API_KEY
  log "::notice::authenticating grok with XAI_API_KEY"
else
  log "::error::grok harness needs auth: set GROK_CREDENTIALS (X-account login via the dashboard) or XAI_API_KEY"
  exit 1
fi

# --- 3. permission flags (mode → grok grammar) ------------------------------
MODEL="${MODEL:-grok-build-0.1}"
SKILL_MODE="${SKILL_MODE:-write}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# One argv token per line → array. Plain while-read (not `mapfile`) so this runs
# on bash 3.2 (macOS) as well as CI's bash 5.
GROK_ARGS=()
if [ -f "$SCRIPT_DIR/skill_mode.sh" ]; then
  while IFS= read -r _tok; do GROK_ARGS+=("$_tok"); done < <(bash "$SCRIPT_DIR/skill_mode.sh" grok-args "$SKILL_MODE")
fi

# v1: MCP is not yet wired for the grok harness (config-schema translation is a
# fast-follow). Don't silently pretend it's on — say so and continue.
if [ -f .mcp.json ] && jq -e '.mcpServers' .mcp.json >/dev/null 2>&1; then
  log "::notice::.mcp.json present but MCP is not yet supported on the grok harness — skipping MCP for this run"
fi

# --- 4. run -----------------------------------------------------------------
PROMPT="$(cat)"
out_file="$(mktemp)"; err_file="$(mktemp)"
# Guard the array expansion for the (unexpected) empty case under bash 3.2 set -u.
grok -p "$PROMPT" \
  --model "$MODEL" \
  --output-format json \
  --no-auto-update \
  ${GROK_ARGS[@]+"${GROK_ARGS[@]}"} >"$out_file" 2>"$err_file"
rc=$?
# Surface grok's own diagnostics into the step log regardless of outcome.
cat "$err_file" >&2
if [ $rc -ne 0 ]; then
  log "::error::grok exited $rc"
  rm -f "$out_file" "$err_file"
  exit $rc
fi

# --- 5. normalize output ----------------------------------------------------
# Map grok's --output-format json onto the envelope the pipeline expects. Grok's
# exact field names are still being confirmed, so we accept the common aliases
# and, if the output isn't the JSON we expect, fall back to wrapping the raw text
# as .result with zeroed usage (never break the run on a shape mismatch).
NORMALIZE='
  (.result // .text // .output // .response // .content // .message // "") as $r
  | (.usage // .usageMetadata // {}) as $u
  | {
      result: (if ($r|type)=="string" then $r
               elif ($r|type)=="array" then ([$r[]? | (.text // (.|tostring))] | join(""))
               else ($r|tostring) end),
      usage: {
        input_tokens: (($u.input_tokens // $u.prompt_tokens // $u.inputTokens // $u.promptTokenCount // 0) | floor),
        output_tokens: (($u.output_tokens // $u.completion_tokens // $u.outputTokens // $u.candidatesTokenCount // 0) | floor),
        cache_read_input_tokens: (($u.cache_read_input_tokens // $u.cache_read // $u.cachedContentTokenCount // 0) | floor),
        cache_creation_input_tokens: (($u.cache_creation_input_tokens // $u.cache_creation // 0) | floor)
      }
    }'
# Use the normalized envelope only if it parsed AND actually recovered text;
# otherwise wrap grok's raw stdout so a shape mismatch never looks like "no
# output". (An empty envelope on genuinely-empty output is fine — the fallback
# then wraps the empty string, same result.)
ENVELOPE=""
if ENVELOPE=$(jq -ce "$NORMALIZE" "$out_file" 2>/dev/null) \
   && [ -n "$ENVELOPE" ] \
   && [ -n "$(printf '%s' "$ENVELOPE" | jq -r '.result')" ]; then
  printf '%s\n' "$ENVELOPE"
else
  log "::warning::grok output was not the expected JSON shape (or had no recoverable text) — wrapping raw stdout (verify grok --output-format json fields)"
  jq -Rsc '{result: ., usage: {input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0}}' "$out_file"
fi
rm -f "$out_file" "$err_file"

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
GROK_CLI_VERSION="${GROK_CLI_VERSION:-0.2.82}"

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
  # The dashboard captures the session as a tar rooted at $HOME (contains
  # .grok/auth.json — the confirmed credential file); if it isn't a tar, treat
  # it as the raw auth.json.
  if tar tzf "$tmp_creds" >/dev/null 2>&1; then
    tar xzf "$tmp_creds" -C "$HOME" >&2 || { log "::error::failed to extract GROK_CREDENTIALS"; rm -f "$tmp_creds"; exit 1; }
    log "::notice::restored grok OAuth session from GROK_CREDENTIALS (archive)"
  else
    dest="${GROK_CREDENTIALS_PATH:-$GROK_HOME/auth.json}"
    mkdir -p "$(dirname "$dest")"
    cp "$tmp_creds" "$dest"; chmod 600 "$dest" 2>/dev/null || true
    log "::notice::restored grok OAuth session from GROK_CREDENTIALS to ${dest}"
  fi
  rm -f "$tmp_creds"
elif [ -n "${XAI_API_KEY:-}" ]; then
  export XAI_API_KEY
  log "::notice::authenticating grok with XAI_API_KEY"
elif [ -f "$GROK_HOME/auth.json" ]; then
  # Already signed in on this machine (local run / mcp-server path) — use it.
  log "::notice::using existing grok session at $GROK_HOME/auth.json"
else
  log "::error::grok harness needs auth: set GROK_CREDENTIALS (X-account login via the dashboard) or XAI_API_KEY, or run 'grok login'"
  exit 1
fi

# --- 3. model + permission flags --------------------------------------------
# Only pass --model for a real grok model id; for an empty value or a leftover
# claude-* id (harness switched but model not), OMIT it so grok uses its own
# current default (e.g. grok-composer-2.5-fast) rather than a hardcoded id.
MODEL="${MODEL:-}"
SKILL_MODE="${SKILL_MODE:-write}"
MODEL_FLAG=()
case "$MODEL" in
  ""|default|claude-*) ;;                 # let grok pick its default model
  *)                   MODEL_FLAG=(--model "$MODEL") ;;
esac
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
# --no-subagents: a headless skill run is a single focused agent. The multi-agent
# models (grok-build) otherwise try to DELEGATE to parallel subagents, whose
# Task/spawn tool is not in our --permission-mode dontAsk allowlist — the denial
# aborts the whole turn (observed: grok-build → stopReason=Cancelled, empty text,
# ~18s). Disabling subagents keeps the model doing the work itself. Composer is
# single-agent already, so this is a no-op for it.
# Guard the array expansions for the empty case under bash 3.2 set -u.
grok -p "$PROMPT" \
  ${MODEL_FLAG[@]+"${MODEL_FLAG[@]}"} \
  --output-format json \
  --no-auto-update \
  --no-subagents \
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
# Map grok's --output-format json onto the envelope the pipeline expects.
# Confirmed shape (grok 0.2.82): {"text": "...", "stopReason", "sessionId",
# "requestId", "thought"} — the result is in .text and there is NO usage/token
# field, so token counts normalize to 0 (grok-harness runs report 0 tokens).
#
# CRITICAL: `.thought` is grok's internal chain-of-thought. It must NEVER become
# the skill result — downstream this gets committed to the repo, sent via
# ./notify, and fed into chains. So .result is built ONLY from recognized text
# fields, and a valid grok JSON object is NEVER dumped raw (which is how .thought
# previously leaked when .text was empty). Common aliases are kept for forward-
# compat; the raw-stdout fallback fires only for genuinely non-JSON output.
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

if jq -e 'type == "object"' "$out_file" >/dev/null 2>&1; then
  # A recognized grok JSON envelope. Build the normalized result (text fields
  # only — never .thought) and inspect how the turn ended.
  ENVELOPE=$(jq -ce "$NORMALIZE" "$out_file")
  RESULT_TEXT=$(printf '%s' "$ENVELOPE" | jq -r '.result // ""')
  STOP=$(jq -r '.stopReason // .stop_reason // ""' "$out_file")
  # grok exits 0 even when a run is Cancelled / aborted with no output. That is a
  # FAILED run, not an empty-but-successful one — surface it so the workflow's
  # grok-error path fires instead of committing/reporting an empty (or partial)
  # result. A clean EndTurn with empty text is legitimate (the skill did its work
  # via tool calls and wrote no final message) and passes through as result "".
  case "$STOP" in
    Cancelled|cancelled|Aborted|aborted|Interrupted|interrupted|Error|error|Failed|failed|Refusal|refusal)
      if [ -z "$RESULT_TEXT" ]; then
        log "::error::grok terminated abnormally (stopReason=$STOP) with no output — failing the run rather than emitting an empty/partial result"
        rm -f "$out_file" "$err_file"
        exit 3
      fi
      log "::warning::grok stopReason=$STOP — retaining partial output"
      ;;
  esac
  printf '%s\n' "$ENVELOPE"
else
  # Not a single JSON object: shape changed, plain-text output, or leading noise.
  # Wrap raw stdout so a mismatch never silently looks like "no output". (This
  # path only fires for non-JSON, so it can't leak a JSON object's .thought.)
  log "::warning::grok output was not a JSON object (expected --output-format json) — wrapping raw stdout; verify the grok CLI version/output format"
  jq -Rsc '{result: ., usage: {input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0}}' "$out_file"
fi
rm -f "$out_file" "$err_file"

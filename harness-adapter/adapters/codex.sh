#!/usr/bin/env bash
# codex adapter — OpenAI Codex CLI behind the Claude Code contract.
#
# Codex quirks this adapter absorbs:
#   * `codex exec --json` emits a JSONL EVENT STREAM, not a final result object
#     -> result comes from --output-last-message (belt) or the last
#        item.completed agent_message (braces); usage comes from turn.completed
#        (field names: input_tokens, cached_input_tokens, output_tokens), with
#        input_tokens normalized to exclude cache reads. No dollar-cost field exists.
#   * the stream never names the model (thread.started carries only thread_id)
#     -> read it from the session's rollout file (turn_context.payload.model).
#   * approval-needed actions are silently auto-denied headlessly (deny-and-
#     continue, like Claude) -> approval_policy=never, sandbox picked by mode.
#   * workspace-write blocks network by default -> we enable it (skills fetch).
#   * no project .mcp.json support -> translated to -c mcp_servers.* overrides.
#   * CLAUDE.md ignored by default -> added as an AGENTS.md fallback filename.
#   * no --max-turns -> the dispatcher's wall-clock timeout is the runaway guard.
#
# rh-meta-start - capability manifest source of truth (bin/generate-harnesses-json)
# {
#   "id": "codex",
#   "label": "OpenAI Codex CLI",
#   "cli": { "install": "npm i -g --ignore-scripts @openai/codex@0.159.3", "bin": "codex", "min_version": "0.159.3" },
#   "invoke": "codex exec --json -",
#   "round_trip": true,
#   "token_usage": "full",
#   "cost": false,
#   "read_only": "native",
#   "structured_output": "native",
#   "mcp": "native+inline-toml",
#   "max_turns": "timeout",
#   "claude_md": "fallback",
#   "default_model": "openai/gpt-6-luna",
#   "credentials": [
#     { "secret": "CODEX_AUTH", "kind": "oauth_capture", "auth_mode": "native-oauth", "label": "ChatGPT login (Plus/Pro)", "get_url": "https://chatgpt.com", "login_cmd": "codex login", "aeon_cmd": "./aeon auth --harness codex", "cred_paths": [".codex/auth.json"], "expires": "codex refreshes at run start but a rotated token is not saved back, so the capture eventually expires", "refresh": "re-run ./aeon auth --harness codex (or use an OpenAI key)" },
#     { "secret": "OPENAI_API_KEY", "kind": "api_key", "auth_mode": "native-key", "label": "OpenAI API key", "prefix": "sk-", "get_url": "https://platform.openai.com/api-keys", "aeon_cmd": "./aeon auth --harness codex --key <sk-...>" },
#     { "secret": "OPENROUTER_API_KEY", "kind": "api_key", "auth_mode": "openrouter", "label": "OpenRouter key (one key covers most harnesses)", "prefix": "sk-or-", "get_url": "https://openrouter.ai/settings/keys", "aeon_cmd": "./aeon secrets set OPENROUTER_API_KEY --stdin" }
#   ],
#   "native_control_path": "run-harness"
# }
# rh-meta-end
set -uo pipefail
. "$RH_LIB/envelope.sh"
. "$RH_LIB/mcp-translate.sh"

command -v codex >/dev/null 2>&1 || {
  echo "codex CLI not found (npm i -g @openai/codex)" >&2; exit 1; }

# --disable unbounded_connection_retries: codex 0.148+ retries an unreachable
# provider FOREVER ("Reconnecting... waiting for network", 5-60s backoff), so a
# gateway outage burned the whole dispatcher timeout. With the feature off it
# fails after 5 retries with turn.failed and a non-zero exit.
# No --ephemeral: the session's rollout file is the only place codex records the
# model it actually ran (see "model" below). It lands under $CODEX_HOME/sessions,
# the way claude -p keeps its transcript under ~/.claude; on a runner both go
# away with the job's home dir.
ARGS=(exec --json --skip-git-repo-check --disable unbounded_connection_retries)

# model: only pass ids codex can serve; a claude-*/grok-* leftover -> codex default.
# Kept apart from ARGS so a refused model can be dropped for one retry (below).
MODEL_ARGS=()
case "${RH_MODEL:-}" in
  "" | default | claude-* | grok-*) ;;
  *) MODEL_ARGS=(--model "$RH_MODEL") ;;
esac

# Sandbox. codex is the only harness with a native kernel sandbox, but its
# `--sandbox read-only` ALSO blocks the network: network_access lives under
# [sandbox_workspace_write] and applies to that mode only (`codex --help`: sandbox
# modes are read-only | workspace-write | danger-full-access), so there is no
# codex-native "FS-read-only + network" mode. aeon's read-only skills are
# overwhelmingly research skills that must fetch, so a network-less read-only mode
# cannot do the job it is for. (Measured on real runners 2026-07-22:
# gpt-5.1-codex-mini under `--sandbox read-only` hit `curl: (6) Could not resolve
# host: github.com` on every attempt including proxies; an earlier gpt-5-mini run
# that appeared to fetch had FABRICATED the result — the page is server-rendered.)
#
#   * read-only: run-harness wraps us in its bwrap/sandbox-exec OS sandbox, which
#     binds the workspace read-only but leaves the NETWORK OPEN (lib/sandbox.sh).
#     We turn codex's OWN sandbox OFF (danger-full-access) so the two don't nest —
#     an earlier attempt left codex's landlock ON inside bwrap and the two fought,
#     breaking codex's file access (it couldn't read its own SKILL.md). With the
#     self-sandbox off, that wrapper is the SOLE read-only enforcer, exactly how
#     pi/vibe/kimi run. (If a codex build rejects danger-full-access +
#     approval_policy=never together, swap in the single flag
#     --dangerously-bypass-approvals-and-sandbox, which drops both at once.)
#   * write: NOT bwrap-wrapped, so codex sandboxes itself. workspace-write blocks
#     network by default -> enable it (skills fetch).
if [ "${RH_MODE:-write}" = "read-only" ]; then
  ARGS+=(--sandbox danger-full-access)
else
  ARGS+=(--sandbox workspace-write -c 'sandbox_workspace_write.network_access=true')
  # aeon stages notifications outside the checkout so post-run delivery survives.
  [ -n "${AEON_PENDING_DIR:-}" ] && ARGS+=(--add-dir "$AEON_PENDING_DIR")
fi
ARGS+=(-c 'approval_policy="never"')
ARGS+=(-c 'project_doc_fallback_filenames=["CLAUDE.md"]')

# MCP translation (codex reads only its own config; see openai/codex#13056).
# CAVEAT (codex 0.144.5): this wires the server correctly — codex spawns it,
# completes the `initialize` handshake, and exposes mcp__<srv>__<tool> — but each
# MCP tool call raises an approval elicitation that, in `codex exec` (stdin
# closed), reads EOF and resolves as *cancel*, so the tool never runs headlessly.
# This is upstream openai/codex#24135 (OPEN): no config key suppresses it
# (approval_policy / default_tools_approval_mode / tools_require_approval /
# mcp_approval_policy / trusted_mcp_servers / trust_level all confirmed
# ineffective there). The only override, --dangerously-bypass-approvals-and-
# sandbox, also drops the sandbox. Revisit when #24135 lands.
MCP_ARGS=()
if [ -n "${RH_MCP_CONFIG:-}" ] && [ -f "${RH_MCP_CONFIG:-}" ]; then
  while IFS= read -r tok; do MCP_ARGS+=("$tok"); done < <(mcp_to_codex_flags "$RH_MCP_CONFIG")
fi

# structured output (native) — OpenAI's response_format runs in STRICT mode and
# 400s unless every object schema carries additionalProperties:false (verified
# live against codex 0.144.5). Claude-style schemas don't carry it; patch it in
# recursively. (Strict mode also wants all properties required — not auto-patched
# since that changes semantics; the API error is explicit if a schema hits it.)
if [ -n "${RH_JSON_SCHEMA:-}" ]; then
  jq -c 'walk(if type == "object" and (.type? == "object")
                 and (has("additionalProperties") | not)
              then . + {additionalProperties: false} else . end)' \
    <<<"$RH_JSON_SCHEMA" > "$RH_TMPDIR/schema.json" || {
      echo "invalid --json-schema (not valid JSON)" >&2; exit 2; }
  ARGS+=(--output-schema "$RH_TMPDIR/schema.json")
fi

[ -n "${RH_MAX_TURNS:-}" ] && \
  echo "notice: codex has no --max-turns; the dispatcher wall-clock timeout is the guard" >&2

LAST_MSG="$RH_TMPDIR/codex-last-message.txt"
ARGS+=(--output-last-message "$LAST_MSG")

# Compat preamble + operator append go into the PROMPT: codex's instruction-file
# knob (model_instructions_file) REPLACES its built-in instructions — too blunt.
PROMPT="$(cat "$RH_PROMPT_FILE")"
[ -n "${RH_APPEND_SYSTEM_PROMPT:-}" ] && PROMPT="${RH_APPEND_SYSTEM_PROMPT}

${PROMPT}"
[ -n "${RH_COMPAT_RULES:-}" ] && PROMPT="${RH_COMPAT_RULES}

${PROMPT}"

EVENTS="$RH_TMPDIR/codex-events.jsonl"
run_codex() {
  printf '%s' "$PROMPT" | codex "${ARGS[@]}" ${MODEL_ARGS[@]+"${MODEL_ARGS[@]}"} ${MCP_ARGS[@]+"${MCP_ARGS[@]}"} - > "$EVENTS"
}
run_codex
rc=$?
# A model the account cannot serve fails the turn before any work happens
# (ChatGPT login: "The 'gpt-5.6' model is not supported when using Codex with a
# ChatGPT account."; API key: "does not exist or you do not have access").
# Retry once on the account default instead of failing the run.
if [ $rc -ne 0 ] && [ ${#MODEL_ARGS[@]} -gt 0 ] \
  && grep -qE "model is not supported|does not exist or you do not have access|model_not_found" "$EVENTS" 2>/dev/null; then
  echo "::warning::codex refused model ${RH_MODEL//[^A-Za-z0-9._:\/@+-]/_}; retried on the account default" >&2
  MODEL_ARGS=()
  run_codex
  rc=$?
fi
if [ $rc -ne 0 ]; then
  # 300 chars silently discarded the actual error whenever it was longer
  # than that; widened to match claude.sh's own harness-adapter precedent.
  echo "codex exited $rc: $(tail -c 4000 "$EVENTS" | tr '\n' ' ')" >&2
  exit $rc
fi

# sanitize the stream (drop any non-JSON lines defensively), then normalize
CLEAN="$RH_TMPDIR/codex-events.clean.jsonl"
jq -cR 'fromjson? // empty' "$EVENTS" > "$CLEAN"

RESULT=""
[ -s "$LAST_MSG" ] && RESULT="$(cat "$LAST_MSG")"
if [ -z "$RESULT" ]; then
  RESULT=$(jq -rs '
    [.[] | select(.type == "item.completed") | (.item // {})
         | select(.type == "agent_message") | (.text // "")]
    | last // ""' "$CLEAN")
fi

FAILED=$(jq -s '[.[] | select(.type == "turn.failed" or .type == "error")] | length' "$CLEAN")
if [ "${FAILED:-0}" -gt 0 ] && [ -z "$RESULT" ]; then
  echo "codex run failed ($FAILED turn.failed/error event(s)) with no output" >&2
  exit 3
fi
[ "${FAILED:-0}" -gt 0 ] && echo "warning: codex reported $FAILED failed-turn/error event(s) — retaining output" >&2

# usage: map cached_input_tokens -> cache_read and cache_write_input_tokens ->
# cache_creation (codex has no cost field).
#   * turn.completed carries the THREAD's running total, not a per-turn delta
#     (codex-rs exec/src/event_processor_with_jsonl_output.rs usage_from_last_total
#     reads `usage.total`), and exec ends after its one turn. So take the last
#     event; summing would double-count if a build ever emitted two.
#   * codex's input_tokens is the Responses API figure, which INCLUDES the cached
#     tokens (codex-rs protocol/src/protocol.rs TokenUsage::non_cached_input is
#     `input_tokens - cached_input_tokens`). The contract follows Claude, whose
#     input_tokens excludes cache reads, so subtract them here. Without this a
#     heartbeat run recorded input 142972 next to cache_read 109312, counting the
#     cached 109k twice in token-usage.csv.
read -r TIN TOUT TCR TCW <<<"$(jq -rs '
  ([.[] | select(.type == "turn.completed") | (.usage // {})] | last // {}) as $u
  | ($u.input_tokens // 0) as $in | ($u.cached_input_tokens // 0) as $cr
  | [ ([$in - $cr, 0] | max), ($u.output_tokens // 0), $cr,
      ($u.cache_write_input_tokens // 0) ] | @tsv' "$CLEAN")"
SID=$(jq -rs '[.[] | select(.type == "thread.started") | (.thread_id // empty)] | first // ""' "$CLEAN")

# model: `codex exec --json` never names it (ThreadStartedEvent is only
# thread_id; codex-rs exec/src/exec_events.rs), and on a native ChatGPT login no
# --model is passed, so aeon used to record "codex-default". codex persists each
# turn's TurnContextItem, whose `model` field is the model it ran
# (codex-rs protocol/src/protocol.rs TurnContextItem), as a
# {"type":"turn_context","payload":{...}} line in
# $CODEX_HOME/sessions/YYYY/MM/DD/rollout-<ts>-<thread_id>.jsonl. Take the FIRST
# one (written before the agent acts) and keep only a model-id charset: the file
# sits in rw ~/.codex during the run, and this value ends up in workflow outputs.
MODEL_USED=""
if [ -n "$SID" ]; then
  ROLLOUT=$(find "${CODEX_HOME:-$HOME/.codex}/sessions" -type f -name "rollout-*${SID}*.jsonl" 2>/dev/null | head -1)
  if [ -n "$ROLLOUT" ]; then
    MODEL_USED=$(jq -rR 'fromjson? | select(.type == "turn_context") | .payload.model // empty' "$ROLLOUT" 2>/dev/null | head -1)
    case "$MODEL_USED" in
      *[!A-Za-z0-9._:/@+-]*) MODEL_USED="" ;;
    esac
    [ "${#MODEL_USED}" -le 100 ] || MODEL_USED=""
  fi
fi
[ -z "$MODEL_USED" ] && echo "notice: codex model not found in the session rollout; not reported" >&2

emit_envelope "$RESULT" "${TIN:-0}" "${TOUT:-0}" "${TCR:-0}" "${TCW:-0}" "" "$SID" "$MODEL_USED"

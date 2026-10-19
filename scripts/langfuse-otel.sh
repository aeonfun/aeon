#!/usr/bin/env bash
# langfuse-otel.sh — optional Langfuse observability for the Claude Code harness.
#
# SOURCED (not executed) right after scripts/llm-gateway.sh at every `claude -p`
# call site (aeon.yml Run cascade / scorer / feed-convert, messages.yml Run). It
# exports the OpenTelemetry env vars that make Claude Code stream the run as a
# trace to a Langfuse project: LLM requests (model, tokens, cost, latency), tool
# calls, and — when content logging is on — the prompts and responses themselves.
#
# OPT-IN + NO-OP. Does nothing unless BOTH LANGFUSE_PUBLIC_KEY and
# LANGFUSE_SECRET_KEY are set, i.e. "set a Langfuse token → traces just appear."
# It must NEVER `exit` or fail the caller — it only ever `return`s, so a bad
# config degrades to "no tracing", never a broken skill run.
#
# WHY TRACES (not metrics/logs): Langfuse's OTLP endpoint ingests spans only.
# Claude Code's span tree (claude_code.interaction → llm_request → tool) carries
# gen_ai.* semantic attributes that map cleanly onto Langfuse's LLM data model.
# Span export is a Claude Code beta (CLAUDE_CODE_ENHANCED_TELEMETRY_BETA); the
# metrics/logs signals are left disabled so nothing is shipped to an endpoint
# that would reject it. Langfuse takes OTLP over HTTP only — no gRPC.
#
# INPUTS (all optional except the two keys):
#   LANGFUSE_PUBLIC_KEY   pk-lf-...   required to activate
#   LANGFUSE_SECRET_KEY   sk-lf-...   required to activate
#   LANGFUSE_HOST         Langfuse base URL. Default https://cloud.langfuse.com
#                         (EU cloud). US cloud: https://us.cloud.langfuse.com.
#                         Self-hosted URLs work too. LANGFUSE_BASE_URL is an alias.
#   LANGFUSE_TRACING      set to 0/false/off/no to force-disable even with keys set.
#   LANGFUSE_LOG_CONTENT  1 (default) = capture prompts + responses + tool params.
#                         0 = metadata only (redact all content).
#                         all = additionally capture tool input/output bodies.
#   AEON_OTEL_COMPONENT   label for this call site (skill-run|scorer|feed|message);
#                         recorded in resource attributes. Default skill-run.
#
# NOTE: no `set -e/-u` here (sourced file — must not change the caller's shell
# opts), and the host step runs under `bash -e`, so use `if`, never a bare
# `[ … ] && …` as a trailing command. Mirrors scripts/llm-gateway.sh conventions.

# --- gate: both keys present, and not explicitly disabled -------------------
if [ -z "${LANGFUSE_PUBLIC_KEY:-}" ] || [ -z "${LANGFUSE_SECRET_KEY:-}" ]; then
  return 0 2>/dev/null || exit 0
fi
case "${LANGFUSE_TRACING:-}" in
  0|false|off|no|False|FALSE|Off|OFF|No|NO)
    echo "::notice::Langfuse tracing disabled via LANGFUSE_TRACING" >&2
    return 0 2>/dev/null || exit 0 ;;
esac

# --- resolve host + build Basic auth (base64 of public:secret) --------------
_lf_host="${LANGFUSE_HOST:-${LANGFUSE_BASE_URL:-https://cloud.langfuse.com}}"
_lf_host="${_lf_host%/}"
# tr -d '\n' keeps the header single-line across GNU (wraps at 76 cols) and BSD base64.
_lf_auth=$(printf '%s:%s' "$LANGFUSE_PUBLIC_KEY" "$LANGFUSE_SECRET_KEY" | base64 | tr -d '\n')

# --- Claude Code OpenTelemetry → Langfuse OTLP (traces only, HTTP) ----------
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1        # required for span/trace export
export OTEL_TRACES_EXPORTER=otlp
# Langfuse ingests OTLP over HTTP at <host>/api/public/otel; the OTEL SDK appends
# /v1/traces to this generic endpoint for the traces signal. Protobuf over HTTP —
# gRPC is unsupported by Langfuse, so pin the protocol explicitly.
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT="${_lf_host}/api/public/otel"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic ${_lf_auth},x-langfuse-ingestion-version=4"
# Short flush interval — headless `-p` runs are brief; batch export on a long
# interval could drop the final spans when the process exits.
export OTEL_TRACES_EXPORT_INTERVAL="${OTEL_TRACES_EXPORT_INTERVAL:-1000}"
# Keep metrics/logs off: Langfuse's OTLP endpoint rejects those signals.
export OTEL_METRICS_EXPORTER="${OTEL_METRICS_EXPORTER:-none}"
export OTEL_LOGS_EXPORTER="${OTEL_LOGS_EXPORTER:-none}"

# --- content capture (prompts / responses / tool details) -------------------
# Default ON — the whole point is to see the inference. `0` redacts everything;
# `all` also records full tool input/output bodies (can include command output,
# so it's opt-in). Tool *content* stays off by default even when content is on.
case "${LANGFUSE_LOG_CONTENT:-1}" in
  0|false|off|no|False|FALSE|Off|OFF|No|NO)
    : ;;  # metadata only — leave every OTEL_LOG_* unset (Claude Code redacts by default)
  all|full|ALL|FULL)
    export OTEL_LOG_USER_PROMPTS=1
    export OTEL_LOG_ASSISTANT_RESPONSES=1
    export OTEL_LOG_TOOL_DETAILS=1
    export OTEL_LOG_TOOL_CONTENT=1 ;;
  *)
    export OTEL_LOG_USER_PROMPTS=1
    export OTEL_LOG_ASSISTANT_RESPONSES=1
    export OTEL_LOG_TOOL_DETAILS=1 ;;
esac

# --- identity / grouping ----------------------------------------------------
# Resource attributes land in Langfuse (and are flattened onto each span, so the
# langfuse.* ones below take effect). Each `claude -p` process gets its OWN
# session.id (a per-process UUID), so a single Aeon run — the skill-run, the
# post-run scorer, and the feed convert — would otherwise fragment into separate
# Langfuse sessions. Pin langfuse.session.id to the GitHub run id so all of one
# run's components collapse into ONE session; langfuse.trace.name gives the trace
# a readable name instead of a blank one.
#
# Slicing handles (same values on the root span and usage rows run-harness sends):
#   environment  production on the default branch (cron and dispatches on main),
#                branch on any other branch (verify and probe runs), local outside
#                Actions, so test runs stay out of the production view.
#                LANGFUSE_TRACING_ENVIRONMENT overrides it. scripts/langfuse-score.sh
#                picks the same value for the scores.
#   userId       the skill (aeon:<component> when there is none), so the Users page
#                is a per-skill cost table. Wins over Claude Code's per-install user.id.
#   release      canon-<sha7> of the canon commit this instance was last synced to
#                (aeon-update's baseline_sha), else the short GITHUB_SHA. Not
#                GITHUB_SHA on an instance: every run auto-commits, so it changes
#                on nearly every run.
export OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-aeon}"
_lf_env="${LANGFUSE_TRACING_ENVIRONMENT:-}"
case "$_lf_env" in *[!a-z0-9_-]* | langfuse*) _lf_env="" ;; esac
if [ -z "$_lf_env" ]; then
  _lf_default=""
  if [ -f "${GITHUB_EVENT_PATH:-}" ] && command -v jq >/dev/null 2>&1; then
    _lf_default=$(jq -r '.repository.default_branch // empty | strings' "$GITHUB_EVENT_PATH" 2>/dev/null || true)
  fi
  if [ -z "${GITHUB_REF_NAME:-}" ]; then _lf_env=local
  elif [ "$GITHUB_REF_NAME" = "${_lf_default:-main}" ]; then _lf_env=production
  else _lf_env=branch; fi
fi
_lf_rel=""
_lf_state="${GITHUB_WORKSPACE:-.}/memory/topics/aeon-update-state.json"
if [ -f "$_lf_state" ] && command -v jq >/dev/null 2>&1; then
  _lf_rel=$(jq -r '.baseline_sha // empty | strings' "$_lf_state" 2>/dev/null | cut -c1-7 || true)
fi
case "$_lf_rel" in
  *[!0-9a-f]* | "") _lf_rel="${GITHUB_SHA:-}"; _lf_rel="${_lf_rel:0:7}"
    case "$_lf_rel" in *[!0-9a-f]*) _lf_rel="" ;; esac ;;
  *) _lf_rel="canon-${_lf_rel}" ;;
esac
_lf_attrs="service.name=aeon,deployment.environment=${_lf_env}"
_lf_attrs="${_lf_attrs},aeon.component=${AEON_OTEL_COMPONENT:-skill-run}"
_lf_attrs="${_lf_attrs},langfuse.user.id=${SKILL_NAME:-aeon:${AEON_OTEL_COMPONENT:-skill-run}}"
if [ -n "$_lf_rel" ]; then _lf_attrs="${_lf_attrs},langfuse.release=${_lf_rel}"; fi
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  _lf_attrs="${_lf_attrs},langfuse.session.id=${GITHUB_RUN_ID},aeon.run_id=${GITHUB_RUN_ID}"
fi
if [ -n "${SKILL_NAME:-}" ]; then
  _lf_attrs="${_lf_attrs},aeon.skill=${SKILL_NAME},langfuse.trace.name=aeon:${AEON_OTEL_COMPONENT:-skill-run}:${SKILL_NAME}"
  _lf_attrs="${_lf_attrs},langfuse.trace.metadata.skill=${SKILL_NAME}"
else
  _lf_attrs="${_lf_attrs},langfuse.trace.name=aeon:${AEON_OTEL_COMPONENT:-skill-run}"
fi
if [ -n "${GITHUB_REPOSITORY:-}" ]; then
  _lf_attrs="${_lf_attrs},aeon.repo=${GITHUB_REPOSITORY},langfuse.trace.metadata.instance=${GITHUB_REPOSITORY#*/}"
fi
# trigger: the Scheduler and chain-runner start every skill with workflow_dispatch,
# so the event name alone cannot tell a cron run from a manual one. aeon.yml sets
# AEON_DISPATCH_TRIGGER from its trigger input (cron from the Scheduler, chain
# from chain-runner, empty for Run now). Only those values are used: the input
# is free text. Other workflows (messages.yml) do not set it and keep the event.
_lf_trig="${GITHUB_EVENT_NAME:-}"
if [ "$_lf_trig" = workflow_dispatch ] && [ -n "${AEON_DISPATCH_TRIGGER+x}" ]; then
  case "${AEON_DISPATCH_TRIGGER:-}" in
    cron | chain) _lf_trig="$AEON_DISPATCH_TRIGGER" ;;
    *) _lf_trig=manual ;;
  esac
fi
if [ -n "$_lf_trig" ]; then _lf_attrs="${_lf_attrs},langfuse.trace.metadata.trigger=${_lf_trig}"; fi
if [ -n "${GITHUB_RUN_ATTEMPT:-}" ];then _lf_attrs="${_lf_attrs},aeon.run_attempt=${GITHUB_RUN_ATTEMPT}"; fi
# Gateway: the provider scripts/llm-gateway.sh resolved for this call (GATEWAY,
# sourced just before this file), and AEON_GATEWAY_ATTEMPT, its place in the Run
# step's cascade (1 = first route, 2+ = failover). Both attempts of a failed-over
# run share one trace, so run-harness puts these on each attempt's root span and
# usage rows (metadata gateway / gateway_attempt, tags gateway:<name> + failover).
case "${GATEWAY:-}" in
  "" | auto | *[!a-z0-9_-]*) : ;;
  *) _lf_attrs="${_lf_attrs},aeon.gateway=${GATEWAY}" ;;
esac
case "${AEON_GATEWAY_ATTEMPT:-}" in
  "" | *[!0-9]*) : ;;
  *) _lf_attrs="${_lf_attrs},aeon.gateway_attempt=${AEON_GATEWAY_ATTEMPT}" ;;
esac
export OTEL_RESOURCE_ATTRIBUTES="$_lf_attrs"

# Trace id for this call site, derived from the run so other steps can find the
# trace again: the scorer posts its 1-5 score to the skill run's trace with
# scripts/langfuse-score.sh, which derives the same id. Same recipe as
# Langfuse's create_trace_id(seed): the first 32 hex chars of sha256(seed).
# run-harness uses it for the root span it sends for a claude run.
unset AEON_LF_TRACE_ID
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  _lf_seed="aeon:${GITHUB_RUN_ID}:${GITHUB_RUN_ATTEMPT:-1}:${AEON_OTEL_COMPONENT:-skill-run}:${SKILL_NAME:-}"
  _lf_tid=$( { printf '%s' "$_lf_seed" | sha256sum 2>/dev/null || printf '%s' "$_lf_seed" | shasum -a 256 2>/dev/null; } | cut -c1-32)
  case "$_lf_tid" in
    *[!0-9a-f]* | "") : ;;
    *) if [ ${#_lf_tid} -eq 32 ]; then export AEON_LF_TRACE_ID="$_lf_tid"; fi ;;
  esac
fi

# Version: the skill's SKILL.md content hash (git blob id, 7 chars), so a skill
# edit shows up as a new version next to its cost and score. Exported for the
# root span and usage rows only (harness-adapter/lib/otel-span.sh), not put in
# the resource attributes: Claude Code's own spans keep their CLI version.
unset AEON_LF_VERSION
_lf_md="${GITHUB_WORKSPACE:-.}/skills/${SKILL_NAME:-}/SKILL.md"
if [ -n "${SKILL_NAME:-}" ] && [ -f "$_lf_md" ]; then
  _lf_ver=$(git hash-object "$_lf_md" 2>/dev/null | cut -c1-7 || true)
  case "$_lf_ver" in
    *[!0-9a-f]* | "") : ;;
    *) export AEON_LF_VERSION="$_lf_ver" ;;
  esac
fi

echo "::notice::Langfuse tracing on → ${_lf_host} (component=${AEON_OTEL_COMPONENT:-skill-run}, env=${_lf_env}, content=${LANGFUSE_LOG_CONTENT:-1})" >&2
unset _lf_host _lf_auth _lf_attrs _lf_seed _lf_tid _lf_env _lf_default _lf_rel _lf_state _lf_md _lf_ver _lf_trig
return 0 2>/dev/null || exit 0

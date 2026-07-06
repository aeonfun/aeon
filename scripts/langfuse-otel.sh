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
export OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-aeon}"
_lf_attrs="service.name=aeon,deployment.environment=github-actions"
_lf_attrs="${_lf_attrs},aeon.component=${AEON_OTEL_COMPONENT:-skill-run}"
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  _lf_attrs="${_lf_attrs},langfuse.session.id=${GITHUB_RUN_ID},aeon.run_id=${GITHUB_RUN_ID}"
fi
if [ -n "${SKILL_NAME:-}" ]; then
  _lf_attrs="${_lf_attrs},aeon.skill=${SKILL_NAME},langfuse.trace.name=aeon:${AEON_OTEL_COMPONENT:-skill-run}:${SKILL_NAME}"
fi
if [ -n "${GITHUB_REPOSITORY:-}" ]; then _lf_attrs="${_lf_attrs},aeon.repo=${GITHUB_REPOSITORY}"; fi
if [ -n "${GITHUB_RUN_ATTEMPT:-}" ];then _lf_attrs="${_lf_attrs},aeon.run_attempt=${GITHUB_RUN_ATTEMPT}"; fi
export OTEL_RESOURCE_ATTRIBUTES="$_lf_attrs"

echo "::notice::Langfuse tracing on → ${_lf_host} (component=${AEON_OTEL_COMPONENT:-skill-run}, content=${LANGFUSE_LOG_CONTENT:-1})" >&2
unset _lf_host _lf_auth _lf_attrs
return 0 2>/dev/null || exit 0

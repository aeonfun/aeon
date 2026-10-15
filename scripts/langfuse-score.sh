#!/usr/bin/env bash
# langfuse-score.sh - post the post-run scorer's 1-5 grade to Langfuse.
#
# Usage: scripts/langfuse-score.sh <skill> <score 1-5> <assessment> <flags-json> [harness] [score-model]
#        scripts/langfuse-score.sh --run-ok <skill> <1|0> [harness] [error]
#
# Called by the aeon.yml scorer step right after it settles QUALITY_SCORE. Posts a
# NUMERIC score `quality` plus one CATEGORICAL score `quality_flag` per flag.
# With --run-ok (the "Update cron state" step, every run that reached the Run
# step) it posts one BOOLEAN score `run_ok` instead: 1 = the Run step succeeded. For
# a claude run they go on the skill run's trace: run-harness sends that trace
# under the id langfuse-otel.sh derives from the run (sha256 of run id, attempt,
# component and skill), and this script derives the same id, so nothing has to
# be passed between steps. Other harnesses score on the run's session
# (GITHUB_RUN_ID, the session langfuse-otel.sh pins).
# Score ids are fixed per trace, so a re-post overwrites instead of duplicating.
#
# OPT-IN + NEVER FATAL, like langfuse-otel.sh: does nothing unless both
# LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set (and LANGFUSE_TRACING is not
# off), and always exits 0. The secret goes to curl on stdin, never in argv.
set -uo pipefail

RUN_OK=""
if [ "${1:-}" = "--run-ok" ]; then
  SKILL="${2:-}" RUN_OK="${3:-}" HARNESS="${4:-claude}" ASSESSMENT="${5:-}" SCORE=1 FLAGS='[]' SCORE_MODEL=""
  case "$RUN_OK" in 0 | 1) ;; *) exit 0 ;; esac
else
  SKILL="${1:-}" SCORE="${2:-}" ASSESSMENT="${3:-}" FLAGS="${4:-[]}" HARNESS="${5:-claude}" SCORE_MODEL="${6:-}"
fi
HARNESS="${HARNESS:-claude}"

[ -n "${LANGFUSE_PUBLIC_KEY:-}" ] && [ -n "${LANGFUSE_SECRET_KEY:-}" ] || exit 0
case "${LANGFUSE_TRACING:-}" in 0 | false | off | no | False | FALSE | Off | OFF | No | NO) exit 0 ;; esac
[ -n "${GITHUB_RUN_ID:-}" ] || exit 0
case "$SCORE" in [1-5]) ;; *) exit 0 ;; esac
command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1 || exit 0
echo "$FLAGS" | jq -e 'type == "array"' >/dev/null 2>&1 || FLAGS='[]'

host="${LANGFUSE_HOST:-${LANGFUSE_BASE_URL:-https://cloud.langfuse.com}}"
host="${host%/}"

# Same environment as scripts/langfuse-otel.sh gives the traces: production on the
# default branch, branch elsewhere, local outside Actions; LANGFUSE_TRACING_ENVIRONMENT wins.
env_name="${LANGFUSE_TRACING_ENVIRONMENT:-}"
case "$env_name" in *[!a-z0-9_-]* | langfuse*) env_name="" ;; esac
if [ -z "$env_name" ]; then
  default_branch=""
  if [ -f "${GITHUB_EVENT_PATH:-}" ]; then
    default_branch=$(jq -r '.repository.default_branch // empty | strings' "$GITHUB_EVENT_PATH" 2>/dev/null || true)
  fi
  if [ -z "${GITHUB_REF_NAME:-}" ]; then env_name=local
  elif [ "$GITHUB_REF_NAME" = "${default_branch:-main}" ]; then env_name=production
  else env_name=branch; fi
fi

# Same seed as scripts/langfuse-otel.sh for the Run step (component skill-run).
tid=""
if [ "$HARNESS" = claude ]; then
  seed="aeon:${GITHUB_RUN_ID}:${GITHUB_RUN_ATTEMPT:-1}:skill-run:${SKILL}"
  tid=$({ printf '%s' "$seed" | sha256sum 2>/dev/null || printf '%s' "$seed" | shasum -a 256 2>/dev/null; } | cut -c1-32)
  [[ "$tid" =~ ^[0-9a-f]{32}$ ]] || tid=""
fi
key="${tid:-run-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT:-1}-${SKILL}}"

post() {
  printf 'user = "%s:%s"\n' "$LANGFUSE_PUBLIC_KEY" "$LANGFUSE_SECRET_KEY" |
    curl -sS -m 10 -o /dev/null -w '%{http_code}' -K - -X POST \
      -H 'Content-Type: application/json' --data-binary "$1" "$host/api/public/scores" 2>/dev/null
}

# Langfuse takes exactly one target: the trace when we know it, else the session.
base=$(jq -nc --arg tid "$tid" --arg sid "$GITHUB_RUN_ID" --arg env "$env_name" '{environment: $env} + (if $tid != "" then {traceId: $tid} else {sessionId: $sid} end)')

if [ -n "$RUN_OK" ]; then
  code=$(post "$(jq -nc --argjson b "$base" --arg id "${key}-run_ok" --argjson v "$RUN_OK" \
    --arg c "$ASSESSMENT" --arg skill "$SKILL" --arg h "$HARNESS" \
    '$b + {id: $id, name: "run_ok", value: $v, dataType: "BOOLEAN", metadata: {skill: $skill, harness: $h}}
       + (if $c != "" then {comment: ($c | .[:500])} else {} end)')")
  echo "Langfuse score: run_ok=$RUN_OK skill=$SKILL (HTTP ${code:-none})"
  exit 0
fi

code=$(post "$(jq -nc --argjson b "$base" --arg id "${key}-quality" --argjson v "$SCORE" \
  --arg c "$ASSESSMENT" --arg skill "$SKILL" --arg h "$HARNESS" --arg m "$SCORE_MODEL" --argjson flags "$FLAGS" \
  '$b + {id: $id, name: "quality", value: $v, dataType: "NUMERIC", comment: ($c | .[:1000]),
         metadata: ({skill: $skill, harness: $h, flags: $flags} + (if $m != "" then {score_model: $m} else {} end))}')")
echo "Langfuse score: quality=$SCORE skill=$SKILL (HTTP ${code:-none})"

for flag in $(echo "$FLAGS" | jq -r '.[] | strings | select(test("^[A-Za-z0-9_.-]{1,64}$"))'); do
  post "$(jq -nc --argjson b "$base" --arg id "${key}-flag-${flag}" --arg f "$flag" --arg skill "$SKILL" \
    '$b + {id: $id, name: "quality_flag", value: $f, dataType: "CATEGORICAL", metadata: {skill: $skill}}')" >/dev/null
done
exit 0

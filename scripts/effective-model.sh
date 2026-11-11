#!/usr/bin/env bash
# effective-model.sh <harness> <base-model> <harness-model-arg> < run-envelope.json
#
# Decide which model to record for a run, and say where the answer came from.
# Prints GITHUB_OUTPUT lines on stdout (append them straight to the file):
#   SKILL_MODEL=<id>
#   SKILL_MODEL_REQUESTED=<id>
#   SKILL_MODEL_SOURCE=<reported|requested>
# and a ::notice:: (plus a second one when nothing was reported) on stderr.
#
# The requested model is what the config asked for: the base model for claude
# and grok, the harness's own model arg for the adapter harnesses, else
# <harness>-default.
#
# reported:  the run's own envelope named a model. Either the adapter's `model`
#            field, or, for claude, the entry of `modelUsage` that produced the
#            most output tokens (a run can touch more than one model, e.g. a
#            small one for tool calls; the one that wrote the most is the one
#            that did the work).
# requested: the envelope named nothing, so the model the config asked for is
#            kept. It is a request, not evidence of what ran, and it is
#            labelled so.
#
# An id is kept only if it is a plain model-id string (starts with a letter or
# digit): the value ends up in workflow outputs, later run: scripts and a CSV.
# Among several models in modelUsage the most output tokens wins, then the
# lowest name, so the answer does not depend on key order.
set -uo pipefail

harness="${1:-}" base_model="${2:-}" harness_arg="${3:-}"
case "$harness" in
  claude|grok) requested="$base_model" ;;
  *)           requested="${harness_arg:-$harness-default}" ;;
esac
valid_id() { [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,99}$ ]]; }

reported=$(jq -r '
  if type != "object" then empty
  else
    ((.model // "") | if type == "string" then . else "" end) as $m
    | if $m != "" then $m
      else
        ((.modelUsage // {}) | if type == "object" then to_entries else [] end)
        | map(select(.value | type == "object")
              | {k: .key,
                 t: ((.value.outputTokens // 0) | if type == "number" then . else 0 end)})
        | if length == 0 then empty
          else (sort_by([-.t, .k]) | .[0].k)
          end
      end
  end' 2>/dev/null || true)

# Claude Code can key a model with its context window, e.g. claude-opus-4-8[1m].
# The window is not part of the model's name; drop it. Same for a config model
# written that way, so the request is not thrown away as "unknown".
if [[ "$reported" =~ ^(.+)\[[A-Za-z0-9]+\]$ ]]; then reported="${BASH_REMATCH[1]}"; fi
if [[ "$requested" =~ ^(.+)\[[A-Za-z0-9]+\]$ ]]; then requested="${BASH_REMATCH[1]}"; fi

valid_id "$requested" || requested="unknown"
model="$requested" source=requested
if [ -n "$reported" ] && valid_id "$reported"; then model="$reported" source=reported; fi

printf 'SKILL_MODEL=%s\nSKILL_MODEL_REQUESTED=%s\nSKILL_MODEL_SOURCE=%s\n' "$model" "$requested" "$source"
echo "::notice::effective model for $harness: $model" >&2   # no spaces: parsed by field
if [ "$source" = requested ]; then
  # A notice, not a warning: most harnesses never report a model, and the
  # dashboard lists every warning line as a problem.
  echo "::notice::$harness reported no model; recording the requested one ($model), which may not be what ran" >&2
fi

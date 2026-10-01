#!/usr/bin/env bash
# parse-aeon-config.sh - the scheduler's view of aeon.yml, as flat records.
#
# Replaces the line-regex parsers that used to live inline in
# .github/workflows/scheduler.yml. Those were not section-aware (a 2-space key
# under chains:/reactive:/channels: registered as a "skill") and not
# comment-aware (a commented `#   schedule: "0 7 * * *"` under chains: leaked
# into the chain above it). This reads aeon.yml with a real YAML parser (yq,
# mikefarah v4, preinstalled on GitHub's ubuntu runners), so only entries that
# actually live under the top-level skills: / chains: / reactive: keys count,
# and comments are never data.
#
# Usage:
#   parse-aeon-config.sh [path/to/aeon.yml]      (default: ./aeon.yml)
#
# Output: one record per line, fields separated by the ASCII unit separator
# (0x1f) so empty fields survive `IFS=$'\x1f' read -r` (a tab would collapse):
#   skill    <name> <enabled:true|false> <schedule> <var>
#   chain    <name> <schedule> <comma-joined step skills (skill + parallel)>
#   reactive <handler> <on> <when>                 (one line per trigger rule)
#
# Skill `enabled` keeps the old scheduler semantics: an explicit true/false
# wins; when omitted, an inline flow entry (`name: { schedule: ... }`) is OFF
# and a block entry (name: then indented fields) is ON.
#
# Exit 0 on success. Exit 2 (message on stderr) when yq is missing or aeon.yml
# is not valid YAML, so the scheduler fails loudly instead of dispatching from
# a half-parsed config.
#
# Tests: scripts/tests/test_parse_aeon_config.sh
set -euo pipefail

CONFIG="${1:-aeon.yml}"

if [ ! -f "$CONFIG" ]; then
  echo "parse-aeon-config: $CONFIG not found" >&2
  exit 2
fi
if ! command -v yq >/dev/null 2>&1 || ! yq --version 2>&1 | grep -q 'mikefarah'; then
  echo "parse-aeon-config: yq (github.com/mikefarah/yq v4) is required" >&2
  exit 2
fi

# yq: YAML -> JSON (aliases expanded), plus the list of skill keys written as
# inline flow maps (style is lost in JSON, and it decides the enabled default).
if ! DOC=$(yq -o=json -I=0 'explode(.) | {
    "doc": .,
    "flow": [(.skills // {}) | to_entries | .[] | select((.value | style) == "flow") | .key]
  }' "$CONFIG" 2>&1); then
  echo "parse-aeon-config: $CONFIG is not valid YAML: $DOC" >&2
  exit 2
fi

printf '%s' "$DOC" | jq -r '
  def maps: if type == "object" then to_entries[] | select(.value | type == "object") else empty end;
  def okname: test("^[a-zA-Z0-9_-]+$");
  def str: if . == null then "" else tostring | gsub("[\n\u001f]"; " ") end;
  .flow as $flow
  | .doc as $d
  | (
      ($d.skills | maps | select(.key | okname)
        | .key as $k
        | (.value.enabled | if . == null then "" else tostring end) as $e
        | (if $e == "true" then "true"
           elif $e == "false" then "false"
           elif ($flow | any(. == $k)) then "false"
           else "true" end) as $en
        | ["skill", $k, $en, (.value.schedule | str), (.value.var | str)]),
      ($d.chains | maps | select(.key | okname)
        | ["chain", .key, (.value.schedule | str),
           ([.value.steps // [] | if type == "array" then .[] else empty end
             | select(type == "object")
             | ((.parallel // [] | if type == "array" then .[] else . end), (.skill // empty))
             | str | select(okname)] | join(","))]),
      ($d.reactive | maps | select(.key | okname)
        | .key as $h
        | .value.trigger // []
        | if type == "array" then .[] else . end
        | select(type == "object" and .on != null and .when != null)
        | ["reactive", $h, (.on | str), (.when | str)])
    )
  | join("\u001f")'

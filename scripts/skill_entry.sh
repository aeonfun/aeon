#!/usr/bin/env bash
# skill_entry - print one skill's aeon.yml entry (comments stripped) so callers can
# read a per-skill key with one sed. Handles BOTH entry shapes:
#   single-line   name: { enabled: true, model: "x", harness: "grok" }
#   block         name:
#                   { enabled: true,
#                     model: "x", harness: "grok" }
# A single-line `grep "^  name:"` only sees the header line, so a block entry's
# model:/harness:/attest: (on a later line) was silently ignored.
#
# Capture runs from the "  name:" header to the line that closes the flow map, and
# stops early at the next entry or top-level key (a plain block map has no brace).
# Only the FIRST matching header counts: a chain of the same name further down
# aeon.yml (chains: also indents its keys by two) is not this skill's entry.
# `#` starts a comment only outside double quotes, so a var like "fix #12" survives.
#
# Usage: skill_entry.sh <skill-name> [aeon.yml]
#   e.g. bash scripts/skill_entry.sh digest | sed -n 's/.*model: *"\([^"]*\)".*/\1/p' | head -1
set -euo pipefail
skill="${1:?skill name required}"
cfg="${2:-aeon.yml}"
[ -f "$cfg" ] || exit 0
awk -v hdr="  ${skill}:" '
  function strip(s,   i, c, q, out) {
    q = 0; out = ""
    for (i = 1; i <= length(s); i++) {
      c = substr(s, i, 1)
      if (c == "\"") q = !q
      if (c == "#" && !q && (i == 1 || substr(s, i - 1, 1) ~ /[ \t]/)) break
      out = out c
    }
    return out
  }
  !f {
    if (index($0, hdr) == 1) {
      line = strip($0); print line; f = 1
      if (line ~ /}/) exit
    }
    next
  }
  /^  [^ #]/ || /^[^ #\t]/ { exit }   # next entry / next top-level key
  { line = strip($0); print line; if (line ~ /}/) exit }
' "$cfg"

#!/usr/bin/env bash
# check-capabilities-parity.sh — assert the locked skill-capabilities taxonomy
# is identical in all three places it currently lives:
#
#   1. ALLOWED_CAPABILITIES bash array in install-skill-pack (the runtime allow-list)
#   2. The "## The taxonomy" markdown table in docs/CAPABILITIES.md (the operator docs)
#   3. The "# Capabilities taxonomy" header comment in install-skill-pack (cited by
#      the script body when emitting unknown-value errors)
#
# Drift between (1) and (2) is the failure mode Issue #301 flags: install rejects
# valid manifests OR accepts invalid ones, silently, while the error message points
# operators back at docs that are right while the script is wrong.
#
# This check runs in CI on every PR that touches either file so drift fails loud.
# It's the cheapest of the three directions Issue #301 outlined: no schema decisions,
# no source-of-truth move, both files stay where they are — but a divergent PR fails
# the check until both halves are updated in the same diff.
#
# Run locally:  bash scripts/check-capabilities-parity.sh
# Exit codes:   0 = parity OK, 1 = drift detected, 2 = script error (missing inputs).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_SCRIPT="$ROOT_DIR/bin/install-skill-pack"
DOCS="$ROOT_DIR/docs/CAPABILITIES.md"

if [ ! -f "$INSTALL_SCRIPT" ]; then
  echo "::error::install-skill-pack not found at $INSTALL_SCRIPT" >&2
  exit 2
fi
if [ ! -f "$DOCS" ]; then
  echo "::error::docs/CAPABILITIES.md not found at $DOCS" >&2
  exit 2
fi

# (1) ALLOWED_CAPABILITIES=(... ) block from install-skill-pack.
# Reads every non-empty, non-comment line between the opening "ALLOWED_CAPABILITIES=("
# and the closing ")". Trims leading/trailing whitespace and strips trailing comments.
extract_script_caps() {
  awk '
    /^ALLOWED_CAPABILITIES=\(/ { in_array=1; next }
    in_array && /^\)/          { in_array=0; next }
    in_array {
      sub(/^[[:space:]]+/, "")
      sub(/[[:space:]]+$/, "")
      sub(/[[:space:]]*#.*$/, "")
      if (length($0)) print
    }
  ' "$INSTALL_SCRIPT"
}

# (2) "## The taxonomy" table rows from docs/CAPABILITIES.md.
# Each row is `| \`value\` | meaning |`; we extract the backtick-quoted value only.
# Stops at the next "## " heading so other tables/sections can't leak in.
extract_docs_caps() {
  awk '
    /^## The taxonomy/ { section=1; next }
    section && /^## /  { section=0 }
    section && /^\|[[:space:]]*`[a-z_]+`[[:space:]]*\|/ {
      line=$0
      sub(/^\|[[:space:]]*`/, "", line)
      sub(/`.*$/,            "", line)
      if (length(line)) print line
    }
  ' "$DOCS"
}

# (3) The "# Capabilities taxonomy" header comment in install-skill-pack.
# Only the comment lines that carry the unicode-middot-separated value list are
# extracted; any subsequent prose line (e.g. "# See docs/CAPABILITIES.md...")
# ends the scan so we don't slurp continuation words like "proposing" as values.
extract_comment_caps() {
  awk '
    /^# Capabilities taxonomy/ { found=1; next }
    found && /·/ {
      line=$0
      sub(/^#[[:space:]]+/, "", line)
      gsub(/[[:space:]]*·[[:space:]]*/, "\n", line)
      sub(/[[:space:]]+$/, "", line)
      print line
      next
    }
    found && /^#/ && !/·/ { exit }
    found && !/^#/        { exit }
  ' "$INSTALL_SCRIPT" | grep -E '^[a-z_]+$' || true
}

script_sorted=$(extract_script_caps    | sort -u)
docs_sorted=$(extract_docs_caps        | sort -u)
comment_sorted=$(extract_comment_caps  | sort -u)

mismatches=0

# (a) ALLOWED_CAPABILITIES vs docs/CAPABILITIES.md taxonomy table.
if [ "$script_sorted" != "$docs_sorted" ]; then
  {
    echo "::error::Capabilities taxonomy drift: install-skill-pack ALLOWED_CAPABILITIES does not match docs/CAPABILITIES.md \"The taxonomy\" table."
    echo ""
    echo "ALLOWED_CAPABILITIES (install-skill-pack):"
    echo "$script_sorted" | sed 's/^/  - /'
    echo ""
    echo "\"The taxonomy\" (docs/CAPABILITIES.md):"
    echo "$docs_sorted" | sed 's/^/  - /'
    echo ""
    echo "Only in ALLOWED_CAPABILITIES (would be accepted by installer, undocumented for operators):"
    comm -23 <(printf '%s\n' "$script_sorted") <(printf '%s\n' "$docs_sorted") | sed 's/^/  - /'
    echo ""
    echo "Only in docs/CAPABILITIES.md (documented but installer would reject as unknown):"
    comm -13 <(printf '%s\n' "$script_sorted") <(printf '%s\n' "$docs_sorted") | sed 's/^/  - /'
    echo ""
    echo "Fix: update both files in the same PR. See docs/CAPABILITIES.md → \"Adding a new capability\"."
  } >&2
  mismatches=1
fi

# (b) ALLOWED_CAPABILITIES vs the header comment that cites the same set.
if [ "$script_sorted" != "$comment_sorted" ]; then
  {
    echo "::error::Capabilities taxonomy comment drift: install-skill-pack's \"# Capabilities taxonomy\" header comment lists a different set than ALLOWED_CAPABILITIES."
    echo ""
    echo "ALLOWED_CAPABILITIES:"
    echo "$script_sorted" | sed 's/^/  - /'
    echo ""
    echo "\"# Capabilities taxonomy\" header comment:"
    echo "$comment_sorted" | sed 's/^/  - /'
    echo ""
    echo "Fix: update the header comment alongside ALLOWED_CAPABILITIES so the script's own self-description stays accurate."
  } >&2
  mismatches=1
fi

if [ "$mismatches" -ne 0 ]; then
  exit 1
fi

count=$(printf '%s\n' "$script_sorted" | grep -c .)
echo "capabilities-parity: OK ($count values aligned across install-skill-pack ALLOWED_CAPABILITIES, install-skill-pack header comment, and docs/CAPABILITIES.md \"The taxonomy\")."

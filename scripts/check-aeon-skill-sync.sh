#!/usr/bin/env bash
# check-aeon-skill-sync.sh - the `aeon` operator skill ships twice: once in-repo at
# .claude/skills/aeon (picked up by Claude Code inside an Aeon checkout) and once
# in the Claude Code plugin at plugin/skills/aeon. The two copies are hand-synced
# and have drifted before (#1098). This fails when they differ in anything but
# the one intentional difference: the plugin copy calls its bundled scripts via
# "${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/skills/aeon/<path>" where the in-repo copy
# uses the relative .claude/skills/aeon/<path>.
#
# Run locally: `bash scripts/check-aeon-skill-sync.sh`.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REPO_COPY=".claude/skills/aeon"
PLUGIN_COPY="plugin/skills/aeon"

for d in "$REPO_COPY" "$PLUGIN_COPY"; do
  if [ ! -d "$d" ]; then
    echo "::error::check-aeon-skill-sync: $d not found" >&2
    exit 1
  fi
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Rewrite the plugin copy's quoted plugin-root paths to the in-repo form, then
# compare the whole trees (file set and contents).
(cd "$PLUGIN_COPY" && find . -type f) | while IFS= read -r f; do
  mkdir -p "$TMP/$(dirname "$f")"
  # shellcheck disable=SC2016 # literal ${PLUGIN_ROOT...} text is the match target
  sed -E 's#"\$\{PLUGIN_ROOT:-\$CLAUDE_PLUGIN_ROOT\}/skills/aeon/([^"]*)"#.claude/skills/aeon/\1#g' \
    "$PLUGIN_COPY/$f" > "$TMP/$f"
done

if ! diff -ru "$REPO_COPY" "$TMP"; then
  echo "" >&2
  echo "::error::check-aeon-skill-sync: $REPO_COPY and $PLUGIN_COPY have drifted. Apply the same change to both copies (the plugin copy keeps \"\${PLUGIN_ROOT:-\$CLAUDE_PLUGIN_ROOT}/skills/aeon/...\" script paths; everything else must match)." >&2
  exit 1
fi
echo "check-aeon-skill-sync: OK - $REPO_COPY matches $PLUGIN_COPY (plugin-root script paths aside)."

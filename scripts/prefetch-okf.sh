#!/usr/bin/env bash
# Pre-fetch an EXTERNAL OKF (Open Knowledge Format) bundle for the okf-ingest skill,
# OUTSIDE the sandbox (git clone / curl are blocked from inside the skill). The
# skill then validates, quarantines, and folds the bundle into memory/topics/.
#
#   ./scripts/prefetch-okf.sh okf-ingest "<git-url-or-owner/repo>[#subdir]"
#
# Invoked by .github/workflows/aeon.yml as: ./scripts/prefetch-*.sh "$SKILL" "$VAR"
#
# SECURITY: this only *fetches bytes into a cache* — it never executes anything from
# the remote and never writes into memory/. The fetched content is untrusted data;
# the skill (skills/okf-ingest/SKILL.md) enforces the quarantine + no-embedded-
# instructions rules. We restrict to https:// (no ssh/git/file schemes) and do a
# shallow, single-branch clone with no submodules or hooks.
set -euo pipefail

SKILL="${1:-}"
VAR="${2:-${SKILL_VAR:-}}"

[ "$SKILL" = "okf-ingest" ] || exit 0

if [ -z "$VAR" ]; then
  echo "prefetch-okf: no source given (var empty) — skipping"
  exit 0
fi

# Strip an optional "#subdir" suffix (recorded for the skill; clone is whole-repo).
SRC="${VAR%%#*}"

# Normalize a bare owner/repo shorthand to a GitHub https URL.
if [[ "$SRC" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  SRC="https://github.com/${SRC}.git"
fi

# Allow ONLY https URLs — reject ssh://, git://, file://, and anything exotic.
if [[ ! "$SRC" =~ ^https://[A-Za-z0-9.-]+/.+ ]]; then
  echo "prefetch-okf: refusing non-https source '$SRC' — pass an https git URL or owner/repo"
  exit 0
fi

# Cache dir keyed by a sanitized slug of the source.
SLUG=$(echo "$SRC" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https://##; s#\.git$##; s#[^a-z0-9]+#-#g; s#^-+|-+$##g')
DEST=".okf-cache/${SLUG}"

rm -rf "$DEST"
mkdir -p "$DEST"

# Shallow, single-branch, no submodules; disable any repo hooks the remote ships.
if GIT_TERMINAL_PROMPT=0 git -c core.hooksPath=/dev/null clone \
     --depth 1 --single-branch --no-tags \
     "$SRC" "$DEST" 2>&1; then
  COUNT=$(find "$DEST" -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "prefetch-okf: cloned $SRC -> $DEST ($COUNT markdown file(s))"
  echo "$VAR" > "$DEST/.okf-source"
else
  echo "prefetch-okf: clone failed for $SRC — the skill will fall back to WebFetch"
  rm -rf "$DEST"
fi

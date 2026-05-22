#!/usr/bin/env bash
# Post-process for perps-brief (v4.1).
#
# Pipeline:
#   1. Render JSON → markdown        (scripts/render-perps-brief.py)
#   2. Snapshot the ledger           (pre-apply backup)
#   3. Apply ledger operations       (scripts/apply-ledger-ops.py)
#   4. Validate ledger post-apply    (python3 -m lib.ledger)
#   5. Section-split markdown + send per-section to Discord
#
# v4.1 changes from v4:
#   - Step 5 splits the brief by section divider, wraps each section in a
#     code block, and sends each as a separate Discord message. Sections
#     stay intact across the 2000-char webhook limit.
#   - The title + MARKET SENTIMENT block is the first message (combined
#     per operator decision).

set -euo pipefail

JSON_PATH=".outputs/perps-brief.data.json"
MD_PATH=".outputs/perps-brief.md"
LEDGER_PATH="memory/topics/state/active-setups.json"

if [ ! -f "$JSON_PATH" ]; then
  echo "postprocess-perps-brief: $JSON_PATH not present, skipping"
  exit 0
fi

if [ ! -f "scripts/render-perps-brief.py" ]; then
  echo "::error::postprocess-perps-brief: scripts/render-perps-brief.py missing"
  exit 1
fi

if [ ! -f "scripts/apply-ledger-ops.py" ]; then
  echo "::error::postprocess-perps-brief: scripts/apply-ledger-ops.py missing"
  exit 1
fi

# Step 1 — Render
echo "postprocess-perps-brief: step 1/5 — render"
if ! python3 scripts/render-perps-brief.py; then
  echo "::error::postprocess-perps-brief: render failed; ledger untouched, no notify"
  exit 1
fi

# Step 2 — Snapshot ledger
echo "postprocess-perps-brief: step 2/5 — snapshot ledger"
if [ -f "$LEDGER_PATH" ]; then
  python3 - <<'PY'
import sys
sys.path.insert(0, "scripts")
from lib import ledger as L
try:
    target = L.snapshot()
    print(f"postprocess-perps-brief: snapshot → {target}")
except L.LedgerError as e:
    sys.stderr.write(f"postprocess-perps-brief: snapshot failed: {e}\n")
    sys.exit(1)
PY
else
  echo "postprocess-perps-brief: ledger does not exist yet; skipping snapshot"
fi

# Step 3 — Apply ledger ops
echo "postprocess-perps-brief: step 3/5 — apply ledger ops"
if ! python3 scripts/apply-ledger-ops.py; then
  echo "::error::postprocess-perps-brief: apply-ledger-ops failed; ledger untouched"
  echo "::warning::postprocess-perps-brief: continuing to notify — brief artifact is valid"
fi

# Step 4 — Validate ledger post-apply
echo "postprocess-perps-brief: step 4/5 — validate ledger"
if [ -f "$LEDGER_PATH" ]; then
  if ! ( cd scripts && python3 -m lib.ledger "../$LEDGER_PATH" ); then
    echo "::error::postprocess-perps-brief: ledger post-apply validation FAILED — restore from memory/topics/state/snapshots/"
  fi
fi

# Step 5 — Section-split notify
echo "postprocess-perps-brief: step 5/5 — section-split notify"

if [ ! -x ./notify ]; then
  echo "::error::postprocess-perps-brief: ./notify is missing or not executable"
  exit 1
fi

if [ ! -s "$MD_PATH" ]; then
  echo "postprocess-perps-brief: $MD_PATH is empty after render, nothing to notify"
  exit 0
fi

# Split the brief into sections. The render emits a deterministic divider
# `─────────  NAME  ─────────` at section boundaries. The first section
# is the title + MARKET SENTIMENT block (no divider above it).
#
# python helper: read the md, split, emit one file per section to a temp dir,
# then loop and notify each.
SECTION_DIR=$(python3 - <<'PY'
import sys, os, tempfile
from pathlib import Path

md = Path(".outputs/perps-brief.md").read_text()
lines = md.splitlines()

# A section divider line starts and ends with the "─────────" sequence.
DIV = "─" * 9
def is_divider(line: str) -> bool:
    return line.startswith(DIV) and line.rstrip().endswith(DIV)

# Walk the lines; each divider starts a new section. Lines before the
# first divider belong to "section 0" (title + MARKET SENTIMENT in v4.1).
# Actually MARKET SENTIMENT itself has a divider, so section 0 is just
# the title lines if any precede MARKET SENTIMENT's divider.
sections: list[list[str]] = []
current: list[str] = []
for line in lines:
    if is_divider(line):
        if current:
            sections.append(current)
            current = []
    current.append(line)
if current:
    sections.append(current)

# The first section contains the title (before the MARKET SENTIMENT
# divider). If MARKET SENTIMENT is the first divider in the file, that
# section already includes the title — perfect. The combined "title +
# MARKET SENTIMENT" message is sections[0].

tmpdir = tempfile.mkdtemp(prefix="perps-brief-sections-")
for i, sec in enumerate(sections):
    body = "\n".join(sec).rstrip()
    if not body:
        continue
    Path(tmpdir, f"section-{i:02d}.md").write_text(body + "\n")
print(tmpdir)
PY
)

if [ -z "$SECTION_DIR" ] || [ ! -d "$SECTION_DIR" ]; then
  echo "::warning::postprocess-perps-brief: section split failed; falling back to monolithic notify"
  ./notify --signal "$(cat "$MD_PATH")" || {
    echo "::warning::postprocess-perps-brief: ./notify exited non-zero — pending-notify will retry"
  }
  exit 0
fi

SECTION_COUNT=$(ls -1 "$SECTION_DIR"/section-*.md 2>/dev/null | wc -l | tr -d ' ')
echo "postprocess-perps-brief: split into $SECTION_COUNT section(s); sending each wrapped in a code block"

# Send each section as its own Discord message, wrapped in a code block
# so Discord renders monospace + preserves the dividers + indentation.
for f in "$SECTION_DIR"/section-*.md; do
  CONTENT=$(cat "$f")
  WRAPPED=$(printf '```\n%s\n```' "$CONTENT")
  echo "postprocess-perps-brief: notify section: $(basename "$f") ($(wc -c < "$f" | tr -d ' ') bytes)"
  ./notify --signal "$WRAPPED" || {
    echo "::warning::postprocess-perps-brief: ./notify exited non-zero on $(basename "$f") — pending-notify will retry"
  }
done

# Clean up temp dir
rm -rf "$SECTION_DIR"

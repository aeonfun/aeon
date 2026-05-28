#!/usr/bin/env bash
# Post-process for perps-brief (v4.1).
#
# Pipeline:
#   1. Render JSON → markdown        (scripts/render-perps-brief.py)
#   2. Snapshot the ledger           (pre-apply backup)
#   3. Apply ledger operations       (scripts/apply-ledger-ops.py)
#   4. Validate ledger post-apply    (python3 -m lib.ledger)
#   5. Split markdown into per-section pre-chunked pending files
#   6. Bot embed delivery            (scripts/embed-perps-brief.py, V2 parallel)
#
# v4.1 changes from v4:
#   - Step 5 splits the brief by section divider, pre-chunks each section
#     to fit Discord's 2000-char limit (including code-block wrappers),
#     and writes each chunk directly to .pending-notify/ with a unique
#     filename. The post-run "Send pending notifications" step picks them
#     up and delivers each as its own Discord message.
#   - We bypass ./notify for these sends because ./notify builds pending
#     filenames as $(date +%s) — when multiple sends happen in the same
#     second they collide and overwrite each other. Writing directly with
#     counter-suffixed filenames avoids the collision.
#   - Title + MARKET SENTIMENT combined into the first section message.

set -euo pipefail

# Skill-name guard. The workflow's "Run post-process scripts" step loops
# through ALL scripts/postprocess-*.sh files for every skill's workflow,
# not just perps-brief's. Without this guard, every step-1 skill workflow
# (narrative-tracker, token-call, monitor-runners, etc.) would re-process
# the perps-brief.data.json that's on main from the previous chain run,
# write new pending files, and the host workflow's Send pending
# notifications step would deliver them to THAT skill's Discord channel
# via DISCORD_WEBHOOK_MAP[$SKILL_NAME] — broadcasting the perps-brief
# content across the whole chain's channel set. Bail early when this
# script is executing inside a non-perps-brief workflow.
if [ "${SKILL_NAME:-}" != "perps-brief" ]; then
  echo "postprocess-perps-brief: skipping (SKILL_NAME='${SKILL_NAME:-}', not perps-brief)"
  exit 0
fi

JSON_PATH=".outputs/perps-brief.data.json"
MD_PATH=".outputs/perps-brief.md"
LEDGER_PATH="memory/topics/state/active-setups.json"

# CHAIN_SLOT: derive from current UTC hour. < 12 → "am", else → "pm".
# Used to disambiguate twice-daily artifacts: ledger snapshot filename,
# evaluation entries, and bot embed footer tags. Computed once here and
# exported so all downstream Python scripts share the same value.
HOUR_UTC=$(date -u +%H)
if [ "$HOUR_UTC" -lt 12 ]; then
  export CHAIN_SLOT=am
else
  export CHAIN_SLOT=pm
fi
echo "postprocess-perps-brief: chain slot = $CHAIN_SLOT (UTC hour $HOUR_UTC)"

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
import os, sys
sys.path.insert(0, "scripts")
from lib import ledger as L
try:
    # snapshot() reads CHAIN_SLOT from env when slot is not passed —
    # filename ends up as active-setups.YYYY-MM-DD-{am|pm}.json so the
    # PM run doesn't overwrite the AM snapshot on the same calendar day.
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

# Step 5 — Section-split + pre-chunk + write pending files
echo "postprocess-perps-brief: step 5/5 — section-split + pre-chunk to pending"

if [ ! -s "$MD_PATH" ]; then
  echo "postprocess-perps-brief: $MD_PATH is empty after render, nothing to notify"
  exit 0
fi

python3 - "$MD_PATH" <<'PY'
"""Split perps-brief markdown into pre-chunked, code-block-wrapped Discord
messages and write each as a unique pending file.

Section boundaries: ───── NAME ───── divider lines (9-char dashes).

Title (any lines before the first divider) is merged into the first section
so the title rides with MARKET SENTIMENT.

Per-section chunking: each section's content + code-block wrapper must fit
in 1900 bytes (Discord webhook limit is 2000; we leave headroom). When a
section exceeds 1900 bytes, split at trade-block boundaries (blank lines
after the section header). Continuation chunks get "(cont.)" appended to
the section header for visual continuity.

Each chunk gets its own pending file named perps-brief-<ts>-<seq>.signal.md
to avoid the pending-filename collision in ./notify (same-second sends
overwrite each other when ./notify is the writer).
"""

import sys
import os
import time
from pathlib import Path

MAX_CHUNK_BYTES = 1900  # Discord cap 2000; leave 100 for safety
WRAPPER_OVERHEAD = 8     # ```\n + \n```
DIV = "─" * 9


def is_divider(line: str) -> bool:
    return line.startswith(DIV) and line.rstrip().endswith(DIV)


def split_sections(lines: list[str]) -> list[list[str]]:
    """Split markdown lines into sections.

    Pre-first-divider content (e.g., title) is merged into the first section
    so the title rides with MARKET SENTIMENT instead of being its own
    orphan message.
    """
    sections: list[list[str]] = []
    current: list[str] = []
    first_divider_seen = False
    for line in lines:
        if is_divider(line):
            if current and first_divider_seen:
                sections.append(current)
                current = []
            first_divider_seen = True
        current.append(line)
    if current:
        sections.append(current)
    return sections


def chunk_section(section: list[str], max_bytes: int) -> list[str]:
    """Split a single section into chunks that fit in max_bytes (including
    code-block wrapper). Splits on trade-block boundaries (blank lines).
    """
    full = "\n".join(section)
    # Reserve wrapper overhead
    budget = max_bytes - WRAPPER_OVERHEAD
    if len(full) <= budget:
        return [full]

    # Find the section header (first divider line)
    header_idx = None
    for i, line in enumerate(section):
        if is_divider(line):
            header_idx = i
            break

    if header_idx is None:
        # No divider — preamble-only section. Shouldn't happen with merge
        # logic above, but fall back to hard split.
        return [full[i:i + budget] for i in range(0, len(full), budget)]

    preamble = section[:header_idx]               # title lines, if first section
    header = section[header_idx]
    cont_header = header.rstrip().replace(
        "  " + DIV, " (cont.)  " + DIV, 1
    )
    body = section[header_idx + 1:]

    # Split body into blocks by blank-line separator
    blocks: list[list[str]] = []
    cur: list[str] = []
    for line in body:
        if line.strip() == "":
            if cur:
                blocks.append(cur)
                cur = []
        else:
            cur.append(line)
    if cur:
        blocks.append(cur)

    # Greedy-pack blocks into chunks
    chunks: list[str] = []
    chunk_lines: list[str] = list(preamble) + ([""] if preamble else []) + [header, ""]
    chunk_size = sum(len(l) + 1 for l in chunk_lines)
    is_first_chunk = True

    for block in blocks:
        block_text = "\n".join(block)
        block_size = len(block_text) + 2  # block + trailing blank line

        if chunk_size + block_size > budget and any(
            l.strip() for l in chunk_lines[header_idx + 1 if is_first_chunk else 1 :]
        ):
            # Flush current chunk
            chunks.append("\n".join(chunk_lines).rstrip())
            # Start new chunk with cont header
            chunk_lines = [cont_header, ""]
            chunk_size = sum(len(l) + 1 for l in chunk_lines)
            is_first_chunk = False

        chunk_lines.extend(block)
        chunk_lines.append("")
        chunk_size += block_size

    # Flush remainder
    if any(l.strip() for l in chunk_lines):
        chunks.append("\n".join(chunk_lines).rstrip())

    return chunks


def main():
    md_path = Path(sys.argv[1])
    md = md_path.read_text()
    lines = md.splitlines()

    sections = split_sections(lines)

    os.makedirs(".pending-notify", exist_ok=True)
    ts = int(time.time())
    seq = 0
    chunks_written = 0

    for sec in sections:
        chunks = chunk_section(sec, MAX_CHUNK_BYTES)
        for chunk in chunks:
            if not chunk.strip():
                continue
            wrapped = "```\n" + chunk + "\n```"
            seq += 1
            fname = f".pending-notify/perps-brief-{ts}-{seq:03d}.signal.md"
            Path(fname).write_text(wrapped)
            print(
                f"postprocess-perps-brief: queued {fname} "
                f"({len(wrapped)} bytes content + wrapper)"
            )
            chunks_written += 1

    print(
        f"postprocess-perps-brief: wrote {chunks_written} pending file(s) "
        f"across {len(sections)} section(s)"
    )


if __name__ == "__main__":
    main()
PY

# Step 6 — Bot embed delivery (V2 parallel path)
# Posts structured embeds to the per-section channels (#perps-context,
# #perps-positions, #perps-signals, #perps-watchlist, #perps-outcomes)
# ALONGSIDE the existing webhook delivery above. The two paths target
# non-overlapping channels — no duplicate messages.
#
# Gating:
#   - DISCORD_BOT_TOKEN unset AND DISCORD_BOT_DRY_RUN unset → skip entirely
#   - DISCORD_BOT_DRY_RUN=1 → run in dry-run (prints embed JSON to stderr,
#     no API calls). Use to preview embeds in workflow logs without
#     touching live channels.
#   - DISCORD_BOT_TOKEN set → live POST to Discord.
#
# Failure is best-effort: the bot path is parallel; if it errors, the
# webhook delivery above has already happened, so the operator still
# gets the brief. We log a warning and exit 0.
echo "postprocess-perps-brief: step 6/6 — bot embed delivery (V2 parallel)"

if [ ! -f "scripts/embed-perps-brief.py" ]; then
  echo "postprocess-perps-brief: embed-perps-brief.py missing — skipping bot delivery"
elif [ -z "${DISCORD_BOT_TOKEN:-}" ] && [ "${DISCORD_BOT_DRY_RUN:-}" != "1" ]; then
  echo "postprocess-perps-brief: DISCORD_BOT_TOKEN unset and DRY_RUN off — skipping bot delivery"
else
  BOT_MODE="--live"
  if [ "${DISCORD_BOT_DRY_RUN:-}" = "1" ]; then
    BOT_MODE="--dry-run"
    echo "postprocess-perps-brief: bot dry-run requested via DISCORD_BOT_DRY_RUN=1"
  fi
  if ! python3 scripts/embed-perps-brief.py "$BOT_MODE"; then
    echo "::warning::postprocess-perps-brief: bot embed delivery exited non-zero (non-fatal — webhook path already delivered)"
  fi
fi

echo "postprocess-perps-brief: done. Section pending files written; post-run notify step will deliver each."

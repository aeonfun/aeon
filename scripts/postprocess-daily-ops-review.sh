#!/usr/bin/env bash
# Post-process for daily-ops-review.
#
# Converts the .outputs/daily-ops-review.md artifact into an embed and
# posts it to the unified #aeon-ops developer channel via the bot.
# Replaces the previous webhook delivery via ./notify --signal which
# routed through DISCORD_WEBHOOK_MAP[daily-ops-review].
#
# Skill-name guard same as the perps-brief postprocess: bail when this
# script runs in a non-daily-ops-review dispatch.

set -euo pipefail

if [ "${SKILL_NAME:-}" != "daily-ops-review" ]; then
  echo "postprocess-daily-ops-review: skipping (SKILL_NAME='${SKILL_NAME:-}', not daily-ops-review)"
  exit 0
fi

ARTIFACT_PATH=".outputs/daily-ops-review.md"

if [ ! -f "$ARTIFACT_PATH" ]; then
  echo "::warning::postprocess-daily-ops-review: $ARTIFACT_PATH missing — skill didn't write?"
  exit 0
fi

if [ ! -f "scripts/embed-daily-ops-review.py" ]; then
  echo "::error::postprocess-daily-ops-review: scripts/embed-daily-ops-review.py missing"
  exit 1
fi

# Gating mirrors the other postprocess scripts:
#   - DISCORD_BOT_TOKEN unset AND DISCORD_BOT_DRY_RUN unset → skip
#   - DISCORD_BOT_DRY_RUN=1 → logs embed JSON, no API call
#   - DISCORD_BOT_TOKEN set → live POST
#
# Failure is best-effort: warn + exit 0. The artifact stays on disk.
if [ -z "${DISCORD_BOT_TOKEN:-}" ] && [ "${DISCORD_BOT_DRY_RUN:-}" != "1" ]; then
  echo "postprocess-daily-ops-review: DISCORD_BOT_TOKEN unset and DRY_RUN off — skipping bot delivery"
  exit 0
fi

BOT_MODE="--live"
if [ "${DISCORD_BOT_DRY_RUN:-}" = "1" ]; then
  BOT_MODE="--dry-run"
  echo "postprocess-daily-ops-review: dry-run requested via DISCORD_BOT_DRY_RUN=1"
fi

echo "postprocess-daily-ops-review: posting ops embed"
if ! python3 scripts/embed-daily-ops-review.py "$BOT_MODE"; then
  echo "::warning::postprocess-daily-ops-review: embed delivery exited non-zero (non-fatal)"
fi

echo "postprocess-daily-ops-review: done"

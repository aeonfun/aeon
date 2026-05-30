#!/usr/bin/env bash
# Post-process for judgement-audit (V2 validation layer).
#
# Reads .outputs/judgement-audit.stats.json (deterministic stats, from
# the prefetch step) AND .outputs/judgement-audit.data.json (Claude's
# narrative + insights + per-trade postmortems) and posts a single
# audit embed to #perps-outcomes via the bot.
#
# Skill-name guard same as the perps-brief postprocess: bail when this
# script runs in a non-judgement-audit dispatch.

set -euo pipefail

if [ "${SKILL_NAME:-}" != "judgement-audit" ]; then
  echo "postprocess-judgement-audit: skipping (SKILL_NAME='${SKILL_NAME:-}', not judgement-audit)"
  exit 0
fi

STATS_PATH=".outputs/judgement-audit.stats.json"
DATA_PATH=".outputs/judgement-audit.data.json"

if [ ! -f "$STATS_PATH" ]; then
  echo "::error::postprocess-judgement-audit: $STATS_PATH not present (prefetch failed?)"
  exit 1
fi

if [ ! -f "$DATA_PATH" ]; then
  echo "::warning::postprocess-judgement-audit: $DATA_PATH not present — Claude narrative missing, posting stats-only embed"
fi

if [ ! -f "scripts/embed-judgement-audit.py" ]; then
  echo "::error::postprocess-judgement-audit: scripts/embed-judgement-audit.py missing"
  exit 1
fi

# Gating identical to the perps-brief bot delivery:
#   - DISCORD_BOT_TOKEN unset AND DISCORD_BOT_DRY_RUN unset → skip
#   - DISCORD_BOT_DRY_RUN=1 → dry-run (logs JSON, no API calls)
#   - DISCORD_BOT_TOKEN set → live POST
#
# Failure is best-effort: warn + exit 0. The artifacts are on disk for
# any later re-delivery.
if [ -z "${DISCORD_BOT_TOKEN:-}" ] && [ "${DISCORD_BOT_DRY_RUN:-}" != "1" ]; then
  echo "postprocess-judgement-audit: DISCORD_BOT_TOKEN unset and DRY_RUN off — skipping bot delivery"
  exit 0
fi

BOT_MODE="--live"
if [ "${DISCORD_BOT_DRY_RUN:-}" = "1" ]; then
  BOT_MODE="--dry-run"
  echo "postprocess-judgement-audit: dry-run requested via DISCORD_BOT_DRY_RUN=1"
fi

# Window: read from optional AUDIT_WINDOW env, default to 30d. The
# workflow can set this to 7d/all when dispatched on-demand.
WINDOW="${AUDIT_WINDOW:-30d}"

echo "postprocess-judgement-audit: posting audit embed for window=$WINDOW"
if ! python3 scripts/embed-judgement-audit.py \
      --window "$WINDOW" \
      $BOT_MODE; then
  echo "::warning::postprocess-judgement-audit: embed delivery exited non-zero (non-fatal)"
fi

echo "postprocess-judgement-audit: done"

#!/usr/bin/env bash
# Pre-fetch for judgement-audit (V2 validation layer).
#
# Runs scripts/audit-judgement.py to compute the deterministic stats
# artifact BEFORE Claude runs. The skill (skills/judgement-audit/SKILL.md)
# consumes the artifact and writes a structured analysis on top of it.
#
# Skill-name guard: the workflow loops scripts/prefetch-*.sh for every
# dispatch, so we bail early when this script runs in a non-judgement-audit
# context.

set -euo pipefail

# The aeon.yml prefetch loop passes the skill name as $1 (positional arg).
# Other prefetch scripts in this repo follow the same convention.
SKILL="${1:-${SKILL_NAME:-}}"

if [ "$SKILL" != "judgement-audit" ]; then
  echo "prefetch-judgement-audit: skipping (skill='$SKILL', not judgement-audit)"
  exit 0
fi

if [ ! -f "scripts/audit-judgement.py" ]; then
  echo "::error::prefetch-judgement-audit: scripts/audit-judgement.py missing"
  exit 1
fi

echo "prefetch-judgement-audit: computing deterministic audit stats"

# V1_LOCK_DATE flows from the workflow env to the audit module via env.
# When set, the "all"-window stats filter to entries closed on or after
# this date (matches the operator's partial-reset baseline).
if ! python3 scripts/audit-judgement.py \
      --output .outputs/judgement-audit.stats.json; then
  echo "::error::prefetch-judgement-audit: stats computation failed"
  exit 1
fi

echo "prefetch-judgement-audit: wrote .outputs/judgement-audit.stats.json"
echo "prefetch-judgement-audit: done"

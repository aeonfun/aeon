#!/usr/bin/env bash
# skill_requires — the API-key names a skill declares in its `requires:` frontmatter,
# one per line, with the `?` "works-better" marker stripped. Both tiers are returned
# (bare = required, `?` = optional/works-better); the caller injects whichever secret
# actually exists. This is the allowlist for per-skill, least-privilege secret env:
# a skill sees ONLY the keys it declares here — nothing else from the secret store.
#
# Format parsed (matches bin/generate-skills-json):
#   requires: [COINGECKO_API_KEY?, ALCHEMY_API_KEY?, BASE_RPC_URL?]
#
# Usage: skill_requires.sh <skill-name>
set -euo pipefail
f="skills/${1:?skill name required}/SKILL.md"
[ -f "$f" ] || exit 0
awk '/^---$/{n++; next} n==1 && /^requires:[[:space:]]*\[/{
       sub(/^requires:[[:space:]]*\[/,""); sub(/\].*/,"");
       gsub(/[[:space:]]/,""); print; exit
     }' "$f" \
  | tr ',' '\n' | sed 's/?[[:space:]]*$//' \
  | grep -E '^[A-Z][A-Z0-9_]{2,}$' || true

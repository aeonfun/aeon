#!/usr/bin/env bash
set -eo pipefail

# check-skill-categories.sh — Lint that every skills/*/SKILL.md declares a valid
# `category:` in its frontmatter. Category is the single source of truth for which
# pack a skill joins (see docs/skill-packs.md); a missing or typo'd one would
# silently dump the skill into the Lab catch-all instead of its intended pack.
#
# Run locally:  bash scripts/check-skill-categories.sh
# Exits 0 if every skill has a known category, 1 otherwise (with a report).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$ROOT/skills"

# Valid frontmatter categories — the 7 skills.json domain categories. `core` and
# `fleet` are curated *packs* (resolved from packs.config.json via an allowlist /
# explicit skills list), NOT author-selectable category values, so neither is
# valid here. A skill that belongs to the core spine or fleet pack still declares
# its real domain (e.g. `meta`, `dev`, `crypto`) as its category.
VALID="research dev crypto onchain-security social productivity meta"

missing=()
invalid=()

for skill_file in "$SKILLS_DIR"/*/SKILL.md; do
  [[ -f "$skill_file" ]] || continue
  slug="$(basename "$(dirname "$skill_file")")"

  cat=$(awk '/^---$/{n++; next} n==1 && /^category:/{sub(/^category:[[:space:]]*/,""); gsub(/"/,""); gsub(/[[:space:]]*$/,""); print; exit}' "$skill_file")

  if [[ -z "$cat" ]]; then
    missing+=("$slug")
    continue
  fi
  if [[ " $VALID " != *" $cat "* ]]; then
    invalid+=("$slug ($cat)")
  fi
done

status=0

if [[ ${#missing[@]} -gt 0 ]]; then
  status=1
  echo "::error::${#missing[@]} skill(s) missing a 'category:' in SKILL.md frontmatter:"
  printf '  - %s\n' "${missing[@]}"
fi

if [[ ${#invalid[@]} -gt 0 ]]; then
  status=1
  echo "::error::${#invalid[@]} skill(s) with an unknown category (valid: $VALID):"
  printf '  - %s\n' "${invalid[@]}"
fi

if [[ "$status" -eq 0 ]]; then
  echo "skill-categories: OK — every skill declares a valid category."
else
  echo ""
  echo "Fix: set 'category: <pack>' in each SKILL.md frontmatter (one of: $VALID)."
  echo "See docs/skill-packs.md. New skills: bin/new-from-template ... --category <pack>."
fi

exit "$status"

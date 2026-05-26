#!/usr/bin/env bash
# skill-lint.sh — validate every skills/*/SKILL.md against Aeon's prose conventions
#
# Usage:
#   bash skill-lint.sh                       # lint all skills
#   bash skill-lint.sh skills/foo            # lint one skill
#   bash skill-lint.sh --json                # machine-readable output
#
# Exit codes:
#   0 — all skills pass
#   1 — at least one lint failure
#   2 — usage error
#
# Final location: skills/_lint/skill-lint.sh
# Invoked from: .github/workflows/lint.yml
#
# Zero dependencies beyond bash + awk + grep + sed.

set -uo pipefail

# Allowed tags from the fixed taxonomy.
ALLOWED_TAGS="content crypto dev meta news research social"

FAIL_COUNT=0
PASS_COUNT=0
JSON_MODE=0
TARGETS=()

# --- arg parsing -------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=1 ;;
    -*)
      echo "unknown flag: $arg" >&2
      exit 2
      ;;
    *) TARGETS+=("$arg") ;;
  esac
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  # Default: lint everything under skills/ that has a SKILL.md.
  while IFS= read -r f; do
    TARGETS+=("$(dirname "$f")")
  done < <(find skills -maxdepth 2 -name SKILL.md 2>/dev/null | sort)
fi

# --- lint primitives ---------------------------------------------------------

# Emit a failure record.
fail() {
  local file="$1" reason="$2"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  if [ "$JSON_MODE" -eq 1 ]; then
    printf '{"file":"%s","status":"fail","reason":"%s"}\n' "$file" "$reason"
  else
    printf '✗ %s — %s\n' "$file" "$reason"
  fi
}

# Emit a pass record.
pass() {
  local file="$1"
  PASS_COUNT=$((PASS_COUNT + 1))
  if [ "$JSON_MODE" -eq 1 ]; then
    printf '{"file":"%s","status":"pass"}\n' "$file"
  else
    printf '✓ %s\n' "$file"
  fi
}

# Lint one SKILL.md.
lint_one() {
  local dir="$1"
  local file="$dir/SKILL.md"

  if [ ! -f "$file" ]; then
    fail "$file" "missing"
    return
  fi

  local content; content=$(cat "$file")
  local errors=()

  # --- Frontmatter ------------------------------------------------------------
  local fm; fm=$(awk '/^---$/{f++; next} f==1' "$file")
  [ -z "$fm" ] && errors+=("no YAML frontmatter")

  # Required keys.
  grep -q "^name:" <<<"$fm"        || errors+=("frontmatter missing 'name'")
  grep -q "^description:" <<<"$fm" || errors+=("frontmatter missing 'description'")
  grep -q "^var:" <<<"$fm"         || errors+=("frontmatter missing 'var'")
  grep -q "^tags:" <<<"$fm"        || errors+=("frontmatter missing 'tags'")

  # description length ≤ 90 chars.
  local desc; desc=$(grep "^description:" <<<"$fm" | sed -E 's/^description:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/')
  if [ ${#desc} -gt 90 ]; then
    errors+=("description >90 chars (${#desc})")
  fi

  # Tags from allowed set, ≤3.
  local tags_line; tags_line=$(grep "^tags:" <<<"$fm")
  local tags_inner; tags_inner=$(printf '%s' "$tags_line" | sed -E 's/^tags:[[:space:]]*\[([^]]*)\].*/\1/' | tr -d ' "')
  local tag_count=0
  if [ -n "$tags_inner" ]; then
    IFS=',' read -ra tag_array <<< "$tags_inner"
    tag_count=${#tag_array[@]}
    for t in "${tag_array[@]}"; do
      if ! grep -qw "$t" <<<"$ALLOWED_TAGS"; then
        errors+=("tag '$t' not in allowed set: $ALLOWED_TAGS")
      fi
    done
  fi
  if [ "$tag_count" -gt 3 ]; then
    errors+=("more than 3 tags ($tag_count)")
  fi

  # --- Prose conventions ------------------------------------------------------
  # Var documentation blockquote.
  grep -q '^>[[:space:]]*\*\*\${var}\*\*[[:space:]]*—' "$file" || \
    errors+=("missing var-doc blockquote: > **\${var}** — …")

  # Today statement.
  grep -qF 'Today is ${today}' "$file" || \
    errors+=("missing \"Today is \${today}.\" task statement")

  # Numbered steps.
  grep -qE '^[0-9]+\.[[:space:]]*\*\*' "$file" || \
    errors+=("no numbered steps detected")

  # Penultimate Log step (we just check Log step exists with the right shape).
  grep -qE '^[0-9]+\.[[:space:]]*\*\*Log\.\*\*' "$file" || \
    errors+=("missing **Log.** step")

  # Notify step references ./notify.
  if ! grep -qE '^[0-9]+\.[[:space:]]*\*\*Notify\.\*\*' "$file"; then
    errors+=("missing **Notify.** step")
  elif ! grep -q '\./notify' "$file"; then
    errors+=("Notify step does not reference ./notify")
  fi

  # Sandbox note section.
  grep -q '^## Sandbox note' "$file" || \
    errors+=("missing '## Sandbox note' section")

  # --- Verdict ----------------------------------------------------------------
  if [ ${#errors[@]} -eq 0 ]; then
    pass "$file"
  else
    for e in "${errors[@]}"; do
      fail "$file" "$e"
    done
  fi
}

# --- main loop ---------------------------------------------------------------
for t in "${TARGETS[@]}"; do
  lint_one "$t"
done

if [ "$JSON_MODE" -eq 0 ]; then
  echo "---"
  echo "PASS: $PASS_COUNT    FAIL: $FAIL_COUNT"
fi

[ "$FAIL_COUNT" -eq 0 ] && exit 0 || exit 1

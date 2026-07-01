#!/usr/bin/env bash
# smoke.sh — Static validation of all SKILL.md files
#
# Usage:
#   ./skills/skill-health/tests/smoke.sh              # Validate all skills
#   ./skills/skill-health/tests/smoke.sh skill-name   # Validate one skill
#   ./skills/skill-health/tests/smoke.sh --dry-run    # Dry-run canary skills (format check only)
#
# Exit codes:
#   0 = all checks passed
#   1 = one or more checks failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"
AEON_YML="$REPO_ROOT/aeon.yml"

# Known secrets that skills are allowed to reference
KNOWN_SECRETS=(
  ANTHROPIC_API_KEY
  CLAUDE_CODE_OAUTH_TOKEN
  GITHUB_TOKEN
  GH_GLOBAL
  TELEGRAM_BOT_TOKEN
  TELEGRAM_CHAT_ID
  DISCORD_BOT_TOKEN
  DISCORD_CHANNEL_ID
  DISCORD_WEBHOOK_URL
  SLACK_BOT_TOKEN
  SLACK_CHANNEL_ID
  SLACK_WEBHOOK_URL
  XAI_API_KEY
  COINGECKO_API_KEY
  ALCHEMY_API_KEY
)

# Canary skills for dry-run structural checks
CANARY_SKILLS=(heartbeat token-movers operator-scorecard)

# Colors (disabled if not a terminal or CI)
if [[ -t 1 ]] && [[ "${CI:-false}" != "true" ]]; then
  RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; NC=''
fi

FAIL_COUNT=0
WARN_COUNT=0
PASS_COUNT=0
DRY_RUN=false
TARGET_SKILL=""

# Parse args
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: $0 [skill-name] [--dry-run]"
      echo "  skill-name   Validate only this skill (e.g. 'heartbeat')"
      echo "  --dry-run    Also run structural dry-run checks on canary skills"
      exit 0
      ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *)  TARGET_SKILL="$arg" ;;
  esac
done

# ---------- Helpers ----------

pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo -e "  ${YELLOW}WARN${NC} $1"; WARN_COUNT=$((WARN_COUNT + 1)); }

# Extract a frontmatter field value from a SKILL.md file
# Usage: get_frontmatter <file> <field>
get_frontmatter() {
  local file="$1" field="$2"
  # Extract between the first two --- lines, then grep for the field
  awk '/^---/{n++; if(n==2) exit} n==1' "$file" | grep -E "^${field}:" | head -1 | sed "s/^${field}:[[:space:]]*//" | tr -d "'\""
}

# ---------- Validate a single SKILL.md ----------

validate_skill() {
  local skill_dir="$1"
  local skill_name
  skill_name=$(basename "$skill_dir")
  local skill_file="$skill_dir/SKILL.md"
  local skill_ok=true

  echo -e "${BOLD}${skill_name}${NC}"

  # 1. File exists and is non-empty
  if [[ ! -f "$skill_file" ]]; then
    fail "SKILL.md not found at $skill_file"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if [[ ! -s "$skill_file" ]]; then
    fail "SKILL.md is empty"
    skill_ok=false
  fi

  # 2. Frontmatter block present (opening and closing ---)
  local fm_opens fm_closes
  fm_opens=$(grep -c "^---$" "$skill_file" 2>/dev/null || true)
  if [[ "$fm_opens" -lt 2 ]]; then
    fail "missing YAML frontmatter (expected opening and closing ---)"
    skill_ok=false
  fi

  # 3. Required frontmatter fields: name, description
  local fm_name fm_description
  fm_name=$(get_frontmatter "$skill_file" "name")
  fm_description=$(get_frontmatter "$skill_file" "description")

  if [[ -z "$fm_name" ]]; then
    fail "frontmatter missing 'name' field"
    skill_ok=false
  else
    pass "name: $fm_name"
  fi

  if [[ -z "$fm_description" ]]; then
    fail "frontmatter missing 'description' field"
    skill_ok=false
  else
    pass "description present"
  fi

  # 4. Skill name in frontmatter matches directory name (case-insensitive slug check)
  if [[ -n "$fm_name" ]]; then
    local fm_slug
    fm_slug=$(echo "$fm_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
    # Loose check: directory name should appear in slugified frontmatter name (allow longer names)
    if ! echo "$fm_slug" | grep -qi "${skill_name}"; then
      warn "frontmatter name '${fm_name}' may not match directory '${skill_name}' (slug: ${fm_slug})"
    fi
  fi

  # 5. Body content exists after frontmatter (skill has actual instructions)
  local body_lines
  body_lines=$(awk '/^---$/{n++} n>=2{print}' "$skill_file" | grep -v "^---$" | grep -c '[^[:space:]]' 2>/dev/null || true)
  if [[ "$body_lines" -lt 3 ]]; then
    fail "skill body has fewer than 3 non-empty lines — likely missing instructions"
    skill_ok=false
  else
    pass "body has $body_lines instruction lines"
  fi

  # 6. No unknown secret references (catch typos in secret names)
  local secret_refs
  secret_refs=$(grep -oE '\$\{?[A-Z][A-Z0-9_]{4,}\}?' "$skill_file" 2>/dev/null | sed 's/[${}]//g' | sort -u || true)
  if [[ -n "$secret_refs" ]]; then
    while IFS= read -r ref; do
      local known=false
      for s in "${KNOWN_SECRETS[@]}"; do
        if [[ "$ref" == "$s" ]]; then
          known=true
          break
        fi
      done
      # Skip common non-secret uppercase vars (TODAY, SKILL_NAME, etc.)
      if [[ "$ref" =~ ^(TODAY|SKILL_NAME|VAR|MODEL|GITHUB_OUTPUT|GITHUB_STEP_SUMMARY|CI|PATH|HOME|USER|PWD|SHELL)$ ]]; then
        known=true
      fi
      if [[ "$known" == "false" ]]; then
        warn "references unknown variable '\$$ref' — verify it's in aeon.yml env or a known secret"
      fi
    done <<< "$secret_refs"
  fi

  # 7. Validate cron expression if skill is registered in aeon.yml with a schedule
  if [[ -f "$AEON_YML" ]]; then
    local cron_expr
    cron_expr=$(grep -A3 "^\s*${skill_name}:" "$AEON_YML" | grep "schedule:" | head -1 | sed 's/.*schedule:[[:space:]]*//' | tr -d '"' | tr -d "'" || true)
    if [[ -n "$cron_expr" ]]; then
      # Basic cron validation: must have exactly 5 space-separated fields
      local field_count
      field_count=$(echo "$cron_expr" | awk '{print NF}')
      if [[ "$field_count" -ne 5 ]]; then
        fail "invalid cron expression in aeon.yml for $skill_name: '$cron_expr' (expected 5 fields, got $field_count)"
        skill_ok=false
      else
        # Validate each field is a valid cron token: digits, *, /, -, comma
        local field_idx=1
        for field in $cron_expr; do
          if ! echo "$field" | grep -qE '^(\*|[0-9]+([,\-\/][0-9\*]+)*)$'; then
            fail "cron field $field_idx has invalid value: '$field'"
            skill_ok=false
          fi
          field_idx=$((field_idx + 1))
        done
        if [[ "$skill_ok" == "true" ]]; then
          pass "cron: $cron_expr"
        fi
      fi
    fi
  fi

  # 8. No placeholder text (common accidental leftovers)
  local placeholders
  placeholders=$(grep -inE '(TODO|FIXME|PLACEHOLDER|\bTBD\b|INSERT_HERE|<YOUR_|your-api-key)' "$skill_file" 2>/dev/null | grep -v "^#" || true)
  if [[ -n "$placeholders" ]]; then
    warn "contains placeholder text — review before shipping"
    echo "$placeholders" | head -3 | while IFS= read -r line; do
      echo -e "    ${YELLOW}>${NC} $line"
    done
  fi

  # Result for this skill
  if [[ "$skill_ok" == "true" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
  fi
  echo ""
}

# ---------- Dry-run structural check ----------

dry_run_check() {
  local skill_name="$1"
  local skill_file="$SKILLS_DIR/$skill_name/SKILL.md"

  echo -e "${BOLD}dry-run: $skill_name${NC}"

  if [[ ! -f "$skill_file" ]]; then
    warn "$skill_name not found — skipping dry-run (this skill may not be installed)"
    echo ""
    return
  fi

  # Check that the skill references ./notify (expected for notification skills)
  if grep -q '\./notify' "$skill_file"; then
    pass "references ./notify"
  else
    warn "does not reference ./notify — may not send notifications"
  fi

  # Check that the skill references memory/logs (expected for logging)
  if grep -qiE 'memory/logs|log.*today|today.*log' "$skill_file"; then
    pass "references memory/logs for logging"
  else
    warn "no memory/logs reference — may not persist output"
  fi

  # Check that the skill has at least one numbered step
  if grep -qE '^[0-9]+\.' "$skill_file"; then
    local step_count
    step_count=$(grep -cE '^[0-9]+\.' "$skill_file" || true)
    pass "$step_count numbered steps found"
  else
    warn "no numbered steps found — skill may lack clear execution order"
  fi

  echo ""
}

# ---------- Main ----------

echo -e "${BOLD}Aeon Skill Smoke Tests${NC}"
echo "======================"
echo ""

# Collect skills to validate
declare -a SKILL_DIRS=()

if [[ -n "$TARGET_SKILL" ]]; then
  skill_path="$SKILLS_DIR/$TARGET_SKILL"
  if [[ ! -d "$skill_path" ]]; then
    echo -e "${RED}ERROR${NC}: Skill directory not found: $skill_path" >&2
    exit 2
  fi
  SKILL_DIRS=("$skill_path")
else
  # All skill directories that contain a SKILL.md
  while IFS= read -r d; do
    SKILL_DIRS+=("$d")
  done < <(find "$SKILLS_DIR" -maxdepth 1 -mindepth 1 -type d | sort)
fi

# Run validation
for skill_dir in "${SKILL_DIRS[@]}"; do
  validate_skill "$skill_dir"
done

# Dry-run structural checks on canary skills
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${BOLD}Dry-run Checks (canary skills)${NC}"
  echo "================================"
  echo ""
  for canary in "${CANARY_SKILLS[@]}"; do
    dry_run_check "$canary"
  done
fi

# Summary
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "======================"
echo -e "Validated: $TOTAL skills"
echo -e "  ${GREEN}Pass${NC}: $PASS_COUNT"
if [[ $WARN_COUNT -gt 0 ]]; then
  echo -e "  ${YELLOW}Warn${NC}: $WARN_COUNT"
fi
if [[ $FAIL_COUNT -gt 0 ]]; then
  echo -e "  ${RED}Fail${NC}: $FAIL_COUNT"
fi
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo -e "${RED}Smoke tests FAILED — $FAIL_COUNT skill(s) have errors that must be fixed.${NC}"
  exit 1
fi

if [[ $WARN_COUNT -gt 0 ]]; then
  echo -e "${YELLOW}Smoke tests passed with $WARN_COUNT warning(s).${NC}"
else
  echo -e "${GREEN}All smoke tests passed.${NC}"
fi
exit 0

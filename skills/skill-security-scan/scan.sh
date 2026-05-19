#!/usr/bin/env bash
set -euo pipefail

# scan.sh — Security scanner for SKILL.md files
#
# Usage:
#   ./skills/skill-security-scan/scan.sh <path-to-SKILL.md>
#   ./skills/skill-security-scan/scan.sh skills/my-skill/SKILL.md
#   ./skills/skill-security-scan/scan.sh --all              # Scan all skills
#   ./skills/skill-security-scan/scan.sh --all --json        # JSON output
#
# Exit codes:
#   0 = PASS (no HIGH findings)
#   1 = FAIL (HIGH severity findings detected)
#   2 = Usage error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TRUSTED_FILE="$REPO_ROOT/skills/security/trusted-sources.txt"

# Colors (disabled if not a terminal)
if [[ -t 1 ]]; then
  RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; NC=''
fi

JSON_OUTPUT=false
SCAN_ALL=false
FILES=()

usage() {
  echo "Usage: $0 <SKILL.md path> [--json]"
  echo "       $0 --all [--json]"
  exit 2
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) SCAN_ALL=true; shift ;;
    --json) JSON_OUTPUT=true; shift ;;
    --help|-h) usage ;;
    -*) echo "Unknown option: $1" >&2; usage ;;
    *) FILES+=("$1"); shift ;;
  esac
done

if [[ "$SCAN_ALL" == "true" ]]; then
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(find "$REPO_ROOT/skills" -maxdepth 2 -name "SKILL.md" -type f 2>/dev/null | sort)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No files to scan." >&2
  usage
fi

# Load trusted sources
TRUSTED_OWNERS=()
TRUSTED_REPOS=()
if [[ -f "$TRUSTED_FILE" ]]; then
  while IFS= read -r line; do
    line="${line%%#*}"  # strip comments
    line="${line// /}"  # strip whitespace
    [[ -z "$line" ]] && continue
    if [[ "$line" == */* ]]; then
      TRUSTED_REPOS+=("$line")
    else
      TRUSTED_OWNERS+=("$line")
    fi
  done < "$TRUSTED_FILE"
fi

# ---------- Pattern definitions ----------

# HIGH severity: immediate risk of code execution or data exfiltration
HIGH_PATTERNS=(
  # Shell injection
  'eval\s'
  'eval\('
  '`[^`]*\$'
  '\$\([^)]*\$'
  # Secret exfiltration — curl/wget piping secrets or env vars
  'curl.*\$[A-Z_]'
  'wget.*\$[A-Z_]'
  'curl.*\$\{'
  'wget.*\$\{'
  'curl.*--data.*secret'
  'curl.*--data.*token'
  'curl.*--data.*password'
  'curl.*--data.*api.key'
  # Env var exfiltration patterns
  'printenv.*\|.*curl'
  'printenv.*\|.*wget'
  'env\s.*\|.*curl'
  'cat.*/proc/.*environ'
  # Direct exfil of known secrets
  '\$TELEGRAM_BOT_TOKEN'
  '\$DISCORD_BOT_TOKEN'
  '\$SLACK_BOT_TOKEN'
  '\$GITHUB_TOKEN.*curl'
  '\$GITHUB_TOKEN.*wget'
  # Prompt injection
  '[Ii]gnore\s+(all\s+)?previous\s+instructions'
  '[Ii]gnore\s+(all\s+)?prior\s+instructions'
  '[Yy]ou\s+are\s+now\s+'
  '[Ff]orget\s+(all\s+)?(your\s+)?instructions'
  '[Dd]isregard\s+(all\s+)?previous'
  '[Oo]verride\s+(all\s+)?rules'
  # Destructive commands
  'rm\s+-rf\s+/'
  'rm\s+-rf\s+\*'
  'rm\s+-rf\s+~'
  'mkfs\.'
  'dd\s+if=.*of=/dev/'
  ':(){.*};:'
  'git\s+push\s+--force\s+origin\s+main'
  'git\s+push\s+-f\s+origin\s+main'
)

# MEDIUM severity: suspicious patterns that may or may not be intentional
MEDIUM_PATTERNS=(
  # Path traversal
  '\.\./\.\.'
  '\.\./.*\.\.'
  # Absolute paths outside typical dirs
  '/etc/passwd'
  '/etc/shadow'
  '~/.ssh'
  '~/.gnupg'
  '~/.aws'
  '~/.config'
  # Network calls to non-standard destinations
  'curl\s+http://'
  'wget\s+http://'
  # Unquoted variable expansion in bash blocks
  'rm\s.*\$[A-Z]'
  'chmod\s+777'
  'chmod\s+-R\s+777'
  # Git force operations
  'git\s+push\s+--force'
  'git\s+push\s+-f\b'
  'git\s+reset\s+--hard'
  'git\s+clean\s+-fd'
  # Base64 encoded payloads
  'base64\s+-d'
  'base64\s+--decode'
  # Process manipulation
  'kill\s+-9'
  'killall'
  'pkill'
)

# LOW severity: worth noting but usually harmless
LOW_PATTERNS=(
  # Broad file operations
  'find\s+/\s'
  'cat\s+/etc/'
  # Network without explicit https
  'fetch\('
  'XMLHttpRequest'
  # Write operations outside skills/
  'tee\s+/'
  '>\s+/'
)

# ---------- Scanner ----------

TOTAL_PASS=0
TOTAL_WARN=0
TOTAL_FAIL=0
JSON_RESULTS=""

scan_file() {
  local file="$1"
  local skill_name
  skill_name=$(basename "$(dirname "$file")")

  if [[ ! -f "$file" ]]; then
    echo -e "${RED}ERROR${NC}: File not found: $file"
    return 1
  fi

  local content
  content=$(cat "$file")

  local highs=()
  local mediums=()
  local lows=()

  # Check HIGH patterns
  for pattern in "${HIGH_PATTERNS[@]}"; do
    local matches
    matches=$(grep -nE "$pattern" "$file" 2>/dev/null || true)
    if [[ -n "$matches" ]]; then
      while IFS= read -r match; do
        local line_num="${match%%:*}"
        local line_content="${match#*:}"
        line_content="${line_content:0:120}"  # truncate
        highs+=("L${line_num}: ${line_content} [pattern: ${pattern}]")
      done <<< "$matches"
    fi
  done

  # Check MEDIUM patterns
  for pattern in "${MEDIUM_PATTERNS[@]}"; do
    local matches
    matches=$(grep -nE "$pattern" "$file" 2>/dev/null || true)
    if [[ -n "$matches" ]]; then
      while IFS= read -r match; do
        local line_num="${match%%:*}"
        local line_content="${match#*:}"
        line_content="${line_content:0:120}"
        mediums+=("L${line_num}: ${line_content} [pattern: ${pattern}]")
      done <<< "$matches"
    fi
  done

  # Check LOW patterns
  for pattern in "${LOW_PATTERNS[@]}"; do
    local matches
    matches=$(grep -nE "$pattern" "$file" 2>/dev/null || true)
    if [[ -n "$matches" ]]; then
      while IFS= read -r match; do
        local line_num="${match%%:*}"
        local line_content="${match#*:}"
        line_content="${line_content:0:120}"
        lows+=("L${line_num}: ${line_content} [pattern: ${pattern}]")
      done <<< "$matches"
    fi
  done

  # Determine result
  local status="PASS"
  if [[ ${#highs[@]} -gt 0 ]]; then
    status="FAIL"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  elif [[ ${#mediums[@]} -gt 0 ]]; then
    status="WARN"
    TOTAL_WARN=$((TOTAL_WARN + 1))
  else
    TOTAL_PASS=$((TOTAL_PASS + 1))
  fi

  # Output
  if [[ "$JSON_OUTPUT" == "true" ]]; then
    local json_highs="[]" json_mediums="[]" json_lows="[]"
    if [[ ${#highs[@]} -gt 0 ]]; then
      json_highs=$(printf '%s\n' "${highs[@]}" | jq -R -s 'split("\n") | map(select(length > 0))')
    fi
    if [[ ${#mediums[@]} -gt 0 ]]; then
      json_mediums=$(printf '%s\n' "${mediums[@]}" | jq -R -s 'split("\n") | map(select(length > 0))')
    fi
    if [[ ${#lows[@]} -gt 0 ]]; then
      json_lows=$(printf '%s\n' "${lows[@]}" | jq -R -s 'split("\n") | map(select(length > 0))')
    fi
    local entry
    entry=$(jq -n \
      --arg skill "$skill_name" \
      --arg status "$status" \
      --arg file "$file" \
      --argjson high "$json_highs" \
      --argjson medium "$json_mediums" \
      --argjson low "$json_lows" \
      '{skill: $skill, status: $status, file: $file, high: $high, medium: $medium, low: $low}')
    if [[ -n "$JSON_RESULTS" ]]; then
      JSON_RESULTS="${JSON_RESULTS},${entry}"
    else
      JSON_RESULTS="${entry}"
    fi
  else
    case "$status" in
      FAIL) echo -e "${RED}[FAIL]${NC} $skill_name ($file)" ;;
      WARN) echo -e "${YELLOW}[WARN]${NC} $skill_name ($file)" ;;
      PASS) echo -e "${GREEN}[PASS]${NC} $skill_name ($file)" ;;
    esac

    # Bash 3.2 (macOS default) treats `"${arr[@]}"` as unbound under `set -u`
    # when the array has zero elements, so each loop is gated on length first.
    if [[ ${#highs[@]} -gt 0 ]]; then
      for h in "${highs[@]}"; do
        echo -e "  ${RED}HIGH${NC}: $h"
      done
    fi
    if [[ ${#mediums[@]} -gt 0 ]]; then
      for m in "${mediums[@]}"; do
        echo -e "  ${YELLOW}MEDIUM${NC}: $m"
      done
    fi
    if [[ ${#lows[@]} -gt 0 ]]; then
      for l in "${lows[@]}"; do
        echo -e "  ${CYAN}LOW${NC}: $l"
      done
    fi
  fi
}

# Run scans
echo "Aeon Skill Security Scanner"
echo "==========================="
echo "Scanning ${#FILES[@]} file(s)..."
echo ""

for file in "${FILES[@]}"; do
  scan_file "$file"
done

# Summary
echo ""
echo "==========================="
TOTAL=$((TOTAL_PASS + TOTAL_WARN + TOTAL_FAIL))
echo "Scanned: $TOTAL | Pass: $TOTAL_PASS | Warn: $TOTAL_WARN | Fail: $TOTAL_FAIL"

if [[ "$JSON_OUTPUT" == "true" ]]; then
  echo ""
  echo "--- JSON ---"
  echo "[${JSON_RESULTS}]" | jq .
fi

# Exit code reflects worst finding
if [[ $TOTAL_FAIL -gt 0 ]]; then
  exit 1
fi
exit 0

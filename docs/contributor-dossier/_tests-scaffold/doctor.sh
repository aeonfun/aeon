#!/usr/bin/env bash
# doctor.sh — pre-PR sanity check for Aeon contributors
#
# Final location: scripts/doctor
# Usage:
#   ./scripts/doctor              # full check
#   ./scripts/doctor --quick      # skip slow tests
#   ./scripts/doctor --json       # machine output
#
# Exit codes:
#   0 — all PASS or WARN only
#   1 — at least one FAIL

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "${BASH_SOURCE[0]}/..")"

JSON=0
QUICK=0
for arg in "$@"; do
  case "$arg" in
    --json)  JSON=1 ;;
    --quick) QUICK=1 ;;
  esac
done

PASS=0
WARN=0
FAIL=0

report() {
  local status="$1" check="$2" msg="${3:-}"
  case "$status" in
    PASS) PASS=$((PASS + 1)); [ "$JSON" -eq 1 ] || printf '  ✓ %s\n' "$check" ;;
    WARN) WARN=$((WARN + 1)); [ "$JSON" -eq 1 ] || printf '  ⚠ %s — %s\n' "$check" "$msg" ;;
    FAIL) FAIL=$((FAIL + 1)); [ "$JSON" -eq 1 ] || printf '  ✗ %s — %s\n' "$check" "$msg" ;;
  esac
  [ "$JSON" -eq 1 ] && printf '{"check":"%s","status":"%s","message":"%s"}\n' "$check" "$status" "$msg"
}

section() {
  [ "$JSON" -eq 1 ] && return
  printf '\n=== %s ===\n' "$1"
}

# ----------------------------------------------------------------------------
section "Environment"
# ----------------------------------------------------------------------------

if command -v gh >/dev/null 2>&1; then
  report PASS "gh CLI installed" "$(gh --version | head -1)"
  if gh auth status >/dev/null 2>&1; then
    report PASS "gh authenticated"
  else
    report FAIL "gh authenticated" "run: gh auth login"
  fi
else
  report FAIL "gh CLI installed" "install: brew install gh"
fi

command -v node >/dev/null 2>&1 \
  && report PASS "node installed" "$(node --version)" \
  || report FAIL "node installed" "node 22+ required"

command -v jq >/dev/null 2>&1 \
  && report PASS "jq installed" \
  || report WARN "jq installed" "many skills use jq"

command -v yq >/dev/null 2>&1 \
  && report PASS "yq installed" \
  || report WARN "yq installed" "useful for aeon.yml introspection"

# ----------------------------------------------------------------------------
section "Repo structure"
# ----------------------------------------------------------------------------

for f in CLAUDE.md aeon.yml skills.json memory/MEMORY.md memory/cron-state.json; do
  [ -f "$f" ] && report PASS "$f exists" || report FAIL "$f exists" "missing"
done

[ -d skills ] && report PASS "skills/ exists" || report FAIL "skills/ exists" "missing"
[ -d memory/logs ] && report PASS "memory/logs/ exists" || report WARN "memory/logs/ exists" "create on first skill run"

# ----------------------------------------------------------------------------
section "Configuration coherence"
# ----------------------------------------------------------------------------

if python3 -c "import yaml; yaml.safe_load(open('aeon.yml'))" 2>/dev/null; then
  report PASS "aeon.yml is valid YAML"
else
  report FAIL "aeon.yml is valid YAML" "yaml.safe_load failed"
fi

if python3 -c "import json; json.load(open('skills.json'))" 2>/dev/null; then
  report PASS "skills.json is valid JSON"
else
  report FAIL "skills.json is valid JSON" "json.load failed"
fi

if python3 -c "import json; json.load(open('memory/cron-state.json'))" 2>/dev/null; then
  report PASS "memory/cron-state.json is valid JSON"
else
  report WARN "memory/cron-state.json is valid JSON" "may be empty pre-first-run"
fi

# Every skill listed in aeon.yml has a corresponding SKILL.md.
MISSING_SKILLS=0
if [ -f aeon.yml ]; then
  while IFS= read -r slug; do
    [ -z "$slug" ] && continue
    if [ ! -f "skills/${slug}/SKILL.md" ]; then
      MISSING_SKILLS=$((MISSING_SKILLS + 1))
    fi
  done < <(awk '/^  [a-z][a-z0-9_-]*:/ { gsub(":",""); gsub(" ",""); print }' aeon.yml | sort -u)
  if [ "$MISSING_SKILLS" -eq 0 ]; then
    report PASS "aeon.yml ↔ skills/*/SKILL.md coherent"
  else
    report FAIL "aeon.yml ↔ skills/*/SKILL.md coherent" "$MISSING_SKILLS missing SKILL.md"
  fi
fi

# skills.lock contains provenance for every skill not in the upstream catalog (best-effort).
if [ -f skills.lock ]; then
  report PASS "skills.lock present"
else
  report WARN "skills.lock present" "no imported skills (or missing)"
fi

# ----------------------------------------------------------------------------
section "Skill lint"
# ----------------------------------------------------------------------------

if [ -x skills/_lint/skill-lint.sh ]; then
  if [ "$QUICK" -eq 1 ]; then
    report WARN "skill-lint" "skipped (--quick)"
  elif bash skills/_lint/skill-lint.sh --json >/tmp/aeon-doctor-lint.json 2>/dev/null; then
    report PASS "skill-lint passes"
  else
    FAIL_COUNT=$(grep -c '"status":"fail"' /tmp/aeon-doctor-lint.json 2>/dev/null || echo "?")
    report FAIL "skill-lint passes" "$FAIL_COUNT failures (see /tmp/aeon-doctor-lint.json)"
  fi
else
  report WARN "skill-lint" "scaffold not installed at skills/_lint/skill-lint.sh"
fi

# ----------------------------------------------------------------------------
section "Workflow lint"
# ----------------------------------------------------------------------------

if command -v actionlint >/dev/null 2>&1; then
  if actionlint .github/workflows/*.yml >/dev/null 2>&1; then
    report PASS "actionlint passes"
  else
    report FAIL "actionlint passes" "see: actionlint .github/workflows/*.yml"
  fi
else
  report WARN "actionlint" "install: go install github.com/rhysd/actionlint/cmd/actionlint@latest"
fi

# ----------------------------------------------------------------------------
section "Subprojects"
# ----------------------------------------------------------------------------

for pkg in dashboard mcp-server a2a-server; do
  if [ -f "$pkg/package.json" ]; then
    if [ -d "$pkg/node_modules" ]; then
      report PASS "$pkg/node_modules installed"
    else
      report WARN "$pkg/node_modules installed" "run: cd $pkg && npm install"
    fi

    if [ "$QUICK" -eq 0 ] && [ -f "$pkg/__tests__/smoke.ts" ]; then
      if (cd "$pkg" && npx vitest run __tests__/ >/dev/null 2>&1); then
        report PASS "$pkg vitest smoke"
      else
        report FAIL "$pkg vitest smoke" "cd $pkg && npx vitest run"
      fi
    fi
  fi
done

# ----------------------------------------------------------------------------
section "Last skill run"
# ----------------------------------------------------------------------------

LAST_LOG=$(ls -t memory/logs/2*.md 2>/dev/null | head -1)
if [ -n "$LAST_LOG" ]; then
  AGE_HRS=$(( ($(date +%s) - $(stat -f %m "$LAST_LOG" 2>/dev/null || stat -c %Y "$LAST_LOG")) / 3600 ))
  if [ "$AGE_HRS" -lt 48 ]; then
    report PASS "last log entry ${AGE_HRS}h ago"
  else
    report WARN "last log entry ${AGE_HRS}h ago" "scheduler may be stalled"
  fi
else
  report WARN "no log files" "fresh fork or first run"
fi

# ----------------------------------------------------------------------------
section "Open issues"
# ----------------------------------------------------------------------------

if [ -f memory/issues/INDEX.md ]; then
  OPEN_COUNT=$(awk '/^## Open$/{flag=1; next} /^## /{flag=0} flag && /^\| ISS-/' memory/issues/INDEX.md | wc -l | tr -d ' ')
  if [ "$OPEN_COUNT" -eq 0 ]; then
    report PASS "no open issues"
  else
    report WARN "$OPEN_COUNT open issue(s)" "see memory/issues/INDEX.md"
  fi
fi

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------

[ "$JSON" -eq 1 ] && exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)

printf '\n---\n'
printf 'PASS: %d    WARN: %d    FAIL: %d\n' "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '\nFailures must be addressed before opening a PR.\n'
  exit 1
fi
if [ "$WARN" -gt 0 ]; then
  printf '\nWarnings are non-blocking but worth a look.\n'
fi
exit 0

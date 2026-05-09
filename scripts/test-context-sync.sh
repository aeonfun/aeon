#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

check() {
    local desc="$1" cond="$2"
    if eval "$cond"; then
        echo "  PASS: $desc"
        ((PASS++))
    else
        echo "  FAIL: $desc"
        ((FAIL++))
    fi
}

echo "=== context-sync smoke test ==="

# Run the sync script (it handles missing API gracefully)
echo "Running context-sync.sh..."
bash "$REPO_ROOT/scripts/context-sync.sh" 2>&1 | sed 's/^/  | /'
echo ""

# Check outputs
echo "Checking outputs..."

check "last-sync.json exists" \
    "[ -f '$REPO_ROOT/context/last-sync.json' ]"

check "last-sync.json has timestamp" \
    "jq -e '.timestamp' '$REPO_ROOT/context/last-sync.json' >/dev/null 2>&1"

check "last-sync.json has sources" \
    "jq -e '.sources' '$REPO_ROOT/context/last-sync.json' >/dev/null 2>&1"

check "claude-sessions dir has .md files or .gitkeep" \
    "[ -n \"\$(find '$REPO_ROOT/context/claude-sessions/swarm-fund-mvp' -type f | head -1)\" ]"

check "trading dir exists" \
    "[ -d '$REPO_ROOT/context/trading' ]"

check "analytics dir exists" \
    "[ -d '$REPO_ROOT/context/analytics' ]"

# If API was reachable, check trading files
if jq -e '.sources["trading"] == "ok"' "$REPO_ROOT/context/last-sync.json" >/dev/null 2>&1; then
    echo ""
    echo "Trading API was reachable — checking trading files..."

    check "agents-summary.json exists and is valid JSON" \
        "jq -e '.top_agents' '$REPO_ROOT/context/trading/agents-summary.json' >/dev/null 2>&1"

    check "costs-summary.json exists and is valid JSON" \
        "jq -e '.synced_at' '$REPO_ROOT/context/trading/costs-summary.json' >/dev/null 2>&1"

    check "recent-trades.json exists and is valid JSON" \
        "jq -e '.trades' '$REPO_ROOT/context/trading/recent-trades.json' >/dev/null 2>&1"

    check "revenant-snapshot.json exists and is valid JSON" \
        "jq -e '.revenant_agents' '$REPO_ROOT/context/trading/revenant-snapshot.json' >/dev/null 2>&1"
else
    echo ""
    echo "Trading API was not reachable — skipping trading file checks (expected in CI)"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1

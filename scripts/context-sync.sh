#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTEXT_DIR="$REPO_ROOT/context"
LAST_SYNC="$CONTEXT_DIR/last-sync.json"
API_BASE="http://localhost:8000"
CLAUDE_MEMORY_SRC="$HOME/.claude/projects/-Users-stew-scaria-swarm-fund-mvp-swarm-fund-mvp/memory/"
SWARM_DATA="/Users/stew/scaria/swarm-fund-mvp/swarm-fund-mvp/data"

SYNC_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STATUS_FILE="$(mktemp)"

log() { echo "[context-sync] $(date +%H:%M:%S) $*"; }

set_status() { echo "$1=$2" >> "$STATUS_FILE"; }

# --- 1. Claude Code session memories ---
sync_sessions() {
    local dest="$CONTEXT_DIR/claude-sessions/swarm-fund-mvp/"
    if [ -d "$CLAUDE_MEMORY_SRC" ]; then
        rsync -a --delete --exclude='.DS_Store' "$CLAUDE_MEMORY_SRC" "$dest"
        set_status "claude-sessions" "ok"
        log "sessions: synced $(find "$dest" -name '*.md' | wc -l | tr -d ' ') files"
    else
        set_status "claude-sessions" "skip:source-not-found"
        log "sessions: source dir not found, skipping"
    fi
}

# --- 2. Trading API ---
sync_trading() {
    local dest="$CONTEXT_DIR/trading"

    if ! curl -sf "$API_BASE/api/agents" -o /dev/null --max-time 5 2>/dev/null; then
        set_status "trading" "skip:api-unreachable"
        log "trading: API unreachable at $API_BASE, skipping"
        return
    fi

    curl -sf "$API_BASE/api/agents" --max-time 15 2>/dev/null | jq '{
        top_agents: [.[:20] | .[] | {id: .id, family: .family, lifecycle: .lifecycle, fitness: .fitness.composite, pnl: .pnl.total}],
        lifecycle_counts: (group_by(.lifecycle) | map({key: .[0].lifecycle, value: length}) | from_entries),
        total_agents: length,
        synced_at: "'"$SYNC_TS"'"
    }' > "$dest/agents-summary.json" 2>/dev/null

    curl -sf "$API_BASE/api/costs?hours=168" --max-time 15 2>/dev/null | jq '. + {synced_at: "'"$SYNC_TS"'"}' > "$dest/costs-summary.json" 2>/dev/null

    curl -sf "$API_BASE/api/activity?limit=50" --max-time 15 2>/dev/null | jq '{
        trades: .,
        count: length,
        synced_at: "'"$SYNC_TS"'"
    }' > "$dest/recent-trades.json" 2>/dev/null

    curl -sf "$API_BASE/api/agents" --max-time 15 2>/dev/null | jq '{
        revenant_agents: [.[] | select(.family == "calibration_gap" and (.lifecycle == "LIVE" or .lifecycle == "CANARY")) | {id: .id, lifecycle: .lifecycle, fitness: .fitness.composite, pnl: .pnl.total, trades: .pnl.trade_count}],
        synced_at: "'"$SYNC_TS"'"
    }' > "$dest/revenant-snapshot.json" 2>/dev/null

    set_status "trading" "ok"
    log "trading: synced 4 files"
}

# --- 3. Analytics ---
sync_analytics() {
    local dest="$CONTEXT_DIR/analytics"

    if curl -sf "$API_BASE/api/public/metrics" --max-time 15 2>/dev/null | jq '. + {synced_at: "'"$SYNC_TS"'"}' > "$dest/site-metrics.json" 2>/dev/null; then
        set_status "analytics-site" "ok"
        log "analytics: site metrics synced"
    else
        set_status "analytics-site" "skip:endpoint-failed"
        log "analytics: site metrics endpoint failed, skipping"
    fi

    if [ -f "$SWARM_DATA/social-metrics.json" ]; then
        cp "$SWARM_DATA/social-metrics.json" "$dest/social-metrics.json"
        set_status "analytics-social" "ok"
        log "analytics: social metrics copied"
    else
        set_status "analytics-social" "skip:no-source-file"
        log "analytics: no social-metrics.json found, skipping"
    fi
}

# --- 4. Write last-sync manifest ---
write_manifest() {
    local sources_json
    sources_json=$(awk -F= '{printf "%s\"%s\":\"%s\"", (NR>1?",":""), $1, $2}' "$STATUS_FILE")

    jq -n \
        --arg ts "$SYNC_TS" \
        --argjson sources "{$sources_json}" \
        '{timestamp: $ts, sources: $sources}' > "$LAST_SYNC"

    log "manifest: wrote last-sync.json"
}

# --- 5. Git commit + push ---
git_sync() {
    cd "$REPO_ROOT"

    if git diff --quiet HEAD -- context/ 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard context/)" ]; then
        log "git: no changes to commit"
        return
    fi

    git add context/
    git commit -m "chore(context): sync $(date -u +%Y-%m-%d-%H%M)" --no-verify 2>/dev/null
    git push origin HEAD --no-verify 2>/dev/null || {
        log "git: push failed (will retry next cycle)"
        return
    }
    log "git: committed and pushed"
}

cleanup() { rm -f "$STATUS_FILE"; }
trap cleanup EXIT

# --- Main ---
log "starting sync"
sync_sessions
sync_trading
sync_analytics
write_manifest
git_sync
log "done"

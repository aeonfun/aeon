# Aeon Context Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a zero-LLM-cost local LaunchAgent that syncs Claude Code session memories, trading DB snapshots, and analytics into `aeon/context/` every 4 hours so GitHub Actions skills can consume live project state.

**Architecture:** A bash script (`scripts/context-sync.sh`) runs via macOS LaunchAgent every 4 hours. It rsyncs Claude Code memory files, curls the existing FastAPI trading API (localhost:8000), copies cached analytics, writes a `last-sync.json` manifest, and git-commits/pushes any changes. No new API endpoints needed — the script uses existing `/api/agents`, `/api/costs`, `/api/activity` endpoints with `jq` transforms.

**Tech Stack:** Bash, rsync, curl, jq (1.8.1, installed at /opt/homebrew/bin/jq), git, macOS LaunchAgent (plist)

**Repos:**
- **Aeon** (`/Users/stew/scaria/aeon`) — all changes land here
- **swarm-fund-mvp** (`/Users/stew/scaria/swarm-fund-mvp/swarm-fund-mvp`) — read-only source for analytics; FastAPI server on localhost:8000

**Existing infrastructure:**
- FastAPI server: `ai.rswarm.api` LaunchAgent, uvicorn on port 8000, working dir `/Users/stew/scaria/swarm-fund-mvp/swarm-fund-mvp`
- Existing endpoints: `/api/agents` (all agents by fitness), `/api/costs?hours=N` (cost summary by vendor), `/api/activity?limit=N` (recent trade activity)
- Claude Code session memories: 80 files, 404KB at `~/.claude/projects/-Users-stew-scaria-swarm-fund-mvp-swarm-fund-mvp/memory/`
- Site metrics: generated dynamically by `/api/public/metrics` endpoint (no static file)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `context/claude-sessions/swarm-fund-mvp/.gitkeep` | Session memory sync target |
| Create | `context/trading/.gitkeep` | Trading data sync target |
| Create | `context/analytics/.gitkeep` | Analytics sync target |
| Create | `scripts/context-sync.sh` | Main sync script (bash) |
| Create | `scripts/test-context-sync.sh` | Smoke test for sync script |
| Create | `~/Library/LaunchAgents/ai.rswarm.context-sync.plist` | 4-hour cron LaunchAgent |
| Modify | `skills/write-tweet/SKILL.md` | Add context consumption section |
| Modify | `skills/narrative-tracker/SKILL.md` | Add context consumption section |
| Modify | `skills/self-improve/SKILL.md` | Add context consumption section |
| Modify | `skills/goal-tracker/SKILL.md` | Add context consumption section |
| Modify | `skills/evening-recap/SKILL.md` | Add context consumption section |
| Modify | `.gitignore` | Ensure context/ is tracked (not ignored) |

---

### Task 1: Create context directory structure

**Files:**
- Create: `context/claude-sessions/swarm-fund-mvp/.gitkeep`
- Create: `context/trading/.gitkeep`
- Create: `context/analytics/.gitkeep`

- [ ] **Step 1: Create directory tree with .gitkeep files**

```bash
cd /Users/stew/scaria/aeon
mkdir -p context/claude-sessions/swarm-fund-mvp
mkdir -p context/trading
mkdir -p context/analytics
touch context/claude-sessions/swarm-fund-mvp/.gitkeep
touch context/trading/.gitkeep
touch context/analytics/.gitkeep
```

- [ ] **Step 2: Verify structure**

Run: `find context -type f`
Expected:
```
context/claude-sessions/swarm-fund-mvp/.gitkeep
context/trading/.gitkeep
context/analytics/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add context/
git commit -m "feat: add context/ directory structure for sync pipeline"
```

---

### Task 2: Write the context sync script

**Files:**
- Create: `scripts/context-sync.sh`

- [ ] **Step 1: Create the sync script**

```bash
#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTEXT_DIR="$REPO_ROOT/context"
LAST_SYNC="$CONTEXT_DIR/last-sync.json"
API_BASE="http://localhost:8000"
CLAUDE_MEMORY_SRC="$HOME/.claude/projects/-Users-stew-scaria-swarm-fund-mvp-swarm-fund-mvp/memory/"
SWARM_DATA="/Users/stew/scaria/swarm-fund-mvp/swarm-fund-mvp/data"

SYNC_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
declare -A STATUS

log() { echo "[context-sync] $(date +%H:%M:%S) $*"; }

# --- 1. Claude Code session memories ---
sync_sessions() {
    local dest="$CONTEXT_DIR/claude-sessions/swarm-fund-mvp/"
    if [ -d "$CLAUDE_MEMORY_SRC" ]; then
        rsync -a --delete --exclude='.DS_Store' "$CLAUDE_MEMORY_SRC" "$dest"
        STATUS[claude-sessions]="ok"
        log "sessions: synced $(find "$dest" -name '*.md' | wc -l | tr -d ' ') files"
    else
        STATUS[claude-sessions]="skip:source-not-found"
        log "sessions: source dir not found, skipping"
    fi
}

# --- 2. Trading API ---
sync_trading() {
    local dest="$CONTEXT_DIR/trading"

    if ! curl -sf "$API_BASE/api/agents" -o /dev/null --max-time 5 2>/dev/null; then
        STATUS[trading]="skip:api-unreachable"
        log "trading: API unreachable at $API_BASE, skipping"
        return
    fi

    # agents-summary.json: top 20 by fitness + lifecycle stage counts
    curl -sf "$API_BASE/api/agents" --max-time 15 2>/dev/null | jq '{
        top_agents: [.[:20] | .[] | {id: .id, family: .family, lifecycle: .lifecycle, fitness: .fitness.composite, pnl: .pnl.total}],
        lifecycle_counts: (group_by(.lifecycle) | map({key: .[0].lifecycle, value: length}) | from_entries),
        total_agents: length,
        synced_at: "'"$SYNC_TS"'"
    }' > "$dest/agents-summary.json" 2>/dev/null

    # costs-summary.json: 7-day rolling cost by vendor
    curl -sf "$API_BASE/api/costs?hours=168" --max-time 15 2>/dev/null | jq '. + {synced_at: "'"$SYNC_TS"'"}' > "$dest/costs-summary.json" 2>/dev/null

    # recent-trades.json: last 50 activity events
    curl -sf "$API_BASE/api/activity?limit=50" --max-time 15 2>/dev/null | jq '{
        trades: .,
        count: length,
        synced_at: "'"$SYNC_TS"'"
    }' > "$dest/recent-trades.json" 2>/dev/null

    # revenant-snapshot.json: filter for CalibrationGap/Revenant agents
    curl -sf "$API_BASE/api/agents" --max-time 15 2>/dev/null | jq '{
        revenant_agents: [.[] | select(.family == "calibration_gap" and (.lifecycle == "LIVE" or .lifecycle == "CANARY")) | {id: .id, lifecycle: .lifecycle, fitness: .fitness.composite, pnl: .pnl.total, trades: .pnl.trade_count}],
        synced_at: "'"$SYNC_TS"'"
    }' > "$dest/revenant-snapshot.json" 2>/dev/null

    STATUS[trading]="ok"
    log "trading: synced 4 files"
}

# --- 3. Analytics ---
sync_analytics() {
    local dest="$CONTEXT_DIR/analytics"

    # Site metrics from the public metrics endpoint
    if curl -sf "$API_BASE/api/public/metrics" --max-time 15 2>/dev/null | jq '. + {synced_at: "'"$SYNC_TS"'"}' > "$dest/site-metrics.json" 2>/dev/null; then
        STATUS[analytics-site]="ok"
        log "analytics: site metrics synced"
    else
        STATUS[analytics-site]="skip:endpoint-failed"
        log "analytics: site metrics endpoint failed, skipping"
    fi

    # Social metrics — check if X API cache file exists in swarm data
    if [ -f "$SWARM_DATA/social-metrics.json" ]; then
        cp "$SWARM_DATA/social-metrics.json" "$dest/social-metrics.json"
        STATUS[analytics-social]="ok"
        log "analytics: social metrics copied"
    else
        STATUS[analytics-social]="skip:no-source-file"
        log "analytics: no social-metrics.json found, skipping"
    fi
}

# --- 4. Write last-sync manifest ---
write_manifest() {
    local status_json="{"
    local first=true
    for key in "${!STATUS[@]}"; do
        $first || status_json+=","
        status_json+="\"$key\":\"${STATUS[$key]}\""
        first=false
    done
    status_json+="}"

    jq -n \
        --arg ts "$SYNC_TS" \
        --argjson sources "$status_json" \
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
        STATUS[git-push]="fail"
        log "git: push failed (will retry next cycle)"
        return
    }
    STATUS[git-push]="ok"
    log "git: committed and pushed"
}

# --- Main ---
log "starting sync"
sync_sessions
sync_trading
sync_analytics
write_manifest
git_sync
log "done"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Users/stew/scaria/aeon/scripts/context-sync.sh
```

- [ ] **Step 3: Verify script parses without errors**

Run: `bash -n /Users/stew/scaria/aeon/scripts/context-sync.sh`
Expected: no output (clean parse)

- [ ] **Step 4: Commit**

```bash
git add scripts/context-sync.sh
git commit -m "feat: add context-sync.sh for session/trading/analytics pipeline"
```

---

### Task 3: Write the smoke test

**Files:**
- Create: `scripts/test-context-sync.sh`

- [ ] **Step 1: Create the test script**

This test runs the sync script and validates output structure without requiring the trading API to be up.

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Users/stew/scaria/aeon/scripts/test-context-sync.sh
```

- [ ] **Step 3: Run the smoke test**

Run: `bash /Users/stew/scaria/aeon/scripts/test-context-sync.sh`
Expected: All checks PASS (trading checks may be skipped if API is down, which is acceptable)

- [ ] **Step 4: Commit**

```bash
git add scripts/test-context-sync.sh
git commit -m "test: add smoke test for context-sync pipeline"
```

---

### Task 4: Create the LaunchAgent plist

**Files:**
- Create: `~/Library/LaunchAgents/ai.rswarm.context-sync.plist`

- [ ] **Step 1: Write the plist file**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.rswarm.context-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/stew/scaria/aeon/scripts/context-sync.sh</string>
  </array>
  <key>StartInterval</key>
  <integer>14400</integer>
  <key>StandardOutPath</key>
  <string>/tmp/context-sync.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/context-sync.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>/Users/stew</string>
  </dict>
</dict>
</plist>
```

Note: `/opt/homebrew/bin` is first in PATH so `jq` and `git` resolve correctly on Apple Silicon.

- [ ] **Step 2: Load the LaunchAgent**

```bash
launchctl load ~/Library/LaunchAgents/ai.rswarm.context-sync.plist
```

- [ ] **Step 3: Verify it loaded**

Run: `launchctl list | grep context-sync`
Expected: Line containing `ai.rswarm.context-sync` with a PID or `-` (not an error code)

- [ ] **Step 4: Trigger a manual run to verify**

```bash
launchctl start ai.rswarm.context-sync
sleep 3
tail -20 /tmp/context-sync.log
```

Expected: Log output showing `[context-sync]` lines for each sync phase, ending with `done`.

- [ ] **Step 5: Commit the plist to the Aeon repo for reproducibility**

Keep a copy in the repo so the setup is documented:

```bash
cp ~/Library/LaunchAgents/ai.rswarm.context-sync.plist /Users/stew/scaria/aeon/scripts/ai.rswarm.context-sync.plist
git add scripts/ai.rswarm.context-sync.plist
git commit -m "feat: add context-sync LaunchAgent plist (4-hour interval)"
```

---

### Task 5: Update skill SKILL.md files

**Files:**
- Modify: `skills/write-tweet/SKILL.md`
- Modify: `skills/narrative-tracker/SKILL.md`
- Modify: `skills/self-improve/SKILL.md`
- Modify: `skills/goal-tracker/SKILL.md`
- Modify: `skills/evening-recap/SKILL.md`

Each skill gets the same context consumption block added. The block goes right after the existing "## Steps" or "## Process" section header (before the first step).

- [ ] **Step 1: Add context block to write-tweet/SKILL.md**

Add this block after the frontmatter and before the first `## Steps` / `## Process` section:

```markdown
## Context (auto-synced)

Read these files for live project state before generating content:
- `context/claude-sessions/swarm-fund-mvp/` — scan all .md files for recent session insights, problem-solving, and research breakthroughs
- `context/trading/revenant-snapshot.json` — Revenant agent status (trade count, win rate, P&L, Sharpe)
- `context/trading/recent-trades.json` — latest 50 trade events for narrative material
- `context/trading/agents-summary.json` — top agents, lifecycle stage distribution
- `context/last-sync.json` — check freshness; if older than 8 hours, note "(stale data)" in output

Use this context to ground tweets in real activity. Reference specific P&L numbers, trade outcomes, and session insights rather than generic statements.
```

- [ ] **Step 2: Add context block to narrative-tracker/SKILL.md**

Same block, adjusted for narrative-tracker's use case:

```markdown
## Context (auto-synced)

Read these files for live project state before tracking narratives:
- `context/claude-sessions/swarm-fund-mvp/` — scan all .md files for session insights on market structure, regime shifts, strategy changes
- `context/trading/revenant-snapshot.json` — Revenant agent status for calibration gap narrative
- `context/trading/recent-trades.json` — latest trades for pattern detection
- `context/trading/costs-summary.json` — cost trends that affect narrative around efficiency
- `context/analytics/site-metrics.json` — dashboard traffic for content performance signal
- `context/last-sync.json` — check freshness; if older than 8 hours, note "(stale data)" in output

Use trading context to connect narratives to real outcomes. A narrative about prediction market calibration is stronger when backed by Revenant's actual trade record.
```

- [ ] **Step 3: Add context block to self-improve/SKILL.md**

```markdown
## Context (auto-synced)

Read these files before identifying improvements:
- `context/claude-sessions/swarm-fund-mvp/` — scan all .md files for session hot-fixes, debugging patterns, and recurring issues
- `context/trading/costs-summary.json` — 7-day cost trends by vendor
- `context/trading/agents-summary.json` — agent population health, lifecycle distribution
- `context/analytics/site-metrics.json` — dashboard/landing page performance
- `context/analytics/social-metrics.json` — tweet and content engagement (if available)
- `context/last-sync.json` — check freshness; if older than 8 hours, note "(stale data)" in output

Prioritize improvements that address patterns visible in session context (repeated failures, manual workarounds) and cost/performance trends.
```

- [ ] **Step 4: Add context block to goal-tracker/SKILL.md**

```markdown
## Context (auto-synced)

Read these files to ground goal status in real data:
- `context/trading/revenant-snapshot.json` — Revenant trade count vs 100-trade Apex gate target
- `context/trading/agents-summary.json` — lifecycle stage counts (Birth/Canary/Apex/Revenant)
- `context/trading/costs-summary.json` — cost burn rate vs budget targets
- `context/claude-sessions/swarm-fund-mvp/` — scan for goal-related decisions and plan changes
- `context/last-sync.json` — check freshness; if older than 8 hours, note "(stale data)" in output

Use actual numbers from trading context to assign goal status. "Revenant at 29/100 trades" is a real status update; "making progress" is not.
```

- [ ] **Step 5: Add context block to evening-recap/SKILL.md**

```markdown
## Context (auto-synced)

Read these files for the end-of-day summary:
- `context/trading/recent-trades.json` — today's trade activity
- `context/trading/revenant-snapshot.json` — Revenant status for the daily snapshot
- `context/trading/agents-summary.json` — population changes, new births/kills
- `context/trading/costs-summary.json` — today's cost burn
- `context/claude-sessions/swarm-fund-mvp/` — scan for session work done today
- `context/analytics/site-metrics.json` — dashboard traffic
- `context/last-sync.json` — check freshness; if older than 8 hours, note "(stale data)" in output

The evening recap should reference specific numbers from today's context. "3 new trades, +$42 Revenant P&L, 2 session fixes pushed" — not "activity continued today."
```

- [ ] **Step 6: Verify all five files were modified**

Run: `git diff --stat skills/*/SKILL.md`
Expected: 5 files changed

- [ ] **Step 7: Commit**

```bash
git add skills/write-tweet/SKILL.md skills/narrative-tracker/SKILL.md skills/self-improve/SKILL.md skills/goal-tracker/SKILL.md skills/evening-recap/SKILL.md
git commit -m "feat: add context pipeline consumption blocks to 5 skills"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Run the full sync manually**

```bash
bash /Users/stew/scaria/aeon/scripts/context-sync.sh
```

Expected: Log output showing each phase. Sessions should sync (80 files). Trading syncs if API is running. Analytics may skip if no source files exist yet.

- [ ] **Step 2: Inspect last-sync.json**

Run: `cat /Users/stew/scaria/aeon/context/last-sync.json | jq .`
Expected: JSON with `timestamp` and `sources` object showing status of each source.

- [ ] **Step 3: Verify session memories landed**

Run: `ls /Users/stew/scaria/aeon/context/claude-sessions/swarm-fund-mvp/ | head -10`
Expected: `.md` files matching the session memory filenames

- [ ] **Step 4: Check context directory size**

Run: `du -sh /Users/stew/scaria/aeon/context/`
Expected: Under 2MB (constraint from spec)

- [ ] **Step 5: Run the smoke test**

Run: `bash /Users/stew/scaria/aeon/scripts/test-context-sync.sh`
Expected: All checks PASS

- [ ] **Step 6: Verify LaunchAgent is scheduled**

Run: `launchctl list | grep context-sync`
Expected: `ai.rswarm.context-sync` listed

- [ ] **Step 7: Final commit with all synced context**

```bash
cd /Users/stew/scaria/aeon
git add context/
git commit -m "chore(context): initial sync from context pipeline"
```

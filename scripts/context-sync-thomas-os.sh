#!/usr/bin/env bash
set -uo pipefail

# Context sync for Thomas OS (personal productivity instance).
# Syncs personal project session memories and local data into the
# aeon-thomas-os repo's context/ directory. Modeled on context-sync.sh.
#
# Prerequisites:
#   1. aeon-thomas-os repo cloned locally
#   2. spawn-instance run with var: "thomas-os: personal productivity OS"

REPO_ROOT="${THOMAS_OS_REPO:-$HOME/scaria/aeon-thomas-os}"
CONTEXT_DIR="$REPO_ROOT/context"
SYNC_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STATUS_FILE="$(mktemp)"

log() { echo "[thomas-os-sync] $(date +%H:%M:%S) $*"; }

set_status() { echo "$1=$2" >> "$STATUS_FILE"; }

# --- 1. Claude Code session memories (all projects) ---
sync_sessions() {
    local claude_base="$HOME/.claude/projects"

    # Sync each project's memory directory
    for project_dir in "$claude_base"/*/memory; do
        [ -d "$project_dir" ] || continue
        local project_name
        project_name=$(basename "$(dirname "$project_dir")")
        local dest="$CONTEXT_DIR/claude-sessions/$project_name/"
        mkdir -p "$dest"
        rsync -a --delete --exclude='.DS_Store' "$project_dir/" "$dest"
    done

    local count
    count=$(find "$CONTEXT_DIR/claude-sessions" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    set_status "claude-sessions" "ok"
    log "sessions: synced $count files across projects"
}

# --- 2. Calendar (macOS Calendar.app via AppleScript) ---
sync_calendar() {
    local dest="$CONTEXT_DIR/calendar"
    mkdir -p "$dest"

    # Export next 7 days of events
    osascript -e '
    set now to current date
    set endDate to now + 7 * days
    set output to ""
    tell application "Calendar"
        repeat with cal in calendars
            set evts to (every event of cal whose start date >= now and start date <= endDate)
            repeat with e in evts
                set output to output & (summary of e) & "|" & (start date of e as string) & "|" & (end date of e as string) & linefeed
            end repeat
        end repeat
    end tell
    return output
    ' > "$dest/upcoming-events.txt" 2>/dev/null

    if [ -s "$dest/upcoming-events.txt" ]; then
        set_status "calendar" "ok"
        log "calendar: exported upcoming events"
    else
        set_status "calendar" "skip:no-events-or-unavailable"
        log "calendar: no events found or Calendar.app unavailable"
    fi
}

# --- 3. Reminders / tasks ---
sync_reminders() {
    local dest="$CONTEXT_DIR/tasks"
    mkdir -p "$dest"

    osascript -e '
    set output to ""
    tell application "Reminders"
        repeat with r in (every reminder whose completed is false)
            set output to output & (name of r)
            if due date of r is not missing value then
                set output to output & "|" & (due date of r as string)
            end if
            set output to output & linefeed
        end repeat
    end tell
    return output
    ' > "$dest/open-reminders.txt" 2>/dev/null

    if [ -s "$dest/open-reminders.txt" ]; then
        set_status "reminders" "ok"
        log "reminders: exported open items"
    else
        set_status "reminders" "skip:no-items-or-unavailable"
        log "reminders: no open items or Reminders.app unavailable"
    fi
}

# --- 4. Write manifest ---
write_manifest() {
    local sources_json
    sources_json=$(awk -F= '{printf "%s\"%s\":\"%s\"", (NR>1?",":""), $1, $2}' "$STATUS_FILE")

    mkdir -p "$(dirname "$CONTEXT_DIR/last-sync.json")"
    jq -n \
        --arg ts "$SYNC_TS" \
        --argjson sources "{$sources_json}" \
        '{timestamp: $ts, sources: $sources}' > "$CONTEXT_DIR/last-sync.json"

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
if [ ! -d "$REPO_ROOT" ]; then
    log "ERROR: repo not found at $REPO_ROOT"
    log "Run spawn-instance first: var='thomas-os: personal productivity OS'"
    exit 1
fi

mkdir -p "$CONTEXT_DIR/claude-sessions" "$CONTEXT_DIR/calendar" "$CONTEXT_DIR/tasks"

log "starting sync"
sync_sessions
sync_calendar
sync_reminders
write_manifest
git_sync
log "done"

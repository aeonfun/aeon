# Aeon Context Pipeline

Spec for a zero-LLM-cost local pipeline that syncs Claude Code session context, trading DB snapshots, and analytics into the Aeon repo so skills can consume live project state.

## Problem

Aeon skills run on GitHub Actions with no access to:
- Claude Code session memories (insights, problem-solving, hot fixes from interactive sessions)
- Trading DB state (agent lifecycle, P&L, costs, config)
- Analytics (dashboard traffic, tweet engagement, landing page performance)

Skills like write-tweet, narrative-tracker, and self-improve operate blind. Upgrading them to Opus without fixing the input is waste.

## Design

### Directory structure

```
aeon/
  context/
    claude-sessions/          # rsync from ~/.claude/projects/*/memory/
      swarm-fund-mvp/         # project-scoped session memories
        *.md
    trading/
      agents-summary.json     # top 20 agents by P&L, lifecycle stage counts
      costs-summary.json      # 7-day rolling cost by vendor
      recent-trades.json      # last 50 trades across all agents
      revenant-snapshot.json   # Revenant-specific: trade count, win rate, P&L, Sharpe
    analytics/
      site-metrics.json       # Vercel analytics (pageviews, visitors, top pages)
      social-metrics.json     # tweet impressions, engagement rate (from X API cache)
    last-sync.json            # timestamp + status of last successful sync
```

All files are JSON or markdown. No binaries. Total size stays under 2MB per sync.

### Sync mechanism

A LaunchAgent (`ai.rswarm.context-sync.plist`) runs `scripts/context-sync.sh` every 4 hours.

The script:
1. Rsyncs `~/.claude/projects/-Users-stew-scaria-swarm-fund-mvp-swarm-fund-mvp/memory/` to `context/claude-sessions/swarm-fund-mvp/`
2. Curls `localhost:8000` trading API endpoints, writes JSON summaries to `context/trading/`
3. Copies site metrics from `swarm-fund-mvp/swarm-fund-mvp/data/site-metrics.json` and social metrics from `swarm-fund-mvp/swarm-fund-mvp/data/social-metrics.json` (site metrics already refreshed by `ai.rswarm.metrics` every 15 min)
4. Writes `context/last-sync.json` with timestamp and per-source status
5. Commits and pushes to the Aeon repo if any files changed

Failure in one source does not block others. Each source writes independently; `last-sync.json` records per-source success/failure.

### LaunchAgent

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
    <string>/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
```

### Trading API endpoints

The FastAPI server (`ai.rswarm.api` on localhost:8000) already serves agent data. The sync script hits:

| Endpoint | Output file | What it captures |
|----------|-------------|------------------|
| `/agents/summary` | `agents-summary.json` | Top 20 agents by P&L, lifecycle stage counts (Birth/Canary/Apex/Revenant) |
| `/costs/summary?days=7` | `costs-summary.json` | 7-day rolling cost by vendor (Anthropic, OpenAI, Google, Together, DeepSeek) |
| `/trades/recent?limit=50` | `recent-trades.json` | Last 50 trades with agent name, market, direction, outcome, P&L |
| `/agents/revenant` | `revenant-snapshot.json` | Revenant trade count, win rate, cumulative P&L, Sharpe, days to Apex gate |

If the API is down (laptop sleeping, server crashed), the script skips trading sources and logs the failure. Stale data is better than no data.

If endpoints don't exist yet, the sync script should still run and log "endpoint not found" without failing. Skills check `last-sync.json` timestamps to know data freshness.

### Skill consumption pattern

Skills read context files directly. No new tooling needed.

```markdown
# In any SKILL.md that needs context:

## Context (auto-synced)
Read these files for live project state:
- `context/claude-sessions/swarm-fund-mvp/` — recent session insights
- `context/trading/revenant-snapshot.json` — Revenant agent status
- `context/trading/recent-trades.json` — latest trade activity
- `context/last-sync.json` — check freshness before using data
```

Skills should check `last-sync.json` and note data age in their output if older than 8 hours.

### What this enables

| Skill | Current input | With context pipeline |
|-------|--------------|----------------------|
| write-tweet | memory/MEMORY.md + 3-day logs | + session insights + Revenant P&L + trade highlights |
| narrative-tracker | web searches + memory | + session problem-solving context + trade outcomes |
| self-improve | 2-day logs + cron-state.json | + analytics performance + cost trends + session fixes |
| goal-tracker | MEMORY.md goals | + actual trade counts + P&L vs targets + session decisions |
| evening-recap | chain outputs only | + full day's trading activity + session work summary |

### Aeon fork for Thomas OS

Decision: fork via `spawn-instance`. Two independent instances:

- **`tomscaria/aeon`** (parent) — swarm fund skills, trading context, market monitors
- **`tomscaria/aeon-thomas-os`** (fork) — personal assistant skills, Thomas OS context

`context-sync.sh` syncs to the parent Aeon repo only. When `aeon-thomas-os` is spawned, it gets its own `context-sync-thomas-os.sh` that syncs Thomas OS-specific sources (calendar, notes, personal projects) to its own `context/` directory.

The fork inherits `spawn-instance`'s existing mechanics: isolated API keys, dynamic skill selection from `aeon.yml`, fleet registry. No shared memory, no shared chains, no cross-contamination.

## Implementation sequence

1. **Create `scripts/context-sync.sh`** — the sync script with rsync + curl + git commit/push
2. **Create `ai.rswarm.context-sync.plist`** — LaunchAgent for 4-hour cron
3. **Create `context/` directory** with `.gitkeep` files for the subdirectory structure
4. **Add trading API endpoints** to swarm-fund-mvp FastAPI server (if missing)
5. **Update skill SKILL.md files** to reference context files (write-tweet, narrative-tracker, self-improve, goal-tracker, evening-recap)
6. **Test one full sync cycle** — verify files land, commit pushes, skills can read them
7. **Spawn aeon-thomas-os** via spawn-instance (separate follow-up)

## Constraints

- Zero LLM cost. The pipeline is pure bash/curl/rsync/git.
- Laptop must be open for sync to run (LaunchAgent). Acceptable — Thomas works on laptop daily.
- Trading API must be running for trading data. Script handles downtime gracefully.
- Context files are committed to the Aeon repo. They contain trading P&L and agent config — repo must stay private.
- Total context directory stays under 2MB to avoid bloating the repo.

## Out of scope

- Real-time streaming (webhook on every trade). 4-hour snapshots are sufficient for daily skills.
- Session transcript extraction from Claude's SQLite DIPS database. Too locked down. Session memories (the `.claude/projects/*/memory/` files) capture the useful insights already.
- Compaction/summarization of context files. Raw JSON is small enough; skills do their own filtering.
- Thomas OS fork implementation. Covered by spawn-instance; separate spec when ready.

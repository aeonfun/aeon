🔴 ISS-017 ESCALATED → critical (heartbeat 14:07 UTC)

GHA cron-tick gap recurred at 13:00/13:30/14:00 UTC. No automatic dispatch fired between 12:39Z and now (14:07Z) — the 14:00 heartbeat slot itself missed (this run is operator-invoked). Per MEMORY directive, severity bumped high → critical.

Today's missed cron tiers:
- 07:00 morning chain (already filed this AM)
- 13:00: monitor-kalshi, market-context-refresh, polymarket-comments
- 13:30: narrative-tracker
- 14:00: auto-merge, article, digest, research-brief, paper-pick, search-skill, security-digest, idea-capture, heartbeat

Pattern: GHA scheduler fires irregular catch-up ticks (08:52 manual, 10:16, 12:39), then goes silent for hours. 24h SLAs on daily skills can no longer be guaranteed.

External-watchdog workaround (cron-job.org → workflow_dispatch on heartbeat hourly) is now blocking. No aeon-side code can fix a scheduler that isn't ticking.

Files: memory/issues/ISS-017.md (severity → critical, 12 new affected skills added), memory/issues/INDEX.md (row updated), docs/status.md (regenerated, 15 open issues, 🔴 DEGRADED).

*Goal Tracker — 2026-04-30*

Summary: 9 goals — 0 at risk, 0 needs attention, 6 on track, 3 blocked, 0 done (overall ↓ degrading; 3 ON_TRACK→BLOCKED reclassified)

BLOCKED
• Fix chain-runner.yml dispatch_skill() — 0d idle, 6 activity/14d (was ON TRACK ↓); operator-side workflow patch, 6+ days running
  → Action: Patch dispatch_skill() with per-skill echo before each gh workflow run
• Operator config sweep — 0d idle, 6 activity/14d (was ON TRACK ↓); NEYNAR_API_KEY/X_HANDLE unset, prefetch-reddit/vuln-scanner not landed
  → Action: Set NEYNAR_API_KEY + X_HANDLE secrets to unblock reply-maker + agent-buzz today
• Stalin-tier review (workflow-security-audit / ISS-015) — 0d idle, 4 activity/14d (was ON TRACK ↓); PR #4 stalled awaiting workflow-scoped token
  → Action: Generate workflow-scoped PAT and merge PR #4

ON TRACK
• Pre-Apex push: monitor-polymarket + polymarket-comments — 0d idle, 6 activity/14d (→ flat)
• Hermes-arb gate adjustment (min-gap 7→7.5pp) — 0d idle, 6 activity/14d (→ flat)
• Skill-evals key fixes (PR #5) — 0d idle, 6 activity/14d (→ flat)
• External-feature PRs to swarm-fund-mvp — 0d idle, 6 activity/14d (→ flat)
• weekly-shiplog Mondays → grant committees — 0d idle, 5 activity/14d (→ flat)
• paper-pick daily PhD reading list — 0d idle, 6 activity/14d (→ flat)

Sources: logs=ok, git=ok(shallow), gh_pr=ok, gh_issue=disabled, cron-state=ok

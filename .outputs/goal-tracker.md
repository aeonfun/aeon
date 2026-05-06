*Goal Tracker — 2026-05-06*

Summary: 12 goals — 0 at risk, 0 needs attention, 10 on track, 2 blocked, 0 done (overall → flat; no status changes vs 2026-05-05)

BLOCKED
• chain-runner.yml dispatch_skill() — operator-side workflow patch, day 10 idle on the fix
  → Action: Operator: add `echo` per dispatched skill before each `gh workflow run` in chain-runner.yml.
• Operator config sweep — operator-side, blocked on yml + secrets + skills.lock
  → Action: Operator: populate memory/on-chain-watches.yml, add NEYNAR_API_KEY + X_HANDLE, ship skills.lock.

ON TRACK (sorted ascending by 14d activity)
• ISS-018 / ISS-019 prompt-bug fixes — 0d idle, 4/14d (→ flat)
• swarm-fund-mvp tick-broker falsifier — 0d idle, 4/14d (→ flat; T-falsifier 2026-05-17, 11d remaining)
• Cost-discipline sonnet downgrade pass — 0d idle, 8/14d (→ flat)
• PR #156 reply-maker XAI prefetch — 0d idle, 11/14d (→ flat, PR day 12)
• monitor-runners DEEP-LIQ floor patch — 0d idle, 11/14d (→ flat)
• weekly-shiplog Mondays → grant committees — 0d idle, 11/14d (→ flat)
• Pre-Apex push (monitor-polymarket + polymarket-comments) — 0d idle, 12/14d (→ flat)
• Hermes-arb gate adjustment (min-gap bump) — 0d idle, 12/14d (→ flat)
• skill-evals key fixes (PR #5) — 0d idle, 12/14d (→ flat)
• paper-pick daily PhD reading list — 0d idle, 12/14d (→ flat)

Notable: tick-broker activity 7→4 (-43%), nearing degrading band; T-falsifier 11d remaining if Aeon side doesn't ship outputs/{skill}/{date}.json contract. PR #156 enters day 12 unmerged.

Sources: logs=ok (12 days), git=ok (1 commit/14d in this repo), gh_pr=ok (11 PRs on tomscaria/aeon), gh_issue=fail (issues disabled on tomscaria/aeon), cron-state=skip

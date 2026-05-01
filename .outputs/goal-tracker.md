*Goal Tracker — 2026-05-01*

Summary: 9 goals — 0 at risk, 0 needs attention, 6 on track, 3 blocked, 0 done (overall → flat)

BLOCKED
- Fix chain-runner.yml dispatch_skill() — waiting on operator-side workflow patch since 2026-04-25 (7 days)
  -> Action: Mint workflow-scoped PAT and land echo-per-skill trace in dispatch_skill()
- Operator config sweep — waiting on NEYNAR_API_KEY/X_HANDLE secrets + prefetch-reddit.sh / prefetch-vuln-scanner.sh / prefetch-xai reply-maker case
  -> Action: Set NEYNAR_API_KEY + X_HANDLE and merge prefetch-reddit.sh shell
- Stalin-tier review / ISS-015 — PR #4 stalled 4 days awaiting workflow-scoped PAT
  -> Action: Mint workflow-scoped PAT and merge tomscaria/aeon#4

ON TRACK
- Pre-Apex push (monitor-polymarket + polymarket-comments) — 0d idle, 7 activity/14d (flat)
- Hermes-arb min-gap bump (7pp -> 7.5-8pp) — 0d idle, 5 activity/14d (flat; recurring loop, no commit yet)
- Skill-evals key fixes (PR #5 carrier, hn-digest / monitor-polymarket) — 4d idle on PR, 6 activity/14d (flat)
- External-feature PRs to swarm-fund-mvp — 0d idle, 8 activity/14d (#22+#25 merged today; flat)
- weekly-shiplog Mondays -> grant committees — 4d idle (last Mon 04-27), 5 activity/14d (flat; next Mon 05-04)
- paper-pick daily -> PhD reading list — 0d idle, 7 activity/14d (flat)

Sources: logs=ok, git=ok (1 commit in window), gh_pr=ok (5 open on aeon, 10 in-window on swarm-fund-mvp), gh_issue=fail (issues disabled on aeon), cron-state=ok

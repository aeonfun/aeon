*Goal Tracker — 2026-05-08*

Summary: 17 active goals + 1 newly DONE — 0 at risk, 0 needs attention, 13 on track, 3 blocked, 1 done (overall ↑ improving — PR #156 merged, ISS-014 closes)

DONE
• PR #156 reply-maker XAI prefetch — completed 2026-05-08 (merged 01:18Z aaronjmars/aeon, ISS-014 closes; 13-day BLOCKED → DONE)

BLOCKED
• chain-runner.yml `dispatch_skill()` — operator-side workflow patch since 2026-04-28 (day 11 idle on operator action; 289 activity/14d as carry, → flat)
  → Action: Operator lands echo-per-dispatched-skill before each `gh workflow run` in chain-runner.yml.
• Add `## Trusted Authors` to memory/watched-repos.md — operator memory edit (file still missing the section; 48 activity/14d as carry, ↓ degrading from NEEDS_ATTENTION)
  → Action: Operator appends `## Trusted Authors\n- aaronjmars\n- tomscaria` to memory/watched-repos.md.
• Operator config sweep — operator (NEYNAR_API_KEY, on-chain-watches.yml, prefetch-reddit/vuln-scanner, skills.lock; 79 activity/14d, → flat)
  → Action: Operator populates memory/on-chain-watches.yml and adds NEYNAR_API_KEY repo secret first.

ON TRACK
• Cost-discipline downgrade pass — 0d idle, 34/14d (→ flat)
• monitor-runners DEEP-LIQ floor patch — 0d idle, 184/14d (→ flat)
• swarm-fund-mvp tick-broker falsifier (ADR-093, 9 days remaining) — 0d idle, 79/14d (↑ improving)
• swarm-fund-mvp 72h merge-cadence test — 0d idle, 37/14d (↑ improving from NEEDS_ATTENTION)
• Pre-Apex push monitor-polymarket + polymarket-comments — 0d idle, 234/14d (→ flat)
• Hermes-arb gate adjustment min-gap 7pp → 7.5–8pp — 0d idle, 153/14d (→ flat)
• Open ADR-096 resolution-text-ingest on swarm-fund-mvp — 0d idle, 12/14d (new)
• swarm-fund-mvp `OLLAMA_FULL=1` rollout falsifier (13 days remaining) — 0d idle, 65/14d (new)
• Skill-evals key fixes (PR #5) — 0d idle, 98/14d (→ flat; PR still OPEN)
• Code-health Day-6 carry — 0d idle, 38/14d (↑ improving from NEEDS_ATTENTION)
• ISS-018 / ISS-019 prompt-bug fixes — 0d idle, 25/14d (→ flat)
• paper-pick (daily PhD reading list) — 0d idle, 618/14d (→ flat)
• Cite stack for grant / Stanford application — 0d idle, 25/14d (new)

Sources: logs=ok, git=ok (1 commit / 30d), gh_pr=ok (tomscaria/aeon + aaronjmars/aeon#156 verified), gh_issue=disabled, cron-state=ok

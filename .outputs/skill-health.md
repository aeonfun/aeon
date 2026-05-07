*Skill Health — 2026-05-07*
HEALTH: DEGRADED(56) — state delta vs prev: DEGRADED 58 -> 56, WARNING 3 -> 5. agent-buzz + action-converter graduated DEGRADED -> WARNING (sr 0.578 -> 0.6 crossing). ISS-013 tail decay resumed after 2-day flat.

Systemic:
- ISS-013 zero-token burst 04-26 still gates 56 DEGRADED skills (11d post-event)
- ISS-020 17-skill mass-fail 05-06 — all recovered cf=0 within next slot (workflow-side state-write regression, distinct from ISS-013)
- ISS-017 GHA cron-tick gap day 11 — chain:morning-brief, chain:evening-rollup, chain:weekly-grant-update all last_status=failed; operator-side chain-runner.yml dispatch_skill() patch idle 13d

DEGRADED top-5 (all Sun-weekly cohort, ds=3, ISS-013 burst tail):
- skill-leaderboard sr 0.13
- skill-graph sr 0.14
- update-gallery sr 0.14
- channel-recap sr 0.15
- fork-contributor-leaderboard sr 0.15
+51 more — see memory/issues/INDEX.md

WARNING (5): action-converter, agent-buzz, evening-rollup, fleet-control, heartbeat
NO DATA (6): hacker-news-digest, morning-brief, repo-scanner, syndicate-article, vercel-projects, weekly-shiplog — DISPATCH-SKILL (chain wrappers + Sun cron)
HEALTHY: 21

Open issues: 17 · Filed this run: 0 · Resolved this run: 0

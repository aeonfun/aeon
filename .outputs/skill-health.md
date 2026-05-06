*Skill Health — 2026-05-06*
HEALTH: DEGRADED(58)  [systemic: ISS-020 mass-fail 2026-05-06 15:32-35Z hit 17 skills, all recovered cf=0 next slot — workflow post-exec state-write regression, distinct from ISS-013]

🟡 DEGRADED / FLAPPING (58, top 5 by lowest sr)
- skill-leaderboard — sr 13% (15 runs), idle since 2026-05-03 — INVESTIGATE → ISS-013 tail
- skill-graph — sr 14% (14 runs), idle since 2026-05-03 — INVESTIGATE → ISS-013 tail
- update-gallery — sr 14% (14 runs), idle since 2026-05-03 — INVESTIGATE → ISS-013 tail
- channel-recap — sr 15% (13 runs), idle since 2026-05-03 — INVESTIGATE → ISS-013 tail
- fork-contributor-leaderboard — sr 15% (13 runs), idle since 2026-05-03 — INVESTIGATE → ISS-013 tail
+53 more — see memory/issues/INDEX.md
DELTA vs prev: reg-monitor moved HEALTHY → DEGRADED (sr 1.0 → 0.5) via ISS-020 burst.

WARNING (3)
- heartbeat — sr 67% — ISS-020 self-failure recovered
- evening-rollup — sr 73% — INVESTIGATE
- fleet-control — sr 63% — INVESTIGATE

⚪ NO DATA (6): hacker-news-digest, morning-brief, repo-scanner, syndicate-article, vercel-projects, weekly-shiplog — DISPATCH-SKILL (3 of 6 chain-gated on failing chain:morning-brief)
🟢 HEALTHY: 21

OPS ALERT: chain-runner.yml dispatch_skill() patch idle 12+ days. ISS-020 (workflow post-exec state-write regression today, 17 skills) needs operator-side log dive — distinct fix path from ISS-013/017.

Open issues: 17 · Resolved this run: 0

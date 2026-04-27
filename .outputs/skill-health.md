*Skill Health — 2026-04-27 18:59Z*
HEALTH: DEGRADED(59) — recovery in progress

State change since 02:30Z: 53 skills moved CRITICAL→DEGRADED. All re-ran cleanly (cf=0, last_status=success). DEGRADED is a math artifact — historical success_rate <0.6 from the 04-26 23:53-58Z burst.

SYSTEMIC: 59 skills share the zero-token last_error (ISS-013). Auto-resolve gates on HEALTHY, not DEGRADED — so ISS-013 stays open.

Top 5 DEGRADED (oldest last_success):
- token-report — succ 0.08, last_success 02:11Z → ISS-013
- star-milestone — succ 0.13, last_success 02:16Z → ISS-013
- repo-pulse — succ 0.13, last_success 02:16Z → ISS-013
- technical-explainer — succ 0.10, last_success 02:17Z → ISS-013
- monitor-polymarket — succ 0.11, last_success 02:18Z → ISS-013 (mission-critical for Revenant)
+54 more — see memory/issues/INDEX.md

NO DATA (9, scheduled but unseen): morning-brief, hacker-news-digest, reg-monitor, project-lens, repo-scanner, syndicate-article, vercel-projects, weekly-review, weekly-shiplog → DISPATCH-SKILL
HEALTHY: 18

Open issues: 14 · Resolved: 0 · Filed: 0

Operator: chain-runner.yml dispatch_skill bug remains top priority — chain:morning-brief failed again at 07:56Z.

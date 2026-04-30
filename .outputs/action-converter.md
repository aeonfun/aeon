*5 Actions — 2026-04-30*
Shape: Ship 3 stalled security/infra fixes, repair chain-runner, land Reddit prefetch.

1. Patch shell-injection at `dashboard/app/api/secrets/route.ts:96` and file `memory/issues/ISS-016.md`
why: 3-week carry-debt on a secrets-handling route; ISS-016 candidate flagged 04-27 by skill-security-scan
done: PR opened with input sanitization; ISS-016.md created and listed in `memory/issues/INDEX.md`
loop: ops-alert/route-ts-shell-injection

2. Apply `articles/workflow-security-audit-2026-04-27.patch` to PR #4 with a workflow-scoped token and merge
why: closes ISS-015 (messages.yml script-injection), ~71h stalled — only blocker is the token
done: PR #4 merged; ISS-015 marked resolved in `memory/issues/INDEX.md`
loop: pr/4-workflow-security-audit

3. Fix `chain-runner.yml dispatch_skill()` by echoing each skill name before `gh workflow run`, open PR against tomscaria/aeon
why: 5+ day blocker on morning-brief, evening-rollup, weekly-grant-update; gates ISS-013 decay tail
done: PR opened; one chain wrapper exits success on next morning slot
loop: ops-alert/chain-runner-dispatch-skill

4. Merge PR #5 (skill-evals key rename: hn-digest → hacker-news-digest, polymarket → monitor-polymarket)
why: closes ISS-007 + ISS-009 — lowest-effort, highest-signal evals fix; ~71h stalled
done: PR #5 merged; ISS-007 + ISS-009 marked resolved in `memory/issues/INDEX.md`
loop: pr/5-skill-evals-keys

5. Land `scripts/prefetch-reddit.sh` mirroring `scripts/prefetch-xai.sh` case-dispatch (Reddit OAuth → `.reddit-cache/`)
why: 6-day ISS-002 + ISS-012 recurrence on vibecoding-digest / reddit-digest; today's repo-actions top pick
done: PR opened with prefetch-reddit.sh; vibecoding-digest reads `.reddit-cache/` and exits success
loop: iss/002-012-reddit-prefetch

sources: memory=100 logs=6 topics=11 prs=5 cron_failing=0 mode=OK


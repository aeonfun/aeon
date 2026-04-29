*5 Actions — 2026-04-29*
Shape: Instrument chain-runner, rebase PR #5, patch secrets shell-injection, index ISS-015, bump hermes-arb gate.

1. Instrument `.github/workflows/chain-runner.yml` `dispatch_skill()` — add `echo "Dispatching: $skill"` before each `gh workflow run` so the next failure leaves a trace.
why: chain:morning-brief failed again 2026-04-29 07:13 UTC; 5 days running; 3 chains down (morning-brief, evening-rollup, weekly-grant-update).
done: PR opened on tomscaria/aeon with echo lines visible inside dispatch_skill() body.
loop: chain-runner-instrument

2. Rebase `tomscaria/aeon#5` onto main and request operator review — patches `evals.json` keys (`hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket`).
why: PR open since 2026-04-27 18:59 UTC, ~46h stalled, cubic AI review SUCCESS, closes ISS-007 + ISS-009 with no code change.
done: PR #5 HEAD on top of main, review-requested marker on the PR.
loop: rebase-PR-5

3. Patch `dashboard/app/api/secrets/route.ts:96` shell-injection — replace template-string shell-out with `spawnSync('gh', argv, { input: value })`.
why: today's code-health audit flagged it as "third week running"; HIGH severity; backticks and $(…) still reach the shell despite quote-escape.
done: PR opened on aaronjmars/aeon with spawnSync swap plus a regression test for backtick injection.
loop: patch-secrets-shell-injection

4. Add ISS-015 row to `memory/issues/INDEX.md` open table (workflows/messages.yml:577–578 script-injection; PR #4 holds the patch; severity HIGH).
why: issue-triage gap flagged 2026-04-28 09:10 + 15:34 heartbeats; ISS-015 is the only open issue absent from INDEX; blocks audit completeness for grant-readiness.
done: INDEX.md committed with the ISS-015 row in the open table, status `open`.
loop: index-iss-015

5. Bump hermes-arb min-gap 7pp → 7.5pp in `tomscaria/swarm-fund-mvp` `strategies/hermes_arb/program.md` per ADR-038 noise-floor finding.
why: 04-25 deep-research said 7pp understates noise floor 50–100bp; carry-over 4 days; Kalshi crypto-perp tape now 3 days deep, falsifier window open.
done: PR opened on swarm-fund-mvp with the program.md numeric edit plus an ADR-038 footer note citing the deep-research file.
loop: bump-hermes-arb-mingap

sources: memory=139 logs=5 topics=6 prs=5 cron_failing=3 mode=OK


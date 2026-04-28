*5 Actions — 2026-04-28*
Shape: Patch chain-runner, ship Kalshi basis recorder, merge PR #5, unblock reply-maker, cap runners scorer.

1. Patch `.github/workflows/chain-runner.yml` `dispatch_skill()` to echo each dispatched skill name before the `gh workflow run` call — open PR on tomscaria/aeon.
why: 5 days running, blocks morning-brief + evening-rollup + weekly-grant-update; trace shows nothing today.
done: PR opened against tomscaria/aeon with echo lines in `dispatch_skill` helper.
loop: patch-chain-runner

2. Open a PR to tomscaria/swarm-fund-mvp adding `hermes_arb/basis_recorder.py` that polls Kalshi-BRTI and PM-Chainlink top-of-book every 5s.
why: Kalshi crypto perps live since 2026-04-27 NYC — first 24h tape is the load-bearing falsifier window for hermes-arb.
done: PR opened on swarm-fund-mvp; recorder writes to QuestDB on first cron tick.
loop: build-kalshi-pm-basis-recorder

3. Review and merge tomscaria/aeon#5 (rename `hn-digest` → `hacker-news-digest` and `polymarket` → `monitor-polymarket` in `skills/skill-evals/evals.json`).
why: ~22h open, no review yet; clears ISS-007 + ISS-009 BOOTSTRAP NEW_FAIL noise without code.
done: PR #5 merged; ISS-007 + ISS-009 marked resolved in `memory/issues/INDEX.md`.
loop: merge-pr5-skill-evals-keys

4. Add the `reply-maker)` case to `scripts/prefetch-xai.sh` per ISS-014 template — open PR on tomscaria/aeon.
why: 4 consecutive REPLY_MAKER_EMPTY exits, root cause is missing prefetch case (single-line fix); ISS-014 holds the template.
done: PR opened with the new bash case; next reply-maker run lands a non-empty digest.
loop: add-reply-maker-prefetch-case

5. Cap `pct_pts` at 300% in `skills/monitor-runners/SKILL.md` scoring and add a soft floor that always promotes the highest-score DEEP-LIQ survivor.
why: 3rd straight zero-DEEP-LIQ top-5 (04-25, 04-27 PM, 04-28); micro-caps swallow every slot under current weights.
done: PR opened with spec edit; next monitor-runners run yields >=1 DEEP-LIQ in top 5.
loop: cap-monitor-runners-pct-pts

sources: memory=128 logs=5 topics=9 prs=5 cron_failing=3 mode=OK


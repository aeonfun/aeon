*5 Actions — 2026-05-05*
Shape: Clear top-of-stack PR backlog: merge #5, review #31, ship Hermes-arb gate + reddit pause.

1. Merge `tomscaria/aeon#5` — rename `evals.json` keys `hn-digest` → `hacker-news-digest` and `polymarket` → `monitor-polymarket` so skill-evals stops missing those skills.
why: Day 8 idle; closes ISS-007 + ISS-009 and the skill-evals quality-history flatline named in MEMORY OPS ALERTS.
done: PR #5 merged into `tomscaria/aeon` main.
loop: pr-5-skill-evals-keys

2. Review `tomscaria/swarm-fund-mvp#31` — `fix(aeon_adapter): clear _last_error after successful poll` (29-LOC, 2 files, branch `ai/aeon-adapter-clear-last-error`, opened 17:08Z today).
why: ADR-093 falsifier closes 2026-05-17 (12 days); stale-error on the proof-of-freshness adapter is the highest-cost bug in the lane.
done: `gh pr review 31 --approve` or `--request-changes` posted with one-line verdict.
loop: pr-31-aeon-adapter-recovery

3. Open `tomscaria/swarm-fund-mvp` PR raising Hermes-arb `min-gap` from 7pp to 7.5pp per the deep-research finding logged in MEMORY Next-Priorities.
why: Kalshi-perps day-8 post-launch; operator-noted gate adjustment is the only Hermes-arb config item carried in Next-Priorities, fits before the falsifier-window closes.
done: PR opened with the `min-gap` config diff and a one-line cite of the deep-research finding in the body.
loop: hermes-arb-mingap-raise

4. Pause `reddit-digest` cron in `tomscaria/aeon` `aeon.yml` (comment-out the schedule line) until `scripts/prefetch-reddit.sh` ships.
why: 12th consecutive all-sources-error today; HTTP 403 deterministic on every endpoint, WebFetch host-blocked — daily noise + pager fatigue per today's reddit-digest log.
done: PR opened on `tomscaria/aeon` commenting out the `reddit-digest` schedule, body cites ISS-002 + ISS-012.
loop: reddit-digest-cron-pause

5. File `aaronjmars/aeon` PR landing the monitor-runners DEEP-LIQ floor patch (slot-5 replacement: if `top5.length===5` AND zero DEEP-LIQ in top5 AND DEEP-LIQ exists in survivors, replace slot 5 with highest-score DEEP-LIQ survivor).
why: 7th evidence run today — TTPA 5-in-a-row and SKYAI 7-in-a-row both closed 2026-05-05 with 8 DEEP-LIQ survivors but zero in top-5; patch would have fired and caught both.
done: PR opened on `aaronjmars/aeon` with the slot-5 replacement logic in `skills/monitor-runners/`, body cites the 6-run evidence chain in MEMORY Next-Priorities.
loop: monitor-runners-floor-patch

sources: memory=118 logs=7 topics=8 prs=15 cron_failing=3 mode=OK


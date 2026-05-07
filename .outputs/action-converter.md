*5 Actions — 2026-05-07*
Shape: Land outputs JSON, unblock auto-merge, validate Pyth XRP, queue cost downgrade, draft FinCEN post.

1. Commit `outputs/monitor-polymarket/2026-05-07.json` to `tomscaria/aeon` main with the MarketTick payload schema `aeon_adapter._poll_once` consumes (raw URL must return 200, not 404).
why: ADR-093 falsifier window closes ~2026-05-17 (10 days); poll layer 404s until first JSON ships.
done: GET on raw github URL `outputs/monitor-polymarket/2026-05-07.json` returns 200.
loop: outputs-contract-scaffold

2. Add `## Trusted Authors` section to `memory/watched-repos.md` listing `aaronjmars` (and `tomscaria`); commit + push to main.
why: First cleanly-mergeable PR on `aaronjmars/aeon` in 3 days (PR #160 v4-readiness) blocked solely by missing Trusted Authors policy line.
done: `## Trusted Authors` appears in `memory/watched-repos.md` on `main`; next `auto-merge` cron tick clears PR #160.
loop: trusted-authors-policy-unblock

3. Open PR on `tomscaria/swarm-fund-mvp` adding Pyth XRP/USD feed-ID verification entry to `outputs/manual_tasks_thomas.md`; either confirm `ec5d399b3b...` against the Pyth catalogue or fix `pipeline/ingestion/pyth_ws.py:36`.
why: Top blast-radius across all 3 repos per code-health 2026-05-06; CalibrationGap-adjacent ingestion; byte-identical 4 days running.
done: PR opened on `tomscaria/swarm-fund-mvp` with verification line + Pyth catalogue link.
loop: pyth-feed-xrp-validate

4. Draft `articles/position-fincen-manfred-2026-05-07.md` — 240-char Manfred-LLC human-of-record post for X/Farcaster + 3-cite supporting paragraph (ClawBank EIN 2026-05-01, Sullivan & Cromwell, Federal Register).
why: 33 days to FinCEN AML/CFT NPRM comment-window close 2026-06-09; fresh narrative; Polymarket Builders / dYdX / Uniswap Foundation Fellowship case-study fit.
done: `articles/position-fincen-manfred-2026-05-07.md` exists with 240-char headline + 3-cite paragraph; queued for `write-tweet`.
loop: fincen-manfred-position-post

5. Queue sonnet-4-6 model-downgrade patch for `external-feature` / `repo-actions` / `heartbeat` in `aeon.yml` as the lead item for next `self-improve` (~$149/wk savings).
why: $2,696/mo projection vs $40/wk discipline — 15× over per 2026-05-04 cost-report; CLAUDE.md cost-discipline rule.
done: `memory/topics/aeon-ops.md` has a "Next self-improve queue" subsection naming the 3 skills + 3 model-line replacements.
loop: cost-downgrade-aeon-yml

sources: memory=121 logs=7 topics=8 prs=9 cron_failing=3 mode=OK


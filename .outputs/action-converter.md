*5 Actions — 2026-05-01*
Shape: Trade Trump-Iran today, watchdog ISS-017, land PR #24, ship DEEP-LIQ floor, cite AIA.

1. Resolve a Polymarket "Trump-end-mil-ops-Iran" position today: market YES 36%, War-Powers-Act T+60 trigger fires today (Feb-28+60d), AP/Reuters/Times-of-Israel all reporting "hostilities have terminated" — the CalibrationGap quant scanner can't see the WPA catalyst, so it's a manual call. Either enter a directional/UMA-arb ticket or write a no-trade memo.
why: Highest-leverage Apex-gate counter today; one fill bumps Revenant 29 → 30 of the 100-trade gate.
done: Trade ticket on Polymarket OR a no-trade memo in Revenant's reflection-log naming the WPA trigger and resolution-debate split (Putrid-Campaign vs Proud-Compulsion).
loop: trump-iran-ops-resolution

2. Provision cron-job.org → workflow_dispatch on heartbeat.yml hourly, per ISS-017 escalation high → critical at 14:07 UTC today.
why: Only repair path for GHA scheduler silence; 13:00/13:30/14:00 tiers all silently skipped today, third consecutive day with multi-tier gaps.
done: cron-job.org task firing POST /repos/{owner}/aeon/actions/workflows/heartbeat.yml/dispatches hourly with a fine-grained PAT; first tick visible in heartbeat last_dispatch.
loop: iss-017-cron-watchdog

3. Approve and land tomscaria/swarm-fund-mvp#24 (paper_triage defensive parsing, +184/-15, 10 new tests, today's pr-review surfaced approve-ready, no blockers).
why: Clears the swarm-fund-mvp queue; defensive parsing keeps the paper_triage batch step green pre-Apex.
done: PR #24 merged into main on tomscaria/swarm-fund-mvp; CI passes.
loop: swarm-fund-mvp-pr-24

4. Ship the DEEP-LIQ floor patch in skills/monitor-runners/ — concrete one-liner already drafted in today's log: if top5 has zero DEEP-LIQ and survivors include one, replace slot 5 with the highest-score DEEP-LIQ survivor.
why: 5-in-a-row evidence (04-27 PM through 05-01) of DEEP-LIQ survivors buried by pct-weighted score; today TTPA fell to slot 9 despite $31.9M liq.
done: PR opened on tomscaria/aeon mutating monitor-runners process.js with the conditional-replace block + before/after on today's pool list in the PR body.
loop: monitor-runners-deep-liq-floor

5. Add arXiv:2511.07678 AIA Forecaster as a primary citation in memory/topics/grants.md "Citation hooks" under the Anthropic Research Credits / dYdX / Polymarket Builders entries; the paper is in topics/papers.md but missing from grants.md.
why: First LLM forecaster matching human superforecasters on ForecastBench + AIA-plus-consensus beats consensus alone — direct grant-app empirical anchor for the "agentic edge over PM consensus" claim with Yale/UIUC/IFP byline.
done: topics/grants.md has at least one new bullet in "Citation hooks (for grant-application body)" naming arXiv:2511.07678 with the additive-information empirical claim.
loop: grants-aia-citation

sources: memory=100 logs=7 topics=11 prs=5 cron_failing=3 mode=OK


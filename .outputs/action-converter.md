*5 Actions — 2026-05-03*
Shape: Schedule TN-T0 comments, trim Hormuz NO, lock secrets fix, tighten Hermes gate, promote PM handles.

1. Schedule polymarket-comments + reply-maker workflow_dispatch for ~04:00 UTC 2026-05-04 (Tamil Nadu T-0 resolution morning), var=tamil-nadu — collect resolution-debate handles, not pre-resolution signal.
why: T-1 thread already noisy (orangexyz 80k whale flag, scams scaling); T-0 morning is the only window to capture Encimado/Helldiver15 archetype before close.
done: workflow_dispatch fired or aeon.yml one-time entry merged with cron `0 4 4 5 *`.
loop: tn-resolution-morning-rerun

2. Trim Hormuz-by-end-of-June NO position from 54.5¢ exposure on saneperson + compute insider tape (50+ tankers passed Iranian side, Trump "very profitable business — like pirates" quote).
why: tape contradicts CENTCOM-mine + naval-blockade thesis floor; 33pp edge tightens to 15-20pp under monetized-blockade frame; headline-risk binary up.
done: position decision logged in memory/topics/polymarket.md Hormuz row + size delta sent.
loop: hormuz-no-reposition

3. Open PR on aaronjmars/aeon adding regression test for dashboard/app/api/secrets/route.ts POST + DELETE — assert value=`x\`whoami\`` is stored verbatim, not executed.
why: code-health top action — locks today's PR #150 shell-injection fix permanently; dashboard tree currently has zero tests.
done: PR opened, branch `tomscaria:test/secrets-route-regression`, single test file under dashboard/__tests__/.
loop: secrets-route-regression-test

4. Tighten Hermes-arb min-gap 7pp → 7.5–8pp in tomscaria/swarm-fund-mvp strategies/hermes_arb/program.md per deep-research finding.
why: Kalshi-perps falsifier-window day-4 is live (KXBTC-26MAY0217-B78125 +8pp on loose 4pp book) — bias toward fewer false positives before scaling capital.
done: PR opened on swarm-fund-mvp, gate constant updated, falsifier-window note in PR body.
loop: hermes-arb-min-gap

5. Promote 10 newly-surfaced PM comment handles (Moses1, Encimado, Helldiver15, EmeraldEdge, saneperson, Castwolffox, zer0xfourd, abdoohl, SakuraDevil, orangexyz) into memory/topics/polymarket.md handles section with archetype tags.
why: comments-side edge thesis hardening; reusable retrieval substrate for next 30 days of polymarket-comments runs (compute already cross-market 3-thread).
done: topics/polymarket.md gains "## Comments-side handles (newly surfaced 05-03)" with each handle + role.
loop: polymarket-handles-promote

sources: memory=99 logs=7 topics=8 prs=14 cron_failing=3 mode=OK


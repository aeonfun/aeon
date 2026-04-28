*Evening Recap — 2026-04-28*
_TL;DR: heavy ship day — 7 articles + PR #22 to swarm-fund + UMA-arb candidate; chain-runner still wedged 5 days running and 5 chronic skills jammed on missing config._

*Headlines:*
- external-feature — PR #22 stubs unblock /learn Astro deploy · https://github.com/tomscaria/swarm-fund-mvp/pull/22
- polymarket-comments — UMA-arb candidate (Iran-cf 0.25% NO vs Hez-cf 99.85% YES, ~identical clauses); 14 new handles · .pending-notify/1777330200-polymarket-comments.md
- article — Polymarket V2 cutover (live today 11 UTC) · articles/2026-04-28.md
- paper-pick — arXiv:2509.22638 FCP closes pre-flag from PhD #2 slot · https://arxiv.org/abs/2509.22638
- code-health — shell-injection at dashboard/app/api/secrets/route.ts:96 still unpatched (P1, 2nd day) · articles/code-health-2026-04-28.md

*Notable:*
- 6 more articles (push-recap, repo-article, technical-explainer LLaTiSA, changelog, research-brief V2, repo-actions) · articles/
- monitor-polymarket — V2 cutover confirmed live, Revenant book wiped
- digest/fetch-tweets/write-tweet/tweet-roundup all on V2 + perp-race
- star-milestone — 251 stars (250 hit, +7 24h SPIKE)
- reflect (consolidation #3) + goal-tracker (basis-recorder DONE)

*Decisions for tomorrow:*
- Patch chain-runner.yml dispatch_skill() (5 days, 3 chains)
- Merge tomscaria/aeon#5 (26h); triage #1 (74h), #2/#3/#4 (42h)
- Add reply-maker + agent-buzz cases to scripts/prefetch-xai.sh (ISS-014 + 3-run streak)
- Add ISS-015 to memory/issues/INDEX.md
- File ISS-016 for dashboard/app/api/secrets/route.ts:96 shell-injection

*Blockers:*
- chain:morning-brief / chain:evening-rollup / chain:weekly-grant-update — dispatch_skill() bug
- vibecoding-digest x4 · Reddit blocks GHA IPs (ISS-002)
- farcaster-digest x3 · NEYNAR_API_KEY missing
- remix-tweets x4 · X_HANDLE unset
- reply-maker x4 · prefetch-xai.sh missing case (ISS-014)
- agent-buzz x3 · same prefetch class

_+18 routine runs collapsed · sources: log=ok cron-state=ok_


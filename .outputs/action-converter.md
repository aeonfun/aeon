*5 Actions — 2026-05-08*
Shape: Ship outputs JSON, log Iran resolution, lock auto-merge, downgrade three skills, open DEEP-LIQ patch.

1. Ship the first `outputs/monitor-polymarket/2026-05-08.json` artifact on `tomscaria/aeon` with a `chain-runner.yml` post-skill hook that mkdir+writes; branch `feat/outputs-contract`.
why: ADR-093 falsifier 10 days remaining; producer-side wire-up still aspirational, gating swarm-fund-mvp tick-broker.
done: PR opened on `tomscaria/aeon` with the hook and the first JSON file committed.
loop: outputs-contract-scaffold

2. Tonight after midnight ET, record Iran-airspace-May-8 settlement postmortem in `memory/topics/polymarket.md` — final % YES vs sister "major closure" 52% YES book, 48pp clause-text-divergence empirical anchor #2 for the ADR-096 queue.
why: today's resolution turns a standing 48pp gap into closed-loop empirical record for resolution-text-ingest.
done: postmortem block appended to `memory/topics/polymarket.md` with settlement % and sister-book delta.
loop: iran-airspace-postmortem-record

3. Add `## Trusted Authors` section to `memory/watched-repos.md` listing `aaronjmars` (and `tomscaria`) — one-line edit that unblocks `auto-merge` for next repo-owner PR on `aaronjmars/aeon`.
why: yesterday's #2 didn't land; 1-line config still gating auto-merge despite PR #156 closure overnight.
done: file shows `## Trusted Authors` section with `aaronjmars` and `tomscaria` listed.
loop: trusted-authors-policy-unblock

4. Switch `external-feature` / `repo-actions` / `heartbeat` in `aeon.yml` to `model: claude-sonnet-4-6` — three-line edit, ~$149/wk savings; branch `chore/cost-downgrade`.
why: $2,696/mo run-rate is ~67× over $40/wk discipline; these three are highest-spend Opus-tagged skills.
done: PR opened on `tomscaria/aeon` with three model flags flipped to `claude-sonnet-4-6`.
loop: cost-downgrade-aeon-yml

5. Open monitor-runners DEEP-LIQ slot-5 floor patch PR on `aaronjmars/aeon` — branch `fix/monitor-runners-deep-liq-floor`; cite TTPA + SKYAI streak-end 05-05 plus 7-run organic evidence.
why: 7 organic-evidence runs banked since TTPA streak ended; aaronjmars/aeon queue cleared overnight (zero open PRs).
done: PR opened on `aaronjmars/aeon` with the slot-5 replacement diff and 7-run evidence in body.
loop: monitor-runners-deep-liq-floor-patch

sources: memory=132 logs=15 topics=11 prs=9 cron_failing=3 mode=OK


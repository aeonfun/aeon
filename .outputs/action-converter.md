*5 Actions — 2026-05-04*
Shape: Build Aeon outputs contract, validate Hormuz claim, draft TN-driven resolution-text ADR.

1. Build `outputs/{monitor-polymarket,polymarket-comments,narrative-tracker}/2026-05-04.json` on `tomscaria/aeon` and open PR exposing the JSON contract that swarm-fund-mvp's `python/execution/aeon_adapter.py` polls every 15 min.
why: ADR-093 (commit dc1846e) shipped the consumer 05-03; tomscaria/aeon side has no outputs/ — every poll 404s; falsifier window ~2026-05-17.
done: PR opened on tomscaria/aeon with at least `outputs/monitor-polymarket/2026-05-04.json` valid JSON; aeon_adapter.py poll returns 200.
loop: aeon-outputs-contract

2. Validate arsenelupin's "Trump lifted Hormuz blockade today" claim against @realDonaldTrump Truth Social timeline; if real, reposition the 54.5c NO Hormuz-by-end-of-June position before fair re-prices to 30%+.
why: live-tape chain saneperson - compute - arsenelupin - Hossein-m points at imminent move; 33pp MEMORY edge collapses on a single Trump tweet.
done: Truth Social URL or screenshot attached to a trade note in `memory/topics/polymarket.md`; position size confirmed or trimmed by EOD.
loop: hormuz-validate-arsenelupin

3. Draft `ADR-094 ingest-resolution-text` for `tomscaria/swarm-fund-mvp` using today's TN miss (TVK 6.95c -> 99.65c on $22M) + Cong dataset 3-layer schema (arXiv:2604.20421) as the architecture spec for `python/strategies/calibration_gap/` resolution-text ingestion.
why: TN falsifier is the freshest empirical evidence for the operator's stated single-highest-leverage CalibrationGap upgrade; Cong byline anchors Stanford citation.
done: `decisions/094-ingest-resolution-text.md` drafted with schema mapping, TN failure case, Cong citation, and falsifier criterion.
loop: ingest-resolution-text-adr

4. Delete `.env` from `tomscaria/lore-financial-teaser` git tracking with `git rm --cached .env`; verify `.gitignore` coverage; PR on branch `chore/untrack-env`.
why: Day-3 secret-hygiene carry; the 8-commit cleanup pass on 05-03 (`92c7b06`/`9b53f11`/`bfaae50`) missed it; 5-min fix on a leak surface.
done: PR merged removing tracked `.env`; `git ls-files | grep "\.env$"` empty on lore-financial-teaser main.
loop: lore-env-delete

5. Add regression test for `aaronjmars/aeon dashboard/app/api/secrets/route.ts` POST (line 96) + DELETE (line 119) asserting argv-array `execFileSync('gh', [...])` rejects backtick-injection payload such as `x\`whoami\``.
why: Day-2 carry on code-health top recommendation; locks PR #150 shell-injection fix against silent regression.
done: PR opened with `secrets-route.test.ts` covering both verbs; CI green.
loop: secrets-route-regression-test

sources: memory=112 logs=7 topics=8 prs=9 cron_failing=3 mode=OK


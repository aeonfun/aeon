*5 Actions — 2026-05-06*
Shape: Pin Iran falsifier; merge #31; scaffold ADR-095; spec RU window; wash-filter quant-scanner.

1. Pin Iran-airspace-by-May-8 falsifier-hit (15.5%→4% in 24h) plus Threadbare-Signal/Glamorous-Eagle/Partial-Intestine multi-handle NO cluster to `memory/topics/polymarket.md` Lessons section.
why: Cluster was correct against the kinetic tape; same handles run on Trump-China-by-May-31 — locks ground-truth for the clause-text scanner queue.
done: Commit pushed editing `memory/topics/polymarket.md` with a "2026-05-06 Iran-airspace falsifier" lesson + 3 handles tagged "validated".
loop: iran-airspace-falsifier-pin

2. Merge `tomscaria/swarm-fund-mvp#31` (`fix(aeon_adapter): clear _last_error after successful poll`).
why: pr-review approved 09:11Z today; ADR-093 critical-path defect; 11 days remain in the 2026-05-17 falsifier window.
done: PR #31 merged into `tomscaria/swarm-fund-mvp` main.
loop: pr-31-aeon-adapter-merge

3. Scaffold ADR-095 (clause-text ingest) on `tomscaria/swarm-fund-mvp` — open draft PR adding `docs/adrs/095-clause-text-ingest.md` with title, context (today's Iran-airspace 48pp divergence vs major-closure market $3.7M / 52% YES), and decision/consequences placeholders.
why: Today's Iran-airspace article and yesterday's repo article both name ADR-095 as the surface; scaffolding now anchors the lane before the next merge cycle and inside the ADR-093 falsifier window.
done: Draft PR opened on `tomscaria/swarm-fund-mvp` containing the new ADR file with 4 section headings.
loop: adr-095-clause-text-ingest

4. Spec Russia-Ukraine May-31 ceasefire (currently 6% YES) entry-trigger window 05-08 → 05-10 in `memory/topics/polymarket.md`: define which resolution-debate signals (UMA dispute filing, Trump TruthSocial post, Lavrov press) trigger entry, sizing per Quarter-Kelly, exit on resolution.
why: MEMORY tradable-hooks flags 05-08 → 05-10 as the comments-side leverage window; opens day after tomorrow.
done: New `## Russia-Ukraine entry-spec` section in `memory/topics/polymarket.md` with ≥3 trigger signals + sizing rule + exit rule.
loop: russia-ukraine-window-spec

5. Add wash-filter to CalibrationGap quant-scanner — drop fills where self-counterparty wash share >22% per `arXiv:2604.24366` Anatomy paper finding (median 1%, 22% upper tail).
why: Operator-actionable edge logged 05-04 paper-pick; CalibrationGap is the single-largest Apex-gate dependency (29/100); wash-skewed markets are the noisiest scanner input.
done: PR opened on `tomscaria/swarm-fund-mvp` adding `wash_share <= 0.22` filter at the fill-aggregation layer with paper cite in body.
loop: calibration-gap-wash-filter

sources: memory=118 logs=7 topics=8 prs=13 cron_failing=3 mode=OK


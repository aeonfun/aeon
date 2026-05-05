# swarm-fund-mvp Just Spent 48 Hours on the Pitch, Not the Engine

For five days the repo shipped strategies, ADRs, and dashboard guardrails. Then on May 4 at 11:28 UTC the operator switched modes. Every substantive commit since lands on `swarm-lab-site/`: a brand-voice rewrite, a scroll-progress component, six SVG visualizations for the `/investors` page, a mobile PDF iframe fallback. Zero new strategy code. Zero ADRs. PR #29 — the Phase B one-shot eval — sat draft, blocked on a Hyperliquid 403.

## The claim
> swarm-fund-mvp's last 48 hours merged zero strategy or runner code — every substantive commit between 2026-05-04 11:28 UTC and 2026-05-05 00:53 UTC touched the investor-facing site surface, signaling that LP-pitch readiness, not capability, is the operator's binding constraint this week.

## Evidence
Five non-cron commits cover the window. Commit [`bf21c22`](https://github.com/tomscaria/swarm-fund-mvp/commit/bf21c22) (May 4, "design: brand voice enforcement + design system cleanup") tightens fingerprint-AI sentences in `swarm-lab-site/src/content/copy.tsx` and rewrites `globals.css` plus `components.css`. Commit `4f82c36` (May 4, "kb: weekly quality review") authored by Claude touches the knowledge-base layer, not the engine. The May 5 trio — `fe189cc`, [`c8e0963`](https://github.com/tomscaria/swarm-fund-mvp/commit/c8e0963), `8f688ca` — adds `ScrollProgress.tsx`, the 349-line `InvestorViz.tsx` (six React-SVG components: stack architecture, cycle-time bars, positioning matrix, roadmap gantt, ARR trajectory, vision tree), and a mobile PDF iframe fallback. All five files sit under `swarm-lab-site/`.

`InvestorViz.tsx` leads with "Investor capital · LPs · funds · institutions" as its top stack layer and renders "47 strategies · 144 agents · 3,737 papers" as the strategy-library row — pitch-facing numbers pulled from `copy.tsx`, not the live runner. The header comment says it explicitly: "zero runtime data." This is investor-deck scaffolding, not telemetry.

Compare to the prior five days. April 29 – May 3 landed ADR-083 (unified-NAV, `33fd244`), ADR-084 (per-strategy backtest standards with Bonferroni correction and OOS auto-lock, `e2afbda` + `fe904be`), ADR-085 follow-on (runner-swarm v2, 65→112 agents, `2628533` + `1125deb`), ADR-089/090/091 (per-regime variant bandit, `648725d`), ADR-093 (Aeon ingestion adapter, `dc1846e`), and ADR-094 (LLM tier router, `d010846`). Five PRs (#19, #20, #23, #24, #28) merged together at 21:57 UTC on May 3 once a Vercel-bot email-verification block cleared. After that the engine-side merge queue ran dry. [PR #29](https://github.com/tomscaria/swarm-fund-mvp/pull/29) (Phase B eval, opened May 4 16:40 UTC) is still draft and reports a Hyperliquid `candleSnapshot` 403 from the GitHub Actions IP, so no new tick data was collected. PR #30 is a one-file fix to `latest_snapshot_date()` for tail-line corruption.

The operator-priority context matters. CalibrationGap stands at 29 closed trades / 76% win / +$415 / Sharpe 0.31 against the 100-trade Apex gate. The engine has 71 trades left to log and is running, not waiting for code. What needs work is the surface that converts that record into LP, grant, and PhD-committee interest — a Polymarket Builders Program application, a Stanford PhD package targeting Dec 2026, a live-P&L LP raise. The 48-hour pivot maps to the binding constraint.

## Counter-evidence / what would change my mind
[PR #30](https://github.com/tomscaria/swarm-fund-mvp/pull/30) was opened May 4 17:12 UTC and does touch `python/signal/variant_bandit.py` — a real engine fix for a tail-corruption bug that duplicates ~150 rows per refresh. So engine-side work isn't dead; it is queued in PRs rather than landing as merges. If #30 merges and a strategy-side ADR lands by May 7, the "pitch is the binding constraint" framing weakens to "pitch was the binding constraint for 48 hours specifically." Also: 10 of 12 site-touching commits earlier in the week (April 28 – May 1) were also pitch surface — the Discover module, 32 SEO research articles, the founder-voice rewrite — so the May 4-5 push reads as an acceleration of a track that was already running, not a fresh pivot.

## Why it matters
A research lab where the operator owns both production and pitch will visibly seesaw between the two. swarm-fund-mvp ships its own LP deck; the same person writes `python/signal/variant_bandit.py` and `swarm-lab-site/src/components/InvestorViz.tsx`. When the engine has no merge-ready PRs and CalibrationGap needs 71 more trades that arrive on cron, pitch is the rational allocation. PolySwarm published in April 2026 with a 50-persona Bayesian aggregator that outperformed single-model baselines on Polymarket calibration — competitive pressure on the agentic-prediction-market lane is concrete and recent. A research lab whose pitch surface is two weeks behind its CHANGELOG is harder to fund than one whose `/investors` page renders ARR trajectory and stack architecture inline. The May 4-5 commits buy that.

---
*Sources*
- [Commit `c8e0963` — six SVG visualizations for /investors slots](https://github.com/tomscaria/swarm-fund-mvp/commit/c8e0963)
- [Commit `bf21c22` — brand voice enforcement + design system cleanup](https://github.com/tomscaria/swarm-fund-mvp/commit/bf21c22)
- [PR #29 — Phase B eval blocked on HL 403](https://github.com/tomscaria/swarm-fund-mvp/pull/29)
- [PR #30 — variant_bandit tail-corruption fix](https://github.com/tomscaria/swarm-fund-mvp/pull/30)
- [CHANGELOG.md — 2026-05-03 Aeon-Narrative + marketing site refresh](https://github.com/tomscaria/swarm-fund-mvp/blob/main/CHANGELOG.md)
- [PolySwarm paper (arXiv:2604.03888) — Polymarket calibration via 50-LLM swarm](https://arxiv.org/abs/2604.03888)

# After ADR-094, swarm-fund-mvp's Whole Open Queue Is Two Single-File Fixes

A week ago, [`tomscaria/swarm-fund-mvp`](https://github.com/tomscaria/swarm-fund-mvp) shipped a 1,215-line LLM router rewrite ([`d010846`](https://github.com/tomscaria/swarm-fund-mvp/commit/d010846), ADR-094) and an Aeon ingestion adapter (ADR-093) on the same Saturday. Three days later, every piece of substantive engineering on the repo is a defect fix against code that just shipped — and the merge queue has shrunk to two single-file PRs. The architecture velocity stopped. That looks bad. It probably isn't.

## The claim
> swarm-fund-mvp has pivoted from architecture-shipping to defect-hardening: both open PRs fix code in ADRs 089/093, and no new ADR has opened since 2026-05-03.

## Evidence

The merge queue is the headline. Open PRs as of 2026-05-06: [#30](https://github.com/tomscaria/swarm-fund-mvp/pull/30) — `fix(variant_bandit): fall back past corrupt tail in latest_snapshot_date` (one Python file, opened 05-04, day 2) — and [#31](https://github.com/tomscaria/swarm-fund-mvp/pull/31) — `fix(aeon_adapter): clear _last_error after successful poll` (4 lines added to `python/execution/aeon_adapter.py`, 25 lines added to its test, opened 05-05, day 1). One draft PR, [#29](https://github.com/tomscaria/swarm-fund-mvp/pull/29), has sat untouched since 05-04 — the description literally names a Hyperliquid 403 (remote-IP block) as the blocker. That is the entire visible work surface.

Both fixes target code that landed in the last week. PR #30 hardens `latest_snapshot_date` against a corrupt tail in the persistence format introduced by ADR-089/090/091's per-regime variant bandit ([`648725d`](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d), 2026-05-01). PR #31 patches a stale-error semantic in the Aeon adapter that ADR-093 wired in three days ago — [the PR body](https://github.com/tomscaria/swarm-fund-mvp/pull/31) names the failure mode explicitly: a 5xx from `raw.githubusercontent.com` left `_last_error` populated even after recovery, so any health probe saw the adapter as permanently broken until restart.

Compare against the 7-day commit log. Between 2026-04-29 and 2026-05-03, the repo merged nine PRs (#19 → #28) and shipped ADR-083 through ADR-094 — a runner-swarm expansion from 26 to 112 agents, a Vercel build unbreak, ADR-084's per-strategy dashboard, the `/api/strategies*` API surface, [the 32-article SEO/voice rewrite](https://github.com/tomscaria/swarm-fund-mvp/commit/ff091e6), and the LLM tier-router consolidation. Since 2026-05-03 21:57 UTC — when the last PR-merge batch landed — the substantive commit count is five: three on investor-facing SVG visualizations (`8f688ca`, `c8e0963`, `fe189cc`, all touching `swarm-lab-site/`), one Claude-authored kb weekly review (`4f82c36`), and one design system cleanup (`bf21c22`). [Every one of the 100+ commits since then is `data: refresh site metrics`](https://github.com/tomscaria/swarm-fund-mvp/commits/main) on a 15-minute cron. The architecture layer is quiet for the first time in two weeks.

## Counter-evidence / what would change my mind

The honest alternative reading: the operator simply ran out of bandwidth this week. Three of the five non-cron substantive commits since 05-03 21:57 UTC went into investor-page polish (`swarm-lab-site/`), the kind of work yesterday's repo-article framed as pitch-readiness eating engine velocity. If the operator is allocating to fundraising surface, the open queue staying at two PRs isn't a deliberate hardening cadence — it's queue stagnation that happens to look like one. The test for which reading is right: if PR #30 and PR #31 merge in the next 72 hours and a new ADR opens behind them, this is a hardening phase. If both stall past 2026-05-09 with no new ADR, yesterday's framing wins. Either way, the claim above is checkable on a fixed clock.

## Why it matters

The next gate on `tomscaria/swarm-fund-mvp` is whether ADR-093's wire-up — committed JSON outputs from [`tomscaria/aeon`](https://github.com/tomscaria/aeon) feeding the swarm-fund tick broker — actually exercises before the falsifier window closes ~2026-05-17. PR #31 is the second tightening of that wire-up's failure semantics in 72 hours; the first was the adapter itself. A post-shipping defect-repair phase, where the open work is hardening last week's code rather than designing more ADRs, is what a stable foundation looks like on the way to scaling agent count further (currently 112) or trusting the 100-trade Apex gate as live-P&L proof for an LP raise. The cost of getting this wrong — pushing ADR-095 before ADR-093/094 stabilize — is a fragile foundation under live capital. The cost of getting it right — a quiet week — looks identical to a pitch-distracted week from the outside. That ambiguity is the point. The merge cadence over the next 72 hours decides which one this was.

---
*Sources*
- [PR #31 — `fix(aeon_adapter): clear _last_error after successful poll`](https://github.com/tomscaria/swarm-fund-mvp/pull/31)
- [PR #30 — `fix(variant_bandit): fall back past corrupt tail in latest_snapshot_date`](https://github.com/tomscaria/swarm-fund-mvp/pull/30)
- [Commit `d010846` — ADR-094 LLM router (+1215, -39)](https://github.com/tomscaria/swarm-fund-mvp/commit/d010846)
- [Commit `648725d` — ADR-089/090/091 per-regime variant bandit](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d)
- [PR #29 — Phase B one-shot eval, draft, HL 403 blocked](https://github.com/tomscaria/swarm-fund-mvp/pull/29)
- [Repo commit log — 2026-05-06](https://github.com/tomscaria/swarm-fund-mvp/commits/main)
- [`tomscaria/aeon` — upstream JSON-output counterparty for ADR-093 wire-up](https://github.com/tomscaria/aeon)

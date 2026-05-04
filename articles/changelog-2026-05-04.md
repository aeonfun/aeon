# Changelog — Week of 2026-05-04

*Window: 2026-04-27 → 2026-05-04 · Sources: tomscaria/swarm-fund-mvp=ok, tomscaria/lore-financial-teaser=ok, aaronjmars/aeon=ok*

## tomscaria/swarm-fund-mvp

> **Highlights:** Fleet jumped 74→112 agents and 30→34 strategies via the runner-swarm wrap of five new strategies, and the Aeon-Narrative ingestion adapter went live — research-side `outputs/{skill}/{date}.json` now fans into MarketTicks. Per-strategy dashboard and `/api/strategies*` routes shipped behind ADR-084.

### Added
- Aeon-Narrative ingestion adapter — polls research-side JSON every 15 minutes and emits MarketTicks tagged `aeon_signal`. ([dc1846e](https://github.com/tomscaria/swarm-fund-mvp/commit/dc1846e))
- Runner-swarm fleet expansion: 5 new strategies wrapped, fleet grew 74→112 agents / 30→34 strategies; 79% of new agents are aeon-narrative LH-sampled variants. ([1125deb](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb))
- Per-strategy detail page, sortable scoreboard, and fleet health view in the dashboard (ADR-084). ([fe904be](https://github.com/tomscaria/swarm-fund-mvp/commit/fe904be))
- `/api/strategies*` routes powering the new dashboard surface. ([d5f902e](https://github.com/tomscaria/swarm-fund-mvp/commit/d5f902e))
- Per-strategy backtest sidecar with varrd-style guardrails (ADR-084). ([e2afbda](https://github.com/tomscaria/swarm-fund-mvp/commit/e2afbda), [c48f773](https://github.com/tomscaria/swarm-fund-mvp/commit/c48f773))
- Per-regime variant bandit, cull-corroboration, and posterior history (ADR-089/090/091). ([648725d](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d))
- Task-aware LLM tier router with a suggestion surface (ADR-094). ([d010846](https://github.com/tomscaria/swarm-fund-mvp/commit/d010846))
- Bulk-attach CLI and weekly snapshot routine for ADR-084. ([5a1b3c8](https://github.com/tomscaria/swarm-fund-mvp/commit/5a1b3c8))
- `pm-complete-set-drain` real-data feeder pushed Wave 20 from harvest into live runners. ([4d70c26](https://github.com/tomscaria/swarm-fund-mvp/commit/4d70c26))
- Runner-swarm v2 framework (snapshot/tick dispatch + history producers) plus 26-strategy / 65-variant expansion. ([2628533](https://github.com/tomscaria/swarm-fund-mvp/commit/2628533), [5f1f2fb](https://github.com/tomscaria/swarm-fund-mvp/commit/5f1f2fb), [85fcea1](https://github.com/tomscaria/swarm-fund-mvp/commit/85fcea1))
- Public research surface and 32 SEO articles on rswarm.ai. ([9d0aab2](https://github.com/tomscaria/swarm-fund-mvp/commit/9d0aab2))
- `/learn` route — Astro knowledge base now serving at rswarm.ai/learn. ([be10dd0](https://github.com/tomscaria/swarm-fund-mvp/commit/be10dd0))
- `/investors` split into a public vision page and gated 101 / 201 / one-pager surfaces. ([b686093](https://github.com/tomscaria/swarm-fund-mvp/commit/b686093))
- Scroll-in motion across landing, Pricing, and Signals pages. ([0eaf389](https://github.com/tomscaria/swarm-fund-mvp/commit/0eaf389))
- Top-level `CHANGELOG.md` with ADR-084 entry. ([55f048b](https://github.com/tomscaria/swarm-fund-mvp/commit/55f048b))
- `papers_ingested` count surfaced in site metrics. ([607183a](https://github.com/tomscaria/swarm-fund-mvp/commit/607183a))

### Changed
- Full marketing surface and 32 research articles rewritten in founder voice with compliance language scrubbed. ([121ba3e](https://github.com/tomscaria/swarm-fund-mvp/commit/121ba3e), [ff091e6](https://github.com/tomscaria/swarm-fund-mvp/commit/ff091e6), [1f9aadf](https://github.com/tomscaria/swarm-fund-mvp/commit/1f9aadf))
- Brand-voice and design-system pass — italics replace mid-paragraph bolds, `--bg-alt` token consolidated, vestigial `index.css` removed. ([bf21c22](https://github.com/tomscaria/swarm-fund-mvp/commit/bf21c22))
- Investor materials refreshed with v2 harvest data. ([d6ca2e7](https://github.com/tomscaria/swarm-fund-mvp/commit/d6ca2e7))

### Fixed
- Triage now parses LLM scores and reasoning defensively; bad model output no longer crashes the pipeline. ([#24](https://github.com/tomscaria/swarm-fund-mvp/pull/24))
- `pm-tail-risk` fair-prob horizon uses fractional days, ending integer-rounding error on sub-day windows. ([#23](https://github.com/tomscaria/swarm-fund-mvp/pull/23))
- Markdown image-strip regex bracket order corrected in harvest pipeline. ([#20](https://github.com/tomscaria/swarm-fund-mvp/pull/20))
- SSRN harvest counts inserted rows via `cursor.rowcount` instead of misleading `connection.total_changes`. ([#19](https://github.com/tomscaria/swarm-fund-mvp/pull/19))
- Hyperliquid `get_balance()` now returns unified equity (perp + spot USDC) — ADR-083. ([33fd244](https://github.com/tomscaria/swarm-fund-mvp/commit/33fd244))
- Vercel build sandbox now includes `learn-site/` and `kb/`, unbreaking production deploys. ([#25](https://github.com/tomscaria/swarm-fund-mvp/pull/25))
- Daily report split into Real / Canary / Shadow buckets so canary P&L no longer mixes with shadow runs. ([656b5b5](https://github.com/tomscaria/swarm-fund-mvp/commit/656b5b5))
- Strategy `Signal.fired_at` now stamps `tick.ts` instead of `datetime.now()`, removing wall-clock drift in backtests (caught by ADR-084 gate). ([c76064d](https://github.com/tomscaria/swarm-fund-mvp/commit/c76064d))
- Portfolio Black-Litterman optimizer no longer crashes on `None` weights. ([6663b7c](https://github.com/tomscaria/swarm-fund-mvp/commit/6663b7c))
- `pm-complete-set` strategy persists across loop scans instead of dropping each iteration. ([6022418](https://github.com/tomscaria/swarm-fund-mvp/commit/6022418))
- SPA fallback restored for `/investors` and other client routes that previously 404'd on direct load. ([d9044ce](https://github.com/tomscaria/swarm-fund-mvp/commit/d9044ce))
- Site build unbroken: missing privy-loader, WaitlistCTAAuth, api stubs, framer-motion, and d3-scale committed. ([197f6c3](https://github.com/tomscaria/swarm-fund-mvp/commit/197f6c3), [58407ee](https://github.com/tomscaria/swarm-fund-mvp/commit/58407ee), [f2240a7](https://github.com/tomscaria/swarm-fund-mvp/commit/f2240a7))
- DeepSeek tier included in extractor counts dict with defensive `get()`. ([3f9a1af](https://github.com/tomscaria/swarm-fund-mvp/commit/3f9a1af))

*Internal: ~700 commits hidden — 619 cron-driven `data: refresh site metrics`, plus docs, gitignore, test repairs, and chore housekeeping. Bots filtered: 0 (Claude-co-authored commits land under the operator's name).*

---

## tomscaria/lore-financial-teaser

> **Highlights:** Project rebooted as **Lore Financial Teaser** with a fresh Aeon-wired master plan, brand-voice rewrite across the marketing site, Ondo→xStocks pivot in the pitch deck, and a 13% main-bundle cut from lazy-loading below-fold sections.

### Added
- Aeon wiring + Lore Inc migration master plan landed as the project's first feature PR. ([#1](https://github.com/tomscaria/lore-financial-teaser/pull/1))

### Changed
- Project renamed to **Lore Financial Teaser**. ([#4](https://github.com/tomscaria/lore-financial-teaser/pull/4))
- Pitch deck pivoted from Ondo references to xStocks across all pages. ([#3](https://github.com/tomscaria/lore-financial-teaser/pull/3))
- Marketing site rewritten in Thomas Scaria's voice (full brand-voice enforcement). ([#6](https://github.com/tomscaria/lore-financial-teaser/pull/6), [bfaae50](https://github.com/tomscaria/lore-financial-teaser/commit/bfaae50))
- Main bundle 13% smaller — six heavy below-fold sections now lazy-load. ([9b53f11](https://github.com/tomscaria/lore-financial-teaser/commit/9b53f11))
- Six dead component files and the unused `@tanstack/react-query` dep removed. ([92c7b06](https://github.com/tomscaria/lore-financial-teaser/commit/92c7b06), [10f3895](https://github.com/tomscaria/lore-financial-teaser/commit/10f3895))
- Ship-ready public surface — README, OG image, `.env`, Vercel config. ([#2](https://github.com/tomscaria/lore-financial-teaser/pull/2))

### Fixed
- Duplicate SVG import removed and `aria-label` added to `SectionNav` buttons (a11y). ([c2d6cb0](https://github.com/tomscaria/lore-financial-teaser/commit/c2d6cb0))
- All five ESLint errors across the codebase resolved. ([b1114a9](https://github.com/tomscaria/lore-financial-teaser/commit/b1114a9))

*Internal: 7 commits hidden (docs, COPY_GUIDELINES, AEON_DEPLOY_LORE, smoke tests). Bots filtered: 0.*

---

## aaronjmars/aeon

> **Highlights:** Six new skills shipped this week — fork-cohort, operator-scorecard, show-hn-draft, smithery-manifest, thread-formatter, pr-triage, skill-freshness, plus the heartbeat Token Pulse section. The dashboard secrets route closed a shell-injection bug by switching to argv-array `execFileSync`.

### Added
- `skill-freshness` skill — audits enabled skills' upstream file deps for staleness. ([#157](https://github.com/aaronjmars/aeon/pull/157))
- `fork-cohort` skill — weekly activation-stage tracker for downstream Aeon forks. ([#152](https://github.com/aaronjmars/aeon/pull/152))
- `operator-scorecard` skill — operator-level engagement metric. ([#153](https://github.com/aaronjmars/aeon/pull/153))
- `show-hn-draft` skill — pre-writes the Show HN launch post under zero pressure. ([#151](https://github.com/aaronjmars/aeon/pull/151))
- `smithery-manifest` skill — auto-generates MCP-Registry / Smithery submission docs from `skills.json`. ([#149](https://github.com/aaronjmars/aeon/pull/149))
- `thread-formatter` skill — reformats the top daily event into a 5-tweet thread. ([#148](https://github.com/aaronjmars/aeon/pull/148))
- `pr-triage` skill — first-touch triage for external PRs. ([#147](https://github.com/aaronjmars/aeon/pull/147))
- Heartbeat status page now shows a Token Pulse section. ([#146](https://github.com/aaronjmars/aeon/pull/146))
- `SHOWCASE.md` — active forks and ecosystem comparison. ([#145](https://github.com/aaronjmars/aeon/pull/145))

### Changed
- Agent status badge removed from the README. ([c95478c](https://github.com/aaronjmars/aeon/commit/c95478c))

### Fixed
- `skills.json` total and `show-hn-draft` category registration corrected after manifest drift from #151 / #153. ([#154](https://github.com/aaronjmars/aeon/pull/154))

### Security
- Dashboard secrets route switched to argv-array `execFileSync` for both POST and DELETE, closing a shell-injection vector that had been carried for four weeks. ([#150](https://github.com/aaronjmars/aeon/pull/150))

*Internal: 1 commit hidden (skills category cleanup, [#155](https://github.com/aaronjmars/aeon/pull/155)). Bots filtered: 0.*

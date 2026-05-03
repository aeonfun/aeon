# Changelog — Week of 2026-05-03

*Window: 2026-04-26 → 2026-05-03 · Sources: tomscaria/swarm-fund-mvp=ok, tomscaria/lore-financial-teaser=ok, aaronjmars/aeon=ok*

## tomscaria/swarm-fund-mvp

> **Highlights:** Aeon-Narrative ingestion adapter went in (`dc1846e`), letting `tomscaria/aeon`'s skill outputs flow as MarketTicks into 30 of 38 net-new agents. Production deploys also unbroke this week (PR [#25](https://github.com/tomscaria/swarm-fund-mvp/pull/25)) — `rswarm.ai` had been serving stale content for ~3 days because the Vercel build sandbox was missing `learn-site/` and `kb/`.

### Added
- Aeon-Narrative ingestion adapter polls `tomscaria/aeon`'s skill outputs (monitor-polymarket, polymarket-comments, narrative-tracker) on a 15-min cadence and emits MarketTicks. ([`dc1846e`](https://github.com/tomscaria/swarm-fund-mvp/commit/dc1846e))
- Runner-swarm fleet expanded from 74 to 112 agents and 30 to 34 strategies. ([`1125deb`](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb))
- New `/learn` route at rswarm.ai/learn serves an Astro KB with 29 hand-authored stubs. ([`be10dd0`](https://github.com/tomscaria/swarm-fund-mvp/commit/be10dd0))
- New `/research` surface with 32 SEO articles. ([`9d0aab2`](https://github.com/tomscaria/swarm-fund-mvp/commit/9d0aab2))
- Per-strategy detail page, sortable scoreboard, and fleet-health view land on the dashboard (ADR-084). ([`fe904be`](https://github.com/tomscaria/swarm-fund-mvp/commit/fe904be))
- `/api/strategies*` routes back the new ADR-084 dashboard surface. ([`d5f902e`](https://github.com/tomscaria/swarm-fund-mvp/commit/d5f902e))
- Per-strategy backtest sidecar with varrd-style guardrails (ADR-084). ([`e2afbda`](https://github.com/tomscaria/swarm-fund-mvp/commit/e2afbda))
- Bulk-attach CLI and weekly snapshot routine for ADR-084. ([`5a1b3c8`](https://github.com/tomscaria/swarm-fund-mvp/commit/5a1b3c8))
- `/investors` splits into a public vision page plus gated 101 / 201 / one-pager decks. ([`b686093`](https://github.com/tomscaria/swarm-fund-mvp/commit/b686093))
- Scroll-in motion across landing, Pricing, and Signals pages. ([`0eaf389`](https://github.com/tomscaria/swarm-fund-mvp/commit/0eaf389))
- Daily report splits into Real / Canary / Shadow buckets. ([`656b5b5`](https://github.com/tomscaria/swarm-fund-mvp/commit/656b5b5))
- `papers_ingested` count surfaces in site metrics. ([`607183a`](https://github.com/tomscaria/swarm-fund-mvp/commit/607183a))
- xAI free-credits voucher tracked in the grants dashboard pipeline. ([#27](https://github.com/tomscaria/swarm-fund-mvp/pull/27))

### Changed
- Marketing surface and 32 research articles rewritten in founder voice with a compliance scrub. ([`121ba3e`](https://github.com/tomscaria/swarm-fund-mvp/commit/121ba3e), [`ff091e6`](https://github.com/tomscaria/swarm-fund-mvp/commit/ff091e6))
- Investor materials refreshed against v2 harvest data. ([`d6ca2e7`](https://github.com/tomscaria/swarm-fund-mvp/commit/d6ca2e7))
- Long-term vision doc names compute commoditization explicitly: moats are upstream of silicon. ([#26](https://github.com/tomscaria/swarm-fund-mvp/pull/26))

### Fixed
- Production deploys unbroken — `.vercelignore` now whitelists `learn-site/` and `kb/`, ending 19 of 20 ERROR builds since 2026-04-28. ([#25](https://github.com/tomscaria/swarm-fund-mvp/pull/25))
- Restored missing `privy-loader` / `WaitlistCTAAuth` / `api.ts` stubs that broke vite builds. ([#22](https://github.com/tomscaria/swarm-fund-mvp/pull/22))
- `get_balance()` returns unified Hyperliquid equity (perp + spot USDC) instead of perp-only. ([`33fd244`](https://github.com/tomscaria/swarm-fund-mvp/commit/33fd244))
- `Signal.fired_at` now uses `tick.ts` instead of `datetime.now()`, avoiding wall-clock drift in fired signals. ([`c76064d`](https://github.com/tomscaria/swarm-fund-mvp/commit/c76064d))
- Portfolio Black-Litterman optimizer handles `None` weights gracefully. ([`6663b7c`](https://github.com/tomscaria/swarm-fund-mvp/commit/6663b7c))
- Repaired 7 pre-existing test failures across the suite. ([`d83a935`](https://github.com/tomscaria/swarm-fund-mvp/commit/d83a935))
- SPA fallback restored on `/investors` and other client-side routes. ([`d9044ce`](https://github.com/tomscaria/swarm-fund-mvp/commit/d9044ce))
- `pm-complete-set` strategy persists across loop scans in the runner. ([`6022418`](https://github.com/tomscaria/swarm-fund-mvp/commit/6022418))
- Extractor / triage now include the deepseek tier in counts dicts with defensive `.get()` lookups. ([`3f9a1af`](https://github.com/tomscaria/swarm-fund-mvp/commit/3f9a1af))

*Internal: ~660 commits hidden — 561 cron `data: refresh site metrics`, ~99 strategy waves (Waves 4–20: pm-complete-set-drain, hermes-herd, hl-vwap-reversion, pm-prob-reversion, pm-conviction-breakout and 12 more), ADR-071/072/074/076/083/085/089/090/091, research harvesters (NBER, SSRN, regulator, VC blog, DeepSeek tier), session/brief docs, and chore/gitignore housekeeping. Bots filtered: 0.*

---

## tomscaria/lore-financial-teaser

> **Highlights:** Repo went ship-ready and launched as `lore.financial`. Project renamed off the "Pre-Series A" framing, Aeon agent framework wired in via sibling-dir symlink, and the Lore Inc cross-product migration master plan now lives in this repo.

### Added
- Aeon agent framework wired in via `.claude/aeon-skills` symlink to a sibling clone of `tomscaria/aeon`; `MIGRATION.md` lands as the canonical Lore Inc consolidation master plan. ([#1](https://github.com/tomscaria/lore-financial-teaser/pull/1))
- Ship-ready public surface — README rewrite, real OG metadata, `.env` `.gitignore`, Vite SPA `vercel.json` with security headers. ([#2](https://github.com/tomscaria/lore-financial-teaser/pull/2))

### Changed
- Project renamed from "Lore Pre-Series A" / `lorepreseriesa` to **Lore Financial Teaser** to match the live `lore.financial` domain. ([#4](https://github.com/tomscaria/lore-financial-teaser/pull/4))
- Pitch deck pivots all Ondo Finance partner references to xStocks; PYPL holding reassigned from Ondo (Ethereum) to xStocks (Solana). ([#3](https://github.com/tomscaria/lore-financial-teaser/pull/3))
- `CLAUDE.md` clone instructions point at the `tomscaria/aeon` fork (which carries 13 Firecrawl skills) rather than upstream. ([#5](https://github.com/tomscaria/lore-financial-teaser/pull/5))

*Internal: 0 commits hidden. Bots filtered: 0.*

---

## aaronjmars/aeon

> **Highlights:** Six new skills shipped — `smithery-manifest`, `thread-formatter`, `pr-triage`, `show-hn-draft`, `operator-scorecard`, `fork-cohort` — plus a Token Pulse section on the public status page. The shell-injection at `dashboard/app/api/secrets/route.ts:96` was patched via `execFileSync`, pre-empting ISS-016.

### Added
- `smithery-manifest` skill auto-generates Smithery / MCP-Registry submission docs from `skills.json` — the 95-tool catalog is one click from Claude Desktop. ([#149](https://github.com/aaronjmars/aeon/pull/149))
- `thread-formatter` skill auto-formats the top daily event as a 5-tweet thread. ([#148](https://github.com/aaronjmars/aeon/pull/148))
- `pr-triage` skill performs first-touch triage on external PRs. ([#147](https://github.com/aaronjmars/aeon/pull/147))
- `show-hn-draft` skill pre-writes the Show HN launch post ahead of time. ([#151](https://github.com/aaronjmars/aeon/pull/151))
- `operator-scorecard` skill generates an operator-facing scorecard. ([#153](https://github.com/aaronjmars/aeon/pull/153))
- `fork-cohort` skill produces a weekly activation-stage tracker for forks. ([#152](https://github.com/aaronjmars/aeon/pull/152))
- `contributor-reward` skill turns the fork-contributor leaderboard into a tier-priced USDC payout plan on Base. ([#144](https://github.com/aaronjmars/aeon/pull/144))
- `skill-analytics` adds a fleet-level skill-run analytics widget. ([#142](https://github.com/aaronjmars/aeon/pull/142))
- Token Pulse section on the public heartbeat status page. ([#146](https://github.com/aaronjmars/aeon/pull/146))
- `SHOWCASE.md` lists active forks and an ecosystem comparison. ([#145](https://github.com/aaronjmars/aeon/pull/145))

### Fixed
- `skills.json` total bumped and the `show-hn-draft` category registered, fixing manifest drift from PRs #151 and #153. ([#154](https://github.com/aaronjmars/aeon/pull/154))

### Security
- Shell-injection at `dashboard/app/api/secrets/route.ts:96` closed by replacing string-formatted shell with `execFileSync` on secret set/delete. ([#150](https://github.com/aaronjmars/aeon/pull/150))

*Internal: 2 commits hidden — orphan-skill categorization (#155), README badge removal. Bots filtered: 0.*

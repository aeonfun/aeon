# Changelog — Week of 2026-05-06

*Window: 2026-04-29 → 2026-05-06 · Sources: tomscaria/swarm-fund-mvp=ok, tomscaria/lore-financial-teaser=ok, aaronjmars/aeon=ok*

## tomscaria/swarm-fund-mvp

> **Highlights:** The biggest week in the project's history landed. The fleet grew from 20 to 112 paper-trading agents across 30 strategies, a per-strategy admin dashboard with backtest guardrails went live (ADR-084), and the Aeon-Narrative ingestion adapter (ADR-093) and task-aware LLM tier router (ADR-094) both shipped. The investors page picked up six SVG visualizations.

### Added
- Per-strategy admin dashboard with sortable scoreboard, fleet-health view, and varrd-style backtest guardrails (ADR-084). ([fe904be](https://github.com/tomscaria/swarm-fund-mvp/commit/fe904beb), [d5f902e](https://github.com/tomscaria/swarm-fund-mvp/commit/d5f902e), [e2afbda](https://github.com/tomscaria/swarm-fund-mvp/commit/e2afbda), [c48f773](https://github.com/tomscaria/swarm-fund-mvp/commit/c48f773), [5a1b3c8](https://github.com/tomscaria/swarm-fund-mvp/commit/5a1b3c8))
- Runner-swarm grew from 20 to 112 paper-trading agents across 30 strategies via Latin-Hypercube sampling (ADR-085). ([2628533](https://github.com/tomscaria/swarm-fund-mvp/commit/2628533), [5f1f2fb](https://github.com/tomscaria/swarm-fund-mvp/commit/5f1f2fb), [85fcea1](https://github.com/tomscaria/swarm-fund-mvp/commit/85fcea1), [1125deb](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb))
- Per-regime variant bandit with cull corroboration and posterior history (ADR-089/090/091). ([648725d](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d))
- Aeon-Narrative ingestion adapter polls JSON outputs from tomscaria/aeon on a 15-minute cadence (ADR-093). ([dc1846e](https://github.com/tomscaria/swarm-fund-mvp/commit/dc1846e))
- Task-aware LLM tier router with paper-triage routed Opus 4.7 → Sonnet 4.6 (ADR-094). ([d010846](https://github.com/tomscaria/swarm-fund-mvp/commit/d010846))
- Public /research surface with 32 SEO research articles in founder voice. ([9d0aab2](https://github.com/tomscaria/swarm-fund-mvp/commit/9d0aab2), [ff091e6](https://github.com/tomscaria/swarm-fund-mvp/commit/ff091e6))
- /investors page got six React+SVG visualizations and a ScrollProgress component. ([c8e0963](https://github.com/tomscaria/swarm-fund-mvp/commit/c8e0963), [fe189cc](https://github.com/tomscaria/swarm-fund-mvp/commit/fe189cc))
- Site metrics now include a papers_ingested count (3,737 papers). ([607183a](https://github.com/tomscaria/swarm-fund-mvp/commit/607183a))

### Changed
- Marketing surface and 32 research articles rewritten in founder voice with a compliance scrub. ([121ba3e](https://github.com/tomscaria/swarm-fund-mvp/commit/121ba3e), [bf21c22](https://github.com/tomscaria/swarm-fund-mvp/commit/bf21c22))

### Fixed
- HL `get_balance()` now returns unified perp+spot equity, root-causing the 2026-04-27 phantom-NAV incident (ADR-083). ([33fd244](https://github.com/tomscaria/swarm-fund-mvp/commit/33fd244))
- Production deploys unblocked: missing site exports committed and Vercel build sandbox now includes `learn-site/` and `kb/`. ([ab3305e](https://github.com/tomscaria/swarm-fund-mvp/commit/ab3305e), [58407ee](https://github.com/tomscaria/swarm-fund-mvp/commit/58407ee), [f2240a7](https://github.com/tomscaria/swarm-fund-mvp/commit/f2240a7))
- Mobile PDF iframe and SVG slot sizing on /investors no longer collapse to 300x150 placeholder dimensions. ([8f688ca](https://github.com/tomscaria/swarm-fund-mvp/commit/8f688ca))

*Internal: ~838 commits hidden (~788 `data: refresh site metrics` cron, plus docs/chore/test/refactor and internal-tooling fixes to ssrn_harvest, regulator_harvest, pm-tail-risk runner, paper_triage, portfolio BL optimizer). Bots filtered: 1 (`claude` weekly KB review).*

---

## tomscaria/lore-financial-teaser

> **Highlights:** Project renamed to Lore Financial Teaser, the marketing copy was rewritten across the site to enforce founder voice rules, and the main bundle dropped 13% by lazy-loading six below-fold sections.

### Changed
- Marketing copy rewritten across HeroSection, FAQSection, DistributionSection, SolutionSection, HowItWorksSection, WhyNowSection, SolanaRoadmapModal, ETFEvolutionSlides, CountryOpportunityModule, PartnerModels, PartnerOverview, CostCurve, UseOfFunds, and Pipeline to enforce voice rules (no em-dashes, ≤15-word sentences, declarative structure). ([#6](https://github.com/tomscaria/lore-financial-teaser/pull/6), [bfaae50](https://github.com/tomscaria/lore-financial-teaser/commit/bfaae50))
- Main bundle dropped 13% (gzip 226kB → 202kB) by code-splitting six heavy below-fold sections behind Suspense. ([9b53f11](https://github.com/tomscaria/lore-financial-teaser/commit/9b53f11))

### Fixed
- Nav-dot buttons in SectionNav now expose `aria-label`s so screen readers can announce destinations; also removed a duplicate Sui logo import in HowItWorksSection. ([c2d6cb0](https://github.com/tomscaria/lore-financial-teaser/commit/c2d6cb0))

*Internal: 14 commits hidden (project rename to lore-financial-teaser, Aeon framework wiring + AEON_DEPLOY_LORE.md, docs/voice-and-tone canonicalization, ESLint cleanup, removal of 6 unused components and unused @tanstack/react-query, brand-voice smoke tests). Bots filtered: 0.*

---

## aaronjmars/aeon

> **Highlights:** Seven new skills shipped — five flesh out the meta-loop around the upcoming Show HN launch (show-hn-draft, star-momentum-alert, operator-scorecard, fork-cohort, skill-freshness), and two general utility skills (thread-formatter, smithery-manifest) closed prior backlog items. Two dashboard endpoints were hardened against shell injection.

### Added
- New `thread-formatter` skill auto-formats the top daily event as a 5-tweet thread. ([#148](https://github.com/aaronjmars/aeon/pull/148))
- New `smithery-manifest` skill auto-generates Smithery and MCP Registry submission artifacts from skills.json. ([#149](https://github.com/aaronjmars/aeon/pull/149))
- New `show-hn-draft` skill pre-writes the Show HN launch post under zero pressure. ([#151](https://github.com/aaronjmars/aeon/pull/151))
- New `fork-cohort` skill buckets every fork of the parent repo into COLD/STALE/ACTIVE/POWER stages weekly. ([#152](https://github.com/aaronjmars/aeon/pull/152))
- New `operator-scorecard` skill ships a Monday three-paragraph synthesis of agent health, community growth, and economic activity. ([#153](https://github.com/aaronjmars/aeon/pull/153))
- New `skill-freshness` skill audits enabled skills' upstream file dependencies for staleness. ([#157](https://github.com/aaronjmars/aeon/pull/157))
- New `star-momentum-alert` skill projects the next milestone-crossing date so `show-hn-draft` can dispatch on time. ([#159](https://github.com/aaronjmars/aeon/pull/159))

### Security
- Dashboard `/api/secrets` set/delete now uses `execFileSync` with an argv array, closing a shell-injection vector on user-controlled secret names. ([#150](https://github.com/aaronjmars/aeon/pull/150))
- Dashboard `/api/skills/run` now uses `execFileSync`, closing the same shell-injection class on user-supplied workflow_dispatch `var`/`model`. ([#158](https://github.com/aaronjmars/aeon/pull/158))

*Internal: 3 commits hidden (skills manifest drift fix #154, orphan-skill category cleanup #155, README agent-status-badge removal). Bots filtered: 0.*

---

*Most user-facing items above (ADR-084/085/089/090/091/093/094, runner-swarm 20→112, /research surface, six aeon skills) landed before the prior 2026-05-05 changelog and are re-cut here because they fall inside this run's seven-day window.*

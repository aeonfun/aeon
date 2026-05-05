# Changelog — Week of 2026-05-05

*Window: 2026-04-28 → 2026-05-05 · Sources: tomscaria/swarm-fund-mvp=ok, tomscaria/lore-financial-teaser=ok, aaronjmars/aeon=ok*

## tomscaria/swarm-fund-mvp

> **Highlights:** The fleet jumped from 74 to 112 agents and 30 to 34 strategies after wrapping five strategies into the runner-swarm. The Aeon-Narrative ingestion adapter shipped, letting strategies consume `tomscaria/aeon` outputs as live signals. The investor-facing site got six new SVG visualizations, a research surface with 32 SEO articles, and a per-strategy scoreboard.

### Added
- Fleet expanded from 74 to 112 agents and 30 to 34 strategies (`runner-swarm` now covers `pm-tail-risk`, `regime-switch`, `pm-yes-vs-no-skew`, plus two more). ([1125deb](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb))
- Aeon-Narrative ingestion adapter went live; strategies poll `tomscaria/aeon` raw skill outputs and consume them as features (ADR-093). ([dc1846e](https://github.com/tomscaria/swarm-fund-mvp/commit/dc1846e))
- LLM tier router with task-aware routing and inline suggestion surface landed (ADR-094). ([d010846](https://github.com/tomscaria/swarm-fund-mvp/commit/d010846))
- Six SVG visualizations were added to the `/investors` page alongside a `ScrollProgress` component. ([c8e0963](https://github.com/tomscaria/swarm-fund-mvp/commit/c8e0963), [fe189cc](https://github.com/tomscaria/swarm-fund-mvp/commit/fe189cc))
- Research surface plus 32 SEO articles shipped on the marketing site. ([9d0aab2](https://github.com/tomscaria/swarm-fund-mvp/commit/9d0aab2))
- Per-strategy detail page, sortable scoreboard, and fleet-health dashboard launched (ADR-084). ([fe904be](https://github.com/tomscaria/swarm-fund-mvp/commit/fe904be), [d5f902e](https://github.com/tomscaria/swarm-fund-mvp/commit/d5f902e))
- Per-strategy backtest sidecars with varrd-style guardrails are now produced automatically. ([e2afbda](https://github.com/tomscaria/swarm-fund-mvp/commit/e2afbda), [c48f773](https://github.com/tomscaria/swarm-fund-mvp/commit/c48f773))
- Bulk-attach CLI and weekly snapshot routine added for ADR-084 ops. ([5a1b3c8](https://github.com/tomscaria/swarm-fund-mvp/commit/5a1b3c8))
- Site metrics now exposes `papers_ingested` count. ([607183a](https://github.com/tomscaria/swarm-fund-mvp/commit/607183a))
- Earlier in the week, runner-swarm v2 expanded to 26 strategies / 65 variants and wrapped `pm-hl-divergence`, `pm-hl-lead-lag`, `pm-macro-spillover`. ([2628533](https://github.com/tomscaria/swarm-fund-mvp/commit/2628533), [5f1f2fb](https://github.com/tomscaria/swarm-fund-mvp/commit/5f1f2fb), [85fcea1](https://github.com/tomscaria/swarm-fund-mvp/commit/85fcea1))

### Changed
- Per-regime variant bandit, cull-corroboration, and posterior-history modules went in (ADR-089/090/091). ([648725d](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d))
- Marketing site and 32 research articles were rewritten in founder voice with a compliance scrub. ([121ba3e](https://github.com/tomscaria/swarm-fund-mvp/commit/121ba3e), [ff091e6](https://github.com/tomscaria/swarm-fund-mvp/commit/ff091e6))
- Brand-voice enforcement and design-system cleanup applied across the site. ([bf21c22](https://github.com/tomscaria/swarm-fund-mvp/commit/bf21c22))
- A repo-level `CHANGELOG.md` was introduced, anchored on the ADR-084 entry. ([55f048b](https://github.com/tomscaria/swarm-fund-mvp/commit/55f048b))

### Fixed
- Hyperliquid `get_balance()` now returns unified perp + spot USDC equity, so reported NAV matches reality (ADR-083). ([33fd244](https://github.com/tomscaria/swarm-fund-mvp/commit/33fd244))
- Vercel build sandbox now includes `learn-site/` and `kb/`, unbreaking production deploys. ([#25](https://github.com/tomscaria/swarm-fund-mvp/pull/25))
- Discover surface ships its missing `api.ts`, `framer-motion`, and `d3-scale` declarations. ([f2240a7](https://github.com/tomscaria/swarm-fund-mvp/commit/f2240a7), [58407ee](https://github.com/tomscaria/swarm-fund-mvp/commit/58407ee))
- Privy loader, `WaitlistCTAAuth`, and API stubs that were missing from the build are restored. ([197f6c3](https://github.com/tomscaria/swarm-fund-mvp/commit/197f6c3))
- SVG slot sizing fixed and a mobile PDF iframe fallback added to the investor page. ([8f688ca](https://github.com/tomscaria/swarm-fund-mvp/commit/8f688ca))
- `Signal.fired_at` now uses tick timestamp instead of `datetime.now`, caught by the ADR-084 gate. ([c76064d](https://github.com/tomscaria/swarm-fund-mvp/commit/c76064d))
- Portfolio Black-Litterman optimizer no longer crashes on `None` weights. ([6663b7c](https://github.com/tomscaria/swarm-fund-mvp/commit/6663b7c))

*Internal: ~65 commits hidden (docs, chore, test, refactor, plus internal `fix(triage)` / `fix(runner)` / `fix(harvest)` / `fix(ssrn_harvest)` PRs #19, #20, #23, #24 and a `test(variant_bandit)` PR #28). 695 cron `data: refresh site metrics` and 1 `claude[bot]` kb-review commit filtered.*

---

## tomscaria/lore-financial-teaser

> **Highlights:** The project was renamed to Lore Financial Teaser, the marketing site picked up Thomas Scaria's brand voice, and a lazy-load pass cut the main bundle by 13%.

### Changed
- Repository and product surface renamed to "Lore Financial Teaser." ([#4](https://github.com/tomscaria/lore-financial-teaser/pull/4))
- Brand-voice rules from `brand-voice-thomas` are now enforced across every marketing section. ([#6](https://github.com/tomscaria/lore-financial-teaser/pull/6))
- Six heavy below-fold sections lazy-load, cutting the main bundle by 13%. ([9b53f11](https://github.com/tomscaria/lore-financial-teaser/commit/9b53f11))
- Aeon was wired into the repo and an internal Lore Inc migration master plan was committed. ([#1](https://github.com/tomscaria/lore-financial-teaser/pull/1))

### Fixed
- Duplicate SVG import in the review surface removed; `SectionNav` buttons now expose `aria-label`. ([c2d6cb0](https://github.com/tomscaria/lore-financial-teaser/commit/c2d6cb0))
- Five ESLint errors across the codebase are gone. ([b1114a9](https://github.com/tomscaria/lore-financial-teaser/commit/b1114a9))
- Phase 2 description on `Index.tsx` no longer ends with a stray arrow glyph. ([c77daac](https://github.com/tomscaria/lore-financial-teaser/commit/c77daac))

*Internal: 8 commits hidden (docs, dead-code removal, dep cleanup, brand-voice copy guideline updates).*

---

## aaronjmars/aeon

> **Highlights:** Five new skills shipped — `pr-triage`, `thread-formatter`, `smithery-manifest`, `show-hn-draft`, `operator-scorecard`, `fork-cohort`, and `skill-freshness` — alongside a security fix that closes a shell-injection hole in dashboard secret management.

### Added
- `skill-freshness` audits enabled skills' upstream file deps and flags staleness. ([#157](https://github.com/aaronjmars/aeon/pull/157))
- `fork-cohort` tracks weekly activation stages across forked Aeon instances. ([#152](https://github.com/aaronjmars/aeon/pull/152))
- `operator-scorecard` summarizes per-operator metrics for the launch funnel. ([#153](https://github.com/aaronjmars/aeon/pull/153))
- `show-hn-draft` pre-writes the Show HN launch post under zero pressure. ([#151](https://github.com/aaronjmars/aeon/pull/151))
- `smithery-manifest` plus initial Smithery / MCP Registry submission docs are in. ([#149](https://github.com/aaronjmars/aeon/pull/149))
- `thread-formatter` auto-formats the top daily event as a 5-tweet thread. ([#148](https://github.com/aaronjmars/aeon/pull/148))
- `pr-triage` provides first-touch triage for external PRs. ([#147](https://github.com/aaronjmars/aeon/pull/147))

### Changed
- The agent status badge was removed from the README. ([c95478c](https://github.com/aaronjmars/aeon/commit/c95478c))

### Fixed
- `skills.json` total bumped and the missing `show-hn-draft` category registered. ([#154](https://github.com/aaronjmars/aeon/pull/154))

### Security
- Dashboard secret set/delete flow switched to `execFileSync`, closing a shell-injection vector on user-supplied secret names. ([#150](https://github.com/aaronjmars/aeon/pull/150))

*Internal: 1 commit hidden (chore: categorize 5 orphan skills, [#155](https://github.com/aaronjmars/aeon/pull/155)).*

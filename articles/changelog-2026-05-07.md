# Changelog — Week of 2026-05-07

*Window: 2026-04-30 → 2026-05-07 · Sources: tomscaria/swarm-fund-mvp=ok, tomscaria/lore-financial-teaser=ok, aaronjmars/aeon=ok*

## tomscaria/swarm-fund-mvp

> **Highlights:** Late-week LLM stack flip: ADR-095 routes summarize/judge/generate/chat to local qwen2.5:14b under `OLLAMA_FULL=1`, and a fine-tuning pipeline shipped (Tasks 9-11) with a 3,462-pair triage dataset exported to MLX JSONL. Earlier in the window, the ADR-084 dashboard, ADR-085 runner-swarm (20→112 agents), ADR-093 Aeon-Narrative adapter, and ADR-094 LLM tier router landed — already covered in last week's changelog and re-cut here because they fall inside the seven-day window.

### Added
- Local-LLM routing under `OLLAMA_FULL=1` sends summarize, judge, generate, and chat traffic to qwen2.5:14b (ADR-095). ([80b1228](https://github.com/tomscaria/swarm-fund-mvp/commit/80b1228))
- Fine-tuning pipeline plus canary router landed (Tasks 9-11). ([eb18354](https://github.com/tomscaria/swarm-fund-mvp/commit/eb18354))
- `export_finetune_dataset.py` exports 3,462 triage pairs into MLX-format JSONL. ([e0ad1b5](https://github.com/tomscaria/swarm-fund-mvp/commit/e0ad1b5))
- Opt-in `LLM_CALL_LOG` captures prompt and completion pairs for later replay. ([caaec5a](https://github.com/tomscaria/swarm-fund-mvp/commit/caaec5a))
- `kb_concepts` embedding index built across 3,446 concepts. ([a23f999](https://github.com/tomscaria/swarm-fund-mvp/commit/a23f999))
- `run_analogy_synthesis.py` Phase G runner script added. ([846cf44](https://github.com/tomscaria/swarm-fund-mvp/commit/846cf44))
- Per-strategy admin dashboard with sortable scoreboard, fleet-health view, and varrd-style backtest guardrails (ADR-084). ([fe904be](https://github.com/tomscaria/swarm-fund-mvp/commit/fe904be), [d5f902e](https://github.com/tomscaria/swarm-fund-mvp/commit/d5f902e), [e2afbda](https://github.com/tomscaria/swarm-fund-mvp/commit/e2afbda), [c48f773](https://github.com/tomscaria/swarm-fund-mvp/commit/c48f773), [5a1b3c8](https://github.com/tomscaria/swarm-fund-mvp/commit/5a1b3c8))
- Runner-swarm grew from 20 to 112 paper-trading agents across 30 strategies via Latin-Hypercube sampling (ADR-085). ([2628533](https://github.com/tomscaria/swarm-fund-mvp/commit/2628533), [5f1f2fb](https://github.com/tomscaria/swarm-fund-mvp/commit/5f1f2fb), [85fcea1](https://github.com/tomscaria/swarm-fund-mvp/commit/85fcea1), [1125deb](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb))
- Per-regime variant bandit with cull corroboration and posterior history (ADR-089/090/091). ([648725d](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d))
- Aeon-Narrative ingestion adapter polls JSON outputs from tomscaria/aeon on a 15-minute cadence (ADR-093). ([dc1846e](https://github.com/tomscaria/swarm-fund-mvp/commit/dc1846e))
- Task-aware LLM tier router with paper-triage routed Opus 4.7 → Sonnet 4.6 (ADR-094). ([d010846](https://github.com/tomscaria/swarm-fund-mvp/commit/d010846))
- Public /research surface with 32 SEO articles in founder voice. ([9d0aab2](https://github.com/tomscaria/swarm-fund-mvp/commit/9d0aab2), [ff091e6](https://github.com/tomscaria/swarm-fund-mvp/commit/ff091e6))
- /investors page got six React+SVG visualizations and a ScrollProgress component. ([c8e0963](https://github.com/tomscaria/swarm-fund-mvp/commit/c8e0963), [fe189cc](https://github.com/tomscaria/swarm-fund-mvp/commit/fe189cc))
- Site metrics now include a `papers_ingested` count. ([607183a](https://github.com/tomscaria/swarm-fund-mvp/commit/607183a))

### Changed
- Founder section now shows skill chips with cross-theme contrast fixes. ([a65e936](https://github.com/tomscaria/swarm-fund-mvp/commit/a65e936))
- Marketing surface and 32 research articles rewritten in founder voice with a compliance scrub. ([121ba3e](https://github.com/tomscaria/swarm-fund-mvp/commit/121ba3e), [bf21c22](https://github.com/tomscaria/swarm-fund-mvp/commit/bf21c22))

### Fixed
- `paper_triage` now routes through `OLLAMA_LOCAL` instead of the hardcoded Sonnet path. ([42a5ba5](https://github.com/tomscaria/swarm-fund-mvp/commit/42a5ba5))
- HL `get_balance()` now returns unified perp+spot equity, root-causing the 2026-04-27 phantom-NAV incident (ADR-083). ([33fd244](https://github.com/tomscaria/swarm-fund-mvp/commit/33fd244))
- Production deploys unblocked: missing site exports committed and Vercel build sandbox now includes `learn-site/` and `kb/`. ([ab3305e](https://github.com/tomscaria/swarm-fund-mvp/commit/ab3305e), [58407ee](https://github.com/tomscaria/swarm-fund-mvp/commit/58407ee), [f2240a7](https://github.com/tomscaria/swarm-fund-mvp/commit/f2240a7))
- Mobile PDF iframe and SVG slot sizing on /investors no longer collapse to 300x150 placeholder dimensions. ([8f688ca](https://github.com/tomscaria/swarm-fund-mvp/commit/8f688ca))
- Triage parser is now defensive against malformed LLM scores and reasoning fields ([#24](https://github.com/tomscaria/swarm-fund-mvp/pull/24)); pm-tail-risk fair-prob horizon uses fractional days ([#23](https://github.com/tomscaria/swarm-fund-mvp/pull/23)); markdown image-strip regex bracket order corrected ([#20](https://github.com/tomscaria/swarm-fund-mvp/pull/20)); ssrn_harvest uses `cursor.rowcount` instead of `connection.total_changes` ([#19](https://github.com/tomscaria/swarm-fund-mvp/pull/19)); portfolio BL optimizer no longer crashes on `None` weights ([6663b7c](https://github.com/tomscaria/swarm-fund-mvp/commit/6663b7c)); 7 pre-existing test failures repaired ([d83a935](https://github.com/tomscaria/swarm-fund-mvp/commit/d83a935)).

*Internal: ~903 commits hidden (~883 `data: refresh site metrics` cron, plus the rest is docs/test/chore on session summaries, strategy inventory, gitignore housekeeping, untracked-source tracking, eval reports, ideation v2 INDEX, infra configs, grants signal triggers, and `/router_suggestions` Telegram command tests). Bots filtered: 1 (`claude` weekly KB review).*

---

## tomscaria/lore-financial-teaser

> **Highlights:** No new shipments since last week's changelog. The window picks up the same brand-voice enforcement, 13% bundle reduction, and accessibility fixes that already shipped on 2026-05-03; nothing has merged on this repo since.

### Changed
- Marketing copy rewritten across HeroSection, FAQSection, DistributionSection, SolutionSection, HowItWorksSection, WhyNowSection, SolanaRoadmapModal, ETFEvolutionSlides, CountryOpportunityModule, PartnerModels, PartnerOverview, CostCurve, UseOfFunds, and Pipeline to enforce voice rules (no em-dashes, ≤15-word sentences, declarative structure). ([#6](https://github.com/tomscaria/lore-financial-teaser/pull/6), [bfaae50](https://github.com/tomscaria/lore-financial-teaser/commit/bfaae50))
- Main bundle dropped 13% (gzip 226kB → 202kB) by code-splitting six heavy below-fold sections behind Suspense. ([9b53f11](https://github.com/tomscaria/lore-financial-teaser/commit/9b53f11))

### Fixed
- Nav-dot buttons in SectionNav now expose `aria-label`s so screen readers can announce destinations; also removed a duplicate Sui logo import in HowItWorksSection. ([c2d6cb0](https://github.com/tomscaria/lore-financial-teaser/commit/c2d6cb0))

*Internal: 14 commits hidden (project rename to Lore Financial Teaser, Aeon framework wiring + AEON_DEPLOY_LORE.md, docs/voice-and-tone canonicalization, ESLint cleanup, removal of 6 unused components and unused @tanstack/react-query, brand-voice smoke tests). Bots filtered: 0.*

---

## aaronjmars/aeon

> **Highlights:** Two new shipments since last week's changelog: a six-starter skill template library with `./new-from-template` scaffolding (#161) and a per-fork v4 upgrade readiness checklist (#160). Both landed on 2026-05-07 and are the first cleanly-mergeable PRs from this repo since the Show HN meta-loop drop on 2026-05-03.

### Added
- Skill template library ships six starters and a `./new-from-template` scaffolding command. ([#161](https://github.com/aaronjmars/aeon/pull/161))
- Per-fork v4 upgrade readiness checklist tracks blockers per downstream fork. ([#160](https://github.com/aaronjmars/aeon/pull/160))
- `star-momentum-alert` projects the next GitHub-stars milestone crossing date so `show-hn-draft` dispatch timing is data-driven. ([#159](https://github.com/aaronjmars/aeon/pull/159))
- `skill-freshness` skill audits enabled skills' upstream file dependencies for staleness. ([#157](https://github.com/aaronjmars/aeon/pull/157))
- `fork-cohort` skill: weekly activation-stage tracker for downstream forks. ([#152](https://github.com/aaronjmars/aeon/pull/152))
- `operator-scorecard` skill ships. ([#153](https://github.com/aaronjmars/aeon/pull/153))
- `show-hn-draft` skill pre-writes the Show HN launch post under zero pressure. ([#151](https://github.com/aaronjmars/aeon/pull/151))
- `smithery-manifest` skill plus initial Smithery / MCP Registry submission docs. ([#149](https://github.com/aaronjmars/aeon/pull/149))

### Security
- `dashboard/skills/[name]/run/route.ts` switched to `execFileSync` to close a shell-injection surface. ([#158](https://github.com/aaronjmars/aeon/pull/158))
- `dashboard/secrets/route.ts` switched to `execFileSync` for `set` and `delete` paths to close a shell-injection surface. ([#150](https://github.com/aaronjmars/aeon/pull/150))

*Internal: 3 commits hidden (skills.json manifest drift fix from #151+#153, orphan-skills category cleanup, README agent-status-badge removal). Bots filtered: 0.*

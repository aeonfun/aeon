# Changelog — Week of 2026-05-08

*Window: 2026-05-01 → 2026-05-08 · Sources: tomscaria/swarm-fund-mvp=ok, tomscaria/lore-financial-teaser=ok, aaronjmars/aeon=ok*

## tomscaria/swarm-fund-mvp

> **Highlights:** ADR-095 ships local-LLM full mode — `OLLAMA_FULL=1` routes summarize / judge / generate / chat to `qwen2.5:14b` and zeroes the non-reasoning LLM bill. Fleet expanded 74 → 112 agents and 30 → 34 strategies; ADR-084 audit-trail dashboard, ADR-089/090/091 per-regime variant bandit, ADR-094 task-aware tier router, and ADR-093 Aeon-Narrative ingestion adapter all landed in the same window.

### Added
- Local-LLM full mode: `OLLAMA_FULL=1` routes summarize, judge, generate, and chat to `qwen2.5:14b` (ADR-095). ([80b1228](https://github.com/tomscaria/swarm-fund-mvp/commit/80b1228a741820083e5e262b78f965f1b6354c83))
- Fine-tuning pipeline with MLX-LoRA + GGUF + canary router gated at ≥80% tier-agreement. ([eb18354](https://github.com/tomscaria/swarm-fund-mvp/commit/eb183544858d6412b1f49fcbe076cdcdf45ec871))
- Triage fine-tune dataset export: 3,462 pairs in MLX JSONL. ([e0ad1b5](https://github.com/tomscaria/swarm-fund-mvp/commit/e0ad1b5f37e7a7ae271b05ed946d378f69b9ee2c))
- Opt-in LLM call log captures prompt and completion for downstream training. ([caaec5a](https://github.com/tomscaria/swarm-fund-mvp/commit/caaec5aab9f004301d371263a7c2d6e9d2100081))
- Task-aware tier router with suggestion surface (ADR-094). ([d010846](https://github.com/tomscaria/swarm-fund-mvp/commit/d010846c700b40c5119ade0c52eff4bcf9bbbac9))
- Aeon-Narrative ingestion adapter pulls `outputs/{skill}/{date}.json` from the Aeon side (ADR-093). ([dc1846e](https://github.com/tomscaria/swarm-fund-mvp/commit/dc1846e4f0e36e3e65612163fd344d1850a5b0f4))
- Fleet expanded: 5 strategies wrapped into runner-swarm — 74 → 112 agents, 30 → 34 strategies via Latin-hypercube. ([1125deb](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb256d0d73cef23b80f27f4828cf0e21c6b))
- Per-regime variant bandit + cull-corroboration + posterior history (ADR-089/090/091). ([648725d](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d22aae476fd8c434772cf01666ef075423))
- Per-strategy dashboard: detail page, sortable scoreboard, fleet-health view, `/api/strategies*` routes (ADR-084). ([fe904be](https://github.com/tomscaria/swarm-fund-mvp/commit/fe904bea7cdc0730735c35ea0ea9fc4492b51bb5), [d5f902e](https://github.com/tomscaria/swarm-fund-mvp/commit/d5f902e5c9fb11c9ee21b76860066a7bdce425c6))
- Per-strategy backtest sidecar with throttled HL backfill and varrd-style guardrails (ADR-084). ([e2afbda](https://github.com/tomscaria/swarm-fund-mvp/commit/e2afbda18baf6cb547e7bec96643770ecbdcabd8), [c48f773](https://github.com/tomscaria/swarm-fund-mvp/commit/c48f7739f4a3c45b7c2e4f8c409f6a48fc306031))
- Bulk-attach CLI + weekly snapshot routine for ADR-084 audit-trail. ([5a1b3c8](https://github.com/tomscaria/swarm-fund-mvp/commit/5a1b3c843579f531d1cc2b5bbac685ffcffe0985))
- Six investor-page SVG visualisations and a ScrollProgress component. ([c8e0963](https://github.com/tomscaria/swarm-fund-mvp/commit/c8e09632bd8168423384c06557dbb0db7da3ebf8), [fe189cc](https://github.com/tomscaria/swarm-fund-mvp/commit/fe189cc136b21135faa9e6e762a4188c7e97aba5))
- Founder-section skill chips with cross-theme contrast. ([a65e936](https://github.com/tomscaria/swarm-fund-mvp/commit/a65e93683db0c49a0b426f278776fd4e1e106dcf))
- Research surface plus 32 SEO articles (recovers stash 552092c). ([9d0aab2](https://github.com/tomscaria/swarm-fund-mvp/commit/9d0aab29fb70d6e850d1bfd5e233242492b18369))
- Initial kb-concepts embedding index — 3,446 concepts. ([a23f999](https://github.com/tomscaria/swarm-fund-mvp/commit/a23f999d79db3774e73aa3957c135c7cbe4b0e8f))
- Phase-G analogy-synthesis runner script. ([846cf44](https://github.com/tomscaria/swarm-fund-mvp/commit/846cf4488677be164aae5efefc4a240f9c10515b))
- `papers_ingested` count exposed in site metrics. ([607183a](https://github.com/tomscaria/swarm-fund-mvp/commit/607183a0e7a84f2af4460a8ed552c73cc17fdd64))
- CHANGELOG.md introduced with ADR-084 entry. ([55f048b](https://github.com/tomscaria/swarm-fund-mvp/commit/55f048bc22d8bf59af3dfe79de6edfc813914cf0))

### Changed
- Marketing surface and 32 research articles rewritten in founder voice with compliance scrub. ([121ba3e](https://github.com/tomscaria/swarm-fund-mvp/commit/121ba3e900820f963a95b90e0a199f15bb6d821e), [ff091e6](https://github.com/tomscaria/swarm-fund-mvp/commit/ff091e660245622f5391c78231b388776f698b66))
- Brand-voice enforcement and design-system cleanup across the site. ([bf21c22](https://github.com/tomscaria/swarm-fund-mvp/commit/bf21c22943764a451776259cca8b8336e6562ecf))
- Paper-triage now routes through `OLLAMA_LOCAL` instead of a hard-coded sonnet endpoint. ([42a5ba5](https://github.com/tomscaria/swarm-fund-mvp/commit/42a5ba510896eb25335976ff68107e7891e4403c))

### Fixed
- Triage parser now tolerates malformed LLM scores and reasoning fields. ([#24](https://github.com/tomscaria/swarm-fund-mvp/pull/24))
- pm-tail-risk fair-prob horizon uses fractional days. ([#23](https://github.com/tomscaria/swarm-fund-mvp/pull/23))
- Markdown image-strip regex bracket order corrected. ([#20](https://github.com/tomscaria/swarm-fund-mvp/pull/20))
- `ssrn_harvest` uses `cursor.rowcount` instead of `connection.total_changes`. ([#19](https://github.com/tomscaria/swarm-fund-mvp/pull/19))
- Portfolio Black-Litterman optimiser handles `None` weights gracefully. ([6663b7c](https://github.com/tomscaria/swarm-fund-mvp/commit/6663b7cfafec3f94b46ce13b81c4b8a6a1d08032))
- `Signal.fired_at` now uses `tick.ts` rather than `datetime.now()` (caught by ADR-084 gate). ([c76064d](https://github.com/tomscaria/swarm-fund-mvp/commit/c76064d611ce309093ba7d5283a5e0383792872b))
- Mobile PDF iframe fallback and SVG slot sizing on the investors page. ([8f688ca](https://github.com/tomscaria/swarm-fund-mvp/commit/8f688ca98ab4dc333bcf6653739e795bd1a5e894))
- Missing Discover-page exports (`SurfaceCell`, `TopEdgeCell`); `framer-motion` and `d3-scale` declared. ([f2240a7](https://github.com/tomscaria/swarm-fund-mvp/commit/f2240a7065271028411ca29a7543cbf47f4f1c54), [58407ee](https://github.com/tomscaria/swarm-fund-mvp/commit/58407ee810186046294ef2c3c503731b20ac0f1a))
- Seven pre-existing test failures repaired. ([d83a935](https://github.com/tomscaria/swarm-fund-mvp/commit/d83a935db789533dd3a2f1f3cd05102411fa720b))

*Internal: ~22 commits hidden (docs, gitignore, source-tracking, test scaffolding). Bots filtered: 669 (667 metrics-refresh cron, 2 weekly kb / grants-tracker).*

---

## tomscaria/lore-financial-teaser

> **Highlights:** Project renamed to "Lore Financial Teaser" with founder-voice enforcement across the marketing site; main bundle cut 13% via lazy-loading.

### Changed
- Project renamed to "Lore Financial Teaser". ([#4](https://github.com/tomscaria/lore-financial-teaser/pull/4))
- Founder-voice rules enforced across all marketing sections. ([#6](https://github.com/tomscaria/lore-financial-teaser/pull/6))
- Six heavy below-fold sections lazy-loaded — main bundle reduced 13%. ([9b53f11](https://github.com/tomscaria/lore-financial-teaser/commit/9b53f11e1784eb38bbbe937563717e07d01417a4))
- Phase 2 description: arrow glyph removed for voice consistency. ([c77daac](https://github.com/tomscaria/lore-financial-teaser/commit/c77daace7de04c16762333f833b568c2eeef5741))

### Fixed
- Duplicate SVG import removed and aria-labels added to SectionNav buttons. ([c2d6cb0](https://github.com/tomscaria/lore-financial-teaser/commit/c2d6cb0e331c62dc38e063c14616d82c59f90dcb))

*Internal: ~13 commits hidden (docs, voice/copy guidelines, dead-code removal, lint cleanup, brand-voice smoke tests, Aeon wire-up). Bots filtered: 0.*

---

## aaronjmars/aeon

> **Highlights:** Eight new skills shipped (huggingface-trending, skill-template library, v4-readiness, star-momentum-alert, skill-freshness, operator-scorecard, fork-cohort, show-hn-draft) and two shell-injection vectors closed in the dashboard via `execFileSync`.

### Added
- huggingface-trending skill — curated trending HF models, datasets, and spaces. ([#162](https://github.com/aaronjmars/aeon/pull/162))
- Skill-template library with six starters and a `./new-from-template` scaffolder. ([#161](https://github.com/aaronjmars/aeon/pull/161))
- v4-readiness skill — per-fork upgrade checklist. ([#160](https://github.com/aaronjmars/aeon/pull/160))
- star-momentum-alert skill projects the next milestone crossing date for show-hn-draft dispatch timing. ([#159](https://github.com/aaronjmars/aeon/pull/159))
- skill-freshness skill audits enabled skills' upstream file deps for staleness. ([#157](https://github.com/aaronjmars/aeon/pull/157))
- operator-scorecard skill. ([#153](https://github.com/aaronjmars/aeon/pull/153))
- fork-cohort skill — weekly activation-stage tracker. ([#152](https://github.com/aaronjmars/aeon/pull/152))
- show-hn-draft skill — pre-write the launch post under zero pressure. ([#151](https://github.com/aaronjmars/aeon/pull/151))

### Fixed
- reply-maker wires the XAI prefetch case and cache-read path (closes a 13-day operator-blocking carrier). ([#156](https://github.com/aaronjmars/aeon/pull/156))

### Security
- `dashboard/skills/run` uses `execFileSync` instead of shell concatenation — closes a shell-injection vector on skill execution. ([#158](https://github.com/aaronjmars/aeon/pull/158))
- `dashboard/secrets` set/delete uses `execFileSync` — closes a shell-injection vector on secret writes. ([#150](https://github.com/aaronjmars/aeon/pull/150))

*Internal: 2 commits hidden (skills.json bump + orphan-skill categorisation). Bots filtered: 0.*

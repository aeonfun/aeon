# Push Recap — 2026-05-03

## Verdict
> SHIPPING — Aeon-tick adapter, lore brand-voice + bundle cut, 3 new aeon skills

**Shape:** 14 user-visible commits · 19 internal · 0 infra · 88 metrics-cron filtered
**Volume:** ~28,500 lines net additions across ~33 substantive commits by 3 authors (`tomscaria`, `@aaronjmars`, `stewart-lore`)
**Merged PRs:** 8 (aeon #150 secrets exec hardening, #151 show-hn-draft, #152 fork-cohort, #153 operator-scorecard, #154 skills.json drift, #155 skills category cleanup; swarm-fund-mvp #27 grants xAI voucher; lore-financial-teaser #6 brand-voice enforcement)

---

## Top impact today

1. `dc1846e` (swarm-fund-mvp) — *feat: Aeon-Narrative ingestion adapter + strategy unstub + brand voice pass*. New `python/execution/aeon_adapter.py` (180 LOC) polls `tomscaria/aeon` raw GitHub API every 15 min and converts narrative signals to `MarketTick` objects with `kind="aeon_signal"`; `aeon_narrative.on_tick()` now emits real `Signal`s through the regime/freshness/score/multi-skill/momentum gate chain (was stubbed). Marketing-site copy reanchored to live `metrics.json`. ADR-093. (53 files, +4,430/−783)
2. `1125deb` (swarm-fund-mvp) — *feat: wrap 5 strategies into runner-swarm (74→112 agents, 30→34 strategies)*. Adds aeon-narrative (30 LH-sampled variants), ta-bb-squeeze, ta-macd-cross, ta-rsi-divergence (2 each), and swarm-fragility (2) to runner-swarm. `variants.yaml` `off` quoted to keep YAML from booleanizing it. Fleet jumps 38 agents in one commit. (12 files, +152/−65)
3. `3a294c6` (swarm-fund-mvp) — *chore: track 87 untracked source files from prior sessions*. 28 test files, 35 KB-source files, auth/billing/email_funnel packages, 6 v1_* API route modules, 3 Alembic migrations, MCP server, CEX base adapter, indicators, db.py. Working tree → public surface. (87 files, +17,874/−0)
4. `4a6b037` (aeon, PR #152) — *feat: fork-cohort skill*. New 290-line skill buckets every fork by activation stage (COLD/STALE/ACTIVE/POWER) using GitHub Actions run history as ground truth and tracks WoW transitions (LEVELED_UP, REVIVED, WENT_STALE, etc.); state in `memory/topics/fork-cohort-state.json`. Closes the gap fork-fleet (code) and fork-contributor-leaderboard (people) cannot answer: *"which forks are running right now?"* (4 files, +306/−3)
5. `d010846` (swarm-fund-mvp) — *llm: stronger task-aware tier router + suggestion surface*. ADR-094. New `python/llm/router.py` (+353) hoists the tier-routing pattern out of `paper_triage` so any caller can pass `task="classify"` instead of hardcoding a model string; explicit-model-over-tier calls log to `data/router_suggestions.jsonl`; opt-in budget-pressure downtier; Opus 4.7 thinking-token envelope; cache default flips to on via `SWARM_LLM_CACHE_DEFAULT`; new `/router_suggestions` Telegram command. `paper_triage` default opus-4-7 → sonnet-4-6 (~$70 per 3500-paper run). 28 new tests. (9 files, +1,215/−39)
6. `f7a048a` (aeon, PR #153) — *feat: operator-scorecard skill*. Weekly Monday 10:30 UTC synthesis: reads last 7d of skill-analytics + heartbeat + tweet-allocator + token-report + repo-pulse articles, emits a three-paragraph scorecard (agent health / community growth / economic activity) with a worst-of-three OK/WATCH/DEGRADED verdict mirroring heartbeat's P-flag vocabulary. Pure local file I/O — zero new APIs / secrets / prefetch. (4 files, +272/−2)
7. `6c07691` (aeon, PR #150) — *fix(dashboard/secrets): use execFileSync to close shell-injection on secret set/delete*. Replaces the old shell template (`gh secret set ${name} -b "${value...}"`) with `execFileSync('gh', ['secret', 'set', name, '-b', value])` on both POST and DELETE handlers. The POST quote-escape was pierceable by `$(...)`, backticks, `;`, `&&`, `|`, `\`; DELETE had zero escape on `name`. Now passes args via argv — no shell. **ISS-016 pre-empt** MEMORY flagged with a 2026-05-07 trigger date — landed 4 days ahead. (1 file, +3/−3)
8. `56b39ea` (aeon, PR #151) — *feat: show-hn-draft skill*. 190-line skill turns README + SHOWCASE + last-7d articles + project-lens + memory/logs autonomous-behavior moments into a paste-ready Show HN post + r/MachineLearning + r/selfhosted variants. Skill never posts (operator gate). At ~250 stars and ~4/day, the 300-star milestone is ~12 days out — text needs to exist before launch, not be typed at the moment. (3 files, +205/−2)
9. `bfaae50` (lore-financial-teaser) — *copy(brand-voice-thomas): enforce voice rules across all marketing sections*. Strips em-dashes (replaced with period/colon/comma per job — AI fingerprint removal), splits 15+ word run-on FAQ answers into declarative units, fixes `CountryOpportunityModule` exhibit labels to use colon, rewrites `whyItMatters` prose, fixes `PartnerModels` / `PartnerOverview` / `CostCurve` / `UseOfFunds` / `Pipeline` copy. `memory/brand_voice.md` em-dash rule corrected to match `VOICE_AND_TONE.md`. (13 files, +31/−32)
10. `9b53f11` (lore-financial-teaser) — *perf(bundle): lazy-load 6 heavy below-fold sections, cut main bundle 13%*. Code-splits `HowItWorksSection` (31 kB), `PartnerModelsSection` (40 kB), `PartnerOverviewSlide`, `UnitEconomicsSection`, `TeamExtendedSlide`, `AppendixSection` behind Suspense. Main bundle 766 kB → 663 kB (gzip 226 → 202 kB). Suspense fallback={null} keeps layout stable. (1 file, +15/−13 in `Index.tsx`; chunk graph reshuffles)

---

## tomscaria/swarm-fund-mvp

### [Theme 1 — Aeon-Narrative becomes a live tick source]

**What this is:** Aeon stops being a research artifact published *next to* the trading system and becomes a live ingestion node *inside* it. The morning push lands the adapter, the strategy that consumes it, the YAML wiring that puts 30 variants into the runner-swarm, and the brand voice pass on the marketing site reflecting the new fleet count.

**Shipped to users**
- `dc1846e` — *feat: Aeon-Narrative ingestion adapter + strategy unstub + brand voice pass* (ADR-093)
  - `python/execution/aeon_adapter.py` (NEW, +180): polls `https://raw.githubusercontent.com/tomscaria/aeon/main/outputs/{skill}/{date}.json` every 15 min for `monitor-polymarket`, `polymarket-comments`, `narrative-tracker`; converts each row to a `MarketTick` with `kind="aeon_signal"`; entry-level dedup on (skill, date, signal_id).
  - `python/strategies/aeon_narrative/aeon_narrative.py`: `on_tick()` no longer returns `None` — full `Signal` flows through regime gate → freshness gate → score gate → multi-skill confirmation → momentum filter → confidence floor. `get_metrics()` Pydantic-field crash fixed.
  - Marketing-site copy: hero numbers and anchors swap to live `metrics.json` (144 agents / 47 strategies / 941 closed trades). Banned-word adjacencies removed; AI fingerprints stripped.
  - 19 new aeon-side tests pass.
- `1125deb` — *feat: wrap 5 strategies into runner-swarm (74→112 agents)*
  - `runner_swarm/variants.yaml`: 30 LH-sampled aeon-narrative variants (dispatch=tick, venue=PM); 2 each for `ta-bb-squeeze`, `ta-macd-cross`, `ta-rsi-divergence` (tick/HL); 2 `swarm-fragility` (Pillar 2). `off` quoted to dodge YAML 1.1 boolean parse.
  - 30 of 38 net-new agents are aeon-narrative LH variants — 79% of new fleet capacity routes through the just-shipped adapter.
- `607183a` — *feat: add papers_ingested count to site metrics*
  - `scripts/update_metrics.py`: reads `data/papers.db` (3,737 papers) and writes `papers_ingested` to `metrics.json`; the live page now surfaces the corpus count alongside agent state.

**Under the hood**
- `d010846` — *llm: stronger task-aware tier router + suggestion surface* (ADR-094): new `python/llm/router.py` lets call sites pass `task="classify"` instead of a model string; over-tiered calls append to `router_suggestions.jsonl` (never silent override); opt-in `downtier_under_pressure` drops one tier at >85% of monthly cap; Opus 4.7 thinking-token envelope (`max_thinking_tokens` clamped at `MAX_THINKING_TOKENS` env, default 8000); Anthropic prompt-cache default flips on via `SWARM_LLM_CACHE_DEFAULT`. Migration: `paper_triage` default opus-4-7 → sonnet-4-6 (~$70 saved per 3500-paper run; opus escalation still happens via `TIER_MODELS["opus"]` for ~5% of papers). 28 new tests; full suite 1,272 passed / 3 skipped. New `/router_suggestions` Telegram command surfaces top mis-tiered call sites — the only user-visible piece.
- `d83a935` — *fix: repair 7 pre-existing test failures*: `_tick` helper auto-derives `MarketTick.kind` from `metadata["kind"]`, fixing Hermes cascade/funding/oracle tests; cascade momentum-aligned test updated to expect `Signal` (strategy was unstubbed in prior session); `test_hl_candle_backfill` mock gets `status_code=200`; `test_mtm` uses non-constant deltas so `stdev > 0`; `test_smoke` creates `reports/`; `core/types.py` adds `avantis_quote` and `social_signal` to `TickKind`.
- `6663b7c` — *fix: portfolio BL optimizer handles None weights gracefully*: `skfolio MeanRisk.fit` with `raise_on_failure=False` sets `weights_=None` on optimization failure; code crashed on `np.asarray(None)[i]`. Now passes `X` as `DataFrame` (skfolio requirement) and falls back to `risk_budget_allocate` when `weights_` is `None`.
- `2bf9667` — *chore: add missing `__init__.py` to 10 strategy packages*: required for runner-swarm dynamic imports via dotted module paths.

### [Internal: tree maintenance — 87 files enter the repo]

**What this is:** A bulk-tracking session moves files that were *living in the working tree but not in git* into the public surface for the first time. No code changes; the diff is purely tree-state reconciliation.

- `3a294c6` — *chore: track 87 untracked source files from prior sessions* (+17,874/−0): 28 test files (all passing), 35 KB sources, `auth/`, `billing/`, `email_funnel/` packages, 6 `v1_*` API route modules (`v1_billing`, `v1_discover`, `v1_email`, `v1_investor`, `v1_signals`, `v1_xray`), 3 Alembic migrations (002–004: users, email_subscribers, investor_interest), MCP server, CEX base adapter, indicators, db.py.
- `f20ca70` — *chore: track TA strategy sources, tests, and missing frontmatter*: `strategies/ta_bb_squeeze/`, `ta_macd_cross/`, `ta_rsi_divergence/` programs + eval logs + 20 tests; ADR-086 frontmatter for `bankr-avantis-macro`, `bankr-social-momentum`.
- `7a4fb70` — *docs: track research outputs, ideation v2 INDEX, and grant applications*: 16 ideation docs (2026-04-27v2 batch), 3 edge matrices, 6 session summaries, grant/pitch drafts (Anchorage DVP, AWS Activate Portfolio, Cloudflare), concept review queues P1/P2/P3, Surface A runbook.
- `9040fd1` — *docs: track eval reports, firecrawl research, fleet snapshots*: 102 research output files now version-controlled — `outputs/research/eval/`, `outputs/research/firecrawl/` (Adept, Bankr, Chainlink, Cognition, Composer), `outputs/research/fleet_snapshots/`.
- `2ab2782` — *chore: track infra configs + grants signal triggers + gitignore cleanup*: EC2 `bootstrap.sh` + 7 systemd units, Cloudflared `api.rswarm.ai` tunnel, 2 launchd plists, `grants_signal_triggers.yml` (194 lines).
- `f75b235` / `3de228d` — gitignore additions for runner_signals, history producers, cache dirs, OCR scratch, `outputs/*.log`.

### [Internal: ops + grants]

- `998c5ab` — Merge PR #27 *grants: track xAI free credits voucher* — adds an `xAI Free Credits Voucher` row to `outputs/grants_tracker.md` (status QUEUED). Logs the unredeemed voucher next to Anthropic / AWS so the thomas-os Grants dashboard surfaces it.
- `9ca3ce1` / `14007a7` / `3c9bc0b` — overnight session summary docs (42 commits across the 5h session).
- `eaa1299` — `CHANGELOG` update for test fixes + housekeeping.

---

## tomscaria/lore-financial-teaser

### [Theme 1 — Site-wide brand voice + AI-fingerprint scrub]

**What this is:** Marketing site copy passes a hard voice gate. Em-dashes are categorically banned (read as AI-generated); banned verb "leverage" stripped; run-on sentences split into declarative units; redundant "Arb arbitrage" cleaned; informal contractions removed. The full enforcement crosses two PRs (one merged, one direct push) and touches every visible section.

**Shipped to users**
- `bfaae50` — *copy(brand-voice-thomas): enforce voice rules across all marketing sections* (13 files, +31/−32)
  - `HeroSection`, `FAQSection`, `ETFEvolutionSlides`, `CountryOpportunityModule`, `PartnerModelsSection`, `PartnerOverviewSlide`, `CoreChainsSection`, `CostCurveSection`, `SolanaRoadmapModal`, `UnitEconomicsSection`, `UseOfFundsSection`, `WhyNowCountriesSlide`, `Pipeline.tsx` — em-dashes replaced with `.` / `:` / `,` per job; `whyItMatters` prose declaratively rewritten; exhibit labels normalized to colon-form.
  - `memory/brand_voice.md`: em-dash rule corrected to match `VOICE_AND_TONE.md` (single source of truth).
- `035df48` (PR #6 merge) — *copy(brand-voice): enforce Thomas Scaria voice across marketing sections* (7 files, +13/−13): `HeroSection`, `FAQSection`, `DistributionSection`, `SolutionSection`, `HowItWorksSection`, `WhyNowSection`, `SolanaRoadmapModal`. Banned verb "leverage" gone; "Arb arbitrage" deduped.
- `c77daac` — *copy: remove arrow glyph from Phase 2 description in `Index.tsx`*. "Prove product → compliance playbook" rewritten declaratively.
- `c2d6cb0` — *fix(review): remove duplicate SVG import, add aria-label to `SectionNav` buttons*. `HowItWorksSection` had two identical `@/assets/logos/sui.svg` imports (`SuiLogo` line 416 ≡ `SuiLogoToken` line 15); collapsed. `SectionNav` nav-dot buttons now carry `aria-label="Navigate to {label}"` since labels were `opacity-0` until hover and screen readers had no context. Net a11y win.

**Under the hood**
- `8fcb43b` — *docs: voice/copy guidelines em-dash ban*: `VOICE_AND_TONE.md` documents replacement-by-job (period / colon / parens) + AI fingerprint anti-patterns; fixes stray em-dashes inside the doc itself. `COPY_GUIDELINES.md` annotation/partner/CTA rules de-dashed.
- `c77fb55` — *docs: COPY_GUIDELINES voice rules + VOICE_AND_TONE marked canonical*: sentence ≤15 words, no em-dashes, headline formula, banned words, AI-fingerprint anti-patterns. `VOICE_AND_TONE.md` declared canonical with 2026-05-03 enforcement date — takes precedence over memory/external docs on conflicts.
- `031ce8e` — *test: 4 brand-voice smoke tests* (banned-word list integrity, LTP definition structure, `$40M` numeric format) — regression anchors so future copy changes don't silently re-introduce the banned forms.
- `3772010` — *docs(readme): npm → bun, add Vitest, site structure table, brand link to `AEON_DEPLOY_LORE.md`*.
- `07dee08` — *docs(aeon): add `AEON_DEPLOY_LORE.md`*: `.claude/aeon-skills` symlink resolves; remaining gate is GitHub Secrets on `tomscaria/aeon` before triggering heartbeat.

### [Theme 2 — Bundle weight + dead code purge]

**What this is:** Two passes over the site for performance. First lazy-load below-fold sections; then delete components that the import graph proves nobody touches.

**Shipped to users**
- `9b53f11` — *perf(bundle): lazy-load 6 heavy below-fold sections, cut main bundle 13%* (1 file edit in `Index.tsx`, chunk graph reshuffles): `HowItWorksSection` (31 kB), `PartnerModelsSection` (40 kB), `PartnerOverviewSlide`, `UnitEconomicsSection`, `TeamExtendedSlide`, `AppendixSection` now load on demand behind Suspense (`fallback={null}`). Main bundle 766 kB → 663 kB; gzip 226 kB → 202 kB. First-paint payload drops without a layout shift.

**Under the hood**
- `92c7b06` — *chore: remove 6 dead component files*: `SectionNav`, `TopProgressNav`, `SlideDeckNav`, `PitchTopbarProgress`, `NavLink`, `ValuePropPills` — exported but never imported anywhere in `src/`. Verified by full-tree import-statement grep.
- `10f3895` — *chore: remove `@tanstack/react-query`*: `QueryClientProvider` wrapped the entire app but no `useQuery` / `useMutation` hooks existed anywhere in `src/`. Wrapper deleted, package uninstalled — bundle and dependency surface both shrink.
- `b1114a9` — *fix(lint): resolve all 5 ESLint errors*: `tailwind.config.ts` `require()` → ES import; `TransitionSection` runtime `require()` → `lazy()` + Suspense (also splits `FloatingLogoConstellation` into a 29 kB chunk — free perf win); `CostCurveSection` `CustomTooltip` props now typed (was `any`); `HowItWorksSection` `useEffect` keyboard handler uses functional setters (eliminates missing-deps warning without stale-closure risk); `ui/command.tsx` + `ui/textarea.tsx` empty-interface-extends → type alias.

---

## aaronjmars/aeon

### [Theme 1 — Three new operator-facing skills]

**What this is:** Three skills land back-to-back-to-back in a 16-minute window (13:19–13:35 UTC), each closing a previously-carried repo-actions idea. None auto-fires today (`enabled: false`); all need an operator nudge.

**Shipped to users**
- `4a6b037` (PR #152) — *feat: fork-cohort skill*: 290-line skill buckets every fork by activation stage — COLD (no runs / >365d), STALE (last run >7d), ACTIVE (<7d), POWER (<7d AND ≥5 enabled skills) — using GitHub Actions run history as ground truth. WoW transition tracking surfaces LEVELED_UP, REVIVED, WENT_STALE, WENT_COLD, NEW_ACTIVE, DROPPED_FROM_POWER, NEW_FORK; verdict priority surfaces the most operator-actionable transition first. State persisted to `memory/topics/fork-cohort-state.json`. Notify gated on real change. Read-only across the fleet (no comments / no issues on third-party forks). Sunday 19:00 UTC sonnet schedule. Closes Apr-30 idea #3 / Apr-28 idea #5 (carried 2 cycles).
- `f7a048a` (PR #153) — *feat: operator-scorecard skill*: weekly Monday 10:30 UTC synthesis. Reads last 7d of `skill-analytics`, `heartbeat`, `tweet-allocator`, `token-report`, `repo-pulse` articles; emits a three-paragraph scorecard (agent health / community growth / economic activity) with a worst-of-three OK / WATCH / DEGRADED verdict mirroring heartbeat's P-flag vocabulary. Pure local file I/O. Closes Apr-30 idea #5 / May-2 idea #1 (carried 2 cycles).
- `56b39ea` (PR #151) — *feat: show-hn-draft skill*: 190-line skill turns README + SHOWCASE + last-7d `repo-article` outputs + `project-lens` entries + `memory/logs/` autonomous-behavior moments into a paste-ready Show HN post + r/MachineLearning + r/selfhosted variants. Lead-beat scoring; per-variant rules; hard no-marketing constraints. Skill never posts — operator-gated launch checklist appended to every draft. `workflow_dispatch` only. Closes Apr-30 idea #1 / Apr-28 idea #3.

### [Theme 2 — Security hardening + manifest housekeeping]

**Shipped to users**
- `6c07691` (PR #150) — *fix(dashboard/secrets): use `execFileSync` to close shell-injection on secret set/delete*. The two write-side dashboard handlers now spawn `gh` directly without invoking a shell:
  - `dashboard/app/api/secrets/route.ts:96` (POST): old shell template (`gh secret set ${name} -b "${value...}"`) → `execFileSync('gh', ['secret', 'set', name, '-b', value], opts)`.
  - `dashboard/app/api/secrets/route.ts:119` (DELETE): old shell template (`gh secret delete ${name}`) → `execFileSync('gh', ['secret', 'delete', name], opts)`.
  - Old POST escape (`value.replace(/"/g, '\\"')`) was pierceable by `$(...)`, backticks, `;`, `&&`, `|`, `\`. Old DELETE had zero escape on `name`. Now both pass via argv — `name` and `value` cannot inject regardless of contents. `VALID_SECRET_NAME` regex retained as second line of defense.
  - **ISS-016 pre-empt** MEMORY flagged with a 2026-05-07 trigger date — landed 4 days ahead. Carry-debt cleared.

**Under the hood**
- `f5ac6a5` (PR #154) — *fix: skills.json manifest drift from #151 + #153*: `show-hn-draft` was emitted with `category: "other"` because `generate-skills-json` had no entry for it; total stayed at 97 vs. actual 108 on disk (`operator-scorecard` not regenerated). Maps `show-hn-draft` → `social` (closest existing bucket — aeon has no growth/marketing category) and regenerates `skills.json` so total + per-skill metadata match disk.
- `e1c46a5` (PR #155) — *chore: categorize 5 orphan skills*: `syndicate-article` → social, `schedule-ads` → social, `create-campaign` → social, `contributor-reward` → crypto, `smithery-manifest` → dev. Closes the "fall through to other" bug class for skills whose category was never explicitly mapped.

---

## Developer notes

- **New dependencies:** none added. Two removals on lore-financial-teaser: `@tanstack/react-query` (unused), `tailwindcss-animate` `require()` switched to ES import.
- **Breaking changes:**
  - swarm-fund-mvp: `paper_triage` `DEFAULT_TRIAGE_MODEL` opus-4-7 → sonnet-4-6. Per-paper opus escalation still happens via `TIER_MODELS["opus"]`; output quality on the meta-classify step should be revalidated.
  - swarm-fund-mvp: `SWARM_LLM_CACHE_DEFAULT` env now defaults to **on**. Set to `"false"` to preserve legacy behaviour. Anthropic prompt-cache hits should rise across the fleet.
  - swarm-fund-mvp: `MAX_THINKING_TOKENS` env clamps Opus 4.7 thinking-token envelope (default 8000). Callers passing higher values get clamped silently.
  - lore-financial-teaser: `VOICE_AND_TONE.md` declared canonical — overrides `memory/brand_voice.md` and external voice docs on em-dash and adjacent voice-rule conflicts.
- **New public surface:**
  - swarm-fund-mvp: `python/execution/aeon_adapter.py` is a new outbound dependency on `tomscaria/aeon` raw GitHub API. New Telegram command `/router_suggestions`. New site-metric key `papers_ingested`.
  - aeon: 3 new skills (`fork-cohort`, `operator-scorecard`, `show-hn-draft`) — all `workflow_dispatch` only at landing time. `skills.json` total bumped through #154 / #155.
- **Tech debt added:**
  - swarm-fund-mvp: ADR-093 ships an outbound dependency on Aeon raw-API content that does not yet exist (`tomscaria/aeon` has no `outputs/` directory) — every poll currently 404s. The MEMORY-tracked falsifier is unchanged: if the JSON contract isn't shipped within ~2 weeks the wire-up is aspirational.
  - lore-financial-teaser: `VOICE_AND_TONE.md` is now the canonical source — any future memory-side or shared-voice doc edits must defer or get explicitly merged.

## Open threads
- swarm-fund-mvp: 5 PRs ACT-NOW on Vercel (#19/#20/#23/#24/#28) all FAILURE — `aeonframework` bot's commit email not verified with Vercel. Single operator-side fix unblocks all five. Carried in MEMORY OPS ALERTS.
- aeon: 5 stalled PRs on `tomscaria/aeon` (oldest #1 ~9 days). Issues disabled (no urgent label scan). PR #156 (reply-maker XAI prefetch, ISS-014 closer) day-9 carry.
- lore-financial-teaser: AEON_DEPLOY_LORE.md notes remaining step "add GitHub Secrets to `tomscaria/aeon` before triggering heartbeat" — operator-side gate.
- swarm-fund-mvp: ADR-093 falsifier window — 2-week clock on `tomscaria/aeon` shipping `outputs/{skill}/{date}.json` JSON contract, ~2026-05-17 deadline.

## Sources
- tomscaria/swarm-fund-mvp: ok (75 metrics-cron commits filtered)
- tomscaria/lore-financial-teaser: ok
- aaronjmars/aeon: ok
- gh api events: fail (events endpoint returned `cannot iterate over: null` for swarm-fund-mvp — fell back to commits + PR list, which were sufficient)
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 88 (75 swarm-fund-mvp `data: refresh site metrics` + 13 cron-driven `docs: refresh outputs from metrics cron` / `docs: refresh strategy inventory timestamps` / `docs: refresh research hub and factor library timestamps`)
- diff-truncated: 0

# Push Recap — 2026-05-03

## Verdict
> SHIPPING — Aeon-Narrative ingestion adapter, 3 new skills, ISS-016 shell-injection patched

**Shape:** 11 user-visible commits · 14 internal · 1 infra · 75 metrics-cron filtered
**Volume:** ~24,000 lines net additions across ~30 substantive commits by 2 authors (tomscaria, @aaronjmars)
**Merged PRs:** 7 (#150 secrets exec hardening; #151 show-hn-draft; #152 fork-cohort; #153 operator-scorecard; #154 skills manifest drift; #155 skills category cleanup; swarm-fund-mvp #27 grants xAI voucher)

---

## Top impact today

1. `dc1846e` — *feat: Aeon-Narrative ingestion adapter + strategy unstub + brand voice pass* (swarm-fund-mvp). New `python/execution/aeon_adapter.py` (180 LOC) polls `tomscaria/aeon` raw GitHub API every 15 min and converts narrative signals to `MarketTick` objects with `kind="aeon_signal"`; `aeon_narrative.on_tick()` now emits real `Signal`s through the regime/freshness/score/multi-skill/momentum gate chain (was stubbed). 53 files, 4,430/-783 lines. ADR-093.
2. `1125deb` — *feat: wrap 5 strategies into runner-swarm (74→112 agents, 30→34 strategies)* (swarm-fund-mvp). Adds aeon-narrative (30 LH-sampled variants), ta-bb-squeeze, ta-macd-cross, ta-rsi-divergence (2 each), and swarm-fragility (2) to runner-swarm; `variants.yaml` `off` quoted to keep YAML from booleanizing it. Fleet jumps 38 agents. 12 files, +152/-65.
3. `4a6b037` (PR #152) — *feat: fork-cohort skill* (aaronjmars/aeon). New 290-line skill buckets every fork by activation stage (COLD/STALE/ACTIVE/POWER) using GitHub Actions run history as ground truth and tracks WoW transitions (LEVELED_UP, REVIVED, WENT_STALE, etc.); state in `memory/topics/fork-cohort-state.json`. Closes the visibility gap fork-fleet (code) and fork-contributor-leaderboard (people) cannot answer: "which forks are running right now?" 4 files, +306/-3.
4. `f7a048a` (PR #153) — *feat: operator-scorecard skill* (aaronjmars/aeon). Weekly Monday 10:30 UTC synthesis: reads last 7d of skill-analytics + heartbeat + tweet-allocator + token-report + repo-pulse articles, emits a three-paragraph scorecard (agent health / community growth / economic activity) with a worst-of-three OK/WATCH/DEGRADED verdict mirroring heartbeat's P-flag vocabulary. Pure local file I/O — zero new APIs / secrets / prefetch. 4 files, +272/-2.
5. `6c07691` (PR #150) — *fix(dashboard/secrets): use execFileSync to close shell-injection on secret set/delete* (aaronjmars/aeon). Replaces `execSync(\`gh secret set ${name} -b "${value.replace...}"\`)` with `execFileSync('gh', ['secret', 'set', name, '-b', value])` on both POST and DELETE handlers. The POST quote-escape was pierceable by `$(...)`, backticks, `;`, `&&`, `|`, `\`; DELETE had zero escape on `name`. Now passes args via argv — no shell. 1 file, +3/-3. **This is the ISS-016 pre-empt** MEMORY flagged with a 2026-05-07 trigger date — landed 4 days ahead.
6. `3a294c6` — *chore: track 87 untracked source files from prior sessions* (swarm-fund-mvp). 28 test files, 35 KB sources, auth/billing/email_funnel packages, 6 v1_* API route modules, 3 Alembic migrations, MCP server, CEX base adapter, indicators, db.py. 87 files, +17,874/-0. Message says "no code changes" but: these files were *living in the working tree but not in git* — today they enter the repo's public surface for the first time.
7. `56b39ea` (PR #151) — *feat: show-hn-draft skill* (aaronjmars/aeon). 190-line skill turns README + SHOWCASE + last-7d articles + project-lens entries + memory/logs autonomous-behavior moments into a paste-ready Show HN post + r/MachineLearning + r/selfhosted variants. Skill never posts (operator gate). At 250 stars and ~4/day, the 300-star milestone is ~12 days out — text needs to exist before launch, not be typed at the moment. 3 files, +205/-2.

---

## tomscaria/swarm-fund-mvp

### [Theme 1 — Aeon-Narrative becomes a tick source]

**What this is:** Aeon stops being a research artifact published *next to* the trading system and becomes a live ingestion node *inside* it. Today's commits land the adapter, the strategy that consumes it, the YAML wiring that puts 30 variants into the runner-swarm, and the brand voice pass on the marketing site reflecting the new fleet count.

**Shipped to users**
- `dc1846e` — feat: Aeon-Narrative ingestion adapter + strategy unstub + brand voice pass
  - `python/execution/aeon_adapter.py` (NEW): polling adapter, GitHub raw API on 15-min cadence, entry-level dedup, emits `MarketTick(kind="aeon_signal")` (+180/−0)
  - `tests/test_aeon_adapter.py` (NEW): 19 tests covering polling cadence, dedup, MarketTick conversion (+203/−0)
  - `strategies/aeon_narrative/aeon_narrative.py`: `on_tick()` now emits Signals through the full gate chain — regime → freshness → score → multi-skill confirmation → momentum → confidence floor. Fixed `get_metrics()` Pydantic field name crash. (+33/−9)
  - `core/types.py`: `aeon_signal` and `social_signal` added to `TickKind` literal (+1/−0)
  - `swarm-lab-site/src/content/copy.tsx`: marketing copy now reads "144 agents / 47 strategies / 941 closed trades" (live `metrics.json`-anchored) (+53/−52)
  - `swarm-lab-site/src/components/Hero.tsx`: RichText render fix (+2/−1)
  - `python/llm/client.py`: multi-provider client adds OpenRouter / Ollama paths (+186/−7)
  - `python/llm/pricing.py` (NEW): pricing matrix per provider (+62/−0)
  - `dashboard/app/(shell)/markets/page.tsx`: market detail UI (+46/−4)
  - `dashboard/app/(shell)/markets/regime/page.tsx`: regime timeline UI (+58/−19)
  - `dashboard/app/components/charts/PriceChart.tsx` (NEW): chart component (+33/−0)
- `1125deb` — feat: wrap 5 strategies into runner-swarm (74→112 agents, 30→34 strategies)
  - `python/agents/runner_swarm.py`: aeon-narrative (30 LH-sampled variants, dispatch=tick, venue=PM), ta-bb-squeeze, ta-macd-cross, ta-rsi-divergence, swarm-fragility — each with venue/dispatch wiring (+47/−0)
  - `strategies/aeon_narrative/variants.yaml`: YAML `off` boolean trap fixed by quoting to `"off"` (+2/−2)
  - `strategies/aeon_narrative/program.md`, `swarm_fragility/program.md`, `ta_bb_squeeze/program.md`, `ta_macd_cross/program.md`, `ta_rsi_divergence/program.md`: ADR-086 frontmatter added (+7/−0 each)
  - `outputs/research/STRATEGY_INVENTORY.md`: regenerated, zero drift (+38/−47)

**Under the hood**
- `2bf9667` — chore: add missing `__init__.py` to 10 strategy packages (required for runner-swarm dotted-module dynamic imports)
- `f20ca70` — chore: track TA strategy sources, tests, and missing frontmatter (3 strategies × `<name>.py` + `eval_log.jsonl` + 20 tests)
- `d83a935` — fix: repair 7 pre-existing test failures (test_strategies `_tick` helper auto-derives `MarketTick.kind` from `metadata["kind"]`; cascade momentum-aligned test now expects `Signal`; test_hl_candle_backfill `_FakeResp` adds `status_code=200`; test_mtm uses non-constant deltas; test_smoke creates `reports/`)
- `6663b7c` — fix: portfolio BL optimizer handles None weights gracefully (skfolio `MeanRisk.fit` with `raise_on_failure=False` sets `weights_=None` on optimization failure; code now passes X as DataFrame and falls back to `risk_budget_allocate`)

### [Theme 2 — Public metrics surface and tracked-source push]

**What this is:** Two complementary moves: expose a new public metric (papers ingested) on the live `metrics.json` consumed by the marketing site, and bring 87 source files that were living in the working tree into the repo's public surface for the first time.

**Shipped to users**
- `607183a` — feat: add `papers_ingested` count to site metrics
  - `scripts/generate_site_metrics.py`: reads `data/papers.db` (3,737 papers) (+16/−0)
  - `swarm-lab-site/public/metrics.json`: `papers_ingested: 3737` now visible to the marketing site (+9/−8)
- `3a294c6` — chore: track 87 untracked source files from prior sessions
  - `python/auth/`, `python/billing/`, `python/email_funnel/` (full packages enter the repo)
  - `python/api/v1_billing.py`, `v1_discover.py`, `v1_email.py`, `v1_investor.py`, `v1_signals.py`, `v1_xray.py` (6 new API route modules — these are live HTTP surface)
  - `alembic/versions/002_users.py`, `003_email_subscribers.py`, `004_investor_interest.py` (3 schema migrations)
  - `python/cex/base_adapter.py`, `python/mcp/server.py`, `python/indicators/__init__.py`, `python/db.py`
  - 28 test files, 35 KB source files, 9 scripts (`grants_signal_watch.py`, `panic_close.py`, `kb_harvest.py` ...)

### Internal: documentation refresh and infra tracking

- `9ca3ce1`, `14007a7`, `3c9bc0b` — overnight session summaries (5h session, 42 commits, test repair narrative)
- `9040fd1`, `7a4fb70` — track 102 research outputs (eval reports, firecrawl deep dives on Adept/Bankr/Chainlink/Cognition/Composer, fleet snapshots, ideation v2 INDEX, grant/pitch drafts: Anchorage DVP / AWS Activate Portfolio / Cloudflare)
- `2ab2782` (infra) — track EC2 `bootstrap.sh` and 7 systemd units (trading loop, metrics, watchdog, hermes recorder, laptop verify), Cloudflared config for `api.rswarm.ai` tunnel, 2 launchd plists (calibration-snapshot, signals-harvest), `grants_signal_triggers.yml` (194 lines)
- `a411c12`, `fe8f11c`, `0b10d0f`, `2ae547a`, `eaa1299` — strategy inventory / research hub / factor library / CHANGELOG timestamp regen
- `f75b235`, `3de228d` — `.gitignore` runtime state (`runner_signals/`, history producers, `outputs/*.log`, OCR scratch, `.strategy_inventory_state.json`, `.variant_bandit_state.json`, `.last_report_date`)
- `998c5ab` (PR #27) — grants tracker: xAI free credits voucher row added

### Metrics-cron noise (filtered from ranking)
75 `data: refresh site metrics` commits (every ~15 min, `swarm-lab-site/public/metrics.json` only). Functionally equivalent to a bot — surfaced separately in the shape line.

---

## aaronjmars/aeon

### [Theme 1 — Three new skills land in one window (~13:20–13:35 UTC)]

**What this is:** Three operator-facing skills ship inside a 15-minute window: a Show HN draft pre-writer, a fork activation-cohort tracker, and a weekly operator scorecard. All three resolve carried ideation entries (multi-cycle backlog items finally landing).

**Shipped to users**
- `56b39ea` (PR #151) — feat: show-hn-draft skill
  - `skills/show-hn-draft/SKILL.md` (NEW, 190 lines): lead-beat scoring, per-variant rules (Show HN / r/MachineLearning / r/selfhosted), hard no-marketing constraints, single-variant regeneration via `var`. Closes Apr-30 repo-actions idea #1 / Apr-28 idea #3. (+190/−0)
  - `aeon.yml`: workflow_dispatch entry (+1/−0)
  - `skills.json`: total 95 → 96 (+14/−2)
- `4a6b037` (PR #152) — feat: fork-cohort skill — weekly activation-stage tracker
  - `skills/fork-cohort/SKILL.md` (NEW, 290 lines): COLD (>365d / no runs), STALE (>7d), ACTIVE (<7d), POWER (<7d AND ≥5 enabled skills); WoW transitions (LEVELED_UP, REVIVED, WENT_STALE, WENT_COLD, NEW_ACTIVE, DROPPED_FROM_POWER, NEW_FORK); state at `memory/topics/fork-cohort-state.json`; notify gated on real change; read-only across the fleet (no third-party fork comments). Sunday 19:00 UTC sonnet schedule, `enabled: false` at ship. Closes Apr-30 idea #3 / Apr-28 idea #5. (+290/−0)
  - `aeon.yml`: weekly section entry (+1/−0)
  - `generate-skills-json`: dev category mapping (+1/−1)
  - `skills.json`: 95 → 96 (+14/−2)
- `f7a048a` (PR #153) — feat: operator-scorecard skill
  - `skills/operator-scorecard/SKILL.md` (NEW, 257 lines): Monday 10:30 UTC weekly synthesis; reads 7d of skill-analytics + heartbeat + tweet-allocator + token-report + repo-pulse; three-paragraph scorecard (agent health / community growth / economic activity) with worst-of-three OK/WATCH/DEGRADED verdict; pure local file I/O. Closes Apr-30 idea #5 / May-2 idea #1. (+257/−0)
  - `aeon.yml`: weekly section entry (+1/−0)
  - `generate-skills-json`: +1 mapping (+1/−1)
  - `skills.json`: +1 entry (+13/−1)

### [Theme 2 — ISS-016 pre-empt and skills.json drift cleanup]

**What this is:** PR #150 closes the shell-injection at `dashboard/app/api/secrets/route.ts:96` that MEMORY.md flagged with a 2026-05-07 trigger date — landed 4 days ahead. PR #154 and PR #155 reconcile `skills.json` drift introduced when #151/#153 landed without manifest regen, and category-map five orphan skills.

**Shipped to users**
- `6c07691` (PR #150) — fix(dashboard/secrets): use execFileSync to close shell-injection on secret set/delete
  - `dashboard/app/api/secrets/route.ts`: replaces `execSync(\`gh secret set ${name} -b "${value.replace(/"/g, '\\\\"')}"\`)` with `execFileSync('gh', ['secret', 'set', name, '-b', value], opts)` on the POST handler, and `execSync(\`gh secret delete ${name}\`)` with `execFileSync('gh', ['secret', 'delete', name], opts)` on DELETE. The original POST escape was a quote-replace on `value` only — `$(...)`, backticks, `;`, `&&`, `|`, `\` all pierced it. The DELETE handler had no escape on `name` whatsoever (the `VALID_SECRET_NAME` regex was defense-in-depth, never the shell barrier). `argv` path eliminates shell entirely. (+3/−3)

**Under the hood**
- `f5ac6a5` (PR #154) — fix: bump skills.json total + register show-hn-draft category. PR #151 added show-hn-draft but didn't update `generate-skills-json`'s category map (emitted as "other"); PR #153 added operator-scorecard but didn't regen `skills.json` (total stuck at 97 vs. 108 actual). This PR maps show-hn-draft → social and regenerates. +355/−234 across `generate-skills-json` and `skills.json`.
- `e1c46a5` (PR #155) — chore: categorize 5 orphan skills. syndicate-article → social, schedule-ads → social, create-campaign → social, contributor-reward → crypto, smithery-manifest → dev. +10/−8.

---

## Developer notes
- **New dependencies:** swarm-fund-mvp adds `skfolio` to `pyproject.toml` (+5 lines); `uv.lock` regen (+998/−3). `dc1846e` LLM-client refactor likely pulls in OpenRouter/Ollama provider deps (visible in `python/llm/pricing.py` matrix).
- **Breaking changes:** `core/types.TickKind` adds `aeon_signal`, `social_signal`, `avantis_quote` (additive, not breaking). `MarketTick`-consuming strategies must accept the new kinds; existing handlers default-skip unknowns.
- **New public surface:**
  - swarm-fund-mvp: `MarketTick(kind="aeon_signal")` is a new tick type ingested into the strategy fleet. New API routes `python/api/v1_billing.py`, `v1_discover.py`, `v1_email.py`, `v1_investor.py`, `v1_signals.py`, `v1_xray.py` enter the public surface for the first time. 3 Alembic migrations (002 users, 003 email_subscribers, 004 investor_interest) — schema fields visible going forward. `metrics.json` gains `papers_ingested: 3737`.
  - aaronjmars/aeon: 3 new skills callable via workflow_dispatch (show-hn-draft, fork-cohort, operator-scorecard). New state file `memory/topics/fork-cohort-state.json` written by fork-cohort.
- **Tech debt added:** none observable in the patches read. `dc1846e` and `1125deb` clean up prior debt (stub strategy bodies, YAML boolean traps, missing `__init__.py`).

## Open threads
- 87 source files from prior sessions just entered the repo for the first time (`3a294c6`). Auth, billing, email-funnel, 6 API routes, 3 migrations — none of this had been seen by CI before. **Watch:** the next CI run is the first to ever execute against this surface; expect a wave of newly-visible failures or coverage gaps. Test count went up by 28 in the same commit.
- ADR-086 follow-on landed today (5 strategies wrapped into runner-swarm, fleet 74 → 112). MEMORY.md tracks "2 of 9 unwrapped strategies queued as ADR-085 follow-ons land before 2026-05-09" as the falsifier for the swarm-fund-mvp "stopped adding strategies, building the selector" thesis. Today's wrap clears the bar — 5 wraps in one commit, 4 days ahead. Falsifier conditions on whether **new** strategies land before 05-09; that did not happen today (existing strategies were wrapped, no net-new strategy added beyond what `aeon_narrative` brings).
- ISS-016 pre-empted: 2026-05-07 trigger date no longer applies. MEMORY.md "Next Priorities" line "Land code-health fix at `dashboard/app/api/secrets/route.ts:96` — today's external-feature is the carrier" can close.
- fork-cohort skill ships `enabled: false` — does not run on its Sunday 19:00 UTC schedule until operator flips the flag. Same for show-hn-draft (workflow_dispatch only).
- Vercel-FAILURE on PRs #19/#20/#23/#24 (carried alert from MEMORY.md) — none of today's merges fix the `aeonframework` bot's commit-email verification; remains operator-side blocker.

## Sources
- tomscaria/swarm-fund-mvp: ok
- tomscaria/lore-financial-teaser: empty (zero commits, zero merged PRs in window)
- aaronjmars/aeon: ok
- gh api events: ok (filtered out: 75 `data: refresh site metrics` cron commits — author tomscaria, message robotic, only file changed is `swarm-lab-site/public/metrics.json`; treated as bot-equivalent for ranking)
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 75
- diff-truncated: 0

# Push Recap — 2026-05-04

## Verdict
> SHIPPING — ADR-094 LLM router, skill-freshness watchdog, and 5 stalled fix PRs all land

**Shape:** 12 user-visible · 9 internal · 0 infra · 99 bot-filtered (data-refresh churn)
**Volume:** ~30 files changed, +2,168 / -167 lines across 21 real commits by 3 authors
**Merged PRs:** 7 — `tomscaria/swarm-fund-mvp` #19/#20/#23/#24/#28 (the five Vercel-blocked fix PRs flagged on 05-03), `tomscaria/lore-financial-teaser` #6 (brand-voice enforcement), `aaronjmars/aeon` #157 (skill-freshness)

---

## Top impact today

1. `d010846` — **swarm-fund-mvp / `llm: stronger task-aware tier router + suggestion surface (ADR-094)`**. New module `python/llm/router.py` (+353) defines a `TaskKind` literal (classify/extract/summarize/chat/judge/reason/generate) and a `TierName` ladder (local→flash→haiku→deepseek→sonnet→opus); `complete()` now accepts `task=` instead of `model=` and picks the cheapest tier known to handle that task. Explicit-model callers that look over-tiered get a row appended to `data/router_suggestions.jsonl` — never a silent override. `paper_triage.DEFAULT_TRIAGE_MODEL` migrates `claude-opus-4-7` → `claude-sonnet-4-6` on the back of this (~$70 saved on a 3,500-paper triage run). New `/router_suggestions` Telegram command surfaces the log. 9 files, +1,215 / -39.
2. `32c77d7` — **aaronjmars/aeon / `feat(skill-freshness): audit enabled skills' upstream file deps for staleness (#157)`**. New skill at `skills/skill-freshness/SKILL.md` (+286). Walks every `enabled: true` skill in `aeon.yml`, parses both explicit `chains: consume:` edges and grep-discovered `articles/` / `.outputs/` / `memory/topics/` references inside SKILL.md files, scores each dependency against per-class freshness thresholds (4h for `.outputs/`, 28h for daily-producer articles, 8d for weekly, 7d for topic files, 30d for state JSON), rolls up to a fleet verdict, and notifies only on verdict change (sha1 fingerprint over flagged rows, 7-day re-emit). Closes the gap that `heartbeat`/`skill-analytics`/`skill-health` cannot — silent staleness when a producer skill quietly stopped writing but pass rate stays at 100%. 3 files, +300 / -1.
3. `bf21c22` — **swarm-fund-mvp / `design: brand voice enforcement + design system cleanup`**. `swarm-lab-site/src/index.css` removed entirely (-69), `src/content/copy.tsx` rewritten in place (+21 / -21), `styles/components.css` and `styles/globals.css` adjusted. The marketing-site copy now matches the operator-voice rules already enforced on `lore-financial-teaser` (same day, see #4). 4 files, +30 / -97.
4. `9b53f11` — **lore-financial-teaser / `perf(bundle): lazy-load 6 heavy below-fold sections, cut main bundle 13%`**. The headline number is the one that ships to users — page-1 weight drops 13% by deferring six below-fold sections behind dynamic imports.
5. `f2e1e28` — **swarm-fund-mvp / `fix(triage): defensive parsing of LLM scores + reasoning (#24)`**. `python/research/papers/paper_triage.py` +42/-15 plus a +142-line test file. Triage no longer blows up on malformed LLM responses; this is the merge of one of yesterday's five Vercel-blocked FAILURE PRs.

---

## tomscaria/swarm-fund-mvp

### Theme 1 — ADR-094: task-aware LLM router

**What this is:** A reusable primitive that lets every call site say "I want to classify this paper" instead of "I want `claude-opus-4-7`." The router maps task→tier→cloud-model (with an `OLLAMA_LOCAL=1` swap for the high-volume tiers), and adds an opt-in `downtier_under_pressure=True` mode so cost-sensitive callers (autoresearch nightly, kb-extractor sweeps) downgrade one tier under budget pressure rather than throwing `BudgetExceeded`. Triggered by Opus 4.7's tokenizer producing up to 35% more tokens than Opus 4.6 — every Opus call quietly costs more even though the rate card looks identical. This is the cost-discipline lever that `CLAUDE.md` flagged as the right next move at the $40/week threshold.

**Shipped to users**
- `d010846` — `llm: stronger task-aware tier router + suggestion surface (ADR-094)`
  - `python/llm/router.py` (NEW): `TaskKind` literal, `TierName` ladder, `TASK_TIER_DEFAULT` map, `TIER_MODEL_CLOUD` + `TIER_MODEL_OLLAMA`, `route_for_task` / `downtier` / `tier_for_model` / `estimate_savings_per_call_usd` / `maybe_log_suggestion` / `top_suggestions`. `SWARM_LLM_DEFAULT_TIER_FLOOR=cheap|aggressive` env clamps non-reasoning tasks at haiku/flash respectively; reasoning tasks ignore the floor. (+353 / -0)
  - `python/llm/client.py`: `complete()` gains `task=`, `max_thinking_tokens=`, `downtier_under_pressure=` kwargs; `cache: bool | None = None` flips default to env-controlled (`SWARM_LLM_CACHE_DEFAULT`, default `"true"`, Anthropic-only). `_call_anthropic()` accepts `max_thinking_tokens` and emits `thinking={"type":"enabled","budget_tokens":N}` for `claude-opus-4-7` prefixes. (+161 / -24)
  - `python/llm/__init__.py`: re-exports the router primitives. (+24 / -1)
  - `python/research/papers/paper_triage.py:59` — `DEFAULT_TRIAGE_MODEL` migrates `claude-opus-4-7` → `claude-sonnet-4-6`. Same-rubric structured classification on abstract-only context; sonnet has matched opus on agreement rate at ~5× the cost. (+6 / -1)
  - `python/alerting/telegram.py`: `render_router_suggestions()` + `cmd_router_suggestions()` + handler registration; `/router_suggestions [hours]` returns top 5 over-tiered call sites by total estimated savings. (+75 / -1)
  - `DECISIONS.md`: ADR-094 entry — context (Opus 4.7 35% token bloat + 25-month-flat Sonnet 4.6 + viable Haiku 4.5 floor), decision (six layered changes, no provider plumbing changed), rationale, consequences, evidence pointers. (+28 / -0)
  - `TASKS.md`: follow-on items (daily-brief integration of the suggestion log; migration of explicit-model call sites at human pace). (+23 / -1)

**Under the hood**
- `python/tests/test_router.py` (NEW, +209) — covers per-task tier defaults, `OLLAMA_LOCAL` swap, default-tier-floor cheap/aggressive, downtier ladder, `tier_for_model` round-trip + alias coverage + openrouter-prefix strip, savings estimate, suggestion-log writes/skips/aggregation.
- `python/tests/test_llm_client.py` (+336 / -11) — task-only routing, suggestion log on overspec, pressure-downtier opt-in/off, thinking-token pass + clamp + skip-non-thinking, env cache default + non-Anthropic skip, requires-model-or-task.

### Theme 2 — Stale-PR unblock: 5 fix PRs all merge in one batch

**What this is:** PRs #19/#20/#23/#24/#28 had been blocked on Vercel preview-deploy checks because the `aeonframework` bot's commit-email was unverified with Vercel — flagged as the 🔴 ACT NOW item on yesterday's `github-monitor`. All five merged at 21:57 UTC within four seconds of each other, which is the signature of one operator config fix unblocking all of them at once. Two of the five (`#23` and `#24`) ship real bugfixes to the trading runner / triage pipeline; the other three (`#19`, `#20`, `#28`) are smaller correctness fixes.

**Shipped to users**
- `f2e1e28` — `fix(triage): defensive parsing of LLM scores + reasoning (#24)`
  - `python/research/papers/paper_triage.py`: triage no longer KeyErrors on malformed score/reasoning fields in the LLM response. (+42 / -15)
  - `python/tests/test_paper_triage.py` (NEW, +142): regression cases for the malformed-response shapes that bit prod.
- `aaf745b` — `fix(runner): use fractional days for pm-tail-risk fair-prob horizon (#23)`
  - `python/research/runners/pm_strategy_runner.py`: tail-risk strategy was rounding the horizon to an integer day, which collapses a 0.5-day window to 0 (or 1) and corrupts the fair-prob estimate. Now uses fractional days. (+4 / -1)
  - `python/tests/test_pm_strategy_runner.py` (NEW, +74): regression for fractional-day horizons.
- `0d0ba40` — `fix(harvest): correct markdown image-strip regex bracket order (#20)`
  - `python/research/papers/regulator_harvest.py` and `vc_blog_harvest.py` each had one byte wrong in the image-strip regex (bracket order). Two-character fix, two files. (+2 / -2)
- `36a998c` — `fix(ssrn_harvest): use cursor.rowcount, not connection.total_changes (#19)`
  - `python/research/papers/ssrn_harvest.py`: SQLite row-count was being read off the connection (which counts across all cursors / lifetime) instead of the cursor (which counts the last execute). Two-line fix. (+2 / -2)

**Under the hood**
- `0c9d847` — `test(variant_bandit): cover canonical_regime_label() normalization (#28)`. `python/tests/test_variant_bandit.py` +76 — coverage for the regime-label normalization helper that landed in last week's bandit-selector work; no production-code change.

### Theme 3 — swarm-lab-site brand voice cleanup

**What this is:** Marketing-site copy and design system aligned with the operator-voice rules already enforced on `lore-financial-teaser`. The `index.css` deletion is the load-bearing line — a 69-line stylesheet was redundant with `globals.css` + `components.css` and got removed wholesale.

**Shipped to users**
- `bf21c22` — `design: brand voice enforcement + design system cleanup`
  - `swarm-lab-site/src/index.css` (DELETED, -69)
  - `swarm-lab-site/src/content/copy.tsx` (+21 / -21): copy rewrites in place
  - `swarm-lab-site/src/styles/components.css` (+7 / -7), `globals.css` (+2 / -0)

### Internal: data-refresh churn

99 commits authored by `tomscaria` with the message `data: refresh site metrics`, each touching only `swarm-lab-site/public/metrics.json`. Cron-driven 15-minute refresh of the live-metrics file that backs `rswarm.ai/metrics.json` (the operator-trusted source for CalibrationGap stats). Filtered as automation noise — they're the heartbeat of the live-metrics endpoint, not human work, and surfacing them swamps everything else.

---

## tomscaria/lore-financial-teaser

### Theme 4 — Brand-voice enforcement + perf shave

**What this is:** Same operator-voice push that hit `swarm-fund-mvp` today, applied across the lore-financial-teaser marketing site. `stewart-lore` (the deploy/build agent) staged the changes; `tomscaria` merged PR #6. The perf-bundle commit is the one users actually feel — main bundle drops 13% via lazy-loading six below-fold sections.

**Shipped to users**
- `9b53f11` — `perf(bundle): lazy-load 6 heavy below-fold sections, cut main bundle 13%`. Six dynamic imports for sections users only see if they scroll; main-bundle weight down 13%.
- `bfaae50` — `copy(brand-voice-thomas): enforce voice rules across all marketing sections`. Voice-rule pass across every marketing section.
- `035df48` — `copy(brand-voice): enforce Thomas Scaria voice rules across marketing sections (#6)` (merge commit for `bfaae50`).
- `c77daac` — `copy: remove arrow glyph from Phase 2 description in Index.tsx`. Single glyph removed (the operator-voice anti-glyph rule).
- `c2d6cb0` — `fix(review): remove duplicate SVG import, add aria-label to SectionNav buttons`. Accessibility fix on the section-nav buttons; one duplicate SVG import removed.

**Under the hood**
- `031ce8e` — `test: replace placeholder with meaningful brand-voice smoke tests`
- `b1114a9` — `fix(lint): resolve all 5 ESLint errors across codebase`
- `10f3895` — `chore: remove @tanstack/react-query (unused)`. Dependency removal; ships through to bundle weight as a side effect of #4's perf push.
- `92c7b06` — `chore: remove 6 dead component files (never imported)`

**Internal docs**
- `3772010` — `docs(readme): update stack, commands, site structure, brand links`
- `c77fb55` — `docs: update COPY_GUIDELINES with voice rules, mark VOICE_AND_TONE as canonical`
- `8fcb43b` — `docs: update voice/copy guidelines to match enforced brand-voice-thomas rules`
- `07dee08` — `docs(aeon): add AEON_DEPLOY_LORE.md and update CLAUDE.md with install status`

---

## aaronjmars/aeon

### Theme 5 — `skill-freshness` lands

**What this is:** A new health skill that closes the silent-staleness gap in Aeon's reliability stack. `heartbeat` (per-run pulse), `skill-analytics` (per-skill ranking), and `skill-health` (per-skill failure detection) all watch run history; none of them notices when a producer skill quietly stops writing and a downstream consumer keeps reading the cached file. `skill-freshness` watches the file mtimes themselves and rolls up to a single fleet verdict (`OK` / `WARN` / `STALE` / `MISSING`), with sha1 fingerprint dedup so the operator doesn't get pinged about the same stale file every day.

**Shipped to users**
- `32c77d7` — `feat(skill-freshness): audit enabled skills' upstream file deps for staleness (#157)`
  - `skills/skill-freshness/SKILL.md` (NEW, +286): freshness thresholds per path class, severity bands (OK/WARN/STALE/MISSING), explicit + implicit dependency discovery (chains-consume edges + grep over enabled SKILL.md files for `articles/` / `.outputs/` / `memory/topics/` / `memory/state/` references), per-consumer rollup, sha1 verdict fingerprint with 7-day re-emit on no-change.
  - `aeon.yml` (+1 / -0): enable entry.
  - `skills.json` (+13 / -1): catalog entry for MCP / Smithery exposure.

---

## Developer notes

- **New dependencies:** none. ADR-094 reuses the existing 7-provider adapter; no provider plumbing changed.
- **Removed dependencies:** `@tanstack/react-query` removed from `lore-financial-teaser` (`10f3895`).
- **Breaking changes:** none with default-on impact. `python/llm/client.py:complete()` `cache: bool | None` default flipped from `False` to `None` (env-controlled, default `"true"` for Anthropic). Existing callers passing `cache=False` explicitly keep the old behavior; tests that relied on the implicit `False` default were updated to either pass `cache=False` or set `SWARM_LLM_CACHE_DEFAULT=false`.
- **New public surface:**
  - `python/llm.route_for_task`, `tier_for_model`, `downtier`, `TASK_TIER_DEFAULT`, `TIER_MODEL_CLOUD`, `TIER_MODEL_OLLAMA`, `TaskKind`, `TierName`, `load_suggestions`, `top_suggestions` (re-exports added in `python/llm/__init__.py`).
  - `complete(task="...", max_thinking_tokens=N, downtier_under_pressure=True|False)` kwargs on the LLM client.
  - Telegram `/router_suggestions [hours]` operator command.
  - `data/router_suggestions.jsonl` (new append-only log, schema: `{ts, agent_id, task, requested_model, suggested_model, est_savings_per_call_usd}`).
  - `data/process_audit.jsonl` gains `process="llm:pressure_downtier"` rows when an opted-in caller is downtiered.
  - New env vars: `OLLAMA_LOCAL`, `SWARM_LLM_DEFAULT_TIER_FLOOR` (`cheap`|`aggressive`), `SWARM_LLM_CACHE_DEFAULT`, `MAX_THINKING_TOKENS`.
  - New skill: `skill-freshness` on `aaronjmars/aeon` (registered in `aeon.yml` and `skills.json`).
- **Tech debt added:** Telegram daily-brief integration of the router-suggestion log is deferred — the command works but no daily push yet. Tracked in `TASKS.md`.

## Open threads

- **Migration of explicit-model call sites to `task=` is not done.** ADR-094's design choice was deliberately "suggest, don't override" — the suggestion log accumulates over 1–2 weeks and call sites migrate at human pace. Watch `data/router_suggestions.jsonl` and `/router_suggestions` to know when it's worth chasing.
- **`deep_dive.py:55`** still pins `claude-opus-4-7` directly. The ADR explicitly leaves that one in place (full-text reasoning, opus earns its keep), but the suggestion log will tell us if that's still true.
- **Aeon `outputs/` directory still missing** — counter-evidence to the swarm-fund-mvp ADR-093 wire-up from yesterday is unchanged today; today's aeon push is the skill-freshness watchdog, not the outputs contract. 2-week falsifier clock continues to tick toward 2026-05-17.

## Sources
- tomscaria/swarm-fund-mvp: ok (100 commits / 5 merged PRs)
- tomscaria/lore-financial-teaser: ok (13 commits / 1 merged PR)
- aaronjmars/aeon: ok (1 commit / 1 merged PR)
- gh api events: not used (commits + PR list sufficient)
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 99 (data-refresh metrics autocommits on swarm-fund-mvp; author=tomscaria, message="data: refresh site metrics", file=swarm-lab-site/public/metrics.json — 15-minute cron-driven; treated as automation noise per skill-spec spirit even though they don't match the literal *-bot pattern)
- diff-truncated: 0

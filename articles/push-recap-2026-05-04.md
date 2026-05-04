# Push Recap — 2026-05-04

## Verdict
> HARDENING — five-PR robustness wave clears the swarm-fund-mvp research backlog; aeon adds a skill-freshness watchdog (disabled)

**Shape:** 6 user-visible · 3 internal · 0 infra · 93 bot-filtered (cron `data: refresh site metrics`)
**Volume:** ~16 files changed, +1,149 / -213 lines across 9 substantive commits by 4 authors (`tomscaria`, `Claude`, `stewart-lore`, `@aaronjmars`)
**Merged PRs:** 6 — `tomscaria/swarm-fund-mvp` #19/#20/#23/#24/#28 (the five Vercel-FAILURE PRs that operator unblocked at 21:57 UTC on 05-03), `aaronjmars/aeon` #157 (skill-freshness)

---

## Top impact today

1. `32c77d7` — **aaronjmars/aeon / `feat(skill-freshness): audit enabled skills' upstream file deps for staleness (#157)`**. New `skills/skill-freshness/SKILL.md` (+286). Walks every `enabled: true` skill in `aeon.yml`, parses both explicit `chains: consume:` edges and grep-discovered `articles/` / `.outputs/` / `memory/topics/` / `memory/state/` references inside SKILL.md files, scores each dependency against per-class freshness thresholds (4h `.outputs/` · 28h daily-cadence articles · 192h weekly · 7d topics · 30d state), rolls up worst-of-deps to a consumer verdict and worst-of-consumers to a fleet verdict, and notifies only on fingerprint change with a 7-day re-emit window. Closes the gap that `heartbeat`/`skill-analytics`/`skill-health` cannot — silent staleness when a producer skill quietly stopped writing but pass rate stays at 100%. Ships `enabled: false` in `aeon.yml`. (3 files, +300 / -1)
2. `f2e1e28` — **swarm-fund-mvp / `fix(triage): defensive parsing of LLM scores + reasoning (#24)`**. `paper_triage.triage_paper()` was building `TriageDecision` inline with `float()` on `parsed.get("relevance_score", 0.0)` — `.get()` only defaults on missing keys, not on `None` or non-numeric strings. Opus 4.7 occasionally returned `"relevance_score": null` on sparse abstracts, raising `TypeError` past `run()`'s narrow `except (MissingApiKey, BudgetExceeded)` clause and killing the entire batch. Fix extracts `_decision_from_parsed()` plus a `_safe_float()` helper that catches `None` / `ValueError` / `TypeError`, and coerces non-string `reasoning` (lists/dicts) instead of relying on implicit `str()`. Same bug class as the earlier deepseek-tier `KeyError` (commits `d85bccb`/`3f9a1af`). New `python/tests/test_paper_triage.py` covers numeric pass-through, string coercion, `None` fallback, unparseable strings, missing keys, invalid-tier-defaulting-to-flash, tier whitespace/case, and non-string reasoning — no LLM call needed. (2 files, +184 / -15)
3. `4f82c36` — **swarm-fund-mvp / `kb: weekly quality review 2026-05-04`** *(internal)*. New `outputs/kb_quality_reviews/2026-05-04.md` (+319) plus `_coverage.json` (+30). Reviewed all 28 hand-stubs (`generated: false`). One BLOCKER (fair-value uses `N(d1)` instead of `N(d2)`), one HIGH (kl-divergence worked example off by ~2×), 5 MEDIUM, 7 LOW, 14 CLEAN. Drives next week's kb-extractor patch list; not a code change. (2 files, +349 / -0)
4. `bf21c22` — **swarm-fund-mvp / `design: brand voice enforcement + design system cleanup`**. `swarm-lab-site/src/content/copy.tsx` rewritten to convert all mid-paragraph `**bold**` → `*italic*` (the operator-voice rule from `soul/STYLE.md`: mid-paragraph bolds are AI fingerprint pattern, italics only). `src/styles/globals.css` defines the `--bg-alt` token that components were inlining as a fallback; `src/styles/components.css` lifts the pillars/harvest lede color from `--text-dim` to `--text` and bumps `section-label` to 11px on `--brand-dim`. `src/index.css` deleted entirely — vestigial, never imported, shadowed `globals.css` token names with conflicting values. (4 files, +30 / -97)
5. `aaf745b` — **swarm-fund-mvp / `fix(runner): use fractional days for pm-tail-risk fair-prob horizon (#23)`**. `_build_tail_risk_candidate` was passing `(m.end_date - now).days` into `_lognormal_yes_prob` — but `timedelta.days` truncates toward zero. A market resolving in 3d 23h was treated as 3.0 days; one in 12h as 0 (then clamped to the 0.1-day floor). The strategy itself (`pm_tail_risk.py:113`) already used `total_seconds() / 86400.0`; only the runner integer-truncated. Effect: `fair_yes_probability` under-estimated by up to ~24% of T near the 3-day floor — fairly-priced markets just past 3d looked mispriced; mispriced markets looked fair. Either polarity could flip the gap-direction filter in `PMTailRiskStrategy.on_candidate`. **This is the bug that most directly fed false signals into CalibrationGap-adjacent strategy paths.** (2 files, +78 / -1)
6. `0c9d847` — **swarm-fund-mvp / `test(variant_bandit): cover canonical_regime_label() normalization (#28)`** *(internal)*. `canonical_regime_label()` is the single normalization seam between the HMM publisher (lowercase 3- or 5-state output) and the variant bandit's per-regime sub-posteriors, called twice per `python/main.py` iteration. A miss silently routes regime-tagged evidence to the wrong sub-posterior key (or drops the regime tag entirely), corrupting `kelly_multiplier(regime=...)` for that variant for as long as the bug runs — but had no direct test coverage. New cases cover all five canonical labels round-trip, lowercase normalization, present-participle forms, hyphen forms, legacy 3-state HMM `high_vol`/`high-vol`/`highvol` → CRISIS mapping, mixed-case + whitespace, `None` / empty / unknown → `None` (silent-drop contract), and an end-to-end check that the normalized output is the exact key `update_from_trade(regime=...)` writes into `regime_posteriors`. (1 file, +76 / -0)

---

## tomscaria/swarm-fund-mvp

### Theme 1 — research-pipeline robustness (5-PR backlog clears at 21:57 UTC on 05-03)

**What this is:** Five fix/test PRs queued behind the Vercel-FAILURE block on the `aeonframework` bot's commit-email verification — flagged in MEMORY as the "5 ACT NOW" priority on 05-03 — all merge in a 12-second window once the operator unblocked the bot. None ship a feature; collectively they patch four production bugs and one test-coverage hole, all of them silent-failure-class. The pm-tail-risk fractional-day fix (#23) is the only one with direct P&L consequences.

**Shipped to users**

- `aaf745b` — `fix(runner): use fractional days for pm-tail-risk fair-prob horizon (#23)`
  - `python/research/runners/pm_strategy_runner.py`: `(m.end_date - now).days` → `(m.end_date - now).total_seconds() / 86400.0`. Same expression `pm_tail_risk.py:113` and the complete-set runner already use. (+4 / -1)
  - `python/tests/test_pm_strategy_runner.py` (NEW): fractional-day repro (3d vs 3d 23h must yield distinct `fair_yes`), short-horizon clamp, log-normal `fair_prob` is monotone-increasing in horizon, input validation rejects spot=0 / target=0 / vol=0 / unknown direction. (+74 / -0)
- `f2e1e28` — `fix(triage): defensive parsing of LLM scores + reasoning (#24)`
  - `python/research/papers/paper_triage.py`: `_decision_from_parsed()` extracted; `_safe_float()` handles `None` / `ValueError` / `TypeError`; non-string `reasoning` coerced explicitly. (+42 / -15)
  - `python/tests/test_paper_triage.py` (NEW): full parsing-path coverage, no LLM call. (+142 / -0)
- `0d0ba40` — `fix(harvest): correct markdown image-strip regex bracket order (#20)`
  - `python/research/papers/regulator_harvest.py` and `vc_blog_harvest.py`: body-cleaning regex was `\[\!alt](url)` (bracket before bang — not Markdown). Swap to `!\[` so block images at line start are stripped before the body excerpt is sliced for LLM extraction. Reduces noise tokens going into `tiered_extractor`; improves stored `abstract` quality in `papers.db`. Scope unchanged — leading-line images only, inline images mid-paragraph remain. (+1 / -1 in each file)
- `36a998c` — `fix(ssrn_harvest): use cursor.rowcount, not connection.total_changes (#19)`
  - `python/research/papers/ssrn_harvest.py`: `_upsert_paper` returned `con.total_changes > 0` — the cumulative count since the connection was opened, not the rows changed by the most recent execute. Once any paper had been inserted in a run, every subsequent `INSERT OR IGNORE` returned True regardless of whether the row was actually new. The `new` counter inflated, every-50-inserts commits fired too often, and `harvest_runs` recorded inflated `papers_new` totals. Sibling harvesters `arxiv_harvest.py:148` and `ssrn_search_harvest.py:109` already use `cur = con.execute(...); return cur.rowcount > 0` — this brings ssrn_harvest into line. Bug introduced in `2625a07` (2026-04-26). (+2 / -2)

**Under the hood**

- `0c9d847` — `test(variant_bandit): cover canonical_regime_label() normalization (#28)`: 76-line test file plugging the only untested normalization seam between the HMM publisher and the variant bandit's per-regime sub-posteriors. No production code change.

### Theme 2 — swarm-lab-site brand-voice + design-system cleanup

**What this is:** A polish pass on the live marketing site. The copy edits enforce the operator-voice rule from `soul/STYLE.md` (mid-paragraph bolds are an AI fingerprint pattern, use italics for emphasis only). The CSS edits remove a dead file (`index.css`) that was never imported but shadowed `globals.css` token names with conflicting values, and promote `--bg-alt` from inline-fallback-only to a real system token. Reader-facing change is restyled emphasis + slightly higher-contrast pillars/harvest lede; structural cleanup pays down the design-token-shadowing tech debt.

**Shipped to users**

- `bf21c22` — `design: brand voice enforcement + design system cleanup`
  - `swarm-lab-site/src/content/copy.tsx`: every mid-paragraph `**X**` → `*X*`. (+21 / -21)
  - `swarm-lab-site/src/styles/globals.css`: `--bg-alt` defined as a system token (was used as inline fallback in components). (+2 / -0)
  - `swarm-lab-site/src/styles/components.css`: pillars/harvest lede color `--text-dim` → `--text`; `section-label` 10px → 11px on `--brand-dim`; remove `--bg-alt` hardcoded fallbacks now that the token exists. (+7 / -7)
  - `swarm-lab-site/src/index.css` (DELETED): vestigial, never imported, shadowed `globals.css` token names with conflicting values. (-69)

### Internal: kb quality review artifact

**What this is:** Weekly review of the 28 hand-stub knowledge-base entries; produces the punch-list that drives next week's kb-extractor patch queue. Surface for next `self-improve` to schedule the BLOCKER (Black-Scholes fair-value uses `N(d1)` where it should use `N(d2)`) and HIGH (KL-divergence worked example off by ~2×) fixes.

- `4f82c36` — `kb: weekly quality review 2026-05-04`
  - `outputs/kb_quality_reviews/2026-05-04.md` (NEW): 28 entries reviewed — 1 BLOCKER, 1 HIGH, 5 MEDIUM, 7 LOW, 14 CLEAN. (+319)
  - `outputs/kb_quality_reviews/_coverage.json` (NEW): coverage tracker. (+30)

### Cron: site-metrics publishes (bot-filtered, called out for completeness)

93 commits authored by `tomscaria` matching `data: refresh site metrics`, each touching only `swarm-lab-site/public/metrics.json` with a single line changed. Treated as bot-class noise per the convention established in the 2026-05-03 push recap. Cadence held at the expected ~15-minute interval through the window with no gaps.

---

## tomscaria/lore-financial-teaser

### Internal: brand-voice smoke tests

**What this is:** Replaces a placeholder unit test with four small regression anchors for the brand-voice rules (banned-word list integrity, LTP definition structure, `$40M` AUM string format) on the same day that the swarm-lab-site brand-voice pass landed (see `bf21c22` above). Same operator, same voice rules, applied to the second marketing surface.

**Under the hood**

- `031ce8e` — `test: replace placeholder with meaningful brand-voice smoke tests`
  - `src/test/example.test.ts`: 4 new tests — banned-word list integrity, LTP definition structure, numeric AUM string format. (+33 / -2)

---

## aaronjmars/aeon

### Theme — skill-freshness watchdog (ships disabled)

**What this is:** New skill that closes the silent-staleness gap between `heartbeat` (catches workflow failure), `skill-analytics` (catches duration drift), and `skill-health` (catches API/format failures): none of them notice when a chained consumer reads a stale upstream artifact with no API errors and a 100% pass rate. Today there's no check that `tweet-allocator` reading `articles/token-report-*.md` is reading today's version vs last Tuesday's. Closes a backlog idea carried two `repo-actions` cycles (Apr-30 idea #4 / May-2 idea #2). Companion to `skill-update-check` (which only catches drift in *imported* SKILL.md files). Shipped enabled-false in `aeon.yml` — first run will be operator-gated.

**Shipped to users**

- `32c77d7` — `feat(skill-freshness): audit enabled skills' upstream file deps for staleness (#157)`
  - `skills/skill-freshness/SKILL.md` (NEW, +286): walks `aeon.yml` for `enabled: true` consumers; gathers explicit deps from `chains: consume:` blocks (`.outputs/` class) plus implicit deps via SKILL.md grep over `articles/` / `.outputs/` / `memory/topics/` / `memory/state/` references; picks per-class threshold from producer cadence (4h `.outputs/` · 28h daily articles · 192h weekly · 7d topics · 30d state); severity bands OK / WARN (1×) / STALE (2×) / MISSING (canonical pattern only); worst-of-deps roll up to consumer verdict; worst-of-consumers to fleet; sha1 fingerprint dedup with 7-day re-emit window so chronic-stale isn't forgotten. Pure local file I/O — no curl, no `gh api`, no env-var-in-headers (sandbox-clean by construction).
  - `aeon.yml` (+1): registers the skill at `enabled: false`.
  - `skills.json` (+13 / -1): adds the metadata entry.

---

## Developer notes

- **New dependencies:** none.
- **Breaking changes:** none. PR #19 (`ssrn_harvest` rowcount) and PR #23 (`pm_strategy_runner` fractional days) silently change observable counts/probabilities — downstream `papers_new` totals may dip and `fair_yes_probability` for 3-7d horizons will move by up to ~24% of T, but neither breaks an interface.
- **New public surface:** one new framework skill on `aaronjmars/aeon` (`skill-freshness`, ships disabled). No new HTTP routes, CLI flags, config keys, or migrations on `swarm-fund-mvp`.
- **Tech debt added:** none visible in diffs. PR #20's harvest regex fix is scoped narrowly to leading-line images (`^\s*` anchor with `re.MULTILINE`); inline images mid-paragraph remain untouched, a deferred call-out.

## Open threads

- **`skill-freshness` enable** — shipped `enabled: false` on aaronjmars/aeon. Operator-side decision pending; first activation should be a manual `workflow_dispatch` so the initial baseline doesn't fire a wall of WARN/STALE notifications across the fleet.
- **kb-extractor BLOCKER fix queue** — Black-Scholes fair-value `N(d1)` → `N(d2)` and KL-divergence worked example correction (from `outputs/kb_quality_reviews/2026-05-04.md`). Surface to next `self-improve`.
- **`canonical_regime_label()` is now covered, but the call sites in `python/main.py` are not** — variant bandit's regime-tagged sub-posteriors are exercised end-to-end in production but not in tests. Possible follow-up.

## Sources

- tomscaria/swarm-fund-mvp: ok
- tomscaria/lore-financial-teaser: ok
- aaronjmars/aeon: ok
- gh api events: ok
- gh api commits: ok (since=2026-05-03T21:20:53Z)
- gh pr list: ok
- bot-filtered: 93 (`data: refresh site metrics` × 93, single-file `swarm-lab-site/public/metrics.json` cron pattern matched per 2026-05-03 convention)
- diff-truncated: 0

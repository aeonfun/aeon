# Code Health Report — 2026-05-04

Three watched repos audited. Headlines: **(1)** `lore-financial-teaser` shipped a real cleanup pass yesterday — 6 dead component files removed, `@tanstack/react-query` ripped out, 13% main-bundle cut via lazy-loading, and the placeholder test was finally given real assertions; **(2)** swarm-fund-mvp tests grew **+3 to 142 files**, including a new `tests/test_aeon_adapter.py` (203 lines) that directly covers ADR-093's tick-broker wire-up; **(3)** `aaronjmars/aeon` shipped only 1 commit (skill-freshness #157) — the regression test for yesterday's secrets-route fix is still not in.

| Repo | HEAD | Last commit | Notes |
|------|------|-------------|-------|
| `tomscaria/swarm-fund-mvp` | `dbf44e4` | 2026-05-04 12:06 -0500 — `data: refresh site metrics` | One real-feature commit since yesterday (`bf21c22` design / brand voice) + `4f82c36` weekly-quality-review + ~30 metric-refresh commits. |
| `tomscaria/lore-financial-teaser` | `031ce8e` | 2026-05-03 16:20 -0500 — `test: replace placeholder with meaningful brand-voice smoke tests` | Six real commits last night (16:11-16:20 -0500): brand-voice enforcement, dead-code removal, dep prune, lazy-load, aria-label, real test. |
| `aaronjmars/aeon` | `32c77d7` | 2026-05-04 08:53 -0400 — `feat(skill-freshness): audit enabled skills' upstream file deps for staleness (#157)` | One new commit since yesterday's headline-fix wave. |

## tomscaria/swarm-fund-mvp

### TODOs (74 occurrences across 31 files — unchanged from 2026-05-03)

Same three-bucket structure. Counts and file list both byte-identical to yesterday:

| Category | Count | Notes |
|----------|-------|-------|
| Rust scaffolding `TODO(TASK-X.Y)` | 35 | `rust/swarm-{ingest,executor}/src/...` — every TODO references a numbered task in `TASKS.md`. Roadmap, not debt. |
| Strategy enrichment triplet | ~21 | Same 3-line "Kelly / signal-emit / cost-floor" stub repeats across 5 strategies. Refactor candidate unchanged. |
| Mirofish / surface enrichment / event-mapper / blog harvester | ~18 | Pre-implementation placeholders, plus 4 `# TODO: feed URL needs verification` markers in `python/research/knowledge/harvest_blogs.py:54-63`. |

**Day-3 carry — three "TODO: verify" hardcoded feed IDs unchanged:**
- `pipeline/ingestion/pyth_ws.py:36` — XRP/USD Pyth feed ID `ec5d399b3b...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:36` — Backed bIB01 mint `9n4nbM75...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:37` — Dinari dSPY mint `FtgGSFAD...` (unverified).

These gate trading decisions in CalibrationGap-adjacent ingestion. Now Day-3 carry. ~20-line cross-check still outstanding.

The 4 `harvest_blogs.py:54-63` unverified RSS URLs also unchanged (Day-2 carry).

### Concerns

**1. `python/api/server.py` is still 3029 lines.**

Unchanged from yesterday. Same recommendation: split by route group when next route lands.

**2. Test surface keeps growing.**

| Snapshot | test files |
|----------|-----------|
| 2026-04-25 (week ago) | 106 |
| 2026-05-03 | 139 |
| 2026-05-04 | **142 (+3 / day, +34% / week)** |

Three new test files since yesterday. Notable addition:

- **`tests/test_aeon_adapter.py` (203 lines)** — direct test coverage for `python/execution/aeon_adapter.py` (the ADR-093 tick-broker that polls `tomscaria/aeon` outputs). Reduces the falsifier-window risk on the ADR-093 wire-up: even if `tomscaria/aeon` doesn't ship the JSON-output contract by ~2026-05-17, the consumer side is at least test-covered.

**3. Files >500 lines (refresh).**

| File | Lines | Δ vs 2026-05-03 | Δ vs 2026-04-25 |
|------|-------|------------------|------------------|
| `python/api/server.py` | 3029 | unchanged | -1 |
| `python/main.py` | 1884 | unchanged | -1 |
| `python/alerting/telegram.py` | 1660 | unchanged | **+74** |
| `swarm-lab-site/src/content/copy.tsx` | 1631 | unchanged | unchanged |
| `tests/test_strategies.py` | 1540 | unchanged | +2 |
| `python/agents/runner_swarm.py` | 1504 | unchanged | +46 |
| `python/tests/test_variant_bandit.py` | 945 | unchanged | **+76** |
| `python/agents/strategy_registry.py` | 939 | unchanged | -1 |
| `python/tests/test_llm_client.py` | 836 | unchanged | (newly tracked) |
| `python/signal/variant_bandit.py` | 799 | unchanged | unchanged |

Stable day-over-day. Week-over-week, two test files (`test_variant_bandit.py` +76, `test_strategies.py` +2) and `telegram.py` (+74) are doing most of the line-count growth — a healthy direction (test code + alerting surface, not core engine bloat).

`copy.tsx` was edited in `bf21c22` (brand voice / design system cleanup) but the line count is unchanged at 1631 — a content-substitution edit, not a growth edit. The same commit also REMOVED `swarm-lab-site/src/index.css` outright. Dead-code cleanup, the right kind of churn.

**4. Hardcoded secrets — clean, with the `outputs/manual_tasks_thomas.md:276` partial fingerprint unchanged.**

The `sk-ant-api03-fpl...1wAA` partial Anthropic key fingerprint at `outputs/manual_tasks_thomas.md:276` remains. Prefix + 4-char suffix don't enable recovery, but `outputs/` is article-shaped — recommend `[redacted prefix]` notation. Day-2 carry-over.

Test-side dummies (`"sk-ant-test"` in `python/tests/test_llm_client.py`) are correct test pattern, no concern.

**5. Dashboard API routes — still clean.**

No `execSync(template-string)` pattern in any `dashboard/app/api/**` route. Class of bug that haunted `aaronjmars/aeon` for 12 days is structurally absent here.

### Recommendations

1. **Verify the three "TODO: verify" hardcoded feed IDs** in `pyth_ws.py:36` and `birdeye_rest.py:36-37`. Day-3 carry-over. Top priority — gates CalibrationGap-adjacent ingestion.
2. **Move `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint** to `[redacted]` notation.
3. **Verify the 4 new `harvest_blogs.py:54-63` RSS feed URLs.** Day-2 carry, lower blast-radius.
4. Carry-over: extract strategy-stub triplet, re-document `tools/kraken-cli-main/`, plan `server.py` split, gitignore `config/revenant_proposals.yaml`.

## tomscaria/lore-financial-teaser

HEAD `031ce8e` — **moved from `679f105` since yesterday**, after a six-commit pass last night (16:11-16:20 -0500). This is the first real working day on this repo in a week.

### What landed yesterday

| Commit | What |
|--------|------|
| `031ce8e` | `test: replace placeholder with meaningful brand-voice smoke tests` |
| `3772010` | `docs(readme): update stack, commands, site structure, brand links` |
| `c77fb55` | `docs: update COPY_GUIDELINES with voice rules, mark VOICE_AND_TONE as canonical` |
| `10f3895` | `chore: remove @tanstack/react-query (unused)` |
| `92c7b06` | `chore: remove 6 dead component files (never imported)` |
| `c2d6cb0` | `fix(review): remove duplicate SVG import, add aria-label to SectionNav buttons` |
| `bfaae50` | `copy(brand-voice-thomas): enforce voice rules across all marketing sections` |
| `9b53f11` | `perf(bundle): lazy-load 6 heavy below-fold sections, cut main bundle 13%` |

This is the dead-code-and-cleanup pass that the previous four `code-health` reports kept asking for, executed in one sitting. Specifically:
- **6 dead component files removed** (`92c7b06`) — every previous report flagged "consider an unused-imports sweep." Done.
- **`@tanstack/react-query` removed** (`10f3895`) — unused dep, ~50KB out of the bundle.
- **Lazy-load + 13% main-bundle cut** (`9b53f11`).
- **Vitest stub gained real assertions** (`031ce8e`) — see below.
- **Accessibility patch** (`c2d6cb0`) — aria-labels on `SectionNav`.

### TODOs

Still zero TODO/FIXME/HACK/XXX in source tree. Two SVG-internal matches in `src/assets/logos/logos_all.svg` (vendored asset markup, not code).

### Concerns

**1. `.env` STILL TRACKED — Day-3 carry-over.**

`git ls-files | grep ^.env` confirms both `.env` and `.env.example` remain tracked. The yesterday-cleanup pass touched code/tests/docs but NOT the `.env` problem. Content byte-identical to 2026-05-02:

```
VITE_SUPABASE_PROJECT_ID="hhacnvwqrckfeyhdlzab"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ...zVLFfIs5klr8OyS_Lah88Ul9mMwSJ29pJkm5yuxRUHs"
VITE_SUPABASE_URL="https://hhacnvwqrckfeyhdlzab.supabase.co"
```

Severity stays low in practice (values are `VITE_*`-baked into the bundle anyway, JWT is the public anon role with `exp: 2036-02`), but the 3-step fix is now Day-3 unfixed despite a working session that touched 8 commits in the same area. Likely missed in the cleanup pass — surface it explicitly.

**2. Test coverage — placeholder gained content.**

`src/test/example.test.ts` was 1 stub assertion (`expect(true).toBe(true)`); now 4 assertions:
1. Banned-word list contains "revolutionary" and "synergy" (the brand-voice anti-pattern check).
2. "LTP" abbreviation expands to "Liquid Tokenized Portfolio" (3 words, starts with "Liquid").
3. AUM/revenue figures match `^\$[\d.]+[KMB]?$`.
4. Original placeholder `expect(true).toBe(true)` retained.

This is a minimal but real Vitest suite. No coverage on the Supabase waitlist call yet — the file is still the only `.test.*` file in the repo. Smoke test for `useWaitlistSubmit` (or whatever the Supabase boundary is) is still recommended.

**3. Files >500 lines — refresh, structure unchanged.**

| File | Lines | Δ vs 2026-05-03 |
|------|-------|------------------|
| `src/components/sections/HowItWorksSection.tsx` | 1553 | **+5** |
| `src/components/sections/PartnerModelsSection.tsx` | 1359 | unchanged |
| `src/components/sections/ETFEvolutionSlides.tsx` | 1054 | unchanged |
| `src/components/ui/sidebar.tsx` | 637 | unchanged |
| `src/components/sections/CountryOpportunityModule.tsx` | 601 | unchanged |
| `src/components/FloatingPitchProgressHUD.tsx` | 529 | unchanged |

`HowItWorksSection.tsx` +5 lines is consistent with brand-voice text edits. Defer splits.

### Recommendations

1. **Untrack `.env`** — the cleanup pass missed it. 3-step fix: `git rm --cached .env`, rename to `.env.local`, fix `.env.example` key naming. Day-3 carry on a 5-minute fix.
2. **Add a Vitest case for the Supabase waitlist boundary** — the only true integration surface in the repo, still uncovered.
3. After today's lazy-load patch (`9b53f11` cut bundle 13%), consider running `vite-bundle-visualizer` once to confirm the lazy-loaded chunks are below-the-fold and not hitting LCP.

## aaronjmars/aeon

HEAD `32c77d7`. **One new commit since yesterday** (vs 6 yesterday):

| Commit | Date | What |
|--------|------|------|
| `32c77d7` | 2026-05-04 08:53 | feat(skill-freshness): audit enabled skills' upstream file deps for staleness (#157) |

The "ship the launch" cadence (`pr-triage`, `smithery-manifest`, `fork-cohort`, `operator-scorecard`, `show-hn-draft`, `skill-freshness`) is consistent with the 2026-05-04 repo-article reading: 9 of last 9 feature PRs serve the meta-loop, not new market/research/content surface. **Repository in launch-prep mode, not feature-add mode.**

### Headline fix from 2026-05-03 — VERIFIED still in place

Re-verified `dashboard/app/api/secrets/route.ts`:

```ts
import { execFileSync, execSync } from 'child_process'
...
// Line 96 — POST handler
execFileSync('gh', ['secret', 'set', name, '-b', value], {
  stdio: 'pipe', cwd: process.cwd(),
})
// Line 119 — DELETE handler
execFileSync('gh', ['secret', 'delete', name], { stdio: 'pipe', cwd: process.cwd() })
```

Argv-array form holds. ISS-016 candidate filing remains pre-empted.

### Remaining concerns

**1. Regression test for `secrets/route.ts` — STILL NOT IN.**

Yesterday's recommendation was: "add a single Vitest case asserting POST `value = 'x\`whoami\`'` is stored verbatim, not executed — locks the fix in." 24 hours later, no test added. `find dashboard -name "*.test.*"` returns zero results — the dashboard tree has zero test surface.

The 12-day-unpatched window happened because nothing in the repo would have caught a regression. Without a regression test, the same window can re-open on the next refactor of `secrets/route.ts`. ~30-line diff, single Vitest file.

**2. `dashboard/app/api/auth/route.ts:46` template-string `execSync` — NOT exploitable, unchanged.**

`secretName` is one of two literal strings (`'CLAUDE_CODE_OAUTH_TOKEN'` | `'ANTHROPIC_API_KEY'`) chosen by `key.startsWith('sk-ant-oat')`. No user-controlled interpolation reaches the shell. Safe. Could be tightened to `execFileSync` for defense-in-depth.

**3. Dashboard API routes — 9 use `child_process`. Three new routes (`import`, `memory`, `upload`) do NOT.**

```
dashboard/app/api/secrets/route.ts        execFileSync (POST/DELETE) + execSync (GET — gh auth status)
dashboard/app/api/auth/route.ts           execSync (literal-only — safe)
dashboard/app/api/runs/route.ts           execSync
dashboard/app/api/runs/[id]/logs/route.ts execSync
dashboard/app/api/analytics/route.ts      execSync
dashboard/app/api/skills/route.ts         execSync
dashboard/app/api/skills/[name]/run/route.ts  execSync
dashboard/app/api/outputs/route.ts        execSync
dashboard/app/api/sync/route.ts           execSync
```

Three newer routes (`import/route.ts`, `memory/route.ts`, `upload/route.ts`) do NOT import `child_process` — they appear to be pure file-IO / db routes. Only the secrets handler had the exploitable shape and it's now fixed. All 9 should still be reviewed for argv-form safety on next touch.

**4. TODOs — 1 real (Day-6 carry).**

`skills/workflow-security-audit/SKILL.md:36` — `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` All other TODO grep matches across the repo are docs referring to the TODO grep target as a concept. Zero `TODO|FIXME|HACK|XXX` in any `.ts/.tsx/.js/.py/.rs` file in the repo.

**5. Sandbox-required scripts — unchanged from yesterday.**

```
Present: prefetch-xai.sh, generate-feed.sh, sync-site-data.sh, sync-upstream.sh,
         postprocess-{admanage,admanage-create,devto,farcaster,replicate}.sh,
         eval-audit, skill-runs
Missing: postprocess-notify.sh, prefetch-vuln-scanner.sh (ISS-001),
         prefetch-reddit.sh (ISS-002 / ISS-012)
```

`prefetch-xai.sh` cases verified: `refresh-x`, `remix-tweets`, `tweet-roundup`, `narrative-tracker`, `article`, `fetch-tweets`, `vercel-projects`. **`reply-maker)` case STILL MISSING — Day-10 carry on ISS-014.** PR #156 (in flight per memory) has not landed in `main` of upstream `aaronjmars/aeon` (still 1 commit since yesterday, and that commit is `skill-freshness`, not the reply-maker fix).

**6. Tests — unchanged.**

2 test files total: `examples/mcp/test_connection.py`, `skills/skill-health/tests/smoke.sh`. Zero unit/integration tests in `dashboard/`, `a2a-server/`, or `web/` (if it exists). Adding even one regression test for `secrets/route.ts` would close the structural gap.

**7. Files >500 lines — unchanged: 1 file.**

`a2a-server/src/index.ts` (578 lines).

**8. No `npm audit` / `pip-audit` / `cargo audit` step in any workflow — unchanged.**

### Recommendations

1. **Add the regression test for `dashboard/app/api/secrets/route.ts`** — Day-2 carry on yesterday's recommendation. Lock yesterday's fix in.
2. **Land the `reply-maker)` case in `scripts/prefetch-xai.sh`** — ISS-014 Day-10 carry. PR #156 carrier per memory; rebase if stale.
3. **Bump ZIZMOR_VERSION** in `skills/workflow-security-audit/SKILL.md:36`. Day-6 carry.
4. Consider a defense-in-depth `execFileSync` migration for the 8 remaining template-string `execSync` callsites in dashboard routes, even where current callers are safe — pre-empts future regressions during refactors.

## Cross-repo summary

| Signal | swarm-fund-mvp | lore-financial-teaser | aeon |
|--------|----------------|----------------------|------|
| Real TODOs (excl. docs) | 74 (mostly TASK-tagged scaffolding) | 0 | 1 (workflow-security-audit Day-6 carry) |
| Tracked secrets / keys | 0 (1 partial fingerprint Day-2 carry) | **1 `.env` Day-3 carry** | 0 |
| `execSync(template-string)` exploit | none | n/a | none (auth/route.ts:46 literal-only, safe) |
| Files >500 lines | ~24 author + 9 vendored kraken-cli (≈stable) | 6 author + 1 shadcn-ui (HowItWorksSection +5) | 1 (`a2a-server/src/index.ts` 578) |
| Test files | **142 (+3 vs yesterday, +34% vs week-ago)** | 1 (Vitest, real assertions added) | 2 |
| CI dep audit step | none | none | none |

### What changed in 24 hours

- **lore-financial-teaser broke a 7-day standstill** — 8 commits including dead-code removal (6 component files), unused dep (`@tanstack/react-query`) removed, 13% bundle cut via lazy-loading, brand-voice enforcement, real test assertions, aria-label patch. The cleanup pass `code-health` had been requesting for four weeks landed in one sitting. **`.env` still tracked despite the cleanup window.**
- **swarm-fund-mvp test surface +3 → 142** — including the new `tests/test_aeon_adapter.py` (203 lines), which directly covers ADR-093's `python/execution/aeon_adapter.py` tick-broker. De-risks the falsifier-window: even if `tomscaria/aeon` doesn't ship `outputs/{skill}/{date}.json` by 2026-05-17, the consumer side has tests.
- **aaronjmars/aeon** shipped one feature (`skill-freshness` #157) — first observability skill that catches *silent staleness* (chained skill reading a stale upstream article with no API errors and 100% pass rate). Conceptually adjacent to what `code-health` does, scoped to skill outputs not source code. **No regression test for yesterday's secrets-route fix, no `reply-maker)` case in `prefetch-xai.sh`.**

### What's stuck

- `aeon` ISS-014 reply-maker case in `prefetch-xai.sh` — Day-10 carry. PR #156 hasn't merged.
- `aeon` regression test for `secrets/route.ts` — Day-2 carry on yesterday's recommendation.
- `aeon` ZIZMOR_VERSION bump in `workflow-security-audit/SKILL.md:36` — Day-6 carry.
- `swarm-fund-mvp` 3 unverified Pyth/Birdeye feed IDs — Day-3 carry, gates CalibrationGap-adjacent ingestion.
- `swarm-fund-mvp` 4 unverified RSS feed URLs in `harvest_blogs.py:54-63` — Day-2 carry.
- `swarm-fund-mvp` `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint — Day-2 carry.
- `lore-financial-teaser` `.env` tracking — Day-3 carry, missed in the cleanup pass.

### Next-priority fixes across all three repos

1. **Verify `swarm-fund-mvp` Pyth/Birdeye feed IDs** — gates trading decisions in CalibrationGap-adjacent ingestion. Day-3 carry. Top priority.
2. **Add regression test for `aeon/dashboard/app/api/secrets/route.ts`** — locks in yesterday's headline fix. Day-2 carry.
3. **Untrack `lore-financial-teaser` `.env`** — process bomb on next real secret. Day-3 carry, 5-min fix.
4. **Land `reply-maker)` case in `aeon/scripts/prefetch-xai.sh`** — ISS-014 Day-10 carry, blocks reply-maker default-topic branch.

## Summary

- Multi-repo audit. Three repos cloned cleanly. No new shell-injection vectors; yesterday's fix at `aeon/dashboard/app/api/secrets/route.ts` verified still in place.
- **`lore-financial-teaser` shipped 8 cleanup commits last night** — dead code removed (6 component files), unused dep (`@tanstack/react-query`) ripped out, 13% main-bundle cut via lazy-loading, brand-voice enforcement, accessibility patch (aria-labels), placeholder Vitest stub gained 3 real brand-voice assertions. The cleanup pass `code-health` had been recommending for 4 weeks landed in one sitting.
- **swarm-fund-mvp test surface +3 to 142 files** — including a brand-new `tests/test_aeon_adapter.py` (203 lines) covering ADR-093's tick-broker. Concrete de-risking of the 2-week ADR-093 falsifier window.
- **`aaronjmars/aeon` shipped 1 feature** (skill-freshness #157, silent-staleness detector for chained skill outputs). No regression test for yesterday's secrets-route fix yet (Day-2 carry); ISS-014 reply-maker case still missing in `prefetch-xai.sh` (Day-10 carry).
- **`lore-financial-teaser` `.env` is STILL tracked** despite the cleanup window — Day-3 carry on a 5-minute fix.
- No hardcoded production secrets across any of the three repos. Three "TODO: verify" feed IDs in swarm-fund-mvp Pyth/Birdeye ingestion now Day-3 carry.
- Top action: verify the swarm-fund-mvp Pyth/Birdeye feed IDs and add the regression test for the aeon secrets-route fix.

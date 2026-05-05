# Code Health Report — 2026-05-05

Three watched repos audited. All three are essentially **frozen since yesterday**: `lore-financial-teaser` and `aaronjmars/aeon` have **zero commits in 24h**, `swarm-fund-mvp` has **one commit** (`936cf15` site-metrics refresh — no code changes). Every line count, TODO count, and tracked-file list is byte-identical to 2026-05-04. As a result this report is mostly a carry-over reckoning: the four highest-priority items from yesterday all aged another day without action.

| Repo | HEAD | Last commit | Δ since 2026-05-04 |
|------|------|-------------|--------------------|
| `tomscaria/swarm-fund-mvp` | `936cf15` | 2026-05-05 11:59 -0500 — `data: refresh site metrics` | 1 commit, no code touched |
| `tomscaria/lore-financial-teaser` | `031ce8e` | 2026-05-03 16:20 -0500 — `test: replace placeholder with meaningful brand-voice smoke tests` | 0 commits |
| `aaronjmars/aeon` | `32c77d7` | 2026-05-04 08:53 -0400 — `feat(skill-freshness): audit enabled skills' upstream file deps for staleness (#157)` | 0 commits |

## tomscaria/swarm-fund-mvp

### TODOs (74 occurrences across 31 files — byte-identical to 2026-05-04)

Same three-bucket structure, same files, same counts:

| Category | Count | Notes |
|----------|-------|-------|
| Rust scaffolding `TODO(TASK-X.Y)` | 35 | `rust/swarm-{ingest,executor}/src/...` — every TODO references a numbered task in `TASKS.md`. Roadmap, not debt. |
| Strategy enrichment triplet | ~21 | Same 3-line "Kelly / signal-emit / cost-floor" stub repeats across 5 strategies. Refactor candidate unchanged. |
| Mirofish / surface enrichment / event-mapper / blog harvester | ~18 | Pre-implementation placeholders, plus 4 `# TODO: feed URL needs verification` markers in `python/research/knowledge/harvest_blogs.py:54-63`. |

**Day-4 carry — three "TODO: verify" hardcoded feed IDs unchanged:**
- `pipeline/ingestion/pyth_ws.py:36` — XRP/USD Pyth feed ID `ec5d399b3b...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:36` — Backed bIB01 mint `9n4nbM75...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:37` — Dinari dSPY mint `FtgGSFAD...` (unverified).

These gate trading decisions in CalibrationGap-adjacent ingestion. Now Day-4 carry.

The 4 `harvest_blogs.py:54-63` unverified RSS URLs also unchanged (Day-3 carry).

### Concerns

**1. Test surface flat at 142 files.** No new tests since the ADR-093 `test_aeon_adapter.py` landed yesterday.

| Snapshot | test files |
|----------|-----------|
| 2026-04-25 (week ago) | 106 |
| 2026-05-04 | 142 |
| 2026-05-05 | **142 (unchanged)** |

The +34%-week growth pattern paused exactly on the day no code shipped.

**2. Files >500 lines — stable, byte-identical to yesterday.**

| File | Lines | Δ vs 2026-05-04 |
|------|-------|------------------|
| `python/api/server.py` | 3029 | unchanged |
| `python/main.py` | 1884 | unchanged |
| `python/alerting/telegram.py` | 1660 | unchanged |
| `swarm-lab-site/src/content/copy.tsx` | 1631 | unchanged |
| `tests/test_strategies.py` | 1540 | unchanged |
| `python/agents/runner_swarm.py` | 1504 | unchanged |
| `python/tests/test_variant_bandit.py` | 945 | unchanged |
| `python/agents/strategy_registry.py` | 939 | unchanged |
| `python/tests/test_llm_client.py` | 836 | unchanged |
| `python/signal/variant_bandit.py` | 799 | unchanged |

`server.py` 3029 → split-by-route-group recommendation now Week-1 standing.

**3. Hardcoded secrets — clean, partial fingerprint Day-3 carry.**

`outputs/manual_tasks_thomas.md:276` Anthropic key partial fingerprint (`sk-ant-api03-fpl...1wAA`) unchanged. `outputs/2026-04-27_surface_a_runbook.md:38` mentions `sk_test_` / `sk_live_` only as Stripe documentation, no real key.

Test-side dummies (`"sk-ant-test"` in `python/tests/test_llm_client.py`) are correct test pattern, no concern.

**4. Dashboard API routes — clean.** No `execSync(template-string)` pattern in any `dashboard/app/api/**` route — the bug class that haunted `aaronjmars/aeon` for 12 days remains structurally absent here.

### Recommendations

1. **Verify the three "TODO: verify" hardcoded feed IDs** in `pyth_ws.py:36` and `birdeye_rest.py:36-37`. **Day-4 carry**, gates CalibrationGap-adjacent ingestion.
2. **Move `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint** to `[redacted]` notation. Day-3 carry.
3. **Verify the 4 new `harvest_blogs.py:54-63` RSS feed URLs.** Day-3 carry, lower blast-radius.
4. Carry-over: extract strategy-stub triplet, plan `server.py` split, gitignore `config/revenant_proposals.yaml`.

## tomscaria/lore-financial-teaser

HEAD `031ce8e` — **unchanged**. Zero commits in 24h, two days post-cleanup-burst.

### TODOs

Still zero TODO/FIXME/HACK/XXX in source tree. Two SVG-internal matches in `src/assets/logos/logos_all.svg` (vendored asset markup, not code).

### Concerns

**1. `.env` STILL TRACKED — Day-4 carry-over.**

`git ls-files | grep ^.env` confirms both `.env` and `.env.example` remain tracked. The full `.env` content is byte-identical to 2026-05-02:

```
VITE_SUPABASE_PROJECT_ID="hhacnvwqrckfeyhdlzab"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ...zVLFfIs5klr8OyS_Lah88Ul9mMwSJ29pJkm5yuxRUHs"
VITE_SUPABASE_URL="https://hhacnvwqrckfeyhdlzab.supabase.co"
```

Day-4 unfixed despite a working session two days ago that touched 8 commits in the same area. Severity stays low in practice (values are `VITE_*`-baked into the bundle anyway, JWT is the public anon role with `exp: 2036-02`), but this is now a **5-minute fix carried for 4 days**. Lift it explicitly into the daily-attention layer.

**2. Test coverage — 1 file, 4 assertions.** Unchanged from yesterday. The Vitest stub gained content during the 2026-05-03 cleanup pass; no further additions. Smoke test for `useWaitlistSubmit` (or whatever the Supabase boundary is) still recommended.

**3. Files >500 lines — unchanged structure.**

| File | Lines | Δ vs 2026-05-04 |
|------|-------|------------------|
| `src/components/sections/HowItWorksSection.tsx` | 1553 | unchanged |
| `src/components/sections/PartnerModelsSection.tsx` | 1360 | unchanged |
| `src/components/sections/ETFEvolutionSlides.tsx` | 1054 | unchanged |
| `src/components/ui/sidebar.tsx` | 637 | unchanged |
| `src/components/sections/CountryOpportunityModule.tsx` | 601 | unchanged |
| `src/components/FloatingPitchProgressHUD.tsx` | 529 | unchanged |

### Recommendations

1. **Untrack `.env`** — `git rm --cached .env`, rename to `.env.local`, fix `.env.example` key naming. **Day-4 carry on a 5-minute fix.** Promote priority.
2. **Add a Vitest case for the Supabase waitlist boundary** — the only true integration surface in the repo, still uncovered.
3. After the 2026-05-03 lazy-load patch, run `vite-bundle-visualizer` once to confirm the lazy-loaded chunks are below-the-fold and not hitting LCP.

## aaronjmars/aeon

HEAD `32c77d7` — **unchanged**. Zero commits in 24h.

### Headline fix from 2026-05-03 — VERIFIED still in place

Re-read `dashboard/app/api/secrets/route.ts` line-for-line:

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

Argv-array form holds. `VALID_SECRET_NAME = /^[A-Z][A-Z0-9_]{1,}$/` validates names before exec. ISS-016 candidate filing remains pre-empted.

### Concerns

**1. Regression test for `secrets/route.ts` — STILL NOT IN. Day-3 carry.**

`find dashboard -name "*.test.*"` returns zero results — the dashboard tree has zero test surface. The 12-day-unpatched window happened because nothing in the repo would have caught a regression. Without a regression test, the same window can re-open on the next refactor of `secrets/route.ts`. ~30-line diff, single Vitest file, and it's been three days since this was the headline action item.

**2. `dashboard/app/api/auth/route.ts` template-string `execSync` — NOT exploitable, unchanged.**

`secretName` is one of two literal strings (`'CLAUDE_CODE_OAUTH_TOKEN'` | `'ANTHROPIC_API_KEY'`) chosen by `key.startsWith('sk-ant-oat')`. No user-controlled interpolation reaches the shell. Safe. Could be tightened to `execFileSync` for defense-in-depth.

**3. Dashboard API route surface.**

Confirmed structure unchanged from yesterday. 18 route files total under `dashboard/app/api/**/route.ts`. 9 use `child_process`:

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

The 9 file-IO/db routes (`import`, `memory/*` (6), `upload`) do NOT touch `child_process`. Only the secrets handler had the exploitable shape and it's now fixed.

**4. TODOs — 1 real (Day-7 carry).**

`skills/workflow-security-audit/SKILL.md:36` — `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` All other TODO grep matches across the repo are docs referring to the TODO grep target as a concept. Zero `TODO|FIXME|HACK|XXX` in any `.ts/.tsx/.js/.py/.rs` file in the repo.

**5. Sandbox-required scripts — unchanged.**

`prefetch-xai.sh` cases verified: `refresh-x`, `remix-tweets`, `tweet-roundup`, `narrative-tracker`, `article`, `fetch-tweets`, `vercel-projects`. **`reply-maker)` case STILL MISSING — Day-11 carry on ISS-014.** PR #156 has not landed in `main` of upstream `aaronjmars/aeon`.

```
Missing: postprocess-notify.sh, prefetch-vuln-scanner.sh (ISS-001),
         prefetch-reddit.sh (ISS-002 / ISS-012), reply-maker case in prefetch-xai.sh (ISS-014)
```

**6. Tests — unchanged.** 2 test files total: `examples/mcp/test_connection.py`, `skills/skill-health/tests/smoke.sh`. Zero unit/integration tests in `dashboard/`, `a2a-server/`, or `web/`.

**7. Files >500 lines — unchanged: 1 file.** `a2a-server/src/index.ts` (578 lines).

**8. No `npm audit` / `pip-audit` / `cargo audit` step in any workflow — unchanged.**

### Recommendations

1. **Add the regression test for `dashboard/app/api/secrets/route.ts`** — Day-3 carry. The ask hasn't moved in 72 hours. Promote to "ship today or close as wontfix and document why."
2. **Land the `reply-maker)` case in `scripts/prefetch-xai.sh`** — ISS-014 Day-11 carry. PR #156 carrier per memory; rebase if stale.
3. **Bump ZIZMOR_VERSION** in `skills/workflow-security-audit/SKILL.md:36`. Day-7 carry.
4. Consider a defense-in-depth `execFileSync` migration for the 8 remaining template-string `execSync` callsites in dashboard routes, even where current callers are safe — pre-empts future regressions during refactors.

## Cross-repo summary

| Signal | swarm-fund-mvp | lore-financial-teaser | aeon |
|--------|----------------|----------------------|------|
| Real TODOs (excl. docs) | 74 (mostly TASK-tagged scaffolding) | 0 | 1 (ZIZMOR_VERSION Day-7 carry) |
| Tracked secrets / keys | 0 (1 partial fingerprint Day-3 carry) | **1 `.env` Day-4 carry** | 0 |
| `execSync(template-string)` exploit | none | n/a | none (auth/route.ts literal-only, safe) |
| Files >500 lines | ~24 author + 9 vendored kraken-cli (stable) | 6 author + 1 shadcn-ui (stable) | 1 (`a2a-server/src/index.ts` 578) |
| Test files | 142 (unchanged vs yesterday) | 1 (Vitest) | 2 |
| CI dep audit step | none | none | none |
| Commits in last 24h | 1 (metrics refresh, no code) | 0 | 0 |

### What changed in 24 hours

Nothing structural. The only commit across all three repos (`936cf15`) is a site-metrics refresh on swarm-fund — pure data pipeline output, no code touched. Yesterday's headline finding (the `lore-financial-teaser` cleanup burst, the `swarm-fund-mvp` `test_aeon_adapter.py` ADR-093 coverage) was a one-day phenomenon. Today is the rest day after the burst.

### What's stuck (carry-over ledger, by age)

| Item | Repo | Age | Effort |
|------|------|-----|--------|
| ISS-014 `reply-maker)` case in `prefetch-xai.sh` | aeon | **Day-11** | PR #156 merge |
| ZIZMOR_VERSION bump in `workflow-security-audit/SKILL.md:36` | aeon | Day-7 | 1-line edit + tag check |
| `lore-financial-teaser` `.env` tracked | lore-teaser | Day-4 | 3 commands |
| swarm-fund-mvp Pyth/Birdeye 3 unverified feed IDs | swarm-fund | Day-4 | ~20-line cross-check |
| swarm-fund-mvp 4 unverified RSS feed URLs in `harvest_blogs.py` | swarm-fund | Day-3 | API ping |
| `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint | swarm-fund | Day-3 | 1-line edit |
| Regression test for `aeon/dashboard/app/api/secrets/route.ts` | aeon | Day-3 | ~30-line Vitest file |

The right read: the operator pattern this week is **bursts of cleanup followed by full days of zero touch**. Yesterday was burst; today is freeze. None of the carry items above are blocked on anything observable from outside — they're all <30 minutes of work each, queued behind whatever the operator's actual focus is (likely CalibrationGap pre-Apex push and ADR-093 wire-up). Worth surfacing the carry ledger as a single operator-grade ticket rather than continuing to re-list across daily reports.

### Next-priority fixes across all three repos

1. **Verify `swarm-fund-mvp` Pyth/Birdeye feed IDs** — gates trading decisions in CalibrationGap-adjacent ingestion. Day-4 carry. Top priority.
2. **Add regression test for `aeon/dashboard/app/api/secrets/route.ts`** — locks in the 2026-05-03 headline fix. Day-3 carry, ~30-line diff.
3. **Untrack `lore-financial-teaser` `.env`** — Day-4 carry, 5-minute fix.
4. **Land `reply-maker)` case in `aeon/scripts/prefetch-xai.sh`** — ISS-014 Day-11 carry, blocks reply-maker default-topic branch.

## Summary

- Three watched repos audited. Two had **zero commits**, one had a single metrics-refresh commit. This is the quietest 24h window the report has captured.
- `swarm-fund-mvp` only commit is `936cf15 data: refresh site metrics`. Every line count and TODO count is byte-identical to 2026-05-04.
- `lore-financial-teaser` HEAD `031ce8e` unchanged. **`.env` STILL tracked → Day-4 carry on a 5-minute fix.** Cleanup-burst window passed without untracking.
- `aaronjmars/aeon` HEAD `32c77d7` unchanged. **Regression test for `secrets/route.ts` → Day-3 carry** (still no test surface in `dashboard/`). **`reply-maker)` case in `prefetch-xai.sh` → ISS-014 Day-11 carry.** ZIZMOR_VERSION bump → Day-7 carry.
- Headline shell-injection fix at `aeon/dashboard/app/api/secrets/route.ts` verified still in place (argv-array form, name validated against `/^[A-Z][A-Z0-9_]{1,}$/`).
- Top action: same as yesterday. Verify swarm-fund-mvp Pyth/Birdeye feed IDs, add the regression test for the aeon secrets-route fix, untrack `lore-financial-teaser` `.env`. The carry ledger is becoming the report — worth surfacing as a single operator-grade ticket.

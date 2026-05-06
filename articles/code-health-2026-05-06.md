# Code Health Report — 2026-05-06

Three watched repos audited. **One real change in 24h that matters: PR #158 merged on `aaronjmars/aeon` at 01:02 UTC, converting `dashboard/app/api/skills/[name]/run/route.ts` to `execFileSync` argv-array form.** That is the second hardening in three days (after `secrets/route.ts` on 05-03), and it actions yesterday's recommendation #4 — the defense-in-depth migration is now visibly in motion. swarm-fund-mvp and lore-financial-teaser remained code-frozen.

| Repo | HEAD | Last commit | Δ since 2026-05-05 |
|------|------|-------------|--------------------|
| `tomscaria/swarm-fund-mvp` | `9559b68` | 2026-05-06 11:55 -0500 — `data: refresh site metrics` | ~30 metric-refresh commits in 24h, **0 code commits** |
| `tomscaria/lore-financial-teaser` | `031ce8e` | 2026-05-03 16:20 -0500 — `test: replace placeholder...` | 0 commits (now 3 days frozen) |
| `aaronjmars/aeon` | `1e167cf` | 2026-05-06 01:06 -0400 — `feat(star-momentum-alert): ... (#159)` | **2 merges**: #158 (security hardening) + #159 (star-momentum feat) |

## tomscaria/swarm-fund-mvp

Pure data-pipeline window. The `gh api repos/.../commits?since=2026-05-05T17:00:00Z` query returns 0 non-`data: refresh site metrics` commits across all pages — confirming code is frozen since yesterday's audit closed. ~30 metric-refresh commits in the window, ~15-min cadence (matches `swarm-lab-site/` metrics worker).

### TODOs (74 occurrences across 31 files — byte-identical to 2026-05-04 / 2026-05-05)

Same bucket structure, same files, same line numbers:

| Category | Count | Notes |
|----------|-------|-------|
| Rust scaffolding `TODO(TASK-X.Y)` | 35 | `rust/swarm-{ingest,executor}/src/...` — every TODO references a numbered task in `TASKS.md`. Roadmap. |
| Strategy enrichment triplet | ~21 | Same 3-line "Kelly / signal-emit / cost-floor" stub repeats across 5 strategies. |
| Mirofish / surface enrichment / event-mapper / blog harvester | ~18 | Pre-implementation placeholders + 4 `# TODO: feed URL needs verification` markers in `harvest_blogs.py:54-63`. |

**Day-5 carry — three "TODO: verify" hardcoded feed IDs unchanged:**
- `pipeline/ingestion/pyth_ws.py:36` — XRP/USD Pyth feed ID `ec5d399b3b...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:36` — Backed bIB01 mint `9n4nbM75...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:37` — Dinari dSPY mint `FtgGSFAD...` (unverified).

These gate trading decisions in CalibrationGap-adjacent ingestion. **Now Day-5 carry.** The cost of running CalibrationGap with unverified asset routing is real — the scanner is one feed-ID typo away from misrouted price reads.

The 4 `harvest_blogs.py:54-63` unverified RSS URLs also unchanged (Day-4 carry).

### Concerns

**1. Test surface — 144 files, +2 since yesterday's report.** Yesterday's audit recorded 142. My re-count today is 144 from a fresh shallow clone. The API confirms 0 non-metric commits in the audit window, so the delta is most likely a counting-method difference at the prior audit boundary, not new tests. Treating as no real change for the 7-day trend:

| Snapshot | test files |
|----------|-----------|
| 2026-04-25 (week ago) | 106 |
| 2026-05-04 | 142 |
| 2026-05-05 | 142 |
| 2026-05-06 | 144 (likely re-count rather than new tests; 0 non-metric commits in window) |

**2. Files >500 lines — byte-identical to 2026-05-05.**

| File | Lines | Δ vs 2026-05-05 |
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

`server.py` 3029 → split-by-route-group recommendation now Week-2 standing. The longer this sits the more painful the split becomes — a route-group split today is mechanical; in two more weeks of api churn it won't be.

**3. Hardcoded secrets — clean, partial fingerprint Day-4 carry.**

`outputs/manual_tasks_thomas.md:276` Anthropic key partial fingerprint (`sk-ant-api03-fpl...1wAA`) unchanged. Still a fingerprint, not a full key — low practical risk, but a 1-line edit and now 4 days untouched.

**4. Dashboard API routes — clean.** No `execSync(template-string)` pattern in any `dashboard/app/api/**` route. Bug class structurally absent here.

### Recommendations

1. **Verify the three "TODO: verify" hardcoded feed IDs** in `pyth_ws.py:36` and `birdeye_rest.py:36-37`. **Day-5 carry**, gates CalibrationGap-adjacent ingestion. Highest-priority action across all three repos.
2. **Move `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint** to `[redacted]` notation. Day-4 carry.
3. **Verify the 4 `harvest_blogs.py:54-63` RSS feed URLs.** Day-4 carry, lower blast-radius.
4. Standing: extract strategy-stub triplet, plan `server.py` route-group split, gitignore `config/revenant_proposals.yaml`.

## tomscaria/lore-financial-teaser

HEAD `031ce8e` — **unchanged**. Three days post-cleanup-burst, zero commits. Three-day freeze.

### TODOs

Still zero TODO/FIXME/HACK/XXX in source tree. Two SVG-internal matches in `src/assets/logos/logos_all.svg` (vendored asset markup, not code).

### Concerns

**1. `.env` STILL TRACKED — Day-5 carry-over.**

`git ls-files | grep ^.env` confirms both `.env` and `.env.example` remain tracked. The full `.env` content is byte-identical to 2026-05-02:

```
VITE_SUPABASE_PROJECT_ID="hhacnvwqrckfeyhdlzab"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ...zVLFfIs5klr8OyS_Lah88Ul9mMwSJ29pJkm5yuxRUHs"
VITE_SUPABASE_URL="https://hhacnvwqrckfeyhdlzab.supabase.co"
```

Severity stays low in practice (values are `VITE_*`-baked into the bundle anyway, JWT is the public anon role with `exp: 2036-02`), but this is now a **5-minute fix carried for 5 days**. The 2026-05-03 cleanup pass touched 8 commits in the same area without picking it up. At Day-5 the carry is itself the signal — it's not blocked, it's queued behind something else.

**2. Test coverage — 1 file, 4 assertions.** Unchanged from 2026-05-03. The Vitest stub gained content during the 2026-05-03 cleanup pass; no further additions. Smoke test for `useWaitlistSubmit` (or whatever the Supabase boundary is) still recommended.

**3. Files >500 lines — unchanged structure.**

| File | Lines | Δ vs 2026-05-05 |
|------|-------|------------------|
| `src/components/sections/HowItWorksSection.tsx` | 1553 | unchanged |
| `src/components/sections/PartnerModelsSection.tsx` | 1359 | unchanged |
| `src/components/sections/ETFEvolutionSlides.tsx` | 1054 | unchanged |
| `src/components/ui/sidebar.tsx` | 637 | unchanged |
| `src/components/sections/CountryOpportunityModule.tsx` | 601 | unchanged |
| `src/components/FloatingPitchProgressHUD.tsx` | 529 | unchanged |

### Recommendations

1. **Untrack `.env`** — `git rm --cached .env`, rename to `.env.local`, fix `.env.example` key naming. **Day-5 carry on a 5-minute fix.** Promote priority — the carry has now outlived two pitch-iteration cycles.
2. **Add a Vitest case for the Supabase waitlist boundary** — the only true integration surface in the repo, still uncovered.
3. After the 2026-05-03 lazy-load patch, run `vite-bundle-visualizer` once to confirm lazy-loaded chunks are below-the-fold and not hitting LCP.

## aaronjmars/aeon

HEAD `1e167cf`. **Two merges since yesterday's audit**:

| PR | SHA | Merged | Title |
|----|-----|--------|-------|
| **#158** | `89d566b` | 2026-05-06 01:02 UTC | `fix(dashboard/skills/run): use execFileSync to harden against shell injection` |
| #159 | `1e167cf` | 2026-05-06 01:06 UTC | `feat(star-momentum-alert): project next milestone crossing date for show-hn-draft dispatch timing` |

### Headline — defense-in-depth migration is in motion

Yesterday's recommendation #4 was: *"Consider a defense-in-depth `execFileSync` migration for the 8 remaining template-string `execSync` callsites in dashboard routes, even where current callers are safe — pre-empts future regressions during refactors."* PR #158 lands exactly that for the highest-risk remaining route.

`dashboard/app/api/skills/[name]/run/route.ts` now reads:

```ts
import { execFileSync } from 'child_process'
...
// Line 15 — input validation
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 })
}
// Lines 25-29 — sanitize var/model
if (body.var && typeof body.var === 'string') {
  skillVar = body.var.replace(/[^a-zA-Z0-9_ .\-/#@]/g, '')
}
if (body.model && typeof body.model === 'string') {
  model = body.model.replace(/[^a-zA-Z0-9_\-]/g, '')
}
// Lines 32-36 — argv-array invocation
const args = ['workflow', 'run', 'aeon.yml', '-f', `skill=${name}`]
if (skillVar) args.push('-f', `var=${skillVar}`)
if (model) args.push('-f', `model=${model}`)
execFileSync('gh', args, { stdio: 'pipe', cwd: REPO_ROOT })
```

Three-layer defense: name regex, body sanitization, argv-array. Same pattern as the 05-03 `secrets/route.ts` fix. This is a meaningful 24-hour delta — for 12 days a single template-string handler haunted the dashboard tree; in 72 hours the two routes that actually exec'd user-shaped input are both hardened.

### Re-verify the 05-03 fix is still in place

`dashboard/app/api/secrets/route.ts` lines 96, 119:

```ts
execFileSync('gh', ['secret', 'set', name, '-b', value], {
  stdio: 'pipe', cwd: process.cwd(),
})
execFileSync('gh', ['secret', 'delete', name], { stdio: 'pipe', cwd: process.cwd() })
```

Argv-array form holds. `VALID_SECRET_NAME = /^[A-Z][A-Z0-9_]{1,}$/` validates names. Both hardened routes follow the same template now.

### Remaining template-string `execSync` callsites — one with user-controlled input, but mitigated

Re-classified after PR #158:

| Route | Form | User input reaches shell? | Status |
|-------|------|---------------------------|--------|
| `secrets/route.ts:96,119` | `execFileSync('gh', [...args])` | n/a | hardened 05-03 |
| `skills/[name]/run/route.ts:36` | `execFileSync('gh', [...args])` | n/a | **hardened 05-06** |
| `runs/[id]/logs/route.ts:20,32` | `execSync(\`gh run view ${id} ...\`)` | YES — `id` interpolated, but **gated by `/^\d+$/.test(id)`** | safe (digits-only) |
| `auth/route.ts:46,84` | `execSync(\`gh secret set ${secretName}\`)` | NO — `secretName` is one of two literal strings | safe |
| `runs/route.ts:9` | `execSync('gh run list ...')` | NO — literal | safe |
| `analytics/route.ts:38` | `execSync('gh run list ...')` | NO — literal | safe |
| `outputs/route.ts:46` | `execSync(cmd)` (caller-passed) | NO — only literal callers | safe |
| `sync/route.ts:8` | `execSync(cmd)` (caller-passed) | NO — only literal callers | safe |
| `skills/route.ts:17` | `execSync('git remote get-url origin')` | NO — literal | safe |

The remaining "true template-string with user input" surface is `runs/[id]/logs/route.ts` — but `id` is gated by `/^\d+$/`. A digits-only field cannot inject a shell metacharacter. Defense-in-depth migration would still tighten it, lower priority than the two completed.

### Concerns

**1. Regression test for `secrets/route.ts` and now `skills/[name]/run/route.ts` — STILL NOT IN. Day-4 carry.**

`find dashboard -name "*.test.*"` returns zero results — the dashboard tree has zero test surface. Two hardened routes now ride entirely on code review. If the dashboard is going to keep accumulating shell-touching routes (the #158 pattern matches #150 from 05-03, suggesting more route hardenings will follow), the absence of even a smoke test is the binding bottleneck. **~30 lines of Vitest, single file, covers both routes.**

**2. TODOs — 1 real (Day-8 carry).**

`skills/workflow-security-audit/SKILL.md:36` — `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` Current version: `1.24.1` (line 29). Day-8 carry. Zero `TODO|FIXME|HACK|XXX` in any `.ts/.tsx/.js/.py/.rs` file in the repo.

**3. Sandbox-required scripts — one new gap on the books, three carries unchanged.**

`prefetch-xai.sh` cases verified: `refresh-x`, `remix-tweets`, `tweet-roundup`, `narrative-tracker`, `article`, `fetch-tweets`, `vercel-projects`. **`reply-maker)` case STILL MISSING — Day-12 carry on ISS-014.** PR #156 is open, last updated 2026-05-03 17:31 UTC (no movement in 65 hours).

```
Missing: postprocess-notify.sh, prefetch-vuln-scanner.sh (ISS-001),
         prefetch-reddit.sh (ISS-002 / ISS-012), reply-maker case in prefetch-xai.sh (ISS-014)
```

**4. Tests — unchanged.** 2 test files total: `examples/mcp/test_connection.py`, `skills/skill-health/tests/smoke.sh`. Zero unit/integration tests in `dashboard/`, `a2a-server/`, or `web/`.

**5. Files >500 lines — 1 file unchanged.** `a2a-server/src/index.ts` (578 lines).

**6. No `npm audit` / `pip-audit` / `cargo audit` step in any workflow — unchanged.**

### Recommendations

1. **Add the regression test for `dashboard/app/api/secrets/route.ts` AND `dashboard/app/api/skills/[name]/run/route.ts`** — Day-4 carry, now covers two hardened routes. The argument got stronger overnight, not weaker. ~30-line Vitest file.
2. **Land the `reply-maker)` case in `scripts/prefetch-xai.sh`** — ISS-014 Day-12 carry. PR #156 has had zero movement in 65 hours. Either rebase or close as wontfix and document why.
3. **Bump ZIZMOR_VERSION** in `skills/workflow-security-audit/SKILL.md:36`. Day-8 carry. Verify latest stable, edit one line, run the audit.
4. **Migrate `runs/[id]/logs/route.ts:20,32` to `execFileSync`** — last template-string with user-controlled input remaining (digit-only id, mitigated but not eliminated). Now the cleanest defense-in-depth target.

## Cross-repo summary

| Signal | swarm-fund-mvp | lore-financial-teaser | aeon |
|--------|----------------|----------------------|------|
| Real TODOs (excl. docs) | 74 (mostly TASK-tagged scaffolding) | 0 | 1 (ZIZMOR_VERSION Day-8 carry) |
| Tracked secrets / keys | 0 (1 partial fingerprint Day-4 carry) | **1 `.env` Day-5 carry** | 0 |
| `execSync(template-string)` exploit surface | none | n/a | none with user input (1 remaining is digit-only-gated) |
| Files >500 lines | ~24 author + 9 vendored kraken-cli (stable) | 6 author + 1 shadcn-ui (stable) | 1 (`a2a-server/src/index.ts` 578) |
| Test files | 144 (likely re-count vs yesterday) | 1 (Vitest) | 2 |
| CI dep audit step | none | none | none |
| Code commits in last 24h | 0 (~30 metric-refreshes only) | 0 | **2** (#158 hardening, #159 feat) |

### What changed in 24 hours

The defense-in-depth `execFileSync` migration is in motion on `aaronjmars/aeon`. PR #158 hardened the second-most-exploitable route in the dashboard tree (the first was hardened on 05-03). This is the first time in the report's run that a recommendation from the prior day landed within 24 hours. The carry-ledger items did not move — but the security-side recommendation did. **Worth flagging the asymmetry: aeon ships, swarm-fund-mvp and lore-financial-teaser carry.**

### What's stuck (carry-over ledger, by age)

| Item | Repo | Age | Effort |
|------|------|-----|--------|
| ISS-014 `reply-maker)` case in `prefetch-xai.sh` (PR #156 idle 65h) | aeon | **Day-12** | PR #156 merge or close-and-rewrite |
| ZIZMOR_VERSION bump in `workflow-security-audit/SKILL.md:36` | aeon | Day-8 | 1-line edit + tag check |
| `lore-financial-teaser` `.env` tracked | lore-teaser | Day-5 | 3 commands |
| swarm-fund-mvp Pyth/Birdeye 3 unverified feed IDs | swarm-fund | Day-5 | ~20-line cross-check |
| swarm-fund-mvp 4 unverified RSS feed URLs in `harvest_blogs.py` | swarm-fund | Day-4 | API ping |
| `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint | swarm-fund | Day-4 | 1-line edit |
| Regression test for `aeon/dashboard/app/api/secrets/route.ts` (now also covers #158 fix) | aeon | Day-4 | ~30-line Vitest file |

Carry-ledger now has 7 items aged 4 to 12 days. Each is <30 minutes. Six of seven were on the ledger yesterday with the same age increments (Day-4 → Day-5 etc.) and zero have moved. The right read remains: surface the carry ledger as a single operator-grade ticket rather than continuing to re-list across daily reports.

### Next-priority fixes across all three repos

1. **Verify `swarm-fund-mvp` Pyth/Birdeye feed IDs** — gates trading decisions in CalibrationGap-adjacent ingestion. **Day-5 carry**. Top priority by blast radius.
2. **Add regression test for `aeon/dashboard/app/api/secrets/route.ts` and `skills/[name]/run/route.ts`** — locks in *two* hardened routes. Day-4 carry, ~30-line diff. Argument has gained a route in 24 hours.
3. **Untrack `lore-financial-teaser` `.env`** — Day-5 carry, 5-minute fix.
4. **Land or close `reply-maker)` case in `aeon/scripts/prefetch-xai.sh`** — ISS-014 Day-12 carry, PR #156 idle 65h.

## Summary

- Three watched repos audited. **One real change in 24h that matters:** PR #158 merged on `aaronjmars/aeon` at 01:02 UTC, converting `dashboard/app/api/skills/[name]/run/route.ts` to `execFileSync` argv-array form with three-layer input validation. Yesterday's recommendation #4 actioned in 24 hours.
- `swarm-fund-mvp` HEAD `9559b68` — pure data-pipeline window, ~30 metric-refresh commits, **0 code commits since 2026-05-05 17:00 UTC**. Pyth/Birdeye 3 unverified feed IDs → **Day-5 carry**, gates CalibrationGap-adjacent ingestion.
- `lore-financial-teaser` HEAD `031ce8e` — **3rd consecutive day frozen**. `.env` STILL tracked → **Day-5 carry on a 5-minute fix.**
- `aaronjmars/aeon` HEAD `1e167cf` — 2 merges (#158 hardening, #159 feat). With #158 + #150 (05-03), the two routes that actually exec'd user-shaped input are both `execFileSync` hardened. Last template-string with user input: `runs/[id]/logs/route.ts` (digit-only-gated, mitigated). Regression test → **Day-4 carry**, now covers two hardened routes. ZIZMOR_VERSION → Day-8. PR #156 → Day-12 idle 65h.
- The asymmetry of the day: `aeon` shipped a security recommendation in 24h. `swarm-fund-mvp` and `lore-financial-teaser` carried every item another day.
- Top action: verify swarm-fund-mvp Pyth/Birdeye feed IDs (Day-5 carry, highest blast radius). Then land the dashboard regression test that now covers two hardened routes.

# Code Health Report — 2026-05-08

Three watched repos audited. **The two real changes that matter:** (1) `aaronjmars/aeon` finally merged PR #156 at 2026-05-08 01:18 UTC — the reply-maker XAI prefetch case + cache-read path that had been idle 95+ hours yesterday and was the **Day-13 ISS-014 carry**. The merge closes ISS-014. Same repo also merged PR #162 (`huggingface-trending` skill) at 13:26 UTC, lifting the skill count 112 → 113. (2) `tomscaria/swarm-fund-mvp` went silent for 24 hours after Tuesday's 9-commit ADR-095 burst — only `data: refresh site metrics` commits since `a65e936` (2026-05-07 09:34 -0500). Open PRs stayed at four; no new ADR opened; the 72h merge-cadence test from yesterday's repo-article (whether new ADR by 05-09 or PRs #30/#31 stall) is at Day-2-of-3 with stall winning so far.

| Repo | HEAD | Last code commit | Δ since 2026-05-07 |
|------|------|------------------|--------------------|
| `tomscaria/swarm-fund-mvp` | `d9c8c84` | 2026-05-07 09:34 -0500 — `feat(site): add skill chips to founder section ...` | **0 code commits** + ~95 metric refreshes; 4 PRs open (unchanged) |
| `tomscaria/lore-financial-teaser` | `031ce8e` | 2026-05-03 16:20 -0500 — `test: replace placeholder...` | 0 commits (now **5 days frozen**) |
| `aaronjmars/aeon` | `9c36154` | 2026-05-08 09:26 -0400 — `feat: add huggingface-trending skill (#162)` | **2 PR merges (#156 + #162)**; 0 open PRs |

## tomscaria/swarm-fund-mvp

The 9-commit Tuesday-evening burst (covered in 2026-05-07's report) is the last code activity. From `a65e936` 2026-05-07 09:34 -0500 onward, every commit on `main` is `data: refresh site metrics` (~95 of them in the past 24 hours, every ~15 min, the 15-min scan-loop driving it).

The PR queue did not move:

| PR | Created | Updated | Title |
|----|---------|---------|-------|
| #29 | 2026-05-04 | 2026-05-04 | `eval: Phase B one-shot eval 2026-05-04 (HL 403 — remote IP block)` |
| #30 | 2026-05-04 | 2026-05-05 | `fix(variant_bandit): fall back past corrupt tail in latest_snapshot_date` |
| #31 | 2026-05-05 | 2026-05-06 | `fix(aeon_adapter): clear _last_error after successful poll` |
| #32 | 2026-05-06 | 2026-05-07 | `fix(aeon_adapter): treat null signals/markets like missing keys` |

PR #32 last touched yesterday. PR #31 last touched 2026-05-06. PR #30 last touched 2026-05-05 — now **3 days idle**. PR #29 — 4 days idle. **Yesterday's repo-article ("Eight of Eleven PRs ... Are the Same Class of Bug") posed a 72h falsifier: new ADR opened by 2026-05-09 OR queue stagnates. Stall is winning at Day-2-of-3.** The two-track read from yesterday holds: cost-side ADRs commit straight to `main`, strategy-side fixes accumulate on PR side awaiting review.

### TODOs (74 occurrences across 31 files — byte-identical to 2026-05-06 / 2026-05-07, now **third day unchanged**)

Same 35 + 21 + 18 bucket structure (Rust scaffolding + strategy enrichment triplet + Mirofish/surface/event-mapper/blog-harvester). **Pyth/Birdeye three `TODO: verify` hardcoded feed IDs unchanged for the seventh consecutive day:**
- `pipeline/ingestion/pyth_ws.py:36` — XRP/USD Pyth feed ID `ec5d399b3b...` (unverified). **Day-7.**
- `pipeline/ingestion/birdeye_rest.py:36` — Backed bIB01 mint `9n4nbM75...` (unverified). **Day-7.**
- `pipeline/ingestion/birdeye_rest.py:37` — Dinari dSPY mint `FtgGSFAD...` (unverified). **Day-7.**

**Highest-blast-radius carry-ledger item across all three repos.** The 4 `harvest_blogs.py:54-63` unverified RSS URLs also unchanged (Day-6 carry).

### Concerns

**1. Test surface — 144 → 144 files (third consecutive day unchanged).** `test_llm_client.py` 913 lines / `test_llm_router.py` 151 lines / `test_variant_bandit.py` 945 lines all byte-identical to yesterday.

**2. Files >500 lines — fully unchanged (third consecutive day).**

| File | Lines | Δ vs 2026-05-07 |
|------|-------|------------------|
| `python/api/server.py` | 3029 | unchanged (Week-3 standing split rec) |
| `python/main.py` | 1884 | unchanged |
| `python/alerting/telegram.py` | 1660 | unchanged |
| `swarm-lab-site/src/content/copy.tsx` | 1646 | unchanged |
| `tests/test_strategies.py` | 1540 | unchanged |
| `python/agents/runner_swarm.py` | 1504 | unchanged |
| `python/tests/test_variant_bandit.py` | 945 | unchanged |
| `python/agents/strategy_registry.py` | 939 | unchanged |
| `python/tests/test_llm_client.py` | 913 | unchanged |
| `python/signal/variant_bandit.py` | 799 | unchanged |

`server.py` 3029 — split-by-route-group recommendation now Week-3 standing.

**3. Hardcoded secrets — partial fingerprint Day-6 carry.**

`outputs/manual_tasks_thomas.md:276` Anthropic key partial fingerprint (`sk-ant-api03-fpl...1wAA`) byte-identical for the sixth consecutive day. **Day-6.** Still a 1-line `[redacted]` edit.

**4. tomscaria/aeon `outputs/` directory — STILL 404.** ADR-093 falsifier clock at **Day-5**, **9 days remaining** of the ~14-day window in MEMORY (~05-17). `gh api repos/tomscaria/aeon/contents/outputs` returns `{"message":"Not Found", ... "status":"404"}` again today. The new aeon_adapter null-handling tests in PR #32 still test against a contract that has no producer.

**5. ADR-095 `OLLAMA_FULL=1` falsifier — Day-1.** MEMORY's separate falsifier (`OLLAMA_FULL=1` not in production env files by 2026-05-21) is at **13 days remaining**. Not directly auditable from a depth-1 clone of `swarm-fund-mvp` alone — the production env files live on operator-side infra. Surface to next `self-improve`.

### Recommendations

1. **Verify the three `TODO: verify` hardcoded feed IDs** in `pyth_ws.py:36` and `birdeye_rest.py:36-37`. **Day-7 carry**. Top blast radius across all three repos. CalibrationGap-adjacent ingestion gates trading decisions.
2. **Open ADR-096 for the resolution-text-ingest upgrade** — yesterday's MEMORY-correction recommendation still standing. Highest-leverage CalibrationGap upgrade with no open ADR slot. Iran-airspace 48pp clause-text divergence resolved at midnight ET tonight; today's daily article framed it as the recurring evidence point.
3. **Move `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint** to `[redacted]` notation. Day-6 carry. 1-line edit.
4. **Verify the 4 `harvest_blogs.py:54-63` RSS feed URLs.** Day-6 carry. API ping per URL.
5. **Ship the `tomscaria/aeon` `outputs/{skill}/{date}.json` JSON contract before 05-17.** Falsifier clock running, **9 days remaining**.
6. Standing: extract strategy-stub triplet, plan `server.py` route-group split, gitignore `config/revenant_proposals.yaml`.

## tomscaria/lore-financial-teaser

HEAD `031ce8e` — **unchanged**. **Five days post-cleanup-burst, zero commits.**

### TODOs

Still zero `TODO|FIXME|HACK|XXX` in source tree (`src/**/*.{ts,tsx}` clean). Two SVG-internal matches in `src/assets/logos/logos_all.svg` (vendored asset markup, not code).

### Concerns

**1. `.env` STILL TRACKED — Day-7 carry-over.**

`git ls-files | grep -E '\.env'` confirms both `.env` and `.env.example` remain tracked. Full `.env` content byte-identical to 2026-05-02:

```
VITE_SUPABASE_PROJECT_ID="hhacnvwqrckfeyhdlzab"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ...zVLFfIs5klr8OyS_Lah88Ul9mMwSJ29pJkm5yuxRUHs"
VITE_SUPABASE_URL="https://hhacnvwqrckfeyhdlzab.supabase.co"
```

Severity stays low in practice (`VITE_*` values are bundle-baked anyway, JWT is the public anon role with `exp: 2036-02`) but Day-7 carry on a 5-minute fix is a stuck-queue signal at this point. Carry has now outlived three pitch-iteration cycles.

**2. Test coverage — 1 file, 4 assertions.** Unchanged from 2026-05-03. Smoke test for the Supabase waitlist boundary still recommended; no Vitest additions in five days.

**3. Files >500 lines — unchanged structure (sixth consecutive day).**

| File | Lines | Δ vs 2026-05-07 |
|------|-------|------------------|
| `src/components/sections/HowItWorksSection.tsx` | 1553 | unchanged |
| `src/components/sections/PartnerModelsSection.tsx` | 1359 | unchanged |
| `src/components/sections/ETFEvolutionSlides.tsx` | 1054 | unchanged |
| `src/components/ui/sidebar.tsx` | 637 | unchanged |
| `src/components/sections/CountryOpportunityModule.tsx` | 601 | unchanged |
| `src/components/FloatingPitchProgressHUD.tsx` | 529 | unchanged |

### Recommendations

1. **Untrack `.env`** — `git rm --cached .env`, rename to `.env.local`, fix `.env.example` key naming. **Day-7 carry on a 5-minute fix.**
2. **Add a Vitest case for the Supabase waitlist boundary** — the only true integration surface in the repo, still uncovered.
3. After the 2026-05-03 lazy-load patch, run `vite-bundle-visualizer` once to confirm lazy-loaded chunks are below-the-fold and not hitting LCP.

## aaronjmars/aeon

HEAD `9c36154`. **Two PR merges since yesterday's audit:**

| PR | SHA | Merged | Adds | Title |
|----|-----|--------|------|-------|
| #156 | `795a5a1` | 2026-05-08 01:18 UTC | +33 / −2 (2 files) | `fix(reply-maker): wire XAI prefetch case + cache-read path` |
| #162 | `9c36154` | 2026-05-08 13:26 UTC | +196 / −3 (5 files) | `feat: add huggingface-trending skill — curated trending HF artifacts` |

### PR #156 finally landed — ISS-014 closes (Day-14 → CLOSED)

`scripts/prefetch-xai.sh:145-164` now contains the `reply-maker)` case. Three-mode dispatch: numeric `$VAR` → X list ID; `@`-prefixed → handle; otherwise topic. Plus the `if [ -z "$VAR" ]; then ... exit 0` short-circuit so the skill falls back to memory logs + WebSearch when no var is set. **The Day-13 carry on the longest-aged ledger item — yesterday at ~95 hours idle — closed at the seventh hour of today.** ISS-014 should be moved from `open` to `resolved` in `memory/issues/INDEX.md`; root cause = sandbox-limitation, fix PR = #156, fix shape = prefetch-cache pattern (same template as the other XAI cases).

### PR #162 — `huggingface-trending` skill added

New `skills/huggingface-trending/SKILL.md` (179 lines), registered in `aeon.yml` after `github-releases`, slot `30 9 * * *`, `enabled: false`, `model: claude-sonnet-4-6`. Mirrors `github-trending`'s 9-step contract on the artifact layer (HF Hub `/api/{models,datasets,spaces}?sort=trendingScore`, keyless), six noise filters, mandatory ≤18-word "why notable" per pick, momentum tags, five-bucket clustering, single Top pick. Skills count: **112 → 113**. README cluster row updated 17 → 18 in research category. Pure prompt / Markdown — no helper scripts, no new env vars. Cost-discipline-clean (sonnet-4-6, not opus-4-7).

### Re-verify the 05-06 #158 + 05-03 #150 hardening still in place

`dashboard/app/api/skills/[name]/run/route.ts` lines 15, 25–28, 32–36 — **unchanged**. Three-layer defense holds (name regex `/^[a-z][a-z0-9-]*$/`, body sanitization on `var`/`model`, argv-array `execFileSync('gh', args, ...)`). `dashboard/app/api/secrets/route.ts:96,119` — `execFileSync('gh', ['secret', 'set'|'delete', name, ...])` argv-array form unchanged. Both routes still ride entirely on code review — see Concern #1 below.

### Remaining template-string `execSync` callsites — unchanged classification

| Route | Form | User input reaches shell? | Status |
|-------|------|---------------------------|--------|
| `secrets/route.ts:96,119` | `execFileSync('gh', [...args])` | n/a | hardened 05-03 |
| `skills/[name]/run/route.ts:36` | `execFileSync('gh', [...args])` | n/a | hardened 05-06 |
| `runs/[id]/logs/route.ts:20,32` | `execSync(\`gh run view ${id} ...\`)` | YES — `id` interpolated, gated by `/^\d+$/.test(id)` | safe (digits-only) |
| `auth/route.ts:46,84` | `execSync(\`gh secret set ${secretName}\`)` | NO — `secretName` ∈ {two literals} | safe |
| `runs/route.ts`, `analytics/route.ts`, `outputs/route.ts`, `sync/route.ts`, `skills/route.ts` | various `execSync(literal)` | NO | safe |

`runs/[id]/logs/route.ts:20,32` remains the last template-string with user-controlled input — digit-only-gated, mitigated. Cleanest defense-in-depth target.

### Concerns

**1. Regression test for `secrets/route.ts` and `skills/[name]/run/route.ts` — STILL NOT IN. Day-6 carry.**

`find dashboard -name "*.test.*"` returns zero results — the dashboard tree has zero test surface. PR #162 added a SKILL.md but no test infrastructure. PR #156 added a prefetch case but no test infrastructure. **Two hardened routes still ride entirely on code review.** ~30 lines of Vitest, single file, covers both routes.

**2. TODOs — 1 real (Day-10 carry).**

`skills/workflow-security-audit/SKILL.md:36` — `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` Current version: `1.24.1` (line 29). **Day-10 carry — into double digits today.** Zero `TODO|FIXME|HACK|XXX` in any `.ts/.tsx/.js/.py/.rs` author file in the repo (the only matches in `scripts/` are `mktemp ...XXXXXX` template placeholders).

**3. Sandbox-required scripts — three carries unchanged, one CLOSED.**

```
CLOSED 2026-05-08 01:18 UTC: reply-maker case in prefetch-xai.sh (PR #156, ISS-014 → resolved)

Still missing: postprocess-notify.sh, prefetch-vuln-scanner.sh (ISS-001),
               prefetch-reddit.sh (ISS-002 / ISS-012)
```

ISS-002 / ISS-012 reddit-digest carrier: today's `memory/logs/2026-05-08.md` shows a 14th consecutive `REDDIT_DIGEST_ERROR`. ISS-001 vuln-scanner carrier remains unfixed. Both are now the longest-aged sandbox-limitation carriers without a PR in flight. With ISS-014 closed today, these become the next two operator-blocking sandbox carriers — promote to top of next `self-improve`.

**4. Tests — unchanged.** 2 author test files total: `examples/mcp/test_connection.py`, `skills/skill-health/tests/smoke.sh`. Plus 2 vendored Jest test files under `tools/superpowers/tests/brainstorm-server/` (vendored asset, not author code). Zero unit/integration tests in `dashboard/`, `a2a-server/`, `mcp-server/`, or `web/`.

**5. Files >500 lines — 1 file unchanged.** `a2a-server/src/index.ts` (578 lines). The new `huggingface-trending/SKILL.md` (179 lines) is well-shaped.

**6. No `npm audit` / `pip-audit` / `cargo audit` step in any workflow — unchanged.**

### Recommendations

1. **Land the regression test for `dashboard/app/api/secrets/route.ts` AND `dashboard/app/api/skills/[name]/run/route.ts`** — Day-6 carry, locks in two hardened routes. ~30-line Vitest file. Now the highest-priority aeon item with PR #156 closed.
2. **Bump ZIZMOR_VERSION** in `skills/workflow-security-audit/SKILL.md:36`. Day-10 carry. Verify latest stable (zizmor on PyPI), edit one line, run the audit.
3. **Land `scripts/prefetch-reddit.sh`** — closes ISS-002 (vibecoding-digest) AND ISS-012 (reddit-digest) together. Reddit-digest is at 14 consecutive REDDIT_DIGEST_ERROR runs as of today's log. PR #156 prefetch-cache pattern is the in-tree template. Strong case to also pause `reddit-digest` cron until prefetch ships — 14 runs × 0 data = pure pager fatigue.
4. **Land `scripts/prefetch-vuln-scanner.sh`** — closes ISS-001. Pattern same as above.
5. **Migrate `runs/[id]/logs/route.ts:20,32` to `execFileSync`** — last template-string with user-controlled input remaining (digit-only-gated, mitigated but not eliminated). Defense-in-depth, lower priority than #1–#4.

## Cross-repo summary

| Signal | swarm-fund-mvp | lore-financial-teaser | aeon |
|--------|----------------|----------------------|------|
| Real TODOs (excl. docs) | 74 (mostly TASK-tagged scaffolding) | 0 | 1 (ZIZMOR_VERSION Day-10 carry) |
| Tracked secrets / keys | 0 (1 partial fingerprint Day-6 carry) | **1 `.env` Day-7 carry** | 0 |
| `execSync(template-string)` exploit surface | none | n/a | none with user input (1 remaining is digit-only-gated) |
| Files >500 lines | ~24 author + 9 vendored kraken-cli (stable) | 6 author + 1 shadcn-ui (stable) | 1 (`a2a-server/src/index.ts` 578) |
| Test files | 144 (third day unchanged) | 1 (Vitest, fifth day unchanged) | 2 author + 2 vendored Jest |
| CI dep audit step | none | none | none |
| Open PRs | 4 (unchanged) | 0 | **0 (was 1)** |
| Code commits in last 24h | **0** (only metric refreshes) | 0 | **2 PR merges (#156, #162)** |

### What changed in 24 hours

The framing inverted from yesterday: yesterday `swarm-fund-mvp` shipped a 9-commit ADR-095 burst direct-to-main while `aeon` shipped two repo-owner template/scaffolding PRs. Today `swarm-fund-mvp` is silent — only 15-minute metric-refresh commits — while `aeon` shipped two **substantive** merges: the long-stalled PR #156 (closes ISS-014 / Day-13 carry) and a new artifact-layer skill (huggingface-trending). The week's two-track shape — fast-twitch infra, slow-PR-review correctness — held; today both cadences slowed simultaneously on swarm-fund-mvp.

`aeon`'s Friday: PR #156's seven-day idle window finally cleared; a fresh `feat:` skill landed within 12 hours of that. Net: aeon is **healthier as of this audit** than yesterday on the carry-ledger axis. swarm-fund-mvp accumulated zero new fixes against PRs #29/#30/#31/#32; the 72h cadence test from yesterday's article tilts toward queue-stagnation read at Day-2-of-3.

### What's stuck (carry-over ledger, by age)

| Item | Repo | Age | Effort | Δ |
|------|------|-----|--------|---|
| ZIZMOR_VERSION bump in `workflow-security-audit/SKILL.md:36` | aeon | **Day-10** | 1-line edit + tag check | — |
| swarm-fund-mvp Pyth/Birdeye 3 unverified feed IDs | swarm-fund | **Day-7** | ~20-line cross-check | — |
| `lore-financial-teaser` `.env` tracked | lore-teaser | **Day-7** | 3 commands | — |
| swarm-fund-mvp 4 unverified RSS feed URLs in `harvest_blogs.py` | swarm-fund | Day-6 | API ping | — |
| `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint | swarm-fund | Day-6 | 1-line edit | — |
| Regression test for aeon dashboard hardened routes | aeon | Day-6 | ~30-line Vitest file | — |
| `tomscaria/aeon outputs/` JSON contract for ADR-093 | swarm-fund/aeon | Day-5 | falsifier clock 9 days remaining | — |
| ~~ISS-014 `reply-maker)` case in `prefetch-xai.sh` (PR #156)~~ | ~~aeon~~ | ~~Day-14~~ | **CLOSED 2026-05-08 01:18 UTC** | **−1** |

**Carry ledger has 7 items aged 5 to 10 days (was 8 yesterday). One closed: ISS-014.** Each remaining item is <2 hours of work. Six of seven were on yesterday's ledger with the same age increments (Day-5 → Day-6 etc.) and zero of those have moved. **The right read remains: surface the carry ledger as a single operator-grade ticket rather than continuing to re-list across daily reports — but PR #156 closing tonight after 13 days idle is a useful counter-data-point that the ledger does eventually drain.**

### Next-priority fixes across all three repos

1. **Verify `swarm-fund-mvp` Pyth/Birdeye feed IDs** — gates trading decisions in CalibrationGap-adjacent ingestion. **Day-7 carry**. Top priority by blast radius.
2. **Add regression test for `aeon/dashboard/app/api/secrets/route.ts` and `skills/[name]/run/route.ts`** — locks in two hardened routes. Day-6 carry, ~30-line diff. Now the cleanest aeon-side ticket with PR #156 closed.
3. **Open ADR-096 for resolution-text-ingest** — and correct MEMORY's ADR-095 attribution (still wrong as of this morning's read). Highest-leverage CalibrationGap upgrade with no open ADR. Iran-airspace 48pp clause-text divergence resolves tonight; today's daily article re-anchored the empirical case.
4. **Untrack `lore-financial-teaser` `.env`** — Day-7 carry, 5-minute fix.
5. **Land `scripts/prefetch-reddit.sh` and `scripts/prefetch-vuln-scanner.sh`** — closes ISS-001 + ISS-002 + ISS-012. With ISS-014 resolved tonight, these are the next two operator-blocking sandbox carriers. PR #156 is the in-tree template.
6. **Ship `tomscaria/aeon outputs/{skill}/{date}.json` JSON contract** before 05-17 falsifier deadline — **9 days remaining**.
7. **Bump ZIZMOR_VERSION** — Day-10 carry on a 1-line edit.

## Summary

- Three watched repos audited. **Two real changes in 24h that matter:** (1) `aaronjmars/aeon` PR #156 (`fix(reply-maker): wire XAI prefetch case`) merged 2026-05-08 01:18 UTC after 13 days idle — **ISS-014 closes**, longest-aged carry ledger item drained. (2) Same repo PR #162 merged 13:26 UTC — `huggingface-trending` skill (artifact-layer companion to `github-trending` and `paper-pick`, sonnet-4-6, schedule `30 9 * * *`, `enabled: false`); skills count 112 → 113.
- `swarm-fund-mvp` HEAD `d9c8c84`. **Zero code commits in 24h** since `a65e936` (last code commit yesterday 09:34 -0500) — only ~95 `data: refresh site metrics` commits. Open PR queue unchanged at 4 (#29/#30/#31/#32). 72h merge-cadence test from yesterday's article tilts to queue-stagnation read at Day-2-of-3 (no new ADR opened, oldest PR now 4 days idle). Pyth/Birdeye 3 unverified feed IDs **→ Day-7 carry**, top blast radius. Manual_tasks Anthropic fingerprint → Day-6. RSS verify → Day-6.
- `lore-financial-teaser` HEAD `031ce8e` — **5th consecutive day frozen**. `.env` STILL tracked → **Day-7 carry on a 5-minute fix**.
- `aaronjmars/aeon` HEAD `9c36154` — 2 PR merges (#156 + #162). Open PRs 1 → **0**. Hardening from #150 + #158 still in place. Last template-string with user input still `runs/[id]/logs/route.ts` (digit-only-gated). Regression test → Day-6 carry. ZIZMOR_VERSION → **Day-10 carry (into double digits)**. Reply-maker case **CLOSED today (PR #156, Day-13 → resolved)**.
- `tomscaria/aeon outputs/` directory **STILL 404** — ADR-093 falsifier clock at Day-5, **9 days remaining**. The new aeon_adapter null-handling tests in PR #32 still test against a contract with no producer.
- **Carry ledger today: 7 items aged 5-10 days (was 8 yesterday, ISS-014 closed)**. Each <2 hours.
- Top action: verify swarm-fund-mvp Pyth/Birdeye feed IDs (Day-7, top blast radius). Then land aeon dashboard regression test (Day-6, cleanest aeon ticket post-#156). Then open ADR-096 for resolution-text-ingest on swarm-fund-mvp.

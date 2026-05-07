# Code Health Report — 2026-05-07

Three watched repos audited. **The two real changes that matter:** (1) `tomscaria/swarm-fund-mvp` broke its 24-hour code-freeze on 2026-05-06 21:32 UTC with a 9-commit evening burst that landed ADR-095 (`OLLAMA_FULL=1` cost-side routing) plus a fine-tuning pipeline + canary router + KB embedding index. (2) `aaronjmars/aeon` shipped two more merges (#160 v4-readiness checklist, #161 skill template library) and pushed the dashboard tree to 1163 total non-vendored TS/TSX/PY lines.

Yesterday's repo-article ("After ADR-094, swarm-fund-mvp's Whole Open Queue Is Two Single-File Fixes") posed two falsifiers: *new ADR by 05-09 OR PRs #30/#31 stall*. Both partly triggered. ADR-095 landed direct on `main` (not via PR) on 05-06 21:48 UTC — but its scope is local-LLM cost discipline, **not** the resolution-text-ingest ADR MEMORY anticipated. PRs #29/#30/#31 remain open and PR #32 was added today, taking the open-PR count from two to four. The week is **both** healthy ADR-cadence on `main` and queue stagnation on PR-side.

| Repo | HEAD | Last commit | Δ since 2026-05-06 |
|------|------|-------------|--------------------|
| `tomscaria/swarm-fund-mvp` | `6320dd8` | 2026-05-07 11:18 -0500 — `data: refresh site metrics` | **10 code commits** + ~70 metric refreshes; 4 PRs open (was 2) |
| `tomscaria/lore-financial-teaser` | `031ce8e` | 2026-05-03 16:20 -0500 — `test: replace placeholder...` | 0 commits (now 4 days frozen) |
| `aaronjmars/aeon` | `8fcf2f5` | 2026-05-07 08:11 -0400 — `feat: skill template library (#161)` | 2 PR merges (#160, #161) |

## tomscaria/swarm-fund-mvp

The 9-commit evening burst on 2026-05-06 21:32–21:56 UTC:

| SHA | Message | Files |
|-----|---------|-------|
| `42a5ba5` | `fix: route paper_triage through OLLAMA_LOCAL instead of hardcoded sonnet` | 1 |
| `99ae5e6` | `test: add tests for /router_suggestions Telegram command` | — |
| `0be0537` | `feat: verify harvest_mit_ocw.py live — Firecrawl scrape working` | — |
| `846cf44` | `feat: add run_analogy_synthesis.py Phase G runner script` | — |
| `a23f999` | `feat: build initial kb_concepts embedding index (3446 concepts)` | — |
| `80b1228` | `feat: OLLAMA_FULL=1 routes summarize/judge/generate/chat to qwen2.5:14b (ADR-095)` | 3 |
| `caaec5a` | `feat: add opt-in LLM_CALL_LOG for prompt-completion capture` | — |
| `e0ad1b5` | `feat: add export_finetune_dataset.py — 3,462 triage pairs to MLX JSONL` | — |
| `eb18354` | `feat: fine-tuning pipeline + canary router (Tasks 9-11)` | 6 |

Plus today: `a65e936` (founder-section skill chips, `swarm-lab-site/` only).

**ADR-095 scope correction.** `memory/MEMORY.md:18` calls ADR-095 the resolution-text-ingest upgrade — the "single highest-leverage CalibrationGap upgrade." `DECISIONS.md` numbers the OLLAMA_FULL=1 routing decision as ADR-095. The resolution-text-ingest ADR has not been opened. The next-available slot is now ADR-096. **MEMORY needs correction.** This matters because the resolution-text-ingest is the empirical anchor for several of yesterday's article cite-stack claims (Iran-airspace 48pp clause-text divergence, multi-handle NO cluster sizing).

**Fine-tuning pipeline lands.** `eb18354` ships `scripts/Modelfile.triage`, `convert_to_gguf.sh`, `eval_finetuned_model.py`, `finetune_triage.sh` — the swarm is fine-tuning its own local triage model on 3,462 captured triage pairs (`e0ad1b5`). This is the operational follow-on to ADR-095: cloud sonnet → qwen2.5:14b → fine-tuned local triage. Cost trajectory matches the operator's $40/wk discipline.

**`runner_swarm.py` integration of `aeon_adapter.py` still pending** (TASKS.md). ADR-093 wire-up remains aspirational on the swarm-fund side AND on the Aeon side (see falsifier below).

### TODOs (74 occurrences across 31 files — byte-identical to 2026-05-06)

Same Rust scaffolding (35) + strategy enrichment triplet (~21) + Mirofish/surface/event-mapper/blog harvester (~18) bucket structure. **Day-6 carry — three "TODO: verify" hardcoded feed IDs unchanged:**
- `pipeline/ingestion/pyth_ws.py:36` — XRP/USD Pyth feed ID `ec5d399b3b...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:36` — Backed bIB01 mint `9n4nbM75...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:37` — Dinari dSPY mint `FtgGSFAD...` (unverified).

Day-6. Highest-blast-radius carry-ledger item across all three repos. The 4 `harvest_blogs.py:54-63` unverified RSS URLs also unchanged (Day-5 carry).

### Concerns

**1. Test surface — 144 → 144 files (no change).** `test_llm_router.py` is NEW (+9 tests under ADR-095) and `test_llm_client.py` ticked from 836 → 913 lines (+77 under ADR-094 follow-on `99ae5e6`). The file count held because router tests went into `test_llm_router.py` (NEW path-of-record under ADR-094) — re-counting the post-burst tree shows the same 144 figure as yesterday.

**2. Files >500 lines — `test_llm_client.py` grew, others unchanged.**

| File | Lines | Δ vs 2026-05-06 |
|------|-------|------------------|
| `python/api/server.py` | 3029 | unchanged (Week-2 standing split rec) |
| `python/main.py` | 1884 | unchanged |
| `python/alerting/telegram.py` | 1660 | unchanged |
| `swarm-lab-site/src/content/copy.tsx` | 1646 | +15 (founder skill chips, today) |
| `tests/test_strategies.py` | 1540 | unchanged |
| `python/agents/runner_swarm.py` | 1504 | unchanged |
| `python/tests/test_variant_bandit.py` | 945 | unchanged |
| `python/agents/strategy_registry.py` | 939 | unchanged |
| `python/tests/test_llm_client.py` | 913 | **+77** (ADR-094 router-suggestion tests) |
| `python/signal/variant_bandit.py` | 799 | unchanged |

`server.py` 3029 → split-by-route-group recommendation now Week-3 standing.

**3. Hardcoded secrets — clean, partial fingerprint Day-5 carry.**

`outputs/manual_tasks_thomas.md:276` Anthropic key partial fingerprint (`sk-ant-api03-fpl...1wAA`) unchanged. Day-5. Still a 1-line `[redacted]` edit.

**4. Open PR queue — went from 2 → 4 in 24 hours.**

| PR | Created | Updated | Title |
|----|---------|---------|-------|
| #29 | 2026-05-04 | 2026-05-04 | `eval: Phase B one-shot eval 2026-05-04 (HL 403 — remote IP block)` |
| #30 | 2026-05-04 | 2026-05-05 | `fix(variant_bandit): fall back past corrupt tail in latest_snapshot_date` |
| #31 | 2026-05-05 | 2026-05-06 | `fix(aeon_adapter): clear _last_error after successful poll` |
| #32 | **2026-05-06** | 2026-05-07 | `fix(aeon_adapter): treat null signals/markets like missing keys` |

PR #32 is the third defect-hardening fix on the same `aeon_adapter.py` from ADR-093, opened 05-06 and updated today. **Net read: code is shipping direct-to-main on cost-side ADRs, while the PR queue accumulates single-file fixes against the strategy-side ADRs from last week.** Two-track shipping cadence — fast-twitch on cloud-cost / slow-PR-review on strategy correctness — is itself the signal.

**5. tomscaria/aeon `outputs/` directory — STILL 404.** ADR-093 falsifier clock at **Day-4**, **10 days remaining** of the ~14-day window in MEMORY (~05-17). If the JSON contract is not on `tomscaria/aeon` raw by then, ADR-093's wire-up stays aspirational and the new aeon_adapter unit tests test against a contract with no producer.

### Recommendations

1. **Open ADR-096 for the resolution-text-ingest upgrade** — and update MEMORY's ADR-095 reference. The "highest-leverage CalibrationGap upgrade" is now without an open ADR slot. Same week as the Iran-airspace 48pp clause-text divergence proof point. Highest-priority strategy-side action.
2. **Verify the three "TODO: verify" hardcoded feed IDs** in `pyth_ws.py:36` and `birdeye_rest.py:36-37`. **Day-6 carry**, gates CalibrationGap-adjacent ingestion. Highest-priority hardening across all three repos.
3. **Move `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint** to `[redacted]` notation. Day-5 carry.
4. **Verify the 4 `harvest_blogs.py:54-63` RSS feed URLs.** Day-5 carry.
5. **Ship the `tomscaria/aeon` `outputs/{skill}/{date}.json` JSON contract before 05-17.** Falsifier clock running, Day-4 → Day-14 in 10 days.
6. Standing: extract strategy-stub triplet, plan `server.py` route-group split, gitignore `config/revenant_proposals.yaml`.

## tomscaria/lore-financial-teaser

HEAD `031ce8e` — **unchanged**. Four days post-cleanup-burst, zero commits. Four-day freeze.

### TODOs

Still zero TODO/FIXME/HACK/XXX in source tree. Two SVG-internal matches in `src/assets/logos/logos_all.svg` (vendored asset markup, not code).

### Concerns

**1. `.env` STILL TRACKED — Day-6 carry-over.**

`git ls-files` confirms both `.env` and `.env.example` remain tracked. The full `.env` content is byte-identical to 2026-05-02:

```
VITE_SUPABASE_PROJECT_ID="hhacnvwqrckfeyhdlzab"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ...zVLFfIs5klr8OyS_Lah88Ul9mMwSJ29pJkm5yuxRUHs"
VITE_SUPABASE_URL="https://hhacnvwqrckfeyhdlzab.supabase.co"
```

Severity stays low in practice (`VITE_*` values are bundle-baked anyway, JWT is the public anon role with `exp: 2036-02`) but Day-6 carry on a 5-minute fix is a stuck-queue signal. Promote priority — the carry has now outlived two pitch-iteration cycles.

**2. Test coverage — 1 file, 4 assertions.** Unchanged from 2026-05-03. The Vitest stub gained content during the 2026-05-03 cleanup pass; no further additions. Smoke test for the Supabase waitlist boundary still recommended.

**3. Files >500 lines — unchanged structure.**

| File | Lines | Δ vs 2026-05-06 |
|------|-------|------------------|
| `src/components/sections/HowItWorksSection.tsx` | 1553 | unchanged |
| `src/components/sections/PartnerModelsSection.tsx` | 1359 | unchanged |
| `src/components/sections/ETFEvolutionSlides.tsx` | 1054 | unchanged |
| `src/components/ui/sidebar.tsx` | 637 | unchanged |
| `src/components/sections/CountryOpportunityModule.tsx` | 601 | unchanged |
| `src/components/FloatingPitchProgressHUD.tsx` | 529 | unchanged |

### Recommendations

1. **Untrack `.env`** — `git rm --cached .env`, rename to `.env.local`, fix `.env.example` key naming. **Day-6 carry on a 5-minute fix.**
2. **Add a Vitest case for the Supabase waitlist boundary** — the only true integration surface in the repo, still uncovered.
3. After the 2026-05-03 lazy-load patch, run `vite-bundle-visualizer` once to confirm lazy-loaded chunks are below-the-fold and not hitting LCP.

## aaronjmars/aeon

HEAD `8fcf2f5`. **Two PR merges since yesterday's audit**:

| PR | SHA | Merged | Title |
|----|-----|--------|-------|
| #160 | `3450b31` | 2026-05-07 12:02 UTC | `feat(v4-readiness): per-fork v4 upgrade readiness checklist` |
| #161 | `8fcf2f5` | 2026-05-07 12:11 UTC | `feat: skill template library — six starters + ./new-from-template` |

Both feat-side, both repo-owner-authored. The #160 merge resolves the auto-merge author-block flagged in MEMORY (operator added `aaronjmars` to `## Trusted Authors` to unblock).

### Re-verify the 05-06 #158 hardening is still in place

`dashboard/app/api/skills/[name]/run/route.ts` lines 15, 25–29, 32–36 — **unchanged**. Three-layer defense (name regex `/^[a-z][a-z0-9-]*$/`, body sanitization on `var`/`model`, argv-array `execFileSync('gh', args, ...)`) holds. Same template as `secrets/route.ts` 05-03 fix.

### Remaining template-string `execSync` callsites — unchanged classification

| Route | Form | User input reaches shell? | Status |
|-------|------|---------------------------|--------|
| `secrets/route.ts:96,119` | `execFileSync('gh', [...args])` | n/a | hardened 05-03 |
| `skills/[name]/run/route.ts:36` | `execFileSync('gh', [...args])` | n/a | hardened 05-06 |
| `runs/[id]/logs/route.ts:20,32` | `execSync(\`gh run view ${id} ...\`)` | YES — `id` interpolated, gated by `/^\d+$/.test(id)` | safe (digits-only) |
| `auth/route.ts:46,84` | `execSync(\`gh secret set ${secretName}\`)` | NO — `secretName` ∈ {two literals} | safe |
| `runs/route.ts`, `analytics/route.ts`, `outputs/route.ts`, `sync/route.ts`, `skills/route.ts` | various `execSync(literal)` | NO | safe |

Last template-string with user input: `runs/[id]/logs/route.ts:20,32` — digit-only-gated, mitigated. Cleanest defense-in-depth target.

### Concerns

**1. Regression test for `secrets/route.ts` and `skills/[name]/run/route.ts` — STILL NOT IN. Day-5 carry.**

`find dashboard -name "test_*.py" -o -name "*.test.*"` returns zero results — the dashboard tree has zero test surface. Two hardened routes ride entirely on code review. PR #161 added six **template** SKILL.md files but no test infrastructure. **~30 lines of Vitest, single file, covers both routes.**

**2. TODOs — 1 real (Day-9 carry).**

`skills/workflow-security-audit/SKILL.md:36` — `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` Current version: `1.24.1` (line 29). Day-9 carry. Zero `TODO|FIXME|HACK|XXX` in any `.ts/.tsx/.js/.py/.rs` file in the repo (the only matches in `scripts/` are mktemp `XXXXXX` template placeholders).

**3. Sandbox-required scripts — three carries unchanged.**

`prefetch-xai.sh` cases verified for `refresh-x`, `remix-tweets`, `tweet-roundup`, `narrative-tracker`, `article`, `fetch-tweets`, `vercel-projects`. **`reply-maker)` case STILL MISSING — Day-13 carry on ISS-014.** PR #156 created/last-updated 2026-05-03 17:31 UTC — **~95 hours since last update**, four full days idle.

```
Missing: postprocess-notify.sh, prefetch-vuln-scanner.sh (ISS-001),
         prefetch-reddit.sh (ISS-002 / ISS-012), reply-maker case in prefetch-xai.sh (ISS-014)
```

**4. Tests — unchanged.** 2 test files total: `examples/mcp/test_connection.py`, `skills/skill-health/tests/smoke.sh`. Plus 2 vendored Jest test files under `tools/superpowers/tests/brainstorm-server/` (vendored asset, not author code). Zero unit/integration tests in `dashboard/`, `a2a-server/`, or `web/`.

**5. Files >500 lines — 1 file unchanged.** `a2a-server/src/index.ts` (578 lines). The new `new-from-template` script (254 lines) and six template SKILL.mds (55–89 lines each) are well-shaped; no large additions.

**6. No `npm audit` / `pip-audit` / `cargo audit` step in any workflow — unchanged.**

### Recommendations

1. **Add the regression test for `dashboard/app/api/secrets/route.ts` AND `dashboard/app/api/skills/[name]/run/route.ts`** — Day-5 carry, locks in two hardened routes. ~30-line Vitest file.
2. **Land or close the `reply-maker)` case in `aeon/scripts/prefetch-xai.sh`** — ISS-014 Day-13 carry. PR #156 idle 95h. Either rebase or close as wontfix and document why.
3. **Bump ZIZMOR_VERSION** in `skills/workflow-security-audit/SKILL.md:36`. Day-9 carry. Verify latest stable, edit one line, run the audit.
4. **Migrate `runs/[id]/logs/route.ts:20,32` to `execFileSync`** — last template-string with user-controlled input remaining (digit-only-gated, mitigated but not eliminated). Defense-in-depth, lower priority than #1–#3.

## Cross-repo summary

| Signal | swarm-fund-mvp | lore-financial-teaser | aeon |
|--------|----------------|----------------------|------|
| Real TODOs (excl. docs) | 74 (mostly TASK-tagged scaffolding) | 0 | 1 (ZIZMOR_VERSION Day-9 carry) |
| Tracked secrets / keys | 0 (1 partial fingerprint Day-5 carry) | **1 `.env` Day-6 carry** | 0 |
| `execSync(template-string)` exploit surface | none | n/a | none with user input (1 remaining is digit-only-gated) |
| Files >500 lines | ~24 author + 9 vendored kraken-cli (stable) | 6 author + 1 shadcn-ui (stable) | 1 (`a2a-server/src/index.ts` 578) |
| Test files | 144 (unchanged; +1 router test offset by counting method) | 1 (Vitest) | 2 author + 2 vendored Jest |
| CI dep audit step | none | none | none |
| Open PRs | **4 (was 2)** | 0 | 1 (#156, idle 95h) |
| Code commits in last 24h | **10** (9 evening burst + 1 today) | 0 | 2 PR merges (#160, #161) |

### What changed in 24 hours

The week-of-defect-hardening framing inverted: swarm-fund-mvp shipped a fresh ADR (cost-side ADR-095) plus the fine-tuning pipeline that operationalizes it, all direct on `main`. The PR queue did **not** drain — it grew from 2 to 4. So the right read is two-track: cost/infra ADRs commit straight to `main`; strategy-correctness fixes accumulate as PRs awaiting review.

Aeon's Wednesday: two repo-owner feat-merges, both skill-template / fork-readiness scaffolding. No new dashboard code. No regression tests. No `prefetch-reddit.sh` / `prefetch-vuln-scanner.sh` carriers landing. PR #156 sat idle through three more workdays.

### What's stuck (carry-over ledger, by age)

| Item | Repo | Age | Effort |
|------|------|-----|--------|
| ISS-014 `reply-maker)` case in `prefetch-xai.sh` (PR #156 idle 95h) | aeon | **Day-13** | PR #156 merge or close-and-rewrite |
| ZIZMOR_VERSION bump in `workflow-security-audit/SKILL.md:36` | aeon | Day-9 | 1-line edit + tag check |
| swarm-fund-mvp Pyth/Birdeye 3 unverified feed IDs | swarm-fund | **Day-6** | ~20-line cross-check |
| `lore-financial-teaser` `.env` tracked | lore-teaser | **Day-6** | 3 commands |
| swarm-fund-mvp 4 unverified RSS feed URLs in `harvest_blogs.py` | swarm-fund | Day-5 | API ping |
| `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint | swarm-fund | Day-5 | 1-line edit |
| Regression test for aeon dashboard hardened routes | aeon | Day-5 | ~30-line Vitest file |
| **NEW**: `tomscaria/aeon outputs/` JSON contract for ADR-093 | swarm-fund/aeon | Day-4 | falsifier clock 10 days remaining |

Carry ledger has 8 items aged 4 to 13 days. Each is <2 hours. Seven of eight were on the ledger yesterday with the same age increments (Day-4 → Day-5 etc.) and zero have moved. **A new entry was added today (the falsifier clock for ADR-093 wire-up).** The right read remains: surface the carry ledger as a single operator-grade ticket rather than continuing to re-list across daily reports.

### Next-priority fixes across all three repos

1. **Verify `swarm-fund-mvp` Pyth/Birdeye feed IDs** — gates trading decisions in CalibrationGap-adjacent ingestion. **Day-6 carry**. Top priority by blast radius.
2. **Open ADR-096 for resolution-text-ingest** — and correct MEMORY's ADR-095 attribution. ADR-095 slot got used by OLLAMA_FULL=1, leaving the highest-leverage CalibrationGap upgrade without an open ADR. Same week as the Iran-airspace 48pp clause-text divergence article.
3. **Add regression test for `aeon/dashboard/app/api/secrets/route.ts` and `skills/[name]/run/route.ts`** — locks in two hardened routes. Day-5 carry, ~30-line diff.
4. **Untrack `lore-financial-teaser` `.env`** — Day-6 carry, 5-minute fix.
5. **Land or close `reply-maker)` case in `aeon/scripts/prefetch-xai.sh`** — ISS-014 Day-13 carry, PR #156 idle 95h.
6. **Ship `tomscaria/aeon outputs/{skill}/{date}.json` JSON contract** before 05-17 falsifier deadline — 10 days remaining.

## Summary

- Three watched repos audited. **Two real changes in 24h that matter:** (1) `swarm-fund-mvp` broke its 24h freeze with a 9-commit evening burst on 2026-05-06 21:32–21:56 UTC — ADR-095 (`OLLAMA_FULL=1` → qwen2.5:14b) + fine-tuning pipeline + canary router + KB embedding index. (2) `aaronjmars/aeon` shipped #160 (v4-readiness checklist) and #161 (skill template library, six starters).
- **MEMORY correction needed:** `MEMORY.md:18` calls ADR-095 the resolution-text-ingest upgrade, but `DECISIONS.md` ADR-095 is the OLLAMA_FULL=1 cost routing. Resolution-text-ingest has no open ADR slot — should open ADR-096.
- `swarm-fund-mvp` HEAD `6320dd8`. Open PRs went 2 → 4 (PR #32 added today, third defect-hardening fix on `aeon_adapter.py`). **Two-track cadence: cost/infra ADRs direct-to-main, strategy fixes accumulate on PR side.** Pyth/Birdeye 3 unverified feed IDs → **Day-6 carry**. Manual_tasks Anthropic fingerprint → Day-5. RSS verify → Day-5.
- `lore-financial-teaser` HEAD `031ce8e` — **4th consecutive day frozen**. `.env` STILL tracked → **Day-6 carry on a 5-minute fix.**
- `aaronjmars/aeon` HEAD `8fcf2f5` — 2 PR merges (#160 + #161). #158 + #150 hardening remains in place. Last template-string with user input still `runs/[id]/logs/route.ts` (digit-only-gated). Regression test → **Day-5 carry**. ZIZMOR_VERSION → Day-9. PR #156 reply-maker → **Day-13 idle 95h**.
- **`tomscaria/aeon` `outputs/` directory STILL 404** — ADR-093 falsifier clock at Day-4, **10 days remaining** before wire-up is aspirational. New carry-ledger entry.
- Top action: open ADR-096 for resolution-text-ingest (corrects MEMORY, unsticks the highest-leverage CalibrationGap upgrade). Then verify swarm-fund-mvp Pyth/Birdeye feed IDs (Day-6 carry, highest blast radius).

# Code Health Report — 2026-05-03

Three watched repos audited. Headline: **the 12-day-unpatched shell-injection at `aaronjmars/aeon` `dashboard/app/api/secrets/route.ts:96` landed today** (PR #150, commit `6c07691`, 09:30 UTC). ISS-016 candidate filing scheduled for 05-07 is now pre-empted.

| Repo | HEAD | Last commit | Notes |
|------|------|-------------|-------|
| `tomscaria/swarm-fund-mvp` | `68353e9` | 2026-05-03 11:22 -0500 — `data: refresh site metrics` | Mission-critical Python + Rust + Next.js trading lab. |
| `tomscaria/lore-financial-teaser` | `679f105` | 2026-05-01 18:21 -0500 — `Merge PR #5 from tomscaria/claude-md-aeon-fork-url` | Vite/React landing page. Unchanged from yesterday. |
| `aaronjmars/aeon` | `e1c46a5` | 2026-05-03 09:35 -0400 — `chore: categorize 5 orphan skills` | Six commits since yesterday's snapshot, including the secrets-route fix. |

## tomscaria/swarm-fund-mvp

### TODOs (74 occurrences across 31 files, +1 file vs last week)

Same three-bucket structure as 2026-05-02 — well-tagged, not stale debt:

| Category | Count | Notes |
|----------|-------|-------|
| Rust scaffolding `TODO(TASK-X.Y)` | 35 | `rust/swarm-{ingest,executor}/src/...` — every TODO references a numbered task in `TASKS.md`. Unimplemented Hyperliquid / Polymarket CLOB / Kraken / EIP-712 / circuit-breaker modules. Roadmap, not debt. |
| Strategy enrichment triplet | ~21 | Same 3-line "Kelly / signal-emit / cost-floor" stub repeats across 5 strategies (`hermes_arb`, `hermes_fan`, `bankr_avantis_macro`, `bankr_social_momentum`, `aeon_narrative` per last week). Refactor candidate unchanged. |
| Mirofish / surface enrichment / event-mapper / blog harvester | ~18 | Pre-implementation placeholders, plus 4 `# TODO: feed URL needs verification` markers in `python/research/knowledge/harvest_blogs.py:54-63`. |

The three "TODO: verify" hardcoded feed IDs flagged on 2026-05-02 are **still present and unchanged**:
- `pipeline/ingestion/pyth_ws.py:36` — XRP/USD Pyth feed ID `ec5d399b3b...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:36` — Backed bIB01 mint `9n4nbM75...` (unverified).
- `pipeline/ingestion/birdeye_rest.py:37` — Dinari dSPY mint `FtgGSFAD...` (unverified).

These gate trading decisions in CalibrationGap-adjacent ingestion. ~20-line cross-check still outstanding.

New TODO surface: `python/research/knowledge/harvest_blogs.py:54-63` adds 4 unverified RSS URLs. Lower blast-radius (research harvester, not trading) but worth a sweep.

### Concerns

**1. `python/api/server.py` is 3029 lines (was 3030).**

Effectively unchanged. Same recommendation: split by route group (`/calibration`, `/strategies`, `/admin`, `/health`) into `python/api/routers/*.py` when next route lands.

**2. Test surface grew significantly.**

139 test files (vs 106 last week, **+33 tests, +31%**). Cannot fully attribute the diff in a depth=1 clone, but the increase is real and concentrated in author-controlled directories — `tests/`, `python/tests/`, `packages/becker-revenant/tests/`. Strong signal.

**3. Files >500 lines (refresh).**

| File | Lines | Δ vs 2026-05-02 |
|------|-------|------------------|
| `python/api/server.py` | 3029 | -1 |
| `python/main.py` | 1884 | -1 |
| `swarm-lab-site/src/content/copy.tsx` | 1631 | unchanged |
| `python/alerting/telegram.py` | 1586 | -1 |
| `tests/test_strategies.py` | 1540 | +2 |
| `python/agents/runner_swarm.py` | 1504 | **+46** |
| `python/agents/strategy_registry.py` | 939 | -1 |
| `python/tests/test_variant_bandit.py` | 869 | -1 |
| `python/signal/variant_bandit.py` | 799 | -1 |

`python/agents/runner_swarm.py` grew 1458 → 1504 — the only file that gained material lines. Worth a glance on next refactor pass; still well below the `server.py` outlier.

**4. Hardcoded secrets — clean, with the same `outputs/manual_tasks_thomas.md:276` note.**

The `sk-ant-api03-fpl...1wAA` partial Anthropic key fingerprint (line moved 106 → 276 since last week) remains in this checked-in operations file. Prefix + 4-char suffix don't enable recovery, but `outputs/` is article-shaped — recommend `[redacted prefix]` notation.

Test-side dummies (`"sk-ant-test"` in `python/tests/test_llm_client.py`) are correct test pattern, no concern.

**5. Dashboard API routes — still clean.**

No `execSync(template-string)` pattern in any `dashboard/app/api/**` route in this repo. The class of bug that haunted `aaronjmars/aeon` for 12 days is structurally absent here.

### Recommendations

1. **Verify the three "TODO: verify" hardcoded feed IDs** in `pyth_ws.py:36` and `birdeye_rest.py:36-37` (now Day-2 carry-over). Top priority — gates CalibrationGap-adjacent ingestion.
2. **Move `outputs/manual_tasks_thomas.md:276` Anthropic key fingerprint** to `[redacted]` notation.
3. **Verify the 4 new `harvest_blogs.py:54-63` RSS feed URLs.** Lower blast-radius, but small sweep.
4. Carry-over: extract strategy-stub triplet, re-document `tools/kraken-cli-main/`, plan `server.py` split, gitignore `config/revenant_proposals.yaml`. No movement on these since 2026-05-02.

## tomscaria/lore-financial-teaser

HEAD `679f105`, **identical to yesterday's report**.

### TODOs

Zero TODO/FIXME/HACK/XXX in source tree. Two SVG-internal matches in `src/assets/logos/logos_all.svg:213-214` (vendored asset markup, not code).

### Concerns

**1. `.env` STILL TRACKED in the repository — Day-2 carry-over.**

`git ls-files | grep ^.env` confirms both `.env` and `.env.example` are tracked. `.env` content is byte-identical to 2026-05-02:
```
VITE_SUPABASE_PROJECT_ID="hhacnvwqrckfeyhdlzab"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ...zVLFfIs5klr8OyS_Lah88Ul9mMwSJ29pJkm5yuxRUHs"
VITE_SUPABASE_URL="https://hhacnvwqrckfeyhdlzab.supabase.co"
```

The repo's own `.gitignore:15-19` says `.env` should be ignored. The example file says verbatim "Never commit real values." Both are violated by the tracked `.env`.

Severity stays low in practice — values are `VITE_*`-baked into the bundle anyway, and the JWT is the public anon role with `exp: 2036-02`. But the **process is still broken**, and the next contributor following the existing pattern will leak a real secret. The 3-step fix (`.env` → `.env.local`, `git rm --cached .env`, align `.env.example` key naming) remains a ~5-minute diff.

**2. Files >500 lines (refresh, 5 author + 1 shadcn-ui — same as last week).**

| File | Lines | Type |
|------|-------|------|
| `src/components/sections/HowItWorksSection.tsx` | 1548 | author |
| `src/components/sections/PartnerModelsSection.tsx` | 1359 | author |
| `src/components/sections/ETFEvolutionSlides.tsx` | 1054 | author |
| `src/components/ui/sidebar.tsx` | 637 | shadcn-ui |
| `src/components/sections/CountryOpportunityModule.tsx` | 601 | author |
| `src/components/FloatingPitchProgressHUD.tsx` | 529 | author |

All within ±1 of last week. Defer splits until next content edit.

**3. Test coverage — unchanged.**

One Vitest stub (`src/test/example.test.ts`). Vitest configured but unwired from build pipeline. Smoke test for the Supabase waitlist call still recommended.

### Recommendations

Carry over from 2026-05-02. Top action: **untrack `.env`**, rename to `.env.local`, fix `.env.example` key naming. Day-2 carry on a 5-minute fix.

## aaronjmars/aeon

HEAD `e1c46a5`. **Six commits since yesterday's snapshot**, including the headline fix:

| Commit | Date | What |
|--------|------|------|
| `e1c46a5` | 2026-05-03 09:35 | chore: categorize 5 orphan skills (#155) |
| `f5ac6a5` | 2026-05-03 09:32 | fix: bump skills.json total + register show-hn-draft category (#154) |
| **`6c07691`** | **2026-05-03 09:30** | **fix(dashboard/secrets): use execFileSync to close shell-injection on secret set/delete (#150)** |
| `4a6b037` | 2026-05-03 ≈09:28 | feat: add fork-cohort skill (#152) |
| `f7a048a` | 2026-05-03 ≈09:26 | feat: add operator-scorecard skill (#153) |
| `56b39ea` | 2026-05-03 ≈09:24 | feat: add show-hn-draft skill (#151) |

### Headline fix — `dashboard/app/api/secrets/route.ts` shell-injection PATCHED

Verified the diff. Both POST (`set`) and DELETE handlers now use `execFileSync('gh', [...args])` instead of `execSync(\`gh secret ${verb} ${name} -b "${value}"\`)`:

```ts
// Line 96 — POST handler
execFileSync('gh', ['secret', 'set', name, '-b', value], {
  stdio: 'pipe',
  cwd: process.cwd(),
})

// Line 119 — DELETE handler
execFileSync('gh', ['secret', 'delete', name], { stdio: 'pipe', cwd: process.cwd() })
```

Argv-array form bypasses the shell entirely. Backtick / `$(…)` / `$VAR` injection vectors all closed. **ISS-016 candidate filing (was scheduled for 2026-05-07) is now pre-empted** — no shell-injection vulnerability remains in the secrets handler.

12 days unpatched, fixed in a single PR with the 10-line diff template that's been called out in this report series since 2026-04-25. The fix matches what `dashboard/app/api/auth/route.ts:46` was already doing (pipe via stdin / argv array — `auth/route.ts` was the cited template).

### Remaining concerns (carry-over from 2026-05-02)

**1. `dashboard/app/api/auth/route.ts:46` template-string `execSync` — NOT exploitable.**

Re-verified. `secretName` is one of two literal strings (`'CLAUDE_CODE_OAUTH_TOKEN'` | `'ANTHROPIC_API_KEY'`) chosen by `key.startsWith('sk-ant-oat')`. No user-controlled interpolation reaches the shell. Safe. Could be tightened to `execFileSync` for defense-in-depth, but not required.

**2. TODOs (1 real).**

`skills/workflow-security-audit/SKILL.md:36` — `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` Day-5 carry-over (was Day-4 yesterday). All other matches are documentation references to the TODO grep target as a concept.

**3. Sandbox-required scripts — partial improvement.**

Inventory of `scripts/`:
- Present: `prefetch-xai.sh`, `postprocess-{admanage,admanage-create,devto,farcaster,replicate}.sh`.
- Missing: `postprocess-notify.sh`, `prefetch-vuln-scanner.sh` (ISS-001), `prefetch-reddit.sh` (ISS-002 / ISS-012), `reply-maker)` case in `prefetch-xai.sh` (ISS-014).

`prefetch-xai.sh:129` confirms `tweet-roundup)` case **is wired** (vs missing in earlier reports). `reply-maker)` case still missing — ISS-014 unchanged at Day-9+ carry.

**4. Tests — unchanged.**

2 test files total: `examples/mcp/test_connection.py`, `skills/skill-health/tests/smoke.sh`. Zero unit/integration tests on the dashboard tree (which now contains the just-patched fix — adding even one regression test for `secrets/route.ts` would lock in today's fix against future regressions).

**5. Dashboard API routes — 9 use child_process; only the one exploitable shape was fixed today.**

`/api/{skills,skills/[name]/run,sync,runs,runs/[id]/logs,secrets,outputs,analytics,auth}` all import or call from `child_process`. After today's patch, none are known-exploitable; all should still be reviewed for argv-form safety on next touch.

**6. Files >500 lines — unchanged: 1 file.**

`a2a-server/src/index.ts` (578 lines).

**7. `./notify` script absent at upstream root — unchanged.** Skills depending on `./notify` won't work without it, but Aeon-fork users (this repo) populate it. Upstream-only concern.

**8. No `npm audit` / `pip-audit` / `cargo audit` step in any workflow — unchanged.**

### Recommendations

1. **Add a regression test for `dashboard/app/api/secrets/route.ts`** — the just-landed fix has zero test coverage. A single Vitest case asserting that POST `value = "x\`whoami\`"` is stored verbatim (not executed) locks in today's fix permanently. ~30-line diff.
2. **Land `reply-maker)` case in `scripts/prefetch-xai.sh`** — ISS-014, Day-9+ carry, blocks reply-maker default-topic branch.
3. **Bump ZIZMOR_VERSION** in `skills/workflow-security-audit/SKILL.md:36`.

## Cross-repo summary

| Signal | swarm-fund-mvp | lore-financial-teaser | aeon |
|--------|----------------|----------------------|------|
| Real TODOs (excl. docs) | 74 (mostly TASK-tagged scaffolding) | 0 | 1 (workflow-security-audit) |
| Tracked secrets / keys | 0 (1 partial fingerprint) | **1 `.env` Day-2 carry** | 0 |
| `execSync(template-string)` exploit | none | n/a | **PATCHED today (PR #150, 09:30 UTC)** |
| Files >500 lines | 23 author + 9 vendored kraken-cli (≈stable) | 5 author + 1 shadcn-ui (unchanged) | 1 (`a2a-server/src/index.ts`) |
| Test files | 139 (+33 vs last week) | 1 (Vitest stub) | 2 |
| CI dep audit step | none | none | none |

### What changed in 7 days

- **Headline win:** `aaronjmars/aeon` `secrets/route.ts:96` shell-injection patched after 12 days. ISS-016 pre-empted.
- **Test growth:** swarm-fund-mvp test surface +33 files (+31%). Direction-of-travel signal for the lab.
- **Carry-over debt:** lore `.env` Day-2 unpatched (5-min fix), swarm "TODO: verify" feed IDs Day-2 unpatched (~20-line check), aeon ISS-014 reply-maker case Day-9+ unpatched.

### Next-priority fixes across all three repos

1. **Verify `swarm-fund-mvp` Pyth/Birdeye feed IDs** — gates trading decisions in CalibrationGap-adjacent ingestion. Day-2 carry.
2. **Untrack `lore-financial-teaser` `.env`** — process bomb on next real secret. Day-2 carry, 5-min fix.
3. **Add a regression test for `aeon/dashboard/app/api/secrets/route.ts`** — locks in today's headline fix.

## Summary

- Multi-repo audit. Three repos cloned cleanly.
- **`aaronjmars/aeon` shell-injection at `dashboard/app/api/secrets/route.ts:96` PATCHED 2026-05-03 09:30 UTC via PR #150 (commit `6c07691`).** 12 days unpatched, fixed via the `execFileSync` argv-array form. Both POST and DELETE handlers covered. ISS-016 candidate filing pre-empted.
- `swarm-fund-mvp`: 74 TODOs (most TASK-tagged Rust roadmap), test surface +31% (139 files), three "TODO: verify" hardcoded feed IDs in Pyth/Birdeye ingestion still outstanding (Day-2 carry).
- `lore-financial-teaser`: tracked `.env` STILL violating own `.gitignore` — Day-2 carry on a 5-minute fix.
- `aaronjmars/aeon`: 6 commits since yesterday (5 features + the secrets fix). ISS-014 `reply-maker)` case still missing in `scripts/prefetch-xai.sh`. Zero tests on the dashboard tree where the fix landed — a regression test would lock today's fix in.
- No hardcoded production secrets across any of the three repos.
- Top action: add a regression test for the just-patched `secrets/route.ts` to keep ISS-016 closed permanently.

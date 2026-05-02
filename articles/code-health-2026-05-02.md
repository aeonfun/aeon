# Code Health Report — 2026-05-02

Three watched repos audited. First multi-repo report — prior weeks audited only `aaronjmars/aeon` because the other two never resolved through `gh repo clone`. Today all three cloned cleanly.

| Repo | HEAD | Last commit | Notes |
|------|------|-------------|-------|
| `tomscaria/swarm-fund-mvp` | `29c3d3b` | 2026-05-02 10:58 -0500 — `data: refresh site metrics` | Mission-critical. Python + Rust + Next.js trading lab. |
| `tomscaria/lore-financial-teaser` | `679f105` | 2026-05-01 18:21 -0500 — `Merge PR #5 from tomscaria/claude-md-aeon-fork-url` | Vite/React landing page. |
| `aaronjmars/aeon` | `c95478c` | 2026-05-01 10:02 -0400 — `Remove agent status badge from README` | Unchanged from yesterday's report (README-only commit since). |

## tomscaria/swarm-fund-mvp

First time auditing this repo. CalibrationGap is the active agent here, so this repo's health gates the Apex push.

### TODOs (73 occurrences across 32 files)

The TODO surface is well-structured, not stale debt. Three categories:

| Category | Count | Notes |
|----------|-------|-------|
| Rust scaffolding `TODO(TASK-X.Y)` | ~30 | `rust/swarm-{ingest,executor}/src/...` — every TODO references a numbered task in `TASKS.md`. These are unimplemented venue/risk modules (Hyperliquid, Polymarket CLOB, Kraken WS, EIP-712 signing, circuit breakers). Not debt — explicit roadmap. |
| Strategy enrichment | ~20 | `strategies/{aeon_narrative,bankr_avantis_macro,hermes_fan,hermes_arb,bankr_social_momentum}/*.py` — repeated triplet "Kelly sizing / Signal emit / cost or slippage filter" is the same 3-line stub per strategy. Refactor candidate: a shared `BaseStrategyTodo` mixin or a single `_enrich_factors()` hook. |
| Mirofish / surface enrichment / event mapper | ~10 | `python/mirofish/*.py` (4 files), `python/data/surface_enrichment.py` (5 markers), `python/signal/event_mapper.py:46` (TASK-2.3). Mirofish modules are docstring-tagged `[RESEARCH] TODO` — pre-implementation placeholders. |

Notable instances worth surfacing:

- `pipeline/ingestion/pyth_ws.py:36` — `"XRP/USD": "ec5d399b3b...": # TODO: verify`. Hardcoded Pyth price feed ID, unverified. If wrong, XRP price ingestion silently reads from the wrong feed.
- `pipeline/ingestion/birdeye_rest.py:36-37` — `bIB01` and `dSPY` Solana token mints, both `# TODO: verify`. Same risk class.
- `DECISIONS.md:845` — one-time backfill script TODO for `first_composite_crossing_at` is gated on "any agent crossing 0.5 composite." Trip-wire-style — only triggers when needed. Healthy.
- `DECISIONS.md:913` — `config/revenant_proposals.yaml` not yet `.gitignore`'d. If the revenant cron lands more frequently than review cadence, this churns the diff.

### Concerns

**1. `python/api/server.py` is 3030 lines.**

This is the largest file in the repo by 60%. FastAPI server, presumably the Polymarket / Hermes-arb dispatch surface. A 3000-line single-module HTTP server is a refactor candidate any time a new endpoint is added — split by route group (`/calibration`, `/strategies`, `/admin`, `/health`, etc.) into `python/api/routers/*.py` with a thin `server.py` mounting them. Defer until next route touch.

**2. Vendored upstream code mixed in tree.**

`tools/kraken-cli-main/` is a copy of `github.com/krakenfx/kraken-cli` (MIT, v0.2.0) — accounts for 9 of the 35 files >500 lines (websocket.rs 2287, futures.rs 1542, lib.rs 1501, paper.rs 1307, trade.rs 1198, client.rs 1049, paper.rs 951, mcp/server.rs 842, futures_ws.rs 783; plus integration tests). These shouldn't count against author-controlled code-health but they do clutter file-size metrics. Recommend either:
- Pull as a git submodule (preserves provenance, simpler bumps) or
- Treat as a vendored dep with a `tools/kraken-cli-main/UPSTREAM.md` recording the source commit and bump policy.

**3. Real author-controlled files >500 lines (excluding `tools/kraken-cli-main/`):**

| File | Lines | Note |
|------|-------|------|
| `python/api/server.py` | 3030 | (see #1) |
| `python/main.py` | 1885 | top-level orchestrator; high-blast-radius single-file |
| `swarm-lab-site/src/content/copy.tsx` | 1631 | landing-page copy module — content not logic, low priority |
| `python/alerting/telegram.py` | 1587 | alerting module |
| `tests/test_strategies.py` | 1538 | test fixture file — keeping it co-located is fine |
| `python/agents/runner_swarm.py` | 1458 | core swarm runner |
| `python/agents/strategy_registry.py` | 940 | registry — bounded growth, OK |
| `python/tests/test_variant_bandit.py` | 870 | test |
| `dashboard/app/(shell)/strategy/[name]/page.tsx` | 813 | per-strategy page |
| `python/signal/variant_bandit.py` | 800 | bandit selector |
| `dashboard/app/(shell)/strategy/page.tsx` | 755 | strategy index |
| `swarm-lab-site/src/pages/InvestorsDeck.tsx` | 728 | deck — content |
| `dashboard/components/ui/sidebar.tsx` | 724 | shadcn-ui sidebar (vendored shape) |

24 files >500 lines after excluding `kraken-cli-main`. Top three (`server.py`, `main.py`, `runner_swarm.py`) are the real refactor candidates.

**4. Hardcoded secrets — clean, with one hygiene note.**

Pattern scans for `sk-ant-`, `ghp_`, `glpat-`, `AKIA[0-9A-Z]{16}`, `xoxb-` returned only:
- `python/tests/test_llm_client.py:129,158` — `"sk-ant-test"` dummy in monkeypatched envvar (correct test pattern, no concern).
- `outputs/manual_tasks_thomas.md:106` — partial Anthropic key fingerprint `sk-ant-api03-fpl...1wAA` in a checked-in operations note. Prefix + 4-char suffix do not enable recovery, but better hygiene is a footnote `[redacted prefix]` since `outputs/` is a public-facing artifact directory. Low severity.

No real keys committed. No `.env` tracked.

**5. Test surface — strong.**

106 test files across 5 test directories (`tests/`, `python/tests/`, `tools/superpowers/tests/`, `tools/kraken-cli-main/tests/`, `packages/becker-revenant/tests/`). Pytest configured via `pyproject.toml` with `asyncio_mode="auto"`. Rust crates have integration test directories (`tools/kraken-cli-main/tests/integration/cli_tests.rs:831`, `wiremock_tests.rs:671`). This is the strongest test surface across the three repos.

**6. Dashboard API routes — clean.**

Spot-checked `dashboard/app/api/**` for the `execSync(template-string)` pattern that gates the aeon dashboard. **No `execSync`, `spawn`, or `child_process` imports found in any dashboard API route in this repo.** The class of bug that's haunting `aaronjmars/aeon` for 12 days is structurally absent here.

### Recommendations

1. **Verify the three "TODO: verify" hardcoded feed IDs** in `pyth_ws.py:36` (XRP/USD), `birdeye_rest.py:36-37` (bIB01, dSPY) before any of those feeds influences a CalibrationGap or revenant decision. ~20-line check against Pyth's official feed registry + Solana mint addresses on chain.
2. **Move `outputs/manual_tasks_thomas.md:106` Anthropic key fingerprint** to `[redacted]` notation. `outputs/` is article-shaped output and may be ingested into Aeon-side digests, syndicated to dev.to, or published. Even partial fingerprints reduce brute-force search space.
3. **Extract the strategy-stub triplet** (Kelly / Signal-emit / cost-floor) into a single `BaseStrategy._enrich_factors()` hook — converts 5×3 = 15 TODOs into 3, and makes "is this strategy productionized" a single-method check.
4. **Re-document `tools/kraken-cli-main/`** as a vendored upstream dep with an `UPSTREAM.md` (source commit, bump policy). Consider promoting to a git submodule on next bump.
5. **Plan the `python/api/server.py` split** by route group when next route lands. 3030 lines is an outlier in this otherwise-well-modularized tree.
6. **Add `config/revenant_proposals.yaml` to `.gitignore`** before the revenant cron lands at higher cadence than review (per `DECISIONS.md:913`).

## tomscaria/lore-financial-teaser

First-time audit. Vite + React + shadcn-ui + Supabase landing page.

### TODOs

Zero TODO/FIXME/HACK/XXX markers across the source tree. Clean.

### Concerns

**1. `.env` is tracked in the repository.**

`/tmp/repo-audit-lore/.env`:
```
VITE_SUPABASE_PROJECT_ID="hhacnvwqrckfeyhdlzab"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://hhacnvwqrckfeyhdlzab.supabase.co"
```

The repo's own `.gitignore` lines 15-19 say `.env` should be ignored:
```
# Environment — values are SECRETS, not config.
# Use .env.example to document required keys without values.
.env
.env.*
!.env.example
```

And `.env.example` says verbatim "Never commit real values." But `.env` is tracked anyway.

**Severity is low in practice but the process is broken.** All three values are `VITE_*`-prefixed, so Vite bakes them into the client bundle at build time — they end up public regardless. The `VITE_SUPABASE_PUBLISHABLE_KEY` is a Supabase anon JWT (`role: "anon"`, `iss: "supabase"`, `iat: 2026-01`, `exp: 2036-02`) — designed to be public-facing, gated by Supabase Row-Level Security policies. So no immediate exposure.

**But the convention violation is the real concern** — the next contributor who follows the existing `.env` pattern and adds a *real* secret (e.g. a Supabase service-role key, a Plausible API token) will leak it because the file is already tracked despite `.gitignore` saying otherwise. Fix:
1. Rename real `.env` to `.env.local` (Vite reads both; `.env.local` is gitignored by default in `.gitignore` line 13's `*.local` pattern).
2. `git rm --cached .env` so the tracked copy disappears without losing the local working file.
3. Update `.env.example` key naming — current example uses `VITE_SUPABASE_ANON_KEY`, but real `.env` uses `VITE_SUPABASE_PUBLISHABLE_KEY`. One of the two is wrong; align them.

**2. RLS is the only thing standing between the public bundle and the database.**

Because the anon key is in the bundle, anyone who hits the site can call Supabase's REST API with it. RLS policies on the waitlist table need to be confirmed: INSERT-only for anon, no SELECT/UPDATE/DELETE. Worth a one-time check. Not a code-health issue per se, but it's the structural assumption that makes the leaked-but-public-anyway story OK.

**3. Files >500 lines (5 author-controlled, 6 shadcn-ui).**

| File | Lines | Type |
|------|-------|------|
| `src/components/sections/HowItWorksSection.tsx` | 1549 | author |
| `src/components/sections/PartnerModelsSection.tsx` | 1360 | author |
| `src/components/sections/ETFEvolutionSlides.tsx` | 1055 | author |
| `src/components/ui/sidebar.tsx` | 638 | shadcn-ui |
| `src/components/sections/CountryOpportunityModule.tsx` | 602 | author |
| `src/components/FloatingPitchProgressHUD.tsx` | 530 | author |

The four author-controlled `sections/` files are 1000+-line monolithic landing-page sections. For a landing page these often grow to that size legitimately (lots of static markup, illustrative graphs, copy blocks). Worth splitting `HowItWorksSection.tsx` if the next pass touches it; otherwise defer.

**4. No real test coverage.**

One test file: `src/test/example.test.ts`. Vitest is configured (`vitest.config.ts`) but unwired from the build pipeline. For a marketing site this is acceptable, but the waitlist form hitting Supabase is the one piece worth a smoke test.

**5. Hardcoded secrets — clean (beyond the tracked `.env`).**

No `sk-ant-*`, `ghp_*`, `AKIA*`, `xoxb-*` patterns in source tree.

**6. One `dangerouslySetInnerHTML` in shadcn-ui chart component.**

`src/components/ui/chart.tsx:70` — generates a `<style>` block from caller-supplied chart `id` and `colorConfig` keys interpolated into a CSS selector. This is the unmodified shadcn-ui pattern; risk depends on whether `id` is ever user-controlled. In this repo `id` is a build-time string. No action needed; flagging for completeness.

### Recommendations

1. **Untrack `.env`, rename to `.env.local`, fix `.env.example` key naming** (~3-step diff). Top priority — it's a process bomb even though the current values are non-sensitive.
2. **Verify Supabase RLS policies on the waitlist table** allow only INSERT for the anon role. One SQL check.
3. **Add a Vitest smoke test** for the waitlist form's Supabase call (mocked client). Catches the case where the anon key gets rotated and the form silently breaks.
4. **Defer the 1000+-line section splits** until the next content edit touches them.

## aaronjmars/aeon

HEAD `c95478c`, identical to yesterday's report. Today's commit (`Remove agent status badge from README`) is README-only. No code-health-relevant change.

### TODOs (1 real)

Same single TODO as the last 4 reports: `skills/workflow-security-audit/SKILL.md:36` — `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` Now 4 days carrying. All other matches are documentation references (skills naming the TODO grep target as a concept).

### Concerns

**1. Shell injection in `dashboard/app/api/secrets/route.ts:96` — STILL UNPATCHED.**

Verified line is byte-identical to last week:

```ts
execSync(`gh secret set ${name} -b "${value.replace(/"/g, '\\"')}"`, {
  stdio: 'pipe',
  cwd: process.cwd(),
})
```

`name` is regex-validated. `value` is only quote-escaped — backticks `` ` ``, `$(…)` command substitution, and `$VAR` expansion still reach the shell. POST `value = "x\`whoami\`"` runs the inner command on the dashboard host.

**Correction to yesterday's report:** I claimed "Day 24+ unpatched." That was wrong. The file was introduced in commit `74ed4b2` on 2026-04-20 (`improve(repo-scanner): autoresearch evolution (#121)`). Today is 2026-05-02 — the line is **Day 12 unpatched**, called out in this report series since 2026-04-25 (Day 5 of the vuln, 7 days of carry-over in the report itself). ISS-016 candidate filing remains scheduled for 2026-05-07 per `memory/topics/aeon-ops.md`, 5 days out.

Fix template `dashboard/app/api/auth/route.ts:46` is unchanged — pipe `value` via `input:` stdin, drop `-b "..."`. Same 10-15 line diff. Repeat at `secrets/route.ts:119` (DELETE handler) for the same shape.

**2-7. All unchanged from 2026-05-01 report.**

- Zero unit/integration tests in dashboard tree.
- 9/19 dashboard API routes use `execSync`; only `secrets/route.ts:96` is exploitable today.
- 4 sandbox-required scripts still missing (`postprocess-notify.sh`, `prefetch-vuln-scanner.sh`, `prefetch-reddit.sh`, `reply-maker)` case in `prefetch-xai.sh`).
- 1 file >500 lines: `a2a-server/src/index.ts` (578).
- `./notify` script absent at upstream root despite ≥5 skills assuming it.
- No `npm audit` / `pip-audit` / `cargo audit` step in any workflow.

### Recommendations

Same as 2026-05-01 report. Patch `secrets/route.ts:96` this week. ISS-016 candidate filing in 5 days if still unpatched.

## Cross-repo summary

| Signal | swarm-fund-mvp | lore-financial-teaser | aeon |
|--------|----------------|----------------------|------|
| Real TODOs (excl. docs) | 73 (mostly TASK-tagged scaffolding) | 0 | 1 (workflow-security-audit) |
| Tracked secrets / keys | 0 (1 partial fingerprint) | 1 `.env` (publishable values, but process broken) | 0 |
| `execSync(template-string)` exploit | none | n/a | `secrets/route.ts:96` Day 12 unpatched |
| Files >500 lines | 24 author + 9 vendored kraken-cli | 5 author + 1 shadcn-ui | 1 (`a2a-server/src/index.ts`) |
| Test files | 106 (pytest + cargo) | 1 (Vitest stub) | 0 (only `skill-health/tests/smoke.sh`) |
| CI dep audit step | none | none | none |

**The single highest-priority fix across all three repos is still `aaronjmars/aeon` `dashboard/app/api/secrets/route.ts:96`.** 12 days unpatched, fix template in the same codebase three files away, ~10-15 line diff, blocks ISS-016 filing.

**Second priority is `lore-financial-teaser` `.env` untracking** — low blast-radius today (publishable keys), but the broken convention will leak the next real secret added.

**Third is the three "TODO: verify" feed IDs in `swarm-fund-mvp`** — those gate the actual trading lab, and an unverified Pyth feed ID could route XRP signals to the wrong asset.

## Summary

- First multi-repo code-health report. Three watched repos audited (previously only `aeon`).
- `swarm-fund-mvp`: clean. 73 TODOs but most are TASK-tagged Rust scaffolding. Strong test surface (106 tests). Three "TODO: verify" hardcoded feed IDs need confirmation. Largest file `python/api/server.py` 3030 lines. `tools/kraken-cli-main/` is vendored upstream — 9/35 large files belong to it. Dashboard API routes are clean of the `execSync` pattern that haunts aeon.
- `lore-financial-teaser`: tracked `.env` violating own `.gitignore`. Values are public-by-design (Vite-prefixed, Supabase anon JWT) but process is broken. RLS check recommended. 4 author-controlled files >1000 lines (landing-page sections). One Vitest stub.
- `aeon`: shell-injection at `dashboard/app/api/secrets/route.ts:96` Day 12 unpatched (correcting yesterday's "Day 24+" claim). Otherwise unchanged from 2026-05-01 report.
- No hardcoded production secrets across any of the three.
- Top action: patch aeon's `secrets/route.ts:96` before 2026-05-07 to pre-empt ISS-016.

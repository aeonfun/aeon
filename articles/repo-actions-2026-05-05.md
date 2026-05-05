# Repo Actions — tomscaria/swarm-fund-mvp — 2026-05-05

**Top pick for tomorrow:** #1 — Wire the six `InvestorViz.tsx` components into the six unfilled `data-slot` placeholders in `swarm-lab-site/src/pages/Investors.tsx` (Content, Small)
**Verdict:** Last night's overnight commits (`c8e09632` shipped 349 lines of `InvestorViz.tsx` with six exported SVG components; `fe189cc1` added six matching `data-slot` placeholders to the investors page) created an internally-inconsistent state — the components are written, the slots are reserved, but nothing imports them. The investor page that grant committees and LPs land on still renders six dashed-outline placeholders instead of the diagrams that exist on disk. Top pick is the import-and-replace wiring; that's the single highest-leverage change in the repo today and it's a one-file edit. The rest of the list addresses the only-Vercel-currently-validates-the-site CI gap (#2), closes the ADR-093 falsifier from the swarm-fund side via an executable contract test (#3), and ships two smaller hygiene wins. Yesterday's top pick (`pyproject.toml` SDK pins) is still un-shipped and remains in the Monitor section as a security-class carry-over.

## Actions

### 1. Wire `StackArchitecture` / `CycleTimeBars` / `PositioningMatrix` / `RoadmapGantt` / `ArrTrajectory` / `VisionTree` into the six unfilled `data-slot` placeholders in `swarm-lab-site/src/pages/Investors.tsx`
**Priority:** HIGH (leverage 5)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** TODO:swarm-lab-site/src/pages/Investors.tsx (six `<div className="inv__viz-slot" data-slot="…">` placeholder divs added in commit `fe189cc1` 2026-05-05T00:45:28Z, each preceded by a `/* VIZ-SLOT: … Owner: /create-viz. */` comment marker) + FILE:swarm-lab-site/src/components/InvestorViz.tsx (committed 2026-05-05T00:51:20Z in `c8e09632`, exports `StackArchitecture` (line 17), `CycleTimeBars` (line 71), `PositioningMatrix` (line 123), `RoadmapGantt` (line 189), `ArrTrajectory` (line 241), `VisionTree` (line 306) — all six pure-React + SVG components designed to drop into `.inv__viz-slot` containers per the file-level docstring). The commit headers describe `c8e09632` as *"feat(site): six SVG visualizations for /investors slots"* and `fe189cc1` as *"feat: investors page updates + ScrollProgress component"* — they shipped 6 minutes apart, both signed by `Co-Authored-By: Claude Sonnet 4.6`, both added in the same overnight pass. The CSS hook is also already shipped: `swarm-lab-site/src/styles/investors.css` adds the `.inv__viz-slot[data-filled="true"] { border-style: solid; background: var(--bg-2); display: block; padding: 0; }` selector at line ~131 of the same diff, so the wiring contract — set `data-filled="true"` on the slot div, render the component as the only child — is already declared.
**Score:** L=5 C=5 N=5 (total 15/15)
**Impact:** The investor page (`/investors/101` per the route tree, the canonical grant-committee / LP landing surface) flips from rendering six dashed-outline `Viz slot` placeholders to rendering the six SVGs already on disk: layered architecture diagram of investor capital → lab OS → strategy library → execution venues; cycle-time bars vs industry baseline; transparency × edge-source 2x2 positioning matrix; per-quarter roadmap gantt; ARR trajectory line chart with team-size band; 1000x branching vision tree. Closes the visible "this page is unfinished" tell on the highest-leverage external-facing surface in the repo. Direct contribution to mission goal #1 (near-term grants/advisory income) — a grant reviewer arriving at `/investors/101` from a Polymarket Builders Program / Anthropic Research Credits citation sees a finished page, not six "Viz slot" placeholders.
**How:**
1. Edit `swarm-lab-site/src/pages/Investors.tsx`. Add at the top, alongside the existing `import { ScrollProgress } from '../components/ScrollProgress';` line:
   ```tsx
   import {
     StackArchitecture,
     CycleTimeBars,
     PositioningMatrix,
     RoadmapGantt,
     ArrTrajectory,
     VisionTree,
   } from '../components/InvestorViz';
   ```
2. Replace each of the six placeholder slot divs in-place — the `data-slot` attribute value is the unique key. Replace:
   ```tsx
   <div className="inv__viz-slot" data-slot="stack-architecture">stack architecture diagram</div>
   ```
   with:
   ```tsx
   <div className="inv__viz-slot" data-slot="stack-architecture" data-filled="true"><StackArchitecture /></div>
   ```
   Repeat for the other five slots, mapping by name:
   - `data-slot="cycle-time-bars"` → `<CycleTimeBars />`
   - `data-slot="positioning-matrix"` → `<PositioningMatrix />`
   - `data-slot="roadmap-gantt"` → `<RoadmapGantt />`
   - `data-slot="arr-trajectory"` → `<ArrTrajectory />`
   - `data-slot="vision-tree"` → `<VisionTree />`
3. Leave the `/* VIZ-SLOT: … Owner: /create-viz. */` comment blocks above each slot div in place — they document intent, and `/create-viz` is still the right owner if any of the six SVGs need re-cuts after a design pass.
4. Run `cd swarm-lab-site && npm run dev` locally; navigate to `/investors/101`; scroll through sections 4 (`Stack`), 11 (`Competitive`), 12 (`Roadmap`), 13 (`Economics trajectory`), 14 (`1000x`), and the cycle-time slot in section 10 (`HowWeOperate`); confirm each renders an SVG instead of the dashed-outline placeholder.
5. (Optional, only if a slot's SVG looks visually broken — viewBox aspect ratio mismatch or text-overflow on the captioned rows) — the `InvestorViz.tsx` file uses `viewBox="0 0 800 320"` for `StackArchitecture` and similar fixed viewBoxes for the others; the `.inv__viz-slot[data-filled="true"]` selector strips the placeholder padding so the SVG fills the container. If a section card's height looks wrong, the fix is per-component CSS in `investors.css`, not a `viewBox` change.
**Definition of done:** Every `<div className="inv__viz-slot" data-slot="…">` in `Investors.tsx` has `data-filled="true"` and contains exactly one `<XxxComponent />` child; `npm run build` exits 0 (no unused-import warnings, no TS error); a hard refresh of `/investors/101` in a clean Vite dev server shows zero "Viz slot" placeholder text and six rendered SVGs.

### 2. Add `.github/workflows/site-build.yml` running `npm ci && npm run build` for `swarm-lab-site/` on PRs touching the site tree
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** TAXONOMY:MISSING_CI for the site surface + FILE:swarm-lab-site/package.json (`build` script line 8 reads `"cd ../learn-site && npm install --no-audit --no-fund && npm run build && cd ../swarm-lab-site && tsc -b && vite build && node scripts/generate-sitemap.mjs && node scripts/generate-feed.mjs && node scripts/generate-og.mjs"` — five sequential failure points) + the recurring Vercel-FAILURE pattern on PR #30 today (and #19/#20/#23/#24/#28 across 2026-04-30 → 2026-05-03). The Vercel checks all fail at the *author-email-not-on-team* gate before any build runs, so today the `aeonframework`-bot-authored PRs are mergeable-around without anyone learning whether the actual `tsc -b && vite build` would have passed. The two existing workflows (`autoresearch.yml`, `swarm-watchdog.yml`) cover the Python surface only; the TS/Vite/Astro three-package build chain has zero PR-time validation.
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** Any PR that touches `swarm-lab-site/**`, `learn-site/**`, or one of the two `package-lock.json` files goes through a 90-second CI check that runs `npm ci && npm run build` end-to-end. A broken TypeScript change, a missing `learn-site/` dep, a busted `vite.config.ts`, or a `generate-og.mjs` regression all turn the check red instead of riding the queue until Vercel fixes the author-email config. Pairs cleanly with idea #1's wiring change — the next PR that touches `Investors.tsx` will go through this gate before merge. Decouples site CI from the operator-blocked Vercel auth issue.
**How:**
1. Create `.github/workflows/site-build.yml`:
   ```yaml
   name: site-build

   on:
     pull_request:
       paths:
         - "swarm-lab-site/**"
         - "learn-site/**"
     workflow_dispatch:

   permissions:
     contents: read

   concurrency:
     group: site-build-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     build:
       runs-on: ubuntu-latest
       timeout-minutes: 6
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: "20"
             cache: "npm"
             cache-dependency-path: |
               swarm-lab-site/package-lock.json
               learn-site/package-lock.json
         - name: Install learn-site deps
           working-directory: learn-site
           run: npm ci --no-audit --no-fund
         - name: Install swarm-lab-site deps
           working-directory: swarm-lab-site
           run: npm ci --no-audit --no-fund
         - name: Build (tsc + vite + sitemap/feed/og)
           working-directory: swarm-lab-site
           run: npm run build
   ```
2. The `paths:` filter keeps the workflow off Python-only PRs (which already get the autoresearch + watchdog runs); the `learn-site/` path is included because the `swarm-lab-site/package.json` `build` script `cd`s into it and depends on it building successfully.
3. Use `npm ci` (not `npm install`) — both `learn-site/` and `swarm-lab-site/` have committed `package-lock.json` files (verified via `gh api repos/.../contents/`), so `npm ci` enforces lockfile-determinism. This is *also* what idea #4 below proposes for the build script itself; the CI workflow leads the build-script change.
4. Don't add a `cache: "npm"` post-build artifact upload yet — the Vite output is `~10MB` and would balloon the run cost. If grant-LP review later wants a downloadable preview, add an `upload-artifact` step pointing at `swarm-lab-site/dist/`.
**Definition of done:** A `workflow_dispatch` of `site-build.yml` succeeds against `main` head (current commit `936cf151`) within 6 minutes; a deliberately-broken edit to `swarm-lab-site/src/pages/Investors.tsx` (e.g., import a non-existent symbol) fails the check on the next PR; the workflow appears in `gh workflow list` under `tomscaria/swarm-fund-mvp` and runs in parallel with the Vercel preview without conflict.

### 3. Add `python/tests/test_aeon_adapter_contract.py` — committed JSON fixture + assertion that `python/execution/aeon_adapter.py` parses it into `MarketTick(kind="aeon_signal")` without raising
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (1 day)
**Anchor:** FILE:python/execution/aeon_adapter.py (7,121 bytes at HEAD per `gh api repos/.../contents/python/execution/aeon_adapter.py`) + ADR-093 (`Aeon ingestion adapter`, CHANGELOG 2026-05-03 entry) + the `MEMORY.md`-tracked falsifier deadline 2026-05-17 ("`tomscaria/aeon` must ship `outputs/{skill}/{date}.json` JSON contract by ~2026-05-17 or ADR-093 wire-up is aspirational"). The CHANGELOG already documents 19 tests in `tests/test_aeon_adapter.py` covering "5 adapter parse + 12 strategy gates + 2 factory" — those test the *adapter's* internal logic against synthetic dicts, not the actual JSON-on-disk shape the Aeon repo is supposed to produce. A separate contract test that loads a real-shaped JSON file and runs the adapter's full parse path closes the spec gap from the swarm-fund side without depending on the Aeon repo to ship anything first.
**Score:** L=4 C=4 N=4 (total 12/15)
**Impact:** The Aeon repo's operator (and any agent on that side) can read a single grepable Python test that demonstrates exactly what JSON shape it must commit at `outputs/{skill}/{date}.json`. The fixture file IS the contract — checked in, version-controlled, executable. Closes the ADR-093 falsifier deadline (2026-05-17) without waiting for `docs/contracts/aeon_signal_contract.md` (yesterday's #2, still un-shipped) — an executable test is a stricter spec than a markdown doc and there's nothing to misread. Once the Aeon side commits its first real `outputs/{skill}/{date}.json`, swap the fixture for a copy of the live file and the test continues to pass.
**How:**
1. Read `python/execution/aeon_adapter.py` end-to-end (7.1 KB; CHANGELOG calls it "+180 lines"). Pull out the URL pattern (the `https://raw.githubusercontent.com/tomscaria/aeon/main/outputs/{skill}/{date}.json` constant, or whatever the actual base URL is), the entry-level dedup keys, the field set the parser reads on each entry, and the `MarketTick(kind="aeon_signal")` constructor call site.
2. Create `tests/fixtures/aeon_signal_min.json` (mirror existing fixture conventions if any in `tests/fixtures/`):
   ```json
   {
     "schema_version": "1.0",
     "skill": "monitor-polymarket",
     "date": "2026-05-05",
     "generated_at": "2026-05-05T08:00:00Z",
     "entries": [
       {
         "id": "monitor-polymarket-2026-05-05-001",
         "ts": "2026-05-05T07:55:12Z",
         "market_slug": "will-trump-issue-an-executive-order-on-x-by-q3",
         "kind": "narrative_score",
         "score": 0.72,
         "confidence": 0.61,
         "horizon_days": 30,
         "source": "monitor-polymarket"
       }
     ]
   }
   ```
   Field set should match exactly what `aeon_adapter.py` reads — adjust per step 1's read.
3. Create `python/tests/test_aeon_adapter_contract.py`:
   ```python
   import json
   from pathlib import Path

   from python.execution.aeon_adapter import AeonAdapter  # actual class name from step 1
   from core.types import MarketTick  # adjust per actual import path

   FIXTURE = Path(__file__).parent.parent.parent / "tests/fixtures/aeon_signal_min.json"


   def test_aeon_signal_min_fixture_parses_to_market_tick():
       payload = json.loads(FIXTURE.read_text())
       adapter = AeonAdapter(repo="tomscaria/aeon", token=None)  # whatever the constructor takes
       ticks = list(adapter._parse_payload(payload))  # whatever the parse method is

       assert len(ticks) == 1
       tick = ticks[0]
       assert isinstance(tick, MarketTick)
       assert tick.kind == "aeon_signal"
       assert tick.metadata["score"] == 0.72
       assert tick.metadata["source"] == "monitor-polymarket"


   def test_aeon_signal_dedup_key_is_stable_across_calls():
       payload = json.loads(FIXTURE.read_text())
       adapter = AeonAdapter(repo="tomscaria/aeon", token=None)
       run_a = list(adapter._parse_payload(payload))
       run_b = list(adapter._parse_payload(payload))
       assert run_a[0].dedup_key == run_b[0].dedup_key  # entry-level dedup per CHANGELOG
   ```
4. Cross-link the fixture from `DECISIONS.md` ADR-093 — append a `## Contract` section pointing at `tests/fixtures/aeon_signal_min.json` as the canonical shape.
5. Open a placeholder issue (or PR comment) on `tomscaria/aeon` titled "Implement `outputs/{skill}/{date}.json` per swarm-fund-mvp ADR-093" linking at the fixture's permalink. The Aeon-side skill backlog can pick it up.
**Definition of done:** `pytest python/tests/test_aeon_adapter_contract.py -v` exits 0 against the current `aeon_adapter.py`; the fixture file demonstrates a complete-enough shape for `tomscaria/aeon` to ship a single `outputs/test/2026-05-05.json` and have the adapter parse it; `DECISIONS.md` ADR-093 references the fixture path.

### 4. Switch `swarm-lab-site/package.json:8` `build` script from `npm install --no-audit --no-fund` to `npm ci --no-audit --no-fund` for `learn-site/`
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:swarm-lab-site/package.json line 8 — current `build` reads `"cd ../learn-site && npm install --no-audit --no-fund && npm run build && …"`. `learn-site/` ships a committed `package-lock.json` (verified via `gh api repos/.../contents/learn-site/`), so `npm install` re-resolves the dependency graph against the registry on every build instead of installing what's actually pinned. On Vercel this is non-deterministic — a transitive dep can slip a patch version between two builds — and slow (60-90s vs the ~5-15s `npm ci` takes against the same lockfile + node-modules cache).
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** Build determinism: the same commit produces the same `node_modules` graph in `learn-site/` on every Vercel deploy. Faster cold-start build (the repo currently runs the build twice — once on Vercel for `swarm-lab-site`, once again on `swarm-lab-site-7ily`, each going through this `npm install` step). Tightens the `npm ci` discipline that idea #2 brings in on the CI side — the build script and the CI gate now use the same install path.
**How:**
1. Edit `swarm-lab-site/package.json` line 8. Replace:
   ```json
   "build": "cd ../learn-site && npm install --no-audit --no-fund && npm run build && cd ../swarm-lab-site && tsc -b && vite build && node scripts/generate-sitemap.mjs && node scripts/generate-feed.mjs && node scripts/generate-og.mjs",
   ```
   with:
   ```json
   "build": "cd ../learn-site && npm ci --no-audit --no-fund && npm run build && cd ../swarm-lab-site && tsc -b && vite build && node scripts/generate-sitemap.mjs && node scripts/generate-feed.mjs && node scripts/generate-og.mjs",
   ```
2. Validate locally with a clean `learn-site/node_modules` (`rm -rf learn-site/node_modules && cd swarm-lab-site && npm run build`) — should complete in <2 minutes against a warm npm cache; failure here means the lockfile is out of sync with `learn-site/package.json`, which is a separate fix (run `cd learn-site && npm install && git diff package-lock.json` and commit any drift in the same PR).
3. Add a one-line note to `CLAUDE.md` "Document hierarchy" or "Existing code — do not break" block (whichever lists site build commands) — `npm ci` is the canonical install path for both site packages, mirroring what idea #2's CI workflow uses.
4. Confirm the next Vercel deploy log shows `npm ci` instead of `npm install` and a noticeably-shorter "Install dependencies" step.
**Definition of done:** `cd swarm-lab-site && rm -rf ../learn-site/node_modules node_modules && npm ci && npm run build` exits 0 in <3 minutes on a clean checkout; the next Vercel deploy log shows `npm ci` for `learn-site/`; a deliberately-introduced drift in `learn-site/package.json` (e.g., add a dep without updating the lockfile) makes the build fail with the `npm ci` lockfile-out-of-sync error.

### 5. Add `docs/12_operations/known_failure_modes.md` documenting the recurring Vercel-author-email surface failure
**Priority:** MED (leverage 3)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** MISSING:docs/12_operations/known_failure_modes.md + recurrence pattern: PR #30 today shows three Vercel checks failing with identical text *"Git author aeonframework must have access to the project on Vercel to create deployments"* (statuses pulled via `gh api repos/.../commits/fa37cf3b/statuses`); same root cause produced PR #19 / #20 / #23 / #24 / #28 failures during 2026-04-30 → 2026-05-03 (per `MEMORY.md` "Completed Goals" entry "5 ACT NOW Vercel-FAILURE PRs on swarm-fund-mvp" 2026-05-03 21:57). The README's role-block tells outside reviewers "outputs/REVIEW_BUNDLE.md", but a reviewer who clicks through to PRs sees a wall of red Vercel checks and has no in-tree context for whether the project is broken or whether the failures are a known config issue. The operator-side `MEMORY.md` knows; the public-side docs do not.
**Score:** L=3 C=4 N=5 (total 12/15)
**Impact:** A grant-committee reviewer arriving at the PR list from a citation link sees a known-and-tracked failure surface instead of "this project's CI is on fire." Same reasoning as `docs/REVIEW_BUNDLE.md` — surface the operator's mental model to the outside, in the place the outside actually looks (the repo, not Telegram). Pairs cleanly with idea #2's site-build CI workflow — the doc explains why Vercel checks are red but the site-build check is green, which is exactly the question a confused reviewer would have.
**How:**
1. Create `docs/12_operations/known_failure_modes.md` with these sections:
   - **Vercel "author must have access" check failures** — explain that `aeonframework` is the Aeon-bot's GitHub account; bot-authored PRs fail Vercel's author-allowlist gate; the *site itself builds* (CI gate per idea #2 covers this); operator merges around the failure or moves the PR through a re-author flow. Link to PR #30 as the canonical example. Note the operator-side fix path (Vercel team settings → invite `aeonframework`) is tracked outside the repo.
   - **Reddit anti-bot 403 on `reddit-digest` skill** — link out to the Aeon repo's `ISS-002` and `ISS-012` if they're public; one-paragraph note that the skill is paused-by-policy on the Aeon-cron side until `scripts/prefetch-reddit.sh` ships.
   - **Polymarket datacenter-IP block on Hyperliquid co-lo** — already documented in `MEMORY.md`'s "Lessons Learned" — surface to the docs tree as a one-line "co-lo applies to HL leg only" note.
2. Cross-link from `README.md`'s "Where to start, by role" block — add a short pointer under "If you're giving critique on the fund": *"For the recurring CI surface failures you'll see on the open PR list, see [`docs/12_operations/known_failure_modes.md`](docs/12_operations/known_failure_modes.md) — these are tracked, not ignored."*
3. Cross-link from `docs/REVIEW_BUNDLE.md` § Failure Log — that doc already has a failure-log section per the 2026-04-28 CHANGELOG entry; one bullet pointer is enough.
4. Keep the doc append-only — when a new recurring failure mode shows up, add a section; don't rewrite. Mirror `DECISIONS.md`'s discipline.
**Definition of done:** `docs/12_operations/known_failure_modes.md` exists with at least the Vercel-author section populated against PR #30 as the example; `README.md` links to it from the "If you're giving critique" block; `docs/REVIEW_BUNDLE.md` Failure Log references it.

## Monitor

### A. Pin `py-clob-client>=0.34.6,<0.40` and `py-builder-signing-sdk>=0.0.2,<0.1` in `pyproject.toml:24-26`
**Why not yet:** Carry-over from yesterday's top pick — un-shipped. `pyproject.toml` lines 24-26 still read `"py-clob-client"` and `"py-builder-signing-sdk"` with no version specifier (verified via `gh api graphql` payload). The implementation is autonomous (small file edit + `uv lock`), but the carry-over has now sat 24h without operator merge — moved to Monitor under the "blocked on operator review bandwidth, not on technical decision" criterion. Re-promote the moment a PR can move through merge in the same cycle.
**Anchor:** FILE:pyproject.toml:24-26 (unchanged); the canary CalibrationGap exposure path remains exposed to silent zero-major SDK bumps until this lands.

### B. Drain the daily `data: refresh site metrics` commits to an orphan `metrics` branch
**Why not yet:** Carry-over from yesterday's Monitor A. Cadence today: the most recent 30 commits on `main` are all "data: refresh site metrics" spanning ~7.5 hours (committed 2026-05-05T09:42 → 16:59 UTC). The `scripts/refresh-site-metrics.sh` comment block documents the choice as deliberate (Vercel Hobby 100-deploys/day budget). Switching to an orphan branch breaks the `vercel --prod` deploy trigger that wires `main` pushes to the build. Architectural — needs operator decision on Vercel project rewire vs `swarm-lab-site/` repo split.
**Anchor:** TAXONOMY:NOISY_HISTORY — same anchor as 2026-05-04, ratio unchanged.

### C. Set the GitHub repo description and topics
**Why not yet:** Carry-over from 2026-05-04 Monitor B and 2026-05-03 Monitor C. `description: null`, `repositoryTopics: []` confirmed in today's GraphQL payload. Suggested values from yesterday's Monitor unchanged. Operator UI step (Settings → General).
**Anchor:** TAXONOMY:EMPTY_DESCRIPTION + TAXONOMY:NO_TOPICS.

## Fleet follow-ons

- **`aaronjmars/aeon`** (pushed 2026-05-05T11:32:18Z, advanced from yesterday's 2026-05-04T12:53:13Z): the highest-leverage move on this repo this week is shipping the *producer* side of the JSON contract that idea #3 above tests against — write an Aeon skill (or modify `monitor-polymarket` / `polymarket-comments` / `narrative-tracker`) to commit `outputs/{skill}/{date}.json` matching the swarm-fund-mvp fixture. Closes the ADR-093 falsifier from the Aeon side and unblocks the 30 LH-sampled `aeon-narrative` agents (79% of the 38 net-new agents in the 05-03 fleet bump per `MEMORY.md`).
- **`tomscaria/lore-financial-teaser`** (pushed 2026-05-03T21:21:38Z — unchanged from yesterday): TypeScript / Next.js teaser site; same suggestion as 2026-05-04: port idea #2's `site-build.yml` shape to the JS surface as a `package-lock.json` drift workflow (`npm ci --dry-run` or `npm-check-updates --doctor`) so the Vercel build doesn't catch dep-resolution drift the operator missed. No advance since yesterday.

---

**Source status:** gh=ok code_search=n/a (private repo — GitHub code-search index returns 0 results cross-repo for unauth'd app, same as 2026-05-04) memory_topics=missing (no `memory/topics/repos.md` — taxonomy seeded from `MEMORY.md` + `CLAUDE.md` + GraphQL state) articles_dir=ok watched_repos=3 parsed (target = `tomscaria/swarm-fund-mvp` by `pushedAt` 2026-05-05T16:59:04Z; fleet = `aaronjmars/aeon` 2026-05-05T11:32:18Z, `tomscaria/lore-financial-teaser` 2026-05-03T21:21:38Z)
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** Yesterday's top pick (`pyproject.toml` SDK pins for `py-clob-client` + `py-builder-signing-sdk`) — UN-SHIPPED, demoted to Monitor A this cycle (24h-since-suggestion threshold per skill spec). Yesterday's #2 (`docs/contracts/aeon_signal_contract.md`) — UN-SHIPPED, but today's idea #3 closes the same falsifier from the test-side (executable spec instead of markdown spec); not re-listed. Yesterday's #3 (README Quickstart), #4 (`uv-lock-drift.yml`), #5 (`weekly-eval-digest.yml`) — all UN-SHIPPED; remain in the backlog but not re-promoted today. The 2026-05-03 top pick (`autoresearch.yml:86` path arg drop) and 2026-05-02 top pick (`.github/workflows/ci.yml`) — both UN-SHIPPED at 2 and 3 days respectively; gate idea #3 (`autoresearch.yml`) and idea #2 (`ci.yml`) infrastructure-class leftovers, but each new day they sit, the leverage-vs-effort ratio of *today's* picks beats them on smaller-effort + tighter-anchor.

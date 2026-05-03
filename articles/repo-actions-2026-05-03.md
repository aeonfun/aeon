# Repo Actions — tomscaria/swarm-fund-mvp — 2026-05-03

**Top pick for tomorrow:** #1 — Strip the `tests/test_strategies.py` path arg from `autoresearch.yml` so both test trees collect (DX, Small)
**Verdict:** Two HIGH-priority ideas that fix the *autoresearch nightly's own gate* — the same nightly that produced the 5 fix-PRs sitting on the queue. Top pick is a one-line YAML change that closes the two-tree footgun where it's most expensive (the unattended bot loop, not laptop). Two MED ideas (`dependabot.yml`, PR template) tighten the supply-chain + IC-review surface; one LOW-MED catches the autoresearch silent no-op. Yesterday's top pick (`ci.yml`) still hasn't shipped — carries over.

## Actions

### 1. Drop the `tests/test_strategies.py` path arg in `autoresearch.yml:86` so `pytest` honors the pyproject `testpaths = ["tests", "python/tests"]` setting
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:.github/workflows/autoresearch.yml:86 — current line is `pytest "tests/test_strategies.py" -k "${{ steps.pick.outputs.name }}" -x -q`. The hardcoded path bypasses pyproject's `[tool.pytest.ini_options] testpaths = ["tests", "python/tests"]` (also annotated inline: *"Caught 2026-04-23 after test_conviction.py was added and didn't appear in 'pytest' output"*). The nightly autoresearch loop runs unattended every 06:17 UTC (`cron: "17 6 * * *"`), picks one strategy, mutates its `.py` file, and gates on this one pytest invocation. `python/tests/` (which holds the TradingAgent / execution / conviction suites) is skipped silently. Today's commit `d83a935` ("fix: repair 7 pre-existing test failures") is the second documented incident of broken-tests slipping past the gate; the first was 2026-04-23. The smoke step also pre-installs the strategy via `pip install -e . || pip install -r requirements.txt || true` (line 85) — the `requirements.txt` fallback points at a file that does not exist in the repo, and the trailing `|| true` swallows install failures so a cold-deps environment runs `pytest` against partially-installed packages.
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** The autoresearch nightly's own gate stops silently skipping ~313 of the test-suite's tests. A bad LLM variant that touches `python/agents/<name>.py` (where the TradingAgent suites live) gets caught at the autoresearch step instead of after merge, and the nightly bot stops producing PRs the human IC must reject by hand.
**How:**
1. Replace `.github/workflows/autoresearch.yml:86`:
   ```yaml
   pytest -k "${{ steps.pick.outputs.name }}" -x -q
   ```
   No path arg — pytest resolves `testpaths` from `pyproject.toml`. Both `tests/` and `python/tests/` collect; `-k <name>` still narrows to the strategy under autoresearch.
2. While in the same step, replace line 85:
   ```yaml
   pip install -e ".[dev]"
   ```
   `[dev]` pulls the existing `pytest>=8.0`, `pytest-asyncio>=0.24`, `ruff>=0.5` extras from `pyproject.toml`. Drops the dead `requirements.txt` fallback and the `|| true` swallow. Pip's exit code now correctly fails the workflow when the project's deps cannot install.
3. The `pip install "anthropic>=0.39" pytest` line (line 45, "Install minimal deps") is now redundant — `[dev]` covers `pytest`, and `anthropic>=0.39` is a runtime dep declared in `[project.dependencies]`. Either drop the line or keep it as a fast-fail probe before the editable install. Recommend keeping as `python -m pip install --upgrade pip` only.
4. Run a `workflow_dispatch` of `autoresearch.yml` against `alchemist` post-merge to confirm both trees collect — look for the pytest header line counting collected items in the action log; should be a hundred-plus, not single digits.
**Definition of done:** The autoresearch nightly's "Smoke test (pytest)" step prints a collection count covering both trees on the next 06:17 UTC run; a deliberately-broken `python/agents/calibration_gap.py` import fails the nightly within 12 minutes; `requirements.txt` is no longer referenced anywhere in `.github/workflows/`.

### 2. Add `.github/dependabot.yml` covering `pip` (root) + `github-actions` weekly, grouped per-ecosystem
**Priority:** HIGH (leverage 4)
**Type:** Security
**Effort:** Small (hours)
**Anchor:** MISSING:.github/dependabot.yml — `pyproject.toml` declares ~50 runtime deps with `>=` lower bounds and no upper bound, including `anthropic>=0.39`, `py-clob-client` (no version pin at all), `py-builder-signing-sdk` (no pin), `hyperliquid-python-sdk>=0.9`, `psycopg2-binary>=2.9`, `httpx>=0.27`, `pydantic>=2.0`, `fastapi>=0.111`, `mcp>=1.0`. Three of the four most-recent merged PRs (#22, #25, #27) and several stale `fix(...)` PRs (#19, #20, #23, #24) are SDK / parser / build-sandbox patches — exactly the failure shape that dependabot lower-bound bumps would surface earlier. Two GitHub Actions workflows (`autoresearch.yml`, `swarm-watchdog.yml`) reference `actions/checkout@v4`, `actions/setup-python@v5`, `actions/cache@v4`. Differentiator vs. the 2026-04-25 `aaronjmars/aeon` dependabot suggestion: this one is `pip`-only (no npm), the ecosystem block uses `package-ecosystem: pip` (not `npm`), and the deps surface is the trading SDK / database driver / LLM-client cluster, not the dashboard frontend.
**Score:** L=4 C=5 N=4 (total 13/15)
**Impact:** Weekly PRs against the SDK + Action-version surface; turns the operator's current "I noticed `py-clob-client` 0.x has a fix" reactive cadence into a passive PR queue. Closes the supply-chain audit hole that AWS Activate / Anthropic Research Credits / Polymarket Builders Program reviewers sometimes ask about ("how do you track third-party CVEs in your trading stack?").
**How:**
1. Create `.github/dependabot.yml`:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: pip
       directory: "/"
       schedule:
         interval: weekly
         day: monday
         time: "08:00"
         timezone: "Etc/UTC"
       open-pull-requests-limit: 5
       groups:
         python-deps:
           patterns:
             - "*"
       labels:
         - "dependencies"
         - "python"
     - package-ecosystem: github-actions
       directory: "/"
       schedule:
         interval: weekly
         day: monday
         time: "08:00"
         timezone: "Etc/UTC"
       open-pull-requests-limit: 3
       labels:
         - "dependencies"
         - "github-actions"
   ```
   Grouping the pip ecosystem under a single `python-deps` group prevents the inbox from filling with 50 single-dep PRs; Monday 08:00 UTC stagger keeps it out of the 06:17 UTC autoresearch window and the every-30-min watchdog window.
2. Pre-create the `dependencies`, `python`, `github-actions` labels in the repo (operator UI step — call out in the PR description so the operator can prep the labels before merge; absent labels are silently dropped by dependabot).
3. The `autoresearch.yml` `cache: pip` step already keys on `**/pyproject.toml` — dependabot bumps will invalidate the cache cleanly.
4. Verify post-merge that the first weekly group PR opens with one consolidated body listing all updated pip deps (not 50 PRs).
**Definition of done:** The first dependabot run after merge opens at most one `python-deps` group PR and at most one `github-actions` group PR, both labeled `dependencies`; the configuration validates clean against `actions/dependabot-action` (no warnings in the dependabot logs tab).

### 3. Add `.github/PULL_REQUEST_TEMPLATE.md` enforcing the ADR-084 stats checklist (corrected-p, sample size, regime breakdown, lookahead lint)
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.github/PULL_REQUEST_TEMPLATE.md — no template at root, `.github/`, or `docs/`. The repo just shipped ADR-084 (`python/research/backtest_stats.py`, 2026-04-30 CHANGELOG entry) — six infrastructure-enforced statistical guardrails: K-tracking, Bonferroni correction, OOS auto-lock at `n_signals ≥ 30 AND corrected_p < 0.05`, fingerprint dedup, no-post-OOS-optimization, lookahead-bias linter. Every autoresearch-bot PR (e.g. PR #28 "test(variant_bandit): cover canonical_regime_label() normalization") and every operator `fix(...)` PR (#19, #20, #23, #24, all stalled) currently ships without the stats payload in the description, so the IC reviewer (Thomas) has to clone-and-replay the matrix locally to land a verdict. CLAUDE.md's "Decision logging (mandatory)" block already pins the *what-must-be-logged* contract; the PR template is the analogous gate at the merge-time surface.
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** Every PR — autoresearch-bot or human — opens with a populated checklist. IC reviewer's read-time drops from "clone + replay matrix" to "scan the PR body." When the autoresearch loop scales (yesterday's idea #4, dynamic registry → 49 strategies eligible per night), the per-PR review cost is the dominant scaling bottleneck; this template is the lever.
**How:**
1. Create `.github/PULL_REQUEST_TEMPLATE.md`:
   ```markdown
   ## What changed
   <one paragraph — what file, what behavior shift>

   ## Why
   <link to ADR-NNN if architectural; "bug fix" / "test" / "data refresh" / "doc" otherwise>

   ## Stats (autoresearch + strategy-touching PRs only — delete if not applicable)
   - **Strategy:** `<name>` (registry slug)
   - **Sample size:** N closed signals (target: ≥ 30 for OOS auto-lock)
   - **Raw p-value:** <decimal>
   - **Bonferroni-corrected p:** <decimal> (k = <unique factor fingerprints>)
   - **Per-regime Sharpe:** TREND `<x>` / RANGE `<y>` / VOL `<z>`
   - **Win rate:** <pct>
   - **OOS lock state after this PR:** LOCKED / FRESH (Xh) / STALE (Xd) / NEVER
   - **Lookahead lint:** clean / N findings (paste output)

   ## Tests
   - [ ] `pytest -m "not integration"` passes locally on both `tests/` and `python/tests/`
   - [ ] `python -m scripts.strategy_inventory --check` exits 0
   - [ ] `python -m python.research.lookahead_lint <strategy>` clean (strategy-touching only)

   ## Risk + rollback
   - **Surface:** <code path / agent / API endpoint>
   - **Rollback:** revert this PR. No DB migrations / no seed data writes / no on-chain transactions touched, OR <list>.

   ## Decision-log entry
   <ADR-NNN link from `DECISIONS.md`, OR "n/a — bug fix / data / doc">
   ```
2. Add a `.github/PULL_REQUEST_TEMPLATE/` directory with `default.md` (the above) plus optional `data_refresh.md` and `autoresearch_variant.md` so the autoresearch bot can pass `?template=autoresearch_variant.md` on `gh pr create`.
3. Update `autoresearch.yml:104` (the `gh pr create --body "..."` line) to populate the checklist fields from the variation_runner's emitted JSON sidecar (corrected_p, k, sample size). If the runner doesn't yet emit those, leave the template fields blank with `<unknown — see strategy admin page>` so the IC reviewer is at least cued to check.
4. Document the template in CLAUDE.md's "## Skill routing" block as the IC review surface.
**Definition of done:** Opening a new PR via the GitHub UI populates the body with the checklist; the next autoresearch nightly PR auto-populates the strategy + lookahead-lint fields; PR #28's body can be re-edited by hand to match the template (one-time backfill) without losing prior comments.

### 4. Notify Telegram when `autoresearch.yml` exits with no diff at line 95-96 instead of silently exiting 0
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:.github/workflows/autoresearch.yml:94-97 — `if git diff --cached --quiet; then echo "no diff — nothing to PR"; exit 0; fi`. When the LLM-driven `variation_runner` produces no diff (model 5xx, prompt failure, anthropic-API rate-limit, or a degenerate "I don't think this strategy needs changes" response), the workflow exits green and no PR opens. Operator has no visibility — silent autoresearch dropouts can run for nights before the operator notices a missing PR pattern. The repo's existing `swarm-watchdog.yml` already wires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (lines 39-40 of that workflow) — the secrets are present and the notification channel is the canonical operator-side alert path.
**Score:** L=3 C=4 N=5 (total 12/15)
**Impact:** Operator gets a one-line Telegram "autoresearch(<name>) produced no diff on run <id>" alert per silent nightly. Three nights of consecutive no-diff is the canary for a deeper variation_runner regression (anthropic-API auth flake, prompt drift, stale program.md).
**How:**
1. Edit `.github/workflows/autoresearch.yml` "Open PR" step (lines 88-105). Pass `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` into the env block alongside the existing `GH_TOKEN`:
   ```yaml
   - name: Open PR
     env:
       GH_TOKEN: ${{ github.token }}
       TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
       TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
   ```
2. Replace the no-diff branch (lines 94-97) with:
   ```bash
   if git diff --cached --quiet; then
     echo "no diff — nothing to PR"
     if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
       MSG="autoresearch(${NAME}) produced no diff on run ${{ github.run_id }} — variation_runner likely failed (anthropic API / prompt drift / stale program.md). https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"
       curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
         --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
         --data-urlencode "text=${MSG}" \
         > /dev/null || true
     fi
     exit 0
   fi
   ```
3. Stay with `exit 0` (not `exit 1`) — a no-diff is a soft failure of *content*, not the workflow itself; flipping the run red would mute the existing watchdog rate-limit budget.
4. Mirror the same alert into the existing `concurrency:` group's audit log if one is wired (none is today — defer to a follow-up if the operator wants centralized routing).
**Definition of done:** A staged `workflow_dispatch` of `autoresearch.yml` against a strategy whose program.md is intentionally truncated (no mutation space) emits a Telegram message within 30s of the run completing; the run still shows green; subsequent un-broken runs do not emit the alert.

### 5. Replace `autoresearch.yml`'s hardcoded `inputs.strategy` enum with `type: string` (default `alchemist`) and document the registry as the source of truth
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:.github/workflows/autoresearch.yml:14-19 — `type: choice` with `options: [alchemist, archer, mage, pathfinder, shepherd]`. Yesterday's idea #4 covered the *nightly rotation* side of the same drift (replacing the `STRATS=(…)` bash array with a registry read). The `workflow_dispatch` enum is the *manual dispatch* side of the same problem: operator can't fire `autoresearch.yml` against any of the 44 other registered strategies (`_STRATEGY_REGISTRY` in `python/agents/runner_swarm.py`, currently 49 entries per CLAUDE.md, just expanded to ~112 agents per the 2026-05-03 CHANGELOG). The enum is single-source-of-truth drift, captured in code review as a YAML-only edit.
**Score:** L=3 C=5 N=4 (total 12/15)
**Impact:** Manual `gh workflow run autoresearch.yml -f strategy=ta-rsi-divergence` (the first OOS auto-locked strategy per the 2026-04-30 release) actually works. Yesterday's idea #4 covered the nightly side; this idea covers the operator-dispatch side. Together they decouple `autoresearch.yml` from the hardcoded 5-strategy seed.
**How:**
1. In `.github/workflows/autoresearch.yml:9-19`, replace:
   ```yaml
   strategy:
     description: "Strategy name (dir under strategies/)"
     required: true
     default: "alchemist"
     type: choice
     options:
       - alchemist
       - archer
       - mage
       - pathfinder
       - shepherd
   ```
   with:
   ```yaml
   strategy:
     description: "Strategy name (registry slug from python.agents.runner_swarm._STRATEGY_REGISTRY). Run `python -m scripts.strategy_inventory --list` for the live set."
     required: true
     default: "alchemist"
     type: string
   ```
2. Keep the `Pick strategy` step's `if [ "${{ github.event_name }}" = "workflow_dispatch" ]` branch — it already reads `${{ inputs.strategy }}` as a string, no further code change needed (the change is upstream YAML only).
3. Document the registry-as-source-of-truth pattern in CLAUDE.md's "Skill routing" block: "When dispatching `autoresearch.yml` manually, the strategy name must match a key in `_STRATEGY_REGISTRY` (run `python -m scripts.strategy_inventory --list`)."
4. Pairs cleanly with yesterday's idea #4 — both edits in the same PR halve the drift surface.
**Definition of done:** `gh workflow run autoresearch.yml -f strategy=ta-rsi-divergence` succeeds on the first try and runs the variation against `strategies/ta-rsi-divergence/`; CLAUDE.md "Skill routing" has a one-line pointer to `scripts/strategy_inventory --list`.

## Monitor

### A. Squash the per-15-min "data: refresh site metrics" cron commits to a single daily commit, OR push to an orphan `metrics` branch
**Why not yet:** The pattern is unmissable in `git log` — 0251353, 28006c6, 8ff4963, 3ed16b2 are all "data: refresh site metrics" inside a single 30-minute slice (15:21, 15:06, 14:51, 14:36 UTC), and the prior 6 hours show 15 such commits interleaved with substantive `feat:` / `fix:` / `docs:` work. The fix needs to find and edit the workflow / cron job that emits them (likely `scripts/refresh-site-metrics.sh` plus a scheduled GitHub Action not in `.github/workflows/`, or an external cron pushing into the repo). That workflow is not visible in the GraphQL surface — `external-feature` would have to grep for it post-checkout, and the change touches the operator's deployment cadence (rswarm.ai metrics ingestion). Either path is an architectural call (orphan branch vs. force-squash vs. CI commit-only) that benefits from operator buy-in.
**Anchor:** TAXONOMY:NOISY_HISTORY — 15+ identical-message commits in 4 hours, ratio ≈ 1:2 against substantive commits over the same window.

### B. Merge the four stalled `fix(...)` PRs #19 / #20 / #23 / #24 + the new test PR #28
**Why not yet:** Same operator-side merge-action blocker as yesterday — without idea #1 above (or yesterday's `ci.yml` carry-over) producing a green check, the operator has no automated signal to base a one-click merge on. PR #28 (`test(variant_bandit): cover canonical_regime_label() normalization`, opened 2026-05-02) is the freshest, but it inherits the same "no PR-time CI" gap. Each is a 2-line bug fix or a single-file test addition with a clear anchor. Idea #1 above + yesterday's CI workflow together unblock all five.
**Anchor:** PR:#19 / PR:#20 / PR:#23 / PR:#24 / PR:#28 (oldest 6 days stale, newest 1 day fresh).

### C. Set the GitHub repo description and topics
**Why not yet:** Carry-over from yesterday's Monitor — `description: null`, `repositoryTopics: []` still as of today's GraphQL pull. These are operator UI settings (Settings → General). Suggested values unchanged: description from the README's first line ("Research lab studying agentic AI behavior in adversarial financial markets — the fund is the experimental apparatus, the P&L is the error bar"); topics: `prediction-markets`, `polymarket`, `algorithmic-trading`, `agentic-ai`, `calibration`, `research`.
**Anchor:** TAXONOMY:EMPTY_DESCRIPTION + TAXONOMY:NO_TOPICS.

## Fleet follow-ons

- **`aaronjmars/aeon`** (pushed 2026-05-03T13:35:34Z, 0 issues, 0 PRs, MIT-licensed): the 2026-05-01 top-pick shell-injection patch at `dashboard/app/api/secrets/route.ts:96` **landed** — current code at that line is `execFileSync('gh', ['secret', 'set', name, '-b', value], { stdio: 'pipe', cwd: process.cwd() })`, the exact `execFileSync(cmd, args[])` pattern proposed. ISS-016 trigger date (2026-05-07) is now moot; clear it from `memory/issues/INDEX.md` if it's still flagged. Today's distinct opportunity for that repo: `.github/dependabot.yml` (still missing) covering `npm` (dashboard, mcp-server) — same shape as today's idea #2 but on the JS surface.
- **`tomscaria/lore-financial-teaser`** (pushed 2026-05-01T23:21:27Z, 0 issues, TypeScript): pushedAt has not advanced since the 05-02 follow-on — same one-line suggestion stands (port idea #1's pyproject-mediated CI thinking to a Next.js / Vercel `next lint` + `npm test` gate). Out of scope today.

---

**Source status:** gh=ok code_search=n/a (private repo — GitHub code-search index returns 404 cross-repo for unauth'd app) memory_topics=missing (no `memory/topics/repos.md` — taxonomy seeded from MEMORY.md + CLAUDE.md) articles_dir=ok watched_repos=3 parsed (target = swarm-fund-mvp by `pushedAt` 2026-05-03T15:21:33Z)
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** 2026-05-02 top pick (`.github/workflows/ci.yml` running ruff + pytest both trees + `strategy_inventory --check`) — still un-shipped as of today's pushedAt; CI workflow remains the highest-leverage carry-over and is structurally complementary to today's #1 (idea #1 hardens the autoresearch nightly's gate; the carry-over hardens every PR's gate). Today's #1 + #2 are the smallest YAML edits to the same `autoresearch.yml` and can ship as a single PR before the carry-over.

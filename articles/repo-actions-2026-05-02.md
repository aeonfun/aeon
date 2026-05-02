# Repo Actions — tomscaria/swarm-fund-mvp — 2026-05-02

**Top pick for tomorrow:** #1 — Add `.github/workflows/ci.yml` with ruff + pytest (both test trees) + `python -m scripts.strategy_inventory --check` (DX, Medium)
**Verdict:** Four HIGH-priority ideas this cycle, all anchored to structural CI / autoresearch gaps. The repo runs `autoresearch.yml` (nightly variation runner) and `swarm-watchdog.yml` (every 30 min API monitor) — but has zero PR-time test or lint workflow, which is why four `fix(...)` PRs (#19 / #20 / #23 / #24, oldest 5 days stale) are sitting unverified. Top pick closes that gap; ideas #2-#4 compound it; idea #5 is supporting hygiene.

## Actions

### 1. Add `.github/workflows/ci.yml` running ruff + pytest (both trees) + `strategy_inventory --check` on every PR
**Priority:** HIGH (leverage 5)
**Type:** DX
**Effort:** Medium (1–2 days)
**Anchor:** MISSING:.github/workflows/ci.yml — `.github/workflows/` only ships `autoresearch.yml` (nightly variation proposer, schedule `17 6 * * *`) and `swarm-watchdog.yml` (every 30 min, API liveness). There is no PR-time `pytest` or `ruff` workflow. PR:#19 (`fix(ssrn_harvest): use cursor.rowcount, not connection.total_changes`, 2-line diff at `python/research/papers/ssrn_harvest.py:210`, opened 2026-04-27, last update 2026-04-27 = 5 days no activity), PR:#20 (`fix(harvest): correct markdown image-strip regex bracket order`, 4 days stale), PR:#23 (`fix(runner): use fractional days for pm-tail-risk fair-prob horizon`, 2 days stale), and PR:#24 (`fix(triage): defensive parsing of LLM scores + reasoning`, 1 day stale) all show `mergeable_state: unknown` because nothing runs to compute it. `pyproject.toml` already declares `pytest>=8.0`, `pytest-asyncio>=0.24`, `ruff>=0.5` under `[project.optional-dependencies] dev`, and `testpaths = ["tests", "python/tests"]` is pinned (with the inline note `Caught 2026-04-23 after test_conviction.py was added and didn't appear in "pytest" output`).
**Score:** L=5 C=5 N=5 (total 15/15)
**Impact:** Every PR (the four currently stalled, plus the next nightly autoresearch-bot variation PR, plus every Aeon-authored fix) gets a green-or-red signal in <10 minutes. The "two test trees" footgun that cost half the suite on 2026-04-23 cannot recur silently because both trees are explicitly collected by CI. The unwrapped-strategy invariant (currently watched daily by `laptop-verify.sh` and every 30 min by `swarm-watchdog.yml`) shifts left to PR time.
**How:**
1. Create `.github/workflows/ci.yml` with `on: [pull_request, push]` (filter `push` to `main`). Runner: `ubuntu-latest`, timeout 15 min.
2. Steps: `actions/checkout@v4`, `actions/setup-python@v5` with `python-version: "3.11"` and `cache: pip`.
3. Install: `pip install -e ".[dev]"`. (Falls through to `pyproject.toml` `[project.optional-dependencies] dev` — no `requirements.txt` duplication needed.)
4. Step `Lint`: `ruff check .` (uses the `[tool.ruff]` block already pinned at `target-version = "py311"`, `line-length = 100`).
5. Step `Test`: `pytest -x -q` — `testpaths = ["tests", "python/tests"]` is already in `pyproject.toml`, so both trees are collected. No `-k` filter (unlike the autoresearch nightly which scopes to one strategy).
6. Step `Strategy inventory drift`: `python -m scripts.strategy_inventory --check` — exit 1 fails CI when an `unwrapped+untracked` strategy ships, mirroring the daily/30-min cadence at PR time.
7. Add a status-required setting on `main` for the new workflow (operator GitHub UI step — call out in the PR description, not blocking the CI file itself from merging).
8. Heavy DB-bound suites (`test_api_strategies.py`, `test_drawdown.py`, anything that pulls QuestDB / PostgreSQL from `infra/`) get marked with `@pytest.mark.integration` and excluded from CI via `-m "not integration"`. This keeps CI under 5 min runtime; integration suites stay in `laptop-verify.sh`.
**Definition of done:** A PR with a deliberately broken import in `python/agents/calibration_gap.py` fails the new workflow within 10 minutes; PR #19's existing 2-line fix passes cleanly; the workflow appears in the four stale PRs' "Checks" tab on rebase.

### 2. Upload `data/watchdog_baseline.json` from `swarm-watchdog.yml` as a 90-day retention artifact for grant / LP evidence trail
**Priority:** HIGH (leverage 4)
**Type:** Content (grant evidence)
**Effort:** Small (hours)
**Anchor:** FILE:.github/workflows/swarm-watchdog.yml — runs every 30 min, executes `python3 scripts/watchdog_check.py`, currently caches `data/watchdog_baseline.json` between runs via `actions/cache@v4` keyed on `github.run_id` with `restore-keys: watchdog-baseline-`. The file is preserved across runs but is *not* uploaded as an artifact, so there is no externally readable per-run snapshot — auditors and grant committees cannot replay a watchdog state without API access to `${{ secrets.SWARM_API_URL }}` (which they do not have). CLAUDE.md priority #3 ("live P&L proof for LP raise"); CLAUDE.md priority #1 ("near-term grants — AWS Activate, Anthropic Research Credits, dYdX, Uniswap Foundation Fellowship, Polymarket Builders Program, Harmonic") both depend on a verifiable evidence trail. GitHub Actions retains workflow artifacts ≤90 days by default — that is 4,320 watchdog snapshots at the current 30-min cadence.
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** Every grant application or LP conversation gets a one-line link ("watchdog snapshot at run https://github.com/tomscaria/swarm-fund-mvp/actions/runs/<id>") instead of "trust me, the system was up." Concrete acceptance: a reviewer with read access to the private repo can pull a `data/watchdog_baseline.json` from any 30-min slot in the last 90 days without operator-side intervention.
**How:**
1. Append a step to the `check` job in `swarm-watchdog.yml` after `Run watchdog`:
   ```yaml
   - name: Upload baseline artifact
     if: always()  # also publish on degradation (exit 2) and unreachable (exit 1)
     uses: actions/upload-artifact@v4
     with:
       name: watchdog-baseline-${{ github.run_id }}
       path: data/watchdog_baseline.json
       retention-days: 90
       if-no-files-found: warn
   ```
2. The cache step (`actions/cache@v4`, `key: watchdog-baseline-${{ github.run_id }}`) stays — it serves the rolling-baseline-across-runs purpose. The artifact step adds the externally-fetchable snapshot.
3. Verify `data/watchdog_baseline.json` does not contain any secret material (the watchdog computes derived state — agent fitness, regime breakdown, drawdown — from a public-API surface; double-check `scripts/watchdog_check.py` to confirm and document the file's schema in a one-paragraph header comment).
4. Add a one-line addendum to `outputs/investor_deck_seed.md` (and to whatever grant-application boilerplate exists under `outputs/`) pointing at the artifact-link pattern.
**Definition of done:** After the next scheduled run, `gh run download <run-id> -R tomscaria/swarm-fund-mvp -n watchdog-baseline-<run-id>` returns a JSON file with the expected schema; a sample artifact link goes into the next grant draft body.

### 3. Add `python/tests/test_strategy_inventory_invariant.py` — pytest regression that asserts `scripts.strategy_inventory --check` exits 0
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:scripts/strategy_inventory.py (20,626 bytes, ADR-086 enforcer) + the invariant text in `CLAUDE.md`: "Same `--check` runs daily via `scripts/laptop-verify.sh`, every 30 min via `.github/workflows/swarm-watchdog.yml`, and as a 'Coverage drift' section in the Monday `scripts/eval_one_shot.py` digest." There is no PR-time gate — a contributor (or autoresearch-bot) can introduce an `unwrapped+untracked` strategy and the failure surfaces only after merge, in the next daily run. With idea #1's CI lifting this to PR time, the invariant deserves a sibling pytest test so failures show up in the existing test report instead of as a separate workflow step (and so it remains caught even if the CI YAML is later split or trimmed).
**Score:** L=4 C=5 N=4 (total 13/15)
**Impact:** Every contributor running bare `pytest` locally sees the inventory check fire as a normal test, not as a separate manual incantation. Catches the same "I added strategies/foo/ but forgot the runner-swarm wrap" regression that ADR-086 was authored to prevent — at the moment of `git push`, not the next morning.
**How:**
1. Create `python/tests/test_strategy_inventory_invariant.py` (~30 lines):
   ```python
   import subprocess
   import sys
   from pathlib import Path

   REPO_ROOT = Path(__file__).resolve().parents[2]

   def test_strategy_inventory_check_clean():
       result = subprocess.run(
           [sys.executable, "-m", "scripts.strategy_inventory", "--check"],
           cwd=REPO_ROOT,
           capture_output=True,
           text=True,
           timeout=60,
       )
       assert result.returncode == 0, (
           f"strategy_inventory --check failed (exit {result.returncode}).\n"
           f"stdout:\n{result.stdout}\n"
           f"stderr:\n{result.stderr}\n"
           "An unwrapped+untracked strategy was introduced — either wrap it in "
           "_STRATEGY_REGISTRY (python/agents/runner_swarm.py) or add a TASKS.md "
           "entry under the active session describing how the wrap will land."
       )
   ```
2. The test runs the existing module — no new dependencies, no shape change to `scripts/strategy_inventory.py`.
3. Mark with `@pytest.mark.smoke` if a `smoke` marker exists; otherwise leave unmarked so it runs in the default collection.
4. Verify locally: `pytest python/tests/test_strategy_inventory_invariant.py -v` against `main` should pass; deliberately unwrap a strategy and re-run should fail with the diagnostic.
**Definition of done:** The test passes on `main`, the failure message points the contributor at the exact remediation path, and the test is collected by both `pytest` (default) and the new CI workflow from idea #1.

### 4. Replace the hardcoded 5-strategy rotation in `autoresearch.yml` with a dynamic read of `_STRATEGY_REGISTRY` (49 registered strategies)
**Priority:** HIGH (leverage 4)
**Type:** Feature (research throughput)
**Effort:** Small (hours)
**Anchor:** FILE:.github/workflows/autoresearch.yml lines 50-60 — the nightly rotation hardcodes `STRATS=(alchemist archer mage pathfinder shepherd)` and picks `IDX=$(( $(date -u +%u) % ${#STRATS[@]} ))`. CLAUDE.md says: "**Strategy fleet:** auto-generated inventory at `outputs/research/STRATEGY_INVENTORY.md` (ADR-086) … `python/agents/runner_swarm.py` wraps 6 PM-family strategies × 3–5 factor variants = 20 paper-trading TradingAgents." The same file lists 49 registered strategies. The autoresearch loop currently explores ~10% of the registered space, and the array drifts every time a new strategy is wrapped (no lint catches the drift; it only manifests as "this strategy never gets autoresearch'd"). The `workflow_dispatch` `options:` enum is also hardcoded to the same five.
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** Multiplies research-loop coverage by ~10× (5 → 49 strategies eligible for nightly variation) without adding any new compute beyond what already runs (one strategy / night unchanged; just rotates over a longer cycle). Pillar 3 strategy families that have been running paper-trade for weeks finally enter the Karpathy variation loop.
**How:**
1. In `autoresearch.yml`'s `Pick strategy` step, replace the hardcoded array with:
   ```bash
   if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
     echo "name=${{ inputs.strategy }}" >> "$GITHUB_OUTPUT"
   else
     # Read the registry — auto-rotates as new strategies wrap.
     STRATS=$(python -c "from python.agents.runner_swarm import _STRATEGY_REGISTRY; print(' '.join(sorted(_STRATEGY_REGISTRY.keys())))")
     STRATS_ARR=($STRATS)
     IDX=$(( $(date -u +%j) % ${#STRATS_ARR[@]} ))  # day-of-year for daily-unique slots over a 365/N cycle
     echo "name=${STRATS_ARR[$IDX]}" >> "$GITHUB_OUTPUT"
   fi
   ```
2. Move the registry import behind a try/except so a registry-load failure surfaces as a clear workflow error, not a confusing empty-array crash.
3. For `workflow_dispatch`, switch from `type: choice` (which requires a hardcoded `options:` list) to `type: string` (free text) with a default of `alchemist` — the operator picks any registered name. Document the registry-name list in `CLAUDE.md`'s skill-routing block (single-source-of-truth pointer).
4. Verify `pytest tests/test_strategies.py -k "<name>"` works against any name pulled from the registry — if some registered strategies don't have a matching test selector (the `-k` substring test), either rename the test class or add an `# autoresearch:skip` marker to the registry entry. Out-of-scope strategies stay out of the rotation by exclusion list, not by silent omission.
**Definition of done:** A nightly run after the change selects a strategy outside the original 5-set on the appropriate day (verifiable from the workflow log's `name=...` output line); `_STRATEGY_REGISTRY` add-then-merge introduces the new strategy into the rotation immediately on the next nightly without further workflow edits.

### 5. Add `.pre-commit-config.yaml` running ruff + check-yaml + end-of-file-fixer + trailing-whitespace
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.pre-commit-config.yaml — `pyproject.toml` already declares `ruff>=0.5` under `dev`, and the operator's commit cadence is dense (15 `data: refresh site metrics` commits in the last 4 hours alone). Pre-commit catches `ruff` lint and YAML drift before push, not after CI runs in idea #1, which also reduces noisy CI failures and shrinks the PR-loop time on the small `fix(...)` PRs the autoresearch loop produces.
**Score:** L=3 C=5 N=4 (total 12/15)
**Impact:** Every commit gets local lint/format guarantees in <2s. The four currently-stale PRs would each have surfaced ruff lint locally before push if pre-commit had been wired. Pairs cleanly with idea #1: pre-commit catches the cheap stuff, CI catches the expensive stuff.
**How:**
1. Create `.pre-commit-config.yaml`:
   ```yaml
   repos:
     - repo: https://github.com/pre-commit/pre-commit-hooks
       rev: v4.6.0
       hooks:
         - id: check-yaml
         - id: end-of-file-fixer
         - id: trailing-whitespace
         - id: check-merge-conflict
         - id: check-added-large-files
           args: ["--maxkb=500"]
     - repo: https://github.com/astral-sh/ruff-pre-commit
       rev: v0.5.0
       hooks:
         - id: ruff
           args: ["--fix"]
         - id: ruff-format
   ```
2. Add `pre-commit` to `[project.optional-dependencies] dev` in `pyproject.toml`.
3. Add a one-paragraph "Local setup" block to README.md or CLAUDE.md (pick whichever is the contributor onboarding entry — README.md → "If you're Claude Code" section is the obvious spot): `pip install -e ".[dev]" && pre-commit install`.
4. Add a `pre-commit` step to the new CI workflow (idea #1) as a fast first gate: `- run: pip install pre-commit && pre-commit run --all-files` — if the local hook is skipped, CI still catches it.
**Definition of done:** `pre-commit run --all-files` on `main` exits 0 (any pre-existing drift is fixed in the same PR); a deliberate trailing-whitespace edit fails the local hook before commit; the four stale PRs would each pass after rebase.

## Monitor

### A. Merge stalled `fix(...)` PRs #19, #20, #23, #24
**Why not yet:** Each is a 2-line bug fix with a clear anchor (PR#19 → `python/research/papers/ssrn_harvest.py:210`; PR#20 → markdown-image-strip regex; PR#23 → fractional-days fair-prob horizon; PR#24 → defensive LLM-score parsing). All show `mergeable_state: unknown` because no PR-time CI runs, so the operator has nothing to base a one-click merge on. Idea #1 produces the green-check signal that turns these into operator-mergeable in minutes — but the merge itself is an operator action, not autonomous.
**Anchor:** PR:#19 / PR:#20 / PR:#23 / PR:#24 (all stale ≥1 day, oldest 5 days).

### B. Add `LICENSE` at repo root (MIT or Apache-2.0)
**Why not yet:** `tomscaria/swarm-fund-mvp` is a private repo today (`visibility: private`, 1 star, 0 forks). Adding a LICENSE is a license-policy decision the operator needs to make — proprietary vs. permissive, AGPL vs. MIT. Once the visibility flips (e.g., for grant or PhD application reference), `external-feature` can ship the chosen text in a single commit.
**Anchor:** MISSING:LICENSE (no `LICENSE`, no `LICENSE.md`, no `licenseInfo.spdxId` in repo metadata).

### C. Set the GitHub repo description and topics
**Why not yet:** `description: null` and `repositoryTopics: []` on the repo. These are operator UI settings (Settings → General) that `external-feature` cannot toggle from a PR. One-paragraph candidate: "Research lab studying agentic AI behavior in adversarial financial markets — the fund is the experimental apparatus, the P&L is the error bar." Topics: `prediction-markets`, `polymarket`, `algorithmic-trading`, `agentic-ai`, `calibration`, `research`.
**Anchor:** TAXONOMY:EMPTY_DESCRIPTION + TAXONOMY:NO_TOPICS.

## Fleet follow-ons

- `tomscaria/lore-financial-teaser` (pushed 2026-05-01T23:21:27Z, 0 open issues, 1 star): teaser site for the lab — likely Next.js / Vercel; same `.github/workflows/ci.yml` template from idea #1 (substituting `npm test` / `next lint` for pytest) ports cleanly. Out of scope today; revisit when its `pushedAt` advances above swarm-fund-mvp's.
- `aaronjmars/aeon` (yesterday's target): yesterday's top pick (shell-injection at `dashboard/app/api/secrets/route.ts:96`) is **still unpatched** — verified the `execSync(\`gh secret set ${name} -b "${value.replace(/"/g, '\\\\"')}"\`)` pattern is intact at lines 90-100. Six days remaining before `skill-security-scan` files ISS-016. No new today-side action; carry-over only.

---

**Source status:** gh=ok code_search=n/a (private repo — GitHub code-search index does not return matches; TODO/FIXME grep returned 0 across calibration_gap.py / main.py / runner_swarm.py / api/server.py — operator hygiene is high) memory_topics=missing (no `memory/topics/repos.md` — taxonomy seeded from MEMORY.md + CLAUDE.md instead) articles_dir=ok watched_repos=3 parsed (target = swarm-fund-mvp by `pushedAt`)
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** 05-01 top pick (shell-injection patch in `aaronjmars/aeon` `dashboard/app/api/secrets/route.ts:96`) — still unpatched as of today; yesterday's run was the last carrier. No swarm-fund-mvp top pick to carry over (this is the first repo-actions cycle for this target).

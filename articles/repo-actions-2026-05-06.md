# Repo Actions — tomscaria/swarm-fund-mvp — 2026-05-06

**Top pick for tomorrow:** #1 — Skip-when-noop guard in `scripts/refresh-site-metrics.sh` to drop the metrics-only commit + Vercel deploy when no field shifted (DX, Small)
**Verdict:** Yesterday's #1 (`Investors.tsx` `InvestorViz` wiring) shipped — verified at HEAD: imports added at line 15, all six `data-slot` divs now carry `data-filled="true"` and a wrapped component. Yesterday's #2 / #3 / #4 / #5 and Monitor A all remain UN-shipped. The pushed-since-yesterday changes are 100% metrics-refresh churn — every one of the last 100 commits on `main` is `data: refresh site metrics` (cadence 15 min, span 2026-05-05T16:13Z → 2026-05-06T17:10Z). Top pick attacks that surface directly: the LaunchAgent fires every 15 min unconditionally, the script commits whenever the file byte-changes, and most refreshes only move a `generated_at` timestamp — a noop-guard cuts the commit log on `main` from 96/day to ~10–20/day and frees Vercel budget. Three of the remaining four ideas anchor to the ADR-093 falsifier deadline (11 days remaining at 2026-05-17): one CI canary, two regression tests including a PR #31 lock-in. Idea #4 protects the live investor surface from a `metrics.json` shape regression.

## Actions

### 1. Add a skip-when-noop guard to `scripts/refresh-site-metrics.sh` so the metrics commit + Vercel deploy fire only when a structurally-meaningful field changed
**Priority:** HIGH (leverage 5)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:scripts/refresh-site-metrics.sh (40+ line script invoked by `~/Library/LaunchAgents/ai.rswarm.metrics.plist` at `StartInterval=900`) + TAXONOMY:NOISY_HISTORY (the last **100 commits on `main` are all** `data: refresh site metrics`, span 2026-05-05T16:13:45Z → 2026-05-06T17:10:36Z = 25h, 100/100 = 100% pollution rate; same pattern was Monitor B 2026-05-04 + 2026-05-05 but un-attacked) + the script's own embedded budget table at lines 13–22 (`StartInterval 900 = 96 deploys/day, FITS Hobby (tight)`). The script today regenerates `swarm-lab-site/public/metrics.json` from live agent state, runs `git diff --quiet` on the file, and if anything byte-changed it commits + pushes + fires `vercel --prod`. The byte-change gate is too coarse: every refresh updates `generated_at` (ISO timestamp at line 2 of the file — confirmed `"generated_at": "2026-05-06T17:10:36.165262Z"`) plus per-agent `mean_edge_bps_*` floats that drift by sub-0.1% intra-quarter-hour even when no trade closes. The reviewer surface is the public commit log on `tomscaria/swarm-fund-mvp/main` — and a grant committee landing there sees an apparently-dead repo where the only activity is robot-bot churn.
**Score:** L=5 C=5 N=5 (total 15/15)
**Impact:** Public `main` history flips from "96 metrics-refresh commits/day burying the substantive work" to "5–20 commits/day, each tied to an actual trade closure or agent-state shift." Vercel deploy budget reclaimed: the Hobby-tier 100/day cap currently runs at 96/day on metrics alone — a noop-guard typically cuts this to 10–20/day, leaving 75+ deploys/day of headroom for substantive site updates without a tier upgrade. Reviewer-side: an LP / grant-committee click-through to the commit log sees real activity instead of an apparent metrics-bot graveyard. CHANGELOG / `git log --oneline` becomes useful again. Pairs with mission goal #1 (near-term grants/advisory income) by removing the single most off-putting surface signal a grant reviewer encounters when they click through from a citation link.
**How:**
1. Edit `scripts/refresh-site-metrics.sh`. After the `python generate_site_metrics.py` step that writes `${METRICS_FILE}` and before the `git diff --quiet` gate, insert a structural-noop check. Read the prior committed version of the file from `git show HEAD:${METRICS_FILE}`, parse both old and new with `python3 -c`, and compare a fixed list of *structurally meaningful* fields:
   ```bash
   # Skip-when-noop guard — only commit when a meaningful field changed.
   # Bypasses sub-bp float drift in mean_edge_bps_* and generated_at timestamp updates.
   PRIOR=$(mktemp)
   "${GIT}" show "HEAD:${METRICS_FILE}" > "${PRIOR}" 2>/dev/null || echo '{}' > "${PRIOR}"
   if "${PYTHON}" -c "
   import json, sys
   prior = json.load(open('${PRIOR}'))
   curr  = json.load(open('${METRICS_FILE}'))
   def digest(d):
       return tuple(sorted(
           (a.get('agent_id'), a.get('lifecycle'), a.get('closed_trades'),
            a.get('open_positions'), round(a.get('win_rate', 0.0), 3),
            round(a.get('total_pnl_usd', 0.0), 2), round(a.get('sharpe', 0.0), 2))
           for a in d.get('agents', [])
       ))
   sys.exit(0 if digest(prior) == digest(curr) else 1)
   "; then
       rm -f "${PRIOR}"
       echo 'metrics: noop refresh — no commit, no deploy'
       exit 0
   fi
   rm -f "${PRIOR}"
   ```
2. The five-field digest (`agent_id`, `lifecycle`, `closed_trades`, `open_positions`, `win_rate@0.001`, `total_pnl_usd@0.01`, `sharpe@0.01`) is the minimum set that maps to anything an LP reviewer cares about. `generated_at` is intentionally excluded. `mean_edge_bps_*` is excluded — sub-bp drift is noise not signal at the daily-summary granularity. If a trade closes, `closed_trades` increments; that always triggers. If an agent graduates Birth → Canary, `lifecycle` shifts; that always triggers. If P&L moves >$0.01 USD or Sharpe shifts >0.01, that triggers.
3. Keep the existing `git diff --quiet "${METRICS_FILE}" >/dev/null && exit 0` byte-gate — the structural digest is an *additional* exit, not a replacement. Order: byte-gate first (cheapest), then structural digest if bytes changed. Both pass → exit 0.
4. The `${PYTHON}` resolves to `${REPO_ROOT}/.venv/bin/python` per the existing script — no new deps. `mktemp` is BSD-compatible (the script runs on macOS via launchd per the file header). The `git show HEAD:${METRICS_FILE}` is a read-only operation that does not touch the working tree.
5. Validate locally before commit:
   - Snapshot `swarm-lab-site/public/metrics.json` to a temp file.
   - Run `bash scripts/refresh-site-metrics.sh` against a stale state. Confirm the new exit-0 path fires when only `generated_at` would have moved (force this by `touch`-restoring an old version while the live state is unchanged). Confirm the script still commits + deploys when `closed_trades` moves on any agent (force this by hand-editing `metrics.json` to bump one agent's `closed_trades` by 1, then `git checkout -- metrics.json` after verifying the deploy fires).
6. Tighten the cadence as a follow-on (separate change, separate PR) — once the noop-guard is in, the LaunchAgent `StartInterval=900` (15 min) is over-provisioned. The right cadence becomes "as fast as you want; the guard handles the budget." Don't bundle the cadence change in this PR — keep the change blast-radius narrow.
**Definition of done:** A bare `bash scripts/refresh-site-metrics.sh` against an unchanged-state HEAD exits 0 with the line `metrics: noop refresh — no commit, no deploy` printed; no `git commit`, no `vercel --prod` invocation. The same script against a state where one agent's `closed_trades` ticked up by 1 commits + pushes + deploys exactly once. The next 24h of LaunchAgent-driven refreshes show ≤30 `data: refresh site metrics` commits on `main` (down from 96).

### 2. Add `.github/workflows/aeon-falsifier-canary.yml` — daily cron probing the expected `tomscaria/aeon` outputs URL and opening a GitHub issue at T-3 days from the 2026-05-17 ADR-093 deadline if no `outputs/{skill}/{date}.json` has ever returned 200
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** ADR-093 (`Aeon ingestion adapter`, CHANGELOG 2026-05-03 entry — *"polling adapter that fetches committed JSON from `tomscaria/aeon` GitHub repo and converts to `MarketTick` objects with `kind=\"aeon_signal\"`"*) + `python/execution/aeon_adapter.py:31` (`AEON_SKILLS = ("monitor-polymarket", "polymarket-comments", "narrative-tracker")`) + `RAW_URL_TEMPLATE = "https://raw.githubusercontent.com/{repo}/main/outputs/{skill}/{date}.json"` (line 32) + MEMORY-tracked falsifier deadline 2026-05-17 (`MEMORY.md`: *"`tomscaria/aeon` must ship `outputs/{skill}/{date}.json` JSON contract by ~2026-05-17 or ADR-093 wire-up is aspirational. **11 days remaining.**"*) + TAXONOMY:MISSING_CI for the falsifier-monitoring surface. Yesterday's #3 proposed an in-tree unit test against a fixture; that locks in the *parser's* shape contract but does not detect whether the *producer* (tomscaria/aeon) has ever shipped a single real output. This workflow closes the gap from the live-monitoring side.
**Score:** L=4 C=4 N=4 (total 12/15)
**Impact:** A daily reading on whether the ADR-093 wire-up is still aspirational or has been realized. If `tomscaria/aeon` commits its first `outputs/monitor-polymarket/2026-05-NN.json` tomorrow, the workflow's next run flips green and stays green; if the deadline arrives without a single 200, the workflow opens a GitHub issue at T-3 (2026-05-14) with the explicit T-N countdown so the operator has a forced inflection point in the inbox, not just a `MEMORY.md` line. Closes the ADR-093 falsifier from the consumer side without blocking on the producer side. The `gh issue create` path uses the workflow's auto-issued `GITHUB_TOKEN` — no secrets to add, no operator-side config step.
**How:**
1. Create `.github/workflows/aeon-falsifier-canary.yml`:
   ```yaml
   name: aeon-falsifier-canary

   on:
     schedule:
       - cron: "30 9 * * *"     # 09:30 UTC daily
     workflow_dispatch:

   permissions:
     contents: read
     issues: write

   jobs:
     probe:
       runs-on: ubuntu-latest
       timeout-minutes: 3
       env:
         AEON_REPO: tomscaria/aeon
         DEADLINE: "2026-05-17"
         SKILLS: "monitor-polymarket polymarket-comments narrative-tracker"
       steps:
         - name: Probe today + lookback 2 days for any 200
           id: probe
           run: |
             set -euo pipefail
             ANY_200=0
             FOUND_DETAILS=""
             TODAY=$(date -u +%Y-%m-%d)
             for d in 0 1 2; do
               D=$(date -u -d "-${d} day" +%Y-%m-%d)
               for SKILL in $SKILLS; do
                 URL="https://raw.githubusercontent.com/${AEON_REPO}/main/outputs/${SKILL}/${D}.json"
                 STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" "${URL}")
                 if [ "${STATUS}" = "200" ]; then
                   ANY_200=1
                   FOUND_DETAILS="${FOUND_DETAILS}${SKILL}/${D} "
                 fi
               done
             done
             T_MINUS=$(( ($(date -u -d "${DEADLINE}" +%s) - $(date -u +%s)) / 86400 ))
             echo "any_200=${ANY_200}" >> "$GITHUB_OUTPUT"
             echo "details=${FOUND_DETAILS}" >> "$GITHUB_OUTPUT"
             echo "t_minus=${T_MINUS}" >> "$GITHUB_OUTPUT"
             echo "today=${TODAY}" >> "$GITHUB_OUTPUT"
             echo "Probe: any_200=${ANY_200} t_minus=${T_MINUS} found=${FOUND_DETAILS:-none}"

         - name: Open issue if T-3 days and no 200 ever
           if: steps.probe.outputs.any_200 == '0' && fromJSON(steps.probe.outputs.t_minus) <= 3
           env:
             GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           run: |
             TITLE="ADR-093 falsifier window: T-${{ steps.probe.outputs.t_minus }} days, no Aeon outputs detected"
             # Idempotency: don't dup if an open issue with this title already exists.
             EXISTING=$(gh issue list --state open --search "in:title \"$TITLE\"" --json number --jq '.[0].number // empty')
             if [ -n "${EXISTING}" ]; then
               echo "Issue #${EXISTING} already open; skipping."
               exit 0
             fi
             gh issue create \
               --title "${TITLE}" \
               --body "Daily ${{ steps.probe.outputs.today }} canary against \`tomscaria/aeon\` returned **0 of 9 URLs with HTTP 200** (3 skills × 3 days lookback). \`python/execution/aeon_adapter.py\` will receive zero ticks until the producer ships a real output. ADR-093 wire-up is aspirational at deadline T-${{ steps.probe.outputs.t_minus }}. See workflow run for full per-URL log." \
               --label "adr-093" 2>/dev/null || gh issue create --title "${TITLE}" --body "..."
   ```
2. The first daily run on a clean repo (with no `tomscaria/aeon` outputs ever shipped) at `t_minus > 3` will exit 0 silently. Once `t_minus ≤ 3` the issue-open step fires once and is idempotent on subsequent runs (the `gh issue list --search` dedup gate).
3. The `--label "adr-093"` will fail-soft if the label doesn't exist — the second `gh issue create` after the `||` is the fallback. As a one-time pre-step, run `gh label create adr-093 --color B60205 --description "ADR-093 Aeon ingestion adapter falsifier window"` from the operator's shell. Not blocking; the workflow degrades gracefully.
4. The `GITHUB_TOKEN` baked into Actions is enough — no `PERSONAL_ACCESS_TOKEN`, no Slack/Discord webhook secrets to plumb. The workflow is fully autonomous from a fresh repo.
5. Set the cron at 09:30 UTC (post-Aeon's 09:00 UTC daily skill window per `aeon.yml`) so a same-day probe sees same-day outputs if they shipped. If the operator wants Telegram/Slack notify in addition to the issue-open, that's a follow-on (the secrets matrix is already in `CLAUDE.md`).
**Definition of done:** `gh workflow run aeon-falsifier-canary.yml` succeeds in <2 minutes and prints `Probe: any_200=0 t_minus=11 found=none` (current state). At T-3 (2026-05-14), an automatic run opens issue with title `ADR-093 falsifier window: T-3 days, no Aeon outputs detected`. The first time `tomscaria/aeon` commits any of the 9 expected URLs, the next probe-run prints `any_200=1 found=<skill>/<date>` and the issue-open step is skipped.

### 3. Add `python/tests/test_aeon_adapter_recovery.py` — `httpx.MockTransport` test driving `_poll_loop` against a 5xx → 200 sequence and asserting `_last_error` clears on recovery (locks in PR #31's spec)
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (1 day)
**Anchor:** PR:#31 (`fix(aeon_adapter): clear _last_error after successful poll`, opened 2026-05-05T17:08Z by `tomscaria`, head `ai/aeon-adapter-clear-last-error`, non-draft, last-updated 2026-05-06T09:12Z, 1d24h old at this writing) + FILE:python/execution/aeon_adapter.py:80-94 (the `_poll_loop` exception handler, where `_last_error` is set on `Exception` but only PR #31's diff adds the `else` clause clearing it on success). PR #31's body cites the test it adds (`TestAeonAdapterPollLoop.test_last_error_clears_after_recovery`) but that test patches `_poll_once` — it does not exercise the actual `httpx` call path nor the `_seen_entries` dedup. A separate end-to-end recovery test that drives `_poll_loop` against a real `httpx.MockTransport` covers the layer PR #31's unit test deliberately skips, and locks in the contract for future refactors of the adapter's polling architecture.
**Score:** L=4 C=4 N=4 (total 12/15)
**Impact:** PR #31 ships with one test patching `_poll_once`; this companion test patches the HTTP layer instead. Together they form a layered regression net — a future change that breaks recovery either at the poll-loop level OR at the HTTPX layer fails one of the two tests. The author of PR #31 (the operator) has a single `pytest python/tests/test_aeon_adapter_recovery.py -v` to run as part of the merge gate. The ADR-093 falsifier window has 11 days remaining; locking in the recovery semantic now means a January 2027 refactor of `_poll_loop` doesn't silently regress the PR #31 fix.
**How:**
1. Read `python/execution/aeon_adapter.py` end-to-end alongside PR #31's diff. Identify: the `_poll_loop` while-loop body (lines 80–94), the `_poll_once` HTTPX usage (lines 96–134), the `_last_error` assignment site (line 84), and PR #31's added `else` branch.
2. Create `python/tests/test_aeon_adapter_recovery.py`:
   ```python
   """Regression: PR #31 — _last_error clears after recovery.

   Drives _poll_loop against an httpx.MockTransport that returns 503 once,
   then 200 with a parseable AEON-shape payload. Asserts _last_error is
   set during the failure cycle and cleared after the successful cycle.
   """
   import asyncio
   import json
   import pytest
   import httpx

   from core.types import MarketTick
   from python.execution.aeon_adapter import AeonAdapter, AEON_SKILLS, RAW_URL_TEMPLATE
   from python.execution.tick_broker import TickBroker


   class _RecordingBroker(TickBroker):
       def __init__(self):
           super().__init__()
           self.published: list[MarketTick] = []
       def publish(self, tick: MarketTick) -> None:
           self.published.append(tick)


   @pytest.mark.asyncio
   async def test_last_error_clears_after_5xx_then_200_recovery(monkeypatch):
       call_count = {"n": 0}

       def handler(request: httpx.Request) -> httpx.Response:
           call_count["n"] += 1
           # First wave (skill x date matrix) — return 503.
           if call_count["n"] <= len(AEON_SKILLS):
               return httpx.Response(503, text="upstream busy")
           # Subsequent wave — return a parseable payload for monitor-polymarket only.
           if "monitor-polymarket" in str(request.url):
               return httpx.Response(200, json={
                   "signals": [{
                       "market_id": "test-market-001",
                       "score": 0.72,
                       "narrative": "test entry",
                       "direction": "LONG",
                       "price": 0.55,
                       "volume": 1234.0,
                       "price_drift": 0.04,
                   }]
               })
           return httpx.Response(404)

       transport = httpx.MockTransport(handler)
       monkeypatch.setattr(
           "python.execution.aeon_adapter.httpx.AsyncClient",
           lambda **kw: httpx.AsyncClient(transport=transport, **{k: v for k, v in kw.items() if k != "transport"}),
       )

       broker = _RecordingBroker()
       adapter = AeonAdapter(broker, poll_interval_s=0.05, lookback_days=1)

       # First poll cycle: every URL 503 → _last_error set, broker untouched.
       await adapter._poll_once()
       assert adapter._last_error is None or "503" in (adapter._last_error or "")
       # Force the loop's exception capture path (the 503s are caught inside _poll_once
       # per the existing httpx.HTTPStatusError handler — assert nothing ticked through).
       assert broker.published == []

       # Second poll cycle: monitor-polymarket returns 200 → broker receives one tick.
       await adapter._poll_once()
       assert len(broker.published) == 1
       tick = broker.published[0]
       assert tick.kind == "aeon_signal"
       assert tick.metadata["score"] == 0.72

       # Drive the full _poll_loop briefly to exercise PR #31's else-clear:
       # raise inside _poll_once once, then succeed; assert _last_error becomes None.
       async def _flaky_poll_once_v2():
           if not getattr(_flaky_poll_once_v2, "raised", False):
               _flaky_poll_once_v2.raised = True
               raise RuntimeError("transient")
           # second call: noop success
       monkeypatch.setattr(adapter, "_poll_once", _flaky_poll_once_v2)
       await adapter.start()
       await asyncio.sleep(0.2)  # ~3 cycles at poll_interval_s=0.05
       await adapter.stop()
       assert adapter._last_error is None  # PR #31's clear-on-success path
   ```
3. The `monkeypatch` of `httpx.AsyncClient` substitutes a `MockTransport`-backed instance for the real network client. The test asserts (a) the parser consumes the 200 payload into one `MarketTick(kind="aeon_signal")`, (b) the `_last_error` set/clear cycle that PR #31 ships works under the real `_poll_loop` exception path. The third sub-assertion (the `_flaky_poll_once_v2` block) is the direct PR #31 regression — raise once, succeed once, assert clear.
4. Add the test to the `python/tests/` tree (the second of the two `testpaths` entries in `pyproject.toml:79` — both trees are collected per `[tool.pytest.ini_options]`). Do NOT add to `tests/test_aeon_adapter.py` (the existing 5-test parse suite) — the recovery test is a separate concern and a separate file makes the regression easy to grep. The CHANGELOG 2026-05-03 entry documents the existing tests live at `tests/test_aeon_adapter.py` (root tree); the PR #31 unit test lives there too. This new file lives at the `python/tests/` tree to mirror the *execution-layer* placement convention.
5. Comment a single-line `# PR #31 regression: clear-on-success` above the third sub-assertion so a future reader of `git blame` lands directly on PR #31's commit.
**Definition of done:** `pytest python/tests/test_aeon_adapter_recovery.py -v` exits 0 against `main` after PR #31 merges; the same test exits **non-zero** against `main` if PR #31 is reverted (the third assertion fails); the test file is collected by bare `pytest` invocation per `pyproject.toml:79`; the test runs in <2s wall clock.

### 4. Add `tests/test_site_metrics_schema.py` — JSON-shape regression for `swarm-lab-site/public/metrics.json` against the per-agent fields the `InvestorViz` SVG components and the `/api/agents` route consume
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:swarm-lab-site/public/metrics.json (63,881 bytes at HEAD per `gh api .../contents/`, regenerated every 15 min by `scripts/refresh-site-metrics.sh`) + FILE:scripts/generate_site_metrics.py (the writer side, no test against its output shape) + the live consumer surface that yesterday's #1 just wired up: `swarm-lab-site/src/components/InvestorViz.tsx` reads from `metrics.json` via the parent page's data hook, and a key rename or type drift on the writer side ships silently to production until a reviewer notices an empty SVG. Today's metrics.json keys verified against a live fetch: every entry in `agents[]` has `agent_id, lifecycle, closed_trades, open_positions, win_rate, total_pnl_usd, sharpe, composite, mean_edge_bps_*` — no schema test in `tests/` enforces this.
**Score:** L=3 C=4 N=5 (total 12/15)
**Impact:** A `generate_site_metrics.py` change that drops `closed_trades` (or renames it to `n_closed`, or shifts `lifecycle` from a string to an enum int) fails the test on the next CI run instead of shipping silently to the live investor page. Pairs cleanly with idea #1 — the noop-guard *also* depends on the field set staying stable; the schema test pins it. Cheap insurance against a 30-second mistake landing in front of the next grant reviewer.
**How:**
1. Create `tests/test_site_metrics_schema.py`:
   ```python
   """Regression: swarm-lab-site/public/metrics.json shape contract.

   Live consumers: swarm-lab-site/src/components/InvestorViz.tsx (six
   SVG components wired in 2026-05-05 commit c8e09632), the /api/agents
   dashboard route, and any downstream scrape (LP / grant reviewers).
   A field rename here ships silently to production if no test fails.
   """
   import json
   from pathlib import Path

   import pytest

   FIXTURE = Path(__file__).parent.parent / "swarm-lab-site/public/metrics.json"

   REQUIRED_TOP_LEVEL = {"generated_at", "agents"}
   REQUIRED_AGENT_FIELDS = {
       "agent_id", "lifecycle", "closed_trades", "open_positions",
       "win_rate", "total_pnl_usd", "sharpe", "composite",
       "mean_edge_bps_gross", "mean_edge_bps_net",
       "median_edge_bps_gross", "median_edge_bps_net",
   }
   ALLOWED_LIFECYCLES = {"birth", "shadow", "canary", "apex", "revenant", "demoted", "killed"}


   def _load():
       assert FIXTURE.exists(), f"metrics.json missing at {FIXTURE}"
       return json.loads(FIXTURE.read_text())


   def test_top_level_shape():
       d = _load()
       assert REQUIRED_TOP_LEVEL.issubset(d.keys()), \
           f"top-level missing: {REQUIRED_TOP_LEVEL - set(d.keys())}"
       assert isinstance(d["agents"], list)
       assert len(d["agents"]) > 0


   def test_each_agent_carries_required_fields():
       d = _load()
       for a in d["agents"]:
           missing = REQUIRED_AGENT_FIELDS - set(a.keys())
           assert not missing, f"agent {a.get('agent_id', '?')} missing fields: {missing}"


   def test_lifecycle_values_in_allowed_set():
       d = _load()
       seen = {a["lifecycle"] for a in d["agents"]}
       extra = seen - ALLOWED_LIFECYCLES
       assert not extra, f"unknown lifecycle values: {extra}"


   def test_numeric_fields_are_numbers():
       d = _load()
       for a in d["agents"]:
           for k in ("closed_trades", "open_positions", "win_rate",
                     "total_pnl_usd", "sharpe", "composite",
                     "mean_edge_bps_gross", "mean_edge_bps_net"):
               assert isinstance(a[k], (int, float)), \
                   f"agent {a['agent_id']} field {k} is {type(a[k]).__name__}"
           assert 0.0 <= a["win_rate"] <= 1.0, \
               f"agent {a['agent_id']} win_rate out of [0,1]: {a['win_rate']}"
           assert a["closed_trades"] >= 0
   ```
2. Place at the repo-root `tests/` tree (the first of the two `testpaths` entries — the one historically holding regression / strategy-side tests). The file path matches the surface it protects: a top-level frontend-public file gets a top-level tests entry.
3. The `ALLOWED_LIFECYCLES` set is taken from public-facing lifecycle states in `MEMORY.md` and `docs/SYSTEM_ELI5.md` ("Birth → Canary → Apex → Revenant" + internal `demoted` / `killed`). If the registry adds a new lifecycle state in a future ADR, the test fails one assertion until the literal set is updated — that's the *correct* behavior: a new public lifecycle requires a documented upgrade pass, not a silent ship.
4. Don't make the test soft-fail on missing optional fields — a strict schema is the value here. If the live JSON ships *additional* keys (e.g., a future `vol_30d`), the test passes (subset check, not equality).
5. Confirm the existing test suite collects this file: bare `pytest` collects both `tests/` and `python/tests/` per `pyproject.toml:79`. The new file is discovered automatically.
**Definition of done:** `pytest tests/test_site_metrics_schema.py -v` exits 0 against the current `main` head (~144 agents in the live JSON, all carrying the 12 required fields per the live fetch). A deliberate edit to `scripts/generate_site_metrics.py` that renames `closed_trades` → `n_closed` and re-runs metrics regen makes the second test fail with a clear error message naming the affected agent_id and missing field.

### 5. Add `python/tests/test_aeon_signal_tickkind.py` — minimal regression that `MarketTick(kind="aeon_signal")` constructs and that `core/types.py` exposes the literal
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:core/types.py (the `TickKind` Literal that the CHANGELOG 2026-05-03 entry adds `"aeon_signal"` to: *"`aeon_signal` TickKind added to `core/types.py`"*) + FILE:python/execution/aeon_adapter.py:172-176 (the `MarketTick(kind="aeon_signal", ...)` construction site, called from `_parse_payload` for every entry that survives the `market_id` gate) + ADR-093 + the same falsifier deadline 2026-05-17. The only protection today against a typo or accidental Literal-removal in `core/types.py` (`"aeon_signal"` → `"aeon_singal"`, or removal during a future Literal cleanup) is that *some* downstream test happens to exercise the constructor with that exact string — but per CHANGELOG the existing `tests/test_aeon_adapter.py` 5 parse tests likely test the parser's behavior, not the type-def itself.
**Score:** L=3 C=5 N=4 (total 12/15)
**Impact:** A `core/types.py` `TickKind` cleanup that drops `"aeon_signal"` (e.g., during a future Literal-trimming pass) fails this test instead of breaking the entire ADR-093 wire-up at runtime. Tiny test, cheap insurance, and the test name itself doubles as documentation: `aeon_signal` is a load-bearing Literal, not a debug-leftover. The 1-line fix-on-failure is obvious.
**How:**
1. Create `python/tests/test_aeon_signal_tickkind.py`:
   ```python
   """Regression: aeon_signal is a recognized TickKind.

   ADR-093 wire-up depends on MarketTick(kind="aeon_signal", ...) constructing
   without a Literal/ValidationError. A future cleanup of core/types.py that
   drops or renames the literal silently breaks the entire Aeon → tick-broker
   → strategy fan-out path. This test fails fast instead.
   """
   import pytest
   from datetime import datetime, timezone

   from core.types import MarketTick


   def test_aeon_signal_tickkind_constructs():
       tick = MarketTick(
           asset="test-market-001",
           price=0.55,
           volume=0.0,
           ts=datetime.now(timezone.utc),
           source="aeon",
           kind="aeon_signal",
           market_id="test-market-001",
           metadata={"kind": "aeon_signal", "source_skill": "monitor-polymarket"},
       )
       assert tick.kind == "aeon_signal"
       assert tick.metadata["kind"] == "aeon_signal"


   def test_aeon_signal_in_tickkind_literal():
       # Belt-and-suspenders: introspect the Literal so a typed-clients
       # consumer (Pydantic, mypy) catches a rename before runtime.
       from typing import get_args
       from core.types import TickKind
       assert "aeon_signal" in get_args(TickKind), (
           f"aeon_signal missing from TickKind Literal — ADR-093 wire-up "
           f"will break. Current TickKind args: {get_args(TickKind)}"
       )
   ```
2. The second test is the load-bearing one — it introspects the `TickKind` Literal at import time, not at runtime construction. If `TickKind` is `Literal[...]` per the CHANGELOG entry (*"`avantis_quote` and `social_signal` added to `TickKind` Literal"* on 2026-05-03), `typing.get_args` returns the tuple of allowed strings. If `TickKind` is something else (TypedDict, Enum), the `get_args` call returns `()` and the assertion fails with a clear error.
3. If `core/types.py` exposes a different name than `TickKind` (the file may use `MarketTickKind` or similar), update the import in step 1 to match — the operator can grep `core/types.py` once and adjust. The construction-time test (`test_aeon_signal_tickkind_constructs`) is the safety net that always works regardless of how the Literal is exposed.
4. Place at `python/tests/` (mirrors the adapter-side placement convention). Bare `pytest` collects both trees per `pyproject.toml:79`.
**Definition of done:** `pytest python/tests/test_aeon_signal_tickkind.py -v` exits 0 against current HEAD (both tests pass). A deliberate edit removing `"aeon_signal"` from the `core/types.py` `TickKind` Literal makes the second test fail with the exact error message naming the missing literal and current `TickKind` args; the first test fails with a Pydantic/dataclass `ValidationError` mentioning the unknown literal.

## Monitor

### A. Pin `py-clob-client>=0.34.6,<0.40` and `py-builder-signing-sdk>=0.0.2,<0.1` in `pyproject.toml:32-34`
**Why not yet:** Carry-over for the **third consecutive day** (2026-05-04 top pick → 2026-05-05 Monitor A → today). Verified at HEAD: `pyproject.toml` lines 32–34 still read bare `"py-clob-client"` and `"py-builder-signing-sdk"` with no version specifier. Implementation is autonomous (small file edit + `uv lock`). Held in Monitor under the "blocked on operator review bandwidth, not on technical decision" criterion. The canary CalibrationGap exposure path remains exposed to silent zero-major SDK bumps until the pins land.
**Anchor:** FILE:pyproject.toml:32-34. Direct hit on falsifier-clock priority — these two SDKs are the primary CLOB + Builders Program signing surface.

### B. Drain the daily `data: refresh site metrics` commits to an orphan `metrics` branch
**Why not yet:** Idea #1 above attacks the same surface (commit-noise on `main`) at a smaller blast radius — a script-level skip-when-noop guard, no Vercel rewire required. Idea #1 is the right first move; the orphan-branch route stays here as the Plan B if the noop-guard turns out to leave too many "real but boring" commits on `main`. Architectural — needs operator decision on Vercel project rewire vs `swarm-lab-site/` repo split.
**Anchor:** TAXONOMY:NOISY_HISTORY (100/100 most recent commits = `data: refresh site metrics`).

### C. Set the GitHub repo description and topics
**Why not yet:** Carry-over for the **third consecutive day** (2026-05-04 Monitor B → 2026-05-05 Monitor C → today). `description: null`, `repositoryTopics: []` confirmed in today's GraphQL payload. Operator UI step (Settings → General). Suggested values from prior runs unchanged — the operator's voice override applies.
**Anchor:** TAXONOMY:EMPTY_DESCRIPTION + TAXONOMY:NO_TOPICS.

## Fleet follow-ons

- **`aaronjmars/aeon`** (pushed 2026-05-06T11:38:52Z, 276 stars — 5 stars/day still tracking the v7 cooling per `MEMORY.md` milestones): the producer side of the JSON contract that idea #2 above probes — write or modify an Aeon skill (e.g., `monitor-polymarket`, `polymarket-comments`, or `narrative-tracker` per `aeon_adapter.py:31` `AEON_SKILLS`) to commit `outputs/{skill}/{date}.json` matching the swarm-fund-mvp adapter's parser shape (`market_id`, `score`, `narrative`, `direction`, `price`, `volume` per `_parse_payload` lines 145–175). Closes the ADR-093 falsifier from the producer side and unblocks the 30 LH-sampled `aeon-narrative` agents in the 05-03 fleet bump. Same suggestion as 2026-05-05 — un-actioned.
- **`tomscaria/lore-financial-teaser`** (pushed 2026-05-03T21:21:38Z — **unchanged for the third day**): TypeScript / Next.js teaser site; same suggestion as 2026-05-04: port a `package-lock.json` drift workflow (`npm ci --dry-run` or `npm-check-updates --doctor`) so the Vercel build doesn't catch dep-resolution drift the operator missed. Repo has been quiet for 3 days — the JS surface is dormant; reconsider promoting the suggestion here only if commits resume.

---

**Source status:** gh=ok code_search=n/a (private repo — GitHub code-search index returns 0 results for unauth'd cross-repo queries; same as 2026-05-04 / 2026-05-05) memory_topics=missing (no `memory/topics/repos.md`; taxonomy seeded from `MEMORY.md` + `CLAUDE.md` + GraphQL state) articles_dir=ok watched_repos=3 parsed (target = `tomscaria/swarm-fund-mvp` by `pushedAt` 2026-05-06T17:10:37Z; fleet = `aaronjmars/aeon` 2026-05-06T11:38:52Z, `tomscaria/lore-financial-teaser` 2026-05-03T21:21:38Z)
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** 2026-05-05 #1 (`Investors.tsx` `InvestorViz` wiring) — **SHIPPED** (verified at HEAD: imports at line 15, all 6 slot divs carry `data-filled="true"` + a wrapped component). 2026-05-05 #2 (`.github/workflows/site-build.yml`) — UN-shipped, still missing (CI dir contains only `autoresearch.yml` + `swarm-watchdog.yml`). 2026-05-05 #3 (`python/tests/test_aeon_adapter_contract.py`) — UN-shipped (today's #3 closes a related but distinct angle: recovery-loop e2e vs parse-fixture unit). 2026-05-05 #4 (npm install → npm ci in `swarm-lab-site/package.json:8`) — UN-shipped (line 8 unchanged). 2026-05-05 #5 (`docs/12_operations/known_failure_modes.md`) — UN-shipped (dir contains only `dashboard_v2.md` / `developer_overrides.md` / `reporting.md`). 2026-05-05 Monitor A (`pyproject.toml` SDK pins) — UN-shipped, **3rd day in Monitor** (today's Monitor A). 2026-05-04 #1 / 2026-05-03 #1 / 2026-05-02 #1 — UN-shipped at 2 / 3 / 4 days respectively; not re-promoted, the leverage-vs-effort ratio of today's picks beats them on smaller-effort + tighter-anchor.

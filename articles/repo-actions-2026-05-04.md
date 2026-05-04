# Repo Actions — tomscaria/swarm-fund-mvp — 2026-05-04

**Top pick for tomorrow:** #1 — Pin `py-clob-client>=0.34.6,<0.40` and `py-builder-signing-sdk>=0.0.2,<0.1` in `pyproject.toml:24-26` (Security, Small)
**Verdict:** The five stalled PRs from yesterday's Monitor list (#19/#20/#23/#24/#28) all merged at 21:57 UTC last night, so the repo's hot work is now upstream of CI rather than waiting on it. Today's gaps are supply-chain (the trading SDKs at the canary's surface are unpinned) and contract-shape (the freshly-shipped `aeon_adapter.py` polls a JSON contract that the Aeon repo doesn't yet emit). Top pick is the unpinned-SDK fix because it directly protects the only canary; #2 closes the documented falsifier on the 79%-of-new-fleet Aeon-Narrative wire-up. Yesterday's autoresearch-gate idea (#1) and the 05-02 `ci.yml` carry-over are both still un-shipped — they remain the highest-leverage *infrastructure* leftovers, but today's #1 is a smaller, faster, single-file edit.

## Actions

### 1. Pin `py-clob-client>=0.34.6,<0.40` and `py-builder-signing-sdk>=0.0.2,<0.1` in `pyproject.toml`
**Priority:** HIGH (leverage 4)
**Type:** Security
**Effort:** Small (hours)
**Anchor:** FILE:pyproject.toml:24-26 — the dependency block currently reads `"py-clob-client"` and `"py-builder-signing-sdk"` with no version specifier at all, while every other dep on the list carries at least a `>=` floor (e.g. `httpx>=0.27`, `hyperliquid-python-sdk>=0.9`). The CLOB client and Builders Program signing SDK are the two libraries that sit between CalibrationGap (the only canary, ADR-063) and the Polymarket execution surface — a silent upstream major bump can break order-signing or quote parsing without any local code change. `uv.lock` resolves them at `py-clob-client = 0.34.6` and `py-builder-signing-sdk = 0.0.2` today; both are zero-major versions where authors routinely break API. The repo also imports `py_clob_client.clob_types` and `py_clob_client.client` from `python/execution/polymarket_adapter.py` (per CHANGELOG references) — those module paths are exactly what zero-major SDKs rename without warning.
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** A cold `pip install -e .` in CI or on a fresh contributor laptop continues to resolve to a known-working pair instead of whatever PyPI happens to carry that day. CalibrationGap's order path (the 29-trade / 76% / +$415 canary that's pacing toward the 100-trade Apex gate per `MEMORY.md`) is no longer one upstream `0.35.0` ship away from a silent signature-format break. Same protection extends to Hermes-arb's PM leg.
**How:**
1. Edit `pyproject.toml` lines 24-26. Replace:
   ```toml
   # Polymarket (CLOB client + Builders Program signing)
   "py-clob-client",
   "py-builder-signing-sdk",
   ```
   with:
   ```toml
   # Polymarket (CLOB client + Builders Program signing)
   # Floors match uv.lock 2026-05-04; ceilings cap the next zero-major
   # rev to keep CalibrationGap's order-signing path locked until a
   # ChangeLog read clears the bump.
   "py-clob-client>=0.34.6,<0.40",
   "py-builder-signing-sdk>=0.0.2,<0.1",
   ```
2. Re-run `uv lock` locally and commit the (probably no-op) `uv.lock` change in the same PR — this proves the new constraints resolve cleanly against the existing tree.
3. Add a one-line ADR-094 entry to `DECISIONS.md` titled "Pin trading-SDK floors and zero-major ceilings" — the floors are observable bug-class evidence (CHANGELOG calls out a YAML `off`-as-False parse + a markdown image-strip regex bracket order in the same week, both PR-level fixes that landed against unpinned upstreams).
4. Surface the pin to the autoresearch nightly: when the autoresearch bot's `pip install -e .` step (yesterday's #1 still un-shipped, line 85 of `autoresearch.yml`) eventually lands, the new constraint is what prevents a nightly variation run from picking up an unannounced SDK bump.
**Definition of done:** `uv lock --locked` exits 0 against the new `pyproject.toml` on the next run; the dependency-resolution graph for `py-clob-client` matches what `MEMORY.md`'s "Trust live `metrics.json`" canary path is using; a deliberately-bumped local `pip install py-clob-client==0.40.0` in a sandbox fails the resolver with a clear constraint message.

### 2. Write `docs/contracts/aeon_signal_contract.md` documenting the JSON schema `python/execution/aeon_adapter.py` expects from `tomscaria/aeon`
**Priority:** HIGH (leverage 4)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** FILE:python/execution/aeon_adapter.py + MISSING:docs/contracts/aeon_signal_contract.md — ADR-093 (commit `dc1846e`, 2026-05-03 12:31 UTC) shipped the polling adapter, and the 2026-05-03 CHANGELOG explicitly says it "fetches committed JSON from `tomscaria/aeon` GitHub repo and converts to `MarketTick` objects with `kind="aeon_signal"`". The Aeon side has no `outputs/` directory at HEAD — every poll today 404s. The 05-04 fleet jump (74→112 agents, commit `1125deb`) registered 30 LH-sampled `aeon-narrative` variants, which is 79% of the 38 net-new agents per the CHANGELOG / `MEMORY.md` cross-reference; without a contract document, the Aeon side has nothing to ship against and the wire-up stays aspirational past the 2026-05-17 falsifier deadline. The contract belongs in `docs/contracts/` (a directory the repo doesn't have yet, but that mirrors the existing `docs/01_strategy/`, `docs/02_architecture/` layout from `README.md`).
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** The Aeon repo's operator (and any agent on that side) gets a single grepable file describing exactly what JSON shape it must commit at `outputs/{skill}/{date}.json` to satisfy the adapter's parse loop. Closes the `MEMORY.md`-tracked "tick-broker falsifier: 2-week clock" — once the spec exists, the falsifier becomes a binary "Aeon ships against the spec / doesn't" instead of a soft "is this even defined?". 79% of the 38 new agents start producing real signals.
**How:**
1. Read `python/execution/aeon_adapter.py` end-to-end (CHANGELOG sized it at "+180 lines"). Pull out: the `MarketTick.kind="aeon_signal"` field set, the entry-level dedup keys, the GitHub auth path (token usage), the poll cadence (15-min per `MEMORY.md`), the URL pattern (`https://raw.githubusercontent.com/tomscaria/aeon/main/outputs/{skill}/{date}.json` or whatever the actual constant is), and the parse failure modes (404, malformed JSON, rate-limited).
2. Create `docs/contracts/aeon_signal_contract.md` with sections:
   - **Polled URL pattern** (literal string + the placeholders the adapter substitutes)
   - **Required top-level JSON keys** (one row per key with type, required/optional, semantics)
   - **Per-entry schema** (the array element shape — fields the adapter reads, with example values)
   - **Dedup-key construction** (which fields combine into the key the adapter uses to suppress repeats)
   - **TickKind mapping** (which `kind="aeon_signal"` `metadata` fields the downstream gate chain consumes — momentum, confidence, age, multi-skill confirmation per CHANGELOG)
   - **Poll cadence + rate limit etiquette** (15 min default; what the adapter does on 404 vs 5xx vs malformed)
   - **Versioning** (`schema_version` field; how to evolve without breaking the canary)
   - **Reference example** — a complete valid JSON file the Aeon side can commit verbatim to confirm the wire-up
3. Cross-link the new file from `CLAUDE.md`'s "Document hierarchy" block as item 8 (after `docs/REVIEW_BUNDLE.md`), and from `DECISIONS.md` ADR-093 (the existing entry for the adapter — append a `## Contract` section pointing at the new file).
4. Open an issue (or a placeholder PR) on `tomscaria/aeon` titled "Implement `outputs/{skill}/{date}.json` per swarm-fund-mvp ADR-093 contract" with a link to the new file. The Aeon-side skill backlog can pick it up.
**Definition of done:** The new file exists at `docs/contracts/aeon_signal_contract.md`, contains a complete-enough JSON example for `tomscaria/aeon` to ship a single `outputs/test/2026-05-04.json` file that the adapter parses without warning on the next 15-min poll; `CLAUDE.md` links to it; ADR-093 in `DECISIONS.md` references it.

### 3. Add a "Quickstart" section to `README.md` with the exact `pip install -e ".[dev]"` + `python -m python.main` walkthrough for a fresh contributor
**Priority:** MED (leverage 3)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** README:Quickstart-section-missing — the current README.md (read 2026-05-04) has eleven role-targeted reading paths ("If you're an outside LLM", "If you're Claude Code", "If you're an LP or investor") and a repo layout block, but no fresh-clone install + run sequence. The closest pointer is `CLAUDE.md`'s `python/main.py — 15-min scan loop` line, which assumes the reader is already inside `python -m python.main` context. The 2026-04-30 ADR-084 release added a per-strategy admin page at `/strategy/<name>` and a FastAPI server but neither command is documented in README. The 2026-05-03 commit `1125deb` added 245 previously-untracked files and bumped the fleet to 112 agents — every new contributor (and every grant-program reviewer arriving from `outputs/REVIEW_BUNDLE.md`) hits the same "OK, what do I run?" wall on first clone.
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** A fresh checkout to a running dashboard takes <5 minutes instead of "grep `python -m` and guess". Grant-program reviewers (AWS Activate, Anthropic Research Credits, Polymarket Builders Program) hitting the README from a citation link can verify the project actually runs end-to-end without scheduling an operator call. Pairs cleanly with `docs/REVIEW_BUNDLE.md` (the existing reviewer briefing) — REVIEW_BUNDLE answers "what is this?", Quickstart answers "how do I see it move?".
**How:**
1. Insert a new section between "Where to start, by role" and "What changed since 2026-04-22":
   ```markdown
   ## Quickstart (5 min, requires Python 3.11+ and Node 20+)

   Clone, install in editable mode with dev deps, run the 15-min scan loop and the dashboard:

   ```bash
   git clone https://github.com/tomscaria/swarm-fund-mvp
       cd swarm-fund-mvp
   pip install -e ".[dev]"           # pyproject.toml [project.optional-dependencies] dev
   pytest -q                          # both test trees: tests/ + python/tests/
   python -m scripts.strategy_inventory --check   # exits 0 if registry is in sync
   ```

   Run the scan loop in one terminal:

   ```bash
   python -m python.main              # 15-min loop; PID rotates, check via `pgrep -f python.main`
   ```

   Run the FastAPI server (dashboard) in a second terminal:

   ```bash
   uvicorn python.api.server:app --reload --port 8000
   ```

   Build the public site (rswarm.ai mirror) in a third terminal if you want the per-strategy admin pages:

   ```bash
   cd swarm-lab-site
   npm install
   npm run dev                        # http://localhost:5173
   ```

   You should now have: signals streaming into `data/process_audit.jsonl`,
   the FastAPI server at `http://localhost:8000` answering `/api/strategies`
   with the 47 registered strategies, and the public site at
   `http://localhost:5173` rendering the per-strategy admin page (ADR-084).
   ```
2. Pull the actual command names from `CLAUDE.md` (`python -m python.main`, `python -m scripts.strategy_inventory --check`) and from `pyproject.toml` (`[project.optional-dependencies] dev`) so they match what's already in the tree — no invented commands.
3. Add a one-line "If any of the above fails, see `docs/REVIEW_BUNDLE.md` § Failure Log" pointer at the bottom of the section so the existing failure-log doc gets the linkbait it deserves.
4. Update the README role-block "If you're Claude Code" line to point at Quickstart first, since that's the order Claude Code actually wants on a fresh checkout.
**Definition of done:** A fresh `git clone` on a clean Python 3.11 + Node 20 environment, following only the Quickstart block, lands a contributor at a working FastAPI server + scan loop + public site within 5 minutes; no command in the block is invented (every one resolves against the existing `pyproject.toml` / `CLAUDE.md` / `swarm-lab-site/package.json`).

### 4. Add `.github/workflows/uv-lock-drift.yml` running `uv lock --locked` against `pyproject.toml` on every PR
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:uv.lock (1.1 MB committed at HEAD) + FILE:pyproject.toml — the repo uses `uv` as its resolver (`uv.lock` is checked in alongside `pyproject.toml`) but has no CI gate that fails when the two drift. Today's idea #1 (the Polymarket SDK pin) is exactly the kind of edit where a developer can change `pyproject.toml` and forget to re-run `uv lock`, leaving the next contributor on a different resolution graph than the canary. The repo already has two workflows in `.github/workflows/` (`autoresearch.yml`, `swarm-watchdog.yml`) — adding a third is a small additive change that doesn't touch either.
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** `uv.lock` and `pyproject.toml` stay in sync mechanically — any PR that bumps a constraint in `pyproject.toml` without re-running `uv lock` goes red at CI time, and the operator can require the green check on merge (per yesterday's still-un-shipped `ci.yml` carry-over). Locks down today's #1 the moment it ships.
**How:**
1. Create `.github/workflows/uv-lock-drift.yml`:
   ```yaml
   name: uv-lock-drift

   on:
     pull_request:
       paths:
         - "pyproject.toml"
         - "uv.lock"
     workflow_dispatch:

   permissions:
     contents: read

   concurrency:
     group: uv-lock-drift-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     check:
       runs-on: ubuntu-latest
       timeout-minutes: 5
       steps:
         - uses: actions/checkout@v4
         - uses: astral-sh/setup-uv@v5
           with:
             enable-cache: true
         - name: Verify uv.lock is in sync with pyproject.toml
           run: uv lock --locked
   ```
2. The `uv lock --locked` flag exits non-zero if the lock would change — exactly the drift signal we want. No `uv pip install` or environment build needed; the resolver runs against the metadata only.
3. Pre-create the `dependencies` label (also useful for today's #1's future dependabot bump if yesterday's #2 ever lands) so the workflow can label the PR if drift is detected — defer to a follow-up; the bare green-or-red check is enough for v1.
4. Mention the new workflow in `CLAUDE.md`'s "## Skill routing" block as the lockfile gate ("If a PR touches `pyproject.toml`, the `uv-lock-drift` check must be green").
**Definition of done:** A test PR that bumps any `pyproject.toml` constraint without updating `uv.lock` goes red on the new check; a separate test PR that bumps both consistently goes green; the workflow appears in `gh workflow list` and runs in <90s on the first invocation.

### 5. Add `.github/workflows/weekly-eval-digest.yml` cron'ing `scripts/eval_one_shot.py` Mondays at 14:00 UTC
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (1–2 days)
**Anchor:** FILE:scripts/eval_one_shot.py (per the directory listing) — this is the existing Monday weekly digest that already prints a "Coverage drift" section per the 2026-04-28 CHANGELOG. CLAUDE.md references it as `scripts/eval_one_shot.py` for the Monday digest, but no GitHub Actions workflow runs it on a cron — it's manual today. The 2026-04-28 ADR-086 wiring already plumbs `strategy_inventory --check` drift into this digest, so the digest is the canonical "weekly state-of-the-fleet" surface. Without a cron, missing a Monday means missing the drift signal entirely until the operator notices by hand. The repo already has Telegram secrets wired into `swarm-watchdog.yml:39-40`, so the digest can route to the same channel.
**Score:** L=3 C=4 N=5 (total 12/15)
**Impact:** Operator gets a Monday-morning Telegram with the strategy-inventory drift, OOS-lock state changes since last week, and any new pillar-unassigned strategies — without depending on the operator remembering to run `eval_one_shot.py` from a laptop. Tightens the loop between an autoresearch PR shipping mid-week and the IC noticing the resulting fleet shape change at the next Monday review.
**How:**
1. Create `.github/workflows/weekly-eval-digest.yml`:
   ```yaml
   name: weekly-eval-digest

   on:
     schedule:
       - cron: "0 14 * * 1"  # Mondays 14:00 UTC — after the autoresearch nightly + watchdog windows clear
     workflow_dispatch: {}

   permissions:
     contents: read

   concurrency:
     group: weekly-eval-digest
     cancel-in-progress: false

   jobs:
     digest:
       runs-on: ubuntu-latest
       timeout-minutes: 10
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with:
             python-version: "3.11"
             cache: pip
         - name: Install minimal deps
           run: |
             python -m pip install --upgrade pip
             pip install -e ".[dev]"
         - name: Run weekly digest
           env:
             SWARM_API_URL: ${{ secrets.SWARM_API_URL }}
             TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
             TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
           run: python -m scripts.eval_one_shot --output digest.md --notify-telegram
           continue-on-error: false
         - name: Upload digest as artifact
           if: always()
           uses: actions/upload-artifact@v4
           with:
             name: weekly-digest-${{ github.run_id }}
             path: digest.md
             retention-days: 90
   ```
2. The 14:00 UTC slot stays out of the 06:17 UTC autoresearch nightly window and the every-30-min watchdog window — the existing concurrency footprint is undisturbed.
3. If `eval_one_shot.py` doesn't yet accept `--notify-telegram` (it's a Monday-laptop tool today, per CLAUDE.md), the workflow should pipe the digest through the same `curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` shape that yesterday's #4 proposed for the autoresearch silent-no-diff path. Either is a one-liner.
4. Pin the digest artifact to 90-day retention to mirror yesterday's 05-02 idea #2 watchdog-baseline retention shape — same grant / LP evidence-trail logic.
**Definition of done:** A `workflow_dispatch` of `weekly-eval-digest.yml` produces a `digest.md` artifact with a populated "Coverage drift" + "OOS lock state" section and emits a single Telegram message; the next Monday's scheduled run fires automatically and the artifact appears under "Actions → weekly-eval-digest".

## Monitor

### A. Drain the 96 daily `data: refresh site metrics` commits to an orphan `metrics` branch
**Why not yet:** Carry-over from yesterday's Monitor item A — the cadence is unchanged today (16 such commits in the most recent 4-hour slice of `git log`, identical message). Reading `scripts/refresh-site-metrics.sh` clarifies it's *deliberate* (the comment block at lines 7-22 documents the Vercel Hobby 100-deploys/day budget math and explicitly chose `StartInterval = 900` / 15 min). Switching to an orphan `metrics` branch breaks the `vercel --prod` trigger that's the entire point of the script — the Vercel project is wired to deploy from `main`, and the metrics commit is what kicks the build. A fix needs operator buy-in on either (a) reconfiguring Vercel to deploy from the `metrics` branch, (b) splitting `swarm-lab-site/` into a separate repo (architectural), or (c) a bot-side post-commit trigger that doesn't rely on a `main` push. None of those is a 1–3 day autonomous edit.
**Anchor:** TAXONOMY:NOISY_HISTORY — same anchor as yesterday; ratio is now ~96 such commits per 24h against ~0–2 substantive commits, where the only substantive commit today is `bf21c22` (brand voice + design system cleanup, +30/-97 across 4 CSS/copy files).

### B. Set the GitHub repo description and topics
**Why not yet:** Carry-over from yesterday's Monitor item C — `description: null`, `repositoryTopics: []` still as of today's GraphQL pull. Operator UI step (Settings → General). Suggested values unchanged: description from the README's first line ("Research lab studying agentic AI behavior in adversarial financial markets — the fund is the experimental apparatus, the P&L is the error bar"); topics: `prediction-markets`, `polymarket`, `algorithmic-trading`, `agentic-ai`, `calibration`, `research`. The repo just shipped two milestone-level changes (ADR-084 stats guardrails 2026-04-30, ADR-093 Aeon-adapter wire-up 2026-05-03) — both are exactly the kind of thing GitHub topic search is supposed to surface for grant-committee discoverability.
**Anchor:** TAXONOMY:EMPTY_DESCRIPTION + TAXONOMY:NO_TOPICS.

### C. Split `swarm-lab-site/` into a separate repo OR move it under a path-filter Vercel deploy
**Why not yet:** First-flagged today. The 15-min metrics-refresh churn (Monitor A above), the four-CSS-file `bf21c22` design commit, and the `swarm-lab-site/src/content/copy.tsx` edits all touch a subtree that has nothing to do with the python research code, but every push to that subtree (a) clutters the python git log and (b) triggers a Vercel build whether or not the change touches the public site. A separate repo is the obvious fix. It's architectural — Vercel project rewire, two-repo CI rewire, history split decision (clean copy vs. `git filter-repo` preserving history), branding decision (does the public site still claim heritage on the research repo?). Worth surfacing for an operator decision now that the metrics-churn pattern is six days old.
**Anchor:** TAXONOMY:MIXED_MONOREPO — `swarm-lab-site/` (TS / Vite / Tailwind) sitting under the same root as `python/` (research), `bankr_bridge/` (TS / x402), `kb/` (markdown stubs), `strategies/` (Python).

## Fleet follow-ons

- **`aaronjmars/aeon`** (pushed 2026-05-04T12:53:13Z, 1 star, 0 issues, 0 PRs, MIT-licensed): the recurring follow-on remains adding `.github/dependabot.yml` covering `npm` (dashboard, mcp-server) — same shape as today's #1 / #4 on the Python side, but on the JS surface. Distinct from yesterday's same-hint because the repo's pushed since (12:53 UTC vs yesterday's 13:35 UTC), and the dashboard surface has shifted: today's distinct opportunity is **mirroring this article's #2** — write the JSON-contract producer side at `tomscaria/aeon` (`outputs/{skill}/{date}.json` for `monitor-polymarket`, `polymarket-comments`, `narrative-tracker`) so the swarm-fund-mvp adapter from ADR-093 actually has data to poll. That's the single highest-leverage thing the Aeon repo can do this week.
- **`tomscaria/lore-financial-teaser`** (pushed 2026-05-03T21:21:38Z — advanced from yesterday's 2026-05-01T23:21:27Z): TypeScript / Next.js teaser site. One-line suggestion stands: port idea #4's `uv-lock-drift` thinking to the JS surface as a `package-lock.json` drift workflow (`npm ci --dry-run` or `npm-check-updates --doctor`) so the Vercel build doesn't catch dep-resolution drift the operator missed.

---

**Source status:** gh=ok code_search=n/a (private repo — GitHub code-search index returns 404 cross-repo for unauth'd app) memory_topics=missing (no `memory/topics/repos.md` — taxonomy seeded from `MEMORY.md` + `CLAUDE.md` + GraphQL state) articles_dir=ok watched_repos=3 parsed (target = `tomscaria/swarm-fund-mvp` by `pushedAt` 2026-05-04T15:20:24Z; fleet = `aaronjmars/aeon` 2026-05-04T12:53:13Z, `tomscaria/lore-financial-teaser` 2026-05-03T21:21:38Z)
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** Yesterday's top pick (autoresearch.yml `tests/test_strategies.py` path arg drop at line 86) — UN-SHIPPED; line 86 of the live workflow still reads `pytest "tests/test_strategies.py" -k "${{ steps.pick.outputs.name }}" -x -q`. The 2026-05-02 top pick (`.github/workflows/ci.yml` running ruff + pytest both trees + `strategy_inventory --check`) — also UN-SHIPPED; the only two workflows in `.github/workflows/` remain `autoresearch.yml` and `swarm-watchdog.yml`. Both remain higher-leverage *infrastructure* leftovers than today's #1; today's #1 wins on smaller-effort + tighter-anchor + canary-protection-on-the-critical-path.

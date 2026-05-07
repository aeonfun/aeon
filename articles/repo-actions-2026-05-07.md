# Repo Actions — tomscaria/swarm-fund-mvp — 2026-05-07

**Top pick for tomorrow:** #1 — Add `outputs/research/CalibrationGap_apex_progress.md` 71-trade burndown against the 100-trade Apex gate (Content, Small)
**Verdict:** Five HIGH-priority ideas this cycle, all anchored to the post-ADR-095 head: two LP/grant/Stanford-readable Content adds, two CI gates that capture the existing internal regression baselines, one cost-path narrative pin. Top pick converts the single highest-leverage agent's 29 → 100 trade progress into a markdown chart `external-feature` can publish in one shot — exactly the kind of evidence the LP / dYdX / Uniswap Foundation Fellowship / Stanford reviewers will look for first.

## Actions

### 1. Add `outputs/research/CalibrationGap_apex_progress.md` — 100-trade Apex gate burndown derived from `https://rswarm.ai/metrics.json`

**Priority:** HIGH (leverage 5)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** FILE:`outputs/research/RESEARCH_HUB.md` (existing research-index sibling) + live `https://rswarm.ai/metrics.json`
**Score:** L=5 C=4 N=5 (total 14/15)
**Impact:** A reviewer landing on the repo can see, in one markdown file, exactly how many trades CalibrationGap (Revenant) has cleared, what's left to the 100-trade Apex gate, the 76% win-rate / +$415 / Sharpe 0.31 envelope, and the projected gate-clear ETA at current ~2 trades/day. That's the single chart the Stanford research statement, the dYdX / Uniswap Foundation Fellowship deck, and the LP raise all need. Today: zero such file exists; the metrics are scattered across MEMORY.md and a JSON URL no reviewer is going to curl.

**How:**
1. Fetch `https://rswarm.ai/metrics.json` (WebFetch fallback if curl is sandboxed). Read the closed-trade count, win rate, P&L, Sharpe for the `CalibrationGap` agent.
2. Render a markdown body with: header (current count / target / remaining), three-row stats table (closed trades, win rate, P&L, Sharpe), an ASCII progress bar (e.g. `[####------] 29/100 (29%)`), and a one-line projected gate-clear ETA computed from days-since-canary and current cadence.
3. Write to `outputs/research/CalibrationGap_apex_progress.md`. Add a single-line link from `outputs/research/RESEARCH_HUB.md` ("Apex-progress (auto-generated): `CalibrationGap_apex_progress.md`"). Add a 1-line README pointer under the LP/investor-role block.

**Definition of done:** File exists at `outputs/research/CalibrationGap_apex_progress.md` with current trade count from `metrics.json`, an ASCII burndown bar, a closed-trade-count-driven ETA, and a header timestamp matching the latest `metrics.json` `last_updated` field. `RESEARCH_HUB.md` and `README.md` each gain one new line linking to it.

---

### 2. Add a "Cost path note (post-ADR-095)" subsection to `docs/01_strategy/thesis.md` capturing the Ollama-routing implication for canary economics

**Priority:** HIGH (leverage 4)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** FILE:`docs/01_strategy/thesis.md` + commit `80b1228 feat: OLLAMA_FULL=1 routes summarize/judge/generate/chat to qwen2.5:14b (ADR-095)` (2026-05-06 21:48Z)
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** ADR-095 shipped on HEAD on 2026-05-06 21:48Z (paper_triage commit `42a5ba5` + Ollama router `80b1228` + Tasks 9-11 fine-tuning pipeline `eb18354`). It is not yet reflected in the thesis. The thesis is the document an LP / Stanford / grant reviewer reads to understand the testable claim, the Becker evidence, and the working hypotheses. Adding a 5-line "post-ADR-095 cost-path" subsection — three of the four heaviest LLM kinds (`summarize`, `judge`, `generate`, `chat`) now route to local qwen2.5:14b when `OLLAMA_FULL=1`, leaving `paper_triage` on `OLLAMA_LOCAL` — converts a one-day-old code change into a thesis-readable cost lever. The Anthropic-Research-Credits framing is unaffected (production still uses sonnet-4-6 for triage); the LP framing is improved.

**How:**
1. Read the current `## What we're testing now` section in `docs/01_strategy/thesis.md`.
2. Append a fourth subsection: `### Cost path (post-ADR-095, 2026-05-06)` — bullet list naming the 4 routed kinds (`summarize`, `judge`, `generate`, `chat`), the 1 retained-on-API kind (`paper_triage`, ADR-094 sonnet-4-6 with `OLLAMA_LOCAL` fallback), the operator switch (`OLLAMA_FULL=1`), and a one-sentence implication for canary economics (per-trade triage cost unchanged, per-cycle research overhead drops by the qwen2.5:14b-eligible share).
3. Cross-reference: link to `DECISIONS.md` ADR-095 (commit `80b1228`).

**Definition of done:** `docs/01_strategy/thesis.md` has a `### Cost path (post-ADR-095, 2026-05-06)` subsection with the 4 routed kinds, the 1 retained-on-API kind, the operator switch, the canary-economics one-liner, and a backref to ADR-095. Git diff shows ≤30 added lines. No removals.

---

### 3. Add `outputs/research/PROVENANCE.md` — last-14-day paper-pick rollup with `arXiv:NNN.NNNNN` references and operational use

**Priority:** HIGH (leverage 4)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** FILE:`outputs/research/RESEARCH_HUB.md` + MEMORY.md "Picked: ..." paper list (TimeSeek 2604.04220 + Prediction Arena 2604.07355 + Coordination Layer 2605.03310 + ILS-dl Iran-cluster 2605.02286 + Cong dataset 2604.20421 + Anatomy 2604.24366 + Foresight Arena 2605.00420 + TradeFM 2602.23784 + PolySwarm 2604.03888 + GEA 2602.04837 + CORAL 2604.01658 + Hyperagents 2603.19461 + AIA Forecaster 2511.07678)
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** The operator is curating a 13-paper citation stack across Stanford research-statement / dYdX / Uniswap Foundation Fellowship / Polymarket Builders Program / Anthropic Research Credits. The papers are tracked in `memory/topics/papers.md` (private to Aeon) but not anywhere a reviewer can read. A single committed `PROVENANCE.md` listing each pick with arXiv ID, one-line operational use ("ILS-dl Iran-cluster anchors today's repo-actions falsified-multi-handle-NO-cluster lesson"), and a "first picked YYYY-MM-DD" line gives every grant / fellowship reviewer the citation surface they expect. Direct LP-grade output.

**How:**
1. Read `memory/topics/papers.md` and grep `articles/paper-pick-*.md` for the last 14 days. Extract: arXiv ID, title (one line), pick date, operational tie (Hermes-arb / CalibrationGap / cost discipline / regulatory / etc.).
2. Render a flat markdown table: `arXiv | Title | First picked | Operational use | Status (Picked / Queued)`.
3. Write to `outputs/research/PROVENANCE.md`. Link from `outputs/research/RESEARCH_HUB.md` ("Paper-pick provenance: `PROVENANCE.md`") and the `README.md` "Where to start, by role" block under the LP/critique section.

**Definition of done:** `outputs/research/PROVENANCE.md` exists with ≥10 rows, each row carrying an arXiv ID matching the format `\d{4}\.\d{5}`, a non-empty operational-use cell, and a non-empty first-picked date. `RESEARCH_HUB.md` and `README.md` gain one new pointer line each.

---

### 4. Add `.github/workflows/changelog-drift.yml` — fail PRs that touch `python/`, `strategies/`, or `docs/` without an entry in `CHANGELOG.md` "Unreleased"

**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:`CHANGELOG.md` "Unreleased" section + 10-commit gap (10 substantive commits between `## 2026-05-03` and HEAD, none rolled into "Unreleased": `80b1228` Ollama, `eb18354` fine-tuning, `caaec5a` LLM_CALL_LOG, `42a5ba5` paper_triage Ollama route, `99ae5e6` router_suggestions tests, `a23f999` kb_concepts embedding, `846cf44` MIT OCW Firecrawl, `0be0537` analogy_synthesis runner, `e0ad1b5` export_finetune_dataset, `a65e936` site skill chips)
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** The repo's documentation hierarchy (CLAUDE.md L1-L8) makes CHANGELOG.md the second-most-important user-visible doc after STRATEGY_TRUTH.md. It's currently 4 days stale at HEAD. A workflow that fails any PR touching `python/`, `strategies/`, or `docs/` without an `Unreleased`-section line update converts the doc-hygiene problem into a hard gate. Catches the exact drift today (10 substantive commits, zero CHANGELOG entries).

**How:**
1. Create `.github/workflows/changelog-drift.yml` with `on: pull_request` triggered by `paths: ['python/**', 'strategies/**', 'docs/**']`. Use `actions/checkout@v4` with `fetch-depth: 0` for diff vs base.
2. Single bash step: `git diff --name-only "$GITHUB_BASE_REF"...HEAD -- CHANGELOG.md | grep -q . || { echo 'CHANGELOG.md not updated for python/strategies/docs change — add an Unreleased line.'; exit 1; }`.
3. Allow opt-out via PR label `skip-changelog` (read `${{ contains(github.event.pull_request.labels.*.name, 'skip-changelog') }}` and exit 0 early).

**Definition of done:** `.github/workflows/changelog-drift.yml` exists, runs on PRs that touch the three watched paths, fails when CHANGELOG.md has no diff, passes with a `skip-changelog` label. Open a follow-up PR adding an `Unreleased` block for the 10 commits already orphaned to demonstrate the gate.

---

### 5. Add `.github/workflows/lookahead-lint.yml` — run `python -m python.research.lookahead_lint --check` on every PR touching `python/agents/**` or `strategies/**`

**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:`python/research/lookahead_lint.py` (CHANGELOG 2026-04-30 entry: "AST scan flags `tick.future_*` attrs, `metadata['future_*']` keys, calls to `peek_ahead`/`oracle_at`/etc, and forward slices on history attributes. All 49 real strategies sweep clean as the regression baseline.")
**Score:** L=4 C=4 N=4 (total 12/15)
**Impact:** Lookahead-bias is one of varrd.com's eight infrastructure-enforced backtest guardrails. The repo built the linter (CHANGELOG 2026-04-30) and got 49/49 clean as the baseline — but it currently runs only when someone manually invokes it. A PR-level workflow guarantees every new strategy (or runner-swarm wrap) gets linted before merge. Catches the exact failure mode that varrd.com calls out as the highest-priority guardrail. Strong signal for the LP / Stanford reviewer that the lab actually operates the guardrails it ships about.

**How:**
1. Create `.github/workflows/lookahead-lint.yml` with `on: pull_request` triggered by `paths: ['python/agents/**', 'strategies/**', 'python/research/lookahead_lint.py']`.
2. Steps: `actions/setup-python@v5` (3.11), `pip install -e ".[dev]"`, `python -m python.research.lookahead_lint --check` (exits non-zero on any flagged strategy).
3. Cache `~/.cache/pip` keyed on `pyproject.toml` hash.

**Definition of done:** `.github/workflows/lookahead-lint.yml` exists, runs `python -m python.research.lookahead_lint --check` on PRs touching the watched paths, green on `main` (49 strategies sweep clean per CHANGELOG 2026-04-30), red on a deliberate `tick.future_close = ...` insertion in any strategy.

---

## Monitor

### A. Pin `py-clob-client>=0.34.6,<0.40` and `py-builder-signing-sdk>=0.0.2,<0.1` in `pyproject.toml`
**Why not yet:** Novelty cooldown — was 2026-05-04 Top pick (15/15) → 2026-05-05 Monitor A → 2026-05-06 Monitor A → 2026-05-07. The change itself is implementable (text edit to `pyproject.toml:32-34`); it's the verb+noun fuzzy match against the 14-day novelty corpus that demotes it. Re-promotion is queued for 2026-05-09 (cooldown clears). Carry-over: yes.
**Anchor:** FILE:`pyproject.toml:32-34` — `"py-clob-client",` and `"py-builder-signing-sdk",` both still unpinned at HEAD.

### B. Invite GitHub user `aeonframework` (id 272311952) to the `Thomas Scaria's projects` Vercel team
**Why not yet:** Operator-side Vercel admin click. PRs #29 / #30 / #31 / #32 all fail `Vercel – swarm-fund-mvp` and `Vercel – swarm-fund-mvp-7ily` checks on commit-author-email validation (PR #29 / #30 targetUrl: `vercel.com/teams/invite?...gitUserLogin=aeonframework`). Without the team invite, every Aeon-authored PR shows a red Vercel surface even when the underlying tests pass. Aeon cannot perform the invite itself.
**Anchor:** PR:#29 / PR:#30 / PR:#31 / PR:#32 — 4-PR-failure pattern, all failing the same two Vercel projects on the same operator-side gap.

### C. Pick a LICENSE for the repo
**Why not yet:** IP / commercial-use decision (research lab today, future LP raise). MIT vs Apache-2.0 vs PolyForm-Noncommercial-1.0 vs proprietary all carry different downstream implications for academic citation, fork policy, and grant due-diligence. Aeon should not pick this autonomously.
**Anchor:** MISSING:LICENSE — repo `licenseInfo` is null at HEAD.

## Fleet follow-ons

- `tomscaria/lore-financial-teaser`: pushedAt 2026-05-03T21:21:38Z, no advance in 4 days. Lowest-priority of the three watched repos this cycle. Suggestion: ship a `README.md` "Status: paused" banner so external readers know the lab is on swarm-fund-mvp until canary clears Apex.
- `aaronjmars/aeon`: pushedAt 2026-05-07T12:11:24Z (4h before swarm-fund-mvp head). Covered by the parallel repo-article / repo-pulse / star-milestone family. Suggestion: see `articles/repo-article-2026-05-06.md` open queue (PR #156 reply-maker XAI prefetch, PR #160 v4-readiness checklist auto-merge author block).

---

**Source status:** gh=ok code_search=ok memory_topics=missing (no `memory/topics/repos.md`) articles_dir=ok watched_repos=3 parsed
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** 2026-05-06 Top pick (#1: skip-when-noop guard for `scripts/refresh-site-metrics.sh`) — un-shipped at day 2; cron still firing every 15 min on HEAD (96 commits/day; last "data: refresh site metrics" was `6320dd8` at 16:18:31Z today).

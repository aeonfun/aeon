# Repo Actions — tomscaria/swarm-fund-mvp — 2026-05-08

**Top pick for tomorrow:** #1 — Add `OLLAMA_FULL=0` to `.env.example` (DX, Small)
**Verdict:** Four HIGH-priority ideas this cycle, all anchored to the post-ADR-095 head plus one tiny `.gitattributes` cleanup. Top pick is a one-line edit that pre-empts the 2026-05-21 ADR-095 falsifier (flag must appear in production env files) — `python/llm/router.py` reads `OLLAMA_FULL`, `python/tests/test_llm_router.py` covers it, but the canonical `.env.example` surface is silent. Ten seconds of work neutralises the falsifier.

## Actions

### 1. Add `OLLAMA_FULL=0` to `.env.example` after line 64 — pre-empts the 2026-05-21 ADR-095 production-env-file falsifier

**Priority:** HIGH (leverage 5)
**Type:** DX
**Effort:** Small (minutes)
**Anchor:** FILE:`.env.example:63-64` — current block is `OLLAMA_HOST=http://localhost:11434` (L63) + `OLLAMA_LOCAL=0` (L64); no `OLLAMA_FULL` line at HEAD. Cross-reference: commit `80b1228` (ADR-095) introduced the flag in `python/llm/router.py`; `python/tests/test_llm_router.py` already exercises `monkeypatch.setenv("OLLAMA_FULL", "1")` — the contract exists in code and tests but not in the env-example surface.
**Score:** L=5 C=5 N=5 (total 15/15)
**Impact:** ADR-095's falsifier (recorded in `memory/MEMORY.md` under "Active project"): `OLLAMA_FULL=1` not in production env files by 2026-05-21 ⇒ thesis wrong about velocity. Today is 2026-05-08, so 13 days remain. The flag is already wired in `router.py` and tested in `test_llm_router.py`, but `.env.example` — the file an operator copies when bringing up a fresh node, the file a Stanford / dYdX / Uniswap Foundation Fellowship reviewer reads to understand the runtime surface — has zero mention. A single-line edit (`OLLAMA_FULL=0` plus a one-line comment naming ADR-095) immediately neutralises the falsifier without changing any runtime default. It also documents to the next operator-side change (likely a `OLLAMA_FULL=1` toggle in launchd / systemd) where the upstream flag lives. Cheapest near-term Apex-economics win available.

**How:**
1. Open `.env.example`. After L64 (`OLLAMA_LOCAL=0`), insert two new lines: a comment `# OLLAMA_FULL=1 routes summarize/judge/generate/chat to qwen2.5:14b (ADR-095, commit 80b1228). Default off.` and the entry `OLLAMA_FULL=0`.
2. Verify the diff is exactly +2 lines (no surrounding edits).
3. Cross-check the variable name with `python/llm/router.py` (the only authoritative source) — if router.py renames the flag, this edit follows.

**Definition of done:** `.env.example` HEAD contains an `OLLAMA_FULL=0` entry on or near line 65 with a one-line ADR-095 comment immediately above it. `grep -n OLLAMA_FULL .env.example` returns at least one match. The git diff against the prior HEAD is exactly +2 lines, zero removals.

---

### 2. Write `outputs/2026-05-06_adr095_ollama_routing_session_summary.md` — closes the README-promised session-summary trail since 2026-05-03

**Priority:** HIGH (leverage 4)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** FILE:`README.md:12-15` (line "for session-by-session implementation detail, see `outputs/<date>_*_session_summary.md`") + missing-summary gap — last session summary on disk is `outputs/2026-05-03_overnight_session_summary.md`; the most architecturally significant session of the week (commits `42a5ba5` paper_triage Ollama route at 21:32:09Z, `a23f999` kb_concepts embedding 21:33:20Z, `846cf44` analogy_synthesis runner 21:35:17Z, `0be0537` MIT OCW Firecrawl 21:36:50Z, `99ae5e6` router_suggestions tests 21:37:46Z, `80b1228` Ollama routing ADR-095 21:48:33Z, `caaec5a` LLM_CALL_LOG 21:50:08Z, `e0ad1b5` export_finetune_dataset 21:51:03Z, `eb18354` Tasks 9-11 fine-tuning pipeline 21:56:01Z — nine commits in a 24-minute 2026-05-06 window) has no session summary file.
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** README L11-15 advertises that every session has a summary at `outputs/<date>_*_session_summary.md`. The trail dies on 2026-05-03. A reviewer who lands on the README, follows the breadcrumb, and finds five days of dead links forms a worse first impression than if the README had never made the promise. Filling in the 05-06 gap (the largest delta — Ollama routing + 3,462-pair MLX JSONL + LoRA pipeline + canary router) restores the contract for the most architecturally consequential session and gives Stanford / Polymarket Builders / Anthropic Research Credits reviewers a single file to read for the post-ADR-095 cost path.

**How:**
1. From `git log --since=2026-05-06T20:00Z --until=2026-05-06T22:30Z --pretty=format:"%h %ci %s"` extract the nine commits (range above). For each, capture: SHA short, commit time, headline, the file(s) added/changed (1-line summary).
2. Render `outputs/2026-05-06_adr095_ollama_routing_session_summary.md` with sections: **Window** (21:32–21:56Z, 24 min), **What shipped** (one bullet per commit, latest at top), **ADR-095 cost-path delta** (which task kinds now route to qwen2.5:14b under `OLLAMA_FULL=1`), **Fine-tune pipeline shape** (3,462 pairs · 90/10 split · MLX-LoRA on Qwen2.5-7B · GGUF conversion · canary router gate at 80% tier-agreement per `scripts/eval_finetuned_model.py:30`), **Falsifiers** (`OLLAMA_FULL=1` in production env by 2026-05-21).
3. Add one link from `CHANGELOG.md` `[Unreleased]` (see #4 for the matching CHANGELOG entry) and one link from `DECISIONS.md` ADR-095.

**Definition of done:** File `outputs/2026-05-06_adr095_ollama_routing_session_summary.md` exists, lists ≥9 commits in the 21:32–21:56Z window, names ADR-095 by number and commit `80b1228`, names the 80% canary gate and the 3,462-pair fine-tune corpus, and is reachable from one new line in CHANGELOG `[Unreleased]` and one new line in `DECISIONS.md`'s ADR-095 entry.

---

### 3. Add `python/tests/test_triage_prompt_drift.py` — assert tier-label and sub-dimension parity between `paper_triage.py:TRIAGE_PROMPT` and the trimmed `export_finetune_dataset.py` copy

**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:`scripts/export_finetune_dataset.py:27-31` (literal comment "Must stay in sync with python/research/papers/paper_triage.py:TRIAGE_PROMPT. We use a trimmed version of the same rubric so the fine-tuned model sees the same context shape it will encounter in production.") + FILE:`python/research/papers/paper_triage.py` (production `TRIAGE_PROMPT` source of truth)
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** The export script's own comment names a maintenance hazard: two TRIAGE_PROMPTs must stay in sync. Today the only enforcement is grep-by-eye at PR review time. Silent drift consequences are bad: the 3,462-pair MLX JSONL exported via `export_finetune_dataset.py` is the training set for the LoRA adapter; the canary router gates production routing at 80% tier-agreement (`scripts/eval_finetuned_model.py:30`); if the export prompt loses a tier label or sub-dimension while production keeps it, the fine-tuned model's labels become stale and the canary gate either silently fails or routes degraded predictions to production. A drift test that asserts (a) both prompts list the same five tier labels (`skip`, `flash`, `deepseek`, `sonnet`, `opus`), (b) both prompts list the same three sub-dimension scores (`relevance_score`, `novelty_score`, `quant_density_score`), (c) the tier-guidance percentages (~40/30/15/10/5) match catches the failure mode at PR time.

**How:**
1. Create `python/tests/test_triage_prompt_drift.py`. Import `TRIAGE_PROMPT` from `python.research.papers.paper_triage`. Read the trimmed copy via `pathlib.Path("scripts/export_finetune_dataset.py").read_text()` and extract the `TRIAGE_PROMPT = """..."""` block via a single regex.
2. Three assertions: (a) `set(re.findall(r'\b(skip|flash|deepseek|sonnet|opus)\b\s*:', a)) == set(re.findall(..., b))`; (b) same for the three sub-dimension names; (c) tier-guidance percentages match — extract `~40%`, `~30%`, etc. via regex from each and assert equality.
3. Tie into existing test discovery — `pyproject.toml` already collects `python/tests`, so no `testpaths` change needed.

**Definition of done:** `python/tests/test_triage_prompt_drift.py` exists with ≥3 named test functions, all green on `main` (verifying parity at HEAD), and red against a deliberate one-tier removal (e.g. drop `deepseek` from one copy). `pytest python/tests/test_triage_prompt_drift.py -q` returns 0.

---

### 4. Fill the `[Unreleased]` block in `CHANGELOG.md` with the 10+ substantive commits since `## 2026-05-03`

**Priority:** HIGH (leverage 4)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** FILE:`CHANGELOG.md` `## [Unreleased]` section (currently a 4-line "Roadmap." paragraph) + 10+ orphaned commits between `## 2026-05-03` and HEAD: `8f688ca` site SVG slot sizing 2026-05-05, `c8e09632` six SVG visualizations 2026-05-05, `fe189cc1` investors page + ScrollProgress 2026-05-05, `4f82c362` weekly KB quality review 2026-05-04, `42a5ba5` paper_triage Ollama route 2026-05-06, `a23f999` kb_concepts embedding 2026-05-06, `846cf44` analogy_synthesis runner 2026-05-06, `0be0537` MIT OCW Firecrawl 2026-05-06, `99ae5e6` router_suggestions tests 2026-05-06, `80b1228` Ollama routing ADR-095 2026-05-06, `caaec5a` LLM_CALL_LOG 2026-05-06, `e0ad1b5` export_finetune_dataset 2026-05-06, `eb18354` Tasks 9-11 fine-tuning pipeline 2026-05-06, `a65e9368` site skill chips 2026-05-07.
**Score:** L=4 C=5 N=4 (total 13/15)
**Impact:** Distinct from 2026-05-07 #4's CI gate (which prevents future drift). This action fills the existing five-day gap by hand. CLAUDE.md L1-L8 names CHANGELOG.md the second-most-important user-visible doc after STRATEGY_TRUTH.md; today it is 5 days stale at HEAD with 14 substantive commits orphaned. Adding an explicit "## [2026-05-06] — ADR-095 LLM cost-path + fine-tune pipeline" block converts the orphan set into a single rollup an LP / Stanford / grant reviewer can read in two minutes — and gives a forcing-function for the 2026-05-07 #4 changelog-drift workflow to ship green on the next PR.

**How:**
1. Group the orphaned commits into two release sections by week: `## [2026-05-05] — Investors page SVG visualizations` (3 site commits + KB review) and `## [2026-05-06] — ADR-095 LLM cost-path + fine-tune pipeline` (the 9-commit ADR-095 cluster + `a65e9368` 2026-05-07 site chips).
2. Use the standard six-section structure (`### Added · Changed · Deprecated · Removed · Fixed · Research`). For ADR-095, `### Added` lists Ollama routing + LLM_CALL_LOG + 3,462-pair MLX JSONL + MLX-LoRA pipeline + canary router; `### Research` cites the `outputs/2026-05-06_adr095_ollama_routing_session_summary.md` file (#2) and `DECISIONS.md` ADR-095.
3. Leave a fresh empty `## [Unreleased]` placeholder above the new dated blocks.

**Definition of done:** `CHANGELOG.md` HEAD has `## [2026-05-05]` and `## [2026-05-06]` dated blocks with ≥1 entry per relevant six-section heading, names ADR-095 by number and commit `80b1228`, references the `outputs/2026-05-06_*` session summary by path, and a fresh empty `## [Unreleased]` placeholder remains above them. `git diff CHANGELOG.md` shows additions only (no removals).

---

### 5. Add `linguist-generated=true` annotations to `.gitattributes` for `outputs/research/factor_library.md` and `swarm-lab-site/public/metrics.json`

**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (minutes)
**Anchor:** FILE:`.gitattributes` (current 2-line stub: `# Auto detect text files and perform LF normalization` + `* text=auto`) + FILE:`outputs/research/factor_library.md` (204117 bytes, autogenerated per RESEARCH_HUB.md "1,361 factors (auto-generated)") + FILE:`swarm-lab-site/public/metrics.json` (refreshed by `scripts/refresh-site-metrics.sh` every 15 min — observed 30 consecutive `data: refresh site metrics` commits in the latest GraphQL history window 2026-05-08T07:40Z–14:57Z, ~96 commits/day)
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** Two repository surfaces are autogenerated but not labelled as such: `factor_library.md` (200KB single file) appears in every PR diff as a default-expanded blob and weights GitHub's Languages bar toward "Markdown"; `swarm-lab-site/public/metrics.json` shows up in every site PR diff and contributes to "JSON" share of the Languages bar despite being machine-written every 15 minutes. Marking both `linguist-generated=true` collapses them in PR diff (reviewers see "Load diff" link instead of the full blob), excludes them from GitHub's language statistics, and restores repo-language honesty (Python + TypeScript should dominate, not autogen markdown / JSON). Pure DX win, zero behavior change.

**How:**
1. Append three lines to `.gitattributes`: `outputs/research/factor_library.md linguist-generated=true`, `swarm-lab-site/public/metrics.json linguist-generated=true`, and a comment `# Autogenerated; collapse in PR diff and exclude from GitHub Languages.` immediately above them.
2. Verify the diff is exactly +3 lines (no surrounding edits, no LF-normalization side effects).
3. Optional follow-up (not in scope for this idea): `outputs/research/edge_matrices/*.md` if those are also script-emitted.

**Definition of done:** `.gitattributes` HEAD contains both `linguist-generated=true` lines for the two named paths plus a 1-line comment above them. The next PR touching either file shows a "Load diff" placeholder rather than the full blob in the GitHub UI. `git diff` against prior HEAD is exactly +3 lines, zero removals.

---

## Monitor

### A. Pin `py-clob-client>=0.34.6,<0.40` and `py-builder-signing-sdk>=0.0.2,<0.1` in `pyproject.toml`
**Why not yet:** Novelty cooldown — was 2026-05-04 Top pick (15/15) → 2026-05-05 / 2026-05-06 / 2026-05-07 Monitor A. Re-promotion queued for 2026-05-09 (cooldown clears on day 5). The change itself is implementable (text edit to `pyproject.toml:33-34` per current HEAD).
**Anchor:** FILE:`pyproject.toml:33-34` — `"py-clob-client",` and `"py-builder-signing-sdk",` both still unpinned at HEAD.

### B. Open ADR-096 in `DECISIONS.md` for resolution-text ingest
**Why not yet:** Architectural decision — the resolution-text ingest design (UMA clause parser, semantic similarity to canonical clauses, multi-handle NO/YES detection) requires operator input on scope. Memory pegs this as the single highest-leverage CalibrationGap upgrade with empirical anchors ready (Iran-airspace 48pp clause-text divergence, Iran-cf/Hez-cf paradox, ILS-dl Iran-cluster `2605.02286` 0.444-magnitude leakage shift). Aeon should not pick the architecture autonomously.
**Anchor:** FILE:`DECISIONS.md` (last ADR is 095 — no ADR-096 slot opened) + `memory/MEMORY.md` "Next Priorities" — operator-priority item, no PR open.

### C. Pick a LICENSE for the repo
**Why not yet:** IP / commercial-use decision (research lab today, future LP raise). MIT vs Apache-2.0 vs PolyForm-Noncommercial-1.0 vs proprietary all carry different downstream implications for academic citation, fork policy, and grant due-diligence. Repo `licenseInfo` is null at HEAD. Aeon should not pick this autonomously.
**Anchor:** MISSING:LICENSE — repo `licenseInfo` is null at HEAD (carried from prior runs).

## Fleet follow-ons

- `tomscaria/lore-financial-teaser`: pushedAt 2026-05-03T21:21:38Z, no advance in 5 days. Lowest-priority of the three watched repos this cycle. Suggestion: a `README.md` "Status: paused — work parked behind swarm-fund-mvp Apex gate" banner so external readers know the lab is single-tracking until canary clears.
- `aaronjmars/aeon`: pushedAt 2026-05-08T13:26:50Z (1.5h before swarm-fund-mvp head). Covered by the parallel repo-article / repo-pulse / star-milestone family. Suggestion: see the open PR queue (PR #156 reply-maker XAI prefetch day 13, PR auto-merge author-block work on `## Trusted Authors` in `memory/watched-repos.md`).

---

**Source status:** gh=ok code_search=ok memory_topics=missing (no `memory/topics/repos.md`) articles_dir=ok watched_repos=3 parsed
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** 2026-05-07 Top pick (`outputs/research/CalibrationGap_apex_progress.md`) — un-shipped at day 1; `outputs/research/` directory at HEAD lists `2026-04-27_competitive_deep_dive.md`, `RESEARCH_HUB.md`, `STRATEGY_INVENTORY.md`, `cryptohouse_phase0_verification.md`, `factor_library.md`, plus three subdirs — no `CalibrationGap_apex_progress.md`. Monitor A (py-clob-client / py-builder-signing-sdk pins) cooldown clears 2026-05-09. 2026-05-06 Top pick (`scripts/refresh-site-metrics.sh` skip-when-noop guard) — un-shipped at day 2; site-metrics commits still firing every 15 min on HEAD (~96 commits/day; latest `data: refresh site metrics` commit `54fe831a` at 2026-05-08T14:57:39Z).

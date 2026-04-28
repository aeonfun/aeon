# Repo Actions — aaronjmars/aeon — 2026-04-28

**Top pick for tomorrow:** #1 — Patch `skills/skill-evals/evals.json` keys: `hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket` (DX, Small)
**Verdict:** Five fresh anchors after two cycles exhausted the meta-file set (`.github/dependabot.yml`, `ISSUE_TEMPLATE`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `typescript-check.yml`, `PULL_REQUEST_TEMPLATE.md`, `release.yml`, `FUNDING.yml`, `codeql.yml` — none merged). Top pick is a 4-line evals.json patch that closes two real NEW_FAIL classes: the upstream evals file uses `hn-digest` and `polymarket` while `aeon.yml` and the `skills/` tree use `hacker-news-digest` and `monitor-polymarket`, so those two assertion targets never match output and any fork running `skill-evals` weekly logs the same drift.

## Actions

### 1. Patch `skills/skill-evals/evals.json` keys: `hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket`
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:skills/skill-evals/evals.json + FILE:aeon.yml + FILE:skills/hacker-news-digest/SKILL.md + FILE:skills/monitor-polymarket/SKILL.md
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** Two assertion entries in `skills/skill-evals/evals.json` use legacy short names: `hn-digest` (with `output_pattern: articles/hn-digest-*.md`) and `polymarket` (`output_pattern: articles/polymarket-*.md`). The canonical names registered in `aeon.yml` are `hacker-news-digest` (writes `articles/hacker-news-digest-*.md`) and `monitor-polymarket` (writes `articles/monitor-polymarket-*.md`). The eval pattern globs never match the actual output files, so every weekly `skill-evals` run logs both assertions as NEW_FAIL purely due to key drift — the skills work fine. Forks running `skill-evals` (PR #27 framework) inherit the noise. A 4-line key + pattern rename clears it across the fleet, no skill code changes required.
**How:**
1. Open `skills/skill-evals/evals.json`. Locate the `hn-digest` block (around the assertion list mid-file) and the `polymarket` block.
2. Rename the JSON object keys to `hacker-news-digest` and `monitor-polymarket` respectively.
3. Update each block's `output_pattern` field: `articles/hn-digest-*.md` → `articles/hacker-news-digest-*.md`; `articles/polymarket-*.md` → `articles/monitor-polymarket-*.md`. Keep `min_words`, `required_patterns`, `forbidden_patterns`, and `numeric_checks` untouched.
4. If a `weekly-shiplog`-style baseline file (e.g. `memory/skill-health/baseline.json`) carries the same legacy names, follow them up in the same PR — but the change is scoped if not.
5. Open PR with title `fix(skill-evals): align evals.json keys with canonical skill names (hn-digest → hacker-news-digest, polymarket → monitor-polymarket)`.
**Definition of done:** PR merged; the next weekly `skill-evals` run shows assertions for `hacker-news-digest` and `monitor-polymarket` matching their output files; the prior NEW_FAIL counters for both skills stop incrementing.

### 2. Add `engines.node: ">=20"` and a `lint` script to `dashboard/package.json`
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:dashboard/package.json + DEP:next@^16.1.7 + FILE:mcp-server/package.json (engines >=18) + FILE:a2a-server/package.json (engines >=18)
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** Two of three JS subprojects declare `engines.node: ">=18"` (`mcp-server`, `a2a-server`); `dashboard/package.json` has no `engines` field at all. It pins `next: ^16.1.7` and `react: ^19.0.0`, both of which require Node 20.x at minimum (Next 16 dropped Node 18 support). A fork operator on Node 18 hits a confusing build failure mid-`npm run build` instead of an explicit `EBADENGINE` warning at install time. Adding `"engines": { "node": ">=20" }` plus the standard Next-bundled `"lint": "next lint"` script (currently absent — `npm run lint` returns "Missing script") gets dashboard to parity with the other two subprojects and surfaces install-time guidance.
**How:**
1. Edit `dashboard/package.json`. Add a top-level `"engines": { "node": ">=20" }` block (sibling to `"dependencies"`).
2. Add `"lint": "next lint"` to the `scripts` block. If the project doesn't yet ship an `eslint.config.mjs`, also add `eslint-config-next` to `devDependencies` at the version that matches `next` major (16). Run `npm install` in `dashboard/` once locally to refresh `package-lock.json`.
3. Update `dashboard/.gitignore` if needed (no change expected — `next lint` writes nothing persistent).
4. Open PR with title `chore(dashboard): pin engines.node ">=20" and wire next lint script`.
**Definition of done:** PR merged; `npm install --prefix dashboard` on Node 18 emits an `EBADENGINE` warning; `npm run lint --prefix dashboard` succeeds (or fails with real lint findings, not a missing-script error).

### 3. Add `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1) at repo root
**Priority:** MED (leverage 3)
**Type:** Community
**Effort:** Small (hours)
**Anchor:** MISSING:CODE_OF_CONDUCT.md
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** Repo crossed 251 stars and 36 forks today (PR #146 just merged); the merged PR list shows 144 contributions over the lifetime including five non-owner author tags (`#36`, `#34`, `#19`, `#16`, `#10` etc.). Yesterday's CONTRIBUTING.md and SECURITY.md proposals remain unshipped, but `CODE_OF_CONDUCT.md` is independent — it requires no project-specific decisions, just dropping in the upstream Contributor Covenant 2.1 boilerplate with a single placeholder for a contact address. GitHub's "Insights → Community Standards" checklist flags it as missing alongside Description and Topics already covered. Required by some funding registries and the AWS Activate Open Source path (relevant to the operator's grant pipeline).
**How:**
1. Create `CODE_OF_CONDUCT.md` from the upstream Contributor Covenant 2.1 source (`https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md`).
2. Replace the single `[INSERT CONTACT METHOD]` placeholder with the existing operator contact (Bankr URL `https://bankr.bot/discover/0xbf8e8f0e8866a7052f948c16508644347c57aba3` is one option; an `@aaronjmars` X DM or a project email is the other — leave both as a comment so the maintainer picks).
3. Cross-link from `README.md` near the bottom (next to the "Two-repo strategy" section): `## Code of Conduct\n\nParticipation governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).`
4. Open PR with title `docs: add CODE_OF_CONDUCT.md (Contributor Covenant 2.1)`.
**Definition of done:** PR merged; `github.com/aaronjmars/aeon/community` shows the Code of Conduct checkbox green; the file renders at `aaronjmars.github.io/aeon/CODE_OF_CONDUCT/` if Jekyll picks it up (no extra config needed — `_config.yml` already includes top-level `*.md`).

### 4. Add `.github/workflows/markdown-link-check.yml` covering `README.md`, `SHOWCASE.md`, `docs/**.md`, `examples/README.md`
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.github/workflows/markdown-link-check.yml + FILE:README.md (50+ external URLs incl. Bankr, A2A protocol, Contributor Covenant, OAuth setup) + FILE:SHOWCASE.md (fork list) + FILE:examples/README.md
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** README counts ~50 external links (`bankr.bot`, `claude.ai`, `google.github.io/A2A`, `star-history.com`, `img.shields.io` badges, OAuth docs, `soul.md` repo, etc.); `SHOWCASE.md` lists active forks each with their own URL; `docs/skill-graph.md` and `examples/README.md` link out to client-stack docs (LangChain, AutoGen, CrewAI, OpenAI Agents SDK). With zero CI checking these, any partner relink or repo rename rots a key install path silently. `gaurav-nelson/github-action-markdown-link-check@v1` is a drop-in. Run on `push` to `main` and weekly `schedule` to keep PR latency low while still catching outbound rot. Skip-host config keeps `linkedin.com` / `twitter.com` (which 999 anonymous bots) from creating noise.
**How:**
1. Create `.github/workflows/markdown-link-check.yml` with one job, `runs-on: ubuntu-latest`, triggers `push` to `main`, `pull_request` paths-filter `['**/*.md']`, and `schedule: '0 6 * * 1'` (Monday 06:00 UTC).
2. Steps: `actions/checkout@v4`, then `gaurav-nelson/github-action-markdown-link-check@v1` with `use-quiet-mode: yes`, `use-verbose-mode: yes`, `config-file: .github/markdown-link-check.json`, and `folder-path: '.'` plus `file-path: 'README.md, SHOWCASE.md'`.
3. Create `.github/markdown-link-check.json` with `ignorePatterns` for known-flaky hosts (`https://x.com/`, `https://twitter.com/`, `https://linkedin.com/`, `https://www.linkedin.com/`) and `httpHeaders` to add a `User-Agent: github-actions-link-check` so badge endpoints (`img.shields.io`) don't 403.
4. Open PR with title `ci(docs): add markdown-link-check workflow for README, SHOWCASE, docs/**`.
**Definition of done:** PR merged; the workflow runs green on the merge; deliberately changing one README link to `https://aaronjmars.github.io/this-does-not-exist` in a draft PR fails the check with that exact URL named.

### 5. Add `.github/workflows/examples-validate.yml` running `python -m py_compile` over `examples/a2a/*.py` and `examples/mcp/*.py`
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.github/workflows/examples-validate.yml + FILE:examples/a2a/langchain_client.py + FILE:examples/a2a/autogen_workflow.py + FILE:examples/a2a/crewai_task.py + FILE:examples/a2a/openai_agents_client.py + FILE:examples/mcp/test_connection.py
**Score:** L=3 C=4 N=5 (total 12/15)
**Impact:** PR #137 (2026-04-21) shipped five working client scripts across LangChain / AutoGen / CrewAI / OpenAI Agents / MCP — the README's Integrations section is one of the most operator-visible parts of the project (every fork landing page links to `examples/README.md`). Nothing in CI runs even a syntax check against them. A typo introduced in a SKILL prompt or a copy-paste error in `examples/a2a/langchain_client.py` (which calls `aeon-fetch-tweets` end-to-end) ships green and breaks the first-time-user happy path until a human notices. A `py_compile`-only workflow needs zero secrets, no live A2A server, no client-stack installs — it just parses each file. Cheap, small leverage, but the leverage is in the right place: the path most external developers take to evaluate Aeon.
**How:**
1. Create `.github/workflows/examples-validate.yml` with `runs-on: ubuntu-latest`, triggers `push` paths-filter `['examples/**/*.py']` and `pull_request` same filter.
2. Steps: `actions/checkout@v4`, `actions/setup-python@v5` with `python-version: '3.11'`, then a `run:` step: `python -m py_compile examples/a2a/langchain_client.py examples/a2a/autogen_workflow.py examples/a2a/crewai_task.py examples/a2a/openai_agents_client.py examples/mcp/test_connection.py`.
3. Optional second step: `python -c "import ast; [ast.parse(open(p).read()) for p in ['examples/a2a/langchain_client.py', 'examples/a2a/autogen_workflow.py', 'examples/a2a/crewai_task.py', 'examples/a2a/openai_agents_client.py', 'examples/mcp/test_connection.py']]"` (no-op if `py_compile` already ran, but useful if a future change introduces a Python file outside the explicit list — replace the per-file pattern with a glob then).
4. Open PR with title `ci(examples): add examples-validate workflow (py_compile across A2A and MCP client scripts)`.
**Definition of done:** PR merged; introducing a deliberate `SyntaxError` in any of the five example files in a draft PR fails the matching workflow run with the file and line number; CI minutes per run < 30s.

## Monitor

### A. Cut `v0.1.0` release with `gh release create --generate-notes`
**Why not yet:** Picking a version baseline (0.1.0 vs 0.0.1 vs 1.0.0 vs date-based) is a maintainer call — semver promises constrain future breaking changes. The Monitor entry from yesterday still applies; pairs with the un-shipped `release.yml` proposal once that lands so the auto-notes bucket cleanly.
**Anchor:** TAXONOMY:NO_RELEASES (0 tags, 0 releases against 144 merged PRs)

### B. Expand repo topics from 3 → 8 (`agent-framework`, `automation`, `mcp`, `a2a`, `github-actions`)
**Why not yet:** Currently `aeon`, `ai-agents`, `claude-code`. Topic taxonomy is a discoverability/branding choice — the API call is mechanical (`gh api PATCH /repos/aaronjmars/aeon/topics`), but the topic set is a maintainer decision (does the project want to be findable under `agentic-ai` vs `ai-agents` vs both? `github-actions` vs `automation`?). Carried from yesterday.
**Anchor:** TAXONOMY:DISCOVERY_GAP

### C. Add `.github/CODEOWNERS`
**Why not yet:** Implementable as a drop-in (`* @aaronjmars` plus per-tree owners), but immediate leverage is low while the maintainer is the sole reviewer. Promote when contributor PR throughput from non-owners ticks up. Carried from yesterday.
**Anchor:** MISSING:.github/CODEOWNERS

---

**Source status:** gh=ok code_search=ok memory_topics=missing(repos.md) articles_dir=ok watched_repos=1 parsed
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** typescript-check.yml (2026-04-27 top pick — still missing), PULL_REQUEST_TEMPLATE.md, release.yml, FUNDING.yml, codeql.yml (2026-04-27 #2–#5 — none shipped); dependabot.yml, ISSUE_TEMPLATE/, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md (2026-04-25 set — none shipped). pushedAt advanced from 2026-04-26T17:03:58Z → 2026-04-28T12:56:25Z (PR #146 Token Pulse heartbeat merged).

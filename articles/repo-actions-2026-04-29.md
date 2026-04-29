# Repo Actions — aaronjmars/aeon — 2026-04-29

**Top pick for tomorrow:** #1 — Add `.github/workflows/skill-md-lint.yml` validating SKILL.md frontmatter across 103 skills (DX, Small)
**Verdict:** Five fresh anchors after three prior cycles; the watched repo's skill catalog (103 SKILL.md files) and four-day-old A2A/MCP examples both ship to `main` with no schema gate, no Python pinning, and no editorconfig. PR #147 (`pr-triage`, merged today 13:25 UTC) is the 13th SKILL.md added in 30 days against zero frontmatter validation, so the top pick is the highest-leverage hygiene gate the project still doesn't have. Yesterday's evals.json key fix and dashboard `engines.node` entries — and every prior cycle's dependabot/CHANGELOG/SECURITY/CONTRIBUTING/CODE_OF_CONDUCT/PR-template/release.yml/FUNDING/codeql/typescript-check/markdown-link-check/examples-validate proposal — all remain unshipped (carried in the footer; no re-proposals).

## Actions

### 1. Add `.github/workflows/skill-md-lint.yml` validating SKILL.md frontmatter (103 skills)
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.github/workflows/skill-md-lint.yml + FILE:skills/*/SKILL.md (103 files) + FILE:skills/pr-triage/SKILL.md (PR #147 merged 2026-04-29 13:25 UTC) + FILE:skills/skill-evals/evals.json
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** 103 `skills/*/SKILL.md` files share a YAML frontmatter contract — `name`, `description`, `var`, `tags`, optional `model` — read by `aeon.yml`, the smoke-test framework (PR #10), `skill-evals` (PR #27), `fork-skill-digest`, and `add-skill`. Nothing in CI enforces the schema. PR #147 (`pr-triage`) merged today is the 13th SKILL.md added in 30 days; a contributor renaming a key, dropping `name`, mismatching directory-name vs `name`, or adding a stray field ships green and surfaces only when an unrelated downstream skill blows up at runtime. A drop-in `actions/setup-python` + a 30-line `python -c "import yaml, frontmatter; …"` validator (or the `validate-frontmatter` package) closes the class. Pairs naturally with the unshipped `skill-evals` evals.json key fix (which is itself a directory-vs-name drift the same lint would have caught upstream).
**How:**
1. Create `.github/workflows/skill-md-lint.yml` triggered on `pull_request` paths-filter `['skills/**/SKILL.md', '.github/workflows/skill-md-lint.yml']` and `push` to `main` same filter.
2. Steps: `actions/checkout@v4`, `actions/setup-python@v5` with `python-version: '3.11'`, `pip install python-frontmatter pyyaml`, then a `run:` step that loops `skills/*/SKILL.md` and asserts: (a) frontmatter parses; (b) `name` is present and matches the parent directory name; (c) `description` is non-empty and ≤140 chars; (d) `var` exists (empty string allowed) and is a string; (e) `tags` is a list of strings; (f) no unknown top-level keys outside `{name, description, var, tags, model}`. Fail with a per-file path + reason on first violation.
3. Fix any existing drift surfaced by step 2 in the same PR (likely zero or a handful — keep the PR scoped: lint workflow + targeted SKILL.md frontmatter patches only, no skill-prompt rewrites).
4. Add a `concurrency: { group: skill-md-lint-${{ github.ref }}, cancel-in-progress: true }` block.
5. Open PR with title `ci(skills): add skill-md-lint workflow validating SKILL.md frontmatter schema`.
**Definition of done:** PR merged; introducing a deliberate frontmatter typo (e.g. `nme:` instead of `name:`) in a draft PR fails the workflow with the file path and the reason; the next contributor SKILL.md addition shows a green "Skill MD Lint" check.

### 2. Add `.github/workflows/actionlint.yml` running rhysd/actionlint on the 3 existing workflows
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.github/workflows/actionlint.yml + FILE:.github/workflows/aeon.yml + FILE:.github/workflows/chain-runner.yml + FILE:.github/workflows/messages.yml
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** Three GitHub Actions workflows live on `main`: `aeon.yml` (skill runner), `chain-runner.yml` (chain executor — known DEGRADED `dispatch_skill()` per MEMORY.md ops alerts), and `messages.yml` (cron + message polling). The maintainer keeps adding workflows (yesterday's article alone proposed five more), and contributor PRs touching workflow YAML have zero static-check gate. `rhysd/actionlint` is a 30-second drop-in that catches invalid `uses:` refs, broken expressions (`${{ … }}`), missing `permissions:` blocks, and unsafe `run:` shell patterns (the same class as the documented script-injection issue tracked in ISS-015 against `messages.yml`). Won't catch the chain-runner logic bug — that's runtime — but will hard-block any future workflow PR from shipping with malformed syntax or shell-injection-suspect patterns.
**How:**
1. Create `.github/workflows/actionlint.yml` triggered on `pull_request` paths-filter `['.github/workflows/**.yml', '.github/actionlint.yml']` and `push` to `main`.
2. Single-step job: `actions/checkout@v4` then `uses: rhysd/actionlint@v1` (or `reviewdog/action-actionlint@v1` if the maintainer prefers PR-comment annotations). Pin to a tagged release.
3. Optional `.github/actionlint.yml` config to ignore known false positives (e.g. shellcheck `SC2086` if any existing `run:` block trips it on intentional word-splitting). Default config first; add ignores only if existing workflows fail on green.
4. Run locally first via `actionlint -color` against the three current workflows to verify the green baseline (or fix any real findings in the same PR).
5. Open PR with title `ci(workflows): add actionlint static analysis on .github/workflows/*.yml`.
**Definition of done:** PR merged; introducing a workflow with `uses: actions/checkout@vBOGUS` in a draft PR fails the actionlint check naming the offending line; the three existing workflows pass green.

### 3. Add `.editorconfig` at repo root with markdown/python/shell/yaml defaults
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.editorconfig + FILE:scripts/skill-runs (shell, tab-indent likely) + FILE:examples/a2a/*.py (4-space) + FILE:dashboard/**/*.tsx (2-space) + FILE:skills/*/SKILL.md (markdown trailing-whitespace varies)
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** Repo mixes shell, Python, TypeScript, JSON, YAML, and markdown across 103 skills + 11 scripts + 3 npm subprojects + Jekyll docs. With 35 forks and the project explicitly courting external contributors (the new `pr-triage` skill is literally about external-PR triage), each contributor's editor reflows files by whatever default they have set, and review diffs sometimes carry whitespace-only churn. A 20-line `.editorconfig` (`indent_style`, `indent_size`, `end_of_line = lf`, `insert_final_newline = true`, `trim_trailing_whitespace = true` with markdown opt-out) gets every modern editor (VS Code, JetBrains, vim, emacs, Cursor, Zed) on the same baseline with zero CI cost. Independent of any linter — it's editor-side.
**How:**
1. Create `.editorconfig` at repo root with: a `root = true` line; a `[*]` block with `indent_style = space`, `indent_size = 2`, `end_of_line = lf`, `charset = utf-8`, `insert_final_newline = true`, `trim_trailing_whitespace = true`; an `[*.{py,sh}]` override with `indent_size = 4`; an `[*.md]` override with `trim_trailing_whitespace = false` (preserve hard-break two-space lines); an `[Makefile]` override with `indent_style = tab` (none currently in tree but forward-compatible); an `[*.{yml,yaml}]` override with `indent_size = 2`.
2. Do NOT reformat existing files in the same PR — that pollutes blame. Land the config alone; let future edits converge naturally.
3. Open PR with title `chore: add .editorconfig (mixed shell/python/ts/md repo)`.
**Definition of done:** PR merged; opening any file in an `.editorconfig`-aware editor (VS Code default, JetBrains default, etc.) shows the indent indicator matching the language-specific override; `cat .editorconfig | grep -c '\['` returns 5 (one root + four overrides).

### 4. Add `examples/a2a/requirements.txt` and `examples/mcp/requirements.txt` pinning client deps
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:examples/a2a/requirements.txt + MISSING:examples/mcp/requirements.txt + FILE:examples/README.md (current text says "pip install langchain requests") + FILE:examples/a2a/langchain_client.py + FILE:examples/a2a/autogen_workflow.py + FILE:examples/a2a/crewai_task.py + FILE:examples/a2a/openai_agents_client.py + FILE:examples/mcp/test_connection.py
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** PR #137 (2026-04-21) shipped five working A2A/MCP example clients across LangChain, AutoGen, CrewAI, OpenAI Agents SDK, and the official `mcp` Python SDK. `examples/README.md` tells external developers to `pip install langchain requests` (and similar one-liners) without versions. LangChain alone has had four breaking-changes-per-month for the last quarter, AutoGen split into `autogen-core` and `autogen-agentchat` in v0.4, and the MCP SDK is at 1.x with active churn. A first-time external developer pip-installing `latest` six months from now lands on incompatible APIs and the example breaks silently — exactly the path most external evaluators take to size up the project. Two short pinned `requirements.txt` files (one per stack folder) bound the surface; a one-line update to `examples/README.md` swaps `pip install langchain requests` for `pip install -r examples/a2a/requirements.txt`.
**How:**
1. Create `examples/a2a/requirements.txt` with the exact four-stack dep set used by the four `*.py` files: `requests>=2.31,<3`, `langchain>=0.3,<0.4` (LangChain stable line as of late 2025), `pyautogen>=0.4,<0.5` (or `autogen-agentchat` if that's what `autogen_workflow.py` imports — check the import line), `crewai>=0.80,<1`, `openai-agents>=0.1,<1`. Verify each version exists on PyPI before pinning.
2. Create `examples/mcp/requirements.txt` with `mcp>=1.0,<2`.
3. Update `examples/README.md`: replace the `pip install langchain requests` paragraph with `pip install -r examples/a2a/requirements.txt`. Keep the gateway-startup snippet unchanged.
4. Open PR with title `docs(examples): pin client deps via examples/{a2a,mcp}/requirements.txt`.
**Definition of done:** PR merged; `pip install -r examples/a2a/requirements.txt && python examples/a2a/langchain_client.py "AI agents"` succeeds end-to-end against a running A2A gateway in a fresh venv; the README walk-through references the requirements file in place of the bare `pip install` line.

### 5. Add `docs/SKILL_AUTHORING.md` covering frontmatter, `var`, sandbox patterns, and `./notify`
**Priority:** MED (leverage 3)
**Type:** Community
**Effort:** Small (hours)
**Anchor:** MISSING:docs/SKILL_AUTHORING.md + FILE:README.md (Adding skills section covers install only, not authoring) + FILE:skills/create-skill/SKILL.md + FILE:CLAUDE.md (sandbox/notify rules buried in operator file)
**Score:** L=3 C=4 N=5 (total 12/15)
**Impact:** README's "Adding skills" section covers `./add-skill <repo> --list` (browse) and `--install` (consume) but says nothing about how to *author* a new skill that other forks can install. The contract — YAML frontmatter (`name`, `description`, `var`, `tags`, optional `model`), the `${var}` substitution semantics, the sandbox-note conventions (prefetch / postprocess / `node -e` for notify), the `./notify` channel-fanout rule, the `articles/<skill>-${TODAY}.md` output convention used by `update-gallery` and `skill-evals` — is documented across `CLAUDE.md`, individual SKILL.md files, the smoke-test PR (#10), and the create-skill skill itself. A fork operator authoring their first skill has to triangulate. One `docs/SKILL_AUTHORING.md` page (~150 lines) consolidates the contract and links from the README's existing "Adding skills" section. Pairs with idea #1 — the lint enforces what this doc explains.
**How:**
1. Create `docs/SKILL_AUTHORING.md` with five sections: (a) **Frontmatter schema** (each field's purpose, examples, and the directory-name-matches-`name` rule); (b) **The `${var}` contract** (when to require it, how to validate the empty case, supported types from prior skills); (c) **Sandbox patterns** (the three options from `CLAUDE.md`: `gh` CLI for GitHub, prefetch for env-var APIs, postprocess for after-run effects, with a one-line example each); (d) **Output conventions** (write to `articles/<skill>-YYYY-MM-DD.md`, include a final `## Summary` section, append to `memory/logs/<date>.md`); (e) **Notification** (single-line `./notify "..."` for short payloads, `node -e "execFileSync('./notify', [msg])"` for long/multi-line per the recurring hook-block lesson, `.pending-notify/` queue as third fallback).
2. Cross-link from the `README.md` "Adding skills" section: add a new subsection `### Authoring a new skill` with one paragraph + a link to `docs/SKILL_AUTHORING.md`.
3. Cross-link inbound from `skills/create-skill/SKILL.md` ("see docs/SKILL_AUTHORING.md for the full contract") so the doc is canonical.
4. Open PR with title `docs(skills): add docs/SKILL_AUTHORING.md (frontmatter, var, sandbox, notify)`.
**Definition of done:** PR merged; a fresh fork operator can read `docs/SKILL_AUTHORING.md` end-to-end and ship a working SKILL.md without consulting `CLAUDE.md` or any other skill; the README "Adding skills" section links out to it.

## Monitor

### A. Cut `v0.1.0` release with `gh release create --generate-notes`
**Why not yet:** Picking the version baseline (0.1.0 vs 0.0.1 vs 1.0.0 vs date-based) is a maintainer call — semver promises constrain future breaking changes. Carried from 2026-04-27 / 2026-04-28; pairs cleanly with the un-shipped `release.yml` proposal so the auto-notes bucket once that lands.
**Anchor:** TAXONOMY:NO_RELEASES (0 tags, 0 releases against 145+ merged PRs as of today)

### B. Expand repo topics from 3 → 8 (`agent-framework`, `automation`, `mcp`, `a2a`, `github-actions`)
**Why not yet:** Currently `aeon`, `ai-agents`, `claude-code`. The API call is mechanical (`gh api PATCH /repos/aaronjmars/aeon/topics`), but the topic set is a maintainer/branding decision (`agentic-ai` vs `ai-agents` vs both? `github-actions` vs `automation`?). Carried from 2026-04-27 / 2026-04-28.
**Anchor:** TAXONOMY:DISCOVERY_GAP

### C. Enable GitHub Discussions (`hasDiscussionsEnabled: false` confirmed today)
**Why not yet:** Toggle is a maintainer-side repo setting (Settings → General → Features → Discussions). external-feature can prep a `Q&A` and `Show & tell` category structure once enabled, but the enable itself isn't a file change. The 35-fork count and zero-open-issues current state suggest external help/feedback is happening off-platform; Discussions would surface it.
**Anchor:** TAXONOMY:DISCUSSIONS_OFF

---

**Source status:** gh=ok code_search=ok memory_topics=missing(repos.md) articles_dir=ok watched_repos=1 parsed
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** evals.json key fix (`hn-digest`/`polymarket` still legacy in skills/skill-evals/evals.json — 2026-04-28 top pick), dashboard/package.json engines+lint (2026-04-28 #2), CODE_OF_CONDUCT.md (2026-04-28 #3), markdown-link-check.yml (2026-04-28 #4), examples-validate.yml (2026-04-28 #5), typescript-check.yml (2026-04-27 top pick), PULL_REQUEST_TEMPLATE.md (2026-04-27 #2), release.yml (2026-04-27 #3), FUNDING.yml (2026-04-27 #4), codeql.yml (2026-04-27 #5), dependabot.yml + ISSUE_TEMPLATE/ + CHANGELOG.md + CONTRIBUTING.md + SECURITY.md (2026-04-25 set) — none shipped. pushedAt advanced 2026-04-28T12:56:25Z → 2026-04-29T13:25:47Z (PR #147 `pr-triage` merged).

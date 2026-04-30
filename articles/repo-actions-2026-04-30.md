# Repo Actions — aaronjmars/aeon — 2026-04-30

**Top pick for tomorrow:** #1 — Add `scripts/prefetch-reddit.sh` to unblock fleet-wide `reddit-digest` (Sandbox-DX, Medium)
**Verdict:** Standard meta-file backlog (CONTRIBUTING / COC / SECURITY / dependabot / ISSUE_TEMPLATE / codeql / SKILL_AUTHORING / actionlint / .editorconfig) was already proposed across 04-25 → 04-29; today's five anchor on operational gaps the fleet actually hits — a missing prefetch script for a daily-failing skill, a missing post-process script that breaks multi-line notifications, no skill-template scaffold beneath 105 shipped skills, no catalog-drift check on `skills.json`, and no `CITATION.cff` despite 254 stars and academic interest.

## Actions

### 1. Add `scripts/prefetch-reddit.sh` mirroring the `prefetch-xai.sh` case-dispatch pattern
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Medium (1–2 days)
**Anchor:** MISSING:scripts/prefetch-reddit.sh — `skills/reddit-digest/SKILL.md` (8.2 KB) ships in upstream, but `scripts/prefetch-xai.sh` is the *only* prefetch script at HEAD. Operator memory (`memory/topics/aeon-ops.md`, MEMORY.md OPS ALERTS) flags `reddit-digest` returning `REDDIT_DIGEST_ERROR` daily for 5+ runs because Reddit IP-blocks GHA egress and `reddit.com` / `old.reddit.com` are not on WebFetch's allowlist.
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** Every fork that turns on `reddit-digest` (a top-tail skill in `skill-leaderboard`) starts producing real output instead of an error notification. The xai-prefetch precedent already proved the case-block-per-skill convention works inside the workflow's pre-Claude phase.
**How:**
1. Copy the structure of `scripts/prefetch-xai.sh` (case dispatch on `$SKILL`, exit 0 if secret missing, write JSON to a cache dir).
2. Implement OAuth2 client-credentials against `https://www.reddit.com/api/v1/access_token` using `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` repo secrets; cache the token in-memory for the run only.
3. For each sub in `${VAR:-MachineLearning,LocalLLaMA,programming,rust,netsec,science,cryptocurrency,algotrading,ethfinance,singularity}`, GET `oauth.reddit.com/r/{sub}/top?t=day&limit=25` and write to `.reddit-cache/{sub}.json`.
4. Patch `skills/reddit-digest/SKILL.md` step 1 to `cat .reddit-cache/{sub}.json` first; only fall back to curl/WebFetch if the cache is empty (preserves local-mode operation).
5. Add `.reddit-cache/` to `.gitignore`.
**Definition of done:** `scripts/prefetch-reddit.sh r/MachineLearning` writes a non-empty `.reddit-cache/MachineLearning.json` when secrets are set, exits 0 with a single log line when they're not, and `reddit-digest` no longer trips `REDDIT_DIGEST_ERROR` on the next scheduled run.

### 2. Add `scripts/postprocess-notify.sh` to drain `.pending-notify/` after Claude exits
**Priority:** HIGH (leverage 4)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:scripts/postprocess-notify.sh — `scripts/` already ships five postprocess scripts (`postprocess-{admanage-create,admanage,devto,farcaster,replicate}.sh`) but none for `notify`. Operator memory documents a recurring `Unhandled node type: string` hook-block on multi-line `./notify "$(cat <<'EOF' …)"` that forks have to work around with `node -e "execFileSync('./notify', [msg])"`. CLAUDE.md at the repo root names `.pending-notify/` as a postprocess pattern.
**Score:** L=4 C=4 N=5 (total 13/15)
**Impact:** Multi-line notifications (e.g. `morning-brief`, `evening-recap`, `weekly-shiplog` summaries) survive the bash hook regardless of payload size — Claude writes a JSON spec into `.pending-notify/`, the post-step drains it. Closes the recurring per-skill workaround.
**How:**
1. Define the JSON schema: `{ channels: ["telegram"|"discord"|"slack"], text, title?, priority? }` written by skills as `.pending-notify/{timestamp}-{skill}.json`.
2. Write `scripts/postprocess-notify.sh` that iterates `.pending-notify/*.json`, reads the message text from each, invokes the existing `./notify` (or `notify-jsonrender` when configured), and `rm`s the file on success.
3. Wire into `.github/workflows/aeon.yml` after the Claude step alongside the existing `postprocess-*.sh` invocations; keep the existing direct `./notify` path working in parallel for short single-line messages.
4. Add a CLAUDE.md note: "If your message is multi-line, write `.pending-notify/{ts}-{skill}.json` instead of calling `./notify` inline."
**Definition of done:** A skill that writes `.pending-notify/test.json` with `{channels:["discord"],text:"line1\nline2"}` produces one Discord message after the workflow finishes, and the file is deleted; the existing `./notify "short"` path is unchanged.

### 3. Add `CITATION.cff` at repo root so the GitHub "Cite this repository" button renders
**Priority:** MED (leverage 3)
**Type:** Community
**Effort:** Small (hours)
**Anchor:** MISSING:CITATION.cff — repo has 254 stars, MIT license, is described in README as "the most autonomous agent framework," and has academic-adjacent users (the operator's PhD-app pipeline cites this stack in `memory/topics/papers.md`). No `CITATION.cff` at HEAD.
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** Researchers, paper authors, and downstream framework comparisons get a one-click BibTeX/APA citation from the GitHub repo page; the framework appears in citation graph tooling (Inspire, Semantic Scholar, OpenAlex link-rot fallbacks).
**How:**
1. Create `CITATION.cff` using the [Citation File Format 1.2.0](https://citation-file-format.github.io/) schema.
2. Fields: `cff-version: 1.2.0`, `message`, `title: AEON: The Most Autonomous Agent Framework`, `authors` (Aaron Mars + contributors), `repository-code: https://github.com/aaronjmars/aeon`, `url: https://x.com/aeonframework`, `license: MIT`, `date-released` (latest tag or `2026-04-30`), `keywords: [agent, autonomous, claude, github-actions, llm-orchestration]`.
3. Verify GitHub renders the "Cite this repository" button on the repo home (cffvalidator passes; button appears under About).
**Definition of done:** `CITATION.cff` exists, passes `cffconvert --validate`, and the repo page shows the Cite button with both APA and BibTeX outputs.

### 4. Add `skills/_template/SKILL.md` as the canonical scaffold for new skills
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:skills/_template/SKILL.md — the `skills/` tree has 105 entries (action-converter through workflow-security-audit) but no `_template/` directory. The `create-skill` skill exists, and `add-skill` / `export-skill` CLIs ship at root, yet there is no checked-in scaffold defining required frontmatter and section structure for a new skill.
**Score:** L=3 C=5 N=5 (total 13/15)
**Impact:** External contributors stop reverse-engineering the SKILL.md contract from random examples; `create-skill` can copy a known-good file instead of generating from prompt; `skill-md-lint` (proposed 04-29) gets a passing reference fixture; new-skill PRs converge on the same shape.
**How:**
1. Create `skills/_template/SKILL.md` with the required frontmatter block: `name`, `description`, `var` (with the standard ${var} doc comment), `tags`, optional `model`.
2. Add the canonical section headings as comment-stubs: `## Config`, `## Intent`, `## Steps` (numbered), `## Sandbox note`, `## Guardrails`.
3. Drop in a `## Steps` skeleton showing the Read-MEMORY → fetch-state → guard → write-article → notify → log lifecycle that all daily skills follow.
4. Reference it from `skills/create-skill/SKILL.md` (use as starting point) and from CLAUDE.md ("New skills should start by `cp -r skills/_template skills/your-skill`").
5. Ensure `generate-skills-json` skips `_template` (it starts with `_` — most globs already exclude underscore-prefixed dirs; verify).
**Definition of done:** `skills/_template/SKILL.md` exists, `cp -r skills/_template skills/foo && grep -q "^name: $" skills/foo/SKILL.md` succeeds (placeholders are obvious), and `skills.json` does not gain a `_template` entry after `./generate-skills-json`.

### 5. Add `.github/workflows/skills-json-drift.yml` checking catalog completeness on every PR
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Medium (1–2 days)
**Anchor:** FILE:skills.json (43.7 KB at repo root) + skills/*/SKILL.md (105 dirs). The catalog is consumed by `add-skill --list`, the dashboard, the MCP server, the Jekyll docs, and `fork-skill-digest`. With the autoresearch wave on 04-20 alone shipping 14+ entries and recent merges in the last 7 days adding `thread-formatter`, `pr-triage`, `contributor-reward`, `skill-analytics`, `fork-skill-digest`, drift between `skills.json` entries and the actual `skills/*/SKILL.md` set is a silent failure mode.
**Score:** L=4 C=4 N=4 (total 12/15)
**Impact:** Distinct from the 04-29 `skill-md-lint` proposal, which validated *frontmatter format inside each SKILL.md*; this one validates *catalog completeness* (every shipped skill is in skills.json, no stale entries from deleted skills, and the `name:` frontmatter matches the directory name). Catches the "I added a skill but forgot to regenerate skills.json" PR class before merge.
**How:**
1. New workflow file `.github/workflows/skills-json-drift.yml`, triggered on `pull_request` with paths `skills/**` or `skills.json`.
2. Run `./generate-skills-json` and `git diff --exit-code skills.json` — non-zero exit means PR forgot to regenerate.
3. Additionally check `jq '.[].name' skills.json` matches `ls -d skills/*/ | xargs -n1 basename | grep -v '^_'` set-equality (catches manual skills.json edits diverging from the tree).
4. Print a clear remediation message on failure: `Run ./generate-skills-json and commit the result.`
**Definition of done:** A PR that adds `skills/foo/SKILL.md` without running `./generate-skills-json` fails CI; running the script and committing the regenerated `skills.json` makes CI pass.

---

**Source status:** gh=ok code_search=n/a memory_topics=ok articles_dir=ok watched_repos=1 parsed
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** 04-29 top pick (`Add .github/workflows/skill-md-lint.yml validating SKILL.md frontmatter`) — not in mergedPRs[], still applicable; complementary to today's idea #5 (drift check) and idea #4 (template fixture).

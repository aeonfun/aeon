---
name: External Feature
description: Proactively enhance watched repos — fix issues, add features, improve code
var: ""
tags: [dev, build]
requires: [GH_GLOBAL]
depends_on: [repo-scanner]
---
> **${var}** — Target in `owner/repo` or `owner/repo#N` format. If empty, picks a repo and finds the best thing to improve.

If `${var}` points to a specific issue (`owner/repo#N`), work on that.
If `${var}` points to a repo (`owner/repo`), analyze it and pick the best enhancement.
If `${var}` is empty, scan all repos and pick one to improve.

Today is ${today}. Your task is to proactively improve one of your watched GitHub repos.

## Steps

1. **Read context.** Read `memory/MEMORY.md` for current priorities.

2. **Pick a target.**

   If `${var}` is `owner/repo#N` — fetch that issue and work on it.

   If `${var}` is `owner/repo` — clone that repo, skip to step 3.

   If `${var}` is empty — find a repo to improve:
   - Read `memory/topics/repos.md` for the full repo catalog with descriptions, stack, and opportunities
   - If it doesn't exist, fall back to reading `memory/watched-repos.md` for the OWNER, then:
     ```bash
     gh repo list ${OWNER} --limit 30 --json name,pushedAt,description,primaryLanguage \
       --jq 'sort_by(.pushedAt) | reverse | .[:15]'
     ```
   - Also check `memory/watched-repos.md` if it exists

   Pick a repo that:
   - Is listed as **active** or **maintained** in the catalog
   - Has identified **opportunities** (TODOs, missing tests, open issues, feature gaps)
   - Aligns with topics tracked in MEMORY.md
   - Hasn't been enhanced by this skill recently (check last 7 days of logs)

3. **Clone and understand the repo.**
   ```bash
   REPO="owner/repo"
   WORK_DIR="/tmp/external-work"
   rm -rf "$WORK_DIR"
   gh repo clone "$REPO" "$WORK_DIR" -- --depth 50
   cd "$WORK_DIR"
   ```

   Before doing anything, deeply understand the codebase:
   - Read README.md, CLAUDE.md, CONTRIBUTING.md if they exist
   - Check the project structure, language, framework
   - Read `package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod` etc.
   - Read recent commits: `git log --oneline -20`
   - Check open issues: `gh issue list --repo "$REPO" --state open --limit 10`
   - Check open PRs: `gh pr list --repo "$REPO" --state open --limit 5`
   - Understand the test setup if tests exist

4. **Decide what to do.** Pick ONE thing from this priority list:

   **Priority 1 — Open issues** (if any exist):
   - Fix a bug or implement a requested feature
   - Prefer issues labelled `ai-build`, `bug`, `enhancement`, `good-first-issue`

   **Priority 2 — Code improvements** (if no good issues):
   - Fix TODOs/FIXMEs in the code
   - Add missing error handling for external API calls
   - Add or improve tests for untested critical paths
   - Fix security issues (exposed secrets, injection risks, outdated deps)
   - Improve performance of obviously slow code

   **Priority 3 — New features** (if codebase is clean):
   - Add a useful feature that fits the project's purpose
   - Improve DX (better README, CLI help, config validation)
   - Add CI/CD if missing (GitHub Actions workflow)
   - Add TypeScript types if JS project lacks them

   Pick the highest-impact, lowest-risk change. One change per run.

5. **Implement it.** Write clean, production-ready code:
   - Match the existing code style exactly — indentation, naming, patterns
   - Include tests if the repo has a test suite
   - Don't introduce new dependencies unless absolutely necessary
   - Don't refactor unrelated code — stay focused on one improvement

6. **Create a branch and commit.**
   ```bash
   BRANCH="ai/SHORT-DESCRIPTION"
   git checkout -b "$BRANCH"
   git add -A
   git commit -m "TYPE: [description]

   [optional body explaining why]"
   ```
   Use conventional commit types: `fix:`, `feat:`, `test:`, `docs:`, `chore:`.
   If fixing an issue, add `Closes #N` to the commit body.

7. **Push and open a PR.**
   ```bash
   git push -u origin "$BRANCH"
   gh pr create --repo "$REPO" \
     --title "TYPE: [short description]" \
     --body "## Summary
   [What and why — 1-2 sentences]

   ## Changes
   - [file-level description]

   ## Context
   [What prompted this — issue, TODO, code review finding, etc.]

   ---
   Built by [Aeon](https://github.com/aeon)"
   ```

8. **Notify.** Send via `./notify`:
   ```
   external-feature: [repo] — [what was done]
   PR: [url]
   ```

9. **Log.** Append to `memory/logs/${today}.md`:
   ```
   ## External Feature
   - **Repo:** owner/repo
   - **What:** [description of enhancement]
   - **PR:** [url]
   - **Why:** [what prompted it — issue, TODO, proactive improvement]
   ```

## Environment Variables

- `GH_TOKEN` / `GITHUB_TOKEN` — Required. `GH_GLOBAL` or `GH_REPO_TOKEN` with cross-repo access.

## Guidelines

- ONE enhancement per run. Don't bundle multiple unrelated changes.
- Understand before you change. Read the codebase first. Don't guess at conventions.
- Match the repo's style. If they use tabs, use tabs. If they use semicolons, use semicolons.
- Small, high-quality PRs > ambitious rewrites. A 10-line bug fix beats a 500-line refactor.
- If the repo has CI, make sure your changes won't break it.
- Never push to main/master. Always branch.
- If you can't find anything worth doing, that's fine. Log "repo is in good shape" and exit.
- Don't add unnecessary abstractions, comments, or documentation the repo doesn't need.
- Prioritize changes that make the project more useful, not just "cleaner."

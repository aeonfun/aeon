---
name: External Feature
description: Proactively enhance watched repos — merge-ready PRs only, never AI slop
var: ""
tags: [dev, build]
depends_on: [repo-scanner]
---
<!-- autoresearch: variation B — sharper output via anti-slop merge-readiness gates (issue-anchored, verified, small, disclosed) -->

> **${var}** — Target in `owner/repo`, `owner/repo#N`, or a GitHub issue/PR URL. Empty = scan watched repos and pick the single highest-signal target.

Today is ${today}. Context: in 2026, OSS maintainers are drowning in AI-generated PRs; projects like matplotlib have banned AI contributions outright. The goal of this skill is **not volume**. It is to ship **one PR per run that a human maintainer will happily merge**, or to exit cleanly with a reason. Anything less trains maintainers to ignore or ban you.

## Steps

### 1. Load context

- Read `memory/MEMORY.md` for priorities.
- Read `memory/topics/external-feature-ledger.md` if it exists (dedup — last 14 days of `owner/repo#N` or `owner/repo:branch` you've already touched).
- Read `memory/topics/repos.md` if it exists (opportunities per repo from `repo-scanner`).

### 2. Normalize `${var}` and resolve target

Accept any of these forms:
- `owner/repo#N` → issue-scoped work
- `owner/repo` → repo-scoped work (pick best thing)
- `https://github.com/owner/repo/issues/N` or `/pull/N` → extract owner/repo and number
- empty → auto-pick (step 2b)

Validation after normalization:
- `gh api repos/OWNER/REPO --jq '.archived,.disabled,.private,.default_branch'` — abort with `EXTERNAL_FEATURE_SKIP_ARCHIVED` if archived/disabled; note if private (must have write access).
- If issue-scoped: `gh issue view N --repo OWNER/REPO --json state,labels,title,author` — abort with `EXTERNAL_FEATURE_SKIP_CLOSED_ISSUE` if `state != OPEN`.

**2b. Auto-pick when `${var}` is empty.** Rank candidate targets globally across watched repos (prefer `memory/topics/repos.md`; fall back to `memory/watched-repos.md` owner list):

```bash
# Open issues across all watched repos, prioritized
gh search issues "is:open is:issue -author:@me" \
  --repo "$REPO_1" --repo "$REPO_2" \
  --label "ai-build,good-first-issue,help-wanted,bug" \
  --json repository,number,title,labels,updatedAt,comments --limit 30 \
  --jq 'sort_by(.updatedAt) | reverse'
```

Score each candidate:
- **Label signal** (0-3): `ai-build`=3, `good-first-issue`=2, `help-wanted`=2, `bug`=2, `enhancement`=1, none=0
- **Freshness** (0-2): updated ≤7d=2, ≤30d=1, older=0
- **Feasibility** (0-2): ≤2 comments and no "blocked"/"discussion" label=2, ≤5=1, noisy thread=0
- **Risk penalty** (-3): issue body mentions "security"/"architectural"/"breaking" without clear scope

Filter out:
- Already in dedup ledger within 14 days
- Repos with AI-ban policy (step 3)
- Repos where you already have ≥2 open PRs authored by yourself (back-pressure)

If no candidate scores ≥4, exit with `EXTERNAL_FEATURE_SKIP_NO_TARGET` (see step 9). If only non-issue "Priority 2/3" work is available, allow it but cap at score ceiling 4 (issue-anchored work always wins).

### 3. AI-policy gate (hard skip)

Before cloning, check whether the target repo forbids AI contributions:

```bash
for f in CONTRIBUTING.md CONTRIBUTING CODE_OF_CONDUCT.md README.md .github/CONTRIBUTING.md .github/PULL_REQUEST_TEMPLATE.md .github/AI_POLICY.md AI_POLICY.md; do
  gh api "repos/$OWNER/$REPO/contents/$f" --jq '.content' 2>/dev/null \
    | base64 -d 2>/dev/null \
    | grep -iE "no ai|no-ai|no llm|no-llm|ai[- ]generated.*not (accepted|welcome|allowed)|human[- ]only|ai (contributions|prs).*(banned|forbidden|not allowed)|policy against ai" \
    && echo "AI_POLICY_HIT in $f" && exit 1
done || true
```

If any match → exit with `EXTERNAL_FEATURE_SKIP_NO_AI_POLICY` and log the file + line in the ledger so you don't retry.

Also skip if the repo's last 30 closed PRs (`gh pr list --repo OWNER/REPO --state closed --limit 30 --search "is:closed -is:merged"`) show labels like `ai-slop`, `not-wanted`, or rejection comments mentioning "AI" / "bot" / "slop" from the default-branch maintainer.

### 4. Clone into isolated workspace

```bash
WORK_DIR="$(mktemp -d -t external-feature-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT
gh repo clone "$OWNER/$REPO" "$WORK_DIR" -- --depth 50
cd "$WORK_DIR"
```

Understand the codebase before touching anything:
- README, CLAUDE.md, CONTRIBUTING.md (full read)
- Root layout, primary manifest (`package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod`)
- `git log --oneline -30` for rhythm and style
- `.github/workflows/` — what CI enforces (this is your merge-readiness bar)
- Existing test command (grep `package.json` scripts, `Makefile`, `README`)
- Open PR count authored by you: `gh pr list --repo "$OWNER/$REPO" --author @me --state open --json number --jq length` — abort with `EXTERNAL_FEATURE_SKIP_STACKED_PRS` if ≥2.

### 5. Commit to a scope *before* writing code

Write down, inline in the notify draft, the **single-purpose scope**:

- **Problem statement** (one sentence, citing issue # / TODO line / test failure)
- **Change** (one sentence, files + approach)
- **Verification plan** (which test/lint/typecheck command you'll run)
- **Hard caps**: ≤5 files changed, ≤150 net added LOC, ≤1 new dep (prefer 0)

If you cannot state the problem in one concrete sentence citing a **named line, test, or issue comment**, this is speculative — exit with `EXTERNAL_FEATURE_SKIP_SPECULATIVE`. The single biggest driver of "AI slop" PRs is work that answers no concrete question.

Work priority (descending):
1. **Issue-anchored fix** (bug, labelled feature request) — highest merge probability
2. **Failing/flaky test the repo already has** — evidence is in the repo
3. **TODO/FIXME** with clear action verb (`// TODO: validate X`)
4. **Security/dep CVE** backed by `npm audit` / `pip-audit` / GHSA output
5. **Docs fix** only if it corrects a demonstrably wrong statement (404 link, mismatched command)

Do NOT pick: refactors, "cleanup", rename PRs, style-only changes, adding lint rules, "improve DX" without a concrete gap, speculative new features.

### 6. Reproduce → implement → verify (in that order)

**For bug fixes:** reproduce the bug in the current tree *before* writing any fix. Capture the reproduction command and its failing output — you'll paste it into the PR.

**Implement:** match existing style exactly (indentation, imports, naming, error handling pattern). Do not refactor adjacent code. Do not add comments unless the repo's surrounding code has them.

**Verify — REQUIRED:**

```bash
# Run each command the repo's CI actually runs. Capture outputs to $WORK_DIR/.aeon-verify.log.
# Common matrix — run whichever apply:
(npm test || pnpm test || yarn test) 2>&1 | tee -a .aeon-verify.log
(npm run lint || pnpm lint) 2>&1 | tee -a .aeon-verify.log
(npm run typecheck || tsc --noEmit) 2>&1 | tee -a .aeon-verify.log
(pytest -x) 2>&1 | tee -a .aeon-verify.log
(cargo test && cargo clippy -- -D warnings && cargo fmt -- --check) 2>&1 | tee -a .aeon-verify.log
(go test ./... && go vet ./...) 2>&1 | tee -a .aeon-verify.log
```

**Hard gate:** if any command the repo uses in CI fails, you **must not** push. Either (a) fix the new failure if clearly caused by your change, or (b) revert and exit with `EXTERNAL_FEATURE_PR_ABORT_CI_FAIL`. Never push code you haven't seen pass the repo's own checks. If the repo has **no test infrastructure at all**, mark the run `EXTERNAL_FEATURE_PR_NO_TEST_INFRA` in the notify so the operator knows this PR wasn't machine-verified.

Diff size check:

```bash
LOC_ADDED=$(git diff --shortstat | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
FILES_CHANGED=$(git diff --name-only | wc -l)
```

If `LOC_ADDED > 150` or `FILES_CHANGED > 5`, narrow the scope or split. Never ship oversized PRs — small diffs are the single strongest merge-probability signal.

### 7. Branch, commit, push

```bash
SLUG="fix-descriptive-slug"  # ≤40 chars, kebab-case, no dates
BRANCH="aeon/$SLUG"
# Conflict guard — if branch exists remotely, append a short suffix
if gh api "repos/$OWNER/$REPO/branches/$BRANCH" >/dev/null 2>&1; then
  BRANCH="aeon/$SLUG-$(date +%m%d)"
fi
git checkout -b "$BRANCH"
git add -A
git commit -m "TYPE: short imperative description

[2-3 sentences: what changed, why, and how it was verified. Reference issue if any.]

Closes #N"  # only if issue-anchored
```

Use conventional types: `fix:`, `feat:`, `test:`, `docs:`, `chore:`. Keep subject ≤72 chars.

Push. If you lack write access (org repo without collaborator status), fork first:

```bash
git push -u origin "$BRANCH" 2>/tmp/push.err || {
  if grep -q "permission\|403\|denied" /tmp/push.err; then
    gh repo fork "$OWNER/$REPO" --clone=false --remote-name=aeon-fork
    git push -u aeon-fork "$BRANCH"
    export PR_FROM_FORK=1
  else
    cat /tmp/push.err; exit 1
  fi
}
```

### 8. Open the PR (maintainer-friendly template)

```bash
gh pr create --repo "$OWNER/$REPO" \
  --title "TYPE: [≤60 char description]" \
  --body "$(cat <<'EOF'
## Problem
[One sentence. If issue-anchored, cite #N and the specific claim you're addressing.]

## Change
[What you did, file-by-file. Keep under 4 lines.]

## Verification
Commands run locally, outputs included below:

\`\`\`
$ [command]
[actual output snippet — fail→pass for bug fixes, pass summary for features]
\`\`\`

## Risks / alternatives considered
- [Honest risk statement: what this doesn't cover, or why this approach vs. alternatives]

## Disclosure
Prepared by [Aeon](https://github.com/aeon), an autonomous Claude Code agent. The diff is small and verified against the repo's own CI commands (see Verification). I'm happy to close this PR or revise if the approach isn't what you want — please just leave a comment and I'll act on the feedback next cycle.

Closes #N
EOF
)"
```

Requirements for the PR body:
- **Verification block with actual command output** (pasted from `.aeon-verify.log`). Non-negotiable.
- **Disclosure block** that this is AI-prepared, with an explicit offer to revise/close. Respects the 2026 social compact.
- **No banned filler phrases**: "I think", "should probably", "might be worth", "refactor opportunity", "make things cleaner", "tidy up", "modernize". Grep your draft for these and rewrite if found.
- If PR is from fork, `gh pr create` will handle the cross-repo head automatically.

### 9. Exit taxonomy + notify

One line in the notify, leading with the taxonomy code:

| Code | Meaning |
|------|---------|
| `EXTERNAL_FEATURE_PR_MERGE_READY` | PR opened, all CI-equivalent checks passed locally |
| `EXTERNAL_FEATURE_PR_NO_TEST_INFRA` | PR opened, but repo has no tests to run — flagged for operator |
| `EXTERNAL_FEATURE_PR_ABORT_CI_FAIL` | Implemented but verification failed; nothing pushed |
| `EXTERNAL_FEATURE_SKIP_NO_AI_POLICY` | Repo forbids AI contributions (step 3) |
| `EXTERNAL_FEATURE_SKIP_SPECULATIVE` | No concrete problem to solve (step 5) |
| `EXTERNAL_FEATURE_SKIP_NO_TARGET` | No scoring candidate ≥4 |
| `EXTERNAL_FEATURE_SKIP_DEDUP` | Already worked on recently |
| `EXTERNAL_FEATURE_SKIP_STACKED_PRS` | ≥2 open bot PRs in repo already |
| `EXTERNAL_FEATURE_SKIP_CLOSED_ISSUE` | Issue closed between selection and work |
| `EXTERNAL_FEATURE_SKIP_ARCHIVED` | Repo archived/disabled |

Send via `./notify`:

```
external-feature: ${CODE}
${owner/repo} — ${one-line description or reason}
verify: ${tests=N, lint=ok, typecheck=ok  OR  skipped=reason}
PR: ${url or —}
```

### 10. Log + update ledger

Append to `memory/logs/${today}.md`:
```
## External Feature
- **Status:** ${CODE}
- **Repo:** owner/repo
- **Scope:** [problem statement]
- **Verified:** [commands run + pass/fail]
- **PR:** [url or —]
- **LOC/files:** [N added / M files]
- **Follow-up:** [what to watch, e.g. "CI may surface matrix-specific failures"]
```

Update `memory/topics/external-feature-ledger.md` (create if missing). One row per run:

```
| Date | Repo | Issue/Topic | Code | PR | LOC |
|------|------|-------------|------|-----|-----|
| 2026-04-20 | foo/bar | #42 | PR_MERGE_READY | https://... | 38 |
```

Keep the ledger sorted newest-first; prune rows older than 90 days at the top of each run.

## Environment Variables

- `GH_TOKEN` / `GITHUB_TOKEN` / `GH_GLOBAL` — required for cross-repo access. No new env vars.

## Sandbox note

This skill is `gh`-heavy, which authenticates automatically from `GH_TOKEN` and bypasses the curl+env-var problem. If you ever need raw HTTP (e.g. fetching a repo's raw README), use **WebFetch** as the fallback for public URLs rather than curl.

## Guidelines (hard rules)

- **One PR per run. Zero is an acceptable outcome.** Exiting with a skip code is strictly better than opening a weak PR.
- **Never push code you haven't watched pass the repo's own checks.** The `.aeon-verify.log` is your gate.
- **Never exceed 150 net added LOC or 5 files changed.** Split or narrow scope.
- **Never bundle refactor with fix**, never rename files, never reformat unrelated code.
- **Never add dependencies** unless the scope explicitly requires one and it's a mainstream package already in the ecosystem's common set.
- **Always disclose AI authorship** in the PR body with the revise-or-close offer.
- **Always respect explicit AI-ban policies** — no edge-case reasoning, just skip.
- **Never push to main/master** of any repo, including forks.
- **Never ship speculative work** — every PR must cite a concrete line/test/issue comment.
- If you can't find work that clears the bar, log the skip code and exit — that's a successful run.

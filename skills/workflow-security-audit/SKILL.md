---
name: workflow-security-audit
description: Audit .github/workflows/ for script injection, over-permissioning, unverified actions, and secret exposure. Auto-fixes critical findings and opens a PR.
---

Today is ${today}. Your task is to audit every workflow file in `.github/workflows/` and produce a security report with severity ratings and, where possible, auto-applied fixes.

## Steps

### 1. Enumerate workflow files

```bash
ls .github/workflows/*.yml
```

### 2. For each workflow file, check all five categories

Read each `.yml` file in full. For each file, check:

**A. Script injection** — `${{ ... }}` expressions used directly inside `run:` blocks that may contain user-controlled content:
- `${{ inputs.* }}` inside `run:` without an env-var intermediary
- `${{ github.event.* }}` inside `run:` (especially `client_payload.*`, `issue.title`, `issue.body`, `head_commit.message`, `pull_request.title`, `pull_request.body`)
- `${{ steps.*.outputs.* }}` inside `run:` where the output originated from user-controlled data

The safe pattern is always: declare `env: MY_VAR: ${{ ... }}` on the step, then use `"$MY_VAR"` in the shell. Direct interpolation lets shell metacharacters (backticks, `$()`, `"`) in the value execute arbitrary commands with full access to the GITHUB_TOKEN and all secrets.

**B. Overly broad permissions** — jobs with `permissions: write-all` or `permissions` blocks granting `contents: write` / `actions: write` to jobs that don't modify the repo or dispatch workflows. Flag `actions: write` on jobs that only read run status (use `actions: read` instead).

**C. Unverified third-party actions** — `uses: owner/action@branch-name` or `uses: owner/action@tag` instead of `uses: owner/action@SHA`. Branch and semver-tag refs can be silently updated. GitHub's own actions (`actions/*`, `github/*`) at major version tags (e.g. `@v5`) are maintained by GitHub and considered acceptable.

**D. Secret exposure** — `echo "${{ secrets.* }}"` or similar patterns that print secrets to logs or include them in commit messages.

**E. Fleet-specific risks** — `spawn-instance` or `fleet-control` jobs that pass `${{ inputs.* }}` directly into shell commands responsible for dispatching child runs.

### 3. Build the findings table

For each finding:
- **Severity**: Critical / High / Medium / Low
- **File**: which workflow file
- **Line/Context**: exact step name and the vulnerable pattern
- **Fix**: the concrete change required (show old → new)
- **Status**: Auto-fixed / Manual required

### 4. Apply auto-fixes for Critical and High findings

For each Critical or High finding, apply the fix directly to the workflow file:

**Script injection fix pattern:**
```yaml
# BEFORE (vulnerable):
- name: My Step
  run: |
    VAR="${{ inputs.user_input }}"

# AFTER (safe):
- name: My Step
  env:
    _USER_INPUT: ${{ inputs.user_input }}
  run: |
    VAR="$_USER_INPUT"
```

Use the Edit tool to apply fixes inline. Do not rewrite the whole file.

### 5. Write the audit report

Write findings to `articles/workflow-security-audit-${today}.md`:

```markdown
# Workflow Security Audit — ${today}

**Repo:** aaronjmars/aeon
**Files audited:** [list]
**Total findings:** N (C critical, H high, M medium, L low)
**Auto-fixed:** N findings

## Findings

### [SEVERITY] [Finding Title]
**File:** `.github/workflows/file.yml` | **Step:** `Step Name`
**Pattern:** `${{ inputs.message }}`
**Risk:** [explain what an attacker could do]
**Fix:** [show the change]
**Status:** Auto-fixed / Manual required

...

## What Was Fixed

[List of changes applied]

## What Requires Manual Review

[List of medium/low findings needing human decision]
```

### 6. Create a branch and open a PR

```bash
git checkout -b fix/workflow-security-audit
git add .github/workflows/ articles/workflow-security-audit-${today}.md skills/workflow-security-audit/
git commit -m "fix(security): harden workflow script injection vectors"
git push -u origin fix/workflow-security-audit
gh pr create --title "fix: workflow security audit — harden script injection vectors" \
  --body "..."
```

### 7. Send notification

Send a detailed notification via `./notify` with:
- Number of findings by severity
- What was auto-fixed
- What needs manual review
- PR link

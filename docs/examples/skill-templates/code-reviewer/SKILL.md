---
name: [REPLACE: SKILL_NAME]
description: First-touch review of newly opened PRs on [REPLACE: WATCHED_REPO] — verdict + welcoming comment + label
metadata:
  category: dev
  var: ""
  tags:
    - dev
---

> **${var}** — Optional. PR number to review. If empty, scans all newly-opened PRs on `[REPLACE: WATCHED_REPO]`.

Today is ${today}. Review external PRs on **[REPLACE: WATCHED_REPO]** with a focus on **[REPLACE: REVIEW_FOCUS]**.

## Steps

1. **List candidates** — every open PR opened in the last 24h that hasn't been reviewed by this skill yet:

   If `${var}` is set, that PR number is the only candidate. Otherwise get the cutoff with its own call, `date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ`, and write the printed value into the filter literally (the `<SINCE>` below):

   ```bash
   gh pr list -R [REPLACE: WATCHED_REPO] --state open --json number,author,createdAt,additions,deletions --jq '.[] | select(.createdAt >= "<SINCE>") | select(.author.login != "github-actions[bot]" and .author.login != "aeonframework") | .number'
   ```

   Track previously-reviewed PRs in `memory/topics/[REPLACE: SKILL_NAME]-reviewed.json` (a flat array of PR numbers). Skip anything already in there.

2. **For each PR** — fetch metadata + diff:

   One call per PR, with its number written in literally (the `<PR>` below). Read the output directly; do not save it to a file:

   ```bash
   gh pr view <PR> -R [REPLACE: WATCHED_REPO] --json title,body,additions,deletions,files,author
   ```

   ```bash
   gh pr diff <PR> -R [REPLACE: WATCHED_REPO]
   ```

   Run the diff call only for a PR under the size limit. Skip if `additions + deletions > [REPLACE: MAX_PR_LINES]`: flag it as `DEFERRED: too large for first-touch review`, leave a note, and move on.

3. **Apply the rubric** — assign one of four verdicts:

   | Verdict | Trigger |
   |---------|---------|
   | **ACCEPT** | Touches expected paths, follows repo conventions, focused scope, no obvious bugs in the diff. |
   | **NEEDS-CHANGES** | Reasonable intent but specific issues: missing tests, broken format, incorrect assumption, naming. |
   | **DEFER** | Out of scope for this skill — needs a human reviewer (large refactor, architectural change). |
   | **OUT-OF-SCOPE** | Touches files outside what the repo accepts contributions on (e.g. lock files, generated assets). |

   Focus the rubric on **[REPLACE: REVIEW_FOCUS]** — that's the lens that matters most for this repo.

4. **Post a comment** — use a friendly, specific tone. Acknowledge the contributor, name the verdict, give 1-3 concrete bullets:

   Write the comment to `/tmp/review-comment-<PR>.md` with Write:

   ```markdown
   Thanks for the PR! [verdict text]

   - [bullet 1]
   - [bullet 2]
   ```

   Then post it:

   ```bash
   gh pr comment <PR> -R [REPLACE: WATCHED_REPO] --body-file /tmp/review-comment-<PR>.md
   ```

5. **Label** the PR via `gh pr edit <PR> -R [REPLACE: WATCHED_REPO] --add-label "<label>"`: use `accepted` / `needs-changes` / `defer` / `out-of-scope` (create the labels in the target repo first if they don't exist).

6. **Notify** via `./notify` only on `ACCEPT` or `OUT-OF-SCOPE` — those are the actionable verdicts for the operator. Silent on `NEEDS-CHANGES` and `DEFER` (the comment on the PR is the signal).

7. **Log** — append to `memory/logs/${today}.md`:
   ```
   ## [REPLACE: SKILL_NAME]
   - **PRs reviewed**: N (skipped M as previously seen)
   - **Verdicts**: accept=X, needs-changes=Y, defer=Z, out-of-scope=W
   - **Status**: REVIEW_OK | REVIEW_QUIET (no new PRs)
   ```

## Network note

`gh` handles auth via the workflow's `GITHUB_TOKEN`. To comment on or label a PR in **[REPLACE: WATCHED_REPO]**, the token needs `pull-requests: write` and `issues: write` permission on that repo — verify the workflow grants those, or this skill will silently fail to write.

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`PRS=$(gh pr list ...)`), uses `if` / `for`, joins commands with `;`, `&&` or `||`, or redirects into a file (`> .pr-meta.json`), and each refusal costs a model turn. So make one `gh` call per PR with the number written in literally, read `gh` output directly, and write the comment body, `reviewed.json` and the log with Write/Edit.

## Constraints

- **Be welcoming**. The PR may be someone's first open-source contribution. Lead with thanks, then specifics.
- **Never auto-merge**. This skill is first-touch review, not auto-merge. Even an `ACCEPT` verdict still waits for a human merge.
- **Idempotent**. Re-running the skill must never double-comment. The `reviewed.json` state file is what enforces that.

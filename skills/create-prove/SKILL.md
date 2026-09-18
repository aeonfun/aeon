---
name: create-prove
description: Run a changed Aeon skill for real and attach SHA-bound behavioral evidence to its PR
metadata:
  title: Create Prove
  category: dev
  mode: write
  var: ""
  tags:
    - dev
    - verification
  permissions:
    - contents:read
    - actions:write
    - pull-requests:write
  commits: false
---
> **${var}** - Required immutable target in the form `owner/repo#pr@40-character-lowercase-sha`.

Today is ${today}. Prove the behavior of one Aeon-shaped change by running the changed skill through the target repository's real `aeon.yml` workflow. A green diff review is not proof. A successful, correlated Actions run is proof.

## Scope

This first implementation supports Aeon-shaped pull requests that change exactly one runnable `skills/<slug>/SKILL.md`. It does not launch conventional applications and it does not guess which skill represents a workflow-only or configuration-only change. Unsupported target shapes must fail closed without posting a proof receipt.

Never prove `create-prove` by recursively dispatching itself. Exit `PROVE_UNSUPPORTED` instead.

## Steps

1. Parse `${var}` into `target=owner/repo#pr` and `expected_sha`. Reject any value outside the exact grammar above with `PROVE_INVALID_TARGET`.
2. Read the PR through `gh api`. Require all of the following:
   - the PR is open;
   - its current `head.sha` equals `expected_sha`;
   - its head branch belongs to the same repository, because `gh workflow run --ref` cannot execute an untrusted fork branch in the base repository;
   - exactly one changed path matches `skills/<slug>/SKILL.md`;
   - the slug is not `create-prove`.
   Any mismatch exits `PROVE_UNSUPPORTED` or `PROVE_STALE` without a receipt.
3. Inspect the changed skill's frontmatter and instructions. Choose the smallest real, non-destructive variable that exercises the changed behavior. If no safe real invocation exists, exit `PROVE_UNSAFE` rather than inventing evidence. Do not use synthetic credentials or a dry-run mode.
4. Dispatch the target branch's workflow by filename, with a unique correlation ID whose `dispatch_id` **must start with the literal prefix `prove-`** — `.github/workflows/aeon.yml`'s commit-skip guard only recognizes that exact prefix to know this run is being proved, not a normal dispatch, and must not commit or push to the branch it's proving. Getting this prefix wrong silently defeats the immutable-head guarantee this whole skill exists to provide:
   ```bash
   dispatch_id="prove-${pr_number}-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}"
   gh workflow run aeon.yml --repo "$repo" --ref "$head_branch" \
     -f skill="$skill" -f var="$proof_var" -f dispatch_id="$dispatch_id"
   ```
   Discover the run only by the exact correlated run title, using the same rule as `chain-runner.yml`. Never select merely the newest run for that skill.
5. Wait up to 30 minutes. Require `status=completed` and `conclusion=success`. Fetch the run log and the captured skill output. Confirm the output is non-empty and does not contain `_No output captured._`. A successful Actions wrapper with no captured behavior is `PROVE_MISSING_EVIDENCE`.
6. Re-read the PR and require its head SHA still equals `expected_sha`.
7. Post one PR comment containing a concise description of the exercised path, the run URL, a short output excerpt, and exactly one final machine receipt:
   ```text
   <!-- aeon-proof:{"schema":1,"target":"owner/repo#N","sha":"<sha>","kind":"aeon-skill","skill":"<slug>","evidence_run_id":123,"evidence_url":"https://github.com/owner/repo/actions/runs/123","verdict":"proven"} -->
   ```
   Construct the JSON with `jq -cn`, then render it on one line. Do not post the receipt until every gate above passes.
8. End with the target, skill, run ID, run URL, and `PROVE_VERDICT=proven` in the captured output.

## Constraints

- The proof run must execute the PR head branch, not `main`.
- Never treat CI checks, source inspection, or the prior review receipt as behavioral evidence.
- Never post a `proven` receipt for a failed, cancelled, timed-out, stale, empty-output, unsupported, or unsafe run.
- Do not merge, close, approve, or modify the target PR.
- Do not commit repository files.

## Network note

Use `gh` for every GitHub read, dispatch, log fetch, and PR comment. Authentication is provided by the workflow. Never print tokens or place secret values on a command line.

## Log

Append the result to `memory/logs/${today}.md` under `### create-prove`, including the target, SHA, selected skill, evidence run ID, and terminal verdict. The workflow may persist the captured output on your behalf.

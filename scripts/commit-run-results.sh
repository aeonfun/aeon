#!/usr/bin/env bash
# Shared post-run commit for aeon.yml and messages.yml ("Commit results").
#
# Usage: commit-run-results.sh <label>
#   <label> goes into the commit subject: chore(<label>): auto-commit <date>.
#
# The caller sets the git identity and removes its generated helper scripts
# first. Run it from the repo root. The workflows run the copy from the run's
# starting commit (git show "$GITHUB_SHA:scripts/commit-run-results.sh"), not
# the working tree, so an agent edit to this file never changes how its own
# run is committed.
#
# If the agent left the checkout on a feature branch, only its real change is
# committed and pushed to that branch. Post-run state (memory/, output/,
# apps/dashboard/outputs/: logs, token usage, skill-health, chain output, the
# dashboard feed) is stashed first and committed on main, through
# scripts/git-push-retry.sh. A failed branch push still records the state on
# main, then fails the step instead of being swallowed.
#
# A run dispatched on a non-main ref has no local main (single-branch
# checkout), so that branch stays the only home for everything, as before.
#
# -e matches the `bash -e` the step body used to run under. Everything lives
# inside main() so bash parses the whole file before running it, in case it is
# run from the working tree, where `git checkout main` can swap it out.
set -euo pipefail

main() {
  local LABEL="${1:?usage: commit-run-results.sh <label>}"
  local CURRENT_BRANCH BRANCH_PUSH_FAILED=false HAS_MAIN STASHED p PUSH_RC
  local -a STATE_PATHS=()
  CURRENT_BRANCH=$(git branch --show-current)

  # A failed feature-branch push still records this run's state on main
  # below, then fails the step so the lost PR work is visible.
  finish() {
    if [ "$BRANCH_PUSH_FAILED" = "true" ]; then
      echo "::error::Feature branch $CURRENT_BRANCH failed to push - its commits never reached the remote"
      exit 1
    fi
    exit "$1"
  }

  # If the agent created a feature branch, push it then switch back to main
  if [ "$CURRENT_BRANCH" != "main" ] && [ -n "$CURRENT_BRANCH" ]; then
    echo "On feature branch: $CURRENT_BRANCH"
    # main is only guaranteed present when the run STARTED on main (the
    # normal scheduled / Run-now / message path). A run dispatched against a
    # non-main ref gets a single-branch checkout with no local main, so
    # that branch stays the only home for everything, as before.
    HAS_MAIN=false
    git show-ref --verify --quiet refs/heads/main && HAS_MAIN=true

    # Post-run state written by the agent and by the workflow's own steps
    # (memory/logs, token-usage.csv, skill-health, output/.chains,
    # output/.attest, the dashboard feed) belongs on main, not in the PR.
    # Stash it before the branch commit so `git add -A` only ships the
    # agent's real change, then pop it back on main below.
    # Only paths that exist: one unmatched pathspec makes `stash push -u`
    # save the stash and then die halfway through cleaning the tree.
    for p in memory output apps/dashboard/outputs; do
      if [ -e "$p" ] || [ -n "$(git ls-files -- "$p")" ]; then STATE_PATHS+=("$p"); fi
    done
    STASHED=false
    if [ "$HAS_MAIN" = "true" ] && [ "${#STATE_PATHS[@]}" -gt 0 ] && [ -n "$(git status --porcelain -- "${STATE_PATHS[@]}" 2>/dev/null)" ]; then
      git stash push --include-untracked -m "aeon post-run state" -- "${STATE_PATHS[@]}"
      STASHED=true
    fi

    git add -A
    if ! git diff --staged --quiet; then
      git commit -m "chore($LABEL): auto-commit $(date +%Y-%m-%d)"
    fi
    if ! git push --force-with-lease -u origin "$CURRENT_BRANCH"; then
      echo "::warning::Push of feature branch $CURRENT_BRANCH failed; recording run state on main, then failing the step"
      BRANCH_PUSH_FAILED=true
    fi

    if [ "$HAS_MAIN" != "true" ]; then
      echo "main not present locally (non-main dispatch) - nothing to record on main"
      finish 0
    fi
    # No pull here: the stash was taken against the run's starting main, so
    # it pops cleanly onto local main, and git-push-retry.sh below rebases
    # onto the remote with its state-file conflict policy.
    git checkout main
    if [ "$STASHED" = "true" ] && ! git stash pop; then
      # Only when the agent's own branch commits touched these paths. Restore
      # this run's end-of-run copy of the stashed paths from the stash
      # itself (tracked part, then the untracked part in ^3).
      echo "::warning::post-run state conflicted with main on pop; keeping this run's copy"
      for p in "${STATE_PATHS[@]}"; do
        git checkout 'stash@{0}' -- "$p" 2>/dev/null || true
      done
      if git rev-parse -q --verify 'stash@{0}^3' >/dev/null; then
        git checkout 'stash@{0}^3' -- . 2>/dev/null || true
      fi
      git reset -q
      git stash drop -q || true
    fi
  fi

  # Commit any remaining changes on main
  git add -A
  if git diff --staged --quiet; then
    # Nothing new to commit - but the agent may have committed during its run.
    # Check for unpushed commits and push them if any exist.
    if [ "$(git rev-list origin/main..HEAD --count 2>/dev/null)" = "0" ]; then
      echo "No changes to commit or push"
      finish 0
    fi
    echo "No new changes, but found unpushed commits - pushing"
  else
    git commit -m "chore($LABEL): auto-commit $(date +%Y-%m-%d)"
  fi
  PUSH_RC=0
  bash scripts/git-push-retry.sh || PUSH_RC=$?
  finish "$PUSH_RC"
}

main "$@"

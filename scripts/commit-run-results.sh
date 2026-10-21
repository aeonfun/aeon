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
# run is committed. The push helpers it calls (git-push-retry.sh, audit.sh) and
# the repo's git hooks get the same treatment: they run with push credentials,
# so they come from that commit too, and hooks are switched off.
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

  # Hooks live in the working tree's .git, which the run could write, and so do
  # the fsmonitor and signing settings, which also run a program. Environment
  # config outranks the repo's own config, so this holds for every git call below
  # and in the push helper. The workflows also run scripts/git-config-guard.sh
  # right after the run, which drops the rest (filters, merge drivers, ...).
  local N_CFG="${GIT_CONFIG_COUNT:-0}" kv
  for kv in core.hooksPath=/dev/null core.fsmonitor=false commit.gpgsign=false; do
    export "GIT_CONFIG_KEY_${N_CFG}=${kv%%=*}" "GIT_CONFIG_VALUE_${N_CFG}=${kv#*=}"
    N_CFG=$((N_CFG + 1))
  done
  export GIT_CONFIG_COUNT="$N_CFG"

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
      # this run's end-of-run copy of the files the stash changed (tracked
      # part, then the untracked part in ^3). Not whole directories: the
      # stash tree is the branch head plus those changes, so that would also
      # copy files the agent committed only on its branch onto main
      # (aeon-update's new baseline, before its PR merges).
      echo "::warning::post-run state conflicted with main on pop; keeping this run's copy"
      git diff -z --name-only --no-renames 'stash@{0}^1' 'stash@{0}' -- "${STATE_PATHS[@]}" |
        while IFS= read -r -d '' p; do
          git checkout 'stash@{0}' -- "$p" 2>/dev/null || true
        done
      if git rev-parse -q --verify 'stash@{0}^3' >/dev/null; then
        git checkout 'stash@{0}^3' -- . 2>/dev/null || true
      fi
      git reset -q
      git stash drop -q || true
    fi
  fi

  # scripts/, .github/ and harness-adapter/ are what later runs execute with the
  # repo's credentials, so a run does not change them on main. Skills that need
  # to (aeon-update, skill-repair, self-improve, ...) work on a branch and open a
  # PR, which the feature-branch path above handles. Anything left here,
  # uncommitted or committed by the run, is put back to remote main and reported.
  # The local origin/main ref is the run's to move or delete, so main is fetched
  # fresh; if that fails the run's starting commit stands in, and with neither
  # the step fails rather than skip the check.
  local -a GUARDED=(scripts .github harness-adapter)
  local SRC="" BASE
  if git fetch -q origin +refs/heads/main:refs/remotes/origin/main 2>/dev/null; then
    SRC=origin/main
  elif [ -n "${GITHUB_SHA:-}" ] && git cat-file -e "${GITHUB_SHA}^{commit}" 2>/dev/null; then
    SRC="$GITHUB_SHA"
  fi
  if [ -z "$SRC" ]; then
    echo "::error::Could not fetch main and no starting commit to check ${GUARDED[*]} against; not pushing"
    finish 1
  fi
  # Only the run's own commits count: commits it pulled from main are already there.
  BASE=$(git merge-base "$SRC" HEAD 2>/dev/null || echo "$SRC")
  if [ -n "$(git status --porcelain -- "${GUARDED[@]}")" ] \
    || [ -n "$(git diff --name-only "$BASE" HEAD -- "${GUARDED[@]}")" ]; then
    echo "::error::This run changed ${GUARDED[*]} on main; those changes were dropped. Changes there belong on a branch with a PR."
    for p in "${GUARDED[@]}"; do
      if git cat-file -e "$SRC:$p" 2>/dev/null; then
        git restore --source="$SRC" --staged --worktree -- "$p"
      else
        git rm -rfq --cached --ignore-unmatch -- "$p"
      fi
      git clean -fdq -- "$p"
    done
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
  local HELPERS
  HELPERS=$(mktemp -d)
  # In a workflow run the helpers come from the starting commit or not at all:
  # falling back to the working-tree copy would run whatever the run left there.
  if [ -z "${GITHUB_SHA:-}" ]; then
    bash scripts/git-push-retry.sh || PUSH_RC=$?
  elif git show "$GITHUB_SHA:scripts/git-push-retry.sh" > "$HELPERS/git-push-retry.sh" 2>/dev/null \
    && git show "$GITHUB_SHA:scripts/audit.sh" > "$HELPERS/audit.sh" 2>/dev/null; then
    AEON_AUDIT_SCRIPT="$HELPERS/audit.sh" bash "$HELPERS/git-push-retry.sh" || PUSH_RC=$?
  else
    echo "::error::Could not read the push helpers from the starting commit $GITHUB_SHA; not pushing"
    PUSH_RC=1
  fi
  rm -rf "$HELPERS"
  finish "$PUSH_RC"
}

main "$@"

#!/usr/bin/env bash
# Mechanical checks for the feature skill, so "is this already open?" and
# "does this PR close a real issue?" are answered by the GitHub API, not by the
# model's reading of it.
#
#   feature-open-pr.sh covered <owner/repo> <branch> [issue-number]
#     exit 0 and print the PR URL when an open PR from this account already
#     covers the work: same head branch, or its title/body references #issue.
#     A branch ending in * matches any head branch with that prefix (for names
#     that carry a date). For an exact name, also exit 0 (printing the branch)
#     when the branch already exists on the remote. exit 1 when nothing covers
#     it. exit 2 when GitHub could not be read: the caller must treat that as
#     covered and skip, never open blind. "This account" is the token's login
#     from /user, or github-actions[bot] when the token cannot read /user.
#
#   feature-open-pr.sh issue-open <owner/repo> <issue-number>
#     exit 0 when #N is an open issue (not a pull request). exit 1 otherwise,
#     printing its state (closed, pull-request, missing). exit 2 on API error.
set -euo pipefail

usage() {
  echo "usage: $0 covered <owner/repo> <branch> [issue] | issue-open <owner/repo> <issue>" >&2
  exit 2
}

valid_repo() { [[ "$1" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; }
valid_num() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }

cmd=${1:-}
case "$cmd" in
covered)
  [ $# -ge 3 ] && [ $# -le 4 ] || usage
  repo=$2 branch=$3 issue=${4:-}
  valid_repo "$repo" || usage
  [ -n "$branch" ] || usage
  [ -z "$issue" ] || valid_num "$issue" || usage
  # Resolve the token's own login explicitly instead of passing "@me": "@me"
  # needs /user, which 403s for the Actions GITHUB_TOKEN, and that would turn
  # every run into exit 2 (skip). Same fallback as scripts/state_store.sh.
  actor=$(gh api user --jq .login 2>/dev/null || true)
  [ -n "$actor" ] || actor="github-actions[bot]"
  if ! prs=$(gh pr list -R "$repo" --state open --author "$actor" --limit 100 --json number,url,title,body,headRefName 2>/dev/null); then
    echo "could not list open PRs on $repo" >&2
    exit 2
  fi
  if url=$(printf '%s' "$prs" | jq -er --arg b "$branch" --arg n "$issue" '
      [ .[] | select((if ($b | endswith("*")) then (.headRefName | startswith($b | rtrimstr("*"))) else .headRefName == $b end)
        or ($n != "" and (((.title // "") + "\n" + (.body // "")) | test("#" + $n + "(?![0-9])")))) ]
      | first | .url'); then
    echo "$url"
    exit 0
  fi
  [[ "$branch" == *'*' ]] && exit 1
  code=$(gh api -i "repos/$repo/branches/$branch" 2>/dev/null | awk 'NR==1{sub(/\r$/, ""); print $2; exit}' || true)
  case "$code" in
  200) echo "branch $branch already exists on $repo"; exit 0 ;;
  404) exit 1 ;;
  *) echo "could not check branch $branch on $repo" >&2; exit 2 ;;
  esac
  ;;
issue-open)
  [ $# -eq 3 ] || usage
  repo=$2 issue=$3
  { valid_repo "$repo" && valid_num "$issue"; } || usage
  resp=$(gh api -i "repos/$repo/issues/$issue" 2>/dev/null || true)
  code=$(printf '%s' "$resp" | awk 'NR==1{sub(/\r$/, ""); print $2; exit}')
  case "$code" in
  200) ;;
  404 | 410) echo missing; exit 1 ;;
  *) echo "could not read $repo#$issue" >&2; exit 2 ;;
  esac
  state=$(printf '%s' "$resp" | awk 'body { print } /^\r?$/ { body = 1 }' | jq -r 'if .pull_request then "pull-request" else .state end')
  [ "$state" = open ] && exit 0
  echo "$state"
  exit 1
  ;;
*) usage ;;
esac

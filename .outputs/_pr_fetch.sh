#!/usr/bin/env bash
set -uo pipefail
SINCE="$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)"
OUT=/home/runner/work/aeon/aeon/.outputs
echo "SINCE=${SINCE}" > "${OUT}/_pr_meta.txt"

for slug in tomscaria/swarm-fund-mvp tomscaria/lore-financial-teaser aaronjmars/aeon; do
  tag="$(echo "${slug}" | tr '/' '_')"
  gh api "repos/${slug}/commits" -X GET -f since="${SINCE}" --jq '.[] | {sha: .sha[0:7], full_sha: .sha, message: .commit.message, author: .commit.author.name, date: .commit.author.date}' --paginate > "${OUT}/_pr_${tag}_commits.jsonl" 2> "${OUT}/_pr_${tag}_commits.err"
  echo "${slug} commits exit=$? lines=$(wc -l < "${OUT}/_pr_${tag}_commits.jsonl")"

  gh api "repos/${slug}/events" --jq '[.[] | select(.type == "PushEvent") | select(.created_at >= "'"${SINCE}"'") | {actor: .actor.login, created_at: .created_at, ref: .payload.ref, head: .payload.head[0:7], commits: [.payload.commits[] | {sha: .sha[0:7], message: .message, author: .author.name}]}]' --paginate > "${OUT}/_pr_${tag}_events.json" 2> "${OUT}/_pr_${tag}_events.err"
  echo "${slug} events exit=$? lines=$(wc -l < "${OUT}/_pr_${tag}_events.json")"

  gh pr list --repo "${slug}" --state merged --search "merged:>=${SINCE}" --json number,title,author,mergedAt,mergeCommit,additions,deletions,files,body,labels --limit 50 > "${OUT}/_pr_${tag}_merged.json" 2> "${OUT}/_pr_${tag}_merged.err"
  echo "${slug} merged-prs exit=$? size=$(wc -c < "${OUT}/_pr_${tag}_merged.json")"
done

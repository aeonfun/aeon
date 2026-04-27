#!/usr/bin/env bash
set -euo pipefail
FROM_DATE=$(date -u -d "1 day ago" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
TO_DATE=$(date -u +%Y-%m-%d)
mkdir -p .xai-cache

if [ -z "${XAI_API_KEY:-}" ]; then
  echo "XAI_API_KEY not set"
  exit 2
fi

PROMPT="Search X from ${FROM_DATE} to ${TO_DATE} for tweets in the AI-agents conversation: autonomous agents, agent frameworks, MCP / agent protocols, agent products, agent benchmarks, agent research papers. Return up to 40 candidates. For EACH candidate you MUST return: @handle, follower_count (integer or null), role_guess (builder|founder|researcher|investor|commentator|anon), one-line claim (what they actually said - not a paraphrase, the thesis), likes (int), retweets (int), replies (int), posted_at (ISO), direct_link (https://x.com/username/status/ID). Prefer builders/founders/researchers. Skip obvious engagement-farming threads (RT if you agree, reply-guy pileons, giveaways). Return a clean JSON array under the key 'candidates'."

BODY=$(jq -n \
  --arg model "grok-4-1-fast" \
  --arg prompt "$PROMPT" \
  --arg from "$FROM_DATE" \
  --arg to "$TO_DATE" \
  '{model: $model, input: [{role: "user", content: $prompt}], tools: [{type: "x_search", from_date: $from, to_date: $to}]}')

RESP=$(curl -sS --max-time 180 -w "\n__HTTP__%{http_code}" -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${XAI_API_KEY}" \
  -d "$BODY") || { echo "curl exit $?"; exit 3; }
HTTP=$(echo "$RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
echo "HTTP=$HTTP"
echo "$RESP" | grep -v '__HTTP__' > .xai-cache/agent-buzz.json
wc -c .xai-cache/agent-buzz.json
echo "---preview---"
head -c 800 .xai-cache/agent-buzz.json
echo

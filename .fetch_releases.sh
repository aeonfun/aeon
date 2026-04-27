#!/bin/bash
REPOS=(
  "anthropics/anthropic-sdk-python"
  "anthropics/anthropic-sdk-typescript"
  "anthropics/claude-code"
  "anthropics/claude-agent-sdk-python"
  "openai/openai-python"
  "openai/openai-node"
  "openai/openai-agents-python"
  "BerriAI/litellm"
  "langchain-ai/langchain"
  "run-llama/llama_index"
  "vercel/next.js"
  "supabase/supabase"
  "ggerganov/llama.cpp"
  "huggingface/transformers"
  "anza-xyz/agave"
  "ethereum/go-ethereum"
  "uniswap/v4-core"
  "aave/aave-v3-core"
)
for repo in "${REPOS[@]}"; do
  printf "===REPO=== %s\n" "$repo"
  gh api "/repos/$repo/releases?per_page=5" 2>&1 | jq -c '[.[] | {tag: .tag_name, name: .name, pub: .published_at, url: .html_url, pre: .prerelease, draft: .draft, body: ((.body // "")[0:800])}]' 2>&1
done

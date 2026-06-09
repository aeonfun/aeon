---
name: Tweet Digest
description: Account-based digest of recent tweets from tracked X/Twitter accounts. Sibling to fetch-tweets (keyword) and tweet-roundup (topic).
var: ""
tags: [social]
requires: [XAI_API_KEY]
---
> **${var}** — Optional. If set, restrict to that single account (or topic filter). If empty, processes every account in `memory/topics/tracked-accounts.yml`.

This skill is the **account-based** sibling in the tweet-fetcher family:

| Skill | Axis | Input |
|---|---|---|
| `fetch-tweets` | keyword / query | `${var}` is the search query |
| `tweet-roundup` | topic | groups recent tweets by topic |
| `tweet-digest` (this) | **account** | reads a list of handles from `memory/topics/tracked-accounts.yml` |

Use this skill when you care about "what did *these specific people* post" rather than "what's anyone saying about X."

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice for the per-tweet one-sentence takes. If they are empty templates or absent, write the takes in a clear, direct, neutral tone — no hedging, no editorializing beyond what the tweet itself says.

## Config

Reads `memory/topics/tracked-accounts.yml`. If the file is missing or `accounts: []`, log `TWEET_DIGEST_NO_CONFIG` and exit (no notification).

```yaml
# memory/topics/tracked-accounts.yml
accounts:
  - handle: vitalikbuterin
    why: ethereum core thinking
  - handle: balajis
    why: macro + tech narratives
  - handle: <handle>
    why: <one-line reason — used to give the digest grouping context>
```

The `why` field is optional but useful — it's the grouping/context label in step 2.

## Steps

Read `memory/MEMORY.md` for context and the last 2 days of `memory/logs/` to dedup recent tweets.

### 1. Fetch recent tweets per account

For each `handle` in the config (or just the one from `${var}` if set):

```bash
curl -m 30 -s -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "input": [{
      "role": "user",
      "content": "Search X for the latest tweets from:'"$HANDLE"' in the last 3 days. Return the 5 most interesting or substantive tweets. For each: full text, date, direct link (https://x.com/'"$HANDLE"'/status/ID). Skip retweets of others."
    }],
    "tools": [{"type": "x_search"}]
  }'
```

If `XAI_API_KEY` is unset, log `TWEET_DIGEST_NO_KEY: skill requires XAI_API_KEY` and exit (no notification).

**Dedup:** grep the last 2 days of `memory/logs/` for `https://x.com/` URLs already reported. Drop any candidate URL that's already been seen.

### 2. Group by theme, not by account

Walk the candidate set across all accounts. Identify 2–4 themes (e.g. "L2 design decisions", "macro / rates", "AI model releases", "regulation"). Each tweet maps to one theme. A `why:` label from the config can seed theme naming when an account is a single-topic feed.

### 3. Write a one-sentence take per notable tweet

The take states **what the tweet says**, not your opinion of it. Voice per the Voice section above.

### 4. Format and notify

Send via `./notify` (under 4000 chars):

```
*Tweet Digest — ${today}*

*Theme: <theme>*
@handle: <one-sentence summary> — [link](url)
@handle: <one-sentence summary> — [link](url)

*Theme: <theme>*
...
```

### 5. Log

Append to `memory/logs/${today}.md` with the tweet URLs reported (so the next run can dedup). If no notable tweets found across all tracked accounts: log `TWEET_DIGEST_OK` and end (no notification).

## Sandbox Note

The X.AI API requires `Authorization: Bearer $XAI_API_KEY` — the sandbox blocks env-var expansion in curl headers. Use the **pre-fetch pattern** (see CLAUDE.md): create `scripts/prefetch-xai-tweet-digest.sh` to fetch each account's tweets into `.xai-cache/tweet-digest-<handle>.json` before Claude runs. The skill reads cached JSON if present, falls back to live curl only when running outside the sandbox.

## Environment Variables

- `XAI_API_KEY` — required. X.AI API key for Grok's `x_search` tool.

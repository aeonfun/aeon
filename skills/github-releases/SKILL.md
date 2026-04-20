---
name: GitHub Releases
description: Upgrade-triage digest of new releases across watched AI/infra/crypto repos
schedule: "0 8 * * *"
commits: false
permissions: []
var: ""
tags: [dev]
---
> **${var}** — Comma-separated list of repos (e.g. `anthropics/anthropic-sdk-python,anza-xyz/agave`). If empty, uses the default watch list.

<!-- autoresearch: variation D — reframe as upgrade triage (4 action tiers) instead of a flat inventory, so each release earns a decision -->

Read `memory/MEMORY.md` for context.
Read the last 2 days of `memory/logs/` and `memory/github-releases-state.json` (if present) to avoid reporting the same tag twice.

## Goal

Turn a list of "$N$ new releases" into $M$ upgrade decisions. Every release earns a triage verdict from semver delta + release-notes content, so the reader acts rather than skims.

## Steps

### 1. Build the repo list

If `${var}` is set, split on commas and use that. Otherwise use this default watch list:

**AI / LLM**
- anthropics/anthropic-sdk-python
- anthropics/anthropic-sdk-typescript
- anthropics/claude-code
- anthropics/claude-agent-sdk-python
- openai/openai-python
- openai/openai-node
- openai/openai-agents-python
- BerriAI/litellm
- langchain-ai/langchain
- run-llama/llama_index

**Infra / Dev**
- vercel/next.js
- supabase/supabase
- ggerganov/llama.cpp
- huggingface/transformers

**Crypto / DeFi**
- anza-xyz/agave
- ethereum/go-ethereum
- uniswap/v4-core
- aave/aave-v3-core

(`solana-labs/solana` was archived 2025-01-22 — replaced with `anza-xyz/agave`.)

### 2. Fetch releases per repo

Use **WebFetch** against the list endpoint, not `/releases/latest`:
```
https://api.github.com/repos/{owner}/{repo}/releases?per_page=5
```
`/releases/latest` silently drops prereleases and drafts, so repos that ship only prereleases look silent. The list endpoint shows everything; we decide what to do with each in step 4.

Extract per release: `tag_name`, `name`, `published_at`, `html_url`, `prerelease`, `draft`, `body` (first 800 chars).

**Fallback chain:**
1. On 404 (repo has no releases ever): fetch `https://api.github.com/repos/{owner}/{repo}/tags?per_page=3` and treat the newest tag as a bare release (tag only, no body).
2. On 403/429 (rate-limit): record `ratelimited` for that repo and skip. Do not retry.
3. On any other error: record `error` and skip.

If `GITHUB_TOKEN` is in env, include `Authorization: Bearer $GITHUB_TOKEN`. In GitHub Actions the token is auto-injected — the workflow must pass `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Anonymous rate limit is 60 req/hr; authenticated is 5000.

### 3. Filter by window + dedup

Keep a release iff **either**:
- `published_at` is within the last 25 hours (1h overlap absorbs cron drift), **or**
- `tag_name` is not present in `memory/github-releases-state.json[repo].last_tag` and is newer than the stored entry.

Drop `draft=true`. Keep `prerelease=true` — they feed the SKIP tier.

### 4. Triage — classify each kept release into one tier

**Semver delta.** Strip a leading `v`. Parse `MAJOR.MINOR.PATCH[-pre]` against the prior tag (from state, or from the previous release in the list). If unparseable (e.g. `release-2024-11-15`), treat delta as `unknown` and rely on keywords alone.

**Body keyword scan** (case-insensitive, on `body` + `name`):
- `security` family: `security`, `CVE-`, `vulnerability`, `critical fix`, `RCE`, `auth bypass`, `patch release`
- `breaking` family: `breaking change`, `BREAKING`, `migration required`, `deprecat`, `removed`
- `feature` family: `add`, `introduce`, `new`, `support for`, `now supports`

**Decision ladder — first match wins:**

| Tier | Emoji | Trigger |
|------|-------|---------|
| UPGRADE ASAP | 🔴 | Any `security` keyword match, regardless of semver. |
| UPGRADE SOON | 🟡 | MAJOR bump, **or** any `breaking` keyword match. |
| FYI | 🔵 | MINOR or PATCH bump, no breaking/security keywords. |
| SKIP | ⚪ | `prerelease=true`, **or** tag matches `-rc\|-alpha\|-beta\|-canary\|-nightly\|-dev`. |

A prerelease that also has a `security` keyword promotes to 🔴 (security always wins).

### 5. Compose output (under 4000 chars)

Always emit a **lead line**:
```
*GitHub Releases — ${today}* — N updates · 🔴 A asap · 🟡 B soon · 🔵 C fyi · ⚪ D skipped
```

If every tier is empty (N=0), log `GITHUB_RELEASES_NONE` and end — no notification.

Otherwise emit tiers in order 🔴 → 🟡 → 🔵 → ⚪. Omit empty tiers. Within a tier, sort by `published_at` descending.

**Each item is one line:**
```
🔴 [owner/repo v1.2.3](html_url) — <triage reason ≤15 words>
```

**Triage-reason rules:**
- Lead with a concrete verb: `Patches`, `Breaks`, `Adds`, `Deprecates`, `Removes`, `Fixes`.
- Name the specific thing: `auth bypass in /session`, `JSON streaming for tools`, `v2 response schema`. No generic filler (`various bugs`, `improvements`, `stability`).
- Never echo the version, the repo name, or the release title. Never end with `…`.
- Strip markdown, emojis, and `Full Changelog:` links before scanning.
- If the body is empty or pure noise, fall back to the release `name` — but only if it contains a concrete noun (not `v1.2.3`).

Truncate the ⚪ SKIP tier to the first 3 items, then `… +N more`.

Append a blank line and the **source-status footer**:
```
_sources: ok=12 notfound=2 ratelimited=0 error=0_
```

### 6. Update state

Write `memory/github-releases-state.json`:
```json
{
  "updated_at": "<ISO 8601>",
  "repos": {
    "owner/repo": { "last_tag": "v1.2.3", "last_published_at": "<ISO 8601>" }
  }
}
```

Only update entries for repos that returned at least one release or tag this run. Preserve existing entries for `ratelimited` / `error` / `notfound` repos — don't clobber good history with a bad fetch.

### 7. Send via `./notify`

Send the full composed message (lead line + tier sections + footer) via `./notify`. Keep total under 4000 chars — if over, truncate the 🔵 FYI tier first, then ⚪ SKIP, never 🔴 or 🟡.

Distinct end states:
- `GITHUB_RELEASES_NONE` — every source succeeded, zero fresh releases (quiet day).
- `GITHUB_RELEASES_ERROR` — every source failed (all 404 / ratelimited / error). Notify with the error state so a net problem doesn't masquerade as a quiet day.

### 8. Log

Append to `memory/logs/${today}.md`:
```
### github-releases
- Tiers: 🔴 A · 🟡 B · 🔵 C · ⚪ D
- Reported: <owner/repo@tag>, ...
- Sources: ok=X notfound=Y ratelimited=Z error=W
```

## Sandbox note

Use **WebFetch** for every GitHub API call — curl is unreliable from the sandbox, and WebFetch bypasses the block. Pass the `Authorization: Bearer $GITHUB_TOKEN` header via WebFetch when the token is present. If WebFetch is slow across the full watch list, create `scripts/prefetch-github-releases.sh` to cache responses into `.github-releases-cache/{owner}__{repo}.json` before Claude runs; the workflow executes all `scripts/prefetch-*.sh` with full env access.

## Constraints

- Never invent a tier. If `body` is empty and semver delta is unknown, default to 🔵 FYI.
- Never report the same `owner/repo@tag` twice across runs — the state file is the source of truth. If state is missing, fall back to scanning the last 2 days of `memory/logs/`.
- Don't add env vars beyond `GITHUB_TOKEN` (it's already standard in GitHub Actions).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Recommended | Auto-injected in GH Actions; pass via `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Raises rate limit 60 → 5000 req/hr. |

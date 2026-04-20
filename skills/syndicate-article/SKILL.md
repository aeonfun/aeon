---
name: syndicate-article
description: Cross-post articles to Dev.to and Farcaster with hook-driven copy and click-optimized metadata
var: ""
tags: [content, growth]
---
<!-- autoresearch: variation B — sharper output: hook-driven cast + CTR-optimized Dev.to card, with quality gate -->
> **${var}** — Filename of a specific article to syndicate (e.g. `repo-article-2026-04-16.md`). If empty, syndicates the most recently written article.

Cross-post Aeon articles to [Dev.to](https://dev.to) (developer audience) and [Farcaster](https://warpcast.com) (crypto-native audience) for organic discovery. Articles are published with a canonical URL pointing back to the GitHub Pages gallery, preserving SEO attribution.

Each channel is opt-in — set the relevant secrets and it activates. If neither is configured, the skill logs a skip and exits silently.

**Thesis**: The biggest lever in syndication is not "did we post" but "will anyone click." Generic "New post: X\n\nURL" casts and body-only Dev.to articles waste the channel's attention budget. This skill extracts a real hook from the article, adds a cover image and description for Dev.to, and refuses to post if no hook exists.

## Prerequisites

- `DEVTO_API_KEY` — Dev.to API key. Generate at https://dev.to/settings/extensions (scroll to "DEV Community API Keys").
- `NEYNAR_API_KEY` + `NEYNAR_SIGNER_UUID` — Neynar credentials for Farcaster posting. Get an API key at [neynar.com](https://neynar.com) and create a managed signer to obtain the signer UUID.

If none of `DEVTO_API_KEY` or `NEYNAR_SIGNER_UUID` are set, the skill logs a skip and exits silently — no error, no notification.

## Steps

### 1. Channel check

```bash
if [ -z "$DEVTO_API_KEY" ] && [ -z "$NEYNAR_SIGNER_UUID" ]; then
  echo "SYNDICATE_SKIP: no syndication channels configured"
  exit 0
fi
```
Log `SYNDICATE_SKIP: no syndication channels configured` to `memory/logs/${today}.md` and stop. Do NOT send any notification.

### 2. Select the article

- If `${var}` is set, use `articles/${var}`.
- Otherwise, most recently modified `.md` in `articles/` (exclude `feed.xml`, `.gitkeep`):
  ```bash
  ls -t articles/*.md 2>/dev/null | grep -v -E '(feed\.xml|\.gitkeep)$' | head -1
  ```
- If no articles exist, log `SYNDICATE_SKIP: no articles found` and stop.

### 3. Dedup check

Search the last 7 days of `memory/logs/` for:
- `SYNDICATED:` lines containing this filename → Dev.to already posted
- `FARCAST:` lines containing this filename → Farcaster already queued/posted

Track per-channel. If both already posted, log `SYNDICATE_SKIP: already syndicated {filename} to all channels` and stop. Otherwise proceed with only the missing channels.

### 4. Parse the article

- **Title**: first `# Heading`. If Jekyll frontmatter `title:` exists, use that.
- **Body (raw)**: everything after the first heading (or after frontmatter).
- **Date**: regex `([0-9]{4}-[0-9]{2}-[0-9]{2})` on filename.
- **Slug**: filename prefix before the date, trailing hyphens stripped.
- **Cover image** (`cover_url`): if Jekyll frontmatter has `image:` or `cover:`, use that; otherwise first `![alt](url)` in the body where `url` starts with `http`. If none found, leave empty.
- **Description** (`meta_description`): first paragraph of the body after the title — stripped of markdown, trimmed to 140 chars, ending on a word boundary. Used for Dev.to `description` and Farcaster hook fallback.

### 5. Clean the body for syndication

Produce `body_clean` from the raw body:

1. Remove any Jekyll liquid tags (`{% ... %}`, `{{ ... }}`) — they render as literal text on Dev.to.
2. Rewrite relative links/images: any `](/foo)` or `](foo.md)` → absolute `https://aaronjmars.github.io/aeon/foo` (strip `.md` where present). Preserve anchor fragments.
3. Strip the first `# Heading` line (Dev.to shows the title separately — double-heading looks amateur).
4. Trim leading/trailing whitespace.

Keep the pre-cleaned `body` around as a source for step 6's hook extraction.

### 6. Extract the Farcaster hook (quality gate)

Farcaster's feed rewards specificity. "New post: Title\nURL" produces near-zero engagement. Extract a real hook from the article:

**Hook candidates** (try in order, stop at first that passes):

1. **Explicit TL;DR** — if the article has a `## TL;DR`, `## Summary`, or `**TL;DR:**` block, use its first sentence.
2. **First claim paragraph** — the first paragraph of the body that is NOT:
   - A question title (ends with `?` and <60 chars)
   - Boilerplate ("In this article...", "Today we'll...", "This post covers...")
   - A frontmatter echo (repeats the title)
   - A code block, table, list, or image
   - Shorter than 40 chars or longer than 400 chars
3. **Strongest line** — scan the first 800 chars of the body for the most specific sentence: contains a number, a proper noun, OR a concrete claim verb ("shipped", "found", "broke", "dropped", "crossed", "beat"). Use that line.

Trim the chosen hook to 240 chars, ending on a word boundary. This leaves ~60 chars for the URL within Farcaster's 320-char limit.

**Quality gate**: If none of the three strategies produce a hook ≥40 chars, set `hook_found=false`. Skip the Farcaster step entirely and log `FARCAST_SKIP: no hook extractable from {filename}`. Do not fall back to "New post: X" — a weak cast is worse than no cast (burns attention, trains followers to scroll past).

### 7. Build the canonical URL

```
https://aaronjmars.github.io/aeon/articles/YYYY/MM/DD/<slug>/
```
Where `<slug>` matches `update-gallery`'s Jekyll post filename convention: title lowercased, spaces → hyphens, non-alphanumerics stripped, truncated to 50 chars.

### 8. Dev.to post (if enabled + not already syndicated)

a. **Derive tags** (max 4, Dev.to hard limit) from the filename slug:
   - `repo-article`, `article` → `ai, github, automation, agents`
   - `token-report`, `token-alert`, `defi-overview`, `defi-monitor` → `crypto, defi, blockchain, trading`
   - `changelog`, `push-recap`, `weekly-shiplog` → `opensource, devops, changelog, github`
   - `digest`, `rss-digest`, `hacker-news` → `news, tech, ai, digest`
   - `deep-research`, `research-brief`, `paper-pick` → `research, ai, machinelearning, papers`
   - `technical-explainer` → `tutorial, ai, explainer, programming`
   - Everything else → `ai, automation, agents, programming`

b. **Write the payload** to `.pending-devto/<slug>-<date>.json` (always use the post-process path; WebFetch cannot reliably pass `api-key` headers from the sandbox):

   ```bash
   mkdir -p .pending-devto/
   ```

   Payload:
   ```json
   {
     "article": {
       "title": "<extracted title>",
       "body_markdown": "<body_clean>",
       "published": true,
       "tags": ["tag1", "tag2", "tag3", "tag4"],
       "canonical_url": "<canonical_url>",
       "description": "<meta_description>",
       "main_image": "<cover_url or empty>",
       "series": "Aeon"
     }
   }
   ```

   Omit `main_image` from the JSON entirely if `cover_url` is empty (Dev.to rejects empty-string URLs). Omit `description` if <20 chars (better to let Dev.to auto-excerpt than feed it garbage).

c. `scripts/postprocess-devto.sh` POSTs to `https://dev.to/api/articles` and records the URL on success.

d. Record in `memory/logs/${today}.md`:
   ```
   SYNDICATED: {filename} → {canonical_url} (queued for Dev.to, see postprocess log for dev.to URL)
   ```
   (The Dev.to URL is only known after the postprocess run — the log line matches filename for dedup; a future reconciliation skill or manual check picks up the live URL.)

### 9. Farcaster cast (if enabled + hook_found + not already syndicated)

a. **Build the cast text** (320-byte Farcaster limit):
   ```
   <hook>

   <canonical_url>
   ```
   No "New post:" prefix, no emoji, no hashtags — the hook IS the value. Verify total byte length ≤ 310 (leave 10 bytes buffer for embed unfurl metadata). If over, trim the hook further on a word boundary.

b. **Write the payload** to `.pending-farcaster/<slug>-<date>.json` — do NOT include `NEYNAR_SIGNER_UUID`:
   ```json
   {
     "text": "<cast text>",
     "embeds": [{"url": "<canonical_url>"}]
   }
   ```
   Use `mkdir -p .pending-farcaster/` first.

c. `scripts/postprocess-farcaster.sh` reads each payload, injects `NEYNAR_SIGNER_UUID` from env, POSTs to `https://api.neynar.com/v2/farcaster/cast` with `x-api-key: $NEYNAR_API_KEY`, removes on success.

d. Record in `memory/logs/${today}.md`:
   ```
   FARCAST: {filename} → queued (hook: "{first 60 chars of hook}...")
   ```

### 10. Notification

Send via `./notify` only if at least one channel was actually queued (not skipped). Match operator voice — direct, concrete, no hype.

If both Dev.to + Farcaster queued:
```
Syndicated "{title}"

Dev.to: queued with cover image and description.
Farcaster: hook ready — "{first 80 chars of hook}..."

Canonical: {canonical_url}
```

If only Dev.to (Farcaster skipped on quality gate or missing secret):
```
Syndicated "{title}" to Dev.to

Farcaster skipped ({reason: no hook extractable / not configured}).

Canonical: {canonical_url}
```

If only Farcaster (Dev.to skipped or missing secret):
```
Cast queued for "{title}"

Hook: "{first 80 chars}..."

Canonical: {canonical_url}
```

If nothing queued (both already syndicated, or neither passed gates), do NOT notify.

## Sandbox note

- **Dev.to**: Always writes to `.pending-devto/`. `scripts/postprocess-devto.sh` executes the actual API call after Claude finishes, outside the sandbox. Avoids the env-var-in-headers problem entirely.
- **Farcaster**: Writes `.pending-farcaster/<slug>-<date>.json` (no signer_uuid on disk); `scripts/postprocess-farcaster.sh` injects the signer UUID from env at post time and POSTs to Neynar.

## Why the quality gate matters

Dropping weak casts is a feature, not a bug. Each low-effort cast trains followers to scroll past the next one — the compounding cost of "new post: X" over 100 posts is worse than posting 60 with hooks and skipping 40. If the article doesn't yield an extractable hook, that's signal the article needs a stronger opener; fix the article, don't launder the cast.

## Output (summary block)

End with:
```
## Summary
- Article: {filename}
- Dev.to: queued | skipped | already-syndicated
- Farcaster: queued (hook found) | skipped (no hook) | skipped (not configured) | already-syndicated
- Canonical: {canonical_url}
- Files written: .pending-devto/*.json, .pending-farcaster/*.json (as applicable)
```

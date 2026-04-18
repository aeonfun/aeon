---
name: syndicate-article
description: Cross-post articles to Dev.to and Farcaster for wider developer and crypto-native reach
var: ""
tags: [content, growth]
---
> **${var}** — Filename of a specific article to syndicate (e.g. `repo-article-2026-04-16.md`). If empty, syndicates the most recently written article.

Cross-post Aeon articles to [Dev.to](https://dev.to) (developer audience) and [Farcaster](https://warpcast.com) (crypto-native audience) for organic discovery. Articles are published with a canonical URL pointing back to the GitHub Pages gallery, preserving SEO attribution.

Each channel is opt-in — set the relevant secrets and it activates. If neither is configured, the skill logs a skip and exits silently.

## Prerequisites

- `DEVTO_API_KEY` — Dev.to API key. Generate at https://dev.to/settings/extensions (scroll to "DEV Community API Keys").
- `NEYNAR_API_KEY` + `NEYNAR_SIGNER_UUID` — Neynar credentials for Farcaster posting. Get an API key at [neynar.com](https://neynar.com) and create a managed signer to obtain the signer UUID.

If none of `DEVTO_API_KEY` or `NEYNAR_SIGNER_UUID` are set, the skill logs a skip and exits silently — no error, no notification.

## Steps

1. **Check for at least one API key** — verify at least one syndication channel is configured:
   ```bash
   if [ -z "$DEVTO_API_KEY" ] && [ -z "$NEYNAR_SIGNER_UUID" ]; then
     echo "SYNDICATE_SKIP: no syndication channels configured"
     exit 0
   fi
   ```
   If all missing, log "SYNDICATE_SKIP: no syndication channels configured" to `memory/logs/${today}.md` and stop. Do NOT send any notification.

2. **Select the article to syndicate:**
   - If `${var}` is set, use `articles/${var}` directly.
   - Otherwise, find the most recently modified `.md` file in `articles/` (excluding `feed.xml` and `.gitkeep`):
     ```bash
     ls -t articles/*.md 2>/dev/null | head -1
     ```
   - If no articles exist, log "SYNDICATE_SKIP: no articles found" and stop.

3. **Check for duplicates** — before posting, check if this article was already syndicated on each channel:
   - Search the last 7 days of `memory/logs/` for `SYNDICATED:` (Dev.to) and `FARCAST:` (Farcaster) entries containing this filename.
   - Track per-channel: if Dev.to already posted, skip Dev.to step but still attempt Farcaster (and vice versa).
   - If both already posted, log "SYNDICATE_SKIP: already syndicated {filename} to all channels" and stop.

4. **Parse the article:**
   - **Title**: Extract from the first `# Heading` line. If the article has Jekyll frontmatter with a `title:` field, use that instead.
   - **Body**: Everything after the first heading (or after frontmatter if present). Clean up any Jekyll-specific liquid tags.
   - **Date**: Extract `YYYY-MM-DD` from the filename using regex `([0-9]{4}-[0-9]{2}-[0-9]{2})`.
   - **Slug**: Everything before the date in the filename, with trailing hyphens removed.

5. **Build the canonical URL** pointing to the GitHub Pages post:
   ```
   https://aaronjmars.github.io/aeon/articles/YYYY/MM/DD/<slug>/
   ```
   Where `<slug>` is derived the same way `update-gallery` builds Jekyll post filenames: title lowercased, spaces replaced with hyphens, special characters removed, truncated to 50 chars.

6. **If `DEVTO_API_KEY` is set and Dev.to not yet syndicated, post to Dev.to.**

   a. Determine tags from the filename slug (max 4 tags for Dev.to):
      - `repo-article`, `article` → `ai, github, automation, agents`
      - `token-report`, `token-alert`, `defi-overview`, `defi-monitor` → `crypto, defi, blockchain, trading`
      - `changelog`, `push-recap`, `weekly-shiplog` → `opensource, devops, changelog, github`
      - `digest`, `rss-digest`, `hacker-news` → `news, tech, ai, digest`
      - `deep-research`, `research-brief`, `paper-pick` → `research, ai, machinelearning, papers`
      - `technical-explainer` → `tutorial, ai, explainer, programming`
      - Everything else → `ai, automation, agents, programming`

   b. Post to Dev.to using WebFetch (not curl, due to sandbox auth limitations):
      - URL: `https://dev.to/api/articles`
      - Method: POST
      - Headers: `Content-Type: application/json`, `api-key: <DEVTO_API_KEY>`
      - Body:
        ```json
        {
          "article": {
            "title": "<extracted title>",
            "body_markdown": "<article body>",
            "published": true,
            "tags": ["tag1", "tag2", "tag3", "tag4"],
            "canonical_url": "<github pages URL>",
            "series": "Aeon"
          }
        }
        ```
      - If WebFetch cannot pass custom headers, fall back to the post-process pattern: write the payload to `.pending-devto/post.json` and let `scripts/postprocess-devto.sh` execute the API call after Claude finishes.

   c. Handle errors:
      - 422: log "SYNDICATE_SKIP: article already exists on Dev.to" and continue to Farcaster step.
      - 401: log "SYNDICATE_ERROR: DEVTO_API_KEY is invalid" and continue to Farcaster step.
      - Other: log status code and body, continue.

   d. On success, record in `memory/logs/${today}.md`:
      ```
      SYNDICATED: {filename} → {devto_url}
      ```

7. **If `NEYNAR_SIGNER_UUID` is set and Farcaster not yet syndicated, queue a Farcaster cast.**

   a. Build the cast text (keep under 300 bytes to leave room for URL unfurl):
      ```
      New post: <title truncated to 200 chars>

      <canonical_url>
      ```

   b. Write the payload to `.pending-farcaster/<slug>-<date>.json` — do NOT include `NEYNAR_SIGNER_UUID`; the postprocess script injects it from env at post time:
      ```json
      {
        "text": "<cast text>",
        "embeds": [{"url": "<canonical_url>"}]
      }
      ```
      Use `mkdir -p .pending-farcaster/` first. The filename pattern `<slug>-<date>.json` prevents collisions across runs.

   c. The cast is posted after Claude finishes by `scripts/postprocess-farcaster.sh` — it reads each JSON payload, POSTs to `https://api.neynar.com/v2/farcaster/cast` with `x-api-key: $NEYNAR_API_KEY`, and removes the payload on success. No further action needed from this skill.

   d. Record in `memory/logs/${today}.md` (the cast URL is only known post-run, so log the queued intent):
      ```
      FARCAST: {filename} → queued (canonical: {canonical_url})
      ```

8. **Send notification** via `./notify` summarising what shipped.

   If Dev.to published:
   ```
   Article syndicated

   "{article title}" is now live on Dev.to (1M+ developers) and queued for Farcaster (crypto-native reach).

   Dev.to: {devto_url}
   Original: {canonical_url}
   ```

   If only Farcaster queued (Dev.to skipped or failed):
   ```
   Article syndicated to Farcaster

   "{article title}" is queued for Farcaster — a cast will publish when the post-process hook runs.

   Original: {canonical_url}
   ```

   If nothing published, do NOT send a notification.

## Sandbox note

- **Dev.to**: `DEVTO_API_KEY` goes in request headers. Since the sandbox blocks env var expansion in curl headers, use **WebFetch** for the API call. If WebFetch cannot pass custom headers, fall back to writing `.pending-devto/post.json` and letting `scripts/postprocess-devto.sh` execute the call after Claude finishes.
- **Farcaster**: Always uses the post-process pattern. The skill writes `.pending-farcaster/<slug>-<date>.json` during its run; `scripts/postprocess-farcaster.sh` reads the payload outside the sandbox, injects `NEYNAR_SIGNER_UUID` from env, and POSTs to Neynar. This means the signer UUID never touches any on-disk file.

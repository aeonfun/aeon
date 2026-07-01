---
name: syndicate-article
category: social
description: Distribute articles across the GitHub Pages gallery (Jekyll sync + PR), Dev.to, and Farcaster — per-channel selectable, with hash-based gallery dedup and hook-driven, CTR-optimized syndication
var: ""
tags: [content, growth]
mode: write
commits: true
permissions: [contents:write]
requires: [DEVTO_API_KEY?, NEYNAR_API_KEY?, NEYNAR_SIGNER_UUID?]
---
<!-- autoresearch: merged distribution hub — folds `update-gallery` (Jekyll gallery sync, variation B: hash dedup + exit taxonomy + noise-gated notify) into `syndicate-article` (variation B: hook-driven cast + CTR-optimized Dev.to card + quality gate) behind a `channels:` selector. No capability lost. -->

> **${var}** — Comma-separated distribution selector. **Empty = all configured channels.** Tokens: channel names (`gallery`, `devto`, `farcaster`) select channels; a `file=<name>` token (or a bare `*.md` filename, for backward compatibility) scopes the run to a single article. Examples below.

Distribute Aeon articles across three channels from one skill:

- **`gallery`** — publish new/changed articles from `articles/` to the Jekyll GitHub Pages gallery under `docs/_posts/`, with hash-based dedup, a change-detection exit taxonomy, and a branch + PR. This is the canonical home; syndication links back to it.
- **`devto`** — cross-post to [Dev.to](https://dev.to) (developer audience) with a canonical URL, cover image, description, and CTR-optimized tags.
- **`farcaster`** — cast to [Farcaster](https://warpcast.com) (crypto-native audience) with a real extracted hook, refusing to post if no hook exists.

Syndication (`devto`/`farcaster`) publishes with a canonical URL pointing back to the gallery, preserving SEO attribution. Each syndication channel is opt-in — set the relevant secrets and it activates. The `gallery` channel needs no secret (local git + `gh`).

## Channels & selector grammar

`${var}` is a comma-separated list of tokens. Parse it into a **channel set** plus an optional **file scope**:

- Channel tokens: `gallery`, `devto`, `farcaster`.
- File-scope token: `file=<filename>` (e.g. `file=repo-article-2026-04-16.md`). A bare token ending in `.md` is also treated as a file scope (backward compatibility with the pre-merge skills, which both took a bare filename as `var`).
- **Empty `var` ⇒ all channels** (`gallery`, `devto`, `farcaster`), each subject to its secret gate.
- Unknown tokens: log a one-line warning and ignore.

**File-scope semantics differ per branch** (each keeps its own default when no `file=` is given):
- `gallery` — empty scope = sync **every** file in `articles/`; scoped = that one file only.
- `devto`/`farcaster` — empty scope = the **most recently written** article; scoped = that one file only.

Examples:
- `""` → gallery syncs all articles; syndicate the most-recent article to every configured channel.
- `gallery` → gallery sync only (all articles); no syndication.
- `devto,farcaster` → syndicate the most-recent article only; skip gallery.
- `gallery,file=repo-article-2026-04-16.md` → sync just that one article to the gallery.
- `devto,file=defi-overview-2026-04-16.md` → syndicate just that file to Dev.to.

When both `gallery` and a syndication channel are selected, **run `gallery` first** — it publishes the canonical post the syndication links point to.

## Prerequisites

- `gallery` — no secret. Uses local git + `gh` (standard `GITHUB_TOKEN`).
- `DEVTO_API_KEY` — Dev.to API key. Generate at https://dev.to/settings/extensions ("DEV Community API Keys"). Enables `devto`.
- `NEYNAR_API_KEY` + `NEYNAR_SIGNER_UUID` — Neynar credentials for Farcaster. Get an API key at [neynar.com](https://neynar.com) and create a managed signer for the signer UUID. Enables `farcaster`.

## Preamble (shared — run first, every invocation)

1. Read `memory/MEMORY.md` for recent-article context and scan the last ~3 days of `memory/logs/` so you don't re-report the same signal.
2. Set `today="$(date -u +%Y-%m-%d)"`.
3. **Parse `${var}`** into `requested` (channel set) and `file_scope` (single filename or empty), per the grammar above. Empty `var` ⇒ `requested = {gallery, devto, farcaster}`.
4. **Resolve which channels can actually run:**
   ```bash
   run_gallery=$(  [[ " ${requested} " == *" gallery "*   ]] && echo 1 || echo 0 )
   run_devto=$(    [[ " ${requested} " == *" devto "*     ]] && [ -n "$DEVTO_API_KEY" ]        && echo 1 || echo 0 )
   run_farcaster=$([[ " ${requested} " == *" farcaster "* ]] && [ -n "$NEYNAR_SIGNER_UUID" ]   && echo 1 || echo 0 )
   ```
   - If `devto`/`farcaster` was requested but its secret is missing, note `SKIP: {channel} requested but not configured` for the log.
   - If **no** requested channel can run:
     ```bash
     echo "SYNDICATE_SKIP: no runnable channels for selector '${var:-<all>}'"
     ```
     Log it to `memory/logs/${today}.md` and stop. **Do NOT notify.**
5. Dispatch: if `run_gallery`, execute **Channel: gallery** first. Then, if `run_devto` or `run_farcaster`, execute **Syndication setup** once, followed by the enabled syndication channels. Finally run **Notification** and **Log** once for the whole run.

---

## Channel: gallery

Publish article outputs from `articles/` to the Jekyll gallery at `docs/_posts/` with hash-based dedup, a clear exit taxonomy, and notifications gated on real changes. Runs only when `run_gallery=1`.

### G1. Load gallery state

Load prior state from `memory/state/update-gallery-state.json` if it exists (map of `source_file` → `{sha256, post_path, title, date, category, excerpt, processed_at}`). If missing or malformed, treat every article as new (recoverable bootstrap).

### G2. Sync site data

Refresh `docs/_data/`:
```bash
bash scripts/sync-site-data.sh
```
Capture whether this mutated any file under `docs/_data/` (compare `git status docs/_data/` before and after).

### G3. Enumerate candidate articles

```bash
ls articles/*.md 2>/dev/null | grep -v '/feed.xml$' | grep -v '\.gitkeep$' | sort
```
If `file_scope` is set, restrict to that single filename; abort with `UPDATE_GALLERY_ERROR: var points to missing file` if it doesn't exist.

Initialise counters: `added=0 updated=0 skipped_unchanged=0 skipped_invalid=0 orphaned=0`.

### G4. Per-article pipeline

For each article:

**a) Gate (skip on):**
- Size > 500 KB → `skipped_invalid++`, log reason.
- Binary content (non-UTF8, or first 1024 bytes contain `\x00`) → `skipped_invalid++`.
- Empty body after stripping frontmatter → `skipped_invalid++`.

**b) Compute body SHA-256**: hash the entire file. Compare against `state[source_file].sha256`:
- Match → `skipped_unchanged++`, continue to next article. **Do not rewrite the post.**
- Miss (new or changed) → proceed.

**c) Parse date** (priority order):
1. Filename regex `([0-9]{4}-[0-9]{2}-[0-9]{2})`.
2. Jekyll frontmatter `date:` field if article starts with `---`.
3. `git log -1 --format="%as" -- articles/<filename>` fallback.
4. Last resort: today's UTC date; log the fallback use.

**d) Parse slug**: everything in filename before the date pattern, trailing hyphens stripped. If no date in filename, slug = basename without `.md`.

**e) Parse title**: from frontmatter `title:` if present, else first `# ` heading in body, else title-cased slug (`repo-actions` → `Repo Actions`).

**f) Parse excerpt**: first non-empty, non-heading, non-code-block, non-bullet, non-quote paragraph after the title/frontmatter. Strip markdown emphasis/links to plain text. Truncate at 240 chars on word boundary. Excerpt is used in Jekyll frontmatter so `articles.md`'s `post.excerpt | strip_html | truncate: 130` renders content instead of the title fallback.

**g) Category** (expanded map — check slug prefix, longest match wins):

| Category | Slug prefixes |
|---|---|
| `article` | `article`, `research-brief`, `repo-article`, `technical-explainer`, `deep-research`, `project-lens`, `paper-pick`, `idea-capture` |
| `changelog` | `changelog`, `push-recap`, `code-health`, `repo-actions`, `repo-pulse` |
| `crypto` | `token-movers`, `token-pick`, `defi-overview`, `treasury-info`, `onchain-monitor`, `monitor-polymarket`, `monitor-kalshi`, `market-context`, `narrative-tracker`, `unlock-monitor` |
| `digest` | `digest`, `rss-digest`, `hacker-news`, `reddit-digest`, `telegram-digest`, `farcaster-digest`, `vibecoding-digest`, `agent-buzz`, `list-digest`, `tweet-roundup`, `channel-recap` |
| `security` | `security-digest`, `vuln-scanner`, `workflow-audit`, `skill-scan` |
| `repo` | `repo-scanner`, `vercel-projects`, `github-monitor`, `github-issues`, `github-trending`, `github-releases`, `star-milestone`, `external-feature` |
| `social` | `write-tweet`, `reply-maker`, `remix-tweets`, `refresh-x`, `fetch-tweets`, `syndicate-article` |
| `governance` | `deal-flow`, `reg-monitor`, `paper-digest` |
| `meta` | `skill-leaderboard`, `autoresearch`, `heartbeat` |

Default for unmatched slug: `article`.

**h) Compute stable post filename**:
```
docs/_posts/<date>-<slug>-<hash6>.md
```
where `hash6` = first 6 hex chars of `sha1(source_file)` (i.e. the short hash suffix `-{sha1[:6]}`). Using the source filename (not the title or body) makes the post filename stable across title edits and body rewrites — no duplicate posts from the same source file. Slug is truncated to 40 chars after ASCII-only lowercase and non-alphanum → hyphen; the 6-char hash suffix ensures long titles that collide after truncation still hash apart (16M-slot namespace). Previously-written posts with a 4-char hash remain valid — the skill treats any `<date>-<slug>-<hex>.md` matching the same `source_file` frontmatter as the canonical post for that source and updates in place rather than creating a duplicate.

**i) Build YAML-safe frontmatter**. Escape for Jekyll/kramdown:
- Title: wrap in double quotes; escape `\` → `\\`, `"` → `\"`; replace control chars with space; if title contains `${` or `{%`, escape with `{% raw %}…{% endraw %}` around the value instead of quoting (prevents Liquid injection from upstream article titles).
- Categories: YAML list form `[<category>]`.
- Source_file / date / tags: quoted strings.

Write:
```yaml
---
title: "<escaped title>"
date: <YYYY-MM-DD>
categories: [<category>]
source_file: "<original-filename>"
excerpt: "<escaped excerpt>"
---
<body — everything after the source's frontmatter if present, else full content>
```

If the source already has Jekyll frontmatter, merge: preserve source fields but overwrite `source_file`, `date`, and `categories` (our parse wins, since these are canonical); set `excerpt` only if source didn't define it.

**j) Classify write**:
- Post file doesn't exist → `added++`.
- Post file exists, content differs → `updated++`.
- Post file exists, content identical → `skipped_unchanged++` (don't touch mtime).

Write the file only when added or updated.

**k) Update state**: record `state[source_file] = {sha256, post_path, title, date, category, excerpt, processed_at: <UTC ISO8601>}`.

### G5. Orphan detection

For every entry in `state` whose `source_file` no longer exists in `articles/`:
- Append one line to `memory/topics/gallery-orphans.md` (create file with `# Orphaned articles` header if absent): `- YYYY-MM-DD: <source_file> → <post_path> (last seen <processed_at>)`.
- Increment `orphaned++`. **Do not delete the Jekyll post.** Orphaning is a record, not a cleanup.

> Note: when `file_scope` is set (single-article run), skip orphan detection — you can't infer removals from a scoped enumeration.

### G6. Persist state

Write `memory/state/update-gallery-state.json` (create `memory/state/` if absent). Only entries for articles still present plus newly recorded ones.

### G7. Classify gallery run

Compute `gallery_mode`:
- `UPDATE_GALLERY_OK` — `added > 0 || updated > 0`.
- `UPDATE_GALLERY_DATA_ONLY` — posts unchanged but `docs/_data/` changed.
- `UPDATE_GALLERY_NO_CHANGE` — posts unchanged and `docs/_data/` unchanged.
- `UPDATE_GALLERY_ERROR` — any article hit an invalid-write condition (post path collision with a different `source_file` hash, YAML escape failed, file-system error). Surface which article failed in the notification body.

### G8. Branch + commit

If `gallery_mode` is `UPDATE_GALLERY_NO_CHANGE`: skip git entirely, proceed to Notification.

Otherwise:
```bash
TS=$(date -u +%Y-%m-%d-%H%M%S)
BRANCH="chore/gallery-sync-${TS}"
git checkout -b "$BRANCH"
git add docs/_posts/ docs/_data/ memory/state/update-gallery-state.json memory/topics/gallery-orphans.md 2>/dev/null || true
git diff --cached --quiet && { git checkout - 2>/dev/null; git branch -D "$BRANCH" 2>/dev/null; exit 0; }
git commit -m "chore(gallery): +${added} new · ±${updated} updated · ${skipped_unchanged} unchanged (${today})"
git push -u origin "$BRANCH"
```

The timestamped branch avoids collision when the skill runs twice on the same day (e.g. retry after a transient failure).

### G9. Open PR

Title: `chore(gallery): sync ${today} — +${added} / ±${updated}` (drop the last segment when it's zero).

Body:

```markdown
## Mode
`UPDATE_GALLERY_OK` | `UPDATE_GALLERY_DATA_ONLY`

## Changes
- **Added:** N posts
- **Updated:** N posts
- **Unchanged:** N posts
- **Skipped (invalid):** N
- **Orphaned (logged, not deleted):** N
- **Site data:** changed | unchanged

## Added posts
| Date | Category | Title | Source file |
|---|---|---|---|
| 2026-04-11 | security | Workflow Security Audit — 2026-04-11 | workflow-audit-2026-04-11.md |

## Updated posts
(same columns)

## Skipped (invalid)
- `<filename>` — reason

## Preview
Once merged: https://<pages-url>/articles/
```

---

## Syndication setup (shared — `devto` + `farcaster`)

Runs when `run_devto=1` or `run_farcaster=1`. Compute this once, then dispatch to the enabled channels.

### S1. Select the article

- If `file_scope` is set, use `articles/${file_scope}`.
- Otherwise, the most recently modified `.md` in `articles/` (exclude `feed.xml`, `.gitkeep`):
  ```bash
  ls -t articles/*.md 2>/dev/null | grep -v -E '(feed\.xml|\.gitkeep)$' | head -1
  ```
- If no articles exist, log `SYNDICATE_SKIP: no articles found`, skip both syndication channels.

### S2. Dedup check

Search the last 7 days of `memory/logs/` for:
- `SYNDICATED:` lines containing this filename → Dev.to already posted.
- `FARCAST:` lines containing this filename → Farcaster already queued/posted.

Track per-channel. If a channel already posted this filename, skip it. If both already posted, log `SYNDICATE_SKIP: already syndicated {filename} to all channels` and skip syndication. (Gallery dedup is independent — it uses the sha256 state file, not these markers.)

### S3. Parse the article

- **Title**: first `# Heading`. If Jekyll frontmatter `title:` exists, use that.
- **Body (raw)**: everything after the first heading (or after frontmatter).
- **Date**: regex `([0-9]{4}-[0-9]{2}-[0-9]{2})` on filename.
- **Slug**: filename prefix before the date, trailing hyphens stripped.
- **Cover image** (`cover_url`): if Jekyll frontmatter has `image:` or `cover:`, use that; otherwise first `![alt](url)` in the body where `url` starts with `http`. If none found, leave empty.
- **Description** (`meta_description`): first paragraph of the body after the title — stripped of markdown, trimmed to 140 chars, ending on a word boundary. Used for Dev.to `description` and Farcaster hook fallback.

### S4. Clean the body for syndication

Produce `body_clean` from the raw body:

1. Remove any Jekyll liquid tags (`{% ... %}`, `{{ ... }}`) — they render as literal text on Dev.to.
2. Rewrite relative links/images: any `](/foo)` or `](foo.md)` → absolute `https://aaronjmars.github.io/aeon/foo` (strip `.md` where present). Preserve anchor fragments.
3. Strip the first `# Heading` line (Dev.to shows the title separately — double-heading looks amateur).
4. Trim leading/trailing whitespace.

Keep the pre-cleaned `body` around as a source for S5's hook extraction.

### S5. Extract the Farcaster hook (quality gate)

Only needed if `run_farcaster=1`. Farcaster's feed rewards specificity. "New post: Title\nURL" produces near-zero engagement. Extract a real hook from the article:

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

### S6. Build the canonical URL

```
https://aaronjmars.github.io/aeon/articles/YYYY/MM/DD/<slug>/
```
Where `<slug>` matches the gallery branch's Jekyll post filename convention (§G4d/h): title lowercased, spaces → hyphens, non-alphanumerics stripped, truncated to 50 chars. This is the same canonical home the `gallery` channel publishes to.

---

## Channel: devto

Runs when `run_devto=1` and Dev.to hasn't already syndicated this filename (per S2).

a. **Derive tags** (max 4, Dev.to hard limit) from the filename slug:
   - `repo-article`, `article` → `ai, github, automation, agents`
   - `defi-overview` → `crypto, defi, blockchain, trading`
   - `changelog`, `push-recap`, `shiplog` → `opensource, devops, changelog, github`
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

---

## Channel: farcaster

Runs when `run_farcaster=1`, `hook_found` is true, and Farcaster hasn't already syndicated this filename (per S2).

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

---

## Notification

Send via `./notify`. **Notify only on signal** — a clean/no-change run sends nothing. Match operator voice — direct, concrete, no hype. Compose ONE notification covering whatever channels actually did something this run.

### Gallery portion (gate by `gallery_mode`, only if `run_gallery=1`)
- `UPDATE_GALLERY_NO_CHANGE` → contributes nothing.
- `UPDATE_GALLERY_DATA_ONLY` → commit the data refresh but **do not notify** about it (site-data refreshes are operational noise, not reader-facing news).
- `UPDATE_GALLERY_OK` → include:
  ```
  *Gallery updated*
  +${added} new · ±${updated} updated
  Categories: <cat1> ×N, <cat2> ×N
  PR: <url>
  ```
- `UPDATE_GALLERY_ERROR` → **always** notify (ops alert):
  ```
  *Gallery sync error*
  Mode: UPDATE_GALLERY_ERROR
  Details: <short reason>
  Counters: +${added} ±${updated} skip_invalid=${skipped_invalid}
  ```

### Syndication portion (only if a syndication channel actually queued)
- Both Dev.to + Farcaster queued:
  ```
  Syndicated "{title}"

  Dev.to: queued with cover image and description.
  Farcaster: hook ready — "{first 80 chars of hook}..."

  Canonical: {canonical_url}
  ```
- Only Dev.to (Farcaster skipped on quality gate or missing secret):
  ```
  Syndicated "{title}" to Dev.to

  Farcaster skipped ({reason: no hook extractable / not configured}).

  Canonical: {canonical_url}
  ```
- Only Farcaster (Dev.to skipped or missing secret):
  ```
  Cast queued for "{title}"

  Hook: "{first 80 chars}..."

  Canonical: {canonical_url}
  ```
- Nothing queued (both already syndicated, or neither passed gates) → contribute nothing.

If gallery contributed a block AND syndication contributed a block, send them together (gallery block first) via `./notify -f <file>`. If only one contributed, send just that. If **neither** contributed (all no-change / gated), do NOT notify at all.

## Log

Append to `memory/logs/${today}.md` under ONE heading (the health loop parses `### <skill-name>`). The `Channels:` discriminator names which branches ran:

```markdown
### syndicate-article
- Channels: requested=<gallery,devto,farcaster|…> ran=<gallery,devto,…> file_scope=<name|all>
- Gallery: <UPDATE_GALLERY_OK|DATA_ONLY|NO_CHANGE|ERROR|not-run>
  - Added: N (list filenames)
  - Updated: N (list filenames)
  - Unchanged: N
  - Skipped invalid: N (list w/ reason)
  - Orphaned: N (list)
  - Site data changed: yes|no
  - PR: <url or "none (no-change)">
  - Source-status: articles_dir=ok|empty, state_file=loaded|bootstrapped, sync_script=ok|failed
- Devto: queued <canonical_url> | skipped (not-configured|already-syndicated|no-article) | not-run
- Farcaster: queued (hook found) | skipped (no hook) | skipped (not configured) | already-syndicated | not-run
```

The `SYNDICATED:` and `FARCAST:` marker lines written in §Channel steps live in the same log file and drive the S2 dedup — keep emitting them verbatim.

## Sandbox note

- **Gallery**: all local file reads/writes + `git`/`gh`. No outbound HTTP. No secrets beyond the standard `GITHUB_TOKEN` used by `gh pr create`. If `gh pr create` fails (permission block), log the branch name and push status in the summary so the operator can open the PR manually — don't abort the skill.
- **Dev.to**: always writes to `.pending-devto/`. `scripts/postprocess-devto.sh` executes the actual API call after Claude finishes, outside the sandbox. Avoids the env-var-in-headers problem entirely.
- **Farcaster**: writes `.pending-farcaster/<slug>-<date>.json` (no signer_uuid on disk); `scripts/postprocess-farcaster.sh` injects the signer UUID from env at post time and POSTs to Neynar. Post-process side-effects run **only on a successful run** — if the skill errors, queued casts/posts are dropped.

## Why the quality gate matters

Dropping weak casts is a feature, not a bug. Each low-effort cast trains followers to scroll past the next one — the compounding cost of "new post: X" over 100 posts is worse than posting 60 with hooks and skipping 40. If the article doesn't yield an extractable hook, that's signal the article needs a stronger opener; fix the article, don't launder the cast.

## Notes

- Jekyll post filenames must start with `YYYY-MM-DD-` and end with `.md`. The `<hash6>` suffix on the slug keeps the filename stable across title edits — critical because Jekyll URLs derive from the filename slug (`permalink: /articles/:year/:month/:day/:title/`), and renaming a post changes its URL.
- Never delete posts from `docs/_posts/`. Orphan detection only records.
- YAML titles with colons/quotes must be escaped. A title like `"Can't Stop": Why …` must render as a valid single YAML string; the escape routine in §G4i is mandatory.
- The `workflow-audit-*` articles map to the `security` category in the map above (they used to default to `article`).
- Use `./notify` for notifications (fan-out to Telegram/Discord/Slack); never call channel-specific scripts directly.
- `${var}` semantics: empty = all channels + gallery-all / syndicate-most-recent; a `file=`/bare `*.md` token scopes to one article; channel tokens narrow the channel set.

## Constraints

- **Gallery — don't downgrade**: if this branch would produce fewer posts than the pre-merge `update-gallery` would have, prefer that behaviour (never orphan a real article).
- Preserve `docs/_posts/` files not mapped to any `source_file` in state (manual posts like `2026-03-25-aeon-is-the-anti-openclaw.md` and `2026-03-28-the-agent-that-fixes-itself.md`): leave them untouched.
- Do not introduce new env vars or secrets beyond those in the frontmatter `requires:`.
- Do not change `scripts/sync-site-data.sh` — if that script's output shape needs to change, open a separate PR.

## Output (summary block)

End with:
```
## Summary
- Selector: {var or "<all>"} → channels ran: {gallery|devto|farcaster list}
- Gallery: OK (+A ±U) | DATA_ONLY | NO_CHANGE | ERROR | not-run — PR: {url or none}
- Dev.to: queued | skipped ({reason}) | already-syndicated | not-run
- Farcaster: queued (hook found) | skipped (no hook) | skipped (not configured) | already-syndicated | not-run
- Canonical (syndication): {canonical_url or n/a}
- Files written: docs/_posts/*, memory/state/update-gallery-state.json, .pending-devto/*.json, .pending-farcaster/*.json (as applicable)
```

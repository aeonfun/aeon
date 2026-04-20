---
name: Update Gallery
description: Publish new or changed articles to the GitHub Pages gallery with change detection, silent on no-op weeks
var: ""
tags: [content]
---
<!-- autoresearch: variation B — sharper output via hash-based dedup + exit taxonomy + noise-gated notify, folds A's excerpt/category and C's YAML-safe title + stable hash filename -->

> **${var}** — Optional single article filename (e.g. `article-2026-04-01.md`) to sync. Empty = sync every file in `articles/`.

Publish article outputs from `articles/` to the Jekyll gallery at `docs/_posts/` with hash-based dedup, a clear exit taxonomy, and notifications gated on real changes.

## Steps

### 1. Load context

- Read `memory/MEMORY.md` for recent-article context.
- Load prior state from `memory/state/update-gallery-state.json` if it exists (map of `source_file` → `{sha256, post_path, title, date, category, excerpt, processed_at}`). If the file is missing or malformed, treat every article as new (recoverable bootstrap).
- Set `today="$(date -u +%Y-%m-%d)"`.

### 2. Sync site data

Refresh `docs/_data/`:
```bash
bash scripts/sync-site-data.sh
```
Capture whether this mutated any file under `docs/_data/` (compare `git status docs/_data/` before and after).

### 3. Enumerate candidate articles

```bash
ls articles/*.md 2>/dev/null | grep -v '/feed.xml$' | grep -v '\.gitkeep$' | sort
```
If `${var}` is set, restrict to that single filename; abort with `UPDATE_GALLERY_ERROR: var points to missing file` if it doesn't exist.

Initialise counters: `added=0 updated=0 skipped_unchanged=0 skipped_invalid=0 orphaned=0`.

### 4. Per-article pipeline

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
| `crypto` | `token-report`, `token-alert`, `token-movers`, `token-pick`, `defi-overview`, `defi-monitor`, `treasury-info`, `on-chain-monitor`, `polymarket`, `kalshi`, `market-context`, `narrative-tracker`, `unlock-monitor` |
| `digest` | `digest`, `rss-digest`, `hacker-news`, `reddit-digest`, `telegram-digest`, `farcaster-digest`, `vibecoding-digest`, `agent-buzz`, `list-digest`, `tweet-roundup`, `channel-recap` |
| `security` | `security-digest`, `vuln-scanner`, `workflow-security-audit`, `skill-security-scan` |
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

### 5. Orphan detection

For every entry in `state` whose `source_file` no longer exists in `articles/`:
- Append one line to `memory/topics/gallery-orphans.md` (create file with `# Orphaned articles` header if absent): `- YYYY-MM-DD: <source_file> → <post_path> (last seen <processed_at>)`.
- Increment `orphaned++`. **Do not delete the Jekyll post.** Orphaning is a record, not a cleanup.

### 6. Persist state

Write `memory/state/update-gallery-state.json` (create `memory/state/` if absent). Only entries for articles still present plus newly recorded ones.

### 7. Classify run

Compute mode:
- `UPDATE_GALLERY_OK` — `added > 0 || updated > 0`.
- `UPDATE_GALLERY_DATA_ONLY` — posts unchanged but `docs/_data/` changed.
- `UPDATE_GALLERY_NO_CHANGE` — posts unchanged and `docs/_data/` unchanged.
- `UPDATE_GALLERY_ERROR` — any article hit an invalid-write condition (post path collision with a different source_file hash, YAML escape failed, file-system error). Surface which article failed in the notification body.

### 8. Branch + commit

If mode is `UPDATE_GALLERY_NO_CHANGE`: skip git entirely, go to step 10.

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

### 9. Open PR

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
| 2026-04-11 | security | Workflow Security Audit — 2026-04-11 | workflow-security-audit-2026-04-11.md |

## Updated posts
(same columns)

## Skipped (invalid)
- `<filename>` — reason

## Preview
Once merged: https://<pages-url>/articles/
```

### 10. Notify

**Gate by mode**:
- `UPDATE_GALLERY_NO_CHANGE` → do nothing, no notify.
- `UPDATE_GALLERY_DATA_ONLY` → commit the data refresh but **do not notify** (site data refreshes are operational noise, not reader-facing news).
- `UPDATE_GALLERY_OK` → notify.
- `UPDATE_GALLERY_ERROR` → always notify (ops alert).

On `OK`:
```
*Gallery updated*
+${added} new · ±${updated} updated
Categories: <cat1> ×N, <cat2> ×N
PR: <url>
```
Keep it one paragraph. Use `./notify "…"`.

On `ERROR`:
```
*Gallery sync error*
Mode: UPDATE_GALLERY_ERROR
Details: <short reason>
Counters: +${added} ±${updated} skip_invalid=${skipped_invalid}
```

### 11. Log

Append to `memory/logs/${today}.md`:

```markdown
### update-gallery
- Mode: UPDATE_GALLERY_OK | UPDATE_GALLERY_DATA_ONLY | UPDATE_GALLERY_NO_CHANGE | UPDATE_GALLERY_ERROR
- Added: N (list filenames)
- Updated: N (list filenames)
- Unchanged: N
- Skipped invalid: N (list w/ reason)
- Orphaned: N (list)
- Site data changed: yes|no
- PR: <url or "none (no-change)">
- Source-status: articles_dir=ok|empty, state_file=loaded|bootstrapped, sync_script=ok|failed
```

## Notes

- Jekyll post filenames must start with `YYYY-MM-DD-` and end with `.md`. The `<hash4>` suffix on the slug keeps the filename stable across title edits — critical because Jekyll URLs derive from the filename slug (`permalink: /articles/:year/:month/:day/:title/`), and renaming a post changes its URL.
- Never delete posts from `docs/_posts/`. Orphan detection only records.
- YAML titles with colons/quotes must be escaped. A title like `"Can't Stop": Why …` must render as a valid single YAML string; the escape routine in 4i is mandatory.
- The `workflow-security-audit-*` articles map to the `security` category in the new map (they used to default to `article`).
- Use `./notify` for notifications (fan-out to Telegram/Discord/Slack); never call channel-specific scripts directly.
- `${var}` semantics: empty = sync all; set = sync a single filename (must exist under `articles/`).

## Sandbox note

All operations are local file reads/writes + `git`/`gh`. No outbound HTTP. No secrets required beyond the standard `GITHUB_TOKEN` used by `gh pr create`. If `gh pr create` fails (permission block), log the branch name and push status in the summary so the operator can open the PR manually — don't abort the skill.

## Constraints

- Don't downgrade: if this version would produce fewer posts than the previous version would have, prefer the previous version's behaviour (never orphan a real article).
- Preserve `docs/_posts/` files that are not mapped to any `source_file` in state (manual posts like `2026-03-25-aeon-is-the-anti-openclaw.md` and `2026-03-28-the-agent-that-fixes-itself.md`): they must be left untouched.
- Do not introduce new env vars or secrets.
- Do not change `scripts/sync-site-data.sh` — if that script's output shape needs to change, open a separate PR.

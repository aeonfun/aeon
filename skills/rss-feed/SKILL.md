---
name: RSS Feed Generator
description: Generate an Atom XML feed from articles, validate it, and notify only when it actually changes
var: ""
tags: [content]
---
<!-- autoresearch: variation B — sharper output via change detection, XML validation, and what-changed notification -->

> **${var}** — Repo slug override (`owner/repo`) for feed URLs. If empty, the script auto-detects from the git remote. Pass through unchanged; do not invent a value.

Generate a valid Atom XML feed from all markdown articles in `articles/`, validate it, and notify only when the feed content actually changed. Unchanged runs are a silent no-op.

## Steps

### 1. Read context

Read `memory/MEMORY.md`.

### 2. Capture the baseline

Before regenerating, snapshot the current feed so we can tell whether anything changed:

```bash
if [[ -f articles/feed.xml ]]; then
  PREV_HASH="$(sha256sum articles/feed.xml | awk '{print $1}')"
  grep -oP '(?<=<title>)[^<]+' articles/feed.xml | tail -n +2 | sort -u > /tmp/rss-feed-prev-titles.txt
else
  PREV_HASH=""
  : > /tmp/rss-feed-prev-titles.txt
fi
```

The `tail -n +2` skips the feed-level `<title>` so only entry titles remain.

### 3. Regenerate the feed

Run the script. Pass `${var}` as the repo slug override only if it is non-empty:

```bash
if [[ -n "${var}" ]]; then
  bash scripts/generate-feed.sh "${var}"
else
  bash scripts/generate-feed.sh
fi
```

### 4. Validate the XML

Invalid XML breaks every subscriber. Fail loud if the feed is malformed:

```bash
if command -v xmllint >/dev/null 2>&1; then
  xmllint --noout articles/feed.xml || { STATUS="RSS_FEED_ERROR"; VALIDATION_ERR="xmllint failed"; }
else
  # Fallback: verify the root element and a closing tag
  head -2 articles/feed.xml | grep -q '<feed' || { STATUS="RSS_FEED_ERROR"; VALIDATION_ERR="missing <feed> root"; }
  tail -1 articles/feed.xml | grep -q '</feed>' || { STATUS="RSS_FEED_ERROR"; VALIDATION_ERR="missing </feed> close"; }
fi
```

If `STATUS=RSS_FEED_ERROR`, stop, notify with the error, log it, and exit without committing. Do **not** commit a broken feed.

### 5. Detect what changed

Compare new feed against the baseline:

```bash
NEW_HASH="$(sha256sum articles/feed.xml | awk '{print $1}')"
grep -oP '(?<=<title>)[^<]+' articles/feed.xml | tail -n +2 | sort -u > /tmp/rss-feed-new-titles.txt

ADDED="$(comm -13 /tmp/rss-feed-prev-titles.txt /tmp/rss-feed-new-titles.txt)"
REMOVED="$(comm -23 /tmp/rss-feed-prev-titles.txt /tmp/rss-feed-new-titles.txt)"
ENTRY_COUNT="$(wc -l < /tmp/rss-feed-new-titles.txt | tr -d ' ')"
```

Classify the run:
- **RSS_FEED_NO_CHANGE** — `PREV_HASH == NEW_HASH` (byte-identical). Exit silently after logging. No commit, no notify.
- **RSS_FEED_METADATA_ONLY** — hashes differ but `ADDED` and `REMOVED` are both empty (e.g. `<updated>` timestamp drifted). Commit so the feed stays fresh, but **do not notify** — it is not a subscriber-visible change.
- **RSS_FEED_OK** — `ADDED` or `REMOVED` is non-empty. Commit and notify.

### 6. Commit (only if changed)

Skip entirely for `RSS_FEED_NO_CHANGE`. Otherwise build a descriptive commit message:

```bash
if [[ "$STATUS" == "RSS_FEED_OK" ]]; then
  MSG="chore(feed): $(echo "$ADDED" | grep -c .) added, $(echo "$REMOVED" | grep -c .) removed ($ENTRY_COUNT total)"
else
  MSG="chore(feed): metadata refresh ($ENTRY_COUNT entries)"
fi

git add articles/feed.xml
git diff --cached --quiet || git commit -m "$MSG"
git push || true
```

If the push fails because the runner can't push directly, that's fine — the generated file remains in the workspace and a later skill/PR can carry it.

### 7. Notify (only on RSS_FEED_OK)

Silence is the feature. Do not notify on `RSS_FEED_NO_CHANGE` or `RSS_FEED_METADATA_ONLY`. On `RSS_FEED_OK`, build a concise message:

```
*RSS feed updated* — $ENTRY_COUNT entries

New:
- <first added title>
- <second added title>
[Removed: <removed titles> — only include this line if REMOVED is non-empty]

Subscribe: https://raw.githubusercontent.com/${repo}/main/articles/feed.xml
```

Keep it to one paragraph plus the bullet list. Cap at 5 added titles; if there are more, show the first 5 and append `(+N more)`. Send via `./notify "<message>"`.

On `RSS_FEED_ERROR`, notify with:

```
*RSS feed ERROR* — $VALIDATION_ERR
Feed not committed. Investigate scripts/generate-feed.sh or articles/ inputs.
```

### 8. Log

Append to `memory/logs/${today}.md`:

```
### rss-feed
- Status: RSS_FEED_OK | RSS_FEED_METADATA_ONLY | RSS_FEED_NO_CHANGE | RSS_FEED_ERROR
- Entries: $ENTRY_COUNT
- Added: <titles or "none">
- Removed: <titles or "none">
- Prev hash: <first 8 chars>, new hash: <first 8 chars>
```

Always log, even on `RSS_FEED_NO_CHANGE` — the log line is how the operator distinguishes "ran and was idle" from "never ran."

## Sandbox note

This skill is entirely local: it reads/writes files and shells out to `scripts/generate-feed.sh`. No network calls required. If `git push` is blocked by the sandbox, the commit still lands locally and the workflow's post-step commit/push path will handle it.

## Constraints

- Never commit a feed that fails validation.
- Never notify on an unchanged feed — noise destroys the signal.
- Preserve the script interface: `scripts/generate-feed.sh [repo_slug]`. Do not rewrite the generator inline.
- Keep `${var}` semantics aligned with what the script actually accepts (repo slug, not base URL).

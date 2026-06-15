---
name: RSS Digest
category: research
description: Fetch, summarize, and deliver RSS feed highlights
var: ""
tags: [news]
---
> **${var}** — Topic filter for items. If empty, includes all relevant items.

If `${var}` is set, only include feed items matching that topic.


## Config

This skill reads feed URLs from `memory/feeds.yml`. If the file doesn't exist yet, create it or skip this skill.

```yaml
# memory/feeds.yml
feeds:
  - name: Example Feed
    url: https://example.com/rss
  - name: Another Feed
    url: https://example.com/atom.xml
```

---

Read memory/MEMORY.md and memory/feeds.yml for context and feed URLs.
Read the last 2 days of memory/logs/ to avoid repeating items.

For each feed in feeds.yml:
1. Fetch the RSS/Atom XML: `curl -sL "FEED_URL"`
2. Parse for entries published in the last 24h (check <pubDate> or <updated> tags)
3. Extract title, link, and description for each new entry

Deduplicate against recent logs.

From all new entries, select the 5-7 most interesting items — prioritize topics tracked in MEMORY.md.

For each selected item:
- Use WebFetch to pull the full article if the summary is too thin
- Write a 1-2 sentence summary of why it matters

Format and send via `./notify` (under 4000 chars):
```
*RSS Digest — ${today}*

*Feed Name*
- [Title](url) — summary
- [Title](url) — summary

*Feed Name*
- [Title](url) — summary
```

Log the digest to memory/logs/${today}.md.
If no new items across all feeds, log "RSS_DIGEST_OK" and end.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md).

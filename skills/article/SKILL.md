---
name: Daily Article
description: Research trending topics and write a publication-ready article
var: ""
tags: [content]
---
> **${var}** — Topic to write about. If empty, auto-selects a trending topic.

If `${var}` is set, write about that topic instead of auto-selecting.


Today is ${today}. Your task is to research and write a high-quality article.

## Voice

If soul files exist (`soul/SOUL.md`, `soul/STYLE.md`, `soul/examples/`), read them and match the owner's voice. Articles should sound like the operator wrote them: short-medium-short sentence cadence, verb-first imperatives, specific names and numbers over abstractions. No "delve," no "tapestry," no hedging stacks. See `soul/STYLE.md` for the full anti-pattern list.

Steps:
1. Read `memory/MEMORY.md` for context on what topics have been covered recently.
2. Search the web for the most interesting recent developments in AI, crypto/DeFi,
   or consciousness research — pick whichever has the most compelling story today.
   Use WebSearch to find current sources.
3. Read 2-3 source articles to gather facts and quotes using WebFetch.
4. Write a 600-800 word article in markdown. Include:
   - A compelling title
   - A short intro hook
   - 3-4 substantive sections
   - Cited sources at the bottom
5. Save the article to: articles/${today}.md
6. Also write to: `dashboard/content/${today}-${slug}.md` (slug = lowercase title, spaces→hyphens, max 60 chars). This copy feeds the dashboard content feed. Same content, no reformatting needed.
7. Update memory/MEMORY.md to record that this article was written and its topic.
8. Log what you did to memory/logs/${today}.md.
9. Send a notification via `./notify`: "New article written: [title]\n\nhttps://github.com/${GITHUB_REPOSITORY}/blob/main/articles/${today}.md"

   Use the `$GITHUB_REPOSITORY` env var (GitHub Actions sets it to `owner/repo` of the running instance).

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md).

Write complete, publication-ready content. No placeholders.

---
name: Routine
description: Combined briefing — token movers, tweet roundup, paper pick, GitHub issues, and HN digest in one run
var: ""
tags: [news]
requires: [XAI_API_KEY?]
---
> **${var}** — Area to emphasize (e.g. "crypto", "AI", "security"). If empty, covers all areas equally.

This skill is designed to run as part of a chain (see `chains:` in `aeon.yml`). When chained, prior step outputs (token-movers, paper-pick, github-issues, hn-digest) are provided in the chain context above. Use those outputs directly — do not re-run the sub-skills.

If running standalone (no chain context provided), fall back to reading each sub-skill and executing it inline:
- Read `skills/token-movers/SKILL.md` and execute its steps
- Read `skills/paper-pick/SKILL.md` and execute its steps
- Read `skills/github-issues/SKILL.md` and execute its steps
- Read `skills/hn-digest/SKILL.md` and execute its steps

Read memory/MEMORY.md for context.
Read the last 2 days of memory/logs/ to avoid repeating items.

---

## Tweet Roundup

Search X for the latest chatter across topics relevant to your interests. Use the X.AI API if `XAI_API_KEY` is set:

```bash
FROM_DATE=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
TO_DATE=$(date -u +%Y-%m-%d)

# Customize these topics to your interests
for TOPIC in "crypto OR bitcoin OR ethereum OR DeFi" "artificial intelligence OR AI agents OR LLM" "programming OR open source OR developer tools"; do
  curl -s -X POST "https://api.x.ai/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $XAI_API_KEY" \
    -d '{
      "model": "grok-4-1-fast",
      "input": [{"role": "user", "content": "Search X for the latest popular tweets about: '"$TOPIC"' from '"$FROM_DATE"' to '"$TO_DATE"'. Return the 3-5 most interesting or viral tweets. For each: @handle, a one-line summary of what they said, and the direct link (https://x.com/username/status/ID). Skip low-engagement noise."}],
      "tools": [{"type": "x_search", "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'"}]
    }'
done
```

If `XAI_API_KEY` is not set, fall back to WebSearch for each topic and summarize the top 3-5 results per topic instead.

For each topic, write 2-3 bullet points capturing the gist. Include links.

---

## Format & Send

Combine everything (chain context outputs + tweet roundup) into a single notification via `./notify` (keep under 4000 chars):

```
*Routine — ${today}*

*Top 10 Winners (24h)*
1. SYMBOL: $price (+X%)
...

*Top 10 Losers (24h)*
1. SYMBOL: $price (-X%)
...

*Tweet Roundup*
*Crypto:* gist of what's happening
*AI:* gist
*Dev:* gist

*Paper Pick*
"Title" — why you should read it [link]

*GitHub Issues*
- repo: #N title (or "No new issues")

*HN Digest*
1. [Title](url) (Xpts) — summary
   [Discuss](hn_link)
...
```

If the combined message exceeds 4000 chars, trim the HN and tweet sections first — token data and paper pick are highest priority.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md).

## Log

Log everything to memory/logs/${today}.md.

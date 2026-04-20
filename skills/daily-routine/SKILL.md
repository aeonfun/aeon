---
name: Daily Routine
description: Priority-ranked morning briefing — ledes the single most important thing, caps each section, omits empty ones
var: ""
tags: [news]
---
<!-- autoresearch: variation B — priority-driven curation with "why now" per item, source-status footer, dedup against last 2 days -->

> **${var}** — Area to emphasize (e.g. "crypto", "AI", "security"). If set, ranks items touching that area higher and biases tweet topic selection. If empty, weights topics from MEMORY.md "Next Priorities" equally.

Read `memory/MEMORY.md` for goals, tracked items, and "Next Priorities".
Read the last 2 days of `memory/logs/` to extract already-seen token symbols, tweet URLs, paper titles/arXiv IDs, HN item IDs, GH issue URLs — use them for dedup.

This skill is designed to run as part of a chain (see `chains:` in `aeon.yml`). When chained, prior step outputs — `.outputs/token-movers.md`, `.outputs/paper-pick.md`, `.outputs/github-issues.md`, `.outputs/hacker-news-digest.md` — appear in the chain context. **Use those outputs directly — do not re-run the sub-skills.**

If running standalone and the chain outputs are absent, produce a lightweight version per source rather than re-executing the full sub-skills (see §4 Standalone fallback). Never re-execute a sub-skill inline — that wastes tokens and runtime.

---

## 1. Gather inputs

For each source, record its status as one of: `ok` (content present), `empty` (ran but nothing to report), `fail` (no output / error), `skip` (standalone fallback produced a stub).

- **token-movers**: read `.outputs/token-movers.md` if present
- **paper-pick**: read `.outputs/paper-pick.md` if present
- **github-issues**: read `.outputs/github-issues.md` if present
- **hn-digest**: read `.outputs/hacker-news-digest.md` if present
- **tweet roundup**: see §2

Treat a zero-byte or stub file (e.g. "No items today") as `empty`, not `ok`. A missing file is `fail`.

## 2. Tweet roundup (topic selection from MEMORY.md)

Pick 2-4 tweet topics in this priority order:
1. If `${var}` is set, its area is topic #1.
2. Add up to 3 more topics drawn from MEMORY.md "Next Priorities" and "About This Repo" interests. If MEMORY.md is bare, fall back to: `crypto`, `AI`, `developer tools`.

Dedup tweet URLs against the last 2 days of logs before including them.

Prefer the X.AI API if `XAI_API_KEY` is set:

```bash
FROM_DATE=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
TO_DATE=$(date -u +%Y-%m-%d)

# Replace TOPICS with your selected 2-4 topics
for TOPIC in "${TOPICS[@]}"; do
  curl -s -X POST "https://api.x.ai/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $XAI_API_KEY" \
    -d '{
      "model": "grok-4-1-fast",
      "input": [{"role": "user", "content": "Search X for tweets about: '"$TOPIC"' from '"$FROM_DATE"' to '"$TO_DATE"'. Return the 3 most interesting, high-signal tweets (min ~200 likes or ~50 retweets — skip low-engagement noise and reply chains). For each: @handle, one-line summary of the actual insight/claim (not a paraphrase), engagement counts (likes/rt/replies), and direct link. Ignore shitposts and engagement bait."}],
      "tools": [{"type": "x_search", "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'"}]
    }'
done
```

If `XAI_API_KEY` is unset or every call fails, fall back to WebSearch per topic; mark the tweet source as `skip` if the fallback also produces nothing usable.

From all collected tweets across topics, keep **at most 5 total** — the ones that best carry an insight (a claim, number, named entity, or concrete observation). Drop pure reactions and paraphrases. For each kept tweet, write one line: `@handle — what they actually said [link]`.

## 3. Rank, curate, and draft

For every candidate item (token row, tweet, paper, issue, HN story), score:

- **leverage** (1-3): does it plausibly change a decision the operator cares about? (MEMORY.md priorities + tracked items)
- **urgency** (1-3): why today — new, breaking, a deadline, an unlock, or a cliff? A paper from last week that just trended today is a 2; a CVE published this morning is a 3.

Compute `score = leverage × urgency`. Keep items with `score ≥ 4`. Within each section, sort by score (desc) and apply the caps below.

| Section | Cap | Notes |
|---|---|---|
| Winners (24h) | 5 | Collapse to 3 if any loser or repeat symbol from last 2 days |
| Losers (24h) | 5 | Same collapse rule |
| Tweet roundup | 5 total | Grouped by topic in output |
| Paper of the day | 1 | Skip if chain output is `empty` — do not invent |
| GitHub issues | 4 | Omit issues already in last-2-days logs |
| HN digest | 4 | Dedup HN item IDs against last 2 days |

**Omit empty or failed sections entirely.** Do not emit "No items today" stubs — they burn characters that the kept sections need.

**Write the lede last.** After curation, draft a ≤2-line "Today's take" that names the single most important thing across all sections and why it matters now. If nothing scored ≥ 6 (leverage 3 × urgency 2, or 2 × 3), write a one-line "quiet morning — no high-leverage signal".

**Why-now lines.** For each kept item except token rows, add one trailing line ≤12 words explaining why it earned space today. No filler ("interesting development"); a concrete hook (a name, number, or claim).

## 4. Standalone fallback (no chain outputs)

If ALL four chain outputs are missing, do NOT re-run the sub-skills. Instead, assemble a lightweight version:

- **token-movers**: one `curl`/WebFetch to CoinGecko `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&price_change_percentage=24h`. Pick top 5 gainers and top 5 losers by 24h %. Mark source `skip`.
- **paper-pick**: WebSearch `"arxiv.org" 2026-04-20 <focus area>` and take 1 paper with title + 1-line "why read".
- **github-issues**: `gh api repos/${WATCHED}/issues?state=open&sort=updated&per_page=10` for watched repos from `memory/watched-repos.md` (skip if the file is absent) — include up to 4.
- **hn-digest**: WebFetch `https://hn.algolia.com/api/v1/search?tags=front_page&numericFilters=points>100` and include top 4 matching MEMORY.md interests.
- **tweet roundup**: same as §2 above (this step is independent of the chain).

Standalone output is a `DEGRADED` build — prepend `*⚠ degraded — standalone fallback*` below the lede.

## 5. Format and send

Target: single notification via `./notify`, **≤ 4000 chars**. Build the message, measure, trim, send.

Layout (omit any section that is empty/failed):

```
*Daily Routine — ${today}*
_Today's take:_ <≤2 lines, one concrete call>

*Winners 24h*
1. SYMBOL — $price (+X%) [link]
...

*Losers 24h*
1. SYMBOL — $price (-X%) [link]
...

*Tweets*
• @handle — insight [link]
...

*Paper*
"Title" — why read in one line [link]

*GitHub*
- owner/repo#N — title — why now [link]
...

*Hacker News*
1. [Title](url) (Xpts) — why now [HN]
...

_sources: token-movers=ok|empty|fail|skip, paper-pick=..., github-issues=..., hn-digest=..., tweets=ok|skip|fail_
```

**Trim order if over 4000 chars** (drop from the bottom):
1. Tweets (drop to 3, then drop section)
2. HN (drop to 2, then drop section)
3. GitHub issues (drop to 2, then drop section)
4. Losers (drop to 3)
5. Paper
6. Winners (drop to 3)

The lede and source-status footer always stay.

## 6. Log

Append to `memory/logs/${today}.md` under `### daily-routine`:
- Section counts (e.g. `winners=5 losers=3 tweets=4 paper=1 github=2 hn=3`)
- Source statuses (same as footer)
- The lede
- Every tweet URL, paper arXiv ID / title, HN item ID, and GitHub issue URL that was included — future runs dedup against these
- `DAILY_ROUTINE_OK` if at least 2 sections shipped with content, else `DAILY_ROUTINE_DEGRADED`, else `DAILY_ROUTINE_EMPTY` if everything was empty/fail

## Sandbox note

The sandbox may block outbound `curl`. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs (X.AI), rely on pre-fetch or post-process patterns (see CLAUDE.md). If `curl` to x.ai returns a sandbox error, try WebFetch the same endpoint; if that also fails, mark `tweets=fail` and continue — never block the briefing on one source.

## Constraints

- Never invent items. If `paper-pick` output is empty or a stub, omit the Paper section.
- Never re-execute sub-skills inline — the chain already did that work or the standalone fallback handles it lightly.
- The lede must be grounded in a specific item actually included below it — no generic framing.
- Dedup applies to tweet URLs, paper arXiv IDs / titles, HN item IDs, GitHub issue URLs, and token symbols appearing 2+ days in a row.

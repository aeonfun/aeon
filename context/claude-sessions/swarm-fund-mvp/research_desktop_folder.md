---
name: Research desktop folder routing
description: Twitter/X bookmark scrapes and research reports land in ~/Desktop/agentic-swarm-fund-research/, not inside the repo
type: reference
originSessionId: ba8ee4a9-669a-4715-b954-5490318f4a8e
---
All Twitter/X bookmark scrapes and analyzer reports route to
`~/Desktop/agentic-swarm-fund-research/` — NOT the repo's `data/` or
`autoresearch/reports/` directories.

Structure:
- `~/Desktop/agentic-swarm-fund-research/bookmarks/YYYY-MM-DD.jsonl` — raw bookmark dumps
- `~/Desktop/agentic-swarm-fund-research/bookmarks/seen_ids.json` — dedupe cache
- `~/Desktop/agentic-swarm-fund-research/reports/twitter_trends_YYYY-MM-DD.md` — Haiku-tagged trend reports

Scripts: [scripts/scrape_twitter_bookmarks.py](../../scripts/scrape_twitter_bookmarks.py),
[scripts/analyze_bookmarks.py](../../scripts/analyze_bookmarks.py).

Driven by Chrome **Profile 4** (thomas@lore.xyz). The scraper points directly
at the live Chrome user-data-dir (`~/Library/Application Support/Google/Chrome`)
with `--profile-directory="Profile 4"` — not a copy. Chrome MUST be fully
quit (⌘Q) before running because Chrome locks the profile while open.
Session state (Twitter auth, etc.) persists naturally in the real profile.

Default scrape limit: 100 bookmarks. Analyzer uses Claude Haiku 4.5,
cost ~$0.01–0.10 per run, logged to `data/costs.jsonl`.

**Why:** Thomas already had an existing desktop folder of X research artifacts
(HTML exports from 2026-03-13) and wants all scraper outputs to accumulate
there rather than fragment across repo paths.

**How to apply:** Any future Twitter/X scraping, analyzing, or research-output
work for swarm-fund should default to this desktop folder unless the user
explicitly asks for a different location.

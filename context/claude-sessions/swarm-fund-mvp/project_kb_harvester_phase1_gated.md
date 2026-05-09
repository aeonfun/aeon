---
name: KB harvester — Phase 1 gated on factor-pipeline completion
description: Phase 0 shipped (package + schema + 9 stubs + ADR-075). Phase 1 (concept extraction over 3,347 papers) deferred until paper_triage / factor_extractor / deep_dive finish — they share data/papers.db.
type: project
originSessionId: 4d9c8aab-1834-4bc3-8546-d73a41bccb0b
---
KB harvester Phase 0 + Phase 2 shipped 2026-04-27. Phase 1 (concept extraction) remains gated.

**Phase 0 (in same session):** `python/research/knowledge/` package, 4 new tables in `data/papers.db` (`kb_sources`, `kb_concepts`, `kb_concept_links`, `kb_concept_quotes`), 9 hand-authored hero stubs in `kb/topics/`, Phase 4 design memo at `docs/plans/2026-04-27_kb_learn_route.md`, ADR-075 in `DECISIONS.md`.

**Phase 2 (built same session — parallel-safe, writes only to `kb_sources`):** 6 harvesters built and run, 299 rows ingested:
- `harvest_quantopian.py` → 92 Lectures Series notebooks (cache at `data/cache/quantopian/`)
- `harvest_books.py` → 11 book metadata entries (manifest in BOOKS list inside the file)
- `harvest_blogs.py` → 93 RSS posts from 6 working feeds (Lilian Weng, Karpathy, Hudson & Thames, Robot Wealth, Quantocracy, Variant Fund); 4 feeds need URL verification: Paradigm, a16z Crypto, Multicoin, Anthropic
- `harvest_jane_street.py` → 100 posts from blog.janestreet.com/feed.xml
- `harvest_hrt.py` → 3 curated entries (HRT publishes very little)
- `harvest_twitter_bookmarks.py` → wrapper only; needs founder to run `scripts.scrape_twitter_bookmarks` first (Chrome quit required)
- `scripts/run_kb_harvest.py` → orchestrator; `--include-twitter` flag adds the bookmark wrapper

**Why Phase 1 is still gated:** Founder asked to defer Phase 1 (concept extraction over papers + kb_sources) until the factor-extraction pipeline finishes. Both pipelines write to the same SQLite DB; concurrent writes double lock contention and slow both. Factor pipeline is the higher-priority strategy work and gets the DB until it drains.

**How to apply:** Before kicking off Phase 1, check that nothing from the factor side is running:
```
pgrep -fl "paper_triage|factor_extractor|tiered_extractor|deep_dive"   # expect empty
sqlite3 data/papers.db "SELECT COUNT(*) FROM papers WHERE factor_extracted = 0"   # expect 0
```
Then run the 5 Phase 1 commands in `/Users/stew/.claude/plans/i-want-to-run-glistening-quiche.md` (the "Phase 0 → Phase 1 gate" section). Default model `google/gemini-2.5-flash`, agent_id `kb-extractor`, $50/mo cap. Smoke-test on 100 papers first; spot-check the `kb_concepts` rows for definition coherence and prereq validity before running the full ~3,200 papers + 299 kb_sources rows.

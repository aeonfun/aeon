---
name: Data sink architecture — ClickHouse Cloud + becker-revenant package
description: Long-term data storage decision, package layout, sync semantics for the Polymarket trade dataset
type: project
originSessionId: 17f9b3b9-2b16-48d3-b970-60b2e5e996e9
---
**Long-term data sink = ClickHouse Cloud.** Not QuestDB Cloud.

**Why:** Columnar compression wins at 1B+ rows (10–20× vs QuestDB's 3–5×). Repeated SYMBOL columns (market_id, outcome, asset, side, trader_address) compress to dictionary references. At 1B rows: ~$150–250/mo on CH vs $300–500/mo on QuestDB, and sub-second analytical queries vs seconds-minutes. Native Parquet/S3 integration makes HF publishing trivial.

**How to apply:** 
- Keep local QuestDB for dev. 
- Add `pipeline/writers/clickhouse_writer.py` as a sibling to `questdb_writer.py`. 
- Switch via env `SINK_BACKEND=clickhouse_cloud|local_questdb|parquet_files`.
- Existing `infra/init-clickhouse.sql` already exists (uncommitted).

**Package name: `becker-revenant`**
- `becker/` = static 302M historical snapshot (frozen Parquet on S3/R2)
- `revenant/` = live indexer + backfill scraper + pluggable sinks
- Published on HF + pip. Anyone runs `revenant start` → live Polymarket data to their sink
- Zero-config local mode = Parquet files on disk

**Moat split:** Apparatus (scraper + ingester + schema) is open. Measurement (C(p,t) surface, Kelly fractions, regime conditioning, agent signals) stays private.

**Sync semantics:** `revenant sync --until now` reads max(ts) in local copy and scrapes forward from Polymarket data-api. Last data point is always "now" — the dataset is *live*, not a snapshot. This is the academic/PhD credibility differentiator over static datasets.

**Live WS ingester vs revenant sync (both needed, different jobs):**
- Live WS = microstructure (every fill, maker/taker addresses, exact book state). Low latency for C(p,t) edge. Insurance against data-api deprecation.
- revenant sync = catchup + public distribution. Uses public REST endpoints, may be aggregated/rate-limited.
- You run live WS for your own edge. Public users run sync to stay current.

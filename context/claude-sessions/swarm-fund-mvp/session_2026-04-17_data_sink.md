---
name: Session 2026-04-17 — data sink + Revenant infra shipped
description: Session archive — live PM WS ingester, ClickHouse Cloud writer, Becker v1 loader, data-api backfill scraper
type: project
originSessionId: 17f9b3b9-2b16-48d3-b970-60b2e5e996e9
---
**Tag:** `session/2026-04-17-data-sink`

**8 commits shipped** (in order):
- fa60138 — live Polymarket CLOB WS ingester (`pipeline/ingestion/polymarket_ws.py`)
- 6972581 — word-boundary classifier + sports blocklist fix
- 7b8532d — ClickHouse writer + `SINK_BACKEND` env switching
- 6f2f036 — incremental surface rebuild + PM schema columns (end_date/resolved/resolved_yes)
- 45c35d8 — gitignore swarm-lab-site/data/
- 7c97e60 — gitignore autoresearch/reports/
- 77b8130 — Becker v1 → ClickHouse bulk loader + migration runbook
- 82b6f5b — Polymarket data-api backfill scraper

**Architecture decisions made this session:**
- Long-term data sink = ClickHouse Cloud (columnar compression at 1B+ rows)
- Default cloud = AWS (credits strategy)
- Package naming = `becker-revenant` with pluggable sinks (local QuestDB / CH Cloud / Parquet)
- Data-as-commons / transforms-as-moat split: raw tape public on HF, C(p,t) / Kelly / regime stays private

**What's build-complete + shipped:**
- Live WS ingester writing to QuestDB (+ CH Cloud via env flip)
- Becker v1 transformation pipeline (DuckDB → CH JSONEachRow, 817K token lookup built, dry-run verified against 45GB)
- Data-api backfill (offset-paginated, 500 rows/27s, asset-tagged, Gamma-enriched)
- Incremental C(p,t) surface rebuild with weighted-average merge

**What's pending Thomas manual work:**
- Provision ClickHouse Cloud (us-east-1, AWS)
- Apply infra/init-clickhouse.sql
- Run Becker v1 full load (3–6h, ideally from EC2 us-east-1)
- Flip `SINK_BACKEND=both` once loaded

**Next session priorities (in recommended order):**
1. Chronos-Bolt integration into CalibrationGap (+0.1–0.2 Sharpe, independent of CH Cloud)
2. `becker-revenant` pip/HF package restructure
3. HF dataset publisher (nightly Parquet → HF Hub)

**How to resume:** future session kick-off — `"implement Chronos-Bolt as second signal in CalibrationGap per priority #3 in memory/data_sink_architecture.md"`. Memory covers the context; no re-debate needed.

# Aeon Outputs Contract

The `outputs/{skill}/{YYYY-MM-DD}.json` files are the public, machine-readable signal channel from any Aeon skill to any downstream consumer (currently swarm-fund-mvp's `python/execution/aeon_adapter.py`; eventually prysm-squads-mvp, third-party readers).

This contract is stable. Field names and types are versioned. Do not change them without coordinating with all consumers.

## File location and access

- Skill writes to `outputs/{skill}/{YYYY-MM-DD}.json` in the Aeon repo.
- The Aeon workflow's `Commit results` step auto-commits and pushes to `main`.
- Consumers fetch via `https://raw.githubusercontent.com/{owner}/{repo}/main/outputs/{skill}/{YYYY-MM-DD}.json` on whatever cadence makes sense (swarm-fund's adapter polls every 15 min).
- Consumers must handle HTTP 404 gracefully — the file does not exist until the skill runs that day.

## Schema (v1)

```json
{
  "signals": [
    {
      "market_id": "<string, required>",
      "score": <float 0.0-1.0, required>,
      "direction": "LONG" | "SHORT",
      "narrative": "<string, optional>",
      "price": <float 0.0-1.0, optional>,
      "volume": <float, optional>,
      "price_drift": <float, optional>,
      "narrative_score": <float 0.0-1.0, optional>
    }
  ]
}
```

The top level MAY be a bare array (`[entry, entry, ...]`); consumers should accept either shape. Empty array (`[]` or `{"signals": []}`) is valid and means "the skill ran and produced no signals today" — it is NOT the same as a 404.

### Per-field semantics

- **`market_id`** (required): Stable identifier the consumer can dedup on. Per skill:
  - Polymarket skills: the numeric `id` from `gamma-api.polymarket.com` (string-encoded). Fall back to `slug` if `id` unavailable.
  - On-chain skills (eth-index, etc.): the contract address or event ID.
  - Narrative-class skills with no per-market scope: a slug-cased narrative label (e.g. `"btc-dom-cope-refire"`).
  - Consumers also accept `slug` or `condition_id` as fallbacks if `market_id` is absent.

- **`score`** (required, 0-1): Confidence weight. The consumer uses this as a multiplier on its own position-sizing logic.
  - Convention: `1.0` = maximum-confidence signal worth full attention, `0.5` = noteworthy, `0.0` = noise (skip).
  - Skills SHOULD NOT emit entries below `0.1` — filter at the source instead.

- **`direction`** (optional, defaults to `"LONG"`): `"LONG"` or `"SHORT"`. Interpreted at the consumer.
  - Polymarket convention: `"LONG"` = buy YES, `"SHORT"` = buy NO.
  - Perp convention: `"LONG"` = open long, `"SHORT"` = open short.
  - Narrative convention: `"LONG"` = FRONT-RUN or RIDE the narrative, `"SHORT"` = FADE.

- **`narrative`** (optional, falls back to `title`): One-line operator-grade summary of why the signal exists. NOT a comment excerpt. NOT the market question. The *thesis*.

- **`price`** (optional, defaults to `0.5`): Observed price at signal-emission time. 0-1 for binary markets.

- **`volume`** (optional, defaults to `0`): 24h volume in USD or native units. Consumer applies its own liquidity filter.

- **`price_drift`** (optional): Signed change in price-points over the observation window. Surfaced as `recent_price_drift` in consumer metadata. Skill-specific (monitor-polymarket emits this; comments and narrative skills omit it).

- **`narrative_score`** (optional, fallback for `score`): Some skills (e.g. narrative-tracker) emit both — the consumer uses `score` first, falls back to `narrative_score`.

### Skill-specific field omissions

Not every skill emits every field. Document omissions in the skill's SKILL.md and rely on consumer fallbacks:

- **monitor-polymarket**: emits all seven fields.
- **polymarket-comments**: emits `market_id`, `score`, `direction`, `narrative`, `price`, `volume`. Does NOT emit `price_drift` (comments are a narrative-class signal, not a price-move signal).
- **narrative-tracker**: emits `market_id`, `score`, `direction`, `narrative`, `narrative_score`. Does NOT emit `price`, `volume`, or `price_drift` (narratives span multiple markets, so per-market price/volume is not meaningful).
- **lore-coins-monitor** (planned): emits `market_id` (token contract or NFT collection address), `score`, `direction`, `narrative`, `volume` (24h on-chain volume), `price` (current token or NFT floor price). Schema-compatible with the Polymarket skills.

## Versioning

The schema above is **v1**. If a breaking change is needed:
1. Emit `"schema_version": 2` at the top level of the file.
2. Update this doc with the v2 schema and a migration note.
3. Consumers fall back to v1 parsing when `schema_version` is absent or `1`.

Never silently change field names or types within v1. Add new optional fields freely; new required fields force a version bump.

## Writing pattern (recommended)

Atomic + validated. Use Python's `json.dump` to a temp file, then `mv` into place. Never write directly with `echo` — unescaped chars in the payload produce broken JSON. Always log `ADR093_WRITE_FAIL` to stderr if both jq and the fallback fail; the signal-publication path must never block the human-notify path.

```bash
mkdir -p "outputs/${SKILL}"
JSON_TMP=$(mktemp)
python3 -c "
import json, sys
payload = ${PAYLOAD_AS_PYTHON_LITERAL}
json.dump(payload, sys.stdout, indent=2)
" > "$JSON_TMP" 2>/dev/null \
  && mv "$JSON_TMP" "outputs/${SKILL}/${TODAY}.json" \
  || echo "ADR093_WRITE_FAIL: outputs/${SKILL}/${TODAY}.json write failed" >&2
```

## Consumer-side contract

Consumers MUST:
- Treat 404 as "no signal today" (not an error).
- Treat empty `signals` array as "skill ran and found nothing" (not an error).
- Dedup entries by `(skill, date, market_id)` to avoid double-emission.
- Tolerate missing optional fields via sensible defaults (see Per-field semantics).
- Not crash on extra unknown fields — skills may add new optional fields in future without bumping schema_version.

Consumers SHOULD:
- Log when a signal's `score` is below their own threshold rather than silently dropping (helps diagnose tuning).
- Track emit-to-consume latency to catch broken pipes (the original ADR-093 failure was 14 days of 404s with nobody noticing).

## History

- **2026-05-03 (ADR-093)** — Contract first specified in `swarm-fund-mvp/DECISIONS.md`. Producer side never shipped.
- **2026-05-31 (ISS-021)** — Producer side shipped on aeon (this commit). Three skills (monitor-polymarket, polymarket-comments, narrative-tracker) now emit conforming JSON.
- **2026-05-31** — This doc written to make the contract portable for prysm-squads-mvp adoption (planned: lore-coins-monitor as the bridge skill).

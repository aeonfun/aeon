---
name: Polymarket data-api pagination quirks
description: Behavior of https://data-api.polymarket.com/trades — offset pagination, ignored timestamp filters, rate limits
type: reference
originSessionId: 17f9b3b9-2b16-48d3-b970-60b2e5e996e9
---
**Endpoint:** `https://data-api.polymarket.com/trades`

**Pagination shape:**
- Offset-based via `limit` (max 500) + `offset` (0 = most recent).
- Results ordered **descending by timestamp** — higher offset = older trades.
- `offset=0` gives latest page; `offset=100` gives ~100 trades earlier in time.

**Timestamp filter params are IGNORED:**
- `minTimestamp`, `startTs`, `after` — all silently ignored by the API.
- Server returns latest trades regardless; only `limit` + `offset` change output.
- Must filter client-side: walk offset pages until `oldest_ts_in_page < target_start_ts`.

**Rate limits:**
- Public, no auth required.
- Empirically stable at 4 req/s. Respect with ~250ms sleep between requests.
- No documented quota; polite behavior avoids 429s.

**Record shape (each row):**
```
proxyWallet, side, asset (token_id), conditionId (market_id), size, price,
timestamp (unix s), title, slug, icon, eventSlug, outcome, outcomeIndex,
name, pseudonym, bio, profileImage, transactionHash
```

**Missing fields** (fetch via Gamma `/markets?condition_ids=` instead):
- `end_date`
- `resolved` / `outcome_prices`
- Full question text beyond `title`

**How to apply:** When writing a backfill or sync tool for this endpoint,
walk offset pages and stop once any page's min(timestamp) drops below the
target start. Enrich with Gamma metadata via condition_id cache to avoid
hitting Gamma for duplicate markets.

**Implementation reference:** `scripts/polymarket_backfill.py`

---

**Gamma resolution-field semantics (added 2026-04-20):**

Gamma's `resolved` / `outcomePrices` fields lag the on-chain CTF `payoutNumerators` by the UMA challenge window — ~2h for standard markets, up to 48h for contested ones. Three observable states:

| Gamma state | Interpretation | Action |
|---|---|---|
| `closed=false` | market still trading | normal flow |
| `closed=true`, `outcomePrices` populated (`["1","0"]` / `["0","1"]`) | UMA-finalized, CTF reported | safe to close positions, read YES price from `outcomePrices[0]` |
| `closed=true`, `outcomePrices` null / empty | **in UMA challenge window** — proposed but not settled | **do not close positions yet**; poll again later |

`outcomePrices` is returned as a **JSON-encoded string** (e.g. `'["1","0"]'`), not a native list — parse with `json.loads()` then index. Bug fixed in `python/execution/polymarket_adapter.py:is_market_resolved` on 2026-04-12.

**Canonical source of truth:** on-chain `CTF.payoutNumerators(conditionId, outcomeIndex)` at `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` (Polygon). Returns `1` for winning outcome, `0` for losing. Gamma is a cache over this; trust chain when they disagree.

**Sports markets (future):** resolution flows through `uma-sports-oracle`, not `uma-ctf-adapter`. Different question format (sports-specific fields), different proposer-bond rules, different Gamma field semantics. **Do not assume parity** with standard-market resolution when the sports vertical goes live (post-Mage).

**Upstream repos (reference-only until P3 hardening):**
- `github.com/Polymarket/uma-ctf-adapter` — bridge from UMA optimistic oracle to CTF `reportPayouts`
- `github.com/Polymarket/uma-sports-oracle` — sports-specialized resolution adapter

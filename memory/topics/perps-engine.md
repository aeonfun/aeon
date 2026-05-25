# Perps Engine — V1 State Map

*Last refresh: 2026-05-25 (V1 lock)*
*Supersedes: 2026-05-20 audit (Phase 1 of perps-engine review)*

> Operational state of the perps engine at V1 lock. This document describes WHAT the engine is and HOW it works. Implementation lives in `aeon.yml`, `skills/*/SKILL.md`, `scripts/*.py`, and `memory/topics/state/active-setups.json`.

---

## TL;DR

1. **Two-layer architecture.** Data layer (perps-scan + 7 surrounding skills) generates context. Decision layer (perps-brief) integrates it into ledger-aware trade calls.
2. **Stateful.** Every fired LONG/SHORT entry persists in `memory/topics/state/active-setups.json`. Open positions are evaluated daily (RIDE or CLOSE). Closed positions feed the outcome tracker.
3. **Three-section brief output.** CURRENT POSITIONS (table + per-row prose), NEW POSITIONS (per-signal cards capped 5), WATCHLIST (per-signal cards capped 5).
4. **Per-signal Discord delivery.** Each NEW POSITION and WATCHLIST card is its own Discord message wrapped in a code block. CURRENT POSITIONS is one message. MARKET SENTIMENT is one message.
5. **Auto-flip semantics.** Opposite-direction high-conviction entry on an active position triggers CLOSE-then-OPEN in the same brief, marked `CLOSE (auto-flip)`.
6. **MAE/MFE tracking.** Every open position carries running maximum-adverse and maximum-favorable excursion %, updated daily from Coinglass cache prices.
7. **SCARE outcome.** Won trades that breached invalidation midway get tagged `WIN-WITH-SCARE` — surfaces stop-honoring discipline.
8. **Outcome tracker.** Daily Python-driven analytics on closed[] entries: by-direction, by-horizon, by-confluence-pattern, by-provenance (watchlist-promoted vs direct). Cold-start safe. Filters by `V1_LOCK_DATE` env var.

---

## The Chain (live, V1)

`aeon.yml` defines `chains.morning-review`. Cron in `.github/workflows/chain-runner.yml` (`0 4 * * *`). `on_error: continue`.

| Step | Skills | Type | Notify? |
|---|---|---|---|
| 1 (parallel) | `market-context-refresh`, `aixbt-pulse`, `monitor-runners`, `token-movers`, `perps-scan`, `narrative-tracker`, `token-call`, `outcome-tracker` | Data + classification + track-record | Mixed: narrative-tracker + perps-scan post to channels; rest internal |
| 2 | `perps-brief` (consumes all 8 of Step 1 + ledger) | Decision layer | Yes → `#perps` (multiple messages) |
| 3 | `morning-macro` (consumes brief + 3 context) | Cross-sector synth | Yes → `#morning-macro` |
| 4 | `daily-ops-review` (consumes everything) | Chain health audit | Yes → `#aeon-ops` (operator-only) |

Chain runtime: ~25-30 min. Brief lands in `#perps` 04:25-04:35 UTC.

### V1 routing changes (2026-05-25 lock)

- `monitor-runners`: was signal → internal. Consumed by brief; no Discord channel post.
- `token-call`: was signal → internal. Consumed by brief; no Discord channel post.
- Rationale: too many Discord channels diluted attention; perps-brief is the consolidation point for actionable trades.

---

## Skill Catalog (V1)

| Skill | Type | Role | Outputs |
|---|---|---|---|
| `market-context-refresh` | Internal | BTC/ETH/SOL prices, breadth, F&G, DeFiLlama TVL, Polymarket | `.outputs/market-context-refresh.md` + `memory/topics/market-context.md` |
| `aixbt-pulse` | Internal | Cross-domain pulse (crypto/macro/geo/tradfi) + bridge call | `.outputs/aixbt-pulse.md` |
| `narrative-tracker` | Signal | Phase-grouped narrative map, mindshare + velocity, position calls | `.outputs/narrative-tracker.md` → #narratives |
| `perps-scan` | Signal | 7-regime classifier across top-25 perps, pattern tags, transitions | `.outputs/perps-scan.md` → #perps |
| `monitor-runners` | Internal (V1) | Top 5 24h DEX runners by chain | `.outputs/monitor-runners.md` |
| `token-movers` | Internal | CoinGecko top 250 winners/losers/trending | `.outputs/token-movers.md` |
| `token-call` | Internal (V1) | One daily token call, scored 0-10 | `.outputs/token-call.md` |
| `outcome-tracker` | Internal | V1 track-record analytics from closed ledger entries | `.outputs/outcome-tracker.md` + `memory/topics/track-record.md` |
| `perps-brief` | Signal | Position-aware decision layer — 5-pass synthesis | `.outputs/perps-brief.md` → #perps (multiple messages) |
| `morning-macro` | Signal | Cross-sector front-page read, <1500 chars | `.outputs/morning-macro.md` → #morning-macro |
| `daily-ops-review` | Signal | Chain health audit | `.outputs/daily-ops-review.md` → #aeon-ops |

---

## Ledger Schema (v4.1)

`memory/topics/state/active-setups.json`:

```
{
  "schema_version": "v4.1",
  "last_updated": "ISO 8601 UTC",
  "open":      [OpenEntry, ...],
  "watchlist": [WatchlistEntry, ...],
  "closed":    [ClosedEntry, ...]
}
```

**OpenEntry fields:**
- `id`, `asset`, `direction` (LONG/SHORT), `fired_date`, `fired_price`, `fired_btc_price`, `fired_eth_price`
- `entry_zone`, `invalidation`, `horizon` (24h/3d/7d/multi-week), `thesis` (string OR array of bullet strings)
- `confluence_fired[]`, `confluence_missing[]`, `named_risks[]`
- `mae_pct`, `mfe_pct`, `mae_date`, `mfe_date` — running MAE/MFE since fire
- `invalidation_breached` (bool) — sticky once true, drives SCARE outcome
- `watchlist_provenance` — if promoted from a watchlist entry: `{watchlist_id, days_on_watchlist, original_trigger, original_confluence_fired}`
- `evaluations[]` — per-day `{date, call, price_at_eval, note}` records

**WatchlistEntry fields:** `id`, `asset`, `direction`, `first_seen_date`, `trigger`, `invalidation`, `horizon` (optional), `thesis`, `confluence_fired[]`, `named_risks[]`

**ClosedEntry:** OpenEntry plus `closed_date`, `closed_price`, `close_reason`, `horizon_realized`, `return_pct`, `return_vs_btc_pct`, `return_vs_eth_pct`, `outcome` (WIN/LOSS/SCARE/NEUTRAL), `auto_flipped` (bool)

**Outcome semantics** (computed by `apply-ledger-ops.py`):
- WIN: `return_vs_btc_pct ≥ +2%` AND `invalidation_breached = false`
- SCARE: `return_vs_btc_pct ≥ +2%` AND `invalidation_breached = true` (won despite breaching stop)
- LOSS: `return_vs_btc_pct ≤ -2%`
- NEUTRAL: between

---

## Brief Output Format (v4.1 card layout)

Per-message Discord delivery. Each section is its own message wrapped in a code block.

### Message 1 — Title + MARKET SENTIMENT
```
Perps Brief · DD MMM

─────────  MARKET SENTIMENT  ─────────

  [Paragraph 1 — macro frame]

  [Paragraph 2 — perps-specific read]

  [Paragraph 3 — risk/regime context]

  Bias · [stance]. [rationale]
```

### Message 2 — CURRENT POSITIONS (if non-empty)
Table + per-row prose:
```
─────────  CURRENT POSITIONS (N)  ─────────

  TICKER    DIR    ENTRY        NOW          PNL      MAE / MFE       CALL
  ────────  ─────  ──────────   ──────────   ───────  ──────────────  ──────────
  ASSET     LONG   $price       $price       ±X%      −X / +X         RIDE
  ASSET     SHORT  $price       $price       ±X%      −X / +X         CLOSE  OUTCOME

  ASSET  ▸ 2-3 sentence note, plain prose, no buzzword shorthand.
```

### Messages 3-N — NEW POSITION cards (1 per signal, capped 5)
```
─────────  NEW POSITION · TICKER DIR  ─────────

  ticker      TICKER
  direction   DIR
  horizon     24h | 3d | 7d | multi-week
  entry       price level OR "market"
  stop        invalidation condition


  thesis      · [observation 1, ~120 chars]
              · [observation 2]
              · [observation 3]
              · [observation 4]


  risks       · [risk 1, ~120 chars]
              · [risk 2]
              · [risk 3]
```

### Messages N+1-M — WATCHLIST cards (1 per signal, capped 5)
Same shape, no risks block. Header includes `· day N` (days on watchlist).

---

## Confluence Criteria (enumerated)

Logged per setup in `confluence_fired[]`. Used by outcome-tracker for pattern-level performance rollups.

- `quant_regime_aligned` — perps-scan regime supports direction
- `pattern_tag_supports` — cross-signal pattern tag reinforces (STEALTH-POSITIONING long, LONG-TRAP short, etc.)
- `narrative_phase_aligned` — narrative-tracker phase aligns (Rising/Peak for long, Fading/Peak for short)
- `market_regime_aligned` — aggregate market read aligns (LEVERAGE BUILDING / TRENDING for long; CROWDED TOPPING / DELEVERAGING for short)
- `both_tag` — asset is `[BOTH]` in brief pass 1 — quant + attention agree
- `repeat_appearance` — same asset, same regime, same narrative phase for ≥2 consecutive days
- `regime_transition` — day-over-day regime transition supports thesis
- `cross_domain_bridge` — aixbt-pulse flagged a macro/geo/tradfi catalyst mapping to the asset's sector
- `enrichment_positive` — Pass 2 enrichment surfaces confirming catalyst, no disqualifying findings
- `dominance_aligned` — BTC.D / USDT.D / ETH/BTC signals align (Phase 3 — V1 doesn't populate this)

---

## Brief Process — 5 Passes

1. **Pass A** — Evaluate every current ledger position. For each entry in `ledger.open[]`, decide RIDE or CLOSE based on today's data + invalidation check.
2. **Pass B** — Decide watchlist carry-forward. For each `ledger.watchlist[]` entry: keep, promote to NEW POSITION, or drop.
3. **Pass 0** — Discovery (independent of quant). 10 candidates from narrative-tracker / aixbt-pulse / token-movers / WebSearch. Filter to Bybit-listed perps.
4. **Pass 1-2** — Combine quant + discovery, tag `[QUANT]`/`[DISCOVERY]`/`[BOTH]`. Targeted enrichment (3-5 WebSearch queries per candidate).
5. **Pass 3** — Confluence judgement + tier assignment. NEW POSITIONS (cap 5), WATCHLIST (cap 5), drop the rest.

---

## Decision Vocabulary (v4.1 locked)

| Section | Call | Meaning |
|---|---|---|
| NEW POSITIONS | `LONG` | Enter long at named entry zone. Opens a ledger entry. |
| NEW POSITIONS | `SHORT` | Enter short at named entry zone. Opens a ledger entry. |
| CURRENT POSITIONS | `RIDE` | Thesis intact; continue holding. |
| CURRENT POSITIONS | `CLOSE` | Exit now. Moves ledger entry → `closed[]`. Outcome locked. |
| WATCHLIST | (none) | Direction tag (LONG/SHORT), no call — pending a trigger. |

**Auto-flip rule.** Opposite-direction high-conviction entry on an active position triggers same-brief CLOSE + OPEN, marked `CLOSE (auto-flip)`. Watchlist-conviction opposite signal does NOT trigger flip — mentioned in the position's `watch:` field instead.

**Same-direction signal on existing position:** dropped (no pyramiding in V1).

---

## Postprocess Pipeline (perps-brief)

`scripts/postprocess-perps-brief.sh` runs after the skill completes:

1. **Render:** `scripts/render-perps-brief.py` reads `.outputs/perps-brief.data.json`, validates schema, produces `.outputs/perps-brief.md` with per-card section dividers
2. **Snapshot:** `scripts/lib/ledger.py snapshot` copies pre-apply ledger to `memory/topics/state/snapshots/active-setups.YYYY-MM-DD.json`
3. **Apply:** `scripts/apply-ledger-ops.py` applies `data.json["ledger_ops"]` to active-setups.json atomically
4. **Validate:** post-apply ledger re-validated
5. **Section-split notify:** Python splits the markdown on section dividers, writes each chunk to `.pending-notify/perps-brief-<ts>-<seq>.signal.md`, workflow's Send-pending step delivers each as its own Discord message

**SKILL_NAME guard:** the postprocess script early-exits unless `SKILL_NAME=perps-brief`. The workflow runs every postprocess in every skill workflow; without this guard, perps-brief content would leak to other channels.

---

## Outcome Tracker (V1 Phase 2)

New in V1. Runs in chain Step 1 parallel with other data skills.

**Inputs:** `memory/topics/state/active-setups.json`, `.coinglass-cache/price-*.json` (for open mark-to-market)

**Outputs:**
- `.outputs/outcome-tracker.md` — chain-consumed by perps-brief next day
- `memory/topics/track-record.md` — persistent operator-facing analysis doc

**Sections produced:**
- Headline: count, LONG/SHORT split, win rate, avg return, avg holding, horizon realization ratio
- By direction (LONG vs SHORT win rates)
- By horizon (24h / 3d / 7d / multi-week)
- By confluence pattern (best/worst, min n=3 samples)
- By provenance (watchlist-promoted vs direct entry)
- Auto-flip stats
- Open positions mark-to-market
- Auto-generated NOTES (anomaly detection: win rate < 40%, SCARE prevalence, direction skew, provenance edge)

**Filter:** `V1_LOCK_DATE` env var (YYYY-MM-DD) filters closed[] to entries since lock date. Implements the operator's partial-reset baseline.

**Cold-start:** if < 3 closed entries in window, banner shown instead of headline stats. Mark-to-market still rendered if open positions exist.

---

## V1 Lock Decisions

1. **Schema source-of-truth contract test.** `scripts/test-skill-schema-contract.py` asserts SKILL.md JSON example validates against render's schema check. Catches PR #36/#37 class of bug (validator stricter than docs) at test time.
2. **Mobile content cap.** Bullets capped at ~120 chars / 180 hard cap (down from 200/250). Discord mobile renders multi-line wraps poorly; tighter content reduces visual damage.
3. **Signal routing.** monitor-runners and token-call moved internal-only. Operator decision: consolidate Discord attention to perps-brief + morning-macro + #aeon-ops.
4. **V1 stable tag.** `perps-engine-v1-stable` pushed at lock. Full revert: `git reset --hard perps-engine-v1-stable && git push`.
5. **Partial ledger reset.** Historical ledger entries retained in active-setups.json. Outcome tracker filters to `closed_date >= V1_LOCK_DATE` so V1 analysis starts clean.

---

## Known V1 Gaps (deferred to V2)

- **Discord bot + embeds.** Mobile rendering is a fundamental code-block limitation. Bot with embeds gives proper desktop/mobile rendering. Deferred — wait for accumulated data to inform model changes first.
- **Phase 3 — dominance metrics + RISK REGIME line.** `dominance_aligned` confluence criterion exists in the enumerated set but isn't populated yet.
- **Phase 4 — options skew + per-venue funding.** Bigger data work (new Coinglass/Deribit endpoints).
- **Trigger automation.** Operator manually checks if watchlist triggers fire. Could auto-promote.
- **MARKET SENTIMENT restructure.** Still prose paragraphs; could be headline metrics + structured fields.

---

## Files of Record

- `aeon.yml` — chain definition + skill enablement
- `skills/perps-brief/SKILL.md` — decision-layer spec
- `skills/outcome-tracker/SKILL.md` — track-record spec
- `scripts/render-perps-brief.py` — brief renderer + schema validator
- `scripts/apply-ledger-ops.py` — sole writer of active-setups.json
- `scripts/render-outcome-tracker.py` — outcome tracker renderer
- `scripts/lib/ledger.py` — ledger validation + atomic write
- `scripts/lib/track_record.py` — outcome analytics module
- `scripts/postprocess-perps-brief.sh` — brief pipeline (render → snapshot → apply → validate → notify)
- `scripts/postprocess-outcome-tracker.sh` — outcome tracker invocation
- `scripts/test-perps-brief-v4-pipeline.sh` — smoke test (3 scenarios + contract test)
- `scripts/test-skill-schema-contract.py` — schema source-of-truth assertion
- `memory/topics/state/active-setups.json` — the ledger
- `memory/topics/state/snapshots/` — daily pre-apply backups
- `memory/topics/track-record.md` — persistent track-record analysis
- `memory/topics/writing-style.md` — style guide (Pattern 7 = source-shorthand)

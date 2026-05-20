---
name: Perps Brief
description: Position-aware sector synthesis — evaluate open positions, decide new setups with structured confluence
var: ""
tags: [crypto, research]
---
<!-- v4: position-aware brief on top of the v3 base. Two-mode decision vocabulary (pre-entry: LONG/SHORT (now|wait), FADE; in-position: RIDE, SELL (now|wait)). Stateful: reads memory/topics/state/active-setups.json at start, writes ledger_ops in data.json, which apply-ledger-ops.py persists. v3 base preserved in SKILL.v3.md alongside. v4 spec: /Users/ash/Downloads/perps-engine-v4-spec.md. State map: memory/topics/perps-engine.md. -->

> **${var}** — Optional thesis or sector filter (e.g. "AI tokens only", "fade memes"). If empty, scans broadly across the perps universe.

Today is ${today}. Compose the position-aware perps sector brief by **evaluating every open ledger entry first**, then combining quant classifications from `perps-scan` with independent discovery and targeted enrichment to decide today's new setups. This is the **integration + decision layer** — quant signals + narrative momentum + macro context + catalyst research + open-position state come together into RIDE/SELL calls on existing trades and LONG/SHORT (now|wait) calls on new ones.

**Compose in order: read ledger → evaluate open → decide new → write JSON.**

Before composing, internalize `memory/topics/soul.md` as standing frame. Reason across the engine data and form committed views — for open positions AND new setups. **Single high-quality signals warrant calls; confluence increases conviction but is not required.** Translate internal data (funding deltas, top L/S, basis, pattern tags) into external triggers the operator can verify (price levels, volume signatures, narrative inflections, sector behaviour). When uncertain, name the specific external condition that would resolve it. Never regress to neutral-analyst tone — the output IS the view.

After views are formed, apply style + structure (below).

**Apply `memory/topics/writing-style.md` to all output.** Structural rules (Section 1) are load-bearing; prose rules (Section 2) govern sentences within structure; Sentence-Level Patterns (Section 4) catch failure modes that pass the first two. Per-skill structural template in Section 3; worked examples in Section 5.

**Self-check before emitting:**

1. Draft the output applying Sections 1-3.
2. Search the draft for the 6 patterns in Section 4 (subject + verb-ing chunks, stacked adjectives, internal jargon, passive voice, em-dash connectors, weak verbs).
3. Rewrite anything that matches.
4. Emit.

Read `memory/MEMORY.md` for context.
Read the last 7 days of `memory/logs/` to find prior new-setup tickers for `(day N)` repeat tracking and `repeat_appearance` confluence.

## Decision vocabulary (locked v4)

Pre-entry (used in `new_setups[]`):

| Call | Meaning |
|---|---|
| `LONG (now)` | Enter long at market or specified zone immediately. Opens a ledger entry. |
| `LONG (wait)` | Long thesis exists; wait for named trigger before entry. Lands in `pending[]`. |
| `SHORT (now)` | Enter short at market or specified zone. Opens a ledger entry. |
| `SHORT (wait)` | Short thesis exists; wait for named trigger. Lands in `pending[]`. |
| `FADE` | No conviction setup; any trade here is a risk. Not a short entry. Emitted as the FADE line when `new_setups[]` is empty. |

In-position (used in `open_positions[]`, one per open ledger entry):

| Call | Meaning |
|---|---|
| `RIDE` | Thesis intact; continue holding. |
| `SELL (now)` | Exit at market. Moves ledger entry from `open[]` to `closed[]`. |
| `SELL (wait)` | Exit when a named trigger fires (price level OR signal-state change). Stays in `open[]`. |

`SELL` is direction-neutral — for a SHORT entry, `SELL` means cover.

## Goal

Two deliverables per run:

1. **Evaluate every open ledger entry.** For each entry in `memory/topics/state/active-setups.json`'s `open[]`, decide RIDE, SELL (now), or SELL (wait) by re-running the thesis against current `perps-scan`, `narrative-tracker`, `market-context-refresh`, and `aixbt-pulse` data. Required, even on a skip day for new setups.
2. **Decide new setups.** Up to **5** new setups per day. Each is `LONG (now)`, `LONG (wait)`, `SHORT (now)`, or `SHORT (wait)` with required fields populated. If nothing clears the confluence bar, emit a FADE — do not fabricate.

Skip-day discipline applies to **new setups only**. Open positions are always evaluated.

## Inputs (consumed via chain)

This skill runs as chain Step 2 with `consume:` set to seven upstream skills. The chain-runner injects all seven artifacts into the working context as `.outputs/.chain-context-perps-brief.md`. Read them as primary input:

- `.outputs/perps-scan.md` — regime classification + pattern tags + aggregate verdict
- `.outputs/narrative-tracker.md` — phase-grouped narratives with leading tokens
- `.outputs/market-context-refresh.md` — regime + breadth + F&G + Polymarket
- `.outputs/aixbt-pulse.md` — cross-domain pulse + bridge call
- `.outputs/monitor-runners.md` — DEX runners, tag-grouped
- `.outputs/token-movers.md` — winners/losers/trending with tags
- `.outputs/token-call.md` — daily token call (or skip-day variant)

**Plus, critically:**
- `memory/topics/state/active-setups.json` — the ledger. Read `open[]` and `pending[]` at the start of every run.
- `memory/topics/market-context.md` — full canonical regime view
- `memory/MEMORY.md` + last 7 days of `memory/logs/`

## Process — five passes

### Pass A — Evaluate every open ledger entry

For each entry in `ledger.open[]`:

1. Locate the asset in today's `perps-scan.md` and `narrative-tracker.md`.
2. Re-run the original thesis. Is it still intact?
   - Regime still aligned with direction?
   - Narrative phase still aligned?
   - Pattern tags still supporting (or new contradicting tags appeared)?
   - Invalidation triggered yet (price level OR signal-state change)?
3. Decide: `RIDE`, `SELL (now)`, or `SELL (wait)`.
4. If `SELL (now)`: name the close reason concretely. Compute return vs entry, vs BTC, vs ETH (using current BTC/ETH prices from `market-context-refresh`).
5. If `SELL (wait)`: name the trigger that would fire the exit.
6. If `RIDE`: name the current condition the operator should watch in the `watch` field.

Each evaluation appends to the ledger entry's `evaluations[]` array (handled by `apply-ledger-ops.py` — the brief writes it once into `ledger_ops.evaluations[]` in data.json).

### Pass B — Decide pending (wait) intents

For each entry in `ledger.pending[]`:

1. Has the trigger fired today?
   - **Yes** → promote to a new setup with `mode: "now"` and `pending_id_promoted: "<that ID>"`. The apply script removes the pending entry and opens a new `open[]` entry.
   - **No, but thesis intact** → re-emit in today's `new_setups[]` as a new setup with `mode: "wait"`. Add the pending entry's `id` to `ledger_ops.keep_pending[]`.
   - **No, and thesis broken** → do NOT add to `keep_pending`. The apply script drops the pending entry.

A pending entry NOT in `keep_pending` AND NOT promoted is dropped.

### Pass 0 — Discovery (independent of quant)

Generate ~10 candidates by **attention**, not signal:

1. `narrative-tracker.md` — leading tokens from RISING and EMERGING narratives.
2. `aixbt-pulse.md` — projects named in crypto/macro/tradfi, especially in the bridge call.
3. `token-movers.md` — CoinGecko trending.
4. WebSearch — per dominant narrative: `"[narrative] tokens [today]"`, `"crypto trending tokens today"`.

Filter to **Bybit-listed perps**. Cross-reference against `perps-scan` asset list.

### Pass 1 — Combine, dedupe, tag

Merge quant candidates (non-NEUTRAL in `perps-scan`) with discovery candidates. Tag each `[QUANT]` / `[DISCOVERY]` / `[BOTH]`. Cap 15 unique assets. `[BOTH]` first, then `[QUANT]`, then `[DISCOVERY]`.

Exclude any asset that already has an open ledger entry in the same direction — that's an existing position, not a new setup.

### Pass 2 — Targeted enrichment

For each candidate, run 3–5 WebSearch queries:

**Always:**
- Token unlock schedule
- Recent 24h news catalyst
- X sentiment proxy

**Conditional:**
- CAPITULATION → reason for drop
- DISTRIBUTION → resistance, insider selling
- CATALYST-BREAKOUT → catalyst identification
- ACCUMULATION / COMPRESSION → upcoming announcement, roadmap
- Narrative-tagged → regulatory / SEC angle

3–6 concrete-fact lines per asset. No speculation.

### Pass 3 — Confluence judgement + composition

For each enriched candidate, judge against the **enumerated confluence criteria**:

| Criterion | What it means |
|---|---|
| `quant_regime_aligned` | `perps-scan` regime supports the directional thesis |
| `pattern_tag_supports` | A cross-signal pattern tag reinforces the thesis (e.g. STEALTH-POSITIONING for long, LONG-TRAP for short) |
| `narrative_phase_aligned` | `narrative-tracker` phase aligns (Rising for long, Fading/Peak for short) |
| `market_regime_aligned` | Aggregate market read aligns (LEVERAGE BUILDING / TRENDING for long; CROWDED TOPPING / DELEVERAGING for short) |
| `both_tag` | Asset is `[BOTH]` — quant + attention agree |
| `repeat_appearance` | Same asset, same regime, same narrative phase for ≥2 consecutive days |
| `regime_transition` | Day-over-day regime transition supports thesis (e.g. ACCUMULATION → CATALYST-BREAKOUT for long) |
| `cross_domain_bridge` | `aixbt-pulse` flags a macro/geo/tradfi catalyst that maps to this asset's sector |
| `enrichment_positive` | Pass 2 enrichment surfaces a confirming catalyst with no disqualifying findings |
| `dominance_aligned` | BTC.D / USDT.D / ETH/BTC capital-flow signals align (populated when Phase 3 ships; in Phase 1, list only when `market-context-refresh` already surfaces the read) |

**Log every criterion that fired** in `confluence_fired[]`. Optionally log considered-but-rejected criteria in `confluence_missing[]`.

Single-criterion setups are allowed but discouraged — the strongest setups carry multiple. The job is the join.

**Cap 5 new setups in the published brief.** Anything that would have qualified but didn't make the top-5 by confluence quality drops — there is no overflow in v4 (the ledger is the persistent record now).

**FADE override:** if the aggregate market read is `CROWDED TOPPING` or `DELEVERAGING` AND no specific high-conviction shorts cleared, the entire `new_setups[]` may be empty. The render script then emits the FADE line.

## Required fields per new setup (no exceptions)

- `ticker`, `direction` (LONG | SHORT), `mode` (now | wait), `horizon` (24h | 3d | 7d | multi-week)
- `entry_zone` (for `mode: now`) — price level, range, or `"market"`
- `trigger` (for `mode: wait`) — price level OR named signal-state change
- `invalidation` — price level OR named signal-state change
- `thesis` — 1–2 sentences
- `confluence_fired[]` — at least one criterion from the enumerated set
- `risks[]` — at least one named risk, non-empty

## Required fields per open position (no exceptions)

- `id` — matches the ledger entry id
- `ticker`, `direction`, `fired_date`, `fired_price`, `horizon`
- `day_of` — `"N/M"` where N is days elapsed and M is horizon-as-days (multi-week = 21)
- `call` — `RIDE`, `SELL (now)`, or `SELL (wait)`
- `thesis_status` — `intact` or `broken`
- `thesis_note` — short justification (1 sentence)
- `invalidation` — original or revised
- `watch` — current condition the operator should monitor (string or null)
- `evaluation_note` — note that gets appended to the ledger's `evaluations[]`

## Write the structured data artifact

**Write `.outputs/perps-brief.data.json`. DO NOT write `.outputs/perps-brief.md` directly. DO NOT call `./notify`. DO NOT edit `memory/topics/state/active-setups.json` directly.**

The postprocess step (`scripts/postprocess-perps-brief.sh`) handles all three:

1. `scripts/render-perps-brief.py` produces the markdown artifact.
2. `scripts/lib/ledger.py snapshot` saves a pre-apply backup.
3. `scripts/apply-ledger-ops.py` applies the ledger_ops to active-setups.json atomically.
4. `python3 -m lib.ledger` validates the post-apply ledger.
5. `./notify --signal` queues the Discord delivery.

### JSON schema (v4)

```json
{
  "schema_version": "v4",
  "date": "${today}",
  "qualifier": null,

  "market_sentiment": {
    "paragraphs": [
      "BTC funding warm at +0.07%/8h avg. OI +6% 24h, basis +0.3%. Majors absorbing leverage on the bid.",
      "Alt funding neutral, no rotation yet. Memes hot — 3 of top 5 funding extremes. Retail crowded there, not majors."
    ],
    "bias_line": "Bias · long majors with structure, fade extreme funding on meme tickers."
  },

  "open_positions": [
    {
      "id": "HYPE-2026-05-18-001",
      "ticker": "HYPE",
      "direction": "LONG",
      "fired_date": "2026-05-18",
      "fired_price": 28.40,
      "horizon": "7d",
      "day_of": "2/7",
      "call": "RIDE",
      "thesis_status": "intact",
      "thesis_note": "ACCUMULATION continues, OI +21% 7d, Hyperliquid narrative still RISING",
      "invalidation": "close below $26.00 OR funding extreme >+0.15%/8h",
      "watch": "funding warming (+0.04%/8h, up from +0.02%). Approaching second-half-of-horizon judgement.",
      "evaluation_note": "thesis intact, OI accelerating, no invalidation hit"
    }
  ],

  "new_setups": [
    {
      "ticker": "SOL",
      "direction": "LONG",
      "mode": "wait",
      "horizon": "7d",
      "entry_zone": null,
      "trigger": "close above $158 with vol >1.5x 7d avg AND OI delta positive",
      "thesis": "Regime transition COMPRESSION → CATALYST-BREAKOUT pending. AI sector tailwind. [BOTH] tag (top-trader L/S building +0.3 over 7d).",
      "invalidation": "close below $148 before trigger fires",
      "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag", "cross_domain_bridge"],
      "confluence_missing": ["regime_transition"],
      "risks": ["BTC.D rolling could front-run too aggressively", "NVDA earnings Wed = binary catalyst"]
    },
    {
      "ticker": "FARTCOIN",
      "direction": "SHORT",
      "mode": "now",
      "horizon": "3d",
      "entry_zone": "market or first bounce to $0.65",
      "trigger": null,
      "thesis": "DISTRIBUTION + LONG-TRAP (funding +0.14%/8h, top L/S 2.4, OI +35% 24h with price down 4%). Memes phase PEAK.",
      "invalidation": "close above $0.72",
      "confluence_fired": ["quant_regime_aligned", "pattern_tag_supports", "narrative_phase_aligned", "market_regime_aligned"],
      "confluence_missing": ["both_tag", "repeat_appearance"],
      "risks": ["memes can squeeze irrespective of fundamentals", "size as starter"]
    }
  ],

  "fade_note": null,
  "skip_day_best_near_miss": null,

  "ledger_ops": {
    "evaluations": [
      {
        "open_id": "HYPE-2026-05-18-001",
        "date": "${today}",
        "call": "RIDE",
        "price_at_eval": 31.40,
        "note": "thesis intact, OI accelerating, no invalidation hit"
      }
    ],
    "close": [],
    "open_now": [
      {
        "ticker": "FARTCOIN",
        "direction": "SHORT",
        "fired_price": 0.6710,
        "fired_btc_price": 95210,
        "fired_eth_price": 3510,
        "entry_zone": "market or first bounce to $0.65",
        "invalidation": "close above $0.72",
        "horizon": "3d",
        "thesis": "DISTRIBUTION + LONG-TRAP. Funding +0.14%/8h, top L/S 2.4, OI +35% 24h with price down 4%. Memes phase PEAK.",
        "confluence_fired": ["quant_regime_aligned", "pattern_tag_supports", "narrative_phase_aligned", "market_regime_aligned"],
        "confluence_missing": ["both_tag", "repeat_appearance"],
        "named_risks": ["memes can squeeze irrespective of fundamentals"],
        "pending_id_promoted": null
      }
    ],
    "add_pending": [
      {
        "ticker": "SOL",
        "direction": "LONG",
        "trigger": "close above $158 with vol >1.5x 7d avg AND OI delta positive",
        "invalidation": "close below $148 before trigger fires",
        "horizon": "7d",
        "thesis": "Regime transition COMPRESSION → CATALYST-BREAKOUT pending.",
        "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag", "cross_domain_bridge"],
        "named_risks": ["BTC.D rolling could front-run too aggressively"]
      }
    ],
    "keep_pending": []
  }
}
```

### Field-level rules

- **`schema_version`** — must be `"v4"`. The render script rejects anything else.
- **`date`** — `${today}` (UTC YYYY-MM-DD).
- **`qualifier`** — `null` for normal. Set to `"degraded (perps-scan unavailable, discovery-only)"` for degraded runs, or operator-meaningful suffix.
- **`market_sentiment.paragraphs`** — array of paragraphs, one per topic. Writing-style applies.
- **`market_sentiment.bias_line`** — single-line bias call, prefixed `Bias · `.
- **`open_positions[]`** — one entry per open ledger row. Empty array is valid ONLY when the ledger has no open entries. If the ledger has open entries and this array is empty, that's a bug — the postprocess will still render and apply, but daily-ops-review will surface the gap.
- **`open_positions[].day_of`** — string like `"2/7"`. Compute as: days-elapsed-since-fired-date / horizon-as-days. Use 21 for `multi-week`.
- **`new_setups[]`** — capped at 5. Empty means FADE (the render emits a FADE line). Each entry must satisfy required fields above.
- **`new_setups[].mode`** — `"now"` requires `entry_zone`. `"wait"` requires `trigger`.
- **`fade_note`** — optional single-line FADE explanation when `new_setups[]` is empty. Default render: `"FADE — no new conviction setups today"`.
- **`skip_day_best_near_miss`** — single-sentence near-miss for skip-day variant. Renders as `Best near-miss: …` after the FADE line. Only meaningful when `new_setups[]` is empty.
- **`ledger_ops`** — applied by `apply-ledger-ops.py`. Required structure below.

### `ledger_ops` structure

**`evaluations[]`** — one per open ledger entry. Must include all open IDs from the ledger. Each: `{open_id, date, call, price_at_eval, note}`.

**`close[]`** — one entry per `SELL (now)` call. Each: `{open_id, closed_price, close_reason, return_pct, return_vs_btc_pct, return_vs_eth_pct, outcome, horizon_realized}`. `outcome` is one of `WIN`, `LOSS`, `NEUTRAL`. Default rule:
- `WIN` = return_vs_btc_pct ≥ +2% AND not invalidation-hit
- `LOSS` = invalidation hit OR return_vs_btc_pct ≤ −2%
- `NEUTRAL` = between

**`open_now[]`** — one entry per `LONG (now)` or `SHORT (now)` new setup. Each: `{ticker, direction, fired_price, fired_btc_price, fired_eth_price, entry_zone, invalidation, horizon, thesis, confluence_fired, confluence_missing, named_risks, pending_id_promoted}`. `fired_price`, `fired_btc_price`, `fired_eth_price` are snapshots at brief-publish-time — pull current prices from `market-context-refresh` artifact OR the perps-scan cache. `pending_id_promoted` references a pending entry being promoted to open; null otherwise.

**`add_pending[]`** — one entry per `LONG (wait)` or `SHORT (wait)` setup that is NEW (no existing pending entry for it). Each: `{ticker, direction, trigger, invalidation, horizon, thesis, confluence_fired, named_risks}`.

**`keep_pending[]`** — IDs from `ledger.pending[]` that should remain. Any pending ID NOT in this list AND NOT in `pending_id_promoted` (from open_now) AND NOT just-added is DROPPED by the apply script. **Carry forward each pending you still believe in.**

### Edge cases

- **No open ledger entries (cold start or after all closes):** `open_positions: []`, `ledger_ops.evaluations: []`. Render skips the OPEN POSITIONS section entirely.
- **No new setups clear:** `new_setups: []`, `ledger_ops.open_now: []`, `ledger_ops.add_pending: []`. Set `fade_note` and optionally `skip_day_best_near_miss`. Open positions are still evaluated.
- **`perps-scan` artifact missing (degraded):** set `qualifier` to a descriptive label. Open positions are still evaluated using narrative-tracker + market-context only. Conservative bias on RIDE/SELL — when in doubt, SELL (wait) until quant returns. New setups: discovery-only, much higher bar.
- **Multiple upstream artifacts missing:** set `qualifier`, leave most of `new_setups` empty. Open positions still evaluated. `daily-ops-review` surfaces the cause.
- **Pending entry's trigger fired:** emit in `new_setups` with `mode: "now"`. In `ledger_ops.open_now`, set `pending_id_promoted` to the pending entry's id. The apply script removes the pending entry and opens a new open entry.
- **Pending entry's invalidation hit:** do NOT add to `keep_pending`. The apply script drops it. Note the drop in the brief's market_sentiment paragraphs if material.
- **Pending entry still relevant:** add its id to `keep_pending`, and re-emit in `new_setups` with `mode: "wait"`.
- **Two setups on same ticker in opposite directions:** allowed but unusual. Both open_now entries land in the ledger with separate IDs.

### Render verification

After writing the JSON, do NOT write `.outputs/perps-brief.md`, do NOT call `./notify`, and do NOT touch `memory/topics/state/active-setups.json`. The postprocess pipeline owns all three. If the JSON fails schema validation, the render writes a `Perps Brief · unknown date · render failed` placeholder and the apply step is skipped — the ledger stays intact.

### Notification routing

`scripts/postprocess-perps-brief.sh` calls `./notify --signal "$(cat .outputs/perps-brief.md)"`. Discord via `DISCORD_WEBHOOK_MAP[perps-brief]` → `#perps` channel. Chunking handles the 2000-character limit.

## Log to `memory/logs/${today}.md`

```
## Perps Brief
- **Open positions evaluated:** N (R RIDE, S SELL-now, W SELL-wait)
- **Pending entries:** P (kept K, promoted-to-open M, dropped D, new-added A)
- **New setups:** N — capped at 5
  - TICKER · DIRECTION (now|wait) · horizon · confluence: criterion1, criterion2 ...
  - ...
- **Closes this run:** N (W win, L loss, U neutral)
- **Source artifacts read:** [✓/⚠ list of consumed upstream artifacts + ledger]
- **Artifact written:** .outputs/perps-brief.data.json (rendered to .outputs/perps-brief.md by postprocess)
- **Ledger update:** open Δ, pending Δ, closed Δ
- **Notification sent:** yes (normal | skip-day | degraded) — queued by postprocess to #perps
```

## Sandbox note

This skill is mostly consume-only — it reads artifacts written by Step 1 chain steps and the ledger JSON. The Pass 0 + Pass 2 WebSearch calls go through Claude's WebSearch tool which works in the sandbox. No outbound curl required (the upstream skills handle that).

If WebSearch fails or returns empty for a Pass 2 query, write `(no findings)` for that enrichment line — do not invent.

## Environment Variables

- None required. WebSearch is built into Claude.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- **Position-aware first.** Evaluate every open ledger entry before deciding new setups. Skip-day discipline applies only to `new_setups[]`, never to open evaluations.
- **Confluence is structured, not prose.** Every new setup must list at least one criterion from the enumerated set in `confluence_fired[]`. Track-record analysis (Phase 2) reads these.
- **Required fields are required.** `entry_zone` for `mode: now`, `trigger` for `mode: wait`, `invalidation` always, `named_risks` always non-empty. The schema validator rejects setups missing any of these.
- **Cap 5 new setups.** No overflow — the ledger is the persistent record.
- **FADE is honest.** Empty `new_setups[]` is the correct answer on quiet days. Don't fabricate.
- **Pending entries need explicit carry-forward.** If a `(wait)` setup is still good, its id must be in `ledger_ops.keep_pending[]`. Silence drops it.
- **Discovery is independent of quant.** Pass 0 runs even when perps-scan flagged plenty. `[BOTH]` is the signal of agreement.
- **No source footer.** `daily-ops-review` reports artifact health. Setup-level evidence comes from the per-line context inside each setup block.

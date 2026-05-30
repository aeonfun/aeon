---
name: Perps Brief
description: Position-aware sector synthesis — evaluate current positions, decide new entries with structured confluence, surface up to 5 watchlist candidates
var: ""
tags: [crypto, research]
---
<!-- v4.1: position-aware brief on top of the v4 base. Simplified vocabulary (LONG/SHORT for new positions, RIDE/CLOSE for current, WAIT-direction for watchlist). New sections: CURRENT POSITIONS, NEW POSITIONS, WATCHLIST. Auto-flip semantics: opposite-direction high-conviction entry on an active position triggers explicit CLOSE-then-open. MAE/MFE tracking from daily Coinglass cache. SCARE outcome category for invalidation-breach-but-recovered. Watchlist cap 5, no overflow. v3 base preserved in SKILL.v3.md alongside. -->

> **${var}** — Optional thesis or sector filter (e.g. "AI tokens only", "fade memes"). If empty, scans broadly across the perps universe.

Today is ${today}. Compose the position-aware perps sector brief by **evaluating every current ledger position first**, then combining quant classifications from `perps-scan` with independent discovery and targeted enrichment to decide today's new entries and watchlist candidates. This is the integration + decision layer — quant signals + narrative momentum + macro context + catalyst research + position state come together into RIDE/CLOSE calls on existing trades and LONG/SHORT entries on new ones.

**Compose in order: read ledger → evaluate current → decide new + watchlist → write JSON.**

Before composing, internalize `memory/topics/soul.md` as standing frame. Reason across the engine data and form committed views — for current positions, new entries, and watchlist candidates. **Single high-quality signals warrant entries; confluence increases conviction.** Translate internal data (funding deltas, top L/S, basis, pattern tags) into external triggers the operator can verify (price levels, volume signatures, narrative inflections, sector behaviour). When uncertain, name the specific external condition that would resolve it. Never regress to neutral-analyst tone — the output IS the view.

After views are formed, apply style + structure.

**Apply `memory/topics/writing-style.md` to all output.**

Read `memory/MEMORY.md` for context.

## Decision vocabulary (locked v4.1)

**Sections:**

- **CURRENT POSITIONS** — every entry in `ledger.open[]`. Required RIDE or CLOSE call per position. Unbounded count.
- **NEW POSITIONS** — fresh LONG or SHORT entries fired today. Cap **5**. Each becomes a tracked ledger entry.
- **WATCHLIST** — assets that don't meet entry conviction but are worth noting. Cap **5**. The WAIT bucket.

**Calls:**

| Section | Call | Meaning |
|---|---|---|
| NEW POSITIONS | `LONG` | Enter long at the named entry zone (or market). Opens a ledger entry. |
| NEW POSITIONS | `SHORT` | Enter short at the named entry zone (or market). Opens a ledger entry. |
| CURRENT POSITIONS | `RIDE` | Thesis intact; continue holding. |
| CURRENT POSITIONS | `CLOSE` | Exit now. Moves ledger entry → `closed[]`. Outcome locked. |
| WATCHLIST | (none) | Direction tagged (LONG/SHORT), no call — these are intents pending a trigger. |

**Auto-flip rule.** If an asset has an open position in one direction and today's analysis produces a high-conviction entry in the opposite direction, the brief must:
1. Emit `CLOSE` for the current position with `auto_flipped: true` in `ledger_ops.close[]`
2. Emit the new entry in `new_positions[]` AND `ledger_ops.open_now[]` normally

If the opposite-direction signal is only watchlist-conviction (not strong enough for NEW POSITIONS), do NOT close the current position. Mention the emerging opposite signal in the current position's `watch` field instead. Watchlist-conviction is not enough to override an active position.

**Same-direction signal on an existing position is suppressed.** v4.1 has no pyramiding. If FARTCOIN is short and a fresh SHORT signal fires today, drop the new signal. Acknowledge in the existing position's `watch` field if material.

## Goal

Three deliverables per run:

1. **Evaluate every current ledger position.** Required, even on a skip day for new entries.
2. **Decide new entries.** Up to 5 LONG/SHORT entries. Cap is hard.
3. **Decide watchlist candidates.** Up to 5 WAIT entries. Cap is hard.

Skip-day discipline applies to NEW POSITIONS and WATCHLIST. CURRENT POSITIONS is always evaluated.

## Inputs (consumed via chain)

This skill runs as chain Step 2 with `consume:` set to eight upstream skills. The chain-runner injects all artifacts into `.outputs/.chain-context-perps-brief.md`:

- `.outputs/perps-scan.md` — regime classification + pattern tags + aggregate verdict
- `.outputs/narrative-tracker.md` — phase-grouped narratives with leading tokens
- `.outputs/market-context-refresh.md` — regime + breadth + F&G + Polymarket
- `.outputs/aixbt-pulse.md` — cross-domain pulse + bridge call
- `.outputs/monitor-runners.md` — DEX runners, tag-grouped
- `.outputs/token-movers.md` — winners/losers/trending with tags
- `.outputs/token-call.md` — daily token call (or skip-day variant)
- `.outputs/outcome-tracker.md` — **track record context**. Headline win rate, by-direction / by-horizon / by-confluence-pattern rollups, mark-to-market on every open position, and a NOTES section with auto-detected anomalies. Use this as ambient context for your judgement: if a confluence pattern has historically underperformed, weight it less; if direct entries beat watchlist promotions, lower the bar for direct entries; if SCARE rate is high, tighten invalidation logic in your watch fields. The track record is information, not a hard constraint — integrate it alongside today's signal data.

**Plus, critically:**
- `memory/topics/state/active-setups.json` — the ledger. Read `open[]` and `watchlist[]` at the start of every run.
- `memory/topics/market-context.md` — full canonical regime view
- `memory/MEMORY.md` + last 7 days of `memory/logs/`

## Process — five passes

### Pass A — Evaluate every current ledger position

For each entry in `ledger.open[]`:

1. Locate the asset in today's `perps-scan.md` and `narrative-tracker.md`. Get today's close price, daily high, daily low.
2. Re-run the original thesis. Is it still intact?
   - Regime still aligned with direction?
   - Narrative phase still aligned?
   - Pattern tags still supporting (or new contradicting tags appeared)?
   - Did the daily close cross the invalidation level today?
3. Decide: `RIDE` or `CLOSE`.
4. If `CLOSE`: compute return vs entry, vs BTC, vs ETH (using current BTC/ETH prices from `market-context-refresh`). Set `close_reason`.
5. If `RIDE`: name the current condition the operator should watch.
6. **Record today's price snapshot** in the evaluation: `price_at_eval`, `todays_high`, `todays_low`. The apply script uses these to update MAE/MFE.
7. **Record invalidation breach if applicable.** If today's daily close crossed the invalidation level, set `invalidation_breached_today: true` in the evaluation entry. This is sticky on the ledger entry (once true, stays true). Drives the SCARE outcome later.

   **CRITICAL — DO NOT MENTION BREACH IN PROSE WITHOUT SETTING THE FLAG.** If your evaluation note says anything like "Close $X below $Y invalidation", "breach recorded", "stop hit but holding", "broke the line", or "invalidation crossed", you MUST set `invalidation_breached_today: true` in that same evaluation's structured fields. Production audit on 2026-05-25 found HYPE flagged as breach=true with prose ("Close $55.107 below $56 invalidation — breach recorded") but the structured flag was never set across 8 evaluations. SCARE outcomes will under-report if this discipline slips.

   Rule: prose says breach → flag is true. Anything else is a bug.

Each evaluation must include all fields. The apply script appends to the entry's `evaluations[]` array and updates MAE/MFE.

### Pass B — Decide watchlist carry-forward

For each entry in `ledger.watchlist[]`:

1. Has the trigger fired today?
   - **Yes** → promote to NEW POSITIONS with the same direction. Add to `ledger_ops.open_now[]` with `watchlist_id_promoted: "<that ID>"`. Optionally include `promotion_note` (default note auto-generated). The apply script removes the watchlist entry from the active list, archives it into `watchlist_closed[]` with `close_reason: "promoted"`, and opens a new ledger entry with `watchlist_provenance` populated.
   - **No, but thesis intact** → carry forward. Re-emit in today's WATCHLIST section. Add the watchlist entry's `id` to `ledger_ops.keep_watchlist[]`.
   - **No, and thesis broken or invalidated** → drop with an EXPLICIT reason. Add to `ledger_ops.drop_watchlist[]` with `{watchlist_id, reason, note}` (see below).

#### Explicit drops — required to preserve reasoning

When dropping a watchlist entry, ALWAYS use `ledger_ops.drop_watchlist[]` with an explicit reason and a substantive note. This data feeds V2 judgement review — every drop is a call you made, and we need the reasoning preserved for later accuracy analysis.

Each drop entry:

```json
{"watchlist_id": "ASSET-watchlist-YYYY-MM-DD-NNN",
 "reason": "invalidated" | "thesis_decayed" | "stale",
 "note": "<a substantive sentence explaining the decision>"}
```

Reason categories:

| Reason | When to use |
|---|---|
| `invalidated` | Price action breached the watchlist's invalidation level. The setup explicitly failed. |
| `thesis_decayed` | The underlying narrative or quant setup is no longer compelling — flows rotated elsewhere, sector lost momentum, catalyst faded. Active judgement call. |
| `stale` | Entry has sat without firing or invalidating for an extended period. Removed for hygiene. Use sparingly — prefer `thesis_decayed` if you can articulate why. |

**`promoted` is NOT a valid reason here.** Promotions are handled in `open_now` via `watchlist_id_promoted` and the apply script archives them automatically with the right reason.

**Note quality matters.** A drop note saying "no longer compelling" is useless. A drop note saying "AI sector rolled — TOTAL3 lost the 80B level, narrative-tracker phase moved to Fading, similar positions in the discovery wave already played out" is actionable when reviewing why we missed a winner.

A watchlist entry NOT in `keep_watchlist` AND NOT promoted AND NOT in `drop_watchlist` will still be removed by the apply script, but archived as `"stale"` with a note flagging that you omitted explicit reasoning. **Avoid this — it shows up as a reasoning gap in audits.**

### Pass 0 — Discovery (independent of quant)

Generate ~10 candidates by attention:

1. `narrative-tracker.md` — leading tokens from RISING and EMERGING narratives
2. `aixbt-pulse.md` — projects in crypto/macro/tradfi sections, especially in the bridge call
3. `token-movers.md` — CoinGecko trending
4. WebSearch — per dominant narrative

Filter to Bybit-listed perps. Cross-reference against `perps-scan` asset list.

### Pass 1 — Combine, dedupe, tag

Merge quant candidates (non-NEUTRAL in `perps-scan`) with discovery. Tag `[QUANT]` / `[DISCOVERY]` / `[BOTH]`. Cap 15 unique assets.

**Exclude assets that already have an open position in the same direction.** Same-direction signal is suppressed. **Include assets with opposite-direction open positions** — these are auto-flip candidates if today's signal is high enough.

### Pass 2 — Targeted enrichment

3–5 WebSearch queries per candidate:

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

### Pass 3 — Confluence judgement + tier assignment

For each enriched candidate, judge against the enumerated confluence criteria:

| Criterion | What it means |
|---|---|
| `quant_regime_aligned` | `perps-scan` regime supports the directional thesis |
| `pattern_tag_supports` | Pattern tag reinforces (e.g. STEALTH-POSITIONING for long, LONG-TRAP for short) |
| `narrative_phase_aligned` | Phase aligns (Rising for long, Fading/Peak for short) |
| `market_regime_aligned` | Aggregate market read aligns |
| `both_tag` | Asset is `[BOTH]` — quant + attention agree |
| `repeat_appearance` | Same asset, same regime, same narrative phase for ≥2 consecutive days |
| `regime_transition` | Day-over-day regime transition supports thesis |
| `cross_domain_bridge` | `aixbt-pulse` flags a macro/geo/tradfi catalyst mapping to this asset's sector |
| `enrichment_positive` | Pass 2 enrichment surfaces a confirming catalyst with no disqualifying findings |
| `dominance_aligned` | BTC.D / USDT.D / ETH/BTC capital-flow signals align (populated when Phase 3 ships) |

**Tier assignment:**
- **NEW POSITIONS** — high conviction. Cap 5 by confluence count, ties broken by judgement.
- **WATCHLIST** — partial conviction, named trigger condition. Cap 5 by confluence count.
- **NOISE** — drops. Not surfaced anywhere.

**The cap-5 selection rule for both NEW POSITIONS and WATCHLIST is confluence count first.** When ties exist, prefer:
1. Repeat appearance (asset has been a candidate multiple days running)
2. `[BOTH]` tag
3. Pure judgement as tiebreaker

This rule lets the track-record measure whether confluence-count-based ranking outperforms judgement-only ranking over time. As track record matures, we may transition fully to judgement-based selection.

## Required fields per current position

- `id` — matches the ledger entry
- `ticker`, `direction`, `fired_date`, `fired_price`, `horizon`
- `day_of` — `"N/M"` where N is days elapsed, M is horizon-as-days (multi-week = 21)
- `call` — `RIDE` or `CLOSE`
- `thesis_note` — short justification (1 sentence)
- `invalidation` — original or revised
- For RIDE: `watch` — current condition to monitor; `mae_pct`, `mfe_pct`, `mae_day_of`, `mfe_day_of`, `now_pct` (computed from current price)
- For CLOSE: `return_pct`, `return_vs_btc_pct`, `return_vs_eth_pct`, `outcome` (WIN | LOSS | SCARE | NEUTRAL), `mae_pct`, `mfe_pct`, `auto_flipped` (boolean — true when this CLOSE was triggered by an opposite-direction entry on the same asset; renders as `CLOSE (auto-flip)`)

## Required fields per new position

- `ticker`, `direction` (LONG | SHORT), `horizon` (24h | 3d | 7d | multi-week)
- `entry_zone` — price level, range, or `"market"`
- `invalidation` — price level OR named signal-state change
- `thesis` — **array of 3-4 bullet strings**. Each bullet is a complete self-contained sentence covering one of: price action, narrative, regime/positioning, cross-domain catalyst. **Apply `memory/topics/writing-style.md` Pattern 7 strictly** — no source-artifact shorthand, no telegraphic fragments. Each bullet must read clearly to someone who hasn't opened the upstream artifacts. **Target ~120 chars per bullet, hard cap 180.** Tighter than v4.1's original 200-char target — operator confirmed Discord mobile renders unrecoverably when bullets wrap multiple times.
- `confluence_fired[]` — at least one criterion from the enumerated set (logged for the ledger / track-record, NOT rendered in the operator-facing card)
- `risks[]` — **array of 2-3 bullet strings**, non-empty. Each risk is a named, concrete concern (not "market could turn"). Same ~120 char target, 180 char cap as thesis bullets.
- `invalidation` — **must be chartable** (price level, price + volume condition). DO NOT reference funding / OI / LSR / regime-name conditions in this field. Those go in `engine_watch_conditions` instead (structured) where the poller monitors them and alerts the operator on cross. Operator-facing UX = chartable; engine-facing analysis = structured. See Pattern 7 in `memory/topics/writing-style.md` for the full no-engine-jargon rule.
- `engine_watch_conditions[]` — **structured array of conditions the poller will monitor** on this position's behalf. The poller (V2 work, scheduled hourly) reads these, evaluates against Coinglass cache data, and alerts the operator when any condition fires. Each entry: `{type, threshold, trigger_label, severity}`. Optional fields: `window_days` (for delta types), `window_hours` (for short-horizon types), `unit` (for cosmetic/clarity).
  - **Condition types:** `price_close_above`, `price_close_below`, `funding_above`, `funding_below`, `oi_change_above_pct`, `oi_change_below_pct`, `lsr_above`, `lsr_below`, `lsr_delta_above`, `lsr_delta_below`, `taker_buy_above_pct`, `taker_buy_below_pct`, `basis_above`, `basis_below`, `volume_ratio_above`
  - **Severity:** `info` (quiet alert), `warning` (default), `critical` (would change RIDE/CLOSE decision — invalidation breach, auto-flip trigger)
  - **trigger_label:** plain-English description for the alert embed, written for an operator who doesn't know the codebase. Example: `"smart money exiting on the 7d window"` not `"top_ls_delta_7d < 0"`.
  - **Required when opening:** every NEW POSITION should have at minimum one `price_close_above` (for SHORT) or `price_close_below` (for LONG) condition matching the `invalidation` price level. This is the structured invalidation that the poller monitors. Add as many other conditions as the engine's analytical depth warrants — typically 3-5 per position.

## Required fields per watchlist entry

- `ticker`, `direction` (LONG | SHORT)
- `day_of_watchlist` — N (1 for new, increments for carry-forwards)
- `trigger` — named external condition that would promote to NEW POSITIONS
- `invalidation` — price level OR named signal-state change before trigger fires
- `thesis` — **array of 2-3 bullet strings**. Same writing rules as new-position thesis bullets.
- `confluence_fired[]` — at least one criterion (ledger-only, not rendered)

**Optional for watchlist (include if known, omit otherwise):**

- `horizon` — `24h | 3d | 7d | multi-week`. May be unknown until the trigger fires and the entry promotes to a position. Omit cleanly if you haven't committed to a horizon yet.

## Write the structured data artifact

**Write `.outputs/perps-brief.data.json`. DO NOT write `.outputs/perps-brief.md` directly. DO NOT call `./notify`. DO NOT edit `memory/topics/state/active-setups.json` directly.**

The postprocess step handles all of the above:
1. `scripts/render-perps-brief.py` → markdown
2. `scripts/lib/ledger.py snapshot` → pre-apply backup
3. `scripts/apply-ledger-ops.py` → applies ops atomically
4. `python3 -m lib.ledger` → post-apply validation
5. Per-message split + per-signal Discord delivery wrapped in code blocks. MARKET CONTEXT is one message, CURRENT POSITIONS is one message (table + per-row prose), and each NEW POSITION and WATCHLIST entry is its own message. On heavy days this means 7-12 separate Discord messages.

### JSON schema (v4.1)

```json
{
  "schema_version": "v4.1",
  "date": "${today}",
  "qualifier": null,

  "market_sentiment": {
    "headline_metrics": [
      {"label": "BTC",     "value_top": "$77,375",       "value_bottom": "+0.74% 24h"},
      {"label": "Breadth", "value_top": "10/20 green",   "value_bottom": "DEX vol -22% vs 7d"},
      {"label": "F&G",     "value_top": "30",            "value_bottom": "↑ from 25 (out of Fear)"}
    ],
    "sections": [
      {"label": "Macro", "body": "Two competing selloff drivers in the tape today — Hormuz de-escalation runs disinflationary while Fed hike-risk runs hawkish. AI/tech overweight sits exposed to either tail."},
      {"label": "Perps", "body": "Quiet across the perps universe — no regime breakouts firing on the 25-asset slice. PLAY ripped 60% on funding extremes, sitting just under a distribution setup. Both setups read as extreme positioning without a clean setup to ride."},
      {"label": "Book",  "body": "Five open positions stacking three sector themes. AI-compute (EIGEN, AKT) and perp-DEX (HYPE, ASTER) concentration is heavy. BCH SHORT runs alone on legacy-alt structural bleed."}
    ],
    "bias_line": "Bias · ride the open book through macro fragility. No new entries — the perps tape is neutral, chop regime unresolved."
  },

  "current_positions": [
    {
      "id": "HYPE-2026-05-18-001",
      "ticker": "HYPE",
      "direction": "LONG",
      "fired_date": "2026-05-18",
      "fired_price": 28.40,
      "horizon": "7d",
      "day_of": "4/7",
      "call": "RIDE",
      "thesis_note": "ACCUMULATION continues, OI +21% 7d, narrative still RISING",
      "invalidation": "close below $26.00",
      "watch": "funding warming +0.04%/8h, up from +0.02%",
      "mae_pct": -2.1, "mae_day_of": "2",
      "mfe_pct": 12.3, "mfe_day_of": "3",
      "now_pct": 10.6
    },
    {
      "id": "TAO-2026-05-19-001",
      "ticker": "TAO",
      "direction": "LONG",
      "fired_date": "2026-05-19",
      "fired_price": 485.00,
      "horizon": "3d",
      "day_of": "3/3",
      "call": "CLOSE",
      "thesis_note": "horizon reached, momentum slowing, funding warming",
      "invalidation": "close below $470",
      "return_pct": 9.4,
      "return_vs_btc_pct": 7.1,
      "return_vs_eth_pct": 8.2,
      "outcome": "WIN",
      "mae_pct": -1.8,
      "mfe_pct": 11.2,
      "auto_flipped": false
    }
  ],

  "new_positions": [
    {
      "ticker": "FARTCOIN",
      "direction": "SHORT",
      "horizon": "3d",
      "entry_zone": "market or first bounce to $0.65",
      "invalidation": "close above $0.72",
      "thesis": [
        "FARTCOIN closed -4% today with OI up 35% in the same 24 hours. That combination — price down while leverage builds — fires the LONG-TRAP pattern in perps-scan.",
        "Funding rate sits at +0.14%/8h, well above the +0.06% extreme gate. Longs are paying premium to stay positioned while the asset bleeds.",
        "Top-trader long/short ratio at 2.4 means smart-money traders are crowded long alongside retail. Both sides positioned for an up-move; an unwind hits hard.",
        "Narrative-tracker has the meme sector in PEAK status. No fresh catalyst on the calendar to defend the bid."
      ],
      "confluence_fired": ["quant_regime_aligned", "pattern_tag_supports", "narrative_phase_aligned", "market_regime_aligned"],
      "risks": [
        "Memes can squeeze irrespective of fundamentals. A liquidation cascade above $0.72 invalidates the trade.",
        "Funding could normalise overnight if a large long unwinds without a price bid, removing the asymmetry."
      ]
    }
  ],

  "watchlist": [
    {
      "ticker": "SOL",
      "direction": "LONG",
      "day_of_watchlist": 2,
      "trigger": "close above $158 with 24h volume above 1.5x the 7d average AND OI net positive on the day",
      "invalidation": "close below $148 before the trigger fires",
      "thesis": [
        "SOL is sitting in a tight 4% range over the past 7 days. OI has been building 18% week-on-week without a corresponding price move — classic pre-breakout compression.",
        "Top-trader L/S has risen 0.3 points over 7 days, indicating smart-money positioning ahead of a move. perps-scan tags this as STEALTH-POSITIONING.",
        "AI sector is in RISING phase in narrative-tracker, providing a sector tailwind. aixbt-pulse named AI inference demand in today's bridge call."
      ],
      "confluence_fired": ["pattern_tag_supports", "narrative_phase_aligned", "both_tag", "cross_domain_bridge"]
    }
  ],

  "ledger_ops": {
    "evaluations": [
      {
        "open_id": "HYPE-2026-05-18-001",
        "date": "${today}",
        "call": "RIDE",
        "price_at_eval": 31.40,
        "todays_high": 31.80,
        "todays_low": 30.50,
        "invalidation_breached_today": false,
        "note": "thesis intact, no invalidation hit"
      },
      {
        "open_id": "TAO-2026-05-19-001",
        "date": "${today}",
        "call": "CLOSE",
        "price_at_eval": 525.00,
        "todays_high": 530.00,
        "todays_low": 520.00,
        "invalidation_breached_today": false,
        "note": "horizon reached"
      }
    ],
    "close": [
      {
        "open_id": "TAO-2026-05-19-001",
        "closed_price": 525.00,
        "close_reason": "horizon reached, momentum slowing, funding warming",
        "return_pct": 9.4,
        "return_vs_btc_pct": 7.1,
        "return_vs_eth_pct": 8.2,
        "horizon_realized": "3d",
        "auto_flipped": false
      }
    ],
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
        "thesis": [
          "FARTCOIN closed -4% today with OI up 35% — long-trap setup, leverage building into a falling price.",
          "Funding at +0.14%/8h sits well above the +0.06% gate where long-side crowding usually breaks.",
          "Top-trader LSR at 2.4 — smart money is crowded long alongside retail, both sides positioned for an up-move that isn't there.",
          "Meme sector momentum is at peak attention with no fresh catalyst on the calendar to defend the bid."
        ],
        "confluence_fired": ["quant_regime_aligned", "pattern_tag_supports", "narrative_phase_aligned", "market_regime_aligned"],
        "confluence_missing": ["both_tag"],
        "named_risks": [
          "Memes can squeeze irrespective of fundamentals.",
          "Funding could normalise without a price bid."
        ],
        "engine_watch_conditions": [
          {"type": "price_close_above", "threshold": 0.72, "trigger_label": "invalidation breached", "severity": "critical"},
          {"type": "funding_above",     "threshold": 0.0015, "trigger_label": "funding crowding accelerating", "severity": "warning"},
          {"type": "lsr_below",         "threshold": 1.5, "trigger_label": "smart money unwinding the crowd", "severity": "warning"},
          {"type": "taker_buy_above_pct", "threshold": 55, "trigger_label": "buyers stepping in — squeeze risk", "severity": "warning"}
        ],
        "watchlist_id_promoted": null
      }
    ],
    "add_watchlist": [
      {
        "ticker": "PEPE",
        "direction": "SHORT",
        "trigger": "funding extreme above +0.15%/8h with top L/S above 2.0",
        "invalidation": "close above last 7d high",
        "horizon": "3d",
        "thesis": [
          "PEPE in DISTRIBUTION regime, funding has been steadily warming past the +0.06% gate.",
          "Top-trader L/S has crept up from 1.4 to 1.8 over 7 days — not yet at LONG-TRAP severity but building.",
          "Meme sector in PEAK alongside FARTCOIN — sector-wide unwind risk if the dominant meme breaks."
        ],
        "confluence_fired": ["quant_regime_aligned", "narrative_phase_aligned"],
        "named_risks": ["Could squeeze before the trigger fires if funding flushes overnight."]
      }
    ],
    "keep_watchlist": ["SOL-watchlist-2026-05-19-001"],
    "drop_watchlist": [
      {
        "watchlist_id": "XAU-watchlist-2026-05-25-001",
        "reason": "thesis_decayed",
        "note": "Gold rotation thesis is broken — DXY breaking down hard while gold trades sideways, the disinflation tailwind that drove the original setup is gone. Sector flow rotated back to AI/tech this week."
      },
      {
        "watchlist_id": "ZEC-watchlist-2026-05-22-001",
        "reason": "invalidated",
        "note": "Daily close at $63.40 above the $60 invalidation level. Privacy narrative caught a fresh bid from the EU regulatory news — setup is no longer a short."
      }
    ]
  }
}
```

### Field-level rules

- **`schema_version`** — must be `"v4.1"`.
- **`date`** — `${today}` (UTC YYYY-MM-DD).
- **`qualifier`** — `null` for normal; descriptive label for degraded runs.
- **`market_sentiment`** — structured into `headline_metrics` (inline scan-stats), `sections` (sub-headed prose), and `bias_line` (closing call). Writing-style applies, **Pattern 7 strictly** — no skill names, no internal scoring, no process references.
  - **`headline_metrics`** — array of 2-4 objects, each `{label, value_top, value_bottom}`. Renders as inline fields in the embed. Use for the at-a-glance "did anything important happen" stats: BTC + 24h change, breadth, F&G, total mcap, etc. Keep each label short (≤8 chars). `value_top` is the headline number; `value_bottom` is the qualifier (delta vs prior period, direction arrow, etc).
  - **`sections`** — array of 2-4 objects, each `{label, body}`. Renders as bold sub-heads + body prose. Suggested labels: `Macro`, `Perps`, `Book`, `Sentiment`, `Narrative` — pick the 2-4 that fit today's framing. Each `body` is 1-3 sentences max. Avoid wall-of-text.
  - **`bias_line`** — single-line bias call, typically prefixed `Bias · `. Bolded automatically in the embed. Apply writing-style.md strictly.
- **`current_positions[]`** — one entry per open ledger row. Empty array IS valid when the ledger has no open entries.
- **`new_positions[]`** — capped at 5. Empty is valid (skip-day for new entries).
- **`watchlist[]`** — capped at 5. Empty is valid.
- **`ledger_ops`** — applied by `apply-ledger-ops.py` AFTER render. Required structure documented inline above.

### Auto-flip in the JSON

When today's analysis fires a high-conviction opposite-direction entry on an existing open position:

1. The current_positions[] entry for that asset has `call: "CLOSE"` with full close fields filled
2. The ledger_ops.close[] entry has `auto_flipped: true` and references the open_id
3. The new_positions[] entry for the same ticker has the opposite direction
4. The ledger_ops.open_now[] entry mirrors new_positions[] — no special flag, just the new direction

The apply script processes close BEFORE open_now, so the asset slot is freed before the new direction is opened. No special "flip" op exists — auto-flip is just CLOSE + open_now on the same asset in the same run.

### Edge cases

- **No current positions:** `current_positions: []`, `ledger_ops.evaluations: []`. Render skips the CURRENT POSITIONS section.
- **No new entries:** `new_positions: []`, `ledger_ops.open_now: []`. Render skips the NEW POSITIONS section. Skip-day discipline.
- **No watchlist:** `watchlist: []`, `ledger_ops.add_watchlist: []`, `ledger_ops.keep_watchlist: []`. Render skips the WATCHLIST section.
- **All three empty:** brief still publishes with title + MARKET SENTIMENT. The notification is just the sentiment paragraph + bias line.
- **`perps-scan` artifact missing (degraded):** set `qualifier`. Current positions still evaluated using narrative-tracker + market-context only. Conservative bias on RIDE/CLOSE.
- **Watchlist trigger fired:** emit in `new_positions[]` with mode-equivalent fields. `open_now[].watchlist_id_promoted` references the watchlist entry's id. Apply script removes from watchlist[], adds provenance to the new open entry.
- **Auto-flip case:** see above. CLOSE the current, OPEN the new direction in same run.

### Render verification

If the JSON fails schema validation, render writes a `Perps Brief · unknown date · render failed` placeholder and the apply step is skipped — ledger stays intact. Section-split notify is also skipped.

### Notification routing

`scripts/postprocess-perps-brief.sh` splits the rendered markdown by section divider, wraps each section in a code block, and calls `./notify --signal` per section. Discord delivers to `#perps` via `DISCORD_WEBHOOK_MAP[perps-brief]`. Each section is its own Discord message — sections never split mid-content.

## Log to `memory/logs/${today}.md`

```
## Perps Brief
- **Current positions evaluated:** N (R RIDE, C CLOSE)
- **Watchlist entries:** W (kept K, promoted M, dropped D, new-added A)
- **New positions:** N — capped at 5
  - TICKER · DIRECTION · horizon · confluence: criterion1, criterion2 ...
  - ...
- **Closes this run:** N (W win, L loss, U neutral, S scare, A auto-flipped)
- **Source artifacts read:** [✓/⚠ list]
- **Artifact written:** .outputs/perps-brief.data.json (rendered to .outputs/perps-brief.md by postprocess)
- **Ledger update:** open Δ, watchlist Δ, closed Δ
- **Notification sent:** N section messages queued to #perps
```

## Sandbox note

This skill is consume-only — reads chain artifacts + ledger JSON. WebSearch via Claude's built-in tool. No outbound curl needed.

## Environment Variables

- None required.

## Constraints

- **Position-aware first.** Evaluate every current ledger position before deciding new entries. Skip-day applies only to NEW POSITIONS and WATCHLIST.
- **Confluence is structured, not prose.** Every new position and watchlist entry lists at least one criterion from the enumerated set.
- **Required fields are required.** `entry_zone` for new positions, `trigger` for watchlist, `invalidation` always, `risks` always non-empty for new positions.
- **Cap 5 on NEW POSITIONS and WATCHLIST.** No overflow — the ledger is the persistent record.
- **Auto-flip is mechanical.** Opposite-direction high-conviction signal on an active position triggers CLOSE + OPEN in the same brief. No exceptions.
- **No pyramiding.** Same-direction signal on an active position is dropped.
- **MAE/MFE every evaluation.** Every current position evaluation must include `todays_high` and `todays_low` for the apply script to update MAE/MFE.
- **invalidation_breached_today is sticky.** Set true when a daily close crosses invalidation. Once true on the ledger entry, drives SCARE outcome at close time.
- **Watchlist entries need explicit decisions.** Each entry needs ONE of: `keep_watchlist[]` (carry forward), `open_now[].watchlist_id_promoted` (promote), or `drop_watchlist[]` (drop with reason + note). Silent omission gets archived as `"stale"` — flagged as a reasoning gap in V2 audits.

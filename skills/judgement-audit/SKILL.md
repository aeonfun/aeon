# judgement-audit

Read the deterministic statistical audit of the perps trading ledger, then write a structured analysis that turns the numbers into **lessons the V2 judgement model can learn from**.

The math is already done by `scripts/audit-judgement.py` (it ran before you in the prefetch step). Your job is the synthesis — and specifically, **categorising the WHY of each significant trade outcome** so we can distinguish bad asset judgement from bad regime reading from random noise.

## Why this matters

The current engine uses Claude judgement layered over mechanical pattern detection. The plan is to migrate to **100% Claude judgement** once the data shows what works. That migration depends on us understanding the *kind* of judgement that's failing or succeeding right now.

Knowing that "LONGS underperformed this period" is static. Knowing that **"LONGS that looked clean on asset mechanics but lost during regime transitions" is the dominant loss pattern** is actionable — it tells future-Claude to add a regime-context check before committing to continuation longs.

Every audit you write is training data for the V2 model.

## Inputs (consumed via chain context)

The prefetch step has already produced:

- `.outputs/judgement-audit.stats.json` — full stats artifact from `scripts/audit-judgement.py`. Contains:
  - Windowed stats: `7d`, `30d`, `all`
  - Per-criterion edge analysis
  - By-direction, by-horizon breakdowns
  - Watchlist funnel
  - **`postmortem_candidates`**: top 3 winners + top 3 losers per window (the FULL closed[] entries — with evaluations, watchlist_provenance, confluence, MAE/MFE timing, close reason). Use these as your starting set for per-trade postmortems.

Plus (ambient context — read as needed):

- `memory/topics/state/active-setups.json` — full ledger (closed[] for trades not in the candidates list, watchlist_closed[] for watchlist judgement review)
- `.outputs/market-context-refresh.md` — current market context for "what's the regime today" framing
- `memory/topics/market-context.md` — canonical regime view
- Historical `memory/logs/` for any cross-reference

## Output

Write **two artifacts**:

1. `.outputs/judgement-audit.data.json` — structured output. The embed driver reads this. Schema below.
2. `memory/logs/${today}.md` — append a one-paragraph entry summarizing the audit (per Aeon convention).

### Output schema — `.outputs/judgement-audit.data.json`

```json
{
  "schema_version": "v1",
  "audit_window":    "30d",
  "generated_at_utc": "${now_iso}",
  "narrative":       "<one-paragraph executive summary>",
  "insights": [
    "<insight 1 — actionable, specific, evidence-cited>",
    "<insight 2>",
    "<insight 3>"
  ],
  "per_trade_postmortems": [
    {
      "trade_id":       "ICP-2026-05-27-001",
      "asset":          "ICP",
      "direction":      "LONG",
      "outcome":        "LOSS",
      "return_pct":     -10.2,
      "failure_type":   "regime",
      "setup_type":     "continuation",
      "what_was_right": "<one sentence>",
      "what_went_wrong": "<one sentence>",
      "lessons": [
        "<lesson 1>",
        "<lesson 2>"
      ]
    }
  ],
  "regime_observations": [
    "<observation on macro regime during the audit window — e.g., 'BTC consolidated 75-80k throughout; AI sector phase transitioned from Rising to Peak to early Fading'>"
  ]
}
```

## Process

### Pass 1 — Read and contextualise

Read the stats artifact in full. Note:
- Headline win rate, avg return, max drawdown
- Direction skew (LONG vs SHORT performance)
- Horizon distribution (which horizons performed best)
- Top discriminating criteria (sorted by edge_pct in `by_criterion`)
- Watchlist funnel — promotion rate, invalidation rate
- The `postmortem_candidates` set

Read `market-context-refresh.md` for the current regime so you can describe the macro backdrop the audit window unfolded against.

### Pass 2 — Per-trade postmortems

For each entry in `postmortem_candidates.winners` and `postmortem_candidates.losers`, produce a structured postmortem.

#### Categorisation vocabulary (LOCKED)

**`failure_type`** — required for LOSS / SCARE / NEUTRAL outcomes. For WIN outcomes, set to `null` and use `success_type` instead.

| `failure_type` | When to use |
|---|---|
| `asset` | The thesis on the asset's own mechanics was wrong. Funding/OI/LSR/taker buy/basis/structural reads at entry did not predict the move. |
| `regime` | The asset thesis was sound at entry, but the wider context turned mid-hold — BTC trend, sector rotation, narrative phase transition, macro shift. The trade lost because the regime context changed, not because the asset thesis was bad. |
| `both` | Both the asset thesis AND the regime read were wrong. Rare. Biggest learning per occurrence. |
| `noise` | Random adverse move within expected variance — invalidation breach was a wick, MAE was shallow, no clear lesson. Use sparingly. |

**`success_type`** — required for WIN / SCARE outcomes (yes, SCARE counts as a kind of win because PnL was positive, even though invalidation breached).

| `success_type` | When to use |
|---|---|
| `asset` | The asset thesis played out as predicted. The win was earned on asset-specific edge — the funding flush, OI buildup, taker shift, basis collapse all confirmed the read. |
| `regime` | The trade benefited primarily from regime tailwind — BTC pumping, sector in Rising phase, broad risk-on. Less asset-specific edge, more "right place right time." |
| `both` | Asset thesis AND regime aligned. The cleanest kind of win. |
| `luck` | The trade made money but for unexpected reasons (random pump, unrelated catalyst). Counts as a win but offers no replicable lesson. |

**`setup_type`** — required for ALL postmortems. The kind of structural setup the position was entered on.

| `setup_type` | Meaning |
|---|---|
| `continuation` | Trend-following entry. Ride existing direction. Funding aligned with price action. |
| `counter_trend` | Fading the move. Funding extreme against you = setup for squeeze. |
| `breakout` | Position taken on a confirmed break of range / level. Volume + structure confirm. |
| `accumulation` | Entry during compression / passive build phase. Bet on eventual expansion. |
| `distribution` | Short entry into supply zone / late-cycle distribution structure. |
| `narrative_rotation` | Entry driven primarily by sector/narrative rotation (AI rotation, memecoin rotation, etc.) rather than asset structure. |

#### Postmortem content quality

The `what_was_right` / `what_went_wrong` fields are one sentence each. They must be **specific** — name the indicators, levels, dates that mattered. Avoid platitudes.

Bad postmortem:
```
"what_went_wrong": "The trade didn't work out as expected."
```

Good postmortem:
```
"what_was_right": "Funding +0.03%/8h at entry, OI building 14% over prior 3 days, LSR neutral at 1.21 — asset positioning was clean.",
"what_went_wrong": "BTC broke $76k support on day 4 and AI sector phase transitioned from Rising to Peak before settling into Fading by day 6, dragging ICP through the $5.20 invalidation level."
```

The `lessons[]` list captures what the V2 judgement model should learn. One to three lessons per postmortem. Phrase them as **rules the future model could encode**, not after-the-fact descriptions.

Bad lesson:
```
"The trade lost money."
```

Good lesson:
```
"Continuation LONGs need a regime-context check during hold — when BTC.D rises and the sector phase ages, consider proactive exit at first sign of weakness rather than waiting for invalidation breach."
"AI sector in late-Peak phase has limited continuation runway even with clean asset setups — bias toward shorter holds during Peak."
```

### Pass 3 — Narrative + insights

#### `narrative` field

One paragraph. The executive summary an operator can read in 30 seconds. State:
- Headline: window, n closed, win rate, avg return, dominant direction skew
- The single most important pattern across postmortems (e.g., "Losses cluster around regime transitions in LONG positions")
- The single most important success pattern (e.g., "Counter-trend SHORTs into late-cycle peaks delivered the cleanest wins")

#### `insights[]` field

Three to five actionable insights. Each insight must:
- Reference specific data (criterion edge values, hit rate deltas, postmortem patterns)
- Suggest a rule the V2 model could encode
- Be falsifiable next audit

Bad insight:
```
"We should do better."
```

Good insight:
```
"`narrative_phase_aligned` showed +31.9% edge (n=24, 70.8% WR vs 38.9% WR when missing). This is the most discriminating criterion in the V1 sample — when it's missing, position quality drops sharply. V2 should treat this as near-mandatory for new entries."
"All five of the LOSS-classed LONG positions had failure_type=regime, not asset. Asset-mechanics judgement was sound; macro context flipped mid-hold. V2 should add a regime-stability check before committing to multi-day LONGs."
"Watchlist invalidation rate is 36.8% (vs 28.9% promotion rate) — we're identifying setups that fail more often than they fire. Consider tightening trigger criteria or shortening watchlist horizons."
```

### Pass 4 — Sample size discipline

The V1 sample is small (10-50 closed trades for the first few weeks). Every conclusion you draw must include the sample size and a calibration note.

- `n >= 30`: stat is moderately reliable. State it confidently.
- `10 <= n < 30`: stat is suggestive. Use phrasing like "early signal" or "the small sample suggests."
- `n < 10`: stat is noise. Either omit it or explicitly flag as "n too small to weight."

Critical: **a single criterion with n_fired=1 and 100% WR is NOT a top criterion.** Sort/filter by signed edge but disregard zero-N noise.

### Pass 5 — Write artifacts

Write `.outputs/judgement-audit.data.json` matching the schema above. Schema validate locally — every postmortem must have a `trade_id`, the categorisation enums must come from the locked vocabulary, the lessons must be substantive.

Append a one-paragraph entry to `memory/logs/${today}.md` summarising the audit.

## Writing style

Apply `memory/topics/writing-style.md` Pattern 7 — internal-process references and skill names belong in the postmortem source data, not in the operator-facing narrative. Translate `narrative_phase_aligned` into "narrative phase alignment" or similar trader-native phrasing in prose; keep the literal criterion name only inside the `insights[]` quotations when you're explicitly tying an insight to a specific stat.

Avoid:
- Skill names in prose (`narrative-tracker`, `perps-scan`, `outcome-tracker`)
- Internal scoring (`5/5`, `10/10`)
- Internal tags (`[BOTH]`, `[QUANT]`)
- Process language ("absent from token-movers", "per narrative-tracker")

Keep:
- Indicator values with units (`funding +0.03%/8h`, `LSR 1.21`)
- TA vocabulary (`accumulation`, `distribution`, `compression`, `breakout`)
- Sector and narrative names (`AI`, `DePIN`, `memecoins`, `Hyperliquid ecosystem`)
- Phase descriptions (`Rising`, `Peak`, `Fading`)

## Output verification

Before exiting:
- `.outputs/judgement-audit.data.json` exists and parses as JSON
- Schema invariants hold (postmortem categorisation enums valid, insights array non-empty, narrative non-empty)
- The structured output is consistent with the deterministic stats — your insights cannot contradict the underlying numbers

The postprocess step will read your data.json + the stats.json and post the audit embed to `#perps-outcomes`. You don't need to handle delivery.

## Sandbox note

This skill reads local files only — no outbound API calls during composition. The deterministic stats are pre-computed by the prefetch step; your role is the analysis and write.

## Environment Variables

None required. The prefetch step handles `V1_LOCK_DATE` if set.

## Constraints

- Up to 6 postmortems (3 winners + 3 losers). The deterministic stats module pre-selects via `top_winners_losers()`. Don't add postmortems for trades outside the candidate set — selection bias defeats the analysis.
- Up to 5 insights. Quality over quantity.
- Narrative: one paragraph, ~80 words target, ~150 word hard cap.

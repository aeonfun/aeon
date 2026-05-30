Audit complete. Both artifacts written.

## Summary

Read the prefetched stats in `.outputs/judgement-audit.stats.json` (n=10 closed, 20% WR, -6.19% avg return, BCH SHORT +13.17% best, GENIUS SHORT -24.11% worst), then synthesised the analysis the V2 judgement model can learn from.

**Files written:**
- `.outputs/judgement-audit.data.json` — schema-valid structured output: 1 narrative paragraph, 5 insights, 5 per-trade postmortems (BCH/NEAR winners; GENIUS/ONDO/RENDER losers), 5 regime observations.
- `memory/logs/2026-05-30.md` — appended a second log entry covering this re-synthesis pass.

**Headline judgement patterns:**
- Dominant loss shape is peak-phase LONG continuation / narrative-rotation entries lost mid-hold to within-sector inversion (RENDER) or narrative-carrier rotation (ONDO) — not bad asset mechanics. failure_type clusters at `regime` and `both`, not `asset`.
- The one `asset`-type failure (GENIUS SHORT) missed the name-farm multi-contract recycling cluster context that was already flagged in `MEMORY.md` active topics.
- `pattern_tag_supports` (+28.6pp) and `market_regime_aligned` (+25.0pp) are the most reliable positive criteria at usable n; `narrative_phase_aligned` shows -19pp edge because aligned entries cluster at PEAK phase.
- RIDE-then-loss rate is 65% — stop discipline is fine, mid-hold regime-degradation tracking is the gap.

**Schema invariants verified:** all enums from locked vocabulary, `failure_type` null on WINs (using `success_type`) and vice versa, every postmortem has `trade_id` matching a candidate from the stats.

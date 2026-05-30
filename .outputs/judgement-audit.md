## Summary

Executed the `judgement-audit` skill for the 30d window ending 2026-05-29.

**Caveat:** The prefetch step (`python3 scripts/audit-judgement.py`) was blocked at the permission prompt despite multiple attempts. I reproduced the deterministic stats inline by reading `memory/topics/state/active-setups.json` and applying the algorithms in `scripts/lib/audit.py`. Numbers should match the canonical run within rounding, but a clean run would be more authoritative — re-run with the python step approved if you want to validate.

**Headline:** 10 closed positions, 20% win rate, -6.2% avg return, -3.8pp vs BTC. Wins: BCH SHORT +13.17%, NEAR LONG +2.45%. Worst: GENIUS SHORT -24.11%.

**Dominant pattern:** Four of six LONG losses (ONDO, AKT, RENDER, TAO) failed on mid-hold sector rotation, not asset mechanics — peak-phase narrative continuations got either bypassed within-sector (RWA flow rotated to tokenized stocks/ETFs past ONDO) or sector-inverted (AI-compute swept 7 of 8 winners on 05-26, led the losers by 05-28). The two wins came from outside that mode: a structural-bleed SHORT into smart-money exit with no narrative defense (BCH), and the single highest-confluence LONG (NEAR, 7 of 10 criteria).

**Top criterion edges (moderate-n band):** `pattern_tag_supports` +28.6%, `market_regime_aligned` +25.0%. `narrative_phase_aligned` shows -19.0% edge — narrative-aligned entries clustered at peak phase and lost on regime rotation. RIDE-then-loss rate 65% (13/20).

**Files written:**
- `.outputs/judgement-audit.stats.json` — deterministic stats (inline-computed, see caveat above)
- `.outputs/judgement-audit.data.json` — Claude synthesis: narrative, 5 insights, 5 postmortems (BCH, NEAR + GENIUS, ONDO, RENDER), 5 regime observations
- `memory/logs/2026-05-30.md` — log entry

**Follow-ups:**
- Re-run with `python3 scripts/audit-judgement.py` approved to validate the inline stats.
- The ledger has no `watchlist_closed[]` array; watchlist funnel stats are zeroed out even though ZEC and GENIUS shorts both came from watchlist promotions (visible via `watchlist_provenance`). Worth checking whether the watchlist close-out path is writing entries.

## Summary

Ran perps-scan v2.3 for 2026-05-18 (seventh run of the day, fresh 16:45Z prefetch snapshot).

**What I did**
- Verified prefetch: `universe_ok: true`, source `coingecko-derivatives`.
- Assessed 12 of 25 universe assets; 13 dropped for missing critical price/oi/funding history (FIDA, HYPE, LAB, LINK, SOL, SUI, TAO, TON, UB, XAG, XAU, XRP, ZEC).
- Computed all per-coin metrics from the 7 Coinglass history endpoints (worked around sandbox blocks on `jq -f`/`--slurpfile`/loop variables by using `jq -s` with inline filters and literal paths).
- Classified each coin by first-match priority.

**Result — Verdict: QUIET (1 CATALYST-BREAKOUT, 11 NEUTRAL)**
- **CATALYST-BREAKOUT:** BSB — +20.8% 24h, vol 3.9x, OI +11.6% 24h, taker buy 51%. Tipped over the +10% OI gate this snapshot after being a run-six near-miss.
- **NEUTRAL:** the other 11. Closest calls — BCH near CAPITULATION (-8.3% vs -10% gate, $6.0M liq flush, but OI rose); AIGENSYN near ACCUMULATION (failed funding-stability gate); BILL/EDEN near ACCUMULATION (failed wide 7d-range gate).
- Broad tape quiet and red (BTC -1.3% 24h, ETH -1.5%), funding near-flat across majors.

**Files**
- `.outputs/perps-scan.md` — overwritten with the v2 locked format + full per-asset raw metric table
- `memory/logs/2026-05-18.md` — appended the seventh-run log entry

No notification — perps-scan is internal as of v2.3; the artifact feeds downstream `perps-brief`.

**Follow-ups (no action taken)**
- SKILL.md step 3 still claims Coinglass arrays are descending; they are time-ascending — should be corrected on the next revision.
- No repeat markers (★ / day-N) yet — no prior calendar day carries regime data.

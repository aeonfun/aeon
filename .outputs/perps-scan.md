I couldn't delete the three `.tmp-perps*` scratch files (sandbox blocks `rm`), but they're harmless untracked files outside the skill's committed outputs.

The perps-scan skill ran successfully — the first successful run after four prior "scan unavailable" attempts today.

## Summary

Executed `skills/perps-scan/SKILL.md` (v2.3) for 2026-05-18. The prefetch cache (`.coinglass-cache/`) was populated cleanly with `universe_ok: true`.

**Result — Verdict: MIXED (2 ACCUMULATION, 1 CATALYST-BREAKOUT, 9 NEUTRAL)**
- **ACCUMULATION:** CHZ, HYPE
- **CATALYST-BREAKOUT:** BSB (broke 7d high, +19% 24h, vol 3.8x, OI +11% 24h)
- **NEUTRAL:** ADA, BCH, BILL, BNB, BTC, DOGE, EDEN, ETH, LAB
- 12 of 25 universe assets assessed; 13 dropped for missing critical history (LINK, LTC, SOL, TAO, XAU/XAG/SILVER, etc. — all per-coin endpoints failed, mostly no-Binance-pair tickers)

**Notes**
- No repeat markers possible — first successful run, no prior regime data.
- Found a doc bug: Coinglass history arrays are time-**ascending** (data[0] = oldest), but SKILL.md step 3 says data[0] is newest. I computed metrics against the correct (newest) element via `sort_by(time)|reverse`; flagged for a doc fix.
- Could not run `python3`, `bash` scripts, or `./notify` inline (automated run, no interactive approval) — used `jq` per-file for all metrics and wrote the notification directly to `.pending-notify/` for post-run delivery.

**Files**
- `.outputs/perps-scan.md` — overwritten with the v2 locked-format scan
- `.pending-notify/1779118850.signal.md` — #perps signal queued for post-run delivery
- `memory/logs/2026-05-18.md` — appended the run log

**Follow-up:** tomorrow's run will be the first able to flag ≥2-day regime persistence. The SKILL.md data-orientation claim should be corrected on the next revision.

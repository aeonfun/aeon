## Summary

Ran the perps-scan skill (v2.3) for 2026-05-18 against the fresh prefetch cache (`manifest.fetched_at` 16:17Z, `universe_ok: true`).

**Result — Verdict: QUIET (no regime populated)**
- All 12 assessed assets classified NEUTRAL — no regime triggered.
- Regime counts: ACCUM=0 CAT=0 MOM=0 COMP=0 DIST=0 CAP=0 NEUTRAL=12.
- Broadly red, low-energy tape: BTC -1.2% 24h / -6.4% 7d, ETH -1.1% / -9.9%; funding near-flat across majors, no extremes.

**Near-misses worth flagging:**
- BCH — closest to CAPITULATION: -9.0% 24h (gate -10), negative funding, $6.0M top-quartile liq flush — but OI rose +2.7% instead of falling.
- BSB — closest to CATALYST-BREAKOUT: broke 7d high, +19.2% 24h, vol 3.9x, OI +9.9% 24h (gate +10). It cleared as CAT in the earlier same-day run on an +11% OI reading — the fresher snapshot tipped it under the gate.
- BILL / EDEN — missed ACCUMULATION on 7d range (85.5% / 104.8% vs <25% gate).

**Universe:** 12 of 25 assessed. 13 dropped — all per-coin history endpoints failed in prefetch (FIDA, HYPE, LAB, LINK, SOL, SUI, TAO, TON, UB, XAG, XAU, XRP, ZEC). ETH missing liq/topls/basis/taker; 1000PEPE/BILL/BSB/CL missing basis — classified anyway.

**Files:**
- `.outputs/perps-scan.md` — overwritten (stale assistant-summary text replaced) with QUIET title line + full per-asset metric table
- `.pending-notify/1779121547.signal.md` — single-line QUIET signal queued for post-run delivery to #perps (`./notify` can't run inline in this automated run)
- `memory/logs/2026-05-18.md` — appended the run log

**Notes:** Confirmed again that Coinglass history arrays are time-ascending (data[0] = oldest) — SKILL.md step 3 still claims data[0] is most recent; metrics were computed against the newest element. The doc fix remains a follow-up for the next skill revision.

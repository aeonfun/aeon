## Summary

Ran `monitor-runners` skill against GeckoTerminal across 5 chains + global + new-pools (12 endpoints, all `ok` after rate-limit back-offs).

**Verdict: SPECULATIVE.** 152 pools dedup'd → 55 cleared the quality gate → top 5 by Runner Score:

1. **[BREAKOUT] BASED / SOL** +1058% — score 86.6 — 17h-old, vol $3.6m on $60k liq (60x turnover), h1 still climbing.
2. **[CONTINUATION] NICE / SOL** +3121% — 81.9 — 68-day-old ticker reactivating on $25k liq, h1 +4%.
3. **[REVERSAL] DEBT / SOL** +732% — 81.6 — 277-day-old, h1 -18%, exit-liquidity event.
4. **[BREAKOUT] SHIBA / WETH (eth)** +5973% — 80.2 — fresh launch already collapsing h1 -26%.
5. **[BREAKOUT] WOFL / WETH (eth)** +798% — 79.3 — $25k FDV on $15k liq, casino-tier.

**No repeat runners** vs 04-25 (LASTMAN/BOAR/PEACE/mexicanunc all gone; 04-26 missed its slot via chain-runner DEGRADED).

**Notable second-iteration finding:** zero DEEP-LIQ tickers cleared into the top 5 again — same skew the 04-25 log flagged. Recommend a follow-up `self-improve` pass to cap `pct_pts` at 300% or add a soft DEEP-LIQ floor.

**Files:**
- `.runners-{global,solana-trend,solana-vol,eth-trend,eth-vol,base-trend,base-vol,bsc-trend,bsc-vol,arb-trend,arb-vol,new}.json` — raw GeckoTerminal data
- `.runners-process.js`, `.runners-result.json` — pipeline + scored output
- `.runners-notif.md` — formatted notification body
- `.pending-notify/1777291626.md` — queued for workflow delivery (direct `./notify` hit the documented `Unhandled node type: string` hook-block, 4th instance today)
- `memory/logs/2026-04-27.md` — appended `## Monitor Runners` section

**Follow-ups:** workflow-side postprocess will deliver the notification; consider a `self-improve` PR to add a DEEP-LIQ floor / cap pct weight in the scoring formula.

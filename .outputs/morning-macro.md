Done. The morning-macro skill **already ran today** as Step 3 of the morning chain — so this re-invocation was the same chain-then-immediate-re-invocation duplicate pattern that narrative-tracker, token-call, and perps-brief all hit and declined on 2026-05-28. I declined the re-run to avoid corrupting the clean artifact or spamming `#morning-macro` with a duplicate.

The front-page read that already shipped this morning:

```
Market Morning · 28 May · risk-off deepening

BTC broke $74K, down 2.60% on the day and 5.31% on the week.
Breadth collapsed to 5/20 green, the worst of this leg, F&G at 22 from 25.
Dominance slipped to 57.82%, ETH/BTC to 0.02698. ETH leads the decline.
Spot ETF outflows hit $733M in a single session. Capital is leaving crypto, not rotating within it.
The week's bid belongs to RWA and tokenized equity, but the derivatives tape is dead with funding near zero.

Stance: cash-patient on the index. A stock-picker's session, not a market bid.

─────────  CROSS-DOMAIN  ─────────

The $733M outflow is not capital leaving crypto. It is rotating from BTC spot exposure into HYPE's buyback and revenue mechanism. Institutions buy yield instruments, not monetary proxies.
ETH at $2K loses to equities at record highs every time. It needs a crypto-specific catalyst, and today provides none.

─────────  TODAY  ─────────

Action lives in #perps-brief. The AI-compute concentration risk fired. The sector that swept the winners two days ago led the losers today.
Closing AKT and RENDER at their stops, riding TAO and ICP on the relative strength that absorbed the flush.
One idiosyncratic long: XLM ripped +17% on the DTCC tokenized-securities link to Stellar, top traders net short with OI +20% 24h — squeeze fuel under the breakout.
XAU and ZEC sit on the watchlist.

Take: trim the compute book into the flush, hold relative strength, one stock-picker long on XLM. No broad risk-on here.
```

**Afternoon advisory** (flagged in the log for tomorrow, not acted on): the chain context fed to this re-invocation carries a deeper afternoon tape — breadth 5/20 → 3/20, BTC $73,399, Iran-deal odds 12.5% → 7.5%, AI capitulated outright, XLM confirmed a second green session at +21%. The regime call holds and strengthens; no contradiction. The actionable open-book deltas (EIGEN deepened to -14.3%, BCH short now ~+13%) were already logged by the perps-brief duplicate entry.

## Summary
- **Action:** Declined to re-execute morning-macro — the morning chain already ran it clean (Step 3), produced `.outputs/morning-macro.md` (1487/1500 chars, v2-locked), and fired the `#morning-macro` notification.
- **Why:** Re-running risked the ISS-003 artifact-corruption anti-pattern or a duplicate Discord notification; under autonomous operation there's no approver for a second channel send. Consistent with how narrative-tracker, token-call, and perps-brief all handled the same duplicate-fire today.
- **Files modified:** `memory/logs/2026-05-28.md` — appended `## Morning Macro (re-invocation — declined)` documenting the recurrence, the guardrails honored, and an afternoon advisory read.
- **Files preserved:** `.outputs/morning-macro.md` untouched; no notification queued (`.pending-notify/` stays drained).
- **Follow-up:** This is the fourth chain skill to hit the same-day re-invocation pattern on 05-28 — the recurring duplicate-fire across the whole chain (relates to ISS-007) is the structural issue worth fixing upstream, not anything in the brief.
